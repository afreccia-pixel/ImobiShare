/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { PortalHeader } from '../components/PortalHeader';
import { PortalFilters } from '../components/PortalFilters';
import { PortalSorting } from '../components/PortalSorting';
import { PortalPropertyCard } from '../components/PortalPropertyCard';
import { PortalMap } from '../components/PortalMap';
import { PortalAlertModal } from '../components/PortalAlertModal';
import { PortalMoreFiltersModal } from '../components/PortalMoreFiltersModal';
import { PortalFilterState, PortalSortOption, PortalProperty } from '../types';

interface PortalSearchPageProps {
  properties: PortalProperty[];
  favorites: string[];
  isLoggedIn?: boolean;
  onToggleFavorite: (id: string) => void;
  onSelectProperty: (id: string) => void;
  onOpenAuth?: () => void;
}

export function PortalSearchPage({
  properties,
  favorites,
  isLoggedIn = false,
  onToggleFavorite,
  onSelectProperty,
  onOpenAuth,
}: PortalSearchPageProps) {
  // Filtros padrão obrigatórios conforme especificação
  const [filters, setFilters] = useState<PortalFilterState>({
    cidade: 'Balneário Camboriú',
    finalidade: 'Comprar',
    categoria: 'Lançamentos',
    precoMin: undefined,
    precoMax: undefined,
    quartosMin: undefined,
    vagasMin: undefined,
    bairro: undefined,
    construtora: undefined,
  });

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

    // Filtro de cidade (insensível a maiúsculas)
    if (filters.cidade) {
      const c = filters.cidade.toLowerCase();
      list = list.filter((p) => p.cidade.toLowerCase().includes(c) || c.includes(p.cidade.toLowerCase()));
    }

    // Filtro de finalidade (Comprar -> tipo 'venda' ou 'ambos', Alugar -> 'locação')
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

    // Preço
    if (filters.precoMin) {
      list = list.filter((p) => p.valor >= filters.precoMin!);
    }
    if (filters.precoMax) {
      list = list.filter((p) => p.valor <= filters.precoMax!);
    }

    // Quartos
    if (filters.quartosMin) {
      list = list.filter((p) => (p.dormitorios || p.quartos || 0) >= filters.quartosMin!);
    }

    // Vagas
    if (filters.vagasMin) {
      list = list.filter((p) => (p.vagas || 0) >= filters.vagasMin!);
    }

    // Bairro
    if (filters.bairro) {
      const b = filters.bairro.toLowerCase();
      list = list.filter((p) => p.bairro.toLowerCase().includes(b));
    }

    // Construtora
    if (filters.construtora) {
      const c = filters.construtora.toLowerCase();
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

  // Sincronização ao clicar no marcador do mapa
  const handleSelectFromMap = useCallback((id: string) => {
    setSelectedPinId(id);
    const cardElement = document.getElementById(`portal-card-${id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans" id="portal-search-page">
      {/* 5. CABEÇALHO: IMOBISHARE | Entrar */}
      <PortalHeader 
        isLoggedIn={isLoggedIn}
        onOpenAuth={onOpenAuth}
        onGoHome={() => {
          setFilters({
            cidade: 'Balneário Camboriú',
            finalidade: 'Comprar',
            categoria: 'Lançamentos',
          });
        }}
      />

      {/* 6. FILTROS HORIZONTAIS */}
      <PortalFilters
        filters={filters}
        onChangeFilters={handleUpdateFilters}
        onOpenAlertModal={() => setIsAlertModalOpen(true)}
        onOpenMoreFilters={() => setIsMoreFiltersOpen(true)}
      />

      {/* 8. ESTRUTURA PRINCIPAL (60% Imóveis / 40% Mapa) */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* COLUNA ESQUERDA: ~60% Imóveis */}
        <div className="w-full lg:w-[60%] px-4 sm:px-6 lg:px-8 py-5 space-y-4">
          {/* 7. ORDENAÇÃO: Somente "Mais relevantes ▼" (Sem contagem, sem hero) */}
          <div className="flex items-center justify-between pb-1">
            <PortalSorting sortBy={sortBy} onChangeSort={setSortBy} />
          </div>

          {/* 9. GRID DE CARDS DOS IMÓVEIS (3 cards por linha no desktop) */}
          {filteredAndSortedProperties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    cidade: 'Balneário Camboriú',
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

        {/* COLUNA DIREITA: ~40% Mapa Permanente Sticky */}
        <aside className="w-full lg:w-[40%] h-[420px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-[120px] shrink-0 border-l border-slate-200">
          <PortalMap
            imoveis={filteredAndSortedProperties}
            hoveredId={hoveredId}
            selectedId={selectedPinId}
            onHover={setHoveredId}
            onSelect={handleSelectFromMap}
            onSearchInArea={() => {
              // Recarregar os imóveis correspondentes à área sem recarregamento forçado
            }}
          />
        </aside>
      </div>

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
      />
    </div>
  );
}
