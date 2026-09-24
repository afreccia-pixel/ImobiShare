/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Imovel } from '../types';

/**
 * Normaliza e sanitiza um texto para slug amigável em URLs.
 * Remove acentos, pontuações, caracteres especiais e espaços duplicados.
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres inválidos
    .replace(/\s+/g, '-') // Espaços para hífens
    .replace(/-+/g, '-') // Múltiplos hífens para um só
    .replace(/^-+|-+$/g, ''); // Remove hífens no início e fim
}

/**
 * Retorna o código único e estável do imóvel para a URL.
 * O código permanece estável mesmo que título, preço ou corretor mudem.
 */
export function getCanonicalPropertyCode(imovel: Partial<Imovel> | Record<string, any>): string {
  if (!imovel) return 'IMO001';

  // 1. Código central IM (ex: IM000001, IM000116)
  if (imovel.codigoIm && typeof imovel.codigoIm === 'string' && /^IM\d{4,}$/i.test(imovel.codigoIm.trim())) {
    return imovel.codigoIm.toUpperCase().trim();
  }

  // 2. Código amigável cadastrado (ex: FRE116, FRE01)
  if (
    imovel.codigo &&
    typeof imovel.codigo === 'string' &&
    imovel.codigo.trim() &&
    !imovel.codigo.toLowerCase().startsWith('imovel-') &&
    !imovel.codigo.toLowerCase().startsWith('prop-')
  ) {
    return imovel.codigo.toUpperCase().trim();
  }

  // 3. ID do imóvel sem prefixos internos
  if (imovel.id && typeof imovel.id === 'string' && imovel.id.trim()) {
    const cleanId = imovel.id.replace(/^(imovel-|prop-)/i, '').trim();
    if (cleanId) {
      return cleanId.toUpperCase();
    }
  }

  return 'IMO001';
}

/**
 * Retorna o segmento de modalidade para a URL: 'compra' ou 'aluguel'.
 */
export function getPropertyModalidade(imovel: Partial<Imovel> | Record<string, any>): 'compra' | 'aluguel' {
  const tipo = (imovel.tipo || (imovel as any).modalidade || '').toLowerCase();
  if (tipo === 'locação' || tipo === 'locacao') {
    return 'aluguel';
  }
  return 'compra';
}

/**
 * Gera automaticamente o slug descritivo do imóvel combinando:
 * tipo de imóvel + quartos + bairro + cidade
 * Exemplo: 'apartamento-3-quartos-centro-balneario-camboriu'
 */
export function generatePropertySlug(imovel: Partial<Imovel> | Record<string, any>): string {
  const parts: string[] = [];

  // 1. Tipo do imóvel (Apartamento, Casa, Cobertura, etc.)
  const tipoRaw = imovel.tipoImovel || imovel.tipo || 'Apartamento';
  const tipoSlug = slugify(tipoRaw);
  if (tipoSlug) parts.push(tipoSlug);

  // 2. Quartos / Dormitórios (se houver)
  const quartos = Number(imovel.dormitorios ?? imovel.quartos ?? 0);
  if (quartos === 1) {
    parts.push('1-quarto');
  } else if (quartos > 1) {
    parts.push(`${quartos}-quartos`);
  }

  // 3. Bairro
  const bairroSlug = slugify(imovel.bairro || '');
  if (bairroSlug && bairroSlug !== 'todos-os-bairros') {
    parts.push(bairroSlug);
  }

  // 4. Cidade
  const cidadeSlug = slugify(imovel.cidade || 'balneario-camboriu');
  if (cidadeSlug && cidadeSlug !== 'todas') {
    parts.push(cidadeSlug);
  }

  const slug = parts.join('-');
  if (slug) return slug;

  // Fallback seguro caso campos estejam vazios
  const tituloSlug = slugify(imovel.titulo || imovel.nomeEdificio || 'imovel');
  return tituloSlug || 'imovel';
}

/**
 * Retorna o caminho canônico do imóvel:
 * /imovel/CODIGO/MODALIDADE/SLUG
 * Ex: /imovel/FRE116/compra/apartamento-3-quartos-centro-balneario-camboriu
 */
export function getCanonicalPropertyPath(imovel: Partial<Imovel> | Record<string, any>): string {
  const code = getCanonicalPropertyCode(imovel);
  const modalidade = getPropertyModalidade(imovel);
  const slug = generatePropertySlug(imovel);
  return `/imovel/${code}/${modalidade}/${slug}`;
}

/**
 * Retorna a URL canônica pública completa do imóvel:
 * Ex: https://imobishare.app.br/imovel/FRE116/compra/apartamento-3-quartos-centro-balneario-camboriu
 */
export function getCanonicalPropertyUrl(
  imovel: Partial<Imovel> | Record<string, any>,
  origin: string = 'https://imobishare.app.br'
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const path = getCanonicalPropertyPath(imovel);
  return `${cleanOrigin}${path}`;
}

/**
 * Faz o parsing da rota para extrair código do imóvel, modalidade e slug.
 * Suporta formatos:
 * - /imovel/FRE116/compra/apartamento-3-quartos-centro-balneario-camboriu
 * - /imovel/FRE116/compra
 * - /imovel/FRE116
 */
export function parsePropertyUrl(pathname: string): {
  code: string;
  modalidade?: string;
  slug?: string;
} | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/imovel\/([^\/?#]+)(?:\/([^\/?#]+))?(?:\/([^\/?#]+))?/i);
  if (!match) return null;

  return {
    code: decodeURIComponent(match[1]).trim(),
    modalidade: match[2] ? decodeURIComponent(match[2]).trim() : undefined,
    slug: match[3] ? decodeURIComponent(match[3]).trim() : undefined,
  };
}
