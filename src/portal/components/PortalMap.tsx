/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PortalProperty } from '../types';
import { formatCompactPriceBRL } from '../data/mockPortalData';
import { RefreshCw } from 'lucide-react';

interface PortalMapProps {
  imoveis: PortalProperty[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onSearchInArea?: () => void;
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

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center in Balneário Camboriú
    const defaultCenter: [number, number] = [-26.9924, -48.6341];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Elegant, clean map tiles (CartoDB Positron / Voyager style without API key needed)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Detect user pan/zoom
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

    // Fix map container size after render
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when properties or active/hover states change
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const validCoordinates: [number, number][] = [];

    imoveis.forEach((imovel) => {
      const lat = imovel.latitude || -26.9924;
      const lng = imovel.longitude || -48.6341;
      validCoordinates.push([lat, lng]);

      const isHovered = hoveredId === imovel.id;
      const isSelected = selectedId === imovel.id;
      const isActive = isHovered || isSelected;

      const priceText = formatCompactPriceBRL(imovel.valor);

      const markerHtml = `
        <div 
          id="marker-${imovel.id}"
          class="portal-price-marker ${isActive ? 'active' : ''}"
          style="
            background: ${isActive ? '#003366' : '#ffffff'};
            color: ${isActive ? '#ffffff' : '#0f172a'};
            border: 1.5px solid ${isActive ? '#003366' : '#e2e8f0'};
            padding: 5px 10px;
            border-radius: 9999px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 11px;
            font-weight: 800;
            white-space: nowrap;
            cursor: pointer;
            box-shadow: ${isActive ? '0 8px 20px rgba(0,51,102,0.35)' : '0 3px 10px rgba(0,0,0,0.12)'};
            transform: translate(-50%, -50%) scale(${isActive ? 1.12 : 1});
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            z-index: ${isActive ? 999 : 10};
          "
        >
          ${priceText}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

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
    });

    // Auto-fit bounds if we have coordinates and it's the initial load
    if (validCoordinates.length > 0 && !isUserInteractingRef.current) {
      const bounds = L.latLngBounds(validCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [imoveis, hoveredId, selectedId, onHover, onSelect]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

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
