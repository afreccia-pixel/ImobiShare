/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from 'lucide-react';
import { LOGO_IMAGE } from '../../assets/logo';

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
        {/* Lado esquerdo: Ícone + IMOBISHARE */}
        <button
          type="button"
          id="portal-header-logo"
          onClick={onGoHome}
          className="group flex items-center gap-2.5 cursor-pointer focus:outline-hidden"
          aria-label="Ir para página inicial do ImobiShare"
        >
          <img
            src="/icone_imobishare.png"
            alt="ImobiShare Logo"
            className="w-8 h-8 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = LOGO_IMAGE;
            }}
          />
          <span className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight font-sans">
            IMOBISHARE
          </span>
        </button>

        {/* Lado direito: Painel do Corretor */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="portal-header-btn-entrar"
            onClick={onOpenAuth}
            className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-[#003366] bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.98] flex items-center gap-2"
          >
            <User size={15} className="text-[#003366] stroke-[2.2]" />
            <span>Painel do Corretor</span>
            {isLoggedIn && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" title="Conectado" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
