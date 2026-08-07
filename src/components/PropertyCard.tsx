/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel, Corretor } from '../types';
import { motion } from 'motion/react';
import { Star, Edit2, Copy, Trash2, MapPin, EyeOff, Eye, CheckCircle2, Bed, Car, Maximize, Bath, Globe, Handshake, Share2 } from 'lucide-react';
import { getValidImage, handleImageError } from '../utils/imageUtils';

interface PropertyCardProps {
  key?: string | number;
  imovel: Imovel;
  isMyProperty: boolean;
  isSelected?: boolean;
  isFavorite?: boolean;
  onSelectToggle?: () => void;
  onFavoriteToggle?: () => void;
  onWebsiteToggle?: () => void;
  onShareToggle?: () => void;
  onShareSingle?: () => void;
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
  onWebsiteToggle,
  onShareToggle,
  onShareSingle,
  onEdit,
  onDelete,
  onDuplicate,
  onClick,
  showCheckbox = false,
}: PropertyCardProps) {
  // Helpers
  const isParceriaActive = imovel.compartilhar !== false && imovel.compartilhar !== 'NAO';
  const isWebsiteActive = imovel.website !== 'NAO';
  const isFav = Boolean(isFavorite || imovel.favorito);
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
      className={`bg-white border rounded-lg overflow-hidden shadow-2xs hover:shadow-xs transition-all flex flex-row p-2 gap-2 items-stretch cursor-pointer ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-[#003366]/[0.01]' : 'border-slate-100'
      }`}
      id={`property-card-${imovel.id}`}
    >
      {/* Property Image Container */}
      <div className="relative w-24 sm:w-28 h-20 sm:h-24 flex-shrink-0 self-center rounded-md overflow-hidden bg-slate-100 border border-slate-100">
        <img
          src={getValidImage(imovel.fotos?.[0])}
          alt=""
          loading="lazy"
          decoding="async"
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Private view badge if not shared */}
        {!imovel.compartilhar && (
          <span className="absolute bottom-1 right-1 bg-slate-950/80 backdrop-blur-xs text-white p-0.5 rounded-full shadow-xs z-10" title="Visível apenas para você">
            <EyeOff size={8} />
          </span>
        )}
      </div>

      {/* Content Details */}
      <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5 gap-1">
        <div>
          {/* Top Row: Title & Optional Checkbox */}
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-bold text-slate-900 tracking-tight leading-tight line-clamp-1 text-[11px] sm:text-xs">
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
                  <CheckCircle2 size={14} className="text-[#003366] fill-[#003366]/10" />
                ) : (
                  <div className="w-3.5 h-3.5 border border-slate-300 rounded bg-white hover:border-[#003366] transition-colors" />
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center text-slate-400 mt-0.5 font-medium text-[10px] truncate">
            <MapPin size={10} className="mr-0.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{imovel.bairro}</span>
          </div>

          {/* Essentials row instead of Description */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-slate-600 mt-0.5 bg-slate-50 py-0.5 px-1.5 rounded border border-slate-100/60 w-fit font-medium text-[9px]">
            <span className="flex items-center gap-0.5">
              <Bed size={9} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Bath size={9} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.banheiros ?? 0} BWC</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Car size={9} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.vagas ?? 0} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-0.5">
              <Maximize size={9} className="text-slate-400 flex-shrink-0" />
              <span>{imovel.metragem ?? 0} m²</span>
            </span>
          </div>
        </div>

        {/* Bottom Row: Price & Actions */}
        <div className="flex items-center justify-between border-t border-slate-100/60 pt-0.5 mt-0.5">
          <div className="flex flex-col">
            {(((imovel.valor && imovel.valor > 0) || (imovel.valorVenda && imovel.valorVenda > 0)) && imovel.valorLocacao && imovel.valorLocacao > 0) || imovel.tipo === 'ambos' ? (
              <div className="flex flex-col leading-tight">
                {imovel.valorAnterior && imovel.valorAnterior > (imovel.valor || imovel.valorVenda || 0) ? (
                  <span className="text-slate-400 line-through font-semibold text-[8px]">
                    De {formatPrice(imovel.valorAnterior)}
                  </span>
                ) : null}
                <span className="font-extrabold text-[#003366] text-xs leading-tight">
                  {formatPrice(imovel.valor || imovel.valorVenda || 0)}
                </span>
                <span className="font-extrabold text-emerald-800 text-[10px] leading-tight">
                  {formatPrice(imovel.valorLocacao || 0)}<span className="font-normal text-slate-400 text-[8px]">/mês</span>
                </span>
              </div>
            ) : imovel.tipo === 'locação' ? (
              imovel.valorLocacaoAnterior && imovel.valorLocacaoAnterior > (imovel.valorLocacao || imovel.valor) ? (
                <div className="flex flex-col leading-none">
                  <span className="text-slate-400 line-through font-semibold text-[8px]">
                    De {formatPrice(imovel.valorLocacaoAnterior)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-[#003366] text-xs">
                      <span className="text-slate-400 font-normal text-[8px]">Por </span>{formatPrice(imovel.valorLocacao || imovel.valor)}
                      <span className="font-normal text-slate-400 text-[8px]"> /mês</span>
                    </span>
                  </div>
                </div>
              ) : (
                <span className="font-extrabold text-[#003366] leading-tight text-xs">
                  {formatPrice(imovel.valorLocacao || imovel.valor)}
                  <span className="font-normal text-slate-400 text-[8px]"> /mês</span>
                </span>
              )
            ) : (
              imovel.valorAnterior && imovel.valorAnterior > imovel.valor ? (
                <div className="flex flex-col leading-none">
                  <span className="text-slate-400 line-through font-semibold text-[8px]">
                    De {formatPrice(imovel.valorAnterior)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-[#003366] text-xs">
                      <span className="text-slate-400 font-normal text-[8px]">Por </span>{formatPrice(imovel.valor)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="font-extrabold text-[#003366] leading-tight text-xs">
                  {formatPrice(imovel.valor)}
                </span>
              )
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 interactive-action">
              {onFavoriteToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavoriteToggle();
                  }}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${
                    isFav ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'
                  }`}
                  title={isFav ? '⭐ Favorito (Clique para remover)' : '⭐ Adicionar aos Favoritos'}
                >
                  <Star size={13} className={isFav ? 'fill-amber-400' : ''} />
                </button>
              )}

              {onShareSingle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareSingle();
                  }}
                  className="p-1 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer"
                  title="Compartilhar Link do Imóvel"
                >
                  <Share2 size={13} />
                </button>
              )}

              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1 text-slate-500 hover:text-[#003366] transition-colors cursor-pointer"
                  title="Alterar Imóvel"
                >
                  <Edit2 size={13} />
                </button>
              )}

              {onWebsiteToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWebsiteToggle();
                  }}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${
                    isWebsiteActive ? 'text-blue-600 bg-blue-50 border border-blue-200/60' : 'text-slate-300 hover:text-blue-600 hover:bg-slate-50'
                  }`}
                  title={isWebsiteActive ? '🌐 Publicado no Website (Clique para ocultar)' : '🌐 Oculto do Website (Clique para publicar)'}
                >
                  <Globe size={13} />
                </button>
              )}

              {onShareToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareToggle();
                  }}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${
                    isParceriaActive ? 'text-emerald-600 bg-emerald-50 border border-emerald-200/60' : 'text-slate-300 hover:text-emerald-600 hover:bg-slate-50'
                  }`}
                  title={isParceriaActive ? '🤝 Parceria Ativa - Compartilhado na Rede (Clique para ocultar)' : '🤝 Parceria Inativa (Clique para disponibilizar parcerias)'}
                >
                  <Handshake size={13} />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
