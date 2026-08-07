/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Edit2, Trash2, Share2, EyeOff, Globe, Handshake, Star } from 'lucide-react';
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
  onWebsiteToggle?: () => void;
  onShareToggle?: () => void;
  onShareSingle?: () => void;
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
  onWebsiteToggle,
  onShareToggle,
  onShareSingle,
  onEdit,
  onDelete,
  onClick,
}: CompactPropertyRowProps) {
  const isParceriaActive = imovel.compartilhar !== false && imovel.compartilhar !== 'NAO';
  const isWebsiteActive = imovel.website !== 'NAO';
  const isFav = Boolean(isFavorite || imovel.favorito);

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

  // Specs text (Linha 2): "Centro · 70m² · 2 dorms · 1 vaga"
  const specsParts: string[] = [];
  if (imovel.bairro?.trim()) specsParts.push(imovel.bairro.trim());
  if (imovel.metragem) specsParts.push(`${imovel.metragem}m²`);
  if (imovel.dormitorios) specsParts.push(`${imovel.dormitorios} dorm${imovel.dormitorios > 1 ? 's' : ''}`);
  if (imovel.vagas) specsParts.push(`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`);
  if (imovel.banheiros && !imovel.vagas) specsParts.push(`${imovel.banheiros} BWC`);

  const specsText = specsParts.join(' · ');

  const hasActions = Boolean(onEdit || onShareToggle || onWebsiteToggle || onFavoriteToggle || onShareSingle || onDelete);

  return (
    <motion.div
      whileHover={{ scale: 0.999 }}
      onClick={handleRowClick}
      className={`bg-white border rounded-lg p-1.5 sm:p-2 cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all w-full ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-blue-50/20' : 'border-slate-200'
      }`}
      id={`compact-row-${imovel.id}`}
    >
      <div className="flex items-center gap-2 w-full">
        {onSelectToggle && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectToggle();
            }}
            className="checkbox-container cursor-pointer flex-shrink-0"
          >
            {isSelected ? (
              <CheckCircle2 size={14} className="text-[#003366] fill-[#003366]/10" />
            ) : (
              <div className="w-3.5 h-3.5 border border-slate-300 rounded bg-white hover:border-[#003366] transition-colors" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Linha 1: Nome do edifício + Valor + Ações na mesma linha */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className="text-[11px] sm:text-xs font-bold text-slate-900 truncate min-w-0 leading-tight">
                {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio.trim() : imovel.titulo}
              </span>
            </div>

            {/* Valor padronizado e Botões de ação na mesma linha das informações */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="text-right font-extrabold text-[#003366] leading-tight text-[11px] sm:text-xs">
                {(((imovel.valor && imovel.valor > 0) || (imovel.valorVenda && imovel.valorVenda > 0)) && imovel.valorLocacao && imovel.valorLocacao > 0) || imovel.tipo === 'ambos' ? (
                  <div className="flex flex-col text-right leading-tight">
                    <span>
                      {formatPrice(imovel.valor || imovel.valorVenda || 0)}
                    </span>
                    <span className="text-emerald-800 font-bold text-[10px]">
                      {formatPrice(imovel.valorLocacao || 0)}
                      <span className="text-[8px] font-normal text-slate-500">/mês</span>
                    </span>
                  </div>
                ) : imovel.tipo === 'locação' ? (
                  <span>
                    {formatPrice(imovel.valorLocacao || imovel.valor)}
                    <span className="text-[9px] font-normal text-slate-500"> /mês</span>
                  </span>
                ) : (
                  <span>{formatPrice(imovel.valor)}</span>
                )}
              </div>

              {/* Botões de Ação na mesma linha das informações */}
              {hasActions && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 interactive-action">
                  {onFavoriteToggle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFavoriteToggle();
                      }}
                      className={`p-0.5 transition-colors cursor-pointer rounded-xs ${
                        isFav ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500'
                      }`}
                      title={isFav ? '⭐ Favorito (Clique para remover)' : '⭐ Favorito (Clique para adicionar)'}
                    >
                      <Star size={12} className={isFav ? 'fill-amber-400' : ''} />
                    </button>
                  )}

                  {onShareSingle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareSingle();
                      }}
                      className="p-0.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer rounded-xs"
                      title="Compartilhar Link do Imóvel"
                    >
                      <Share2 size={12} />
                    </button>
                  )}

                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="p-0.5 text-slate-500 hover:text-[#003366] transition-colors cursor-pointer"
                      title="Alterar Imóvel"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}

                  {onWebsiteToggle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWebsiteToggle();
                      }}
                      className={`p-0.5 transition-colors cursor-pointer rounded-xs ${
                        isWebsiteActive ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-blue-600'
                      }`}
                      title={isWebsiteActive ? '🌐 Publicado no Website (Clique para alterar)' : '🌐 Oculto do Website (Clique para alterar)'}
                    >
                      <Globe size={12} />
                    </button>
                  )}

                  {onShareToggle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareToggle();
                      }}
                      className={`p-0.5 transition-colors cursor-pointer rounded-xs ${
                        isParceriaActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 hover:text-emerald-600'
                      }`}
                      title={isParceriaActive ? '🤝 Parceria Ativa (Clique para alterar)' : '🤝 Parceria Inativa (Clique para alterar)'}
                    >
                      <Handshake size={12} />
                    </button>
                  )}

                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="p-0.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Linha 2: Especificações */}
          <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
            {specsText || 'Sem especificações'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

