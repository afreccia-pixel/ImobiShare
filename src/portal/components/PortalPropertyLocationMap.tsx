/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

interface PortalPropertyLocationMapProps {
  latitude?: number;
  longitude?: number;
  endereco?: string;
  bairro: string;
  cidade: string;
}

export function PortalPropertyLocationMap({
  latitude = -26.9924,
  longitude = -48.6341,
  endereco,
  bairro,
  cidade,
}: PortalPropertyLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(map);

    // Custom pulse pin
    const pinHtml = `
      <div style="
        width: 32px;
        height: 32px;
        background: #003366;
        border: 3px solid #ffffff;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(0,51,102,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        transform: translate(-50%, -50%);
      ">
        <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 9999px;"></div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: pinHtml,
      className: 'location-map-icon',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude]);

  return (
    <div 
      id="portal-property-location-card"
      className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs"
    >
      {/* Mini Leaflet Map */}
      <div className="relative h-44 w-full bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>

      {/* Endereço text */}
      <div className="p-4 bg-white border-t border-slate-100 flex items-start gap-2.5">
        <MapPin size={16} className="text-[#003366] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          {endereco && (
            <p className="font-bold text-slate-800 tracking-tight leading-snug">
              {endereco}
            </p>
          )}
          <p className="text-slate-600 font-medium">
            {bairro}
          </p>
          <p className="text-slate-400 font-normal">
            {cidade} - SC
          </p>
        </div>
      </div>
    </div>
  );
}
