/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Corretor {
  id: string;
  nome: string;
  creci: string;
  telefone: string;
  whatsapp: string;
  email: string;
  foto: string;
  cidade: string;
  qtdImoveis?: number;
  qtdLocacoes?: number;
  restringirParceiros?: boolean;
  parceirosEmails?: string[];
}

export interface Imovel {
  id: string;
  titulo: string;
  descricao: string;
  valor: number;
  tipo: 'venda' | 'locação';
  cidade: string;
  bairro: string;
  localizacao: string; // endereço completo
  nomeEdificio?: string;
  nomeProprietario: string; // só visível para o corretor proprietário
  telefoneProprietario: string; // só visível para o corretor proprietário
  favorito: boolean; // se é favorito de forma geral ou usuário específico
  compartilhar: boolean; // se está compartilhado com outros corretores (padrão true)
  fotos: string[];
  dataCadastro: string; // ISO String
  corretorId: string; // ID do corretor proprietário do cadastro
  corretorNome: string; // Nome cacheado para facilidade de exibição
  dormitorios?: number;
  vagas?: number;
  metragem?: number;
  integrado?: boolean;
  integracaoOrigem?: string;
  latitude?: number;
  longitude?: number;
}

export interface Favorito {
  id: string;
  corretorId: string;
  imovelId: string;
}
