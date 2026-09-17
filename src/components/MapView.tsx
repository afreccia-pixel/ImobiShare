/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Imovel } from '../types';
import { MapPin, Bed, Car, Maximize, Check, X } from 'lucide-react';
import { getValidImage } from '../utils/imageUtils';
import { getCoordinatesForImovel } from '../utils/geoUtils';
import { safePatchLeaflet } from '../utils/leafletPatch';

interface MapViewProps {
  imoveis: (Imovel | any)[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onViewDetails: (id: string) => void;
  isFullScreen?: boolean;
  onClusterChange?: (hasCluster: boolean) => void;
  loading?: boolean;
}

interface ImovelWithCoords extends Imovel {
  resolvedLat: number;
  resolvedLng: number;
}

interface MapClusterItem {
  id: string;
  lat: number;
  lng: number;
  items: ImovelWithCoords[];
}

/**
 * Formata o preço do imóvel para exibição compacta no mapa (mesmo padrão do portal: "1,8 mi", "850 mil")
 */
function formatMapPrice(val?: number): string {
  if (!val || val <= 0) return 'Consulte';
  if (val >= 1000000) {
    const mi = val / 1000000;
    const formatted = mi.toFixed(1).replace('.', ',');
    return `${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted} mi`;
  }
  if (val >= 1000) {
    const mil = Math.round(val / 1000);
    return `${mil} mil`;
  }
  return `${val.toLocaleString('pt-BR')}`;
}

/**
 * Agrupa imóveis baseado na distância em pixels na tela (mesmo sistema de clustering do portal)
 */
function computeClusters(
  imoveis: ImovelWithCoords[],
  map: L.Map,
  clusterRadiusPixels: number = 65,
  maxClusterZoom: number = 16
): MapClusterItem[] {
  const currentZoom = map.getZoom();

  // Em zoom alto (16+), desativa agrupamento e exibe todos individualmente
  if (currentZoom >= maxClusterZoom) {
    return imoveis.map((item) => ({
      id: `single-${item.id}`,
      lat: item.resolvedLat,
      lng: item.resolvedLng,
      items: [item],
    }));
  }

  const clusters: MapClusterItem[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < imoveis.length; i++) {
    const item = imoveis[i];
    if (visited.has(item.id)) continue;

    const lat1 = item.resolvedLat;
    const lng1 = item.resolvedLng;
    let p1: L.Point;
    try {
      p1 = map.latLngToLayerPoint([lat1, lng1]);
    } catch {
      continue;
    }

    const clusterItems: ImovelWithCoords[] = [item];
    visited.add(item.id);

    let sumLat = lat1;
    let sumLng = lng1;

    for (let j = i + 1; j < imoveis.length; j++) {
      const other = imoveis[j];
      if (visited.has(other.id)) continue;

      const lat2 = other.resolvedLat;
      const lng2 = other.resolvedLng;
      let p2: L.Point;
      try {
        p2 = map.latLngToLayerPoint([lat2, lng2]);
      } catch {
        continue;
      }

      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < clusterRadiusPixels) {
        visited.add(other.id);
        clusterItems.push(other);
        sumLat += lat2;
        sumLng += lng2;
      }
    }

    clusters.push({
      id: clusterItems.length === 1 ? `single-${item.id}` : `cluster-${clusters.length}-${item.id}`,
      lat: sumLat / clusterItems.length,
      lng: sumLng / clusterItems.length,
      items: clusterItems,
    });
  }

  return clusters;
}

export function MapView({
  imoveis,
  selectedIds,
  onSelectToggle,
  onViewDetails,
  isFullScreen = false,
  onClusterChange,
  loading = false,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [mapReady, setMapReady] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<MapClusterItem | null>(null);

  // Normaliza lista garantindo coordenadas válidas e determinísticas para todos os imóveis
  const imoveisWithCoords = useMemo<ImovelWithCoords[]>(() => {
    return imoveis.map((item, idx) => {
      const coords = getCoordinatesForImovel(item, idx);
      return {
        ...item,
        resolvedLat: coords[0],
        resolvedLng: coords[1],
      };
    });
  }, [imoveis]);

  // Formata preço para os cards de visualização do corretor
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Renderiza marcadores no mesmo sistema visual do Portal
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group || !mapReady) return;

    group.clearLayers();

    const clusters = computeClusters(imoveisWithCoords, map, 65, 16);

    clusters.forEach((cluster) => {
      if (cluster.items.length === 1) {
        // Marcador individual com preço formatado (mesmo estilo do portal)
        const imovel = cluster.items[0];
        const rawPrice = imovel.valor || imovel.valorVenda || imovel.valorLocacao || 0;
        const precoBadge = formatMapPrice(rawPrice);
        const isSelected = selectedIds.includes(imovel.id);

        const markerHtml = `
          <div 
            id="corretor-marker-${imovel.id}"
            class="portal-property-marker cursor-pointer select-none"
            style="
              background: ${isSelected ? '#003366' : '#ffffff'};
              color: ${isSelected ? '#ffffff' : '#003366'};
              border: none !important;
              outline: none !important;
              padding: 6px 10px;
              height: 30px;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 11.5px;
              font-weight: 800;
              letter-spacing: -0.01em;
              white-space: nowrap;
              box-shadow: ${isSelected ? '0 4px 16px rgba(0, 51, 102, 0.45)' : '0 3px 12px rgba(0,0,0,0.18)'};
              transform: translate(-50%, -50%) scale(${isSelected ? 1.08 : 1});
              transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              z-index: ${isSelected ? 30 : 10};
            "
            title="${imovel.nomeEdificio?.trim() || imovel.titulo} - ${precoBadge}"
          >
            <span>${precoBadge}</span>
            ${isSelected ? '<span style="margin-left:4px; font-size:10px;">✓</span>' : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-div-icon',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([cluster.lat, cluster.lng], { icon: customIcon });

        // Ao clicar: centraliza suavemente e exibe o card inferior com as características do corretor
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          map.panTo([cluster.lat, cluster.lng], { animate: true, duration: 0.35 });
          setSelectedCluster(cluster);
        });

        // Duplo clique abre direto os detalhes completos
        marker.on('dblclick', (e) => {
          L.DomEvent.stopPropagation(e);
          onViewDetails(imovel.id);
        });

        marker.addTo(group);
      } else {
        // Agrupamento (Cluster) no mesmo sistema visual do Portal
        const count = cluster.items.length;
        const hasSelected = cluster.items.some((i) => selectedIds.includes(i.id));

        const clusterHtml = `
          <div 
            id="corretor-cluster-${cluster.id}"
            class="portal-cluster-badge group cursor-pointer select-none"
            style="
              transform: translate(-50%, -50%);
              position: relative;
              z-index: 20;
            "
            title="${count} imóveis nesta região. Clique para aproximar ou ver opções."
          >
            <div style="
              min-width: 42px;
              height: 42px;
              padding: 0 10px;
              border-radius: 9999px;
              background: #ffffff;
              color: #003366;
              border: none !important;
              outline: none !important;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.20);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-weight: 900;
              font-size: 14px;
              letter-spacing: -0.02em;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            ">
              <span>${count}</span>
            </div>
            ${
              hasSelected
                ? `<div style="position:absolute; top:-2px; right:-2px; width:14px; height:14px; background:#003366; border:2px solid #ffffff; border-radius:9999px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.3); font-size:8px; font-weight:bold; color:white;">✓</div>`
                : ''
            }
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: 'custom-div-cluster-icon',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon });

        // Ao clicar no cluster: aproxima a visão para abrir os imóveis (como no portal) E abre o carrossel inferior com as características do corretor
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);

          const bounds = L.latLngBounds(cluster.items.map((p) => [p.resolvedLat, p.resolvedLng]));

          if (map.getZoom() < 16) {
            if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
              map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 17), {
                animate: true,
              });
            } else {
              map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 16,
                animate: true,
              });
            }
          } else {
            map.panTo([cluster.lat, cluster.lng], { animate: true, duration: 0.35 });
          }

          setSelectedCluster(cluster);
        });

        marker.addTo(group);
      }
    });
  }, [imoveisWithCoords, mapReady, selectedIds, onViewDetails]);

  // Inicializa mapa usando o mesmo sistema de carregamento (CartoDB Voyager)
  useEffect(() => {
    safePatchLeaflet(L);

    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const defaultCenter: [number, number] = [-26.9924, -48.6341];
    let map: L.Map;

    try {
      map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('[MapView] Falha ao inicializar o mapa:', err);
      return;
    }

    // Mesmo mapa limpo estilo CartoDB Voyager do Portal
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Zoom no canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Fecha os cards ao clicar em espaço vazio no mapa
    map.on('click', () => {
      setSelectedCluster(null);
    });

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (map) {
        try {
          map.off();
          if (typeof (map as any)._stop === 'function') {
            (map as any)._stop();
          }
          map.remove();
        } catch (e) {
          console.warn('[MapView] Erro suprimido em map.remove():', e);
        }
      }
      mapInstanceRef.current = null;
      markersGroupRef.current = null;
      setMapReady(false);
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // ResizeObserver para manter o mapa sempre fluido em mudanças de viewport
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

  // Recalcula agrupamentos e enquadramento quando os imóveis mudam ou quando o usuário move/aproxima o mapa
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    renderMarkers();

    // Auto-fitBounds nos imóveis filtrados
    if (imoveisWithCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(
          imoveisWithCoords.map((p) => [p.resolvedLat, p.resolvedLng])
        );
        if (bounds.isValid()) {
          if (imoveisWithCoords.length === 1) {
            map.setView([imoveisWithCoords[0].resolvedLat, imoveisWithCoords[0].resolvedLng], 16, {
              animate: false,
            });
          } else {
            map.fitBounds(bounds, {
              padding: [45, 45],
              maxZoom: 16,
              animate: false,
            });
          }
        }
      } catch (err) {
        console.warn('[MapView] fitBounds warning:', err);
      }
    }

    const onZoomOrMove = () => {
      renderMarkers();
    };

    map.on('zoomend', onZoomOrMove);
    map.on('moveend', onZoomOrMove);

    return () => {
      map.off('zoomend', onZoomOrMove);
      map.off('moveend', onZoomOrMove);
    };
  }, [imoveisWithCoords, mapReady, renderMarkers]);

  // Re-renderiza marcadores quando a seleção mudar
  useEffect(() => {
    renderMarkers();
  }, [selectedIds, renderMarkers]);

  // Sincroniza estado de cluster selecionado com a lista de imóveis
  useEffect(() => {
    if (selectedCluster) {
      const remaining = selectedCluster.items.filter((i) =>
        imoveisWithCoords.some((curr) => curr.id === i.id)
      );
      if (remaining.length === 0) {
        setSelectedCluster(null);
      } else if (remaining.length !== selectedCluster.items.length) {
        setSelectedCluster({
          ...selectedCluster,
          items: remaining,
        });
      }
    }
  }, [imoveisWithCoords]);

  // Sincroniza carousel e notifica App.tsx para posicionamento de botões flutuantes
  useEffect(() => {
    if (selectedCluster && carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
    onClusterChange?.(Boolean(selectedCluster));
  }, [selectedCluster, onClusterChange]);

  // Limita a exibição a no máximo 10 imóveis no carrossel inferior do corretor
  const displayedImoveis = selectedCluster ? selectedCluster.items.slice(0, 10) : [];

  return (
    <div
      className={
        isFullScreen
          ? 'relative w-full h-full overflow-hidden bg-slate-100'
          : 'relative rounded-2xl border border-slate-100 overflow-hidden shadow-xs bg-slate-100'
      }
      id="corretor-map-wrapper"
    >
      {/* Container Leaflet */}
      <div
        ref={mapContainerRef}
        className={isFullScreen ? 'w-full h-full min-h-[400px] z-0' : 'w-full h-[380px] z-0'}
        id="interactive-leaflet-map"
      />

      {/* Indicador de carregamento de marcadores (idêntico ao portal) */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 z-30 overflow-hidden pointer-events-none">
          <div className="h-full bg-blue-600 animate-pulse w-full" />
        </div>
      )}

      {/* CARDS ROLANTES COM AS CARACTERÍSTICAS DE VISUALIZAÇÃO DO CORRETOR */}
      {selectedCluster && displayedImoveis.length > 0 && (
        <div
          className="absolute bottom-16 sm:bottom-18 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200"
          id="cluster-scrollable-cards-drawer"
        >
          {/* Header com contador de imóveis e botão fechar */}
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-extrabold text-slate-800 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full shadow-xs border border-slate-200/80">
              {selectedCluster.items.length === 1
                ? '1 imóvel selecionado'
                : `${selectedCluster.items.length} imóveis neste local`}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCluster(null)}
              className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-md text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-xs border border-slate-200 cursor-pointer active:scale-95"
              title="Fechar"
            >
              <X size={13} />
            </button>
          </div>

          {/* Carrossel horizontal de cards */}
          <div
            ref={carouselRef}
            className="flex gap-3 overflow-x-auto snap-x py-1 px-1 scrollbar-none overscroll-x-contain items-stretch"
          >
            {displayedImoveis.map((imovel) => {
              const isSelected = selectedIds.includes(imovel.id);
              const price = imovel.valor || imovel.valorVenda || imovel.valorLocacao || 0;
              const photo = getValidImage(imovel.fotos?.[0]);

              return (
                <div
                  key={imovel.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Mantém a característica exata do corretor: abre a visualização completa
                    onViewDetails(imovel.id);
                  }}
                  className={`w-[190px] sm:w-[210px] shrink-0 snap-start bg-white rounded-2xl border ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-600/30' : 'border-slate-200 hover:border-slate-300'
                  } shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col group active:scale-[0.98] select-none`}
                  title="Clique para abrir as informações completas do imóvel"
                >
                  {/* Imagem vertical */}
                  <div className="relative h-48 sm:h-52 bg-slate-100 overflow-hidden">
                    <img
                      src={photo}
                      alt={imovel.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />

                    {/* Badge Venda / Locação */}
                    <span className="absolute top-2.5 left-2.5 text-[9px] font-extrabold bg-slate-900/85 backdrop-blur-md text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      {imovel.tipo === 'locação' ? 'Locação' : 'Venda'}
                    </span>

                    {/* Botão de seleção rápida */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectToggle(imovel.id);
                      }}
                      className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-white'
                          : 'bg-black/40 text-white/80 border-white/40 hover:bg-black/60'
                      }`}
                      title={isSelected ? 'Desmarcar' : 'Selecionar'}
                    >
                      <Check size={12} className={isSelected ? 'stroke-[3]' : 'stroke-[2]'} />
                    </button>

                    {/* Preço sobre a imagem */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                      <div className="text-sm sm:text-base font-black tracking-tight drop-shadow-md">
                        {formatPrice(price)}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes do imóvel com as características do corretor */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5 bg-white">
                    <div>
                      <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase truncate">
                        <MapPin size={10} className="mr-0.5 shrink-0 text-slate-400" />
                        <span className="truncate">{imovel.bairro || imovel.cidade || 'Localização'}</span>
                      </div>
                      <h4
                        className="font-extrabold text-slate-800 text-xs truncate leading-snug mt-0.5"
                        title={imovel.nomeEdificio?.trim() || imovel.titulo}
                      >
                        {imovel.nomeEdificio?.trim() || imovel.titulo}
                      </h4>
                    </div>

                    {/* Especificações */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-1.5">
                      {imovel.dormitorios !== undefined && imovel.dormitorios > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Bed size={11} className="text-slate-400" />
                          {imovel.dormitorios} qts
                        </span>
                      )}
                      {imovel.vagas !== undefined && imovel.vagas > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Car size={11} className="text-slate-400" />
                          {imovel.vagas} vg
                        </span>
                      )}
                      {imovel.metragem !== undefined && imovel.metragem > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Maximize size={11} className="text-slate-400" />
                          {imovel.metragem}m²
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
