/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel } from '../types';

export interface PortalFilterState {
  cidade: string;
  finalidade: 'Comprar' | 'Alugar' | 'Todos';
  categoria: 'Lançamentos' | 'Prontos' | 'Todos';
  tipoImovel?: string;
  statusImovel?: string;
  precoMin?: number;
  precoMax?: number;
  quartosMin?: number;
  banheirosMin?: number;
  vagasMin?: number;
  metragemMin?: number;
  metragemMax?: number;
  bairro?: string;
  construtora?: string;
  busca?: string;
}

export type PortalSortOption =
  | 'relevancia'
  | 'menor_preco'
  | 'maior_preco'
  | 'maior_area'
  | 'mais_recentes'
  | 'entrega_proxima';

export interface PortalProperty extends Imovel {
  // Atributos específicos e enriquecidos para o portal público
  precoFormatado?: string;
  valorM2?: number;
  valorM2Formatado?: string;
  suites?: number;
  andar?: number | string;
  condominioFormatado?: string;
  condominio?: number;
  iptuFormatado?: string;
  iptu?: number;
  dataEntrega?: string;
  dataPublicacao?: string;
  isLancamento?: boolean;
  corretorNome?: string;
  corretorTelefone?: string;
}

/**
 * Estrutura ultra-leve para os marcadores do mapa (retornada por /api/imoveis/mapa)
 * Não contém imagens, descrição, dados do proprietário, etc.
 */
export interface MapPropertyMarker {
  id: string;
  latitude: number;
  longitude: number;
  valor_venda?: number;
  valor_locacao?: number;
  tipo?: string;
  modalidade?: string;
  valor?: number;
  titulo?: string;
  cidade?: string;
  bairro?: string;
  statusImovel?: string;
  tipoImovel?: string;
  quartos?: number;
  dormitorios?: number;
  vagas?: number;
  metragem?: number;
  area_privativa?: number;
  nomeEdificio?: string;
}
