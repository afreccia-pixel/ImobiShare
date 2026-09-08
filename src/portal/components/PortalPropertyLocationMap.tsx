/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { safePatchLeaflet } from '../../utils/leafletPatch';

interface PortalPropertyLocationMapProps {
  latitude?: number;
  longitude?: number;
  endereco?: string;
  bairro: string;
  cidade: string;
}

export function PortalPropertyLocationMap({
  latitude,
  longitude,
  endereco,
  bairro,
  cidade,
}: PortalPropertyLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Validate if real coordinates are provided
  const hasValidCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude !== 0 &&
    longitude !== 0;

  const safeLat = hasValidCoords ? latitude : 0;
  const safeLng = hasValidCoords ? longitude : 0;

  useEffect(() => {
    if (!hasValidCoords) return;

    safePatchLeaflet(L);

    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Reset container if previously initialized by Leaflet
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    let map: L.Map;
    try {
      map = L.map(mapContainerRef.current, {
        center: [safeLat, safeLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      });
    } catch (err) {
      console.warn('[PortalPropertyLocationMap] Failed to initialize map:', err);
      return;
    }

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    // Pin de localização em vermelho como uma gota (teardrop)
    const pinHtml = `
      <div style="
        position: relative;
        width: 36px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(220, 38, 38, 0.45));">
          <path d="M18 0C8.05888 0 0 8.05888 0 18C0 29.5 15.5 45.2 17.15 46.85C17.65 47.35 18.35 47.35 18.85 46.85C20.5 45.2 36 29.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="#DC2626"/>
          <circle cx="18" cy="17" r="7" fill="#FFFFFF"/>
          <circle cx="18" cy="17" r="3.5" fill="#DC2626"/>
        </svg>
      </div>
    `;

    const customIcon = L.divIcon({
      html: pinHtml,
      className: 'location-map-drop-icon',
      iconSize: [36, 48],
      iconAnchor: [18, 48],
    });

    const marker = L.marker([safeLat, safeLng], { icon: customIcon });
    marker.addTo(map);

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, [safeLat, safeLng]);

  return (
    <div 
      id="portal-property-location-card"
      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs"
    >
      {/* Mini Leaflet Map - exibido somente se houver coordenadas reais */}
      {hasValidCoords && (
        <div className="relative h-48 w-full bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>
      )}

      {/* Endereço text */}
      <div className={`p-4 bg-white ${hasValidCoords ? 'border-t border-slate-100' : ''} flex items-start gap-2.5`}>
        <MapPin size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs flex-1 min-w-0">
          {endereco && (
            <p className="font-bold text-slate-800 tracking-tight leading-snug">
              {endereco}
            </p>
          )}
          {bairro && (
            <p className="text-slate-600 font-medium">
              {bairro}
            </p>
          )}
          {cidade && (
            <p className="text-slate-400 font-normal">
              {cidade} - SC
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
