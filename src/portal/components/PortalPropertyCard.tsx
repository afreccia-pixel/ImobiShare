/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, MapPin } from 'lucide-react';
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
  const enderecoFormatado = imovel.endereco
    ? (imovel.bairro ? `${imovel.endereco} - ${imovel.bairro}` : imovel.endereco)
    : [imovel.bairro, imovel.cidade].filter(Boolean).join(' - ');

  const quartosCount = imovel.dormitorios || imovel.quartos;
  const hasMetragem = typeof imovel.metragem === 'number' && imovel.metragem > 0;
  const hasQuartos = typeof quartosCount === 'number' && quartosCount > 0;
  const hasVagas = typeof imovel.vagas === 'number' && imovel.vagas > 0;

  // Nome do empreendimento / edifício ou título
  const nomeEmpreendimento = imovel.nomeEdificio && imovel.nomeEdificio.trim() !== ''
    ? imovel.nomeEdificio.trim()
    : (imovel.titulo && imovel.titulo.trim() !== '' ? imovel.titulo.trim() : '');

  // Construtora (ocultar se não existir ou se for texto genérico)
  const construtoraValida = imovel.construtora && 
    imovel.construtora.trim() !== '' && 
    !imovel.construtora.toLowerCase().includes('não informada') &&
    !imovel.construtora.toLowerCase().includes('indefinid')
    ? imovel.construtora.trim()
    : null;

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
          alt={imovel.titulo}
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
        {/* Preço (com 'A partir de' para lançamentos conforme instrução 6) */}
        <div>
          {isNaPlanta && (
            <span className="text-[11px] font-medium text-slate-500 block leading-tight">
              A partir de
            </span>
          )}
          <span className="text-lg font-black text-slate-900 tracking-tight block">
            {formatCurrencyBRL(imovel.valor)}
          </span>
        </div>

        {/* Área Privativa e Quartos - Oculta campos inexistentes, sem exibir undefined ou 0 quartos */}
        {(hasMetragem || hasQuartos) && (
          <p className="text-xs font-semibold text-slate-700 tracking-tight">
            {hasMetragem && `${imovel.metragem} m²`}
            {hasMetragem && hasQuartos && ' • '}
            {hasQuartos && `${quartosCount} ${quartosCount === 1 ? 'quarto' : 'quartos'}`}
          </p>
        )}

        {/* Vagas - Oculta quando não existir ou for 0 */}
        {hasVagas && (
          <p className="text-xs text-slate-500 font-normal">
            {imovel.vagas} {imovel.vagas === 1 ? 'vaga' : 'vagas'}
          </p>
        )}

        {/* Nome do Edifício / Empreendimento */}
        {nomeEmpreendimento && (
          <p className="text-xs font-bold text-slate-800 tracking-tight truncate" title={nomeEmpreendimento}>
            {nomeEmpreendimento}
          </p>
        )}

        {/* Construtora - Ocultar quando não existir, nunca exibir "Construtora não informada" */}
        {construtoraValida && (
          <p className="text-[11px] font-medium text-slate-500 truncate" title={construtoraValida}>
            {construtoraValida}
          </p>
        )}

        {/* Localização */}
        {enderecoFormatado && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-slate-500 min-w-0">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500 font-medium truncate" title={enderecoFormatado}>
              {enderecoFormatado}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
