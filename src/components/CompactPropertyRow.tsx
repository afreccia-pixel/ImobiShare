/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel } from '../types';
import { motion } from 'motion/react';
import { MapPin, Heart, CheckCircle2, Bed, Car, Maximize } from 'lucide-react';

interface CompactPropertyRowProps {
  key?: string;
  imovel: Imovel;
  isMyProperty: boolean;
  isSelected?: boolean;
  isFavorite?: boolean;
  onSelectToggle?: () => void;
  onFavoriteToggle?: () => void;
  onClick: () => void;
}

export function CompactPropertyRow({
  imovel,
  isMyProperty,
  isSelected = false,
  isFavorite = false,
  onSelectToggle,
  onFavoriteToggle,
  onClick,
}: CompactPropertyRowProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.interactive-action') || target.closest('.checkbox-container')) {
      return;
    }
    onClick();
  };

  return (
    <motion.div
      whileHover={{ scale: 0.995 }}
      onClick={handleRowClick}
      className={`bg-white border rounded-lg p-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-all ${
        isSelected ? 'border-[#003366] bg-[#003366]/[0.01]' : 'border-slate-100'
      }`}
      id={`compact-row-${imovel.id}`}
    >
      {/* Left: Checkbox */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Checkbox */}
        {onSelectToggle && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle();
            }}
            className="checkbox-container cursor-pointer flex-shrink-0"
          >
            {isSelected ? (
              <CheckCircle2 size={16} className="text-[#003366] fill-[#003366]/10" />
            ) : (
              <div className="w-4 h-4 border border-slate-300 rounded bg-white hover:border-[#003366] transition-colors" />
            )}
          </div>
        )}

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-extrabold text-slate-800 text-xs truncate max-w-[180px] leading-tight">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
            </h4>
            {imovel.integrado && (
              <span className="text-[7px] font-black bg-amber-100 text-amber-800 px-1 py-0.2 rounded uppercase tracking-wide">
                {imovel.integracaoOrigem || 'Integração'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-0.5">
            <span className="flex items-center gap-0.5 truncate max-w-[120px]">
              <MapPin size={8} />
              <span className="truncate">{imovel.bairro}</span>
            </span>
            <span>•</span>
            <span className="font-bold text-slate-500">{imovel.metragem ?? 0}m²</span>
            <span>•</span>
            <span className="font-bold text-slate-500">{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
          </div>
        </div>
      </div>

      {/* Right: Price & Favorite */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-extrabold text-[#003366] text-xs leading-none">
          {formatPrice(imovel.valor)}
          {imovel.tipo === 'locação' && <span className="text-[8px] font-normal text-slate-400 block text-right">/mês</span>}
        </span>

        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            className={`p-1.5 rounded-full transition-colors interactive-action ${
              isFavorite ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-500'
            }`}
          >
            <Heart size={11} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
