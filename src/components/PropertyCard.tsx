/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel, Corretor } from '../types';
import { motion } from 'motion/react';
import { Heart, Share2, Edit2, Copy, Trash2, MapPin, EyeOff, Eye, CheckCircle2, Bed, Car, Maximize, Bath } from 'lucide-react';
import { getValidImage, handleImageError } from '../utils/imageUtils';

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
      className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-row p-2.5 gap-2.5 sm:gap-3 items-stretch min-h-[105px] cursor-pointer ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-[#003366]/[0.01]' : 'border-slate-100'
      }`}
      id={`property-card-${imovel.id}`}
    >
      {/* Property Image Container */}
      <div className="relative w-28 sm:w-32 min-h-[105px] flex-shrink-0 self-stretch rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
        <img
          src={getValidImage(imovel.fotos?.[0])}
          alt=""
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Buy / Rent Badge & Integrated Badge */}
        {!isMyProperty && (
          <div className="absolute top-1 left-1 flex flex-col gap-0.5 z-10">
            <span className={`font-extrabold uppercase tracking-tight text-white px-1 py-0.5 rounded-xs shadow-xs ${
              imovel.tipo === 'venda' ? 'bg-[#003366]' : imovel.tipo === 'locação' ? 'bg-emerald-700' : 'bg-indigo-900'
            } text-[6.5px]`}>
              {imovel.tipo === 'venda' ? 'Venda' : imovel.tipo === 'locação' ? 'Aluguel' : 'Venda & Aluguel'}
            </span>
            {imovel.statusImovel && (
              <span className="font-extrabold uppercase tracking-tight text-slate-800 bg-white/95 backdrop-blur-xs shadow-xs border border-slate-200/80 text-[6.5px] px-1 py-0.5 rounded-xs">
                {imovel.statusImovel}
              </span>
            )}
            {imovel.integrado && (
              <span className="font-black uppercase tracking-wider text-slate-900 bg-amber-300 px-1 py-0.5 rounded-sm shadow-xs text-[7px]" title="Imóvel importado via integração">
                Integração
              </span>
            )}
          </div>
        )}

        {/* Palavra Destacada Badge on Main Image */}
        {!isMyProperty && imovel.palavraDestacada?.trim() && (
          <div className="absolute bottom-1 left-1 right-1 max-w-full z-10">
            <span className="block truncate font-black uppercase tracking-wider text-white bg-indigo-600/90 backdrop-blur-xs px-1 py-0.5 rounded-xs shadow-xs text-center border border-indigo-400/30 text-[6.5px] sm:text-[7.5px]">
              {imovel.palavraDestacada.trim()}
            </span>
          </div>
        )}

        {/* Private view badge if not shared */}
        {!imovel.compartilhar && (
          <span className="absolute bottom-1 right-1 bg-slate-950/80 backdrop-blur-xs text-white p-0.5 rounded-full shadow-xs z-10" title="Visível apenas para você">
            <EyeOff size={9} />
          </span>
        )}
      </div>

      {/* Content Details */}
      <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5 gap-1.5 min-h-[105px]">
        <div>
          {/* Top Row: Title & Optional Checkbox */}
          <div className="flex items-start justify-between gap-1">
            <h3 className={`font-extrabold text-slate-900 tracking-tight leading-snug line-clamp-2 ${
              isMyProperty ? 'text-[8px]' : 'text-xs sm:text-sm'
            }`}>
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
          <div className={`flex items-center text-slate-400 mt-0.5 font-medium truncate ${
            isMyProperty ? 'text-[8px]' : 'text-[10px]'
          }`}>
            <MapPin size={isMyProperty ? 9 : 10} className="mr-0.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{imovel.bairro}</span>
          </div>

          {/* Essentials row instead of Description */}
          <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 mt-1 bg-slate-50 py-0.5 px-2 rounded-lg border border-slate-100/60 w-fit font-bold ${
            isMyProperty ? 'text-[8px]' : 'text-[9px]'
          }`}>
            <span className="flex items-center gap-0.5">
              <Bed size={isMyProperty ? 9 : 10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Bath size={isMyProperty ? 9 : 10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.banheiros ?? 0} BWC</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Car size={isMyProperty ? 9 : 10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.vagas ?? 0} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Maximize size={isMyProperty ? 9 : 10} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.metragem ?? 0} m²</span>
            </span>
          </div>
        </div>

        {/* Bottom Row: Price & Actions */}
        <div className="flex items-center justify-between border-t border-slate-100/60 pt-1 mt-1">
          <div className="flex flex-col">
            {imovel.tipo === 'ambos' ? (
              <div className="flex flex-col">
                {imovel.valorAnterior && imovel.valorAnterior > imovel.valor ? (
                  <>
                    <span className={`text-slate-400 line-through font-semibold ${isMyProperty ? 'text-[8px]' : 'text-[7.5px]'}`}>
                      De {formatPrice(imovel.valorAnterior)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`font-bold text-slate-800 ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                        <span className="text-slate-400 font-normal text-[8px]">Por </span>{formatPrice(imovel.valor)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className={`font-extrabold text-[#003366] leading-tight ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                    {formatPrice(imovel.valor)} <span className="font-semibold text-slate-400 text-[8px]">(Venda)</span>
                  </span>
                )}
                <span className={`font-bold text-slate-700 leading-tight mt-0.5 ${isMyProperty ? 'text-[8px]' : 'text-[10px]'}`}>
                  {formatPrice(imovel.valorLocacao || 0)}<span className="font-normal text-slate-400 text-[8px]">/mês (Locação)</span>
                </span>
              </div>
            ) : imovel.tipo === 'locação' ? (
              imovel.valorLocacaoAnterior && imovel.valorLocacaoAnterior > (imovel.valorLocacao || imovel.valor) ? (
                <div className="flex flex-col leading-none">
                  <span className={`text-slate-400 line-through font-semibold ${isMyProperty ? 'text-[8px]' : 'text-[7.5px]'}`}>
                    De {formatPrice(imovel.valorLocacaoAnterior)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold text-slate-800 ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                      <span className="text-slate-400 font-normal text-[8px]">Por </span>{formatPrice(imovel.valorLocacao || imovel.valor)}
                      <span className="font-normal text-slate-400 text-[8px]"> /mês</span>
                    </span>
                  </div>
                </div>
              ) : (
                <span className={`font-extrabold text-slate-800 leading-tight ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                  {formatPrice(imovel.valorLocacao || imovel.valor)}
                  <span className="font-normal text-slate-400 text-[8px]"> /mês</span>
                </span>
              )
            ) : (
              imovel.valorAnterior && imovel.valorAnterior > imovel.valor ? (
                <div className="flex flex-col leading-none">
                  <span className={`text-slate-400 line-through font-semibold ${isMyProperty ? 'text-[8px]' : 'text-[7.5px]'}`}>
                    De {formatPrice(imovel.valorAnterior)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold text-slate-800 ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                      <span className="text-slate-400 font-normal text-[8px]">Por </span>{formatPrice(imovel.valor)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className={`font-extrabold text-[#003366] leading-tight ${isMyProperty ? 'text-[8px]' : 'text-[11px] sm:text-xs'}`}>
                  {formatPrice(imovel.valor)}
                </span>
              )
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-0.5">
            <div className="flex items-center gap-0.5 interactive-action">
              {onShareToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareToggle();
                  }}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    imovel.compartilhar ? 'text-[#003366] bg-[#003366]/5 hover:bg-[#003366]/10' : 'text-slate-400 hover:text-[#003366] hover:bg-slate-50'
                  }`}
                  title={imovel.compartilhar ? "Compartilhado" : "Compartilhar"}
                >
                  <Share2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
