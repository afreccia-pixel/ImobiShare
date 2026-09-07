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
}
