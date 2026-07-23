/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel, Corretor } from '../types';
import { INITIAL_IMOVEIS, INTEGRATED_IMOVEIS, MOCK_CORRETORES } from '../data';

const STORAGE_KEYS = {
  IMOVEIS: 'imobishare_imoveis',
  CORRETORES: 'imobishare_corretores',
  ACTIVE_CORRETOR: 'imobishare_active_corretor',
  FAVORITOS: 'imobishare_favoritos',
};

type SyncListener = () => void;

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
      const brokersRes = await fetch('/api/brokers');
      if (brokersRes.ok) {
        const brokers = await brokersRes.json();
        if (brokers && brokers.length > 0) {
          localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(brokers));
          
          // Also verify active broker profile is in sync
          const active = this.getActiveCorretor();
          const updatedActive = brokers.find((b: Corretor) => b.id === active.id);
          if (updatedActive) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(updatedActive));
          }
        }
      }

      // 2. Sync Properties
      const propertiesRes = await fetch('/api/properties');
      if (propertiesRes.ok) {
        const properties = await propertiesRes.json();
        if (properties) {
          localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(properties));
        }
      }

      // 3. Sync Favorites for active broker
      const activeCorretor = this.getActiveCorretor();
      if (activeCorretor && activeCorretor.id) {
        const favsRes = await fetch(`/api/favorites/${activeCorretor.id}`);
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
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(MOCK_CORRETORES));
      return MOCK_CORRETORES;
    }
    return JSON.parse(data);
  }

  // Get currently logged-in broker
  static getActiveCorretor(): Corretor {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_CORRETOR);
    if (!data) {
      const defaultCorretor = this.getCorretores()[0]; // Rodrigo Silva
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(defaultCorretor));
      return defaultCorretor;
    }
    return JSON.parse(data);
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
      localStorage.setItem(STORAGE_KEYS.CORRETORES, JSON.stringify(corretores));
    }
    
    // Also update active corretor if they are the active one
    const active = this.getActiveCorretor();
    if (active.id === corretor.id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(corretor));
    }

    // Push to server asynchronously
    fetch('/api/brokers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corretor),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post broker update to database:', err));
  }

  // Get all properties
  static getImoveis(): Imovel[] {
    const data = localStorage.getItem(STORAGE_KEYS.IMOVEIS);
    if (!data) {
      const allInitial = [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS];
      localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(allInitial));
      return allInitial;
    }
    
    let parsed: Imovel[] = [];
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing stored properties, resetting:", e);
      const allInitial = [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS];
      localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(allInitial));
      return allInitial;
    }
    
    return parsed;
  }

  // Get favorites for current broker
  static getFavoritos(corretorId: string): string[] {
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
    fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corretorId, imovelId }),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post favorite toggle to database:', err));

    return updated;
  }

  // Save / update a property
  static saveImovel(imovel: Omit<Imovel, 'id' | 'dataCadastro' | 'corretorId' | 'corretorNome'> & { id?: string }): Imovel {
    const imoveis = this.getImoveis();
    const activeCorretor = this.getActiveCorretor();
    let finalImovel: Imovel;
    
    if (imovel.id) {
      // Update existing
      const index = imoveis.findIndex(i => i.id === imovel.id);
      if (index !== -1) {
        const existing = imoveis[index];
        finalImovel = {
          ...existing,
          ...imovel,
          id: imovel.id, // guarantee same id
        } as Imovel;
        imoveis[index] = finalImovel;
      } else {
        // Fallback create
        finalImovel = {
          ...imovel,
          id: imovel.id,
          dataCadastro: new Date().toISOString(),
          corretorId: activeCorretor.id,
          corretorNome: activeCorretor.nome,
        } as Imovel;
        imoveis.unshift(finalImovel);
      }
    } else {
      // Create new
      finalImovel = {
        ...imovel,
        id: `imovel-${Date.now()}`,
        dataCadastro: new Date().toISOString(),
        corretorId: activeCorretor.id,
        corretorNome: activeCorretor.nome,
      } as Imovel;
      imoveis.unshift(finalImovel); // Add to beginning
    }
    
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));

    // Post update to Express database
    fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalImovel),
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to post property update to database:', err));

    return finalImovel;
  }

  // Duplicate a property
  static duplicateImovel(id: string): Imovel | null {
    const imoveis = this.getImoveis();
    const found = imoveis.find(i => i.id === id);
    if (!found) return null;

    const activeCorretor = this.getActiveCorretor();
    const duplicated: Imovel = {
      ...found,
      id: `imovel-${Date.now()}`,
      titulo: `${found.titulo} (Cópia)`,
      dataCadastro: new Date().toISOString(),
      corretorId: activeCorretor.id,
      corretorNome: activeCorretor.nome,
    };

    imoveis.unshift(duplicated);
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));

    // Save duplicate to backend database
    fetch('/api/properties', {
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
    fetch(`/api/properties/${id}`, {
      method: 'DELETE',
    }).then(res => {
      if (res.ok) this.syncWithServer();
    }).catch(err => console.error('Failed to delete property from database:', err));
  }

  // Get Broker Stats
  static getBrokerStats(corretorId: string) {
    const imoveis = this.getImoveis();
    const brokerImoveis = imoveis.filter(i => i.corretorId === corretorId);
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
      const response = await fetch('/api/ai/improve-description', {
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
      return data.text || params.text;
    } catch (error) {
      console.error('Failed to improve description via backend:', error);
      return params.text ? `${params.text}\n\nExcelente oportunidade em ${params.localizacao || 'local privilegiado'}.` : `Excelente imóvel em ${params.localizacao || 'ótimo bairro'}.`;
    }
  }
}
