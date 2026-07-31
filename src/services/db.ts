/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel, Corretor } from '../types';
import { INITIAL_IMOVEIS, INTEGRATED_IMOVEIS, MOCK_CORRETORES } from '../data';
import { sanitizeFotos } from '../utils/imageUtils';
import { getApiUrl } from '../utils/apiUrl';
import { auth } from './firebase';

const STORAGE_KEYS = {
  IMOVEIS: 'imobishare_imoveis',
  CORRETORES: 'imobishare_corretores',
  ACTIVE_CORRETOR: 'imobishare_active_corretor',
  FAVORITOS: 'imobishare_favoritos',
};

type SyncListener = () => void;

export function isProfileComplete(corretor: Partial<Corretor> | null | undefined): boolean {
  if (!corretor) return false;

  const hasNome = Boolean(corretor.nome && corretor.nome.trim().length > 0);
  const hasCreci = Boolean(
    corretor.creci && 
    corretor.creci.trim().length > 0 && 
    corretor.creci !== 'CRECI Pendente' && 
    corretor.creci !== '12345-F'
  );
  const hasContact = Boolean(
    (corretor.whatsapp && corretor.whatsapp.trim().length > 0 && corretor.whatsapp !== '(47) 99999-9999') ||
    (corretor.telefone && corretor.telefone.trim().length > 0 && corretor.telefone !== '(47) 99999-9999')
  );
  const hasCidade = Boolean(corretor.cidade && corretor.cidade.trim().length > 0);
  const hasEstado = Boolean(corretor.estado && corretor.estado.trim().length > 0);

  return hasNome && hasCreci && hasContact && hasCidade && hasEstado;
}

export class DbService {
  private static listeners: SyncListener[] = [];

  // Register a listener that triggers when the server data sync completes
  static subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  // Synchronize local cache with Express PostgreSQL/JSON database
  static async syncWithServer(): Promise<void> {
    try {
      // 1. Sync Brokers
      const brokersRes = await fetch(getApiUrl('/api/brokers'));
      if (brokersRes.ok) {
        const brokers = await brokersRes.json();
        if (Array.isArray(brokers)) {
          localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(brokers));
          
          // Also verify active broker profile is in sync
          const active = this.getActiveCorretor();
          if (active && active.id) {
            const updatedActive = brokers.find((b: Corretor) => b.id === active.id || (b.email && active.email && b.email.toLowerCase() === active.email.toLowerCase()));
            if (updatedActive) {
              localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(updatedActive));
            }
          }
        }
      }

      // 2. Sync Properties
      const propertiesRes = await fetch(getApiUrl('/api/properties'));
      if (propertiesRes.ok) {
        const properties = await propertiesRes.json();
        if (properties) {
          localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(properties));
        }
      }

      // 3. Sync Favorites for active broker
      const activeCorretor = this.getActiveCorretor();
      if (activeCorretor && activeCorretor.id) {
        const favsRes = await fetch(getApiUrl(`/api/favorites/${activeCorretor.id}`));
        if (favsRes.ok) {
          const favs = await favsRes.json();
          const allFavsRaw = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
          const allFavs = allFavsRaw ? JSON.parse(allFavsRaw) : {};
          allFavs[activeCorretor.id] = favs;
          localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(allFavs));
        }
      }

      // Notify the frontend components to reload data
      this.notifyListeners();
      console.log('🔄 Data successfully synchronized with production database.');
    } catch (error) {
      console.warn('⚠️ Server sync failed. Running in offline/cached mode:', error);
    }
  }

  // Get all brokers
  static getCorretores(): Corretor[] {
    const data = localStorage.getItem(STORAGE_KEYS.CORRETORES);
    if (!data) return [];
    try {
      const list: Corretor[] = JSON.parse(data);
      return list.filter(c => c && !['corretor-1', 'corretor-2', 'corretor-3'].includes(c.id));
    } catch {
      return [];
    }
  }

  // Get currently logged-in broker
  static getActiveCorretor(): Corretor | null {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_CORRETOR);
    if (data) {
      try {
        const parsed: Corretor = JSON.parse(data);
        if (parsed && !['corretor-1', 'corretor-2', 'corretor-3'].includes(parsed.id)) {
          return parsed;
        }
      } catch {
        // Fallback below
      }
    }
    
    // Default fallback broker for primary user account
    const defaultBroker: Corretor = {
      id: 'broker-afreccia_gmail_com',
      nome: 'Alexandre Freccia',
      email: 'afreccia@gmail.com',
      creci: '12345-F',
      telefone: '(47) 99999-9999',
      whatsapp: '(47) 99999-9999',
      foto: '',
      cidade: 'Balneário Camboriú',
      estado: 'SC',
      imobiliaria: 'ImobiShare'
    };
    return defaultBroker;
  }

  // Change logged-in broker
  static setActiveCorretor(corretor: Corretor): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(corretor));
    this.syncWithServer(); // Sync background favorites for new active broker
  }

  // Save or update a broker's profile
  static saveCorretor(corretor: Corretor): void {
    const corretores = this.getCorretores();
    const index = corretores.findIndex(c => c.id === corretor.id);
    if (index !== -1) {
      corretores[index] = corretor;
    } else {
      corretores.push(corretor);
    }
    localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(corretores));
    
    // Also update active corretor if they are the active one
    const active = this.getActiveCorretor();
    if (active && active.id === corretor.id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(corretor));
    }

    // Push to server asynchronously
    fetch(getApiUrl('/api/brokers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corretor),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post broker update to database:', err));
  }

  // Add new broker
  static addCorretor(corretor: Corretor): void {
    const corretores = this.getCorretores();
    const index = corretores.findIndex(c => c.id === corretor.id);
    if (index === -1) {
      corretores.push(corretor);
    } else {
      corretores[index] = corretor;
    }
    localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(corretores));
    
    fetch(getApiUrl('/api/brokers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corretor),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post broker to database:', err));
  }

  // Get all properties
  static getImoveis(): Imovel[] {
    const data = localStorage.getItem(STORAGE_KEYS.IMOVEIS);
    let rawList: Imovel[] = [];
    if (!data) {
      rawList = [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS];
    } else {
      try {
        rawList = JSON.parse(data);
      } catch (e) {
        console.error("Error parsing stored properties, resetting:", e);
        rawList = [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS];
      }
    }
    
    // Filter out test properties (imovel-1 to imovel-6, integ-1 to integ-4, test-diag-*)
    const cleanList = rawList.filter(item => {
      if (!item.id) return false;
      if (item.id.startsWith('imovel-') || item.id.startsWith('integ-') || item.id.startsWith('test-diag-')) {
        return false;
      }
      return true;
    });

    // Sanitize property photos to prevent corrupted or non-URL entries
    const sanitized = cleanList.map(item => ({
      ...item,
      fotos: sanitizeFotos(item.fotos)
    }));

    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(sanitized));
    
    return sanitized;
  }

  // Get favorites for current broker
  static getFavoritos(corretorId?: string | null): string[] {
    if (!corretorId) return [];
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
    if (!data) {
      const initialFavs = INITIAL_IMOVEIS.filter(i => i.favorito).map(i => i.id);
      localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify({ [corretorId]: initialFavs }));
      return initialFavs;
    }
    const parsed = JSON.parse(data);
    if (!parsed[corretorId] || parsed[corretorId].length === 0) {
      const initialFavs = INITIAL_IMOVEIS.filter(i => i.favorito).map(i => i.id);
      parsed[corretorId] = initialFavs;
      localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(parsed));
      return initialFavs;
    }
    return parsed[corretorId];
  }

  // Toggle favorite
  static toggleFavorite(corretorId: string, imovelId: string): string[] {
    const currentFavs = this.getFavoritos(corretorId);
    let updated: string[];
    if (currentFavs.includes(imovelId)) {
      updated = currentFavs.filter(id => id !== imovelId);
    } else {
      updated = [...currentFavs, imovelId];
    }
    
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
    const parsed = data ? JSON.parse(data) : {};
    parsed[corretorId] = updated;
    localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(parsed));

    // Send favorite toggle to backend
    fetch(getApiUrl('/api/favorites/toggle'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corretorId, imovelId }),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post favorite toggle to database:', err));

    return updated;
  }

  // Save / update a property
  static saveImovel(imovel: Omit<Imovel, 'id' | 'dataCadastro' | 'corretorId' | 'corretorNome'> & { id?: string; corretorId?: string; corretorEmail?: string; corretorNome?: string }): Imovel {
    const imoveis = this.getImoveis();
    const activeCorretor = this.getActiveCorretor();
    const userEmail = (imovel.corretorEmail || activeCorretor?.email || auth.currentUser?.email || 'afreccia@gmail.com').toLowerCase().trim();
    let finalImovel: Imovel;
    
    const sanitizedInputFotos = sanitizeFotos(imovel.fotos);

    if (imovel.id) {
      // Update existing
      const index = imoveis.findIndex(i => i.id === imovel.id);
      if (index !== -1) {
        const existing = imoveis[index];
        finalImovel = {
          ...existing,
          ...imovel,
          fotos: sanitizedInputFotos,
          id: imovel.id, // guarantee same id
          corretorEmail: userEmail || existing.corretorEmail,
        } as Imovel;
        imoveis[index] = finalImovel;
      } else {
        // Fallback create
        finalImovel = {
          ...imovel,
          fotos: sanitizedInputFotos,
          id: imovel.id,
          dataCadastro: new Date().toISOString(),
          corretorId: activeCorretor?.id || imovel.corretorId || 'corretor-anonimo',
          corretorEmail: userEmail,
          corretorNome: activeCorretor?.nome || imovel.corretorNome || 'Corretor',
        } as Imovel;
        imoveis.unshift(finalImovel);
      }
    } else {
      // Create new
      finalImovel = {
        ...imovel,
        fotos: sanitizedInputFotos,
        id: `imovel-${Date.now()}`,
        dataCadastro: new Date().toISOString(),
        corretorId: activeCorretor?.id || imovel.corretorId || 'corretor-anonimo',
        corretorEmail: userEmail,
        corretorNome: activeCorretor?.nome || imovel.corretorNome || 'Corretor',
      } as Imovel;
      imoveis.unshift(finalImovel); // Add to beginning
    }
    
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));

    // Post update to Express database
    const apiUrl = getApiUrl('/api/properties');
    console.log(`📡 Sending property POST request to: ${apiUrl}`);
    
    // Get Firebase ID token if user is logged in
    const sendPostRequest = async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      
      try {
        if (auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken(/* forceRefresh */ false);
          headers['Authorization'] = `Bearer ${idToken}`;
          console.log('🔑 Attached Firebase ID Token to request headers');
        }
      } catch (tokenErr) {
        console.warn('Could not get Firebase ID token:', tokenErr);
      }

      fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalImovel),
      }).then(async res => {
        if (res.ok) {
          console.log('✅ Property persisted successfully on backend');
          this.syncWithServer();
        } else {
          const errText = await res.text().catch(() => '');
          console.error(`❌ Failed to persist property on backend (Status ${res.status}):`, errText);
        }
      }).catch(err => {
        console.error('❌ Network error posting property update to backend:', err);
      });
    };

    sendPostRequest();

    return finalImovel;
  }

  // Duplicate a property
  static duplicateImovel(id: string): Imovel | null {
    const imoveis = this.getImoveis();
    const found = imoveis.find(i => i.id === id);
    if (!found) return null;

    const activeCorretor = this.getActiveCorretor();
    const userEmail = (activeCorretor?.email || auth.currentUser?.email || '').toLowerCase().trim();
    const duplicated: Imovel = {
      ...found,
      id: `imovel-${Date.now()}`,
      titulo: `${found.titulo} (Cópia)`,
      dataCadastro: new Date().toISOString(),
      corretorId: activeCorretor?.id || 'corretor-anonimo',
      corretorEmail: userEmail || found.corretorEmail,
      corretorNome: activeCorretor?.nome || 'Corretor',
    };

    imoveis.unshift(duplicated);
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));

    // Save duplicate to backend database
    fetch(getApiUrl('/api/properties'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicated),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to duplicate property in database:', err));

    return duplicated;
  }

  // Delete property
  static deleteImovel(id: string): void {
    const imoveis = this.getImoveis();
    const updated = imoveis.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(updated));

    // Delete from database
    fetch(getApiUrl(`/api/properties/${id}`), {
      method: 'DELETE',
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to delete property from database:', err));
  }

  // Get Broker Stats
  static getBrokerStats(corretorId: string, corretorEmail?: string) {
    const imoveis = this.getImoveis();
    const cleanEmail = (corretorEmail || this.getActiveCorretor()?.email || '').toLowerCase().trim();
    const brokerImoveis = imoveis.filter(i => 
      (cleanEmail && i.corretorEmail && i.corretorEmail.toLowerCase().trim() === cleanEmail) ||
      i.corretorId === corretorId
    );
    const qtdImoveis = brokerImoveis.length;
    const qtdLocacoes = brokerImoveis.filter(i => i.tipo === 'locação').length;
    const qtdVendas = brokerImoveis.filter(i => i.tipo === 'venda').length;
    
    return { qtdImoveis, qtdLocacoes, qtdVendas };
  }

  // Improve text using the AI proxy
  static async improveDescription(params: {
    text: string;
    type: 'venda' | 'locação';
    tipoImovel?: string;
    titulo?: string;
    localizacao?: string;
    nomeEdificio?: string;
    dormitorios?: number;
    vagas?: number;
    banheiros?: number;
    metragem?: number;
    areaTotal?: number;
    valor?: number;
  }): Promise<string> {
    try {
      const response = await fetch(getApiUrl('/api/ai/improve-description'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error('Erro na resposta do servidor API');
      }
      const data = await response.json();
      const rawText = data.text || params.text || '';
      return rawText.replace(/\*/g, '');
    } catch (error) {
      console.error('Failed to improve description via backend:', error);
      const fallback = params.text ? `${params.text}\n\nExcelente oportunidade em ${params.localizacao || 'local privilegiado'}.` : `Excelente imóvel em ${params.localizacao || 'ótimo bairro'}.`;
      return fallback.replace(/\*/g, '');
    }
  }
}
