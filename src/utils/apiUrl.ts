/**
 * Utility to resolve API endpoint URLs dynamically.
 * Works seamlessly across both Web (relative paths) and Capacitor Native (absolute server URL).
 */

const DEFAULT_SERVER_URL = 'https://imobishare.onrender.com';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    const isCapacitorNative = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).Capacitor?.getPlatform?.() === 'android' ||
      (window as any).Capacitor?.getPlatform?.() === 'ios'
    );

    const configuredServerUrl = (import.meta as any).env?.VITE_SERVER_URL;

    if (isCapacitorNative) {
      const baseUrl = (configuredServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    }
  }

  return cleanPath;
}
