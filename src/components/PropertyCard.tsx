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

function PropertyCardComponent({
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

  // Helper para mostrar SOMENTE a rua (sem bairro e sem cidade)
  const getOnlyStreet = () => {
    let raw = (imovel.endereco || imovel.localizacao || '').trim();
    const bairro = (imovel.bairro || '').trim();
    const cidade = (imovel.cidade || '').trim();

    if (!raw) {
      return 'Endereço sob consulta';
    }

    // Se o valor salvo for exatamente o bairro ou cidade, não há rua informada
    if (bairro && raw.toLowerCase() === bairro.toLowerCase()) {
      return 'Endereço sob consulta';
    }
    if (cidade && raw.toLowerCase() === cidade.toLowerCase()) {
      return 'Endereço sob consulta';
    }

    // Remove menção de cidade se estiver no final (ex: " - Balneário Camboriú" ou ", Balneário Camboriú/SC")
    if (cidade) {
      const cityRegex = new RegExp(`(\\s*[-·,/]\\s*)?${cidade}\\s*([-/]\\s*[A-Za-z]{2})?$`, 'i');
      raw = raw.replace(cityRegex, '').trim();
    }

    // Remove menção de bairro se estiver no final (ex: " - Pioneiros" ou ", Centro")
    if (bairro) {
      const bairroRegex = new RegExp(`(\\s*[-·,/]\\s*)?${bairro}\\b.*$`, 'i');
      raw = raw.replace(bairroRegex, '').trim();
    }

    // Se ainda houver separador " - " ou " · ", pegar a primeira parte (que é a rua)
    if (raw.includes(' - ')) {
      const parts = raw.split(' - ');
      raw = parts[0].trim();
    } else if (raw.includes(' · ')) {
      const parts = raw.split(' · ');
      raw = parts[0].trim();
    }

    // Limpar pontuações residuais no final
    raw = raw.replace(/[,\-·.]+$/, '').trim();

    return raw || 'Endereço sob consulta';
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on checkboxes, buttons or icons, don't trigger details
    const target = e.target as HTMLElement;
    if (target.closest('.interactive-action') || target.closest('.checkbox-container')) {
      return;
    }
    onClick();
  };

  const isTerreno = imovel.tipoImovel === 'Terreno';
  const isComercial = imovel.tipoImovel === 'Comercial';
  const hasDorms = !isComercial && !isTerreno && Boolean(imovel.dormitorios);
  const hasVagas = !isTerreno && Boolean(imovel.vagas);
  const hasBanheiros = !isTerreno && Boolean(imovel.banheiros);
  const hasMetragem = Boolean(imovel.metragem);

  return (
    <div
      onClick={handleCardClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 118px' }}
      className={`bg-white border rounded-xl overflow-hidden shadow-2xs hover:shadow-xs transition-all duration-150 hover:-translate-y-0.5 will-change-transform flex flex-row p-1.5 sm:p-2 gap-2 sm:gap-2.5 items-stretch cursor-pointer ${
        isSelected ? 'border-[#003366] ring-1 ring-[#003366]/20 bg-blue-50/20' : 'border-slate-100 hover:border-slate-200'
      }`}
      id={`property-card-${imovel.id}`}
    >
      {/* Property Image Container (Foto à esquerda aumentada levemente) */}
      <div className="relative w-32 sm:w-36 h-26 sm:h-28 flex-shrink-0 self-center rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
        <img
          src={getValidImage(imovel.fotos?.[0])}
          alt={imovel.titulo || ''}
          loading="lazy"
          decoding="async"
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Private view badge if not shared */}
        {!imovel.compartilhar && (
          <span
            className="absolute bottom-1 right-1 bg-slate-950/80 backdrop-blur-xs text-white p-1 rounded-full shadow-xs z-10"
            title="Visível apenas para você"
          >
            <EyeOff size={10} />
          </span>
        )}
      </div>

      {/* Content Details (Informações à direita) */}
      <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5 gap-0.5 sm:gap-1">
        <div>
          {/* Top Row: Title & Checkbox com área de toque aumentada */}
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-bold text-slate-900 tracking-tight leading-tight line-clamp-1 text-xs sm:text-[13px]">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
              {imovel.unidade ? ` • Apto ${imovel.unidade}` : ''}
              {imovel.bloco ? ` (${imovel.bloco})` : ''}
            </h3>

            {/* Checkbox for Multi-Select com área de toque ampliada */}
            {showCheckbox && onSelectToggle && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectToggle();
                }}
                className="checkbox-container p-1 -m-1 cursor-pointer flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 transition-colors"
                title={isSelected ? 'Desmarcar' : 'Selecionar'}
              >
                {isSelected ? (
                  <CheckCircle2 size={18} className="text-[#003366] fill-[#003366]/15" />
                ) : (
                  <div className="w-4 h-4 border-2 border-slate-300 rounded hover:border-[#003366] transition-colors" />
                )}
              </button>
            )}
          </div>

          {/* Especificações do imóvel: quartos, BWC, vagas e área organizados na ordem exata */}
          {(hasMetragem || hasDorms || hasBanheiros || hasVagas) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600 font-medium text-[10px] sm:text-[11px] leading-normal mt-0.5">
              {hasDorms && (
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <Bed size={11} className="text-slate-400 flex-shrink-0" />
                  <span>{imovel.dormitorios} {imovel.dormitorios === 1 ? 'quarto' : 'quartos'}</span>
                </span>
              )}
              {hasBanheiros && (
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <Bath size={10} className="text-slate-400 flex-shrink-0" />
                  <span>{imovel.banheiros} {imovel.banheiros === 1 ? 'BWC' : 'BWCs'}</span>
                </span>
              )}
              {hasVagas && (
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <Car size={10} className="text-slate-400 flex-shrink-0" />
                  <span>{imovel.vagas} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
                </span>
              )}
              {hasMetragem && (
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <Maximize size={10} className="text-slate-400 flex-shrink-0" />
                  <span>{imovel.metragem} m²</span>
                </span>
              )}
            </div>
          )}

          {/* Endereço: apenas a rua, sem bairro e sem cidade */}
          <div className="flex items-center text-slate-400 mt-0.5 font-medium text-[10px] sm:text-[10.5px] truncate" title={getOnlyStreet()}>
            <MapPin size={10} className="mr-1 flex-shrink-0 text-slate-400" />
            <span className="truncate">{getOnlyStreet()}</span>
          </div>
        </div>

        {/* Linha Inferior: Valor e Ações */}
        <div className="flex items-center justify-between border-t border-slate-100/70 pt-1 mt-0.5">
          {/* Valor */}
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

          {/* Action Row com botões com área de toque aumentada */}
          <div className="flex items-center gap-0.5 interactive-action">
            {onFavoriteToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavoriteToggle();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isFav ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'
                }`}
                title={isFav ? '⭐ Favorito (Clique para remover)' : '⭐ Adicionar aos Favoritos'}
              >
                <Star size={13} className={isFav ? 'fill-amber-400' : ''} />
              </button>
            )}

            {/* Botão de Compartilhar com área de toque aumentada (w-7.5 h-7.5 / w-8 h-8) */}
            {onShareSingle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShareSingle();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
                title="Compartilhar Link do Imóvel"
              >
                <Share2 size={14} />
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-[#003366] hover:bg-slate-50 transition-colors cursor-pointer"
                title="Alterar Imóvel"
              >
                <Edit2 size={13} />
              </button>
            )}

            {onWebsiteToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWebsiteToggle();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isWebsiteActive ? 'text-blue-600 bg-blue-50 border border-blue-200/60' : 'text-slate-300 hover:text-blue-600 hover:bg-slate-50'
                }`}
                title={isWebsiteActive ? '🌐 Publicado no Website (Clique para ocultar)' : '🌐 Oculto do Website (Clique para publicar)'}
              >
                <Globe size={13} />
              </button>
            )}

            {onShareToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShareToggle();
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isParceriaActive ? 'text-emerald-600 bg-emerald-50 border border-emerald-200/60' : 'text-slate-300 hover:text-emerald-600 hover:bg-slate-50'
                }`}
                title={isParceriaActive ? '🤝 Parceria Ativa - Compartilhado na Rede (Clique para ocultar)' : '🤝 Parceria Inativa (Clique para disponibilizar parcerias)'}
              >
                <Handshake size={13} />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Excluir"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PropertyCard = React.memo(PropertyCardComponent, (prev, next) => {
  return (
    prev.imovel.id === next.imovel.id &&
    prev.imovel.dataCadastro === next.imovel.dataCadastro &&
    prev.imovel.valor === next.imovel.valor &&
    prev.imovel.valorLocacao === next.imovel.valorLocacao &&
    prev.isSelected === next.isSelected &&
    prev.isFavorite === next.isFavorite &&
    prev.isMyProperty === next.isMyProperty &&
    prev.showCheckbox === next.showCheckbox
  );
});
