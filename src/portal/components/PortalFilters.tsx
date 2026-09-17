/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  MapPin,
  Home,
  LayoutGrid,
  Tag,
  Bed,
  SlidersHorizontal,
  ChevronDown,
  X,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { PortalFilterState } from '../types';
import { PortalFilterDropdown } from './PortalFilterDropdown';
import { DbService } from '../../services/db';

interface PortalFiltersProps {
  filters: PortalFilterState;
  availableCities?: string[];
  onChangeFilters: (newFilters: Partial<PortalFilterState>) => void;
  onOpenAlertModal: () => void;
  onOpenMoreFilters: () => void;
}

export function PortalFilters({
  filters,
  availableCities,
  onChangeFilters,
  onOpenMoreFilters,
}: PortalFiltersProps) {
  // Estado dos dropdowns abertos
  const [openDropdown, setOpenDropdown] = useState<
    'cidade' | 'finalidade' | 'categoria' | 'valor' | 'quartos' | null
  >(null);

  // Estado interno para pesquisa inteligente no campo Cidade
  const [cidadeSearchText, setCidadeSearchText] = useState<string>('');
  const cidadeInputRef = useRef<HTMLInputElement>(null);
  const [dbCities, setDbCities] = useState<{ cidade: string; count: number }[]>([]);

  // Carrega cidades reais e contagens do banco de dados para o dropdown inteligente
  useEffect(() => {
    let isMounted = true;
    DbService.getCidades().then((cities) => {
      if (isMounted && Array.isArray(cities) && cities.length > 0) {
        setDbCities(cities);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Foco automático no input de pesquisa quando o dropdown Cidade for aberto
  useEffect(() => {
    if (openDropdown === 'cidade') {
      setCidadeSearchText('');
      setTimeout(() => {
        cidadeInputRef.current?.focus();
      }, 60);
    }
  }, [openDropdown]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
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

  // Contagem de filtros ativos para badge no botão "Mais filtros"
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.precoMin && filters.precoMin > 0) count++;
    if (filters.precoMax && filters.precoMax < 15000000) count++;
    if (filters.quartosMin && filters.quartosMin > 0) count++;
    if (filters.banheirosMin && filters.banheirosMin > 0) count++;
    if (filters.vagasMin && filters.vagasMin > 0) count++;
    if (filters.metragemMin && filters.metragemMin > 0) count++;
    if (filters.metragemMax && filters.metragemMax > 0) count++;
    if (filters.tipoImovel && filters.tipoImovel !== 'todos') count++;
    if (filters.statusImovel && filters.statusImovel !== 'todos') count++;
    if (filters.bairro) count++;
    if (filters.construtora) count++;
    if (filters.categoria && filters.categoria !== 'Todos') count++;
    return count;
  }, [filters]);

  const hasActiveCustomFilters =
    activeFiltersCount > 0 ||
    Boolean(filters.busca) ||
    (Boolean(filters.cidade) && filters.cidade !== 'Todas') ||
    (Boolean(filters.finalidade) && filters.finalidade !== 'Comprar');

  // Cidades padrão sugeridas
  const defaultCities = useMemo(
    () => [
      'Balneário Camboriú',
      'Itajaí',
      'Camboriú',
      'Itapema',
      'Praia Brava',
      'Porto Belo',
      'Bombinhas',
      'Navegantes',
      'Florianópolis',
    ],
    []
  );

  // Lista de cidades consolidadas com contagens do banco de dados (prioritárias) ou disponíveis
  const cityItems = useMemo(() => {
    if (dbCities.length > 0) {
      return dbCities;
    }
    const list = availableCities && availableCities.length > 0 ? availableCities : defaultCities;
    return list.map((c) => ({ cidade: c, count: 0 }));
  }, [dbCities, availableCities, defaultCities]);

  // Sugestões inteligentes de empreendimentos, bairros e características populares
  const popularFeaturesSuggestions = useMemo(
    () => [
      { label: 'Frente mar', type: 'caracteristica', query: 'Frente mar' },
      { label: 'Quadra mar', type: 'caracteristica', query: 'Quadra mar' },
      { label: 'Mobiliado', type: 'caracteristica', query: 'Mobiliado' },
      { label: 'Piscina', type: 'caracteristica', query: 'Piscina' },
      { label: '3 suítes', type: 'caracteristica', query: '3 suítes' },
      { label: 'Cobertura', type: 'caracteristica', query: 'Cobertura' },
      { label: 'Brava', type: 'bairro', cidade: 'Itajaí', query: 'Brava' },
      { label: 'One Tower', type: 'empreendimento', cidade: 'Balneário Camboriú', query: 'One Tower' },
    ],
    []
  );

  // Filtragem dinâmica para o campo inteligente de Cidade
  const filteredCities = useMemo(() => {
    const q = cidadeSearchText.trim().toLowerCase();
    if (!q) return cityItems;
    return cityItems.filter((c) => c.cidade.toLowerCase().includes(q));
  }, [cityItems, cidadeSearchText]);

  // Sugestões filtradas quando o usuário digita algo que pode ser empreendimento ou característica
  const matchingSuggestions = useMemo(() => {
    const q = cidadeSearchText.trim().toLowerCase();
    if (!q) return [];
    return popularFeaturesSuggestions.filter(
      (s) => s.label.toLowerCase().includes(q) || s.query.toLowerCase().includes(q)
    );
  }, [popularFeaturesSuggestions, cidadeSearchText]);

  return (
    <nav
      id="portal-filters-bar"
      ref={containerRef}
      aria-label="Barra de busca e filtros do ImobiShare"
      className="bg-white border-b border-slate-100 sticky top-16 relative z-40 py-3 px-4 sm:px-6 lg:px-8 shadow-2xs transition-all font-sans"
    >
      {/* Contêiner centralizado e proporcional na página */}
      <div className="w-full flex items-center justify-center">
        {/* Barra estilo cápsula arredondada Airbnb com todos os filtros em linha única */}
        <div className="inline-flex items-center gap-2 p-1.5 sm:p-2 bg-white rounded-full border border-slate-200/90 shadow-xs max-w-full overflow-x-auto scrollbar-none">
          
          {/* 1. CAMPO DE BUSCA LIVRE (Antes de Cidade) */}
          <div className="relative flex items-center shrink-0 w-64 md:w-72 lg:w-80 xl:w-84">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 pointer-events-none stroke-[2.2]"
            />
            <input
              type="text"
              id="portal-filter-search-input"
              value={filters.busca || ''}
              onChange={(e) => onChangeFilters({ busca: e.target.value })}
              placeholder="Buscar por empreendimento, bairro, condomínio, código..."
              className="w-full h-12 pl-11 pr-9 rounded-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-[16px] text-slate-800 placeholder:text-slate-400 border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-all"
            />
            {filters.busca && (
              <button
                type="button"
                id="portal-filter-clear-search-btn"
                onClick={() => onChangeFilters({ busca: '' })}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Limpar busca"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Divisor vertical sutil entre busca e os botões */}
          <div className="h-7 w-px bg-slate-200 shrink-0 mx-0.5 hidden sm:block" />

          {/* 2. CIDADE (Campo Inteligente de Localização + Busca de Imóveis) */}
          <PortalFilterDropdown
            isOpen={openDropdown === 'cidade'}
            onClose={() => setOpenDropdown(null)}
            align="left"
            className="w-84 max-h-96 overflow-hidden p-0 shadow-2xl border border-slate-200 rounded-2xl flex flex-col bg-white"
            trigger={({ isOpen }) => (
              <button
                type="button"
                id="filter-btn-cidade"
                onClick={() => toggleDropdown('cidade')}
                className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  filters.cidade && filters.cidade !== 'Todas'
                    ? 'bg-blue-50/70 text-[#003366] border-blue-300 ring-1 ring-[#003366]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <MapPin size={18} className="text-[#003366] shrink-0 stroke-[2.2]" />
                <span className="truncate max-w-[140px]">
                  {filters.cidade && filters.cidade !== 'Todas' ? filters.cidade : 'Balneário Camboriú'}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#003366]' : ''
                  }`}
                />
              </button>
            )}
          >
            {/* Campo de pesquisa rápida dentro do menu inteligente de Cidade */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  ref={cidadeInputRef}
                  type="text"
                  value={cidadeSearchText}
                  onChange={(e) => setCidadeSearchText(e.target.value)}
                  placeholder="Cidade, empreendimento, bairro ou característica..."
                  className="w-full h-10 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-all"
                />
                {cidadeSearchText && (
                  <button
                    type="button"
                    onClick={() => setCidadeSearchText('')}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Chips de busca rápida para características / bairros populares */}
              {!cidadeSearchText && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {popularFeaturesSuggestions.slice(0, 5).map((sug) => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => {
                        if (sug.type === 'bairro' && sug.cidade) {
                          onChangeFilters({ cidade: sug.cidade, bairro: sug.label, busca: '' });
                        } else {
                          onChangeFilters({ busca: sug.query });
                        }
                        setOpenDropdown(null);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-full text-[12px] font-medium text-slate-600 hover:text-[#003366] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles size={12} className="text-[#003366]" />
                      <span>{sug.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista rolável de opções */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-64">
              {/* Sugestões de empreendimentos ou características quando pesquisando */}
              {cidadeSearchText.trim() && matchingSuggestions.length > 0 && (
                <div className="mb-2 pb-1 border-b border-slate-100">
                  <span className="px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400 block">
                    Sugestões inteligentes
                  </span>
                  {matchingSuggestions.map((sug) => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => {
                        if (sug.type === 'bairro' && sug.cidade) {
                          onChangeFilters({ cidade: sug.cidade, bairro: sug.label, busca: '' });
                        } else {
                          onChangeFilters({ busca: sug.query });
                        }
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-[13.5px] flex items-center justify-between hover:bg-blue-50/70 text-slate-700 hover:text-[#003366] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-[#003366] shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800">{sug.label}</span>
                          <span className="text-[12px] text-slate-400 ml-1.5">
                            {sug.type === 'empreendimento' ? '• Empreendimento' : sug.type === 'bairro' ? `• Bairro em ${sug.cidade}` : '• Característica'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[12px] text-[#003366] font-medium">Buscar</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Botão de busca livre quando o texto digitado não é exatamente uma cidade */}
              {cidadeSearchText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeFilters({ busca: cidadeSearchText.trim() });
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-[13.5px] flex items-center justify-between bg-blue-50/50 hover:bg-blue-50 text-[#003366] font-medium transition-colors cursor-pointer mb-1 border border-blue-100"
                >
                  <div className="flex items-center gap-2">
                    <Search size={15} className="shrink-0 text-[#003366]" />
                    <span>Pesquisar por <strong className="font-bold">"{cidadeSearchText}"</strong></span>
                  </div>
                  <span className="text-[12px] bg-[#003366] text-white px-2 py-0.5 rounded-full font-semibold">Ir</span>
                </button>
              )}

              {/* Opção "Todas as cidades" */}
              {(!cidadeSearchText || 'todas as cidades'.includes(cidadeSearchText.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeFilters({ cidade: undefined });
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                    !filters.cidade || filters.cidade === 'Todas'
                      ? 'font-bold text-[#003366] bg-blue-50'
                      : 'text-slate-700 font-medium'
                  }`}
                >
                  <span>Todas as cidades</span>
                  {(!filters.cidade || filters.cidade === 'Todas') && (
                    <Check size={16} className="text-[#003366] stroke-[2.5]" />
                  )}
                </button>
              )}

              {/* Lista filtrada de cidades */}
              {filteredCities.map((item) => {
                const isSelected = filters.cidade === item.cidade;
                return (
                  <button
                    key={item.cidade}
                    type="button"
                    onClick={() => {
                      onChangeFilters({ cidade: item.cidade });
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                      isSelected
                        ? 'font-bold text-[#003366] bg-blue-50'
                        : 'text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className={isSelected ? 'text-[#003366]' : 'text-slate-400'} />
                      <span>{item.cidade}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.count > 0 && (
                        <span className="text-[12px] font-normal text-slate-400">
                          {item.count} {item.count === 1 ? 'imóvel' : 'imóveis'}
                        </span>
                      )}
                      {isSelected && <Check size={16} className="text-[#003366] stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}

              {filteredCities.length === 0 && matchingSuggestions.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-[13px]">
                  Nenhuma cidade encontrada para "{cidadeSearchText}"
                </div>
              )}
            </div>
          </PortalFilterDropdown>

          {/* 3. COMPRAR / ALUGAR */}
          <PortalFilterDropdown
            isOpen={openDropdown === 'finalidade'}
            onClose={() => setOpenDropdown(null)}
            align="left"
            className="w-56 p-1.5 shadow-2xl border border-slate-200 rounded-2xl"
            trigger={({ isOpen }) => (
              <button
                type="button"
                id="filter-btn-finalidade"
                onClick={() => toggleDropdown('finalidade')}
                className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  filters.finalidade && filters.finalidade !== 'Comprar'
                    ? 'bg-blue-50/70 text-[#003366] border-[#003366]/40 ring-1 ring-[#003366]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Home size={18} className="text-slate-600 shrink-0 stroke-[2]" />
                <span>{filters.finalidade || 'Comprar'}</span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#003366]' : ''
                  }`}
                />
              </button>
            )}
          >
            {(['Comprar', 'Alugar', 'Todos'] as const).map((opt) => {
              const isSelected =
                opt === 'Todos'
                  ? !filters.finalidade || filters.finalidade === 'Todos'
                  : filters.finalidade === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChangeFilters({ finalidade: opt === 'Todos' ? undefined : opt });
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                    isSelected
                      ? 'font-bold text-[#003366] bg-blue-50'
                      : 'text-slate-700 font-medium'
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && <Check size={16} className="text-[#003366] stroke-[2.5]" />}
                </button>
              );
            })}
          </PortalFilterDropdown>

          {/* 4. CATEGORIA */}
          <PortalFilterDropdown
            isOpen={openDropdown === 'categoria'}
            onClose={() => setOpenDropdown(null)}
            align="left"
            className="w-56 p-1.5 shadow-2xl border border-slate-200 rounded-2xl"
            trigger={({ isOpen }) => (
              <button
                type="button"
                id="filter-btn-categoria"
                onClick={() => toggleDropdown('categoria')}
                className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  filters.categoria && filters.categoria !== 'Todos'
                    ? 'bg-blue-50/70 text-[#003366] border-[#003366]/40 ring-1 ring-[#003366]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid size={18} className="text-slate-600 shrink-0 stroke-[2]" />
                <span>
                  {filters.categoria && filters.categoria !== 'Todos'
                    ? filters.categoria
                    : 'Categoria'}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#003366]' : ''
                  }`}
                />
              </button>
            )}
          >
            {(['Lançamentos', 'Prontos', 'Todos'] as const).map((cat) => {
              const isSelected =
                cat === 'Todos'
                  ? !filters.categoria || filters.categoria === 'Todos'
                  : filters.categoria === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onChangeFilters({ categoria: cat === 'Todos' ? undefined : cat });
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                    isSelected
                      ? 'font-bold text-[#003366] bg-blue-50'
                      : 'text-slate-700 font-medium'
                  }`}
                >
                  <span>{cat}</span>
                  {isSelected && <Check size={16} className="text-[#003366] stroke-[2.5]" />}
                </button>
              );
            })}
          </PortalFilterDropdown>

          {/* 5. VALOR */}
          <PortalFilterDropdown
            isOpen={openDropdown === 'valor'}
            onClose={() => setOpenDropdown(null)}
            align="left"
            className="w-72 p-1.5 shadow-2xl border border-slate-200 rounded-2xl"
            trigger={({ isOpen }) => (
              <button
                type="button"
                id="filter-btn-valor"
                onClick={() => toggleDropdown('valor')}
                className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  filters.precoMin || (filters.precoMax && filters.precoMax < 15000000)
                    ? 'bg-blue-50/70 text-[#003366] border-[#003366]/40 ring-1 ring-[#003366]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Tag size={18} className="text-slate-600 shrink-0 stroke-[2]" />
                <span>
                  {filters.precoMax && filters.precoMax < 15000000
                    ? `Até R$ ${(filters.precoMax / 1000000).toFixed(1).replace('.', ',')} mi`
                    : filters.precoMin
                    ? `A partir de R$ ${(filters.precoMin / 1000000).toFixed(1).replace('.', ',')} mi`
                    : 'Valor'}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#003366]' : ''
                  }`}
                />
              </button>
            )}
          >
            <div className="space-y-0.5">
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
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                      isSelected
                        ? 'font-bold text-[#003366] bg-blue-50'
                        : 'text-slate-700 font-medium'
                    }`}
                  >
                    <span>{range.label}</span>
                    {isSelected && <Check size={16} className="text-[#003366] stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </PortalFilterDropdown>

          {/* 6. QUARTOS */}
          <PortalFilterDropdown
            isOpen={openDropdown === 'quartos'}
            onClose={() => setOpenDropdown(null)}
            align="left"
            className="w-56 p-1.5 shadow-2xl border border-slate-200 rounded-2xl"
            trigger={({ isOpen }) => (
              <button
                type="button"
                id="filter-btn-quartos"
                onClick={() => toggleDropdown('quartos')}
                className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  filters.quartosMin
                    ? 'bg-blue-50/70 text-[#003366] border-[#003366]/40 ring-1 ring-[#003366]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bed size={18} className="text-slate-600 shrink-0 stroke-[2]" />
                <span>
                  {filters.quartosMin ? `${filters.quartosMin}+ quartos` : 'Quartos'}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#003366]' : ''
                  }`}
                />
              </button>
            )}
          >
            <div className="space-y-0.5">
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
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] flex items-center justify-between hover:bg-blue-50/60 transition-colors cursor-pointer ${
                      isSelected
                        ? 'font-bold text-[#003366] bg-blue-50'
                        : 'text-slate-700 font-medium'
                    }`}
                  >
                    <span>{q.label}</span>
                    {isSelected && <Check size={16} className="text-[#003366] stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </PortalFilterDropdown>

          {/* 7. MAIS FILTROS */}
          <button
            type="button"
            id="filter-btn-mais-filtros"
            onClick={onOpenMoreFilters}
            className={`h-12 px-4.5 shrink-0 inline-flex items-center gap-2 rounded-full text-[16px] font-medium border transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
              activeFiltersCount > 0
                ? 'bg-blue-50/70 text-[#003366] border-[#003366]/40 ring-1 ring-[#003366]/20'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal
              size={18}
              className={activeFiltersCount > 0 ? 'text-[#003366]' : 'text-slate-600'}
            />
            <span>Mais filtros</span>
            {activeFiltersCount > 0 && (
              <span className="bg-[#003366] text-white text-xs font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* BOTÃO LIMPAR FILTROS (quando há seleções ativas) */}
          {hasActiveCustomFilters && (
            <button
              type="button"
              id="filter-btn-limpar-tudo"
              onClick={() => {
                onChangeFilters({
                  finalidade: 'Comprar',
                  categoria: 'Todos',
                  tipoImovel: undefined,
                  statusImovel: undefined,
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
                });
              }}
              className="h-12 px-3 shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full cursor-pointer whitespace-nowrap transition-colors"
              title="Redefinir todos os filtros"
            >
              <X size={15} />
              <span>Limpar</span>
            </button>
          )}

        </div>
      </div>
    </nav>
  );
}
