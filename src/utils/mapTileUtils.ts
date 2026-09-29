/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import L from 'leaflet';

export interface MapTileConfig {
  url: string;
  options: L.TileLayerOptions;
}

/**
 * Retorna a configuração do layer de mapa base.
 * - Se VITE_CARTO_API_KEY estiver definida, utiliza CartoDB Voyager com a chave da API.
 * - Caso contrário, utiliza o Esri World Street Map (sem marcas d'água e sem exigência de chave de API).
 */
export function getBaseMapTileConfig(): MapTileConfig {
  const cartoApiKey = (import.meta.env.VITE_CARTO_API_KEY || '').trim();

  if (cartoApiKey) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(cartoApiKey)}`,
      options: {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    };
  }

  // Provedor de alta performance sem marca d'água "API required"
  return {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: '&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
    },
  };
}

/**
 * Adiciona a camada de mapa ao mapa Leaflet instanciado
 */
export function addBaseTileLayer(map: L.Map): L.TileLayer {
  const config = getBaseMapTileConfig();
  const layer = L.tileLayer(config.url, config.options);
  layer.addTo(map);
  return layer;
}
