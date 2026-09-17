/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PortalSortOption } from '../types';
import { PortalFilterDropdown } from './PortalFilterDropdown';

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

  return (
    <div className="relative inline-flex items-center gap-2">
      <span className="hidden lg:inline text-[14px] font-medium text-slate-500 whitespace-nowrap">
        Ordenar por:
      </span>
      <PortalFilterDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        align="right"
        className="w-52"
        trigger={({ isOpen: open }) => (
          <button
            type="button"
            id="portal-sort-dropdown-trigger"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 h-9 lg:h-[44px] px-3 lg:px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs lg:text-[14px] font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer focus:outline-hidden"
          >
            <span>{SORT_LABELS[sortBy]}</span>
            <ChevronDown
              size={16}
              className={`text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      >
        <div id="portal-sort-dropdown-menu">
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
                className={`w-full text-left px-4 py-2.5 text-xs lg:text-[14px] flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                  isSelected ? 'font-semibold text-[#003366] bg-blue-50/50' : 'text-slate-700 font-normal lg:font-medium'
                }`}
              >
                <span>{SORT_LABELS[option]}</span>
                {isSelected && <Check size={16} className="text-[#003366]" />}
              </button>
            );
          })}
        </div>
      </PortalFilterDropdown>
    </div>
  );
}
