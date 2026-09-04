/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { PortalFilterState } from '../types';

interface PortalMoreFiltersModalProps {
  filters: PortalFilterState;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updated: Partial<PortalFilterState>) => void;
}

export function PortalMoreFiltersModal({
  filters,
  isOpen,
  onClose,
  onApply,
}: PortalMoreFiltersModalProps) {
  const [vagas, setVagas] = useState<number | undefined>(filters.vagasMin);
  const [bairro, setBairro] = useState<string | undefined>(filters.bairro);
  const [construtora, setConstrutora] = useState<string | undefined>(filters.construtora);

  if (!isOpen) return null;

  const handleClear = () => {
    setVagas(undefined);
    setBairro(undefined);
    setConstrutora(undefined);
    onApply({ vagasMin: undefined, bairro: undefined, construtora: undefined });
    onClose();
  };

  const handleSave = () => {
    onApply({ vagasMin: vagas, bairro, construtora });
    onClose();
  };

  return (
    <div
      id="modal-mais-filtros"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">
            Filtros Avançados
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros avançados"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Vagas de Garagem */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Vagas de Garagem
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Todos', val: undefined },
                { label: '1+', val: 1 },
                { label: '2+', val: 2 },
                { label: '3+', val: 3 },
                { label: '4+', val: 4 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setVagas(item.val)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    vagas === item.val
                      ? 'bg-blue-50 border-[#003366] text-[#003366]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bairros de Balneário Camboriú */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Bairro
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Todos os bairros', 'Centro', 'Barra Sul', 'Pioneiros', 'Nações', 'Praia dos Amores'].map((b) => {
                const isSelected = (!bairro && b === 'Todos os bairros') || bairro === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBairro(b === 'Todos os bairros' ? undefined : b)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-[#003366] text-[#003366] font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{b}</span>
                    {isSelected && <Check size={14} className="text-[#003366]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Construtora */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Construtora / Incorporadora
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Todas as construtoras', 'Baggio', 'Embraed', 'FG Empreendimentos'].map((c) => {
                const isSelected = (!construtora && c === 'Todas as construtoras') || construtora === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConstrutora(c === 'Todas as construtoras' ? undefined : c)}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-[#003366] text-[#003366] font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c}</span>
                    {isSelected && <Check size={14} className="text-[#003366]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            id="btn-aplicar-mais-filtros"
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
