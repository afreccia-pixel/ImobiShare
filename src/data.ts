/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Corretor, Imovel } from './types';

export const MOCK_CORRETORES: Corretor[] = [
  {
    id: 'corretor-alexandre',
    nome: 'Alexandre Freccia',
    creci: 'CRECI 28901-F',
    telefone: '(47) 99888-7766',
    whatsapp: '47998887766',
    email: 'afreccia@gmail.com',
    foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    cidade: 'Balneário Camboriú',
    qtdImoveis: 0,
    qtdLocacoes: 0
  }
];

export const INITIAL_IMOVEIS: Imovel[] = [];

export const INTEGRATED_IMOVEIS: Imovel[] = [];

export const MOCK_TEXTS_EXAMPLES = [
  "Lindo apartamento de 3 suítes finamente mobiliado, localizado na Barra Sul de Balneário Camboriú. Possui 3 vagas de garagem e área de lazer completa. Vista magnífica do mar.",
  "Casa contemporânea de 4 quartos em condomínio fechado de alto luxo. Piscina aquecida, churrasqueira gourmet, acabamento classe A e segurança 24 horas para sua família.",
  "Estúdio moderno ideal para locação anual ou Airbnb na quadra do mar. Mobília planejada inteligente, ar split, vaga rotativa e baixo condomínio. Retorno garantido de investimento."
];
