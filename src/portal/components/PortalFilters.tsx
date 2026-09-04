/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, SlidersHorizontal, Bell, X, Check } from 'lucide-react';
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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: 'cidade' | 'finalidade' | 'categoria' | 'valor' | 'quartos') => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  return (
    <nav
      id="portal-filters-bar"
      ref={containerRef}
      aria-label="Filtros de pesquisa"
      className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs"
    >
      <div className="max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Main filter pills */}
          <div className="flex items-center gap-2 flex-nowrap">
            {/* 📍 Balneário Camboriú ▼ */}
            <div className="relative">
              <button
                type="button"
                id="filter-btn-cidade"
                onClick={() => toggleDropdown('cidade')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border cursor-pointer whitespace-nowrap ${
                  filters.cidade !== 'Balneário Camboriú'
                    ? 'bg-blue-50 text-[#003366] border-[#003366]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <MapPin size={13} className="text-[#003366] shrink-0" />
                <span>{filters.cidade || 'Balneário Camboriú'}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === 'cidade' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'cidade' && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Cidades em Destaque
                  </div>
                  {['Balneário Camboriú', 'Itapema', 'Itajaí', 'Praia Brava', 'Porto Belo'].map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        onChangeFilters({ cidade: city });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                        filters.cidade === city ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{city}</span>
                      {filters.cidade === city && <Check size={14} className="text-[#003366]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comprar ▼ */}
            <div className="relative">
              <button
                type="button"
                id="filter-btn-finalidade"
                onClick={() => toggleDropdown('finalidade')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border cursor-pointer whitespace-nowrap ${
                  filters.finalidade !== 'Comprar'
                    ? 'bg-blue-50 text-[#003366] border-[#003366]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{filters.finalidade}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === 'finalidade' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'finalidade' && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                  {(['Comprar', 'Alugar'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onChangeFilters({ finalidade: opt });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                        filters.finalidade === opt ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{opt}</span>
                      {filters.finalidade === opt && <Check size={14} className="text-[#003366]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lançamentos ▼ */}
            <div className="relative">
              <button
                type="button"
                id="filter-btn-categoria"
                onClick={() => toggleDropdown('categoria')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border cursor-pointer whitespace-nowrap ${
                  filters.categoria !== 'Lançamentos'
                    ? 'bg-blue-50 text-[#003366] border-[#003366]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{filters.categoria}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === 'categoria' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'categoria' && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                  {(['Lançamentos', 'Prontos', 'Todos'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onChangeFilters({ categoria: cat });
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                        filters.categoria === cat ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{cat}</span>
                      {filters.categoria === cat && <Check size={14} className="text-[#003366]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Valor ▼ */}
            <div className="relative">
              <button
                type="button"
                id="filter-btn-valor"
                onClick={() => toggleDropdown('valor')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border cursor-pointer whitespace-nowrap ${
                  filters.precoMin || filters.precoMax
                    ? 'bg-blue-50 text-[#003366] border-[#003366]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>
                  {filters.precoMax
                    ? `Até R$ ${(filters.precoMax / 1000000).toFixed(1).replace('.', ',')} mi`
                    : filters.precoMin
                    ? `A partir de R$ ${(filters.precoMin / 1000000).toFixed(1).replace('.', ',')} mi`
                    : 'Valor'}
                </span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === 'valor' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'valor' && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Faixas de Valor
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
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                          isSelected ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                        }`}
                      >
                        <span>{range.label}</span>
                        {isSelected && <Check size={14} className="text-[#003366]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quartos ▼ */}
            <div className="relative">
              <button
                type="button"
                id="filter-btn-quartos"
                onClick={() => toggleDropdown('quartos')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all border cursor-pointer whitespace-nowrap ${
                  filters.quartosMin
                    ? 'bg-blue-50 text-[#003366] border-[#003366]'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{filters.quartosMin ? `${filters.quartosMin}+ quartos` : 'Quartos'}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${openDropdown === 'quartos' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'quartos' && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                  {[
                    { label: 'Todos os quartos', val: undefined },
                    { label: '1+ quartos', val: 1 },
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
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                          isSelected ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                        }`}
                      >
                        <span>{q.label}</span>
                        {isSelected && <Check size={14} className="text-[#003366]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mais filtros */}
            <button
              type="button"
              id="filter-btn-mais-filtros"
              onClick={onOpenMoreFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal size={12} className="text-slate-500 shrink-0" />
              <span>Mais filtros</span>
            </button>
          </div>

          {/* 🔔 Criar alerta de imóvel */}
          <div className="shrink-0 ml-auto">
            <button
              type="button"
              id="filter-btn-criar-alerta"
              onClick={onOpenAlertModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight text-[#003366] bg-[#003366]/5 hover:bg-[#003366]/10 border border-[#003366]/15 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              <Bell size={13} className="text-[#003366] shrink-0" />
              <span>Criar alerta de imóvel</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
