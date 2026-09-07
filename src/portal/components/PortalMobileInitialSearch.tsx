/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MapPin, Home, DollarSign, Search, Check, X, User } from 'lucide-react';
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
  title = 'O que você procura?',
  subtitle = 'Encontre os melhores lançamentos e imóveis com facilidade',
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
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setIsCityOpen(false);
      }
      if (bairroRef.current && !bairroRef.current.contains(e.target as Node)) {
        setIsBairroOpen(false);
      }
      if (priceRef.current && !priceRef.current.contains(e.target as Node)) {
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

  // Contagem de imóveis que coincidem com os filtros selecionados nesta tela
  const matchCount = useMemo(() => {
    return properties.filter((p) => {
      if (currentCity && currentCity !== 'Todas') {
        if (!p.cidade.toLowerCase().includes(currentCity.toLowerCase())) return false;
      }
      if (filters.bairro && filters.bairro !== 'Todos os bairros') {
        if (!p.bairro.toLowerCase().includes(filters.bairro.toLowerCase())) return false;
      }
      if (filters.precoMax && filters.precoMax > 0 && filters.precoMax < 15000000) {
        if (p.valor > filters.precoMax) return false;
      }
      if (filters.precoMin && filters.precoMin > 0) {
        if (p.valor < filters.precoMin) return false;
      }
      if (filters.quartosMin && filters.quartosMin > 0) {
        if ((p.dormitorios || p.quartos || 0) < filters.quartosMin) return false;
      }
      return true;
    }).length;
  }, [properties, currentCity, filters.bairro, filters.precoMin, filters.precoMax, filters.quartosMin]);

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
    <div className={`w-full max-w-lg mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 ${className}`} id="portal-mobile-initial-search">
      {/* Imagem em anexo e Ícone oficial do ImobiShare */}
      {showWelcomeHeader && (
        <div className="flex flex-col items-center justify-center pt-1 pb-1 text-center space-y-2.5">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden shadow-xl border-2 border-white ring-4 ring-blue-50 bg-[#003366] flex items-center justify-center transition-transform hover:scale-105">
              <img
                src="/icone_imobishare.png"
                alt="ImobiShare"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = LOGO_IMAGE;
                }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-[#003366] tracking-tight uppercase font-sans">
              IMOBISHARE
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {subtitle}
            </p>
          </div>
        </div>
      )}

      {/* Card Principal de Filtros Iniciais */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xl shadow-slate-200/40 space-y-3.5 sm:space-y-4">
        {/* Filtro de Finalidade: Comprar / Alugar */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 border border-slate-200/80">
          <button
            type="button"
            id="btn-finalidade-comprar"
            onClick={() => onChangeFilters({ finalidade: 'Comprar' })}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              (filters.finalidade || 'Comprar') === 'Comprar'
                ? 'bg-[#003366] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {(filters.finalidade || 'Comprar') === 'Comprar' && (
              <Check size={14} className="stroke-[2.5]" />
            )}
            <span>Comprar</span>
          </button>
          <button
            type="button"
            id="btn-finalidade-alugar"
            onClick={() => onChangeFilters({ finalidade: 'Alugar' })}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              filters.finalidade === 'Alugar'
                ? 'bg-[#003366] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {filters.finalidade === 'Alugar' && (
              <Check size={14} className="stroke-[2.5]" />
            )}
            <span>Alugar</span>
          </button>
        </div>

        {/* Grupo com espaçamento reduzido: Cidade, Bairro e Valor Máximo */}
        <div className="space-y-2 sm:space-y-2.5">
          {/* 1. CIDADE (Card estilizado exatamente como a imagem enviada) */}
          <div ref={cityRef} className="relative">
          <div
            id="mobile-box-cidade"
            onClick={() => {
              setIsCityOpen((prev) => !prev);
              setIsBairroOpen(false);
              setIsPriceOpen(false);
            }}
            className={`w-full rounded-2xl bg-white p-3.5 sm:p-4 border transition-all cursor-pointer select-none ${
              isCityOpen
                ? 'border-2 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                : 'border-2 border-indigo-400/80 hover:border-indigo-500'
            }`}
          >
            {/* Linha superior: Ícone de localização + Cidade */}
            <div className="flex items-center gap-2 text-slate-800">
              <MapPin size={17} className="text-slate-800 stroke-[2] shrink-0" />
              <span className="text-sm font-medium text-slate-800 tracking-tight">Cidade</span>
            </div>

            {/* Linha inferior: Busque por cidade */}
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`text-base sm:text-lg tracking-tight truncate ${
                  filters.cidade && filters.cidade !== 'Todas'
                    ? 'text-slate-800 font-normal'
                    : 'text-slate-500 font-normal'
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
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown de Cidades */}
          {isCityOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150 max-h-60 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onChangeFilters({ cidade: undefined, bairro: undefined });
                    setIsCityOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                    !filters.cidade || filters.cidade === 'Todas'
                      ? 'bg-blue-50 text-[#003366] font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span>Todas as cidades</span>
                  {(!filters.cidade || filters.cidade === 'Todas') && (
                    <Check size={16} className="text-[#003366]" />
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
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 text-[#003366] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>{cidade}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-normal">
                          {count} {count === 1 ? 'imóvel' : 'imóveis'}
                        </span>
                        {isSelected && <Check size={16} className="text-[#003366]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. BAIRRO (Card estilizado exatamente como a imagem enviada) */}
        <div ref={bairroRef} className="relative">
          <div
            id="mobile-box-bairro"
            onClick={() => {
              setIsBairroOpen((prev) => !prev);
              setIsCityOpen(false);
              setIsPriceOpen(false);
            }}
            className={`w-full rounded-2xl bg-white p-3.5 sm:p-4 border transition-all cursor-pointer select-none ${
              isBairroOpen
                ? 'border-2 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
                : 'border border-slate-300 hover:border-slate-400'
            }`}
          >
            {/* Linha superior: Ícone de casa + Bairro */}
            <div className="flex items-center gap-2 text-slate-800">
              <Home size={17} className="text-slate-800 stroke-[2] shrink-0" />
              <span className="text-sm font-medium text-slate-800 tracking-tight">Bairro</span>
            </div>

            {/* Linha inferior: Busque por bairro */}
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`text-base sm:text-lg tracking-tight truncate ${
                  filters.bairro && filters.bairro !== 'Todos os bairros'
                    ? 'text-slate-800 font-normal'
                    : 'text-slate-500 font-normal'
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
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown de Bairros */}
          {isBairroOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150 max-h-60 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onChangeFilters({ bairro: undefined });
                    setIsBairroOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                    !filters.bairro || filters.bairro === 'Todos os bairros'
                      ? 'bg-blue-50 text-[#003366] font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span>Todos os bairros</span>
                  {(!filters.bairro || filters.bairro === 'Todos os bairros') && (
                    <Check size={16} className="text-[#003366]" />
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
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 text-[#003366] font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{b}</span>
                        {isSelected && <Check size={16} className="text-[#003366]" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">
                    Nenhum bairro encontrado para esta cidade
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. VALOR MÁXIMO (Card estilizado exatamente como a imagem enviada) */}
        <div ref={priceRef} className="relative">
          <div
            id="mobile-box-valor"
            onClick={() => {
              setIsPriceOpen((prev) => !prev);
              setIsCityOpen(false);
              setIsBairroOpen(false);
            }}
            className={`w-full rounded-2xl bg-white p-3.5 sm:p-4 border transition-all cursor-pointer select-none ${
              isPriceOpen
                ? 'border-2 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
                : 'border border-slate-300 hover:border-slate-400'
            }`}
          >
            {/* Linha superior: Ícone de moeda + Valor máximo */}
            <div className="flex items-center gap-2 text-slate-800">
              <DollarSign size={17} className="text-slate-800 stroke-[2] shrink-0" />
              <span className="text-sm font-medium text-slate-800 tracking-tight">Valor máximo</span>
            </div>

            {/* Linha inferior: Busque por valor */}
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`text-base sm:text-lg tracking-tight truncate ${
                  selectedPriceLabel
                    ? 'text-slate-800 font-normal'
                    : 'text-slate-500 font-normal'
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
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown de Valores */}
          {isPriceOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150 max-h-64 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
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
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 text-[#003366] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={16} className="text-[#003366]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

        {/* 4. BOTÃO DE BUSCAR */}
        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            id="mobile-btn-buscar-imoveis"
            onClick={onSearch}
            className="w-full h-14 bg-[#003366] hover:bg-[#002244] active:scale-[0.99] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#003366]/25 transition-all cursor-pointer"
          >
            <Search size={20} className="stroke-[2.5]" />
            <span>Buscar {matchCount > 0 ? `(${matchCount} imóveis)` : 'Imóveis'}</span>
          </button>

          {/* BOTÃO DO PAINEL DO CORRETOR */}
          {onOpenAuth && (
            <button
              type="button"
              id="mobile-btn-painel-corretor"
              onClick={onOpenAuth}
              className="w-full py-3 px-4 rounded-2xl border border-blue-200/80 bg-blue-50/70 hover:bg-blue-100 text-[#003366] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-2xs"
            >
              <User size={16} className="text-[#003366] stroke-[2.2]" />
              <span>Painel do Corretor • Acesso Profissional</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
