/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, SlidersHorizontal, X, ArrowLeft } from 'lucide-react';
import { PortalFilterState } from '../types';

interface PortalMobileSearchBarProps {
  filters: PortalFilterState;
  onChangeFilters: (newFilters: Partial<PortalFilterState>) => void;
  onOpenMoreFilters: () => void;
  onBackToInitial?: () => void;
  isMapOverlay?: boolean;
}

export function PortalMobileSearchBar({
  filters,
  onChangeFilters,
  onOpenMoreFilters,
  onBackToInitial,
  isMapOverlay = false,
}: PortalMobileSearchBarProps) {
  // Contagem de filtros ativos para exibir no badge
  const activeFiltersCount = [
    Boolean(filters.cidade && filters.cidade !== 'Todas'),
    Boolean(filters.bairro),
    Boolean(filters.precoMin || filters.precoMax),
    Boolean(filters.quartosMin),
    Boolean(filters.banheirosMin),
    Boolean(filters.vagasMin),
    Boolean(filters.metragemMin || filters.metragemMax),
    Boolean(filters.tipoImovel && filters.tipoImovel !== 'todos'),
    Boolean(filters.statusImovel && filters.statusImovel !== 'todos'),
    Boolean(filters.construtora),
  ].filter(Boolean).length;

  return (
    <div
      className={`w-full px-4 py-2.5 transition-all ${
        isMapOverlay
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-slate-200'
          : 'bg-white border-b border-slate-200 shadow-2xs'
      }`}
      id="portal-mobile-search-bar"
    >
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        {onBackToInitial && (
          <button
            type="button"
            id="mobile-btn-back-to-initial"
            onClick={onBackToInitial}
            className="w-11 h-13 shrink-0 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
            title="Voltar para busca inicial"
            aria-label="Voltar para busca inicial"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {/* BOTÃO GRANDE DE BUSCA POR CONDOMÍNIO COM ÍCONE DE MAIS FILTROS NO CANTO DIREITO */}
        <div className="relative flex-1 flex items-center h-13 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-300/80 focus-within:border-[#003366] focus-within:bg-white focus-within:ring-3 focus-within:ring-[#003366]/15 shadow-xs transition-all overflow-hidden">
          {/* Ícone de busca à esquerda */}
          <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-slate-400">
            <Search size={20} className="text-[#003366]" />
          </div>

          {/* Campo de texto / busca por condomínio */}
          <input
            type="text"
            id="mobile-input-busca-condominio"
            value={filters.busca || ''}
            onChange={(e) => onChangeFilters({ busca: e.target.value })}
            placeholder="Buscar por condomínio..."
            className="flex-1 h-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-hidden min-w-0 pr-1"
          />

          {/* Botão limpar busca (se houver texto digitado) */}
          {filters.busca && (
            <button
              type="button"
              id="mobile-btn-clear-condominio"
              onClick={() => onChangeFilters({ busca: '' })}
              className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 mr-1 shrink-0 transition-colors cursor-pointer"
              title="Limpar busca"
            >
              <X size={13} />
            </button>
          )}

          {/* Divisor vertical sutil */}
          <div className="h-6 w-px bg-slate-200 shrink-0" />

          {/* ÍCONE DENTRO DO BOTÃO NO CANTO DIREITO DE MAIS FILTROS */}
          <button
            type="button"
            id="mobile-btn-mais-filtros-inside"
            onClick={onOpenMoreFilters}
            className="relative h-full px-3.5 flex items-center justify-center text-[#003366] hover:bg-slate-200/60 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Mais Filtros"
            aria-label="Abrir mais filtros"
          >
            <SlidersHorizontal size={19} className="stroke-[2.2]" />
            {activeFiltersCount > 0 && (
              <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full bg-[#003366] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
