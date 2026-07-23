/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel, Corretor } from '../types';
import { motion } from 'motion/react';
import { Heart, Share2, Edit2, Copy, Trash2, MapPin, EyeOff, Eye, CheckCircle2, Bed, Car, Maximize } from 'lucide-react';

interface PropertyCardProps {
  key?: string | number;
  imovel: Imovel;
  isMyProperty: boolean;
  isSelected?: boolean;
  isFavorite?: boolean;
  onSelectToggle?: () => void;
  onFavoriteToggle?: () => void;
  onShareToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClick: () => void;
  showCheckbox?: boolean;
}

export function PropertyCard({
  imovel,
  isMyProperty,
  isSelected = false,
  isFavorite = false,
  onSelectToggle,
  onFavoriteToggle,
  onShareToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onClick,
  showCheckbox = false,
}: PropertyCardProps) {
  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on checkboxes, buttons or icons, don't trigger details
    const target = e.target as HTMLElement;
    if (target.closest('.interactive-action') || target.closest('.checkbox-container')) {
      return;
    }
    onClick();
  };

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2 }}
      onClick={handleCardClick}
      className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-row p-2 gap-2.5 cursor-pointer ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-[#003366]/[0.01]' : 'border-slate-100'
      }`}
      id={`property-card-${imovel.id}`}
    >
      {/* Property Image Container */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-50">
        <img
          src={imovel.fotos[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&auto=format&fit=crop&q=80'}
          alt={imovel.titulo}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        {/* Buy / Rent Badge & Integrated Badge */}
        <div className="absolute top-1 left-1 flex flex-col gap-0.5">
          <span className={`text-[7px] font-black uppercase tracking-wider text-white px-1 py-0.5 rounded-sm shadow-xs ${
            imovel.tipo === 'venda' ? 'bg-[#003366]' : 'bg-emerald-700'
          }`}>
            {imovel.tipo === 'venda' ? 'Comprar' : 'Alugar'}
          </span>
          {imovel.integrado && (
            <span className="text-[7px] font-black uppercase tracking-wider text-slate-900 bg-amber-300 px-1 py-0.5 rounded-sm shadow-xs" title="Imóvel importado via integração">
              Integração
            </span>
          )}
        </div>

        {/* Private view badge if not shared */}
        {!imovel.compartilhar && (
          <span className="absolute bottom-1 left-1 bg-slate-950/80 backdrop-blur-xs text-white p-0.5 rounded-full shadow-xs" title="Visível apenas para você">
            <EyeOff size={9} />
          </span>
        )}
      </div>

      {/* Content Details */}
      <div className="flex-grow min-w-0 flex flex-col justify-between h-20 sm:h-24 py-0.5">
        <div>
          {/* Top Row: Title & Optional Checkbox */}
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate max-w-[85%] tracking-tight leading-tight">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
            </h3>

            {/* Checkbox for Multi-Select */}
            {showCheckbox && onSelectToggle && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectToggle();
                }}
                className="checkbox-container p-0.5 cursor-pointer flex-shrink-0"
              >
                {isSelected ? (
                  <CheckCircle2 size={16} className="text-[#003366] fill-[#003366]/10" />
                ) : (
                  <div className="w-4 h-4 border-2 border-slate-200 rounded-md bg-white hover:border-[#003366] transition-colors" />
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center text-slate-400 text-[10px] mt-0.5 font-medium truncate">
            <MapPin size={10} className="mr-0.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{imovel.bairro}</span>
          </div>

          {/* Essentials row instead of Description */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 text-[9px] mt-1 bg-slate-50 py-0.5 px-2 rounded-lg border border-slate-100/60 w-fit font-bold">
            <span className="flex items-center gap-0.5">
              <Bed size={10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Car size={10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.vagas ?? 0} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Maximize size={10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.metragem ?? 0} m²</span>
            </span>
          </div>
        </div>

        {/* Bottom Row: Price & Actions */}
        <div className="flex items-center justify-between border-t border-slate-100/60 pt-1 mt-1">
          <div className="flex flex-col">
            <span className="font-extrabold text-[#003366] text-xs sm:text-sm leading-tight">
              {formatPrice(imovel.valor)}
              {imovel.tipo === 'locação' && <span className="text-[9px] font-normal text-slate-500"> /mês</span>}
            </span>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-0.5">
            {isMyProperty ? (
              /* Broker's Private Properties Panel - full management */
              <div className="flex items-center gap-0.5 interactive-action">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                  className="p-1 text-slate-400 hover:text-[#003366] hover:bg-slate-50 rounded-full transition-colors"
                  title="Editar Imóvel"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                  className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-50 rounded-full transition-colors"
                  title="Duplicar"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onShareToggle?.(); }}
                  className={`p-1 rounded-full transition-colors ${
                    imovel.compartilhar ? 'text-[#003366] bg-[#003366]/5 hover:bg-[#003366]/10' : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  title={imovel.compartilhar ? "Compartilhado com corretores" : "Apenas eu"}
                >
                  {imovel.compartilhar ? <Share2 size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(); }}
                  className={`p-1 rounded-full transition-colors ${
                    isFavorite ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  title="Favoritar"
                >
                  <Heart size={12} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              /* Public / Others properties: only Favorite and quick Share */
              <div className="flex items-center gap-0.5 interactive-action">
                {onFavoriteToggle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFavoriteToggle(); }}
                    className={`p-1 rounded-full transition-colors ${
                      isFavorite ? 'text-rose-500 bg-rose-50' : 'text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Heart size={13} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
