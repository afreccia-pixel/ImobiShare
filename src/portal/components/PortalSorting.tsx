/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PortalSortOption } from '../types';

interface PortalSortingProps {
  sortBy: PortalSortOption;
  onChangeSort: (option: PortalSortOption) => void;
}

const SORT_LABELS: Record<PortalSortOption, string> = {
  relevancia: 'Relevantes',
  menor_preco: 'Menor preço',
  maior_preco: 'Maior preço',
  maior_area: 'Maior área',
  mais_recentes: 'Mais recentes',
  entrega_proxima: 'Entrega mais próxima',
};

export function PortalSorting({ sortBy, onChangeSort }: PortalSortingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        id="portal-sort-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer focus:outline-hidden"
      >
        <span>{SORT_LABELS[sortBy]}</span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          id="portal-sort-dropdown-menu"
          className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100"
        >
          {(Object.keys(SORT_LABELS) as PortalSortOption[]).map((option) => {
            const isSelected = sortBy === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChangeSort(option);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                  isSelected ? 'font-bold text-[#003366] bg-blue-50/50' : 'text-slate-700'
                }`}
              >
                <span>{SORT_LABELS[option]}</span>
                {isSelected && <Check size={14} className="text-[#003366]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
