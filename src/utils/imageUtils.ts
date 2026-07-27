/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SyntheticEvent } from 'react';

export const DEFAULT_PROPERTY_IMAGE = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80';

/**
 * Validates whether a given string is a plausible image URL or data URI.
 */
export function isValidImageString(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 5) return false;

  // Reject truncated base64 headers without data
  if (
    trimmed === 'data:image/jpeg;base64' ||
    trimmed === 'data:image/png;base64' ||
    trimmed === 'data:image/webp;base64'
  ) {
    return false;
  }

  // Must start with standard URL/URI protocols or contain a valid domain/path
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('.')
  ) {
    return true;
  }
  return false;
}

/**
 * Returns a valid image URL or falls back to DEFAULT_PROPERTY_IMAGE if invalid or empty.
 */
export function getValidImage(url?: string | null, fallback = DEFAULT_PROPERTY_IMAGE): string {
  if (isValidImageString(url)) {
    let trimmed = url!.trim();
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('data:') &&
      !trimmed.startsWith('blob:') &&
      !trimmed.startsWith('/')
    ) {
      trimmed = `https://${trimmed}`;
    }
    return trimmed;
  }
  return fallback;
}

/**
 * Image error handler to automatically substitute broken images with a default picture
 * and avoid broken alt text being displayed inside the element box.
 */
export function handleImageError(
  e: SyntheticEvent<HTMLImageElement, Event>,
  fallback = DEFAULT_PROPERTY_IMAGE
): void {
  const img = e.currentTarget;
  img.onerror = null; // Prevent infinite error handler loops
  img.src = fallback;
}

/**
 * Sanitizes an array of property photos to ensure it contains at least one valid image string.
 */
export function sanitizeFotos(fotos?: string[] | null): string[] {
  if (!Array.isArray(fotos) || fotos.length === 0) {
    return [DEFAULT_PROPERTY_IMAGE];
  }
  const valid = fotos.filter(f => isValidImageString(f));
  if (valid.length === 0) {
    return [DEFAULT_PROPERTY_IMAGE];
  }
  return valid;
}
