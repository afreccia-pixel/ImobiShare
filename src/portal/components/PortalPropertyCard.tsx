/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin } from 'lucide-react';
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
  const enderecoFormatado = imovel.endereco
    ? (imovel.bairro ? `${imovel.endereco} - ${imovel.bairro}` : imovel.endereco)
    : [imovel.bairro, imovel.cidade].filter(Boolean).join(' - ');

  const quartosCount = imovel.dormitorios || imovel.quartos;
  const rawBanheiros = imovel.banheiros ?? (imovel as any).bwc;
  const banheirosCount = typeof rawBanheiros === 'number' ? rawBanheiros : (rawBanheiros ? parseInt(String(rawBanheiros), 10) : undefined);
  const hasMetragem = typeof imovel.metragem === 'number' && imovel.metragem > 0;
  const hasQuartos = typeof quartosCount === 'number' && quartosCount > 0;
  const hasBanheiros = typeof banheirosCount === 'number' && banheirosCount > 0;
  const hasVagas = typeof imovel.vagas === 'number' && imovel.vagas > 0;

  // Lógica de destaque do card:
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
    return diffDays <= 45;
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

  return (
    <article
      id={`portal-card-${imovel.id}`}
      onClick={handleClick}
      onMouseEnter={() => onHover?.(imovel.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border ${
        isHovered
          ? 'border-[#003366] shadow-lg ring-2 ring-[#003366]/10 -translate-y-0.5'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Container da Imagem com Proporção 4:3 rigorosa e uniforme */}
      <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
        <img
          src={mainPhoto}
          alt={imovel.titulo}
          onError={handleImageError}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
          referrerPolicy="no-referrer"
        />

        {/* Selo: Palavra destacada, Preço reduzido ou Novo (12px / 600 Desktop) */}
        {badgeLabel && (
          <div className="absolute top-3 left-3 z-1 pointer-events-none">
            <span
              className={`${badgeClasses} backdrop-blur-xs text-[10px] lg:text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-xs inline-block`}
            >
              {badgeLabel}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo do Card: Padding 14px a 16px, Hierarquia Desktop padronizada */}
      <div className="p-3.5 sm:p-4 space-y-2">
        {/* Título do Imóvel (16px / 600 Desktop) - Quebra de linha permitida para títulos longos */}
        <h3 className="text-sm lg:text-base font-semibold text-slate-900 tracking-tight leading-snug break-words">
          {imovel.titulo}
        </h3>

        {/* Localização (13px / 400-500 Desktop) */}
        {enderecoFormatado && (
          <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            <p className="text-xs lg:text-[13px] text-slate-500 font-normal lg:font-medium truncate" title={enderecoFormatado}>
              {enderecoFormatado}
            </p>
          </div>
        )}

        {/* Preço Principal (18px / 700 Desktop) + Preço Anterior (12px / 400-500) */}
        <div className="pt-1 flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-base lg:text-lg font-bold text-slate-900 tracking-tight block">
              {formatCurrencyBRL(imovel.valor)}
            </span>
            {imovel.valorAnterior && imovel.valorAnterior > imovel.valor && (
              <span className="text-xs font-normal lg:font-medium text-slate-400 line-through">
                De {formatCurrencyBRL(imovel.valorAnterior)}
              </span>
            )}
          </div>
        </div>

        {/* Características / Métricas (Números 13px / 600, Labels 11-12px) */}
        {(hasMetragem || hasQuartos || hasBanheiros || hasVagas) && (
          <div className="pt-1.5 border-t border-slate-100/90 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs lg:text-[13px] font-semibold text-slate-700">
            {[
              hasMetragem ? `${imovel.metragem} m²` : null,
              hasQuartos ? `${quartosCount} ${quartosCount === 1 ? 'quarto' : 'quartos'}` : null,
              hasBanheiros ? `${banheirosCount} ${banheirosCount === 1 ? 'banheiro' : 'banheiros'}` : null,
              hasVagas ? `${imovel.vagas} ${imovel.vagas === 1 ? 'vaga' : 'vagas'}` : null,
            ]
              .filter(Boolean)
              .map((item, index, arr) => (
                <React.Fragment key={index}>
                  <span>{item}</span>
                  {index < arr.length - 1 && <span className="text-slate-300 font-normal">•</span>}
                </React.Fragment>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

