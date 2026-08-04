/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Imovel } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Edit2, Trash2, Share2, EyeOff, Globe } from 'lucide-react';
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

  // Specs text (Linha 2): "Centro · 70m² · 2 dorms · 1 vaga"
  const specsParts: string[] = [];
  if (imovel.bairro?.trim()) specsParts.push(imovel.bairro.trim());
  if (imovel.metragem) specsParts.push(`${imovel.metragem}m²`);
  if (imovel.dormitorios) specsParts.push(`${imovel.dormitorios} dorm${imovel.dormitorios > 1 ? 's' : ''}`);
  if (imovel.vagas) specsParts.push(`${imovel.vagas} vaga${imovel.vagas > 1 ? 's' : ''}`);
  if (imovel.banheiros && !imovel.vagas) specsParts.push(`${imovel.banheiros} BWC`);

  const specsText = specsParts.join(' · ');

  const hasActions = isMyProperty && Boolean(onEdit || onShareToggle || onDelete);

  return (
    <motion.div
      whileHover={{ scale: 0.999 }}
      onClick={handleRowClick}
      className={`bg-white border rounded-[8px] px-2 py-1.5 sm:px-2.5 sm:py-1.5 cursor-pointer hover:border-slate-300 hover:shadow-xs transition-all w-full ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-blue-50/20' : 'border-slate-200'
      }`}
      id={`compact-row-${imovel.id}`}
    >
      <div className="flex items-center gap-2.5 w-full">
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

        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Linha 1: Nome do edifício + Selo de Status + Palavra destacada + Valor + Ações na mesma linha */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-[9px] font-medium text-slate-900 truncate min-w-0 leading-tight">
                {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio.trim() : imovel.titulo}
              </span>
              {!isMyProperty && imovel.statusImovel && (
                <span className="font-extrabold uppercase tracking-tight text-slate-800 bg-slate-100 border border-slate-200/80 px-1 py-[0.5px] rounded-full flex-shrink-0 text-[4px]">
                  {imovel.statusImovel}
                </span>
              )}
              {!isMyProperty && imovel.palavraDestacada?.trim() && (
                <span className="text-[4px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded flex-shrink-0 truncate max-w-[80px]">
                  {imovel.palavraDestacada.trim()}
                </span>
              )}
            </div>

            {/* Valor reduzido e Botões de ação na mesma linha das informações */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`text-right font-semibold text-slate-800 leading-tight ${isMyProperty ? 'text-[8px]' : 'text-xs'}`}>
                {imovel.tipo === 'ambos' ? (
                  <div className="flex flex-col text-right leading-tight">
                    <span>
                      {formatPrice(imovel.valor)}{' '}
                      <span className={`${isMyProperty ? 'text-[8px]' : 'text-[9.5px]'} font-normal text-slate-500`}>(Venda)</span>
                    </span>
                    <span>
                      {formatPrice(imovel.valorLocacao || 0)}
                      <span className={`${isMyProperty ? 'text-[8px]' : 'text-[9.5px]'} font-normal text-slate-500`}>/mês (Locação)</span>
                    </span>
                  </div>
                ) : imovel.tipo === 'locação' ? (
                  <span>
                    {formatPrice(imovel.valorLocacao || imovel.valor)}
                    <span className={`${isMyProperty ? 'text-[8px]' : 'text-[10px]'} font-normal text-slate-500`}>/mês</span>
                  </span>
                ) : (
                  <span>{formatPrice(imovel.valor)}</span>
                )}
              </div>

              {/* Botões de Ação na mesma linha das informações */}
              {hasActions && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2 interactive-action">
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="p-1 text-slate-400 hover:text-[#003366] transition-colors cursor-pointer"
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
                      className={`p-1 transition-colors cursor-pointer ${
                        imovel.compartilhar !== false
                          ? 'text-emerald-600 hover:text-emerald-700'
                          : 'text-slate-400 hover:text-[#003366]'
                      }`}
                      title={imovel.compartilhar !== false ? 'Imóvel disponível para corretores parceiros e para o site (Clique para alterar)' : 'Imóvel privado (Clique para disponibilizar)'}
                    >
                      {imovel.compartilhar !== false ? (
                        <Globe size={13} />
                      ) : (
                        <EyeOff size={13} />
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Linha 2: Especificações */}
          <div className={`${isMyProperty ? 'text-[8px]' : 'text-[11px]'} text-slate-500 truncate leading-tight mt-0.5`}>
            {specsText || 'Sem especificações'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

