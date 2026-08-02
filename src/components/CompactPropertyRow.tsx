/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel } from '../types';
import { motion } from 'motion/react';
import { MapPin, Heart, CheckCircle2, Bed, Car, Maximize, Edit2, Copy, Trash2, Share2, EyeOff } from 'lucide-react';
import { getValidImage, handleImageError } from '../utils/imageUtils';

interface CompactPropertyRowProps {
  key?: string | number;
  imovel: Imovel;
  isMyProperty: boolean;
  isSelected?: boolean;
  isFavorite?: boolean;
  showImage?: boolean;
  onSelectToggle?: () => void;
  onFavoriteToggle?: () => void;
  onShareToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick: () => void;
}

export function CompactPropertyRow({
  imovel,
  isMyProperty,
  isSelected = false,
  isFavorite = false,
  showImage = false,
  onSelectToggle,
  onFavoriteToggle,
  onShareToggle,
  onEdit,
  onDelete,
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

  // Determine status badge pill
  const getStatusBadge = () => {
    if (imovel.tipo === 'venda') {
      return { text: 'Venda', bg: 'bg-emerald-100 text-emerald-800' };
    }
    if (imovel.tipo === 'locação') {
      return { text: 'Aluguel', bg: 'bg-sky-100 text-sky-800' };
    }
    return { text: 'Venda/Aluguel', bg: 'bg-indigo-100 text-indigo-800' };
  };

  const statusBadge = getStatusBadge();

  // Specs text (Linha 2): "Centro · 70m² · 2 dorms · 1 vaga"
  const specsParts: string[] = [];
  if (imovel.bairro?.trim()) specsParts.push(imovel.bairro.trim());
  if (imovel.metragem) specsParts.push(`${imovel.metragem}m²`);
  if (imovel.dormitorios) specsParts.push(`${imovel.dormitorios} dorm${imovel.dormitorios > 1 ? 's' : ''}`);
  if (imovel.vagas) specsParts.push(`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`);
  if (imovel.banheiros && !imovel.vagas) specsParts.push(`${imovel.banheiros} BWC`);

  const specsText = specsParts.join(' · ');

  const hasSaleDiscount = Boolean(imovel.valorAnterior && imovel.valorAnterior > imovel.valor);
  const hasRentDiscount = Boolean(
    imovel.valorLocacaoAnterior && imovel.valorLocacaoAnterior > (imovel.valorLocacao || imovel.valor)
  );

  return (
    <motion.div
      whileHover={{ scale: 0.999 }}
      onClick={handleRowClick}
      className={`bg-white border rounded-[8px] px-2.5 py-2 sm:px-3 sm:py-2.5 cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all w-full ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-blue-50/20' : 'border-slate-200'
      }`}
      id={`compact-row-${imovel.id}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 w-full">

        {onSelectToggle ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle();
            }}
            className="checkbox-container cursor-pointer"
          >
            {isSelected ? (
              <CheckCircle2 size={16} className="text-[#003366] fill-[#003366]/10" />
            ) : (
              <div className="w-4 h-4 border border-slate-300 rounded bg-white hover:border-[#003366] transition-colors" />
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium text-slate-900 truncate min-w-0 leading-tight">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio.trim() : imovel.titulo}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 leading-none ${statusBadge.bg}`}>
              {statusBadge.text}
            </span>
            {imovel.palavraDestacada?.trim() && (
              <span className="text-[9.5px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded flex-shrink-0 truncate max-w-[80px]">
                {imovel.palavraDestacada.trim()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
            {specsText || 'Sem especificações'}
          </div>
        </div>

        <div className="text-right min-w-[95px] sm:min-w-[110px] leading-tight flex flex-col justify-center">
          {imovel.tipo === 'ambos' ? (
            <>
              {hasSaleDiscount && (
                <div className="text-[10px] text-slate-400 line-through leading-none mb-0.5 font-normal">
                  {formatPrice(imovel.valorAnterior!)}
                </div>
              )}
              <div className="text-[13px] sm:text-[14px] font-medium text-slate-900">
                {formatPrice(imovel.valor)}
              </div>
              <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                {formatPrice(imovel.valorLocacao || 0)}/mês
              </div>
            </>
          ) : imovel.tipo === 'locação' ? (
            <>
              {hasRentDiscount && (
                <div className="text-[10px] text-slate-400 line-through leading-none mb-0.5 font-normal">
                  {formatPrice(imovel.valorLocacaoAnterior!)}
                </div>
              )}
              <div className="text-[13px] sm:text-[14px] font-medium text-slate-900">
                {formatPrice(imovel.valorLocacao || imovel.valor)}
                <span className="text-[10px] font-normal text-slate-500">/mês</span>
              </div>
            </>
          ) : (
            <>
              {hasSaleDiscount && (
                <div className="text-[10px] text-slate-400 line-through leading-none mb-0.5 font-normal">
                  {formatPrice(imovel.valorAnterior!)}
                </div>
              )}
              <div className="text-[13px] sm:text-[14px] font-medium text-slate-900">
                {formatPrice(imovel.valor)}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 interactive-action pl-1">
          {isMyProperty ? (
            <>
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Editar Imóvel"
                >
                  <Edit2 size={13} />
                </button>
              )}
              {onShareToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareToggle();
                  }}
                  className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title={imovel.compartilhar ? 'Compartilhado' : 'Apenas eu'}
                >
                  {imovel.compartilhar ? <Share2 size={13} /> : <EyeOff size={13} />}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 size={13} className="text-red-600" />
                </button>
              )}
            </>
          ) : (
            onFavoriteToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFavoriteToggle();
                }}
                className="p-1 transition-colors cursor-pointer"
                title="Favoritar"
              >
                <Heart size={13} className={isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-400 hover:text-rose-500'} />
              </button>
            )
          )}
        </div>

      </div>
    </motion.div>
  );
}
