/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel, Corretor, DiagnosticCheck } from '../types';
import { getApiUrl } from '../utils/apiUrl';
import { auth } from './firebase';

export function isProfileComplete(corretor: Partial<Corretor> | null | undefined): boolean {
  if (!corretor) return false;

  const hasNome = Boolean(corretor.nome && corretor.nome.trim().length > 0);
  const hasCreci = Boolean(
    corretor.creci && 
    corretor.creci.trim().length > 0 && 
    corretor.creci !== 'CRECI Pendente'
  );
  const hasContact = Boolean(
    (corretor.whatsapp && corretor.whatsapp.trim().length > 0) ||
    (corretor.telefone && corretor.telefone.trim().length > 0)
  );
  const hasCidade = Boolean(corretor.cidade && corretor.cidade.trim().length > 0);

  return hasNome && hasCreci && hasContact && hasCidade;
}

// In-memory cache & subscription system
let cachedCorretor: Corretor | null = null;
let cachedCorretores: Corretor[] = [];
let cachedImoveis: Imovel[] = [];
let cachedFavorites: string[] = [];
const subscribers: Array<() => void> = [];

let notifyTimer: any = null;
function notifySubscribers() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    subscribers.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.warn('Error in DbService subscriber callback:', e);
      }
    });
  }, 16);
}

function safeSetLocalStorage(key: string, value: string): void {
  // Execute storage writes asynchronously so main thread rendering stays ultra-fast
  setTimeout(() => {
    try {
      // REGRA: Nunca salvar a lista inteira de imóveis ('imobishare_imoveis') no localStorage!
      // O banco de dados é a fonte principal da verdade, prevenindo QuotaExceededError.
      if (key === 'imobishare_imoveis' || key.includes('imovel') || key.includes('properties')) {
        return;
      }
      // Se for a lista de corretores, sanitizar removendo fotos em Base64 grandes antes de persistir
      if (key === 'imobishare_corretores') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map(c => ({
              ...c,
              foto: (c.foto && c.foto.startsWith('data:image')) ? '' : c.foto,
              fotoUrl: (c.fotoUrl && c.fotoUrl.startsWith('data:image')) ? '' : c.fotoUrl,
            }));
            value = JSON.stringify(sanitized);
          }
        } catch {}
      }
      localStorage.setItem(key, value);
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.warn(`[DbService] localStorage quota exceeded for "${key}". Writing bypassed.`);
        try {
          localStorage.removeItem('imobishare_imoveis');
          localStorage.removeItem('imobishare_properties');
          localStorage.removeItem('imoveis');
        } catch {}
      } else {
        console.warn(`[DbService] localStorage write bypassed for "${key}":`, err);
      }
    }
  }, 0);
}

function loadInitialFromLocalStorage() {
  try {
    // Remove chave legada 'imobishare_imoveis' caso ainda exista,
    // liberando imediatamente os 5MB do navegador ocupados por fotos antigas
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('imobishare_imoveis');
        localStorage.removeItem('imobishare_properties');
        localStorage.removeItem('imoveis');
      }
    } catch {
      // Ignora se localStorage não estiver disponível
    }

    const savedActive = localStorage.getItem('imobishare_active_corretor');
    if (savedActive) {
      cachedCorretor = JSON.parse(savedActive);
    }
    const savedBrokers = localStorage.getItem('imobishare_corretores');
    if (savedBrokers) {
      cachedCorretores = JSON.parse(savedBrokers);
    }
    const savedFavs = localStorage.getItem('imobishare_favorites');
    if (savedFavs) {
      cachedFavorites = JSON.parse(savedFavs);
    }
  } catch (err) {
    console.warn('Error loading initial state from localStorage:', err);
  }
}

// Initialize on module load
loadInitialFromLocalStorage();

export class DbService {
  // Helper to get fresh Firebase ID token
  private static async getAuthHeader(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(/* forceRefresh */ false);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          return headers;
        }
      }
    } catch (err) {
      console.warn('⚠️ Não foi possível obter token do Firebase Auth:', err);
    }

    // Fallback: Construct active broker JWT bearer token for backend requests
    const active = this.getActiveCorretor();
    const email = (active?.email || auth.currentUser?.email || '').toLowerCase().trim();

    if (email) {
      headers['X-User-Email'] = email;

      const encodeB64Url = (obj: any) => {
        try {
          const json = JSON.stringify(obj);
          return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch {
          return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
      };

      const header = encodeB64Url({ alg: 'HS256', typ: 'JWT' });
      const payload = encodeB64Url({
        email,
        sub: active?.id || `broker-${email.replace(/[^a-z0-9]/gi, '_')}`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });
      headers['Authorization'] = `Bearer ${header}.${payload}.local_fallback_sig`;
    }

    return headers;
  }

  // --- Synchronous Getters & Local Cache Helpers ---

  static getActiveCorretor(): Corretor | null {
    if (cachedCorretor) return cachedCorretor;
    
    try {
      const savedActive = localStorage.getItem('imobishare_active_corretor');
      if (savedActive) {
        cachedCorretor = JSON.parse(savedActive);
        return cachedCorretor;
      }
    } catch (e) {}

    return null;
  }

  static setActiveCorretor(corretor: Corretor | null): void {
    cachedCorretor = corretor;
    if (corretor) {
      safeSetLocalStorage('imobishare_active_corretor', JSON.stringify(corretor));
      // Update in cachedCorretores list
      const idx = cachedCorretores.findIndex(c => c.id === corretor.id || (c.email && c.email.toLowerCase() === corretor.email.toLowerCase()));
      if (idx >= 0) {
        cachedCorretores[idx] = corretor;
      } else {
        cachedCorretores.push(corretor);
      }
      safeSetLocalStorage('imobishare_corretores', JSON.stringify(cachedCorretores));
    } else {
      localStorage.removeItem('imobishare_active_corretor');
    }
    notifySubscribers();
  }

  static getCorretores(): Corretor[] {
    const active = this.getActiveCorretor();
    const list = [...cachedCorretores];
    if (active && !list.some(c => c.id === active.id || (c.email && c.email.toLowerCase() === active.email.toLowerCase()))) {
      list.unshift(active);
    }
    return list;
  }

  static async fetchBrokers(): Promise<Corretor[]> {
    try {
      const res = await fetch(getApiUrl('/api/brokers'));
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          cachedCorretores = list;
          safeSetLocalStorage('imobishare_corretores', JSON.stringify(list));
          notifySubscribers();
          return list;
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar lista de corretores:', err);
    }
    return this.getCorretores();
  }

  static getBrokerStats(idOrEmail?: string) {
    const imoveis = this.getImoveisSync();
    const active = this.getActiveCorretor();
    const corretores = this.getCorretores();

    const param = (idOrEmail || '').toLowerCase().trim();

    // Find target broker by ID or Email
    const targetCorretor = (param
      ? (corretores.find(c =>
          (c.id && c.id.toLowerCase().trim() === param) ||
          (c.email && c.email.toLowerCase().trim() === param)
        ) || (active && (
          (active.id && active.id.toLowerCase().trim() === param) ||
          (active.email && active.email.toLowerCase().trim() === param)
        ) ? active : null))
      : null) || active;

    const targetId = targetCorretor?.id || (idOrEmail && !idOrEmail.includes('@') ? idOrEmail : '');
    const targetEmail = (targetCorretor?.email || active?.email || (idOrEmail && idOrEmail.includes('@') ? idOrEmail : '')).toLowerCase().trim();

    const isMine = (i: Imovel) => {
      const matchId = Boolean(targetId && i.corretorId && i.corretorId === targetId);
      const matchEmail = Boolean(targetEmail && i.corretorEmail && i.corretorEmail.toLowerCase().trim() === targetEmail);
      return matchId || matchEmail;
    };

    const myImoveis = imoveis.filter(isMine);
    const qtdVendas = myImoveis.filter(i => i.tipo === 'venda' || i.tipo === 'ambos').length;
    const qtdLocacoes = myImoveis.filter(i => i.tipo === 'locação' || i.tipo === 'ambos').length;

    const partnerImoveis = imoveis.filter(i => {
      const mine = isMine(i);
      const isShared = i.compartilhar !== false;
      return !mine && isShared;
    });
    const qtdParcerias = partnerImoveis.length;

    return { qtdVendas, qtdLocacoes, qtdParcerias };
  }

  static getImoveisSync(): Imovel[] {
    return cachedImoveis;
  }

  static getFavoritos(idOrEmail?: string): string[] {
    cachedImoveis.forEach(i => {
      if (i.favorito && !cachedFavorites.includes(i.id)) {
        cachedFavorites.push(i.id);
      }
    });
    return cachedFavorites;
  }

  static subscribe(listener: () => void): () => void {
    subscribers.push(listener);
    return () => {
      const idx = subscribers.indexOf(listener);
      if (idx >= 0) subscribers.splice(idx, 1);
    };
  }

  // --- Asynchronous Backend REST API Methods ---

  // Verify and fetch broker profile from backend
  static async verifyAndFetchProfile(): Promise<Corretor | null> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/auth/verify'), {
        method: 'POST',
        headers
      });
      if (res.ok) {
        const data = await res.json();
        if (data.corretor) {
          this.setActiveCorretor(data.corretor);
          return data.corretor;
        }
      }
      return this.getActiveCorretor();
    } catch (err) {
      console.error('Erro ao verificar perfil com backend:', err);
      return this.getActiveCorretor();
    }
  }

  // Save / Update broker profile
  static async updateProfile(profileData: Partial<Corretor>): Promise<Corretor | null> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.corretor) {
          this.setActiveCorretor(data.corretor);
          return data.corretor;
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
    }
    
    // Fallback local update
    const current = this.getActiveCorretor();
    const updated = { ...current, ...profileData } as Corretor;
    this.setActiveCorretor(updated);
    return updated;
  }

  static async saveCorretor(corretor: Partial<Corretor>): Promise<Corretor | null> {
    return this.updateProfile(corretor);
  }

  private static inflightGetImoveis: Promise<Imovel[]> | null = null;
  private static inflightGetMeusImoveis: Promise<Imovel[]> | null = null;
  private static paginationState = {
    total: 0,
    page: 1,
    limit: 24,
    totalPages: 1,
    hasMore: false,
    loadingMore: false
  };

  static getPaginationInfo() {
    return { ...this.paginationState };
  }

  // Fetch accessible properties (Supports pagination and inflight request deduplication)
  static async getImoveis(options?: { page?: number; limit?: number; append?: boolean }): Promise<Imovel[]> {
    const page = options?.page || 1;
    const limit = options?.limit || 24;
    const append = Boolean(options?.append);

    // Se for uma busca padrão da primeira página e já houver uma requisição em voo, reaproveitá-la para evitar requisições duplicadas
    if (page === 1 && !append && this.inflightGetImoveis) {
      return this.inflightGetImoveis;
    }

    const fetchPromise = (async () => {
      try {
        const headers = await this.getAuthHeader();
        const url = getApiUrl(`/api/properties?page=${page}&limit=${limit}`);
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = await res.json();
          let list: Imovel[] = [];
          if (Array.isArray(json)) {
            list = json;
            this.paginationState = {
              total: list.length,
              page,
              limit,
              totalPages: Math.ceil(list.length / limit) || 1,
              hasMore: page * limit < list.length,
              loadingMore: false
            };
          } else if (json && Array.isArray(json.data)) {
            list = json.data;
            this.paginationState = {
              total: json.total || list.length,
              page: json.page || page,
              limit: json.limit || limit,
              totalPages: json.totalPages || Math.ceil((json.total || list.length) / limit) || 1,
              hasMore: Boolean(json.hasMore),
              loadingMore: false
            };
          }

          if (append && page > 1) {
            // Anexar somente itens que ainda não estão presentes na memória
            const existingIds = new Set(cachedImoveis.map(i => i.id));
            const newItems = list.filter(item => !existingIds.has(item.id));
            cachedImoveis = [...cachedImoveis, ...newItems];
          } else {
            // Mesclar com imóveis do cache que já possuem fotos completas carregadas
            cachedImoveis = list.map(fresh => {
              const existing = cachedImoveis.find(e => e.id === fresh.id);
              if (existing && Array.isArray(existing.fotos) && existing.fotos.length > (fresh.fotos?.length || 0)) {
                return { ...fresh, fotos: existing.fotos, descricao: existing.descricao || fresh.descricao };
              }
              return fresh;
            });
          }

          notifySubscribers();
          return cachedImoveis;
        }
      } catch (err) {
        console.error('Erro ao buscar imóveis:', err);
      } finally {
        if (page === 1 && !append) {
          this.inflightGetImoveis = null;
        }
      }
      return cachedImoveis;
    })();

    if (page === 1 && !append) {
      this.inflightGetImoveis = fetchPromise;
    }

    return fetchPromise;
  }

  // Helper para carregar próxima página sob demanda
  static async loadMoreImoveis(): Promise<{ properties: Imovel[]; hasMore: boolean; page: number }> {
    if (this.paginationState.loadingMore || !this.paginationState.hasMore) {
      return { properties: cachedImoveis, hasMore: this.paginationState.hasMore, page: this.paginationState.page };
    }
    this.paginationState.loadingMore = true;
    const nextPage = this.paginationState.page + 1;
    await this.getImoveis({ page: nextPage, limit: this.paginationState.limit, append: true });
    this.paginationState.loadingMore = false;
    return { properties: cachedImoveis, hasMore: this.paginationState.hasMore, page: this.paginationState.page };
  }

  // Fetch single property with full photos and details
  static async getImovelById(id: string): Promise<Imovel | null> {
    const cleanId = (id || '').trim();
    if (!cleanId) return null;

    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl(`/api/properties/${encodeURIComponent(cleanId)}`), { headers });
      if (res.ok) {
        const full: Imovel = await res.json();
        if (full && full.id) {
          const idx = cachedImoveis.findIndex(p => p.id === full.id);
          if (idx >= 0) {
            cachedImoveis[idx] = { ...cachedImoveis[idx], ...full };
          } else {
            cachedImoveis.unshift(full);
          }
          notifySubscribers();
          return full;
        }
      }
    } catch (err) {
      console.error(`Erro ao buscar detalhes do imóvel ${id}:`, err);
    }
    return cachedImoveis.find(p => p.id === cleanId) || null;
  }

  // Fetch properties owned strictly by the logged-in user
  static async getMeusImoveis(): Promise<Imovel[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/properties/mine'), { headers });
      if (res.ok) {
        const list = await res.json();
        return Array.isArray(list) ? list : [];
      }
    } catch (err) {
      console.error('Erro ao buscar meus imóveis:', err);
    }
    return cachedImoveis.filter(i => isProfileComplete(this.getActiveCorretor()));
  }

  // Save or Edit property
  static async saveImovel(imovel: Partial<Imovel>): Promise<Imovel> {
    try {
      const headers = await this.getAuthHeader();
      const isEdit = Boolean(imovel.id);
      const url = isEdit ? getApiUrl(`/api/properties/${imovel.id}`) : getApiUrl('/api/properties');
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(imovel)
      });

      if (res.ok) {
        const saved: Imovel = await res.json();
        const idx = cachedImoveis.findIndex(p => p.id === saved.id);
        if (idx >= 0) {
          cachedImoveis[idx] = saved;
        } else {
          cachedImoveis.unshift(saved);
        }
        if (saved.id) {
          if (saved.favorito && !cachedFavorites.includes(saved.id)) {
            cachedFavorites.push(saved.id);
            safeSetLocalStorage('imobishare_favorites', JSON.stringify(cachedFavorites));
          } else if (saved.favorito === false) {
            const favIdx = cachedFavorites.indexOf(saved.id);
            if (favIdx >= 0) {
              cachedFavorites.splice(favIdx, 1);
              safeSetLocalStorage('imobishare_favorites', JSON.stringify(cachedFavorites));
            }
          }
        }
        notifySubscribers();
        return saved;
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao salvar imóvel.');
      }
    } catch (err) {
      console.error('Erro ao salvar imóvel:', err);
      // Fallback local update
      const active = this.getActiveCorretor();
      const fallbackImovel: Imovel = {
        id: imovel.id || `prop-${Date.now()}`,
        corretorEmail: imovel.corretorEmail || active?.email || auth.currentUser?.email || '',
        corretorNome: imovel.corretorNome || active?.nome || auth.currentUser?.displayName || 'Corretor',
        cidade: imovel.cidade || 'Balneário Camboriú',
        bairro: imovel.bairro || 'Centro',
        endereco: imovel.endereco || imovel.localizacao || '',
        localizacao: imovel.localizacao || imovel.endereco || '',
        cep: imovel.cep || '',
        nomeEdificio: imovel.nomeEdificio || '',
        palavraDestacada: imovel.palavraDestacada || '',
        informacoes: imovel.informacoes || '',
        tipoImovel: imovel.tipoImovel || 'Apartamento',
        statusImovel: imovel.statusImovel,
        tipo: imovel.tipo || 'venda',
        valor: imovel.valor || 0,
        valorVenda: imovel.valorVenda || imovel.valor || 0,
        valorLocacao: imovel.valorLocacao,
        dormitorios: imovel.dormitorios || 0,
        banheiros: imovel.banheiros || 0,
        vagas: imovel.vagas || 0,
        metragem: imovel.metragem || 0,
        titulo: imovel.titulo || 'Novo Imóvel',
        descricao: imovel.descricao || '',
        visibilidade: imovel.visibilidade || 'todos',
        origem: imovel.origem || 'Imobishare',
        integrado: imovel.integrado ?? (imovel.origem && imovel.origem.toLowerCase() !== 'imobishare' ? true : false),
        integracaoOrigem: imovel.integracaoOrigem || (imovel.origem && imovel.origem.toLowerCase() !== 'imobishare' ? imovel.origem : undefined),
        construtora: imovel.construtora || '',
        latitude: imovel.latitude,
        longitude: imovel.longitude,
        fotos: Array.isArray(imovel.fotos) ? imovel.fotos : [],
        dataCadastro: imovel.dataCadastro || new Date().toISOString()
      };

      const idx = cachedImoveis.findIndex(p => p.id === fallbackImovel.id);
      if (idx >= 0) {
        cachedImoveis[idx] = fallbackImovel;
      } else {
        cachedImoveis.unshift(fallbackImovel);
      }
      notifySubscribers();
      return fallbackImovel;
    }
  }

  // Delete property
  static async deleteImovel(id: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl(`/api/properties/${id}`), {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        cachedImoveis = cachedImoveis.filter(p => p.id !== id);
        notifySubscribers();
        return true;
      }
    } catch (err) {
      console.error('Erro ao excluir imóvel:', err);
    }
    // Fallback local deletion
    cachedImoveis = cachedImoveis.filter(p => p.id !== id);
    notifySubscribers();
    return true;
  }

  // Duplicate property
  static async duplicateImovel(id: string): Promise<Imovel | null> {
    const existing = cachedImoveis.find(p => p.id === id);
    if (!existing) return null;

    const cloneData: Partial<Imovel> = {
      ...existing,
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      titulo: `${existing.titulo} (Cópia)`,
      dataCadastro: new Date().toISOString()
    };

    return this.saveImovel(cloneData);
  }

  private static syncPromise: Promise<void> | null = null;

  // Sync background data concurrently without duplicate requests
  static async syncWithServer(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        const promises: Promise<any>[] = [
          this.fetchBrokers(),
          this.getImoveis()
        ];
        if (this.getActiveCorretor()) {
          promises.push(this.verifyAndFetchProfile());
        }
        await Promise.allSettled(promises);
      } catch (err) {
        console.warn('Erro na sincronização de dados:', err);
      } finally {
        this.syncPromise = null;
        notifySubscribers();
      }
    })();

    return this.syncPromise;
  }

  // Fetch confidential owner data for property
  static async getOwnerData(id: string): Promise<string | null> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl(`/api/properties/${id}/owner-data`), { headers });
      if (res.ok) {
        const data = await res.json();
        return data.dadosProprietario || null;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  // Partnerships API
  static async getPartners(): Promise<string[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/partners'), { headers });
      if (res.ok) {
        const list = await res.json();
        return Array.isArray(list) ? list : [];
      }
    } catch (err) {}
    return [];
  }

  static async addPartner(partnerEmail: string): Promise<string[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/partners'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ partnerEmail })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {}
    return [];
  }

  static async removePartner(partnerEmail: string): Promise<string[]> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl(`/api/partners/${encodeURIComponent(partnerEmail)}`), {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {}
    return [];
  }

  // Favorites API
  static async toggleFavorite(corretorIdOrEmail: string, imovelId: string): Promise<string[]> {
    // Local toggle
    const idx = cachedFavorites.indexOf(imovelId);
    let isNowFav = false;
    if (idx >= 0) {
      cachedFavorites.splice(idx, 1);
      isNowFav = false;
    } else {
      cachedFavorites.push(imovelId);
      isNowFav = true;
    }

    // Sync property object in cachedImoveis
    const found = cachedImoveis.find(i => i.id === imovelId);
    if (found) {
      found.favorito = isNowFav;
    }

    safeSetLocalStorage('imobishare_favorites', JSON.stringify(cachedFavorites));
    notifySubscribers();

    // Async REST toggle
    try {
      const headers = await this.getAuthHeader();
      await fetch(getApiUrl('/api/favorites/toggle'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ imovelId })
      });
    } catch (err) {}

    return cachedFavorites;
  }

  // Support Message API
  static async sendSupportMessage(data: { nome: string; email: string; telefone: string; descricao: string }): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl('/api/support'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  // AI Description Improvement API
  static async improveDescription(params: {
    text: string;
    tipoImovel?: string;
    titulo?: string;
    localizacao?: string;
    nomeEdificio?: string;
    dormitorios?: number;
    vagas?: number;
    banheiros?: number;
    metragem?: number;
    valor?: number;
    modalidade?: string;
  }): Promise<string> {
    try {
      const res = await fetch(getApiUrl('/api/properties/improve-description'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = await res.json();
        return (data.text || '').replace(/\*/g, '');
      }
      return params.text || '';
    } catch (err) {
      return params.text || '';
    }
  }

  // Admin Diagnostics API
  static async getAdminDiagnostics(): Promise<any> {
    try {
      const headers = await this.getAuthHeader();
      const res = await fetch(getApiUrl('/api/admin/diagnostics'), { headers });
      if (res.ok) {
        return await res.json();
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Acesso negado ou erro nos diagnósticos.');
    } catch (err: any) {
      throw err;
    }
  }
}
