/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * PORTAL PÚBLICO IMOBISHARE — ENTRY COMPONENT (ETAPA 1)
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PortalSearchPage } from './pages/PortalSearchPage';
import { PortalPropertyDetailPage } from './pages/PortalPropertyDetailPage';
import { MOCK_PORTAL_PROPERTIES } from './data/mockPortalData';
import { PortalProperty } from './types';
import { Imovel } from '../types';

interface PortalAppProps {
  realProperties?: Imovel[];
  initialPropertyId?: string | null;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
}

export function PortalApp({
  realProperties = [],
  initialPropertyId = null,
  isLoggedIn = false,
  onOpenAuth,
}: PortalAppProps) {
  // Lista de imóveis do portal: dados mock de demonstração da Etapa 1 + imóveis reais adaptados
  const properties = useMemo<PortalProperty[]>(() => {
    // Começa com os dados mock especificados (SANCHO, MAGIC SUN, GRAND PALAIS, etc.)
    const list: PortalProperty[] = [...MOCK_PORTAL_PROPERTIES];

    // Se houver imóveis reais cadastrados no sistema, adapta sem alterar seus dados
    if (realProperties && realProperties.length > 0) {
      realProperties.forEach((p) => {
        // Evita duplicar se por acaso tiver o mesmo id
        if (!list.some((item) => item.id === p.id)) {
          list.push({
            id: p.id,
            codigo: p.codigo || `IMB-${p.id.slice(0, 6)}`,
            titulo: p.titulo,
            nomeEdificio: p.nomeEdificio || p.titulo,
            construtora: p.construtora || 'Empreendimento',
            tipoImovel: p.tipoImovel,
            statusImovel: p.statusImovel,
            tipo: p.tipo,
            valor: p.valor,
            metragem: p.metragem,
            areaTotal: p.areaTotal,
            dormitorios: p.dormitorios,
            quartos: p.dormitorios,
            banheiros: p.banheiros,
            vagas: p.vagas,
            suites: (p as any).suites,
            andar: (p as any).andar,
            condominioFormatado: (p as any).condominio ? `R$ ${(p as any).condominio.toLocaleString('pt-BR')} / mês` : undefined,
            iptuFormatado: (p as any).iptu ? `R$ ${(p as any).iptu.toLocaleString('pt-BR')} / ano` : undefined,
            dataEntrega: (p as any).dataEntrega,
            dataPublicacao: p.dataCadastro ? new Date(p.dataCadastro).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : undefined,
            isLancamento: p.statusImovel === 'Na planta',
            cidade: p.cidade,
            bairro: p.bairro,
            endereco: p.endereco,
            latitude: p.latitude,
            longitude: p.longitude,
            fotos: p.fotos || [],
            descricao: p.descricao || 'Excelente oportunidade.',
            corretorNome: p.corretorNome,
            corretorEmail: p.corretorEmail,
            dataCadastro: p.dataCadastro,
          });
        }
      });
    }

    return list;
  }, [realProperties]);

  // Navegação: ID do imóvel selecionado para a página de detalhes
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(initialPropertyId);
  // Rastreia se a visualização foi aberta a partir do clique no mapa
  const [openedFromMap, setOpenedFromMap] = useState<boolean>(false);
  const [lastSelectedPinId, setLastSelectedPinId] = useState<string | null>(null);

  // Favoritos armazenados localmente
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('portal_favorite_properties');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('portal_favorite_properties', JSON.stringify(next));
      } catch (err) {
        console.error('Erro ao salvar favoritos:', err);
      }
      return next;
    });
  };

  // Sincroniza com rota / hash da URL (ex: #imovel/mock-sancho-01)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#imovel/')) {
        const id = hash.replace('#imovel/', '');
        setSelectedPropertyId(id);
      } else if (hash === '' || hash === '#portal' || hash === '#') {
        setSelectedPropertyId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Checagem inicial
    if (window.location.hash.startsWith('#imovel/')) {
      const id = window.location.hash.replace('#imovel/', '');
      setSelectedPropertyId(id);
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectProperty = (id: string, fromMap: boolean = false) => {
    setSelectedPropertyId(id);
    setOpenedFromMap(fromMap);
    if (fromMap) {
      setLastSelectedPinId(id);
    }
    window.location.hash = `#imovel/${id}`;
  };

  const handleCloseDetail = () => {
    setSelectedPropertyId(null);
    window.location.hash = '#portal';
  };

  // Encontra o imóvel ativo para a página de detalhes
  const activeProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => p.id === selectedPropertyId) || null;
  }, [selectedPropertyId, properties]);

  // Se houver um imóvel selecionado, renderiza a página completa do imóvel
  if (activeProperty) {
    return (
      <PortalPropertyDetailPage
        imovel={activeProperty}
        isFavorite={favorites.includes(activeProperty.id)}
        fromMap={openedFromMap}
        onToggleFavorite={handleToggleFavorite}
        onClose={handleCloseDetail}
        onGoHome={handleCloseDetail}
      />
    );
  }

  // Caso contrário, renderiza a página de pesquisa principal do portal
  return (
    <PortalSearchPage
      properties={properties}
      favorites={favorites}
      isLoggedIn={isLoggedIn}
      initialMobileViewMode={openedFromMap ? 'map' : undefined}
      initialSelectedPinId={lastSelectedPinId}
      openedFromMap={openedFromMap}
      onToggleFavorite={handleToggleFavorite}
      onSelectProperty={handleSelectProperty}
      onOpenAuth={onOpenAuth}
    />
  );
}
