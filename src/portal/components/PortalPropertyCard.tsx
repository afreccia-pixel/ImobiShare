/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart } from 'lucide-react';
import { PortalProperty } from '../types';
import { formatCurrencyBRL } from '../data/mockPortalData';
import { getValidImage, handleImageError } from '../../utils/imageUtils';

interface PortalPropertyCardProps {
  imovel: PortalProperty;
  isHovered?: boolean;
  isFavorite?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
}

export function PortalPropertyCard({
  imovel,
  isHovered = false,
  isFavorite = false,
  onHover,
  onSelect,
  onToggleFavorite,
}: PortalPropertyCardProps) {
  const mainPhoto = getValidImage(imovel.fotos?.[0]);
  const isNaPlanta = imovel.statusImovel === 'Na planta' || imovel.isLancamento;
  const empreendimentoNome = imovel.nomeEdificio || imovel.titulo;
  const construtora = imovel.construtora || 'Baggio';

  const handleClick = () => {
    onSelect?.(imovel.id);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(imovel.id, e);
  };

  return (
    <article
      id={`portal-card-${imovel.id}`}
      onClick={handleClick}
      onMouseEnter={() => onHover?.(imovel.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border ${
        isHovered
          ? 'border-[#003366] shadow-lg ring-2 ring-[#003366]/10 -translate-y-0.5'
          : 'border-slate-100/90 hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Container da Imagem com Aspect Ratio elegante */}
      <div className="relative aspect-4/3 sm:aspect-16/11 bg-slate-100 overflow-hidden">
        <img
          src={mainPhoto}
          alt={empreendimentoNome}
          onError={handleImageError}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
          referrerPolicy="no-referrer"
        />

        {/* Selo LANÇAMENTO quando aplicável */}
        {isNaPlanta && (
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-[#0F172A]/90 backdrop-blur-xs text-white text-[9.5px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-xs">
              Lançamento
            </span>
          </div>
        )}

        {/* Botão Coração ♡ / ♥ */}
        <button
          type="button"
          id={`btn-fav-card-${imovel.id}`}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs hover:bg-white flex items-center justify-center transition-transform duration-150 active:scale-90 shadow-sm cursor-pointer"
        >
          <Heart
            size={16}
            className={`transition-colors ${
              isFavorite
                ? 'fill-rose-500 text-rose-500'
                : 'text-slate-600 hover:text-rose-500'
            }`}
          />
        </button>
      </div>

      {/* Conteúdo do Card */}
      <div className="p-4 space-y-2">
        {/* Preço */}
        <div>
          {isNaPlanta && (
            <span className="text-[11px] font-medium text-slate-400 block tracking-tight leading-tight">
              A partir de
            </span>
          )}
          <span className="text-lg font-black text-slate-900 tracking-tight block">
            {formatCurrencyBRL(imovel.valor)}
          </span>
        </div>

        {/* Área e Quartos */}
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-700 tracking-tight">
            {imovel.metragem} m² • {imovel.dormitorios || imovel.quartos} {((imovel.dormitorios || imovel.quartos) === 1) ? 'quarto' : 'quartos'}
          </p>
          <p className="text-xs text-slate-500 font-normal">
            {imovel.vagas} {imovel.vagas === 1 ? 'vaga' : 'vagas'}
          </p>
        </div>

        {/* Empreendimento e Construtora */}
        <div className="pt-1 border-t border-slate-50">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide truncate">
            {empreendimentoNome}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium truncate">
            {construtora}
          </p>
        </div>
      </div>
    </article>
  );
}
