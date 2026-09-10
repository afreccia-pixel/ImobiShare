/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Map, List, Loader2 } from 'lucide-react';
import { PortalHeader } from '../components/PortalHeader';
import { PortalFilters } from '../components/PortalFilters';
import { PortalSorting } from '../components/PortalSorting';
import { PortalPropertyCard } from '../components/PortalPropertyCard';
import { PortalMap } from '../components/PortalMap';
import { PortalAlertModal } from '../components/PortalAlertModal';
import { PortalMoreFiltersModal } from '../components/PortalMoreFiltersModal';
import { PortalMobileInitialSearch } from '../components/PortalMobileInitialSearch';
import { PortalMobileSearchBar } from '../components/PortalMobileSearchBar';
import { PortalFilterState, PortalSortOption, PortalProperty } from '../types';

const FALLBACK_HERO_IMAGE = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&auto=format&fit=crop&q=80';

interface PortalSearchPageProps {
  properties: PortalProperty[];
  favorites: string[];
  isLoggedIn?: boolean;
  initialMobileViewMode?: 'list' | 'map';
  initialSelectedPinId?: string | null;
  openedFromMap?: boolean;
  initialFilters?: Partial<PortalFilterState>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onGoHome?: () => void;
  onToggleFavorite: (id: string) => void;
  onSelectProperty: (id: string, fromMap?: boolean) => void;
  onOpenAuth?: () => void;
}

export function PortalSearchPage({
  properties,
  favorites,
  isLoggedIn = false,
  initialMobileViewMode,
  initialSelectedPinId,
  openedFromMap = false,
  initialFilters,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onGoHome,
  onToggleFavorite,
  onSelectProperty,
  onOpenAuth,
}: PortalSearchPageProps) {
  // Ref para rastrear tentativas de imagem e evitar loop de requisições
  const heroImageErrorAttemptRef = useRef(0);
  // Cidade com maior número de imóveis cadastrados
  const topCity = useMemo(() => {
    if (!properties || properties.length === 0) return 'Balneário Camboriú';
    const counts: Record<string, number> = {};
    properties.forEach((p) => {
      if (p.cidade && p.cidade.trim()) {
        const c = p.cidade.trim();
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    let best = 'Balneário Camboriú';
    let max = -1;
    for (const [c, cnt] of Object.entries(counts)) {
      if (cnt > max) {
        max = cnt;
        best = c;
      }
    }
    return best;
  }, [properties]);

  // Filtros padrão: inicializa com os filtros passados da tela de abertura ou padrão
  // "categoria: 'Todos'" e "finalidade: 'Comprar'" garantem que, ao selecionar apenas a cidade, todos os imóveis daquela cidade sejam exibidos sem restrições
  const [filters, setFilters] = useState<PortalFilterState>(() => ({
    cidade: initialFilters?.cidade || 'Balneário Camboriú',
    finalidade: initialFilters?.finalidade || 'Comprar',
    categoria: initialFilters?.categoria || 'Todos',
    precoMin: initialFilters?.precoMin,
    precoMax: initialFilters?.precoMax,
    quartosMin: initialFilters?.quartosMin,
    vagasMin: initialFilters?.vagasMin,
    bairro: initialFilters?.bairro,
    construtora: initialFilters?.construtora,
  }));

  // Sincroniza quando initialFilters mudar
  useEffect(() => {
    if (initialFilters) {
      setFilters((prev) => ({ ...prev, ...initialFilters }));
    }
  }, [initialFilters]);

  // Sincroniza cidade padrão no desktop se não foi informada
  useEffect(() => {
    if (!filters.cidade && topCity) {
      setFilters((prev) => ({ ...prev, cidade: topCity }));
    }
  }, [topCity]);

  // Estado de busca: ao entrar no site a primeira tela é a inicial básica (hasSearched = false)
  const [hasSearched, setHasSearched] = useState<boolean>(() => {
    if (initialMobileViewMode === 'map' || openedFromMap) return true;
    return false;
  });
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'map'>(() => initialMobileViewMode || 'list');

  // URL da imagem de capa usando caminho relativo local (/fotocapa.jpg)
  const [heroBgUrl, setHeroBgUrl] = useState<string>('/fotocapa.jpg');

  // Sincroniza hash da URL (#home, #busca, etc.)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#home' || hash === '' || hash === '#') {
        setHasSearched(false);
        setMobileViewMode('list');
      } else if (hash.startsWith('#busca') || hash.startsWith('#imoveis')) {
        setHasSearched(true);
      }
    };

    window.addEventListener('hashchange', handleHash);

    // Se já estiver em #busca ou #imoveis, preserva a tela de busca ativa
    if (window.location.hash.startsWith('#busca') || window.location.hash.startsWith('#imoveis')) {
      setHasSearched(true);
    }

    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Sincroniza se o usuário retornou da visualização aberta a partir do mapa
  useEffect(() => {
    if (initialMobileViewMode === 'map' || openedFromMap) {
      setHasSearched(true);
      setMobileViewMode('map');

      // No desktop, assegura que o mapa esteja visível
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        const mapEl = document.getElementById('portal-map-wrapper');
        if (mapEl) {
          mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [initialMobileViewMode, openedFromMap]);

  useEffect(() => {
    if (initialSelectedPinId) {
      setSelectedPinId(initialSelectedPinId);
    }
  }, [initialSelectedPinId]);

  // Ordenação: padrão 'relevancia'
  const [sortBy, setSortBy] = useState<PortalSortOption>('relevancia');

  // Hover e seleção sincronizada entre cards e mapa
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Modais de alerta e mais filtros
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  const handleUpdateFilters = useCallback((newFilters: Partial<PortalFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Filtragem e ordenação
  const filteredAndSortedProperties = useMemo(() => {
    let list = [...properties];

    // Filtro de cidade (insensível a maiúsculas com correspondência precisa para evitar que Camboriú traga Balneário Camboriú)
    if (filters.cidade && filters.cidade !== 'Todas') {
      const c = filters.cidade.toLowerCase().trim();
      list = list.filter((p) => {
        const itemCity = (p.cidade || '').toLowerCase().trim();
        return itemCity === c;
      });
    }

    // Filtro de finalidade (Comprar -> tipo 'venda' ou 'ambos', Alugar -> 'locação', Todos -> sem filtro)
    if (filters.finalidade === 'Comprar') {
      list = list.filter((p) => p.tipo === 'venda' || p.tipo === 'ambos');
    } else if (filters.finalidade === 'Alugar') {
      list = list.filter((p) => p.tipo === 'locação' || p.tipo === 'ambos');
    }

    // Filtro de categoria (Lançamentos -> status 'Na planta' ou isLancamento)
    if (filters.categoria === 'Lançamentos') {
      list = list.filter((p) => p.statusImovel === 'Na planta' || p.isLancamento);
    } else if (filters.categoria === 'Prontos') {
      list = list.filter((p) => p.statusImovel !== 'Na planta' && !p.isLancamento);
    }

    // Filtro de Tipo de Imóvel (Apartamento, Casa, Cobertura, etc.)
    if (filters.tipoImovel && filters.tipoImovel.toLowerCase() !== 'todos') {
      const t = filters.tipoImovel.toLowerCase();
      list = list.filter((p) => {
        const itemTipo = (p.tipoImovel || '').toLowerCase();
        if (t === 'casa' && (itemTipo.includes('casa') || itemTipo.includes('sobrado'))) return true;
        return itemTipo.includes(t);
      });
    }

    // Filtro de Status do Imóvel (Na planta, Mobiliado, Sem mobília)
    if (filters.statusImovel && filters.statusImovel.toLowerCase() !== 'todos') {
      const s = filters.statusImovel.toLowerCase();
      list = list.filter((p) => (p.statusImovel || '').toLowerCase() === s);
    }

    // Busca livre (palavra-chave, empreendimento, condomínio, bairro, código ou construtora)
    if (filters.busca && filters.busca.trim()) {
      const q = filters.busca.toLowerCase().trim();
      list = list.filter((p) =>
        (p.titulo || '').toLowerCase().includes(q) ||
        (p.bairro || '').toLowerCase().includes(q) ||
        (p.cidade || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.construtora || '').toLowerCase().includes(q) ||
        (p.descricao || '').toLowerCase().includes(q)
      );
    }

    // Preço
    if (filters.precoMin && filters.precoMin > 0) {
      list = list.filter((p) => p.valor >= filters.precoMin!);
    }
    if (filters.precoMax && filters.precoMax > 0 && filters.precoMax < 15000000) {
      list = list.filter((p) => p.valor <= filters.precoMax!);
    }

    // Quartos
    if (filters.quartosMin && filters.quartosMin > 0) {
      list = list.filter((p) => (p.dormitorios || p.quartos || 0) >= filters.quartosMin!);
    }

    // Banheiros
    if (filters.banheirosMin && filters.banheirosMin > 0) {
      list = list.filter((p) => (p.banheiros || 0) >= filters.banheirosMin!);
    }

    // Vagas
    if (filters.vagasMin && filters.vagasMin > 0) {
      list = list.filter((p) => (p.vagas || 0) >= filters.vagasMin!);
    }

    // Metragem
    if (filters.metragemMin && filters.metragemMin > 0) {
      list = list.filter((p) => (p.metragem || 0) >= filters.metragemMin!);
    }
    if (filters.metragemMax && filters.metragemMax > 0) {
      list = list.filter((p) => (p.metragem || 0) <= filters.metragemMax!);
    }

    // Bairro
    if (filters.bairro && filters.bairro !== 'Todos os bairros') {
      const b = filters.bairro.toLowerCase().trim();
      list = list.filter((p) => p.bairro.toLowerCase().includes(b));
    }

    // Construtora
    if (filters.construtora && filters.construtora !== 'Todas as construtoras') {
      const c = filters.construtora.toLowerCase().trim();
      list = list.filter((p) => (p.construtora || '').toLowerCase().includes(c));
    }

    // Ordenação
    switch (sortBy) {
      case 'menor_preco':
        list.sort((a, b) => a.valor - b.valor);
        break;
      case 'maior_preco':
        list.sort((a, b) => b.valor - a.valor);
        break;
      case 'maior_area':
        list.sort((a, b) => (b.metragem || 0) - (a.metragem || 0));
        break;
      case 'mais_recentes':
        list.sort((a, b) => new Date(b.dataCadastro || 0).getTime() - new Date(a.dataCadastro || 0).getTime());
        break;
      case 'entrega_proxima':
        // Lançamentos com entrega definida primeiro
        list.sort((a, b) => (a.dataEntrega ? -1 : 1));
        break;
      case 'relevancia':
      default:
        // Mantém ordenação padrão de destaque curada
        break;
    }

    return list;
  }, [properties, filters, sortBy]);

  // Sincronização ao clicar no marcador do mapa:
  // "no mapa ao clicar no imovel vai para a vizualizacao, apos clicar no botao fechar volta para o map"
  const handleSelectFromMap = useCallback((id: string) => {
    setSelectedPinId(id);
    onSelectProperty(id, true);
  }, [onSelectProperty]);

  return (
    <div className="h-screen w-full bg-white text-slate-900 flex flex-col font-sans overflow-hidden" id="portal-search-page">
      {/* 5. CABEÇALHO FIXO: IMOBISHARE | Entrar */}
      <div className="shrink-0 z-40">
        <PortalHeader 
          isLoggedIn={isLoggedIn}
          onOpenAuth={onOpenAuth}
          onGoHome={() => {
            setHasSearched(false);
            setMobileViewMode('list');
            window.location.hash = '#home';
            if (onGoHome) {
              onGoHome();
            }
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* TELA INICIAL (AO ENTRAR NO SITE): FILTRO BÁSICO CIDADE, COMPRAR E VALOR */}
      {/* COM ÍCONE DO IMOBISHARE, BOTÃO DE PAINEL DE CORRETOR E BOTÃO DE BUSCA */}
      {/* ========================================================================= */}
      {!hasSearched ? (
        <div 
          className="relative flex-1 min-h-0 w-full overflow-y-auto flex flex-col justify-between bg-slate-900 transition-all"
        >
          {/* Fundo fotográfico de capa único, sem repetição e sem duplicidade vertical */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
            <img
              src={heroBgUrl}
              alt="Balneário Camboriú"
              className="w-full h-full object-cover object-center"
              loading="eager"
              decoding="async"
              onError={(e) => {
                // Previne loops de requisição e erros 429
                const img = e.currentTarget;
                img.onerror = null;
                heroImageErrorAttemptRef.current += 1;
                if (heroImageErrorAttemptRef.current === 1) {
                  setHeroBgUrl('/fotocapa.png');
                } else {
                  setHeroBgUrl(FALLBACK_HERO_IMAGE);
                }
              }}
            />
            {/* Gradiente sutil para garantir contraste de leitura dos textos e cards */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/40" />
          </div>

          {/* Conteúdo posicionado no topo e alinhado no lado esquerdo para destacar a foto de fundo */}
          <div className="relative z-10 w-full pt-4 sm:pt-8 md:pt-12 px-3 sm:px-6 lg:px-8 flex flex-col items-start">
            <PortalMobileInitialSearch
              properties={properties}
              filters={filters}
              onChangeFilters={handleUpdateFilters}
              onSearch={() => {
                setHasSearched(true);
                window.location.hash = '#busca';
              }}
              onOpenAuth={onOpenAuth}
              topCity={topCity}
            />
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* DESKTOP EXPERIENCE (lg: e telas maiores) */}
          {/* ========================================================================= */}
          <div className="hidden lg:flex flex-col flex-1 min-h-0 w-full overflow-hidden relative">
            {/* 6. FILTROS HORIZONTAIS DESKTOP FIXOS */}
            <div className="shrink-0 z-30">
              <PortalFilters
                filters={filters}
                onChangeFilters={handleUpdateFilters}
                onOpenAlertModal={() => setIsAlertModalOpen(true)}
                onOpenMoreFilters={() => setIsMoreFiltersOpen(true)}
              />
            </div>

            {/* 8. ESTRUTURA PRINCIPAL DESKTOP (60% Imóveis Roláveis / 40% Mapa 100% Fixo) */}
            <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
              {/* COLUNA ESQUERDA: ~60% Imóveis */}
              <div className="w-full lg:w-[60%] h-full flex flex-col min-h-0 overflow-hidden bg-white">
                {/* Subcabeçalho de navegação e ordenação 100% FIXO no topo (não se move ao rolar os cards) */}
                <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap z-10 shadow-2xs">
                  <nav aria-label="Navegação estrutural" className="min-w-0">
                    <ol className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setHasSearched(false);
                            setFilters({
                              cidade: topCity,
                              finalidade: 'Comprar',
                              categoria: 'Lançamentos',
                            });
                            window.location.hash = '#home';
                            if (onGoHome) {
                              onGoHome();
                            }
                          }}
                          className="hover:text-[#003366] font-medium transition-colors cursor-pointer"
                        >
                          Início
                        </button>
                      </li>
                      <li className="text-slate-400">›</li>
                      <li>
                        <span className="hover:text-slate-800 transition-colors font-medium">
                          {filters.cidade || topCity}
                        </span>
                      </li>
                      {filters.bairro && (
                        <>
                          <li className="text-slate-400">›</li>
                          <li>
                            <span className="hover:text-slate-800 transition-colors font-medium">
                              {filters.bairro}
                            </span>
                          </li>
                        </>
                      )}
                    </ol>
                  </nav>

                  <div className="shrink-0">
                    <PortalSorting sortBy={sortBy} onChangeSort={setSortBy} />
                  </div>
                </div>

                {/* ÁREA DE CARDS QUE ROLA SUAVEMENTE ABAIXO DA BARRA FIXA */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 scroll-smooth">
                  {/* GRID DE CARDS DESKTOP */}
                  {filteredAndSortedProperties.length > 0 ? (
                    <div className="pb-12">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 pb-6">
                        {filteredAndSortedProperties.map((imovel) => (
                          <PortalPropertyCard
                            key={imovel.id}
                            imovel={imovel}
                            isHovered={hoveredId === imovel.id || selectedPinId === imovel.id}
                            isFavorite={favorites.includes(imovel.id)}
                            onHover={setHoveredId}
                            onSelect={onSelectProperty}
                            onToggleFavorite={onToggleFavorite}
                          />
                        ))}
                      </div>

                      {hasMore && (
                        <div className="flex justify-center pt-2 pb-6">
                          <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#003366] hover:bg-[#002244] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="animate-spin w-4 h-4" />
                                <span>Carregando mais imóveis...</span>
                              </>
                            ) : (
                              <span>Carregar mais imóveis</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100 p-8 space-y-3">
                      <p className="text-sm font-bold text-slate-700">
                        Nenhum imóvel encontrado com os filtros selecionados
                      </p>
                      <p className="text-xs text-slate-400">
                        Tente ajustar a faixa de valor, número de quartos ou remover filtros adicionais.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({
                            cidade: topCity,
                            finalidade: 'Comprar',
                            categoria: 'Lançamentos',
                          });
                        }}
                        className="px-4 py-2 bg-[#003366] text-white text-xs font-bold rounded-lg hover:bg-[#002244] transition-all cursor-pointer"
                      >
                        Redefinir Filtros
                      </button>
                    </div>
                  )}
                </div>
              </div>

        {/* COLUNA DIREITA DESKTOP: ~40% Mapa Permanente 100% Fixo */}
        <aside className="w-full lg:w-[40%] h-full shrink-0 border-l border-slate-200 relative overflow-hidden" id="portal-map-wrapper">
          <PortalMap
            imoveis={filteredAndSortedProperties}
            hoveredId={hoveredId}
            selectedId={selectedPinId}
            onHover={setHoveredId}
            onSelect={handleSelectFromMap}
            onSearchInArea={() => {}}
          />
        </aside>
      </div>
    </div>

    {/* ========================================================================= */}
    {/* MOBILE EXPERIENCE (< lg: CELULAR) */}
    {/* ========================================================================= */}
    <div className="lg:hidden flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {/* BARRA FIXA SUPERIOR NO CELULAR:
            BOTÃO GRANDE DE BUSCA POR CONDOMÍNIO + ÍCONE NO CANTO DIREITO DE MAIS FILTROS */}
        <div className="shrink-0 z-30 bg-white shadow-xs">
          <PortalMobileSearchBar
            filters={filters}
            onChangeFilters={handleUpdateFilters}
            onOpenMoreFilters={() => setIsMoreFiltersOpen(true)}
            onBackToInitial={() => {
              setHasSearched(false);
              setMobileViewMode('list');
              window.location.hash = '#home';
              if (onGoHome) {
                onGoHome();
              }
            }}
          />
        </div>

            {/* MODO LISTA DE IMÓVEIS NO CELULAR */}
            {mobileViewMode === 'list' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Cabeçalho resumido com contagem e ordenação FIXADO NO TOPO */}
                <div className="shrink-0 px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 z-20 shadow-2xs">
                  <div className="text-xs font-bold text-slate-700">
                    <span>{filteredAndSortedProperties.length} imóveis</span>
                    <span className="text-slate-400 font-normal ml-1">
                      em {filters.cidade || topCity}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <PortalSorting sortBy={sortBy} onChangeSort={setSortBy} />
                  </div>
                </div>

                {/* LISTAGEM DE CARDS DE IMÓVEIS (ÚNICA ÁREA QUE ROLA) */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 space-y-4 pb-28 scroll-smooth">
                  {filteredAndSortedProperties.length > 0 ? (
                    <div className="space-y-4">
                      {filteredAndSortedProperties.map((imovel) => (
                        <PortalPropertyCard
                          key={imovel.id}
                          imovel={imovel}
                          isHovered={hoveredId === imovel.id || selectedPinId === imovel.id}
                          isFavorite={favorites.includes(imovel.id)}
                          onHover={setHoveredId}
                          onSelect={onSelectProperty}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))}

                      {hasMore && (
                        <div className="flex justify-center pt-2 pb-6">
                          <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#003366] hover:bg-[#002244] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="animate-spin w-4 h-4" />
                                <span>Carregando mais...</span>
                              </>
                            ) : (
                              <span>Carregar mais imóveis</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200/80 p-6 space-y-3 mt-4">
                      <p className="text-sm font-bold text-slate-700">
                        Nenhum imóvel encontrado
                      </p>
                      <p className="text-xs text-slate-500">
                        Tente ajustar seus filtros ou buscar por outro condomínio.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({
                            cidade: topCity,
                            finalidade: 'Comprar',
                            categoria: 'Lançamentos',
                          });
                        }}
                        className="px-4 py-2.5 bg-[#003366] text-white text-xs font-bold rounded-xl hover:bg-[#002244] transition-all cursor-pointer"
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BOTÃO FLUTUANTE INFERIOR NO MODO LISTA: MOSTRAR O MAPA */}
            {mobileViewMode === 'list' && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <button
                  type="button"
                  id="mobile-btn-mostrar-mapa"
                  onClick={() => setMobileViewMode('map')}
                  className="pointer-events-auto h-13 px-6 rounded-full bg-[#003366] hover:bg-[#002244] active:scale-95 text-white font-extrabold text-sm shadow-2xl shadow-[#003366]/40 flex items-center gap-2.5 border border-white/20 transition-all cursor-pointer"
                >
                  <Map size={19} className="stroke-[2.5]" />
                  <span>Ver no Mapa</span>
                </button>
              </div>
            )}

            {/* MAPA EM TELA INTEIRA NO CELULAR (ONDE APARECE NA TELA INTEIRA O MAPA E O BOTÃO DE BUSCA POR CONDOMÍNIO) */}
            {mobileViewMode === 'map' && (
              <div
                className="fixed inset-0 z-50 bg-white flex flex-col"
                id="mobile-fullscreen-map-container"
              >
                {/* BOTÃO GRANDE DE BUSCA POR CONDOMÍNIO FALADO ANTERIORMENTE */}
                <PortalMobileSearchBar
                  filters={filters}
                  onChangeFilters={handleUpdateFilters}
                  onOpenMoreFilters={() => setIsMoreFiltersOpen(true)}
                  onBackToInitial={() => {
                    setHasSearched(false);
                    setMobileViewMode('list');
                    window.location.hash = '#home';
                    if (onGoHome) onGoHome();
                  }}
                  isMapOverlay
                />

                {/* CONTAINER DO MAPA 100% DA TELA */}
                <div className="flex-1 relative w-full h-full">
                  <PortalMap
                    imoveis={filteredAndSortedProperties}
                    hoveredId={hoveredId}
                    selectedId={selectedPinId}
                    onHover={setHoveredId}
                    onSelect={handleSelectFromMap}
                    onSearchInArea={() => {}}
                  />

                  {/* BOTÃO FLUTUANTE INFERIOR: VOLTAR PARA LISTA */}
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <button
                      type="button"
                      id="mobile-btn-voltar-lista"
                      onClick={() => setMobileViewMode('list')}
                      className="h-13 px-6 rounded-full bg-[#003366] hover:bg-[#002244] active:scale-95 text-white font-extrabold text-sm shadow-2xl shadow-[#003366]/40 flex items-center gap-2.5 border border-white/20 transition-all cursor-pointer"
                    >
                      <List size={19} className="stroke-[2.5]" />
                      <span>Ver Lista</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

      {/* Modal de Alerta de Imóvel */}
      <PortalAlertModal
        filters={filters}
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
      />

      {/* Modal de Filtros Avançados */}
      <PortalMoreFiltersModal
        filters={filters}
        isOpen={isMoreFiltersOpen}
        onClose={() => setIsMoreFiltersOpen(false)}
        onApply={handleUpdateFilters}
        properties={properties}
      />
    </div>
  );
}
