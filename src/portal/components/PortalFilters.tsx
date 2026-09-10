/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, SlidersHorizontal, Bell, X, Check, Search } from 'lucide-react';
import { PortalFilterState } from '../types';

interface PortalFiltersProps {
  filters: PortalFilterState;
  onChangeFilters: (newFilters: Partial<PortalFilterState>) => void;
  onOpenAlertModal: () => void;
  onOpenMoreFilters: () => void;
}

export function PortalFilters({
  filters,
  onChangeFilters,
  onOpenAlertModal,
  onOpenMoreFilters,
}: PortalFiltersProps) {
  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<
    'cidade' | 'finalidade' | 'categoria' | 'valor' | 'quartos' | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const toggleDropdown = (name: 'cidade' | 'finalidade' | 'categoria' | 'valor' | 'quartos') => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const hasActiveCustomFilters =
    Boolean(filters.precoMin) ||
    Boolean(filters.precoMax) ||
    Boolean(filters.quartosMin) ||
    Boolean(filters.banheirosMin) ||
    Boolean(filters.vagasMin) ||
    Boolean(filters.metragemMin) ||
    Boolean(filters.metragemMax) ||
    Boolean(filters.tipoImovel && filters.tipoImovel !== 'todos') ||
    Boolean(filters.statusImovel && filters.statusImovel !== 'todos') ||
    Boolean(filters.bairro) ||
    Boolean(filters.construtora);

  return (
    <nav
      id="portal-filters-bar"
      ref={containerRef}
      aria-label="Filtros de pesquisa pública de imóveis"
      className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs"
    >
      {/* Fechar dropdown ao clicar fora */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setOpenDropdown(null)}
          aria-hidden="true"
        />
      )}

      <div className="max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3 relative z-30">
        {/* LINHA 1: BARRA DE BUSCA PRINCIPAL AMPLIADA 3X + BOTÃO ALERTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Campo de Busca Livre em Destaque 3x */}
          <div className="relative flex-1 group">
            <Search
              size={22}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#003366] transition-colors pointer-events-none"
            />
            <input
              type="text"
              id="portal-input-busca-livre"
              value={filters.busca || ''}
              onChange={(e) => onChangeFilters({ busca: e.target.value })}
              placeholder="Buscar por condomínio, empreendimento, bairro, código ou rua..."
              className="w-full h-13 pl-12 pr-10 text-base font-medium rounded-2xl bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-[#003366] focus:ring-3 focus:ring-[#003366]/15 outline-hidden transition-all text-slate-800 placeholder:text-slate-400"
            />
            {filters.busca && (
              <button
                type="button"
                id="portal-btn-limpar-busca"
                onClick={() => onChangeFilters({ busca: '' })}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* 🔔 Criar Alerta de Imóvel Ampliado */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              id="filter-btn-criar-alerta"
              onClick={onOpenAlertModal}
              className="w-full sm:w-auto h-13 px-5 sm:px-6 inline-flex items-center justify-center gap-2.5 rounded-2xl text-sm sm:text-base font-bold tracking-tight text-[#003366] bg-blue-50/80 hover:bg-blue-100 border border-blue-200/90 shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-[0.99]"
            >
              <Bell size={19} className="text-[#003366] shrink-0" />
              <span>Criar alerta de imóvel</span>
            </button>
          </div>
        </div>

        {/* LINHA 2: BOTÕES E FILTROS AUMENTADOS 3X */}
        <div className="flex items-center justify-between gap-3 overflow-visible pb-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 📍 Cidade ▼ */}
            <div className={`relative ${openDropdown === 'cidade' ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                id="filter-btn-cidade"
                onClick={() => toggleDropdown('cidade')}
                className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                  filters.cidade && filters.cidade !== 'Todas'
                    ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                    : 'font-normal bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <MapPin size={18} className="text-[#003366] shrink-0" />
                <span>{filters.cidade || 'Balneário Camboriú'}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${
                    openDropdown === 'cidade' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'cidade' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Cidades em Destaque
                  </div>
                  {['Balneário Camboriú', 'Itapema', 'Itajaí', 'Praia Brava', 'Porto Belo', 'Navegantes'].map(
                    (city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          onChangeFilters({ cidade: city });
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                          filters.cidade === city ? 'font-bold text-[#003366] bg-blue-50' : 'text-slate-700 font-normal'
                        }`}
                      >
                        <span>{city}</span>
                        {filters.cidade === city && <Check size={18} className="text-[#003366]" />}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Comprar / Alugar ▼ */}
            <div className={`relative ${openDropdown === 'finalidade' ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                id="filter-btn-finalidade"
                onClick={() => toggleDropdown('finalidade')}
                className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                  filters.finalidade && filters.finalidade !== 'Todos'
                    ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                    : 'font-normal bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{filters.finalidade || 'Comprar'}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${
                    openDropdown === 'finalidade' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'finalidade' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50">
                  {(['Comprar', 'Alugar', 'Todos'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onChangeFilters({ finalidade: opt });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                        filters.finalidade === opt ? 'font-bold text-[#003366] bg-blue-50' : 'text-slate-700 font-normal'
                      }`}
                    >
                      <span>{opt}</span>
                      {filters.finalidade === opt && <Check size={18} className="text-[#003366]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Categoria: Lançamentos / Prontos / Todos ▼ */}
            <div className={`relative ${openDropdown === 'categoria' ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                id="filter-btn-categoria"
                onClick={() => toggleDropdown('categoria')}
                className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                  filters.categoria && filters.categoria !== 'Todos'
                    ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                    : 'font-normal bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{filters.categoria || 'Todos'}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${
                    openDropdown === 'categoria' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'categoria' && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50">
                  {(['Lançamentos', 'Prontos', 'Todos'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onChangeFilters({ categoria: cat });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                        filters.categoria === cat ? 'font-bold text-[#003366] bg-blue-50' : 'text-slate-700 font-normal'
                      }`}
                    >
                      <span>{cat}</span>
                      {filters.categoria === cat && <Check size={18} className="text-[#003366]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Faixa de Valor ▼ */}
            <div className={`relative ${openDropdown === 'valor' ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                id="filter-btn-valor"
                onClick={() => toggleDropdown('valor')}
                className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                  filters.precoMin || filters.precoMax
                    ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                    : 'font-normal bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>
                  {filters.precoMax
                    ? `Até R$ ${(filters.precoMax / 1000000).toFixed(1).replace('.', ',')} mi`
                    : filters.precoMin
                    ? `A partir de R$ ${(filters.precoMin / 1000000).toFixed(1).replace('.', ',')} mi`
                    : 'Valor'}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${
                    openDropdown === 'valor' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'valor' && (
                <div className="absolute top-full left-0 mt-2 w-76 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50">
                  <div className="px-4 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Faixas de Preço
                  </div>
                  {[
                    { label: 'Qualquer valor', min: undefined, max: undefined },
                    { label: 'Até R$ 1.500.000', min: undefined, max: 1500000 },
                    { label: 'R$ 1.500.000 a R$ 2.500.000', min: 1500000, max: 2500000 },
                    { label: 'R$ 2.500.000 a R$ 4.000.000', min: 2500000, max: 4000000 },
                    { label: 'Acima de R$ 4.000.000', min: 4000000, max: undefined },
                  ].map((range, idx) => {
                    const isSelected =
                      filters.precoMin === range.min && filters.precoMax === range.max;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onChangeFilters({ precoMin: range.min, precoMax: range.max });
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                          isSelected ? 'font-bold text-[#003366] bg-blue-50' : 'text-slate-700 font-normal'
                        }`}
                      >
                        <span>{range.label}</span>
                        {isSelected && <Check size={18} className="text-[#003366]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quartos ▼ */}
            <div className={`relative ${openDropdown === 'quartos' ? 'z-50' : 'z-10'}`}>
              <button
                type="button"
                id="filter-btn-quartos"
                onClick={() => toggleDropdown('quartos')}
                className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                  filters.quartosMin
                    ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                    : 'font-normal bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{filters.quartosMin ? `${filters.quartosMin}+ quartos` : 'Quartos'}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 ${
                    openDropdown === 'quartos' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'quartos' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50">
                  {[
                    { label: 'Todos os quartos', val: undefined },
                    { label: '1+ quarto', val: 1 },
                    { label: '2+ quartos', val: 2 },
                    { label: '3+ quartos', val: 3 },
                    { label: '4+ quartos', val: 4 },
                  ].map((q) => {
                    const isSelected = filters.quartosMin === q.val;
                    return (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          onChangeFilters({ quartosMin: q.val });
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                          isSelected ? 'font-bold text-[#003366] bg-blue-50' : 'text-slate-700 font-normal'
                        }`}
                      >
                        <span>{q.label}</span>
                        {isSelected && <Check size={18} className="text-[#003366]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mais Filtros */}
            <button
              type="button"
              id="filter-btn-mais-filtros"
              onClick={onOpenMoreFilters}
              className={`h-12 px-4.5 sm:px-5 inline-flex items-center gap-2 rounded-xl text-sm sm:text-base tracking-tight transition-all border cursor-pointer whitespace-nowrap shadow-2xs ${
                hasActiveCustomFilters
                  ? 'font-bold bg-blue-50 text-[#003366] border-[#003366]'
                  : 'font-normal bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={17} className="text-slate-500 shrink-0" />
              <span>Mais filtros</span>
              {hasActiveCustomFilters && (
                <span className="w-2 h-2 rounded-full bg-[#003366]" />
              )}
            </button>

            {/* Redefinir filtros caso algum filtro esteja ativo */}
            {hasActiveCustomFilters && (
              <button
                type="button"
                id="filter-btn-limpar-tudo"
                onClick={() =>
                  onChangeFilters({
                    tipoImovel: 'todos',
                    statusImovel: 'todos',
                    precoMin: undefined,
                    precoMax: undefined,
                    quartosMin: undefined,
                    banheirosMin: undefined,
                    vagasMin: undefined,
                    metragemMin: undefined,
                    metragemMax: undefined,
                    bairro: undefined,
                    construtora: undefined,
                    busca: '',
                  })
                }
                className="h-12 px-3 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer whitespace-nowrap"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
