/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { getValidImage, handleImageError } from '../../utils/imageUtils';

interface PortalGalleryModalProps {
  titulo: string;
  fotos: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function PortalGalleryModal({
  titulo,
  fotos,
  isOpen,
  onClose,
}: PortalGalleryModalProps) {
  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="portal-modal-all-photos"
      className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-150 overflow-hidden"
    >
      {/* Top bar */}
      <div className="h-16 px-4 sm:px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md sticky top-0 z-10">
        <div>
          <span className="text-[10px] font-bold text-[#003366] uppercase tracking-wider block">
            Galeria Completa
          </span>
          <h2 className="text-sm sm:text-base font-black text-slate-800 truncate max-w-md sm:max-w-xl">
            {titulo} ({fotos.length} fotos)
          </h2>
        </div>

        <button
          type="button"
          id="btn-close-gallery-modal"
          onClick={onClose}
          aria-label="Fechar galeria"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <X size={15} />
          <span>Fechar</span>
        </button>
      </div>

      {/* Grid elegante com rolagem vertical */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {fotos.map((foto, idx) => (
            <div
              key={idx}
              className={`rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shadow-sm ${
                idx % 3 === 0 ? 'md:col-span-2' : ''
              }`}
            >
              <img
                src={getValidImage(foto)}
                alt={`${titulo} - Foto ${idx + 1}`}
                onError={handleImageError}
                loading="lazy"
                className="w-full h-auto max-h-[75vh] object-cover hover:scale-101 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
