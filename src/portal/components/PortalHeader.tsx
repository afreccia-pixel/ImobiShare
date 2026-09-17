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
          className="group flex items-center gap-3 cursor-pointer focus:outline-hidden"
          aria-label="Ir para página inicial do ImobiShare"
        >
          <img
            src="/icone_imobishare.png"
            alt="ImobiShare Logo"
            className="w-9 h-9 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = LOGO_IMAGE;
            }}
          />
          <span className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight font-sans leading-none">
            IMOBISHARE
          </span>
        </button>

        {/* Lado direito: Painel do Corretor com extremidades bem arredondadas */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="portal-header-btn-entrar"
            onClick={onOpenAuth}
            className="h-11 px-5 text-sm sm:text-[15px] font-semibold text-[#003366] bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/80 rounded-full transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.98] flex items-center gap-2.5"
          >
            <User size={18} className="text-[#003366] stroke-[2.2]" />
            <span>Painel do Corretor</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white shrink-0 ml-0.5" title="Disponível" />
          </button>
        </div>
      </div>
    </header>
  );
}
