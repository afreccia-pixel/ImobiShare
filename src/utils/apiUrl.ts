/**
 * Utility to resolve API endpoint URLs dynamically.
 * Works seamlessly across both Web (relative paths) and Capacitor Native (absolute server URL).
 */

/**
 * Utilitário para resolução de URLs de API e arquivos estáticos.
 * 
 * ARQUITETURA OFICIAL:
 * - https://imobishare.app.br = Portal Público / Clientes
 * - https://imobishare.onrender.com = Backend & Aplicativo dos Corretores
 * 
 * REGRAS CRÍTICAS:
 * 1. Arquivos estáticos (fotocapa.jpg, fotocapa.png, icone_imobishare.png, favicon, etc.)
 *    DEVEM ser SEMPRE carregados do próprio domínio com caminhos relativos (/...).
 *    NUNCA devem ser requisitados para o backend do Render.
 * 2. APENAS chamadas de API/banco (/api/*) podem utilizar o backend do Render quando
 *    executando no Portal Público (imobishare.app.br) ou no App Nativo (Capacitor).
 */

const BACKEND_RENDER_URL = 'https://imobishare.onrender.com';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // 1. Arquivos estáticos NUNCA utilizam o backend do Render; sempre caminhos relativos locais
  const isStaticFile = /\.(png|jpe?g|svg|webp|ico|gif|json|js|css|woff2?|ttf|eot)$/i.test(cleanPath);
  if (isStaticFile || !cleanPath.startsWith('/api')) {
    return cleanPath;
  }

  // 2. Chamadas de API (/api/*)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const capacitorObj = (window as any).Capacitor;
    const isCapacitorNative = Boolean(
      capacitorObj?.isNativePlatform?.() ||
      capacitorObj?.getPlatform?.() === 'android' ||
      capacitorObj?.getPlatform?.() === 'ios' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:'
    );

    const configuredServerUrl = (import.meta as any).env?.VITE_SERVER_URL;
    if (configuredServerUrl) {
      const baseUrl = configuredServerUrl.replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    }

    // Se estiver rodando no Portal Público (imobishare.app.br) ou no aplicativo nativo,
    // direciona as requisições de API para o backend do Render
    const isPublicPortal = hostname.includes('imobishare.app.br');
    if (isCapacitorNative || isPublicPortal) {
      return `${BACKEND_RENDER_URL}${cleanPath}`;
    }
  }

  // No próprio ambiente do Render (imobishare.onrender.com) ou ambiente de desenvolvimento local,
  // utiliza caminho relativo /api/*
  return cleanPath;
}

