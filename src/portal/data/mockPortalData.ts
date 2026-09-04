/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * DADOS MOCK DE DEMONSTRAÇÃO — PORTAL PÚBLICO IMOBISHARE (ETAPA 1)
 * ============================================================================
 * ATENÇÃO: Estes dados são exclusivamente para testes de layout, estrutura e
 * navegação do novo portal público. NÃO GRAVAR no banco de dados nem substituir
 * informações reais de corretores e imóveis cadastrados no sistema.
 */

import { PortalProperty } from '../types';

export const MOCK_PORTAL_PROPERTIES: PortalProperty[] = [
  {
    id: 'mock-sancho-01',
    codigo: 'IMB-001245',
    titulo: 'Apartamento de 3 quartos no Centro de Balneário Camboriú',
    nomeEdificio: 'Residencial Sancho',
    construtora: 'Baggio',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 1850000,
    metragem: 110,
    areaTotal: 168,
    dormitorios: 3,
    quartos: 3,
    banheiros: 3,
    vagas: 2,
    suites: 1,
    andar: 14,
    condominioFormatado: 'R$ 850 / mês',
    iptuFormatado: 'R$ 2.400 / ano',
    dataEntrega: 'Dezembro de 2026',
    dataPublicacao: '04 de setembro de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Centro',
    endereco: 'Av. Brasil, 1234',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-09-04T10:00:00.000Z',
    latitude: -26.9924,
    longitude: -48.6341,
    fotos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Apartamento amplo e muito bem localizado no coração de Balneário Camboriú, assinado pela renomada construtora Baggio. Projetado com linhas contemporâneas que valorizam a incidência de luz natural e a ventilação cruzada.

O living integrado proporciona um ambiente acolhedor para receber familiares e amigos, conectando-se perfeitamente à espaçosa varanda gourmet com churrasqueira a carvão e vista aberta para a dinâmica urbana da cidade.

A área íntima conta com 3 dormitórios, sendo 1 suíte master com closet planejado e acabamentos de altíssimo padrão com porcelanato de grandes formatos, rebaixo em gesso e infraestrutura completa para climatização split e automação residencial.

O empreendimento oferece lazer de resort: piscina com borda infinita aquecida, spa com sauna seca e úmida, academia de nível internacional, salão de festas decorado e brinquedoteca interativa. Duas vagas privativas de garagem e segurança 24h.`
  },
  {
    id: 'mock-magic-sun-02',
    codigo: 'IMB-001890',
    titulo: 'Apartamento de 4 quartos com vista mar na Barra Sul',
    nomeEdificio: 'Magic Sun Tower',
    construtora: 'Baggio',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 2490000,
    metragem: 145,
    areaTotal: 215,
    dormitorios: 4,
    quartos: 4,
    banheiros: 4,
    vagas: 3,
    suites: 2,
    andar: 22,
    condominioFormatado: 'R$ 1.150 / mês',
    iptuFormatado: 'R$ 3.200 / ano',
    dataEntrega: 'Março de 2027',
    dataPublicacao: '01 de setembro de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Barra Sul',
    endereco: 'Av. Atlântica, 2400',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-09-01T14:30:00.000Z',
    latitude: -27.0055,
    longitude: -48.6220,
    fotos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Experiência residencial inigualável no Magic Sun Tower, na privilegiada Barra Sul. Um projeto icônico da Baggio para quem busca sofisticação máxima, amplas áreas sociais e contemplação permanente da orla marítima.

Com 145 m² privativos, a planta inteligente separa perfeitamente a ala social da íntima. O living panorâmico tem pé-direito duplo e esquadrias termoacústicas do piso ao teto, criando uma transição fluida com o horizonte.

São 4 dormitórios distribuídos em 2 elegantes suítes e 2 demi-suítes, 4 banheiros e 3 vagas de garagem privativas com ponto para abastecimento de veículo elétrico. Área de lazer espetacular com rooftop lounge 360°, espaço gourmet assinado por chef e heliponto homologado nas proximidades.`
  },
  {
    id: 'mock-summer-sun-03',
    codigo: 'IMB-001102',
    titulo: 'Apartamento de 2 quartos próximo à praia no Centro',
    nomeEdificio: 'Summer Sun Residence',
    construtora: 'Baggio',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 1290000,
    metragem: 82,
    areaTotal: 125,
    dormitorios: 2,
    quartos: 2,
    banheiros: 2,
    vagas: 1,
    suites: 1,
    andar: 8,
    condominioFormatado: 'R$ 620 / mês',
    iptuFormatado: 'R$ 1.800 / ano',
    dataEntrega: 'Novembro de 2026',
    dataPublicacao: '28 de agosto de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Centro',
    endereco: 'Rua 1500, 350',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-08-28T09:15:00.000Z',
    latitude: -26.9890,
    longitude: -48.6380,
    fotos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Excelente oportunidade de investimento e moradia no Summer Sun Residence. Situado na Rua 1500, a poucos passos do mar, supermercados gourmet e melhores restaurantes de Balneário Camboriú.

Planta compacta de 82 m² privativos com aproveitamento milimétrico de cada espaço. Varanda gourmet com churrasqueira integrada ao living, cozinha estilo americana e lavanderia independente.

Conta com 2 quartos, sendo 1 suíte confortável, 2 banheiros e 1 vaga de garagem coberta. Baixo custo condominial com infraestrutura enxuta e moderna: piscina na cobertura, espaço fitness e salão gourmet equipado.`
  },
  {
    id: 'mock-grand-palais-04',
    codigo: 'IMB-002140',
    titulo: 'Residência suspensa de 4 suítes frente mar na Barra Sul',
    nomeEdificio: 'Grand Palais',
    construtora: 'Embraed',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 3890000,
    metragem: 185,
    areaTotal: 290,
    dormitorios: 4,
    quartos: 4,
    banheiros: 5,
    vagas: 3,
    suites: 4,
    andar: 31,
    condominioFormatado: 'R$ 1.650 / mês',
    iptuFormatado: 'R$ 4.500 / ano',
    dataEntrega: 'Junho de 2027',
    dataPublicacao: '20 de agosto de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Barra Sul',
    endereco: 'Av. Atlântica, 4100',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-08-20T11:00:00.000Z',
    latitude: -27.0120,
    longitude: -48.6180,
    fotos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Exclusividade inquestionável com o padrão clássico e refinado da Embraed. O Grand Palais une o artesanato nobre com a mais avançada engenharia contemporânea, posicionado de frente para o mar de Balneário Camboriú.

185 m² de pura imponência, com 4 amplas suítes (uma máster com hidromassagem e closet duplo), living para 3 ambientes climatizados e vista frontal indevassável da Baía Sul. 3 vagas de garagem e depósito privativo.`
  },
  {
    id: 'mock-villa-bella-05',
    codigo: 'IMB-001750',
    titulo: 'Apartamento de 3 suítes na região nobre dos Pioneiros',
    nomeEdificio: 'Villa Bella',
    construtora: 'FG Empreendimentos',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 2150000,
    metragem: 130,
    areaTotal: 195,
    dormitorios: 3,
    quartos: 3,
    banheiros: 4,
    vagas: 2,
    suites: 3,
    andar: 18,
    condominioFormatado: 'R$ 980 / mês',
    iptuFormatado: 'R$ 2.900 / ano',
    dataEntrega: 'Setembro de 2026',
    dataPublicacao: '15 de agosto de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Pioneiros',
    endereco: 'Av. Brasil, 450',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-08-15T08:45:00.000Z',
    latitude: -26.9745,
    longitude: -48.6325,
    fotos: [
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Localizado no tranquilo e valorizado bairro Pioneiros, próximo à Roda Gigante FG Big Wheel e ao deck do Pontal Norte. O Villa Bella é ideal para quem quer tranquilidade sem abrir mão de alta mobilidade.

Com 130 m² privativos, conta com 3 suítes independentes, living generoso, piso vinílico nos dormitórios e infraestrutura para aspiração central e churrasqueira a carvão.`
  },
  {
    id: 'mock-horizonte-azul-06',
    codigo: 'IMB-001330',
    titulo: 'Apartamento de 3 quartos com lazer completo no Nações',
    nomeEdificio: 'Horizonte Azul',
    construtora: 'Baggio',
    tipoImovel: 'Apartamento',
    statusImovel: 'Na planta',
    tipo: 'venda',
    valor: 1680000,
    metragem: 98,
    areaTotal: 152,
    dormitorios: 3,
    quartos: 3,
    banheiros: 3,
    vagas: 2,
    suites: 1,
    andar: 11,
    condominioFormatado: 'R$ 740 / mês',
    iptuFormatado: 'R$ 2.100 / ano',
    dataEntrega: 'Janeiro de 2027',
    dataPublicacao: '10 de agosto de 2026',
    isLancamento: true,
    cidade: 'Balneário Camboriú',
    bairro: 'Nações',
    endereco: 'Rua Israel, 820',
    corretorEmail: 'contato@imobishare.com.br',
    corretorNome: 'ImobiShare Lançamentos',
    dataCadastro: '2026-08-10T16:20:00.000Z',
    latitude: -26.9850,
    longitude: -48.6430,
    fotos: [
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1600&auto=format&fit=crop&q=85',
      'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=1600&auto=format&fit=crop&q=85'
    ],
    descricao: `Viva com praticidade em uma das áreas com maior expansão de serviços e comércios de Balneário Camboriú. O Horizonte Azul conta com arquitetura funcional, áreas sociais entregues mobiliadas e decoradas.

98 m² bem distribuídos, 3 quartos sendo 1 suíte, living integrado à sacada gourmet e 2 vagas de garagem demarcadas.`
  }
];

/**
 * Função utilitária para formatar preços em BRL
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Função utilitária para formato abreviado de preço nos marcadores do mapa (ex: "R$ 1,8 mi", "R$ 850 mil")
 */
export function formatCompactPriceBRL(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000;
    const formatted = millions.toFixed(1).replace('.', ',');
    return `R$ ${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted} mi`;
  }
  if (value >= 1000) {
    const thousands = Math.round(value / 1000);
    return `R$ ${thousands} mil`;
  }
  return formatCurrencyBRL(value);
}

/**
 * Calcula o valor por m²
 */
export function calculateValorM2(valor: number, metragem: number): number {
  if (!metragem || metragem <= 0) return 0;
  return Math.round(valor / metragem);
}

/**
 * Formata o valor por m² (ex: "R$ 16.818/m²")
 */
export function formatValorM2(valor: number, metragem: number): string {
  const m2 = calculateValorM2(valor, metragem);
  if (!m2) return '';
  return `R$ ${m2.toLocaleString('pt-BR')}/m²`;
}
