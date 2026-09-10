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

  // Lógica de destaque do card:
  // 1. Palavra destacada (se cadastrada)
  // 2. Preço reduzido (se valor anterior for maior que o valor atual ou temDesconto)
  // 3. Imóvel novo (se cadastrado recentemente)
  const palavraDestacada =
    imovel.palavraDestacada && imovel.palavraDestacada.trim() !== ''
      ? imovel.palavraDestacada.trim()
      : null;

  const hasPrecoReduzido = Boolean(
    (typeof imovel.valorAnterior === 'number' && imovel.valorAnterior > imovel.valor) ||
    imovel.temDesconto
  );

  const isNovo = (() => {
    if ((imovel as any).isNovo === true) return true;
    if (!imovel.dataCadastro) return false;
    const created = new Date(imovel.dataCadastro).getTime();
    if (isNaN(created)) return false;
    const diffDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return diffDays <= 45; // Cadastrado recentemente
  })();

  let badgeLabel: string | null = null;
  let badgeClasses = 'bg-[#003366] text-white';

  if (palavraDestacada) {
    badgeLabel = palavraDestacada;
    badgeClasses = 'bg-[#003366] text-white';
  } else if (hasPrecoReduzido) {
    badgeLabel = 'Preço reduzido';
    badgeClasses = 'bg-emerald-700 text-white';
  } else if (isNovo) {
    badgeLabel = 'Novo';
    badgeClasses = 'bg-blue-600 text-white';
  }

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

        {/* Selo: Palavra destacada, Preço reduzido ou Novo */}
        {badgeLabel && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className={`${badgeClasses} backdrop-blur-xs text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs`}
            >
              {badgeLabel}
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
