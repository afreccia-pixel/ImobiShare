/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Imovel } from '../types';
import { MapPin, Bed, Car, Maximize } from 'lucide-react';
import { getValidImage } from '../utils/imageUtils';
import { getCoordinatesForImovel } from '../utils/geoUtils';
import { safePatchLeaflet } from '../utils/leafletPatch';

interface MapViewProps {
  imoveis: Imovel[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onViewDetails: (id: string) => void;
  isFullScreen?: boolean;
  onClusterChange?: (hasCluster: boolean) => void;
}

interface MapCluster {
  id: string;
  center: [number, number];
  imoveis: Imovel[];
  totalCount: number;
}

export function MapView({ imoveis, selectedIds, onSelectToggle, onViewDetails, isFullScreen = false, onClusterChange }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<MapCluster | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(13);

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ResizeObserver to ensure Leaflet renders full tiles when resizing or going full screen
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

  // Initialize Map Instance on Container Mount
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    safePatchLeaflet(L);

    // Clean up previous container footprint if any
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    let initialCenter: [number, number] = [-26.9924, -48.6341];
    if (imoveis.length > 0) {
      initialCenter = getCoordinatesForImovel(imoveis[0], 0);
    }

    try {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
        fadeAnimation: false,
      }).setView(initialCenter, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      layerGroupRef.current = layerGroup;
      setMapReady(true);
      setCurrentZoom(map.getZoom());

      // Close open cluster cards when clicking empty space on map
      map.on('click', () => {
        setSelectedCluster(null);
      });

      // Track zoom level changes
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });
    } catch (err) {
      console.warn('Error initializing map:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error during map cleanup:', e);
        }
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Compute zoom-dependent clusters
  const computeClusters = useCallback((map: L.Map, imoveisList: Imovel[]): MapCluster[] => {
    const zoom = map.getZoom();
    // Clustering radius in pixels: smaller radius at higher zoom to reveal specific areas
    const pixelRadius = zoom >= 17 ? 22 : zoom >= 15 ? 34 : zoom >= 13 ? 46 : 56;

    const clusters: {
      id: string;
      center: [number, number];
      pixelCenter: L.Point;
      imoveis: Imovel[];
    }[] = [];

    imoveisList.forEach((imovel, index) => {
      const coords = getCoordinatesForImovel(imovel, index);
      const latLng = L.latLng(coords[0], coords[1]);
      const pt = map.project(latLng, zoom);

      // Search for an existing cluster within pixel radius
      let bestClusterIndex = -1;
      let minDistance = pixelRadius;

      for (let i = 0; i < clusters.length; i++) {
        const dist = clusters[i].pixelCenter.distanceTo(pt);
        if (dist < minDistance) {
          minDistance = dist;
          bestClusterIndex = i;
        }
      }

      if (bestClusterIndex >= 0) {
        const c = clusters[bestClusterIndex];
        c.imoveis.push(imovel);

        // Update cluster center as weighted average
        const count = c.imoveis.length;
        c.center = [
          (c.center[0] * (count - 1) + coords[0]) / count,
          (c.center[1] * (count - 1) + coords[1]) / count,
        ];
        c.pixelCenter = map.project(L.latLng(c.center[0], c.center[1]), zoom);
      } else {
        clusters.push({
          id: `cluster-${clusters.length}-${imovel.id}`,
          center: [coords[0], coords[1]],
          pixelCenter: pt,
          imoveis: [imovel],
        });
      }
    });

    return clusters.map((c) => ({
      id: c.id,
      center: c.center,
      imoveis: c.imoveis,
      totalCount: c.imoveis.length,
    }));
  }, []);

  // Create customized HTML icon for cluster (White background, dark bold text)
  const createClusterIcon = useCallback((cluster: MapCluster, hasSelected: boolean) => {
    // Sizing based on count
    const size = cluster.totalCount >= 100 ? 44 : cluster.totalCount >= 10 ? 38 : 34;
    const fontSize = cluster.totalCount >= 100 ? '11px' : cluster.totalCount >= 10 ? '12px' : '13px';

    const selectedBadge = hasSelected
      ? `<div style="position:absolute; top:-3px; right:-3px; width:14px; height:14px; background:#2563EB; border:2px solid #ffffff; border-radius:9999px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.3); font-size:8px; font-weight:bold; color:white;">✓</div>`
      : '';

    const html = `
      <div style="position:relative; width:${size}px; height:${size}px; cursor:pointer;" class="cluster-marker-wrapper">
        <div style="background:#ffffff; color:#0f172a; width:${size}px; height:${size}px; border-radius:9999px; border:none; box-shadow:0 3px 12px rgba(0,0,0,0.22); display:flex; align-items:center; justify-content:center; font-family:system-ui, -apple-system, sans-serif; font-weight:900; font-size:${fontSize}; transition:transform 0.15s ease;">
          ${cluster.totalCount}
        </div>
        ${selectedBadge}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-cluster-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, []);

  // Update clusters and markers on map
  const renderMarkers = useCallback(() => {
    if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    layerGroup.clearLayers();

    const clusters = computeClusters(map, imoveis);
    const newMarkers: L.Marker[] = [];

    clusters.forEach((cluster) => {
      const hasSelected = cluster.imoveis.some((im) => selectedIds.includes(im.id));
      const icon = createClusterIcon(cluster, hasSelected);
      const marker = L.marker(cluster.center, { icon });

      // Click on cluster icon -> Aproxima a visualização para ter no máximo 10 imóveis e abre os cards
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (cluster.totalCount > 10 && map.getZoom() < 18) {
          // Aproxima para desagrupar e refinar a região
          const nextZoom = Math.min(map.getZoom() + 2, 18);
          map.setView(cluster.center, nextZoom, { animate: true });
        } else {
          map.panTo(cluster.center, { animate: true, duration: 0.35 });
        }
        setSelectedCluster(cluster);
      });

      // Double-click to zoom in quickly
      marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        map.setView(cluster.center, Math.min(map.getZoom() + 2, 18), { animate: true });
      });

      layerGroup.addLayer(marker);
      newMarkers.push(marker);
    });

    return newMarkers;
  }, [mapReady, imoveis, selectedIds, computeClusters, createClusterIcon]);

  // Initial bounds fit and re-clustering
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const markers = renderMarkers();

    // Auto-fit bounds on initial load if markers exist
    if (markers && markers.length > 0) {
      try {
        const group = L.featureGroup(markers);
        const bounds = group.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
        }
      } catch (err) {
        console.warn('fitBounds warning:', err);
      }
    }

    // Recalculate clusters whenever map zoom or move finishes
    const handleMoveOrZoom = () => {
      renderMarkers();
    };

    const handleMapClick = () => {
      setSelectedCluster(null);
    };

    map.on('zoomend', handleMoveOrZoom);
    map.on('moveend', handleMoveOrZoom);
    map.on('click', handleMapClick);

    // Invalidate map size to ensure tiles render properly
    map.invalidateSize();
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 150);

    return () => {
      clearTimeout(t);
      map.off('zoomend', handleMoveOrZoom);
      map.off('moveend', handleMoveOrZoom);
      map.off('click', handleMapClick);
    };
  }, [mapReady, imoveis, renderMarkers]);

  // Re-render markers if selection changes without resetting view
  useEffect(() => {
    renderMarkers();
  }, [selectedIds, renderMarkers]);

  // Sync selected cluster if imoveis list changes
  useEffect(() => {
    if (selectedCluster) {
      const remaining = selectedCluster.imoveis.filter((i) => imoveis.some((curr) => curr.id === i.id));
      if (remaining.length === 0) {
        setSelectedCluster(null);
      } else if (remaining.length !== selectedCluster.imoveis.length) {
        setSelectedCluster({
          ...selectedCluster,
          imoveis: remaining,
          totalCount: remaining.length,
        });
      }
    }
  }, [imoveis]);

  // Reset horizontal carousel scroll when cluster changes
  useEffect(() => {
    if (selectedCluster && carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
    onClusterChange?.(Boolean(selectedCluster));
  }, [selectedCluster, onClusterChange]);

  // Limit to a maximum of 10 properties in the carousel
  const displayedImoveis = selectedCluster ? selectedCluster.imoveis.slice(0, 10) : [];

  return (
    <div className={isFullScreen ? "relative w-full h-full overflow-hidden" : "relative rounded-2xl border border-slate-100 overflow-hidden shadow-sm"}>
      {/* Leaflet Map Canvas */}
      <div 
        ref={mapContainerRef} 
        className={isFullScreen ? "w-full h-full min-h-[400px] z-0" : "w-full h-[380px] z-0"} 
        id="interactive-leaflet-map"
      />

      {/* SCROLLABLE CARDS (Cards rolantes com imagem vertical, máximo 10 imóveis, clique para ver detalhes completos) */}
      {selectedCluster && displayedImoveis.length > 0 && (
        <div 
          className="absolute bottom-4 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-auto"
          id="cluster-scrollable-cards-drawer"
        >
          {/* Horizontal Scrollable Carousel */}
          <div 
            ref={carouselRef}
            className="flex gap-3 overflow-x-auto snap-x py-2 px-1 scrollbar-none overscroll-x-contain items-stretch"
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
                    onViewDetails(imovel.id);
                  }}
                  className={`w-[190px] sm:w-[210px] shrink-0 snap-start bg-white rounded-2xl border ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-600/30' : 'border-slate-200 hover:border-slate-300'
                  } shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col group active:scale-[0.98] select-none`}
                  title="Clique para abrir as informações completas do imóvel"
                >
                  {/* Vertical Image */}
                  <div className="relative h-48 sm:h-52 bg-slate-100 overflow-hidden">
                    <img
                      src={photo}
                      alt={imovel.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

                    {/* Type badge (Venda / Locação) */}
                    <span className="absolute top-2.5 left-2.5 text-[9px] font-extrabold bg-slate-900/85 backdrop-blur-md text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      {imovel.tipo === 'locação' ? 'Locação' : 'Venda'}
                    </span>

                    {/* Price over the bottom part of the vertical image */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                      <div className="text-sm sm:text-base font-black tracking-tight drop-shadow-md">
                        {formatPrice(price)}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5 bg-white">
                    <div>
                      <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase truncate">
                        <MapPin size={10} className="mr-0.5 shrink-0 text-slate-400" />
                        <span className="truncate">{imovel.bairro || imovel.cidade || 'Localização'}</span>
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-xs truncate leading-snug mt-0.5" title={imovel.nomeEdificio?.trim() || imovel.titulo}>
                        {imovel.nomeEdificio?.trim() || imovel.titulo}
                      </h4>
                    </div>

                    {/* Specs */}
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
