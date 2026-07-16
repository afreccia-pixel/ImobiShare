/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Corretor, Imovel } from './types';

export const MOCK_CORRETORES: Corretor[] = [
  {
    id: 'corretor-1',
    nome: 'Rodrigo Silva',
    creci: 'CRECI 12345-F',
    telefone: '(47) 99123-4567',
    whatsapp: '47991234567',
    email: 'rodrigo.silva@imobishare.com',
    foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    cidade: 'Balneário Camboriú',
    qtdImoveis: 8,
    qtdLocacoes: 3
  },
  {
    id: 'corretor-2',
    nome: 'Mariana Costa',
    creci: 'CRECI 23456-F',
    telefone: '(47) 99234-5678',
    whatsapp: '47992345678',
    email: 'mariana.costa@realtor.com',
    foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    cidade: 'Balneário Camboriú',
    qtdImoveis: 12,
    qtdLocacoes: 5
  },
  {
    id: 'corretor-3',
    nome: 'Carlos Eduardo',
    creci: 'CRECI 34567-F',
    telefone: '(47) 99345-6789',
    whatsapp: '47993456789',
    email: 'carlos.duarte@primeimoveis.com',
    foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    cidade: 'Itapema',
    qtdImoveis: 5,
    qtdLocacoes: 2
  }
];

export const INITIAL_IMOVEIS: Imovel[] = [
  {
    id: 'imovel-1',
    titulo: 'Cobertura Duplex Frente Mar Barra Sul',
    descricao: 'Maravilhosa cobertura duplex mobiliada e decorada na Barra Sul. São 4 suítes, piscina privativa, churrasqueira a carvão e 4 vagas de garagem. Vista panorâmica espetacular de toda a orla de Balneário Camboriú.',
    valor: 12500000,
    tipo: 'venda',
    cidade: 'Balneário Camboriú',
    bairro: 'Centro - Barra Sul',
    localizacao: 'Avenida Atlântica, 4500, Barra Sul - Balneário Camboriú - SC',
    nomeEdificio: 'Yachthouse Residence Club',
    nomeProprietario: 'Antônio de Souza',
    telefoneProprietario: '(47) 98877-6655',
    favorito: true,
    compartilhar: true,
    fotos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 horas atrás (Story do dia)
    corretorId: 'corretor-2', // Mariana
    corretorNome: 'Mariana Costa',
    dormitorios: 4,
    vagas: 4,
    metragem: 380
  },
  {
    id: 'imovel-2',
    titulo: 'Apartamento Alto Padrão Decorado Centro',
    descricao: 'Apartamento totalmente decorado por arquiteto renomado, com 3 suítes, living integrado, sacada gourmet integrada e automação completa. Prédio com área de lazer estilo resort de frente para avenida principal.',
    valor: 3800000,
    tipo: 'venda',
    cidade: 'Balneário Camboriú',
    bairro: 'Centro',
    localizacao: 'Rua 1500, nº 120, Centro - Balneário Camboriú - SC',
    nomeEdificio: 'Ibiza Towers',
    nomeProprietario: 'Cláudia Regina',
    telefoneProprietario: '(47) 99988-1122',
    favorito: false,
    compartilhar: true,
    fotos: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date().toISOString(), // Agora mesmo (Story)
    corretorId: 'corretor-3', // Carlos
    corretorNome: 'Carlos Eduardo',
    dormitorios: 3,
    vagas: 3,
    metragem: 180
  },
  {
    id: 'imovel-3',
    titulo: 'Casa Contemporânea em Condomínio Fechado',
    descricao: 'Projeto arquitetônico moderno e minimalista em condomínio horizontal de luxo. Amplo espaço de lazer integrado com piscina aquecida e borda infinita, lareira a gás, pé-direito duplo de 6m e automação.',
    valor: 6900000,
    tipo: 'venda',
    cidade: 'Balneário Camboriú',
    bairro: 'Bandeirantes',
    localizacao: 'Condomínio Haras Rio do Ouro, Balneário Camboriú - SC',
    nomeEdificio: 'Condomínio Rio do Ouro',
    nomeProprietario: 'Fernando Henrique',
    telefoneProprietario: '(47) 99111-2233',
    favorito: false,
    compartilhar: true,
    fotos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 horas atrás (Story)
    corretorId: 'corretor-2', // Mariana
    corretorNome: 'Mariana Costa',
    dormitorios: 4,
    vagas: 3,
    metragem: 450
  },
  {
    id: 'imovel-4',
    titulo: 'Aluguel Anual - Loft Decorado Quadra Mar',
    descricao: 'Excelente Loft totalmente mobiliado, equipado e decorado na quadra do mar de Balneário Camboriú. Ar condicionado split inverter, internet de alta velocidade inclusa, vaga privativa.',
    valor: 4500,
    tipo: 'locação',
    cidade: 'Balneário Camboriú',
    bairro: 'Centro',
    localizacao: 'Rua 2300, Quadra Mar - Balneário Camboriú - SC',
    nomeEdificio: 'Ocean Breeze Loft',
    nomeProprietario: 'Juliana Paes',
    telefoneProprietario: '(47) 99222-3344',
    favorito: true,
    compartilhar: true,
    fotos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // 12 horas atrás
    corretorId: 'corretor-1', // Rodrigo (My property)
    corretorNome: 'Rodrigo Silva',
    dormitorios: 1,
    vagas: 1,
    metragem: 55
  },
  {
    id: 'imovel-5',
    titulo: 'Apartamento de 2 Quartos para Locação Quadra Mar',
    descricao: 'Locação anual. Apartamento aconchegante com sacada integrada com churrasqueira, bem arejado, 2 quartos (1 suíte) e 1 vaga de garagem privativa. Excelente localização, próximo a mercados e comércio em geral.',
    valor: 3500,
    tipo: 'locação',
    cidade: 'Balneário Camboriú',
    bairro: 'Centro',
    localizacao: 'Avenida Brasil, Quadra Mar - Balneário Camboriú - SC',
    nomeEdificio: 'Edifício San Diego',
    nomeProprietario: 'Marcos Roberto',
    telefoneProprietario: '(47) 98833-4455',
    favorito: false,
    compartilhar: false, // EXCLUSIVE PROPERTY - only visible to creator (corretor-1)
    fotos: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 dias atrás (Not story anymore)
    corretorId: 'corretor-1', // Rodrigo (My property)
    corretorNome: 'Rodrigo Silva',
    dormitorios: 2,
    vagas: 1,
    metragem: 75
  },
  {
    id: 'imovel-6',
    titulo: 'Casa Geminada Moderna Itapema Meia Praia',
    descricao: 'Linda casa geminada com acabamento em gesso, piso porcelanato de alta qualidade, 3 quartos sendo 1 suíte master, área gourmet nos fundos com churrasqueira. Pronta para morar em região de grande valorização.',
    valor: 850000,
    tipo: 'venda',
    cidade: 'Itapema',
    bairro: 'Meia Praia',
    localizacao: 'Rua 248, nº 850, Meia Praia - Itapema - SC',
    nomeEdificio: 'Residencial Meia Praia',
    nomeProprietario: 'Patricia Ramos',
    telefoneProprietario: '(47) 99777-6622',
    favorito: false,
    compartilhar: true,
    fotos: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80'
    ],
    dataCadastro: new Date(Date.now() - 8 * 3600 * 1000).toISOString(), // 8 horas atrás (Story)
    corretorId: 'corretor-3', // Carlos
    corretorNome: 'Carlos Eduardo',
    dormitorios: 3,
    vagas: 2,
    metragem: 135
  }
];

export const MOCK_TEXTS_EXAMPLES = [
  "Lindo apartamento de 3 suítes finamente mobiliado, localizado na Barra Sul de Balneário Camboriú. Possui 3 vagas de garagem e área de lazer completa. Vista magnífica do mar.",
  "Casa contemporânea de 4 quartos em condomínio fechado de alto luxo. Piscina aquecida, churrasqueira gourmet, acabamento classe A e segurança 24 horas para sua família.",
  "Estúdio moderno ideal para locação anual ou Airbnb na quadra do mar. Mobília planejada inteligente, ar split, vaga rotativa e baixo condomínio. Retorno garantido de investimento."
];
