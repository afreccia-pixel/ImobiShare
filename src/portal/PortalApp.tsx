/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * PORTAL PÚBLICO IMOBISHARE — INTEGRAÇÃO COM IMÓVEIS REAIS (ETAPA 2)
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PortalSearchPage } from './pages/PortalSearchPage';
import { PortalPropertyDetailPage } from './pages/PortalPropertyDetailPage';
import { PortalProperty } from './types';
import { Imovel } from '../types';
import { DbService } from '../services/db';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface PortalAppProps {
  realProperties?: Imovel[];
  initialPropertyId?: string | null;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
}

export function PortalApp({
  realProperties,
  initialPropertyId = null,
  isLoggedIn = false,
  onOpenAuth,
}: PortalAppProps) {
  // Estado local dos imóveis reais carregados
  const [internalList, setInternalList] = useState<Imovel[]>(() => {
    if (realProperties && realProperties.length > 0) return realProperties;
    return DbService.getImoveisSync();
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const hasProps = Boolean(realProperties && realProperties.length > 0);
    const hasSync = DbService.getImoveisSync().length > 0;
    return !hasProps && !hasSync;
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  // Sincroniza se realProperties vier via props
  useEffect(() => {
    if (realProperties && realProperties.length > 0) {
      setInternalList(realProperties);
      setIsLoading(false);
      setLoadError(null);
    }
  }, [realProperties]);

  // Carregamento e subscrição reativa à base de dados real
  const [paginationInfo, setPaginationInfo] = useState(() => DbService.getPaginationInfo());
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (loadingMore || !paginationInfo.hasMore) return;
    setLoadingMore(true);
    try {
      await DbService.loadMoreImoveis();
      setPaginationInfo(DbService.getPaginationInfo());
    } catch (err) {
      console.error('[PortalApp] Erro ao carregar mais imóveis:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchRealProperties = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await DbService.getImoveis({ page: 1, limit: 24 });
      setInternalList(data);
      setPaginationInfo(DbService.getPaginationInfo());
    } catch (err: any) {
      console.error('[PortalApp] Erro ao carregar imóveis reais:', err);
      setLoadError('Não foi possível carregar os imóveis no momento. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Se ainda não temos imóveis carregados, busca da API
    if (internalList.length === 0) {
      fetchRealProperties();
    }

    // Escuta atualizações no banco de dados em tempo real
    const unsubscribe = DbService.subscribe(() => {
      if (isMounted) {
        const updated = DbService.getImoveisSync();
        if (updated.length > 0) {
          setInternalList(updated);
          setPaginationInfo(DbService.getPaginationInfo());
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Mapeamento estrito: APENAS imóveis reais existentes no ImobiShare, sem nenhum dado fictício
  const properties = useMemo<PortalProperty[]>(() => {
    // Filtra imóveis visíveis no portal público:
    // - Somente visíveis no website público (se houver marcação website/compartilhar)
    const validRealProperties = internalList.filter((p) => {
      const pAny = p as any;
      if (p.website === 'NAO' || pAny.website === false) return false;
      if (p.compartilhar === 'NAO' || pAny.compartilhar === false) return false;
      if (pAny.visibilidade === 'meus') return false;
      if (pAny.statusImovel === 'Vendido') return false;
      return true;
    });

    return validRealProperties.map((p): PortalProperty => {
      const pAny = p as any;
      const valorNum =
        typeof p.valorVenda === 'number' && p.valorVenda > 0
          ? p.valorVenda
          : (typeof p.valor === 'number' ? p.valor : (p.valor ? Number(p.valor) : 0));

      const metragemNum =
        typeof p.metragem === 'number' && p.metragem > 0
          ? p.metragem
          : (pAny.areaPrivativa ? Number(pAny.areaPrivativa) : undefined);

      const areaTotalNum = p.areaTotal ? Number(p.areaTotal) : undefined;

      const lat =
        typeof p.latitude === 'number' && !isNaN(p.latitude) && p.latitude !== 0
          ? p.latitude
          : (p.latitude && !isNaN(Number(p.latitude)) && Number(p.latitude) !== 0
              ? Number(p.latitude)
              : undefined);

      const lng =
        typeof p.longitude === 'number' && !isNaN(p.longitude) && p.longitude !== 0
          ? p.longitude
          : (p.longitude && !isNaN(Number(p.longitude)) && Number(p.longitude) !== 0
              ? Number(p.longitude)
              : undefined);

      const isLancamento = p.statusImovel === 'Na planta' || pAny.isLancamento === true;

      // Construtora: somente quando existir e for válida
      const construtoraLimpa =
        p.construtora &&
        p.construtora.trim() !== '' &&
        !p.construtora.toLowerCase().includes('não informada')
          ? p.construtora.trim()
          : undefined;

      // Nome do edifício / empreendimento
      const nomeEdificioLimpo =
        p.nomeEdificio && p.nomeEdificio.trim() !== '' ? p.nomeEdificio.trim() : undefined;

      const dorms =
        typeof p.dormitorios === 'number' && p.dormitorios > 0
          ? p.dormitorios
          : (typeof p.quartos === 'number' && p.quartos > 0 ? p.quartos : undefined);

      const vagasNum = typeof p.vagas === 'number' && p.vagas > 0 ? p.vagas : undefined;
      const banheirosNum = typeof p.banheiros === 'number' && p.banheiros > 0 ? p.banheiros : undefined;
      const suitesNum =
        typeof pAny.suites === 'number' && pAny.suites > 0 ? pAny.suites : undefined;

      const condNum =
        typeof p.condominio === 'number' && p.condominio > 0
          ? p.condominio
          : (typeof pAny.condominio === 'number' && pAny.condominio > 0 ? pAny.condominio : undefined);

      const iptuNum =
        typeof p.iptu === 'number' && p.iptu > 0
          ? p.iptu
          : (typeof pAny.iptu === 'number' && pAny.iptu > 0 ? pAny.iptu : undefined);

      // Fotos: extrai array real
      let fotosArr: string[] = [];
      if (Array.isArray(p.fotos) && p.fotos.length > 0) {
        fotosArr = p.fotos;
      } else if (pAny.imagens) {
        try {
          fotosArr = typeof pAny.imagens === 'string' ? JSON.parse(pAny.imagens) : pAny.imagens;
        } catch {
          fotosArr = [];
        }
      }

      const status = p.statusImovel || 'Sem mobília';

      return {
        ...p,
        id: p.id,
        codigo: p.codigo || p.id,
        titulo: p.titulo || nomeEdificioLimpo || 'Imóvel em ' + (p.cidade || 'Balneário Camboriú'),
        nomeEdificio: nomeEdificioLimpo,
        construtora: construtoraLimpa,
        tipoImovel: p.tipoImovel || 'Apartamento',
        statusImovel: status,
        tipo: p.tipo || 'venda',
        valor: valorNum,
        metragem: metragemNum,
        areaTotal: areaTotalNum,
        dormitorios: dorms,
        quartos: dorms,
        banheiros: banheirosNum,
        vagas: vagasNum,
        suites: suitesNum,
        condominio: condNum,
        iptu: iptuNum,
        condominioFormatado: condNum ? `R$ ${condNum.toLocaleString('pt-BR')} / mês` : undefined,
        iptuFormatado: iptuNum ? `R$ ${iptuNum.toLocaleString('pt-BR')} / ano` : undefined,
        isLancamento,
        cidade: p.cidade ? p.cidade.trim() : 'Balneário Camboriú',
        bairro: p.bairro ? p.bairro.trim() : '',
        endereco: p.endereco ? p.endereco.trim() : (p.localizacao ? p.localizacao.trim() : ''),
        latitude: lat,
        longitude: lng,
        fotos: fotosArr,
        descricao: p.descricao || '',
        dataCadastro: p.dataCadastro,
        dataPublicacao: p.dataCadastro
          ? new Date(p.dataCadastro).toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : undefined,
        corretorNome: p.corretorNome,
        corretorEmail: p.corretorEmail,
      };
    });
  }, [internalList]);

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

  // Sincroniza com rota / hash da URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#imovel/')) {
        const id = hash.replace('#imovel/', '');
        setSelectedPropertyId(id);
      } else if (hash === '' || hash === '#portal' || hash === '#' || hash === '#home') {
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
    if (window.history.length > 1 && window.location.hash.startsWith('#imovel/')) {
      window.history.back();
    } else {
      window.location.hash = '#busca';
    }
  };

  const handleGoHome = () => {
    setSelectedPropertyId(null);
    window.location.hash = '#home';
  };

  // Encontra o imóvel ativo para a página de detalhes
  const activeProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => p.id === selectedPropertyId) || null;
  }, [selectedPropertyId, properties]);

  // Se houver erro de carregamento e nenhum imóvel em cache
  if (loadError && properties.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-xs">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Erro ao carregar os imóveis</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">{loadError}</p>
        <button
          type="button"
          onClick={fetchRealProperties}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#003366] text-white text-sm font-bold shadow-md hover:bg-[#002244] transition-all cursor-pointer"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      </div>
    );
  }

  // Estado CARREGANDO: indicador elegante e discreto
  if (isLoading && properties.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Loader2 size={24} className="animate-spin text-[#003366]" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Carregando imóveis...</h2>
        <p className="text-xs text-slate-400 mt-1">Conectando à base do ImobiShare</p>
      </div>
    );
  }

  return (
    <>
      <div className={activeProperty ? 'hidden' : 'contents'}>
        <PortalSearchPage
          properties={properties}
          favorites={favorites}
          isLoggedIn={isLoggedIn}
          hasMore={paginationInfo.hasMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
          initialMobileViewMode={openedFromMap ? 'map' : undefined}
          initialSelectedPinId={lastSelectedPinId}
          openedFromMap={openedFromMap}
          onGoHome={handleGoHome}
          onToggleFavorite={handleToggleFavorite}
          onSelectProperty={handleSelectProperty}
          onOpenAuth={onOpenAuth}
        />
      </div>

      {activeProperty && (
        <PortalPropertyDetailPage
          imovel={activeProperty}
          isFavorite={favorites.includes(activeProperty.id)}
          fromMap={openedFromMap}
          onToggleFavorite={handleToggleFavorite}
          onClose={handleCloseDetail}
          onGoHome={handleGoHome}
        />
      )}
    </>
  );
}
