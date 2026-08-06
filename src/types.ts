/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Corretor {
  id: string;
  nome: string;
  email: string; // Chave primária do corretor
  creci: string;
  telefone: string;
  whatsapp: string;
  cidade: string;
  estado?: string;
  imobiliaria?: string;
  tipoAtuacao?: 'autonomo' | 'imobiliaria'; // Autônomo ou Imobiliária
  foto?: string;
  slugSite?: string; // Slug único para site próprio do corretor
  isAdmin?: boolean; // Se é administrador com acesso à aba "Testes"
  password?: string;
  resetToken?: string;
  resetTokenExpires?: number;
  restringirParceiros?: boolean;
  parceirosEmails?: string[];
  
  // Contadores para o perfil
  qtdVenda?: number;
  qtdLocacao?: number;
  qtdParcerias?: number;
}

export interface Imovel {
  id: string;
  codigo?: string; // Código amigável (e.g. FRE01)
  corretorEmail: string; // E-mail do corretor proprietário (fonte da verdade)
  corretorId?: string;
  corretorNome?: string;
  
  // Localização
  cep?: string;
  endereco?: string; // ou localizacao
  localizacao?: string;
  cidade: string;
  bairro: string;
  
  // Tipo e Modalidade
  tipoImovel: 'Apartamento' | 'Casa' | 'Casa em condomínio' | 'Cobertura' | 'Terreno' | 'Comercial' | 'Outro';
  statusImovel?: 'Na planta' | 'Mobiliado' | 'Sem mobília';
  tipo: 'venda' | 'locação' | 'ambos'; // Modalidade
  
  // Valores
  valor: number; // Valor de Venda (principal)
  valorAnterior?: number; // Valor anterior caso o preço tenha sido reduzido
  valorVenda?: number;
  temDesconto?: boolean;
  valorDesconto?: number;
  valorLocacao?: number;
  valorLocacaoAnterior?: number; // Valor de locação anterior caso tenha reduzido
  
  // Especificações
  dormitorios: number; // quartos
  quartos?: number;
  banheiros: number; // bwc
  vagas: number;
  metragem: number; // area_privativa m²
  areaTotal?: number;
  
  // Informações do anúncio
  nomeEdificio?: string;
  titulo: string;
  palavraDestacada?: string; // Máximo 20 caracteres
  descricao: string;
  informacoes?: string; // Máximo 200 caracteres (chaves, horários, senha da porta - visível para corretores)
  
  // Visibilidade
  visibilidade: 'todos' | 'grupo_especifico'; // Compartilhar com todos ou com grupo específico
  compartilhar?: boolean;
  
  // Dados confidenciais do proprietário (Apenas retornado pelo backend se o token for do dono)
  dadosProprietario?: string;
  nomeProprietario?: string;
  telefoneProprietario?: string;
  
  // Mídia, metadados e Origem
  fotos: string[]; // Máximo 15 imagens
  dataCadastro: string; // ISO string
  favorito?: boolean;
  origem?: string; // e.g. 'Imobishare'
  construtora?: string; // Nome da construtora / incorporadora
  
  // Integração / Coordenadas
  integrado?: boolean;
  integracaoOrigem?: string;
  latitude?: number;
  longitude?: number;
}

export interface Parceria {
  corretorEmail: string;
  corretorParceiroEmail: string;
}

export interface Favorito {
  corretorEmail: string;
  imovelId: string;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  durationMs?: number;
  message?: string;
  details?: any;
}
