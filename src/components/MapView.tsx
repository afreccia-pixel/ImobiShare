/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Imovel } from '../types';
import { MapPin } from 'lucide-react';
import { getValidImage } from '../utils/imageUtils';
import { getCoordinatesForImovel } from '../utils/geoUtils';

interface MapViewProps {
  imoveis: Imovel[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onViewDetails: (id: string) => void;
  isFullScreen?: boolean;
}

// Safely patch Leaflet's L.DomUtil.getPosition to prevent Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
function safePatchLeaflet(leafletInstance: any) {
  if (!leafletInstance || !leafletInstance.DomUtil) return;
  if ((leafletInstance.DomUtil as any).__safeLeafletPosPatched) return;
  (leafletInstance.DomUtil as any).__safeLeafletPosPatched = true;

  const originalGetPosition = leafletInstance.DomUtil.getPosition;
  leafletInstance.DomUtil.getPosition = function (el: any) {
    if (!el) {
      return { x: 0, y: 0 };
    }
    try {
      if (originalGetPosition) {
        const pos = originalGetPosition.call(leafletInstance.DomUtil, el);
        return pos || { x: 0, y: 0 };
      }
      return el._leaflet_pos || { x: 0, y: 0 };
    } catch {
      return (el && el._leaflet_pos) || { x: 0, y: 0 };
    }
  };

  const originalSetPosition = leafletInstance.DomUtil.setPosition;
  leafletInstance.DomUtil.setPosition = function (el: any, point: any) {
    if (!el) return;
    try {
      if (originalSetPosition) {
        originalSetPosition.call(leafletInstance.DomUtil, el, point);
      } else {
        el._leaflet_pos = point;
      }
    } catch {
      // ignore
    }
  };
}

export function MapView({ imoveis, selectedIds, onSelectToggle, onViewDetails, isFullScreen = false }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

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

  // Update Markers when imoveis or selectedIds change, and auto-fit bounds
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    // Safely close open popup before changing layers
    try {
      map.closePopup();
    } catch {}

    // Clear existing markers from layer group
    try {
      layerGroup.clearLayers();
    } catch {}

    const newMarkers: L.Marker[] = [];

    // Add new markers
    imoveis.forEach((imovel, index) => {
      const coords = getCoordinates(imovel, index);
      const isSelected = selectedIds.includes(imovel.id);
      const isPortal = Boolean(
        imovel.integrado ||
        (imovel.integracaoOrigem && imovel.integracaoOrigem.trim()) ||
        (imovel.origem && imovel.origem.toLowerCase() !== 'imobishare' && imovel.origem.trim() !== '') ||
        (imovel.origem && (imovel.origem.toLowerCase().includes('dwv') || imovel.origem.toLowerCase().includes('portal')))
      );

      // Custom HTML Marker matching ImobiShare theme
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform">
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-lg ${
            isPortal 
              ? 'bg-amber-500 border-white' 
              : 'bg-[#003366] border-white'
          }">
            <span class="text-[10px] font-black text-white uppercase tracking-tight">
              ${imovel.tipo === 'locação' || (imovel.tipo as string) === 'alugar' ? 'A' : 'V'}
            </span>
          </div>
          ${
            isSelected 
              ? '<div class="absolute -top-1.5 -right-1.5 bg-emerald-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-md"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5 text-white"><polyline points="20 6 9 17 4 12"></polyline></svg></div>' 
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      // Create Popup Content
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-2 max-w-[210px] font-sans select-none';
      popupDiv.innerHTML = `
        <div class="rounded-lg overflow-hidden mb-2 relative bg-slate-100 h-24">
          <img src="${getValidImage(imovel.fotos?.[0])}" class="w-full h-full object-cover" />
          <span class="absolute top-1.5 left-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
            isPortal ? 'bg-amber-500 text-white shadow-xs' : 'bg-[#003366] text-white shadow-xs'
          }">
            ${isPortal ? (imovel.integracaoOrigem || imovel.origem || 'DWV') : 'Rede'}
          </span>
        </div>
        <div class="space-y-1">
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">
            ${imovel.endereco ? `${imovel.endereco} · ` : ''}${imovel.bairro || imovel.cidade || ''}
          </div>
          <h4 class="font-extrabold text-slate-900 text-xs truncate leading-tight">
            ${imovel.nomeEdificio?.trim() || imovel.titulo}
          </h4>
          <div class="pt-1 flex items-center justify-between border-t border-slate-100">
            <span class="text-xs font-black text-[#003366]">
              ${formatPrice(imovel.valor || imovel.valorVenda || imovel.valorLocacao || 0)}
            </span>
          </div>
          <div class="flex gap-1.5 mt-2 pt-1 border-t border-slate-100">
            <button id="pop-view-${imovel.id}" class="flex-1 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer">
              Ver
            </button>
            <button id="pop-select-${imovel.id}" class="flex-1 ${
              isSelected ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#003366] hover:bg-[#002244]'
            } text-white text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer">
              ${isSelected ? '✓ Selecionado' : 'Selecionar'}
            </button>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon });
      marker.bindPopup(popupDiv, { closeButton: false, minWidth: 210, autoPan: false });

      marker.on('popupopen', () => {
        const viewBtn = document.getElementById(`pop-view-${imovel.id}`);
        const selectBtn = document.getElementById(`pop-select-${imovel.id}`);

        if (viewBtn) {
          viewBtn.onclick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              marker.closePopup();
            } catch {}
            onViewDetails(imovel.id);
          };
        }
        if (selectBtn) {
          selectBtn.onclick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              marker.closePopup();
            } catch {}
            onSelectToggle(imovel.id);
          };
        }
      });

      layerGroup.addLayer(marker);
      newMarkers.push(marker);
    });

    // Invalidate map size to adapt to container dimensions
    map.invalidateSize();
    const t1 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 100);
    const t2 = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 350);

    // Auto-fit bounds to all markers
    if (newMarkers.length > 0) {
      try {
        const group = L.featureGroup(newMarkers);
        const bounds = group.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
        }
      } catch (err) {
        console.warn('fitBounds warning:', err);
      }
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady, imoveis, selectedIds, onSelectToggle, onViewDetails]);

  return (
    <div className={isFullScreen ? "relative w-full h-full overflow-hidden" : "relative rounded-2xl border border-slate-100 overflow-hidden shadow-sm"}>
      <div 
        ref={mapContainerRef} 
        className={isFullScreen ? "w-full h-full min-h-[400px] z-0" : "w-full h-[380px] z-0"} 
        id="interactive-leaflet-map"
      />
      {/* Property count and legend overlay */}
      <div className={`absolute ${isFullScreen ? 'bottom-20 left-3' : 'bottom-2 left-2'} bg-slate-900/90 backdrop-blur-xs text-white text-[9px] font-bold px-2.5 py-1 rounded-md z-10 shadow-md flex items-center gap-2.5 select-none pointer-events-none`}>
        <span className="text-white/80">{imoveis.length} no mapa</span>
        <div className="w-px h-2.5 bg-white/30" />
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#003366] border border-white" /> Rede</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 border border-white" /> Integração</span>
      </div>
    </div>
  );
}
