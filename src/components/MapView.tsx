/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Imovel } from '../types';
import { MapPin, Eye, CheckCircle2, Bed, Car, Maximize } from 'lucide-react';

interface MapViewProps {
  imoveis: Imovel[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onViewDetails: (id: string) => void;
}

export function MapView({ imoveis, selectedIds, onSelectToggle, onViewDetails }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  // Load Leaflet resources dynamically from CDN
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load CSS
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load JS
    const scriptId = 'leaflet-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.onload = () => setLeafletLoaded(true);
      script.onerror = () => setLoadingError(true);
      document.body.appendChild(script);
    } else {
      // Script is already in DOM but might be loading
      const interval = setInterval(() => {
        if ((window as any).L) {
          setLeafletLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Assign or get coords helper with offsets
  const getCoordinates = (imovel: Imovel, index: number): [number, number] => {
    if (imovel.latitude && imovel.longitude) {
      return [imovel.latitude, imovel.longitude];
    }
    
    // Fallbacks with systematic offset to avoid overlap
    const angle = (index * 2 * Math.PI) / 8;
    const radius = 0.006; // roughly 600m
    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);

    if (imovel.cidade.toLowerCase().includes('itapema')) {
      return [-27.1351 + dy, -48.6082 + dx];
    }
    return [-26.9924 + dy, -48.6341 + dx];
  };

  // Initialize and update the map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Create Map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Center roughly between Balneário Camboriú and Itapema, or on the first item
      let center: [number, number] = [-26.9924, -48.6341];
      if (imoveis.length > 0) {
        center = getCoordinates(imoveis[0], 0);
      }

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(center, 13);

      // Add Tile Layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    imoveis.forEach((imovel, index) => {
      const coords = getCoordinates(imovel, index);
      const isSelected = selectedIds.includes(imovel.id);

      // Custom HTML Marker matching ImobiShare theme
      const markerHtml = `
        <div class="relative flex items-center justify-center">
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-md transition-all duration-200 ${
            imovel.integrado 
              ? 'bg-amber-500 border-white' 
              : 'bg-[#003366] border-white'
          }">
            <span class="text-[9px] font-black text-white uppercase">
              ${imovel.tipo === 'venda' ? 'V' : 'A'}
            </span>
          </div>
          ${
            isSelected 
              ? '<div class="absolute -top-1.5 -right-1.5 bg-emerald-500 w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center shadow-xs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5 text-white"><polyline points="20 6 9 17 4 12"></polyline></svg></div>' 
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      // Create Popup Content
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1.5 max-w-[190px] font-sans';
      popupDiv.innerHTML = `
        <div class="rounded-lg overflow-hidden mb-1.5">
          <img src="${imovel.fotos[0]}" class="w-full h-20 object-cover rounded-md" referrerPolicy="no-referrer" />
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-1">
            ${
              imovel.integrado 
                ? `<span class="text-[7px] font-black bg-amber-100 text-amber-800 px-1 rounded uppercase tracking-wider">${imovel.integracaoOrigem || 'Integração'}</span>` 
                : `<span class="text-[7px] font-black bg-blue-100 text-[#003366] px-1 rounded uppercase tracking-wider">Rede</span>`
            }
            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tight">${imovel.bairro}</span>
          </div>
          <h4 class="font-extrabold text-slate-900 text-[11px] truncate leading-tight">${imovel.titulo}</h4>
          <div class="flex items-center justify-between pt-1 border-t border-slate-100">
            <span class="text-[11px] font-black text-[#003366]">${formatPrice(imovel.valor)}</span>
          </div>
          <div class="flex gap-1 mt-2 pt-1 border-t border-slate-100/60">
            <button id="pop-view-${imovel.id}" class="flex-grow bg-slate-100 hover:bg-slate-200 text-[9px] font-bold text-slate-700 py-1 px-1.5 rounded transition-all flex items-center justify-center gap-0.5">
              👁️ Detalhes
            </button>
            <button id="pop-select-${imovel.id}" class="flex-grow ${isSelected ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-[#003366] hover:bg-[#002244] text-white'} text-[9px] font-bold py-1 px-1.5 rounded transition-all flex items-center justify-center gap-0.5">
              ${isSelected ? '✓ Selecionado' : '➕ Selecionar'}
            </button>
          </div>
        </div>
      `;

      // Set up click handlers inside popup once it opens
      const marker = L.marker(coords, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupDiv, { closeButton: false, minWidth: 190 });

      marker.on('popupopen', () => {
        const viewBtn = document.getElementById(`pop-view-${imovel.id}`);
        const selectBtn = document.getElementById(`pop-select-${imovel.id}`);

        if (viewBtn) {
          viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onViewDetails(imovel.id);
          });
        }
        if (selectBtn) {
          selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectToggle(imovel.id);
            marker.closePopup();
          });
        }
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds if we have markers
    if (imoveis.length > 0 && mapInstanceRef.current) {
      const group = L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15));
    }

  }, [imoveis, leafletLoaded, selectedIds]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (loadingError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <MapPin className="mx-auto text-rose-500" size={32} />
        <h3 className="font-bold text-slate-800 text-sm">Erro ao carregar o mapa</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Não foi possível conectar com os servidores de mapas da internet. Verifique sua conexão.
        </p>
      </div>
    );
  }

  if (!leafletLoaded) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-[380px] flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 border-4 border-[#003366] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-bold">Iniciando mapa interativo...</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div 
        ref={mapContainerRef} 
        className="w-full h-[380px] z-0" 
        id="interactive-leaflet-map"
      />
      {/* Mini Helper Overlay */}
      <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-1 rounded-md z-10 shadow-xs flex items-center gap-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#003366]" /> Rede</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Integração</span>
      </div>
    </div>
  );
}
