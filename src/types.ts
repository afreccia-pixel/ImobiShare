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
  isAdmin?: boolean;
  role?: 'admin' | 'corretor' | 'imobiliaria'; // Nível de acesso (afreccia@gmail.com = admin)
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
  codigo?: string; // Código amigável legado ou atual (e.g. FRE01 ou IM000001)
  codigoIm?: string; // Código central definitivo único: IM000001, IM000002...
  corretorEmail: string; // E-mail do corretor proprietário / captador principal (fonte da verdade)
  corretorId?: string;
  corretorNome?: string;
  corretorTelefone?: string;
  
  // Escopo de visualização e distribuição
  escopo?: 'CARTEIRA' | 'REDE'; // CARTEIRA: privado do corretor | REDE: compartilhado / DWV
  
  // Localização
  cep?: string;
  endereco?: string; // ou localizacao
  localizacao?: string;
  cidade: string;
  bairro: string;
  
  // Tipo e Modalidade
  tipoImovel: 'Apartamento' | 'Casa' | 'Casa em condomínio' | 'Cobertura' | 'Terreno' | 'Comercial' | 'Outro';
  // Condição do imóvel: Na Planta, Mobiliado e Sem Mobília
  condicaoImovel?: 'Na Planta' | 'Mobiliado' | 'Sem Mobília' | string;
  statusImovel?: 'Na Planta' | 'Mobiliado' | 'Sem Mobília' | string;
  // Status comercial do imóvel
  statusComercial?: 'Disponível' | 'Vendido' | 'Reservado';
  tipo: 'venda' | 'locação' | 'ambos'; // Modalidade
  
  // Dados de unidade / identificação física
  unidade?: string; // Ex: 1201, 1301, 1501
  bloco?: string; // Ex: Bloco A, Torre 1
  andar?: number | string;

  // Valores
  valor: number; // Valor de Venda (principal)
  valorAnterior?: number; // Valor anterior caso o preço tenha sido reduzido
  valorVenda?: number;
  temDesconto?: boolean;
  valorDesconto?: number;
  valorLocacao?: number;
  valorLocacaoAnterior?: number; // Valor de locação anterior caso tenha reduzido
  condominio?: number; // Valor do condomínio (R$)
  iptu?: number; // Valor do IPTU (R$)
  
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
  
  // Visibilidade e Compartilhamento
  website?: 'SIM' | 'NAO'; // Visível no website ('SIM' ou 'NAO')
  compartilhar?: 'SIM' | 'NAO' | boolean; // Compartilhar com rede de corretores ('SIM' ou 'NAO')
  visibilidade?: 'todos' | 'grupo_especifico'; // Mantido para compatibilidade
  
  // Dados confidenciais do proprietário (Apenas retornado pelo backend se o token for do dono)
  dadosProprietario?: string;
  nomeProprietario?: string;
  telefoneProprietario?: string;
  
  // Mídia, metadados e Origem
  fotos: string[]; // Máximo 20 imagens
  dataCadastro: string; // ISO string
  favorito?: boolean;
  origem?: string; // e.g. 'Imobishare'
  construtora?: string; // Nome da construtora / incorporadora
  telefoneConstrutora?: string; // Telefone de contato da construtora
  
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

// --- Nova Arquitetura de Gerenciamento de Imóveis (1 Imóvel Físico = 1 IM) ---

export interface CorretorImovel {
  id: string;
  corretorEmail: string;
  imovelId: string;
  statusCarteira: 'Disponível' | 'Vendido' | 'Reservado';
  dadosProprietario?: string;
  nomeProprietario?: string;
  telefoneProprietario?: string;
  comissao?: number;
  autorizacao?: string;
  observacoesInternas?: string;
  criadoEm?: string;
}

export interface ImovelOrigem {
  id: number;
  imovelId: string;
  origem: 'DWV' | 'MANUAL' | 'XML' | string;
  origemId?: string;
  ultimaSincronizacao?: string;
}

export type ImovelOrigemTipo = 'meus' | 'dwv' | 'parcerias';

export function isDwvOrConstrutora(imovel: Imovel): boolean {
  const orig = (imovel.origem || '').trim().toUpperCase();
  const integ = (imovel.integracaoOrigem || '').trim().toUpperCase();
  return (
    orig.includes('DWV') ||
    integ.includes('DWV') ||
    orig.includes('CONSTRUTORA') ||
    (Boolean(imovel.integrado) && !orig.includes('IMOBISHARE'))
  );
}

export function getImovelOrigem(imovel: Imovel, isMine: boolean): ImovelOrigemTipo {
  if (isDwvOrConstrutora(imovel)) return 'dwv';
  if (isMine) return 'meus';
  return 'parcerias';
}

export function getImovelOrigemLabel(origem: ImovelOrigemTipo): string {
  switch (origem) {
    case 'meus':
      return 'Meus imóveis';
    case 'dwv':
      return 'Construtoras';
    case 'parcerias':
      return 'Parcerias';
  }
}

export interface ImovelHistorico {
  id: number;
  imovelId: string;
  usuarioEmail: string;
  tipoUsuario: 'corretor' | 'admin' | 'dwv' | 'sistema';
  campoAlterado: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  dataHora: string;
}

export interface DuplicidadeSuspeita {
  imovelExistente: Imovel;
  grauConfianca: 'ALTO' | 'MEDIO' | 'BAIXO';
  motivo: string;
}

