/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Tokens e Padrões de Design do ImobiShare (Desktop / Screen Size)
 * Baseados na escala Plus Jakarta Sans, com suporte a responsividade (preservando Mobile/Tablet)
 */

export const desktopTokens = {
  // Tipografia Desktop
  typography: {
    badge: 'text-xs font-semibold', // 12px / 600
    caption: 'text-xs font-medium', // 12px / 500
    secondary: 'text-xs lg:text-[13px] font-normal lg:font-medium', // 13px / 400-500
    body: 'text-sm font-normal leading-relaxed', // 14px / 400
    bodyMedium: 'text-sm font-medium', // 14px / 500
    button: 'text-sm font-semibold', // 14px / 600
    filterLabel: 'text-xs lg:text-[14px] font-medium', // 14px / 500
    cardTitle: 'text-sm lg:text-base font-semibold leading-snug', // 16px / 600
    sectionTitle: 'text-base lg:text-lg font-semibold', // 18px / 600
    price: 'text-base lg:text-lg font-bold tracking-tight', // 18px / 700
    h3: 'text-lg lg:text-xl font-bold', // 20px / 700
    h2: 'text-xl lg:text-2xl font-bold tracking-tight', // 24px / 700
    h1: 'text-2xl lg:text-3xl font-bold lg:font-extrabold tracking-tight', // 28-30px / 700-800
    label: 'text-xs font-semibold text-slate-600 block mb-1', // 12px / 600
  },

  // Botões
  buttons: {
    // Principal: 46-48px altura, 14px / 600, border radius 12px
    primary: 'h-11 lg:h-12 px-5 lg:px-6 rounded-xl text-sm font-semibold bg-[#003366] hover:bg-[#002244] text-white shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-[0.99]',
    // Secundário: 40px altura, 14px / 500-600, border radius 12px
    secondary: 'h-10 px-4 rounded-xl text-sm font-medium lg:font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-[0.99]',
    // Filtros: 44px altura no desktop, 14px / 500-600, border radius 12px, padding 16px
    filter: 'h-10 lg:h-[44px] px-3.5 lg:px-4 rounded-xl text-xs lg:text-[14px] font-medium border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shadow-2xs',
    // Compacto: 36px altura mínima, 13px, border radius 12px
    compact: 'h-9 px-3 rounded-xl text-xs lg:text-[13px] font-semibold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5',
    // Ícone flutuante nos cards: 36x36px, ícone 18px
    iconCard: 'w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer',
  },

  // Inputs e Campos: Altura 44px no desktop, Fonte 14px, Border radius 12px, Padding horizontal 16px
  inputs: {
    field: 'h-10 lg:h-[44px] px-3.5 lg:px-4 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15 rounded-xl text-sm lg:text-[14px] font-medium text-slate-800 placeholder:text-slate-400 outline-hidden transition-all',
    search: 'h-10 lg:h-[44px] pl-10 pr-9 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15 rounded-xl text-sm lg:text-[14px] font-medium text-slate-800 placeholder:text-slate-400 outline-hidden transition-all',
    select: 'h-10 lg:h-[44px] px-3.5 lg:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm lg:text-[14px] font-medium text-slate-800 focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15 outline-hidden cursor-pointer transition-all',
    label: 'text-xs font-semibold text-slate-600 block mb-1',
  },

  // Border Radius Padronizados
  radius: {
    control: 'rounded-xl', // 12px
    badge: 'rounded-lg',   // 8px
    card: 'rounded-2xl',   // 16px
    modal: 'rounded-2xl lg:rounded-3xl', // 16-24px
    full: 'rounded-full',
  },
};
