/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MapPin, Home, DollarSign, Search, Check, X, User, ChevronDown } from 'lucide-react';
import { PortalFilterState, PortalProperty } from '../types';
import { formatCurrencyBRL } from '../data/mockPortalData';
import { LOGO_IMAGE } from '../../assets/logo';

export interface PortalMobileInitialSearchProps {
  properties: PortalProperty[];
  filters: PortalFilterState;
  onChangeFilters: (newFilters: Partial<PortalFilterState>) => void;
  onSearch: () => void;
  onOpenAuth?: () => void;
  topCity?: string;
  showWelcomeHeader?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function PortalMobileInitialSearch({
  properties,
  filters,
  onChangeFilters,
  onSearch,
  onOpenAuth,
  topCity = 'Balneário Camboriú',
  showWelcomeHeader = true,
  title = 'Encontre o imóvel ideal em Balneário Camboriú',
  subtitle = 'Apartamentos de alto padrão, lançamentos e oportunidades exclusivas',
  className = '',
}: PortalMobileInitialSearchProps) {
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isBairroOpen, setIsBairroOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);

  const cityRef = useRef<HTMLDivElement>(null);
  const bairroRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (cityRef.current && !cityRef.current.contains(target)) {
        setIsCityOpen(false);
      }
      if (bairroRef.current && !bairroRef.current.contains(target)) {
        setIsBairroOpen(false);
      }
      if (priceRef.current && !priceRef.current.contains(target)) {
        setIsPriceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  // Lista de cidades ordenadas por quantidade de imóveis (a cidade com mais imóveis primeiro)
  const availableCidades = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p) => {
      if (p.cidade && p.cidade.trim()) {
        const c = p.cidade.trim();
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cidade, count]) => ({ cidade, count }));
  }, [properties]);

  const currentCity = filters.cidade;

  // Bairros disponíveis para a cidade selecionada
  const availableBairros = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (
        !currentCity ||
        currentCity === 'Todas' ||
        p.cidade.toLowerCase() === currentCity.toLowerCase()
      ) {
        if (p.bairro && p.bairro.trim()) {
          set.add(p.bairro.trim());
        }
      }
    });
    return Array.from(set).sort();
  }, [properties, currentCity]);

  // Opções de preço predefinidas para mobile
  const priceOptions = [
    { label: 'Qualquer valor', min: undefined, max: undefined },
    { label: 'Até R$ 800.000', min: undefined, max: 800000 },
    { label: 'Até R$ 1.000.000', min: undefined, max: 1000000 },
    { label: 'Até R$ 1.500.000', min: undefined, max: 1500000 },
    { label: 'Até R$ 2.000.000', min: undefined, max: 2000000 },
    { label: 'Até R$ 3.000.000', min: undefined, max: 3000000 },
    { label: 'Até R$ 5.000.000', min: undefined, max: 5000000 },
    { label: 'Até R$ 10.000.000', min: undefined, max: 10000000 },
    { label: 'Acima de R$ 5.000.000', min: 5000000, max: undefined },
  ];

  const selectedPriceLabel = useMemo(() => {
    if (filters.precoMax) {
      return `Até ${formatCurrencyBRL(filters.precoMax)}`;
    }
    if (filters.precoMin) {
      return `Acima de ${formatCurrencyBRL(filters.precoMin)}`;
    }
    return '';
  }, [filters.precoMin, filters.precoMax]);

  return (
    <div className={`w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4 ${className}`} id="portal-mobile-initial-search">
      {/* Cabeçalho de Boas-vindas Moderno com Alto Contraste sobre a Capa - Alinhado à Esquerda */}
      {showWelcomeHeader && (
        <div className="flex flex-col items-start justify-start text-left space-y-1.5 sm:space-y-2 mb-3 sm:mb-5">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight drop-shadow-md max-w-2xl text-left">
            {title}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-white/90 font-medium drop-shadow-xs max-w-xl text-left hidden sm:block">
            {subtitle}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CARD DE BUSCA VERTICAL NO LADO ESQUERDO (TODAS AS TELAS)                  */}
      {/* Formato vertical e compacto, liberando o centro/direita da foto de capa   */}
      {/* ========================================================================= */}
      <div className="w-full max-w-md mr-auto">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-3.5 sm:p-4.5 border border-white/80 shadow-2xl shadow-black/25 space-y-2.5 sm:space-y-3">
          {/* Linha 1: Finalidade Comprar / Alugar */}
          <div className="flex bg-slate-100/90 p-1 rounded-xl gap-1 border border-slate-200/70">
            <button
              type="button"
              id="btn-finalidade-comprar"
              onClick={() => onChangeFilters({ finalidade: 'Comprar' })}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                (filters.finalidade || 'Comprar') === 'Comprar'
                  ? 'bg-[#003366] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {(filters.finalidade || 'Comprar') === 'Comprar' && (
                <Check size={13} className="stroke-[2.5]" />
              )}
              <span>Comprar</span>
            </button>
            <button
              type="button"
              id="btn-finalidade-alugar"
              onClick={() => onChangeFilters({ finalidade: 'Alugar' })}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                filters.finalidade === 'Alugar'
                  ? 'bg-[#003366] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {filters.finalidade === 'Alugar' && (
                <Check size={13} className="stroke-[2.5]" />
              )}
              <span>Alugar</span>
            </button>
          </div>

          {/* Grupo compacto de Seletores Modulares: Cidade, Bairro e Valor */}
          <div className="space-y-2">
            {/* 1. CIDADE (Card modular seguindo os padrões do projeto) */}
            <div ref={cityRef} className="relative">
              <div
                id="mobile-box-cidade"
                onClick={() => {
                  setIsCityOpen((prev) => !prev);
                  setIsBairroOpen(false);
                  setIsPriceOpen(false);
                }}
                className={`w-full rounded-2xl bg-white/90 p-2.5 sm:p-3 border transition-all cursor-pointer select-none ${
                  isCityOpen
                    ? 'border-2 border-[#003366] ring-2 ring-[#003366]/10 shadow-xs'
                    : 'border border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-700">
                  <MapPin size={15} className="text-[#003366] stroke-[2] shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cidade</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span
                    className={`text-sm tracking-tight truncate ${
                      filters.cidade && filters.cidade !== 'Todas'
                        ? 'text-slate-800 font-normal'
                        : 'text-slate-400 font-normal'
                    }`}
                  >
                    {filters.cidade && filters.cidade !== 'Todas'
                      ? filters.cidade
                      : 'Busque por cidade'}
                  </span>
                  {filters.cidade && filters.cidade !== 'Todas' && (
                    <button
                      type="button"
                      id="mobile-btn-clear-cidade"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeFilters({ cidade: undefined, bairro: undefined });
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer ml-2"
                      title="Limpar cidade"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown de Cidades */}
              {isCityOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150 max-h-56 overflow-y-auto">
                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeFilters({ cidade: undefined, bairro: undefined });
                        setIsCityOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        !filters.cidade || filters.cidade === 'Todas'
                          ? 'bg-blue-50 text-[#003366] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>Todas as cidades</span>
                      {(!filters.cidade || filters.cidade === 'Todas') && (
                        <Check size={14} className="text-[#003366]" />
                      )}
                    </button>

                    {availableCidades.map(({ cidade, count }) => {
                      const isSelected = filters.cidade === cidade;
                      return (
                        <button
                          key={cidade}
                          type="button"
                          onClick={() => {
                            onChangeFilters({ cidade, bairro: undefined });
                            setIsCityOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 text-[#003366] font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span className="truncate">{cidade}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-slate-400 font-normal">
                              {count}
                            </span>
                            {isSelected && <Check size={14} className="text-[#003366]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. BAIRRO */}
            <div ref={bairroRef} className="relative">
              <div
                id="mobile-box-bairro"
                onClick={() => {
                  setIsBairroOpen((prev) => !prev);
                  setIsCityOpen(false);
                  setIsPriceOpen(false);
                }}
                className={`w-full rounded-2xl bg-white/90 p-2.5 sm:p-3 border transition-all cursor-pointer select-none ${
                  isBairroOpen
                    ? 'border-2 border-[#003366] ring-2 ring-[#003366]/10 shadow-xs'
                    : 'border border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Home size={15} className="text-[#003366] stroke-[2] shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bairro</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span
                    className={`text-sm tracking-tight truncate ${
                      filters.bairro && filters.bairro !== 'Todos os bairros'
                        ? 'text-slate-800 font-normal'
                        : 'text-slate-400 font-normal'
                    }`}
                  >
                    {filters.bairro && filters.bairro !== 'Todos os bairros'
                      ? filters.bairro
                      : 'Busque por bairro'}
                  </span>
                  {filters.bairro && filters.bairro !== 'Todos os bairros' && (
                    <button
                      type="button"
                      id="mobile-btn-clear-bairro"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeFilters({ bairro: undefined });
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer ml-2"
                      title="Limpar bairro"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown de Bairros */}
              {isBairroOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150 max-h-56 overflow-y-auto">
                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeFilters({ bairro: undefined });
                        setIsBairroOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        !filters.bairro || filters.bairro === 'Todos os bairros'
                          ? 'bg-blue-50 text-[#003366] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>Todos os bairros</span>
                      {(!filters.bairro || filters.bairro === 'Todos os bairros') && (
                        <Check size={14} className="text-[#003366]" />
                      )}
                    </button>

                    {availableBairros.length > 0 ? (
                      availableBairros.map((b) => {
                        const isSelected = filters.bairro === b;
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              onChangeFilters({ bairro: b });
                              setIsBairroOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50 text-[#003366] font-bold'
                                : 'text-slate-700 hover:bg-slate-50 font-medium'
                            }`}
                          >
                            <span className="truncate">{b}</span>
                            {isSelected && <Check size={14} className="text-[#003366]" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center">
                        Nenhum bairro encontrado
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. VALOR MÁXIMO */}
            <div ref={priceRef} className="relative">
              <div
                id="mobile-box-valor"
                onClick={() => {
                  setIsPriceOpen((prev) => !prev);
                  setIsCityOpen(false);
                  setIsBairroOpen(false);
                }}
                className={`w-full rounded-2xl bg-white/90 p-2.5 sm:p-3 border transition-all cursor-pointer select-none ${
                  isPriceOpen
                    ? 'border-2 border-[#003366] ring-2 ring-[#003366]/10 shadow-xs'
                    : 'border border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-700">
                  <DollarSign size={15} className="text-[#003366] stroke-[2] shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor máximo</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span
                    className={`text-sm tracking-tight truncate ${
                      selectedPriceLabel
                        ? 'text-slate-800 font-normal'
                        : 'text-slate-400 font-normal'
                    }`}
                  >
                    {selectedPriceLabel || 'Busque por valor'}
                  </span>
                  {selectedPriceLabel && (
                    <button
                      type="button"
                      id="mobile-btn-clear-valor"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeFilters({ precoMin: undefined, precoMax: undefined });
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer ml-2"
                      title="Limpar valor"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown de Valores */}
              {isPriceOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150 max-h-56 overflow-y-auto">
                  <div className="p-1 space-y-0.5">
                    {priceOptions.map((opt, idx) => {
                      const isSelected =
                        opt.max === undefined && opt.min === undefined
                          ? !filters.precoMax && !filters.precoMin
                          : filters.precoMax === opt.max && filters.precoMin === opt.min;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onChangeFilters({ precoMin: opt.min, precoMax: opt.max });
                            setIsPriceOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 text-[#003366] font-bold'
                              : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check size={14} className="text-[#003366]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botão de Buscar */}
          <button
            type="button"
            id="mobile-btn-buscar-imoveis"
            onClick={onSearch}
            className="w-full h-12 bg-[#003366] hover:bg-[#002244] active:scale-[0.99] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-md shadow-[#003366]/20 transition-all cursor-pointer"
          >
            <Search size={18} className="stroke-[2.5]" />
            <span>Buscar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
