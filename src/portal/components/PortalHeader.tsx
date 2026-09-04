/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PortalHeaderProps {
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
  onGoHome?: () => void;
}

export function PortalHeader({ isLoggedIn = false, onOpenAuth, onGoHome }: PortalHeaderProps) {
  return (
    <header 
      id="portal-header"
      className="bg-white border-b border-slate-100 sticky top-0 z-40 h-16 transition-all"
    >
      <div className="max-w-(--breakpoint-2xl) mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Lado esquerdo: IMOBISHARE */}
        <button
          type="button"
          id="portal-header-logo"
          onClick={onGoHome}
          className="group flex items-center gap-2 cursor-pointer focus:outline-hidden"
          aria-label="Ir para página inicial do ImobiShare"
        >
          <span className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight font-sans">
            IMOBISHARE
          </span>
        </button>

        {/* Lado direito: Entrar / Painel do Corretor */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="portal-header-btn-entrar"
            onClick={onOpenAuth}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-[#003366] hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            {isLoggedIn ? 'Painel do Corretor' : 'Entrar'}
          </button>
        </div>
      </div>
    </header>
  );
}
