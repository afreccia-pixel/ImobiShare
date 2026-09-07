/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PortalProperty } from '../types';
import { RefreshCw } from 'lucide-react';
import { safePatchLeaflet } from '../../utils/leafletPatch';

interface PortalMapProps {
  imoveis: PortalProperty[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onSearchInArea?: () => void;
}

interface ClusterGroup {
  id: string;
  lat: number;
  lng: number;
  items: PortalProperty[];
}

/**
 * Agrupa imóveis baseado na distância em pixels na tela (clustering dinâmico).
 * Conforme o usuário aproxima (zoom in), os agrupamentos diminuem até exibirem
 * os imóveis individualmente com o badge de valor conforme a visualização padrão.
 */
function computeClusters(
  imoveis: PortalProperty[],
  map: L.Map,
  clusterRadiusPixels: number = 65,
  maxClusterZoom: number = 16
): ClusterGroup[] {
  const currentZoom = map.getZoom();

  // Em zoom alto (16+), desativa agrupamento e exibe todos individualmente
  if (currentZoom >= maxClusterZoom) {
    return imoveis.map((item) => ({
      id: `single-${item.id}`,
      lat: item.latitude || -26.9924,
      lng: item.longitude || -48.6341,
      items: [item],
    }));
  }

  const clusters: ClusterGroup[] = [];
  const visited = new Set<string>();

  const validItems = imoveis.filter((p) => typeof (p.latitude || -26.9924) === 'number');

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    if (visited.has(item.id)) continue;

    const lat1 = item.latitude || -26.9924;
    const lng1 = item.longitude || -48.6341;
    let p1: L.Point;
    try {
      p1 = map.latLngToLayerPoint([lat1, lng1]);
    } catch {
      continue;
    }

    const clusterItems: PortalProperty[] = [item];
    visited.add(item.id);

    let sumLat = lat1;
    let sumLng = lng1;

    for (let j = i + 1; j < validItems.length; j++) {
      const other = validItems[j];
      if (visited.has(other.id)) continue;

      const lat2 = other.latitude || -26.9924;
      const lng2 = other.longitude || -48.6341;
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

export function PortalMap({
  imoveis,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  onSearchInArea,
}: PortalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const isUserInteractingRef = useRef<boolean>(false);

  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);

  // Renderiza marcadores (agrupados por região ou individuais com preço)
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const clusters = computeClusters(imoveis, map, 65, 16);

    clusters.forEach((cluster) => {
      if (cluster.items.length === 1) {
        // Marcador individual: mostra quantidade 1 em fundo branco sem borda
        const imovel = cluster.items[0];

        const markerHtml = `
          <div 
            id="marker-${imovel.id}"
            class="portal-property-marker"
            style="
              background: #ffffff;
              color: #003366;
              border: none !important;
              outline: none !important;
              width: 36px;
              height: 36px;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 13px;
              font-weight: 800;
              white-space: nowrap;
              cursor: pointer;
              box-shadow: 0 4px 14px rgba(0,0,0,0.18);
              transform: translate(-50%, -50%) scale(1);
              transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              z-index: 10;
            "
            title="${imovel.titulo} (1 imóvel)"
          >
            <span>1</span>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-div-icon',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([cluster.lat, cluster.lng], { icon: customIcon });

        marker.on('mouseover', () => {
          onHover(imovel.id);
        });

        marker.on('mouseout', () => {
          onHover(null);
        });

        marker.on('click', () => {
          onSelect(imovel.id);
        });

        marker.addTo(group);
      } else {
        // Agrupamento: mostra apenas a quantidade de imóveis na região em fundo branco sem borda
        const count = cluster.items.length;
        const clusterHtml = `
          <div 
            id="cluster-${cluster.id}"
            class="portal-cluster-badge group"
            style="
              transform: translate(-50%, -50%);
              cursor: pointer;
              position: relative;
              z-index: 20;
            "
            title="${count} imóveis nesta região. Clique para aproximar."
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
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: 'custom-div-cluster-icon',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon });

        marker.on('click', () => {
          const bounds = L.latLngBounds(
            cluster.items.map((p) => [p.latitude || -26.9924, p.longitude || -48.6341])
          );

          if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 18), {
              animate: true,
            });
          } else {
            map.fitBounds(bounds, {
              padding: [60, 60],
              maxZoom: 17,
              animate: true,
            });
          }
        });

        marker.addTo(group);
      }
    });
  }, [imoveis, onHover, onSelect]);

  // Inicializa mapa apenas uma vez
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
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('[PortalMap] Falha ao inicializar o mapa:', err);
      return;
    }

    // Camada limpa estilo CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Controle de zoom no canto inferior direito
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Detecta interação do usuário para mostrar botão de busca na área
    const onMoveStart = () => {
      isUserInteractingRef.current = true;
    };

    const onMoveEnd = () => {
      if (isUserInteractingRef.current) {
        setShowSearchAreaBtn(true);
      }
    };

    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);

    // Ajusta o tamanho do mapa caso as dimensões mudem
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    }, 200);

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
          console.warn('[PortalMap] Erro suprimido em map.remove():', e);
        }
      }
      mapInstanceRef.current = null;
      markersGroupRef.current = null;
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // ResizeObserver para manter o mapa fluido na transição de tamanho / tela inteira
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
  }, []);

  // Recalcula agrupamentos quando os imóveis mudam ou quando o usuário dá zoom / pan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Renderiza inicialmente
    renderMarkers();

    // Auto-fit inicial caso haja coordenadas e não seja navegação manual
    if (imoveis.length > 0 && !isUserInteractingRef.current) {
      const validCoordinates: [number, number][] = imoveis
        .filter((p) => typeof (p.latitude || -26.9924) === 'number')
        .map((p) => [p.latitude || -26.9924, p.longitude || -48.6341]);

      if (validCoordinates.length > 0) {
        try {
          const bounds = L.latLngBounds(validCoordinates);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
        } catch (err) {
          console.warn('[PortalMap] fitBounds error suprimido:', err);
        }
      }
    }

    // Atualiza os clusters conforme o zoom muda ("quando for aproximando vai diminuindo a quantidade...")
    const onZoomOrMove = () => {
      renderMarkers();
    };

    map.on('zoomend', onZoomOrMove);
    map.on('moveend', onZoomOrMove);

    return () => {
      map.off('zoomend', onZoomOrMove);
      map.off('moveend', onZoomOrMove);
    };
  }, [imoveis, renderMarkers]);

  // Centraliza no imóvel selecionado quando retornado do detalhe ou clicado
  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const targetItem = imoveis.find((p) => p.id === selectedId);
    if (targetItem && typeof (targetItem.latitude || -26.9924) === 'number') {
      const lat = targetItem.latitude || -26.9924;
      const lng = targetItem.longitude || -48.6341;
      const map = mapInstanceRef.current;
      const targetZoom = Math.max(map.getZoom(), 16);
      map.setView([lat, lng], targetZoom, { animate: true });
    }
  }, [selectedId, imoveis]);

  // Atualiza estilos visuais dos marcadores ativos (hover / seleção) sem recriar camadas
  useEffect(() => {
    imoveis.forEach((imovel) => {
      const el = document.getElementById(`marker-${imovel.id}`);
      if (!el) return;
      const isActive = hoveredId === imovel.id || selectedId === imovel.id;
      if (isActive) {
        el.classList.add('active');
        el.style.background = '#ffffff';
        el.style.color = '#003366';
        el.style.border = 'none';
        el.style.outline = 'none';
        el.style.boxShadow = '0 8px 24px rgba(0, 51, 102, 0.45)';
        el.style.transform = 'translate(-50%, -50%) scale(1.22)';
        el.style.zIndex = '9999';
      } else {
        el.classList.remove('active');
        el.style.background = '#ffffff';
        el.style.color = '#003366';
        el.style.border = 'none';
        el.style.outline = 'none';
        el.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.18)';
        el.style.transform = 'translate(-50%, -50%) scale(1)';
        el.style.zIndex = '10';
      }
    });
  }, [imoveis, hoveredId, selectedId]);

  const handleSearchThisArea = () => {
    setShowSearchAreaBtn(false);
    isUserInteractingRef.current = false;
    onSearchInArea?.();
  };

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden" id="portal-map-wrapper">
      {/* Container Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Botão flutuante "Buscar nesta área" */}
      {showSearchAreaBtn && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            type="button"
            id="portal-btn-buscar-area"
            onClick={handleSearchThisArea}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 text-xs font-bold rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 hover:border-[#003366] hover:text-[#003366] transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw size={13} className="text-[#003366]" />
            <span>Buscar nesta área</span>
          </button>
        </div>
      )}
    </div>
  );
}
