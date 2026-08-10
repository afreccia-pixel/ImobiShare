/**
 * Utility to resolve API endpoint URLs dynamically.
 * Works seamlessly across both Web (relative paths) and Capacitor Native (absolute server URL).
 */

const DEFAULT_SERVER_URL = 'https://www.imobishare.app.br';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    const capacitorObj = (window as any).Capacitor;
    const isCapacitorNative = Boolean(
      capacitorObj?.isNativePlatform?.() ||
      capacitorObj?.getPlatform?.() === 'android' ||
      capacitorObj?.getPlatform?.() === 'ios' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173')
    );

    const configuredServerUrl = (import.meta as any).env?.VITE_SERVER_URL;

    if (isCapacitorNative || configuredServerUrl) {
      const baseUrl = (configuredServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    }
  }

  return cleanPath;
}

