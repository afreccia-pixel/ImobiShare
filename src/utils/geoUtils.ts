/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel } from '../types';

export const KNOWN_LOCATIONS: Record<string, [number, number]> = {
  // Cidades principais SC
  'balneário camboriú': [-26.9924, -48.6341],
  'balneario camboriu': [-26.9924, -48.6341],
  'itapema': [-27.1351, -48.6082],
  'itajai': [-26.9078, -48.6619],
  'itajaí': [-26.9078, -48.6619],
  'praia brava': [-26.9536, -48.6394],
  'porto belo': [-27.1578, -48.5539],
  'bombinhas': [-27.1428, -48.5039],
  'florianópolis': [-27.5954, -48.5480],
  'florianopolis': [-27.5954, -48.5480],
  'navegantes': [-26.8972, -48.6542],
  'camboriú': [-27.0247, -48.6544],
  'camboriu': [-27.0247, -48.6544],
  'penha': [-26.7708, -48.6475],
  'piçarras': [-26.7644, -48.6711],
  'joinville': [-26.3045, -48.8487],
  'blumenau': [-26.9194, -49.0661],

  // Bairros Balneário Camboriú
  'centro': [-26.9924, -48.6341],
  'barra sul': [-27.0095, -48.6189],
  'pioneiros': [-26.9745, -48.6325],
  'barra norte': [-26.9745, -48.6325],
  'nações': [-26.9850, -48.6430],
  'nacoes': [-26.9850, -48.6430],
  'praia dos amores': [-26.9620, -48.6270],
  'ariribá': [-26.9690, -48.6410],
  'aririba': [-26.9690, -48.6410],
  'estados': [-26.9972, -48.6472],
  'vila real': [-27.0050, -48.6330],
  'municípios': [-27.0005, -48.6402],
  'municipios': [-27.0005, -48.6402],
  'estaleiro': [-27.0345, -48.5830],
  'estaleirinho': [-27.0490, -48.5780],
  'taquaras': [-27.0270, -48.5870],

  // Bairros Itapema
  'meia praia': [-27.1472, -48.5992],
  'canto da praia': [-27.0820, -48.6010],
  'morretes': [-27.1410, -48.6120],
  'andorinha': [-27.1430, -48.6050],
  'tabuleiro': [-27.1320, -48.6210],
  'ilhotas': [-27.1040, -48.6040],
  'itapema do norte': [-27.0870, -48.6080],

  // Bairros Itajaí
  'fazenda': [-26.9140, -48.6530],
  'cabeçudas': [-26.9230, -48.6310],
  'cabecudas': [-26.9230, -48.6310],
  'ressacada': [-26.9180, -48.6750],
  'são joão': [-26.8990, -48.6780],
  'cordeiros': [-26.8850, -48.6820],
  'dom bosco': [-26.9180, -48.6830],

  // Porto Belo
  'perequê': [-27.1578, -48.5539],
  'pereque': [-27.1578, -48.5539],
};

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  source: 'nominatim' | 'known' | 'fallback';
  displayName?: string;
}

/**
 * Geocodifica um endereço usando OpenStreetMap (Nominatim) com fallback automático
 * para as coordenadas mapeadas da região (Balneário Camboriú, Itapema, Itajaí, etc.)
 */
export async function geocodeAddress(params: {
  endereco?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
}): Promise<GeocodeResult> {
  const endereco = (params.endereco || '').trim();
  const bairro = (params.bairro || '').trim();
  const cidade = (params.cidade || 'Balneário Camboriú').trim();
  const cleanCep = (params.cep || '').replace(/\D/g, '');

  // 1. Tentar busca precisa via Nominatim com endereço completo
  if (endereco || cleanCep) {
    try {
      const queries: string[] = [];
      
      if (endereco) {
        queries.push(`${endereco}, ${bairro ? `${bairro}, ` : ''}${cidade}, Santa Catarina, Brasil`);
        queries.push(`${endereco}, ${cidade}, Santa Catarina, Brasil`);
      }
      if (cleanCep && cleanCep.length === 8) {
        queries.push(`${cleanCep}, Brasil`);
      }
      if (bairro) {
        queries.push(`${bairro}, ${cidade}, Santa Catarina, Brasil`);
      }

      for (const query of queries) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
              return {
                latitude: lat,
                longitude: lon,
                source: 'nominatim',
                displayName: data[0].display_name,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('Falha na geocodificação via Nominatim, usando coordenadas locais:', err);
    }
  }

  // 2. Fallback baseado em dicionário de bairros e cidades da região
  const bairroLower = bairro.toLowerCase();
  const cidadeLower = cidade.toLowerCase();

  let baseCoord: [number, number] | undefined =
    KNOWN_LOCATIONS[bairroLower] || KNOWN_LOCATIONS[cidadeLower];

  if (!baseCoord) {
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (bairroLower.includes(key) || cidadeLower.includes(key)) {
        baseCoord = coords;
        break;
      }
    }
  }

  // Se nada foi encontrado, usa Balneário Camboriú como centro de referência
  if (!baseCoord) {
    baseCoord = [-26.9924, -48.6341];
  }

  // Deslocamento determinístico baseado no hash do endereço para que múltiplos imóveis não coincidam perfeitamente
  const hashKey = `${endereco}-${bairro}-${cidade}-${cleanCep}`;
  let hash = 0;
  for (let i = 0; i < hashKey.length; i++) {
    hash = (hash << 5) - hash + hashKey.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const radius = 0.0015 + ((Math.abs(hash) % 100) / 100) * 0.004; // ~150m a ~550m
  const dx = radius * Math.cos(angle);
  const dy = radius * Math.sin(angle);

  return {
    latitude: baseCoord[0] + dy,
    longitude: baseCoord[1] + dx,
    source: 'known',
  };
}

/**
 * Obtém coordenadas resolvidas para plotagem no mapa para qualquer imóvel
 */
export function getCoordinatesForImovel(imovel: Imovel, index: number = 0): [number, number] {
  const lat = typeof imovel.latitude === 'number' ? imovel.latitude : parseFloat(String(imovel.latitude));
  const lng = typeof imovel.longitude === 'number' ? imovel.longitude : parseFloat(String(imovel.longitude));

  if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0) {
    return [lat, lng];
  }

  const bairro = (imovel.bairro || '').toLowerCase().trim();
  const cidade = (imovel.cidade || '').toLowerCase().trim();

  let baseCoord = KNOWN_LOCATIONS[bairro] || KNOWN_LOCATIONS[cidade];
  if (!baseCoord) {
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (bairro.includes(key) || cidade.includes(key)) {
        baseCoord = coords;
        break;
      }
    }
  }
  if (!baseCoord) {
    baseCoord = [-26.9924, -48.6341]; // Centro Balneário Camboriú
  }

  let hash = 0;
  const key = imovel.id || `${imovel.titulo}-${index}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const radius = 0.0015 + ((Math.abs(hash) % 100) / 100) * 0.005;
  const dx = radius * Math.cos(angle);
  const dy = radius * Math.sin(angle);

  return [baseCoord[0] + dy, baseCoord[1] + dx];
}
