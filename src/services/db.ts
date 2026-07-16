/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel, Corretor, Favorito } from '../types';
import { INITIAL_IMOVEIS, MOCK_CORRETORES } from '../data';

const STORAGE_KEYS = {
  IMOVEIS: 'imobishare_imoveis',
  CORRETORES: 'imobishare_corretores',
  ACTIVE_CORRETOR: 'imobishare_active_corretor',
  FAVORITOS: 'imobishare_favoritos',
};

export class DbService {
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

  // Change logged-in broker (for simulation purposes!)
  static setActiveCorretor(corretor: Corretor): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CORRETOR, JSON.stringify(corretor));
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
  }

  // Get all properties
  static getImoveis(): Imovel[] {
    const data = localStorage.getItem(STORAGE_KEYS.IMOVEIS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(INITIAL_IMOVEIS));
      return INITIAL_IMOVEIS;
    }
    return JSON.parse(data);
  }

  // Get favorites for current broker
  static getFavoritos(corretorId: string): string[] {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
    if (!data) {
      // Default favorites based on initial properties marked 'favorito'
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

    return updated;
  }

  // Save / update a property
  static saveImovel(imovel: Omit<Imovel, 'id' | 'dataCadastro' | 'corretorId' | 'corretorNome'> & { id?: string }): Imovel {
    const imoveis = this.getImoveis();
    const activeCorretor = this.getActiveCorretor();
    
    if (imovel.id) {
      // Update existing
      const index = imoveis.findIndex(i => i.id === imovel.id);
      if (index !== -1) {
        const existing = imoveis[index];
        const updated: Imovel = {
          ...existing,
          ...imovel,
          id: imovel.id, // guarantee same id
        };
        imoveis[index] = updated;
        localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));
        return updated;
      }
    }
    
    // Create new
    const newImovel: Imovel = {
      ...imovel,
      id: `imovel-${Date.now()}`,
      dataCadastro: new Date().toISOString(),
      corretorId: activeCorretor.id,
      corretorNome: activeCorretor.nome,
    };
    
    imoveis.unshift(newImovel); // Add to beginning
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(imoveis));
    return newImovel;
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
    return duplicated;
  }

  // Delete property
  static deleteImovel(id: string): void {
    const imoveis = this.getImoveis();
    const updated = imoveis.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.IMOVEIS, JSON.stringify(updated));
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

  // Improve text using the API proxy
  static async improveDescription(text: string, type: 'venda' | 'locação', titulo: string, localizacao: string): Promise<string> {
    try {
      const response = await fetch('/api/ai/improve-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, type, titulo, localizacao }),
      });
      if (!response.ok) {
        throw new Error('Erro na resposta do servidor API');
      }
      const data = await response.json();
      return data.text || text;
    } catch (error) {
      console.error('Failed to improve description via backend:', error);
      // Heuristic fallback
      return `Maravilhosa oportunidade de ${type} no edifício ${titulo || 'selecionado'}, localizado em ${localizacao || 'ótimo bairro'}. ${text}`;
    }
  }
}
