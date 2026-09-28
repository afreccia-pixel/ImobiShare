/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  ArrowLeft,
  Building2,
  Check,
  Bed,
  Car,
  Maximize,
  Bath,
  Heart,
  Share2,
  Calendar,
  Images,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { PortalProperty } from '../types';
import { getValidImage, handleImageError } from '../../utils/imageUtils';
import { getPropertyCode } from '../../utils/codeUtils';
import { DbService } from '../../services/db';
import { LOGO_IMAGE } from '../../assets/logo';
import { PortalGalleryModal } from '../components/PortalGalleryModal';
import { PortalScheduleModal } from '../components/PortalScheduleModal';

interface PortalPropertyDetailPageProps {
  imovel: PortalProperty;
  isFavorite?: boolean;
  fromMap?: boolean;
  onToggleFavorite?: (id: string) => void;
  onClose: () => void;
  onGoHome?: () => void;
}

/**
 * Extrai o nome do logradouro (rua/avenida) removendo o número predial
 * Ex: "Avenida Brasil, 1500" -> "Avenida Brasil"
 * Ex: "Rua 1500, nº 45" -> "Rua 1500"
 */
function getStreetWithoutNumber(endereco?: string, localizacao?: string): string {
  const raw = endereco?.trim() || localizacao?.trim() || '';
  if (!raw) return 'Rua sem o número';

  let street = raw.split(',')[0].trim();

  if (street.includes(' - ')) {
    const parts = street.split(' - ');
    street = parts[0].trim();
  }

  street = street.replace(/[\s,]+(nº|n°|num|número|\d+).*$/i, '').trim();

  const lower = street.toLowerCase();
  if (!street || lower === 'balneário camboriú' || lower === 'centro' || lower === 'sc') {
    return 'Rua sem o número';
  }

  return street;
}

/**
 * Calcula a data relativa ou retorna a menção padrão solicitada
 */
function getRelativePublicationDate(property: PortalProperty): string {
  const dateStr =
    property.dataPublicacao ||
    (property as any).dataAtualizacao ||
    property.dataCadastro ||
    (property as any).updatedAt ||
    (property as any).createdAt;

  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const diffMs = Date.now() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths >= 1) {
          return `Publicado há ${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'}`;
        }
        if (diffDays >= 1) {
          return `Publicado há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
        }
        return 'Publicado recentemente';
      }
    } catch {
      // Ignora erro e usa o padrão
    }
  }

  return 'Publicado há 7 meses';
}

export function PortalPropertyDetailPage({
  imovel,
  isFavorite = false,
  onToggleFavorite,
  onClose,
  onGoHome,
}: PortalPropertyDetailPageProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const mobileThumbnailsRef = useRef<HTMLDivElement>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const [fullImovel, setFullImovel] = useState<Partial<PortalProperty> | null>(() => {
    return imovel.descricao ? imovel : null;
  });
  const [loadingFull, setLoadingFull] = useState(!imovel.descricao);
  const [fullFotos, setFullFotos] = useState<string[]>(imovel.fotos || []);

  // Rola a página para o topo ao abrir o imóvel
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [imovel.id]);

  // Rola suavemente para centralizar a miniatura selecionada (apenas no mobile)
  useEffect(() => {
    if (mobileThumbnailsRef.current && mobileThumbnailsRef.current.children[activePhotoIndex]) {
      (mobileThumbnailsRef.current.children[activePhotoIndex] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activePhotoIndex]);

  // Carrega detalhes completos do imóvel
  useEffect(() => {
    let isMounted = true;
    if (imovel.id) {
      if (!imovel.descricao) setLoadingFull(true);
      DbService.getImovelById(imovel.id)
        .then((full) => {
          if (isMounted && full) {
            setFullImovel(full);
            if (Array.isArray(full.fotos) && full.fotos.length > 0) {
              setFullFotos(full.fotos);
            }
          }
        })
        .catch((err) => {
          console.error('[PortalPropertyDetailPage] Erro ao carregar detalhes completos:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingFull(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [imovel.id]);

  const currentProperty: PortalProperty = {
    ...imovel,
    ...(fullImovel || {}),
    fotos: fullFotos.length > 0 ? fullFotos : imovel.fotos || [],
  };

  const fotos =
    currentProperty.fotos && currentProperty.fotos.length > 0
      ? currentProperty.fotos
      : ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&auto=format&fit=crop&q=85'];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartPos.x;
    const diffY = Math.abs(endY - touchStartPos.y);

    // Gesto de voltar da borda no mobile
    if ((touchStartPos.x < 75 && diffX > 35 && diffX > diffY * 0.8) || (diffX > 65 && diffX > diffY * 1.2)) {
      onClose();
      setTouchStartPos(null);
      return;
    }

    // Carrossel de fotos por gesto
    if (Math.abs(diffX) > 35 && diffX > diffY * 0.8 && fotos.length > 1) {
      if (diffX < 0) {
        setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
      } else if (activePhotoIndex > 0) {
        setActivePhotoIndex((prev) => prev - 1);
      }
    }
    setTouchStartPos(null);
  };

  // Formatador de preço
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Link público do imóvel
  const publicLink = `${window.location.origin}/?imovel=${currentProperty.id.replace('imovel-', '')}`;

  const handleShare = async () => {
    if (navigator.share && navigator.canShare) {
      try {
        await navigator.share({
          title: currentProperty.titulo,
          text: `${currentProperty.titulo} - ImobiShare`,
          url: publicLink,
        });
        return;
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(publicLink);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2500);
    } catch {
      alert('Link do imóvel copiado!');
    }
  };

  const enderecoFormatado = currentProperty.endereco?.trim()
    ? `${currentProperty.endereco}${
        currentProperty.bairro &&
        !currentProperty.endereco.toLowerCase().includes(currentProperty.bairro.toLowerCase())
          ? ` · ${currentProperty.bairro}`
          : ''
      }${currentProperty.cidade ? ` - ${currentProperty.cidade}` : ''}`
    : currentProperty.localizacao ||
      `${currentProperty.bairro || ''}${currentProperty.cidade ? ` - ${currentProperty.cidade}` : ''}` ||
      'Localização não informada';

  const quartosCount = currentProperty.dormitorios ?? currentProperty.quartos ?? 0;
  const banheirosCount = currentProperty.banheiros ?? 0;
  const vagasCount = currentProperty.vagas ?? 0;
  const metragemCount = currentProperty.metragem ?? 0;

  // Variáveis para Breadcrumb do computador
  const cidadeFormatada = currentProperty.cidade?.trim() || 'Balneário Camboriú';
  const bairroFormatado = currentProperty.bairro?.trim() || 'Centro';
  const streetWithoutNumber = getStreetWithoutNumber(currentProperty.endereco, currentProperty.localizacao);
  const codigoImovel = getPropertyCode(currentProperty) || '2217893';
  const dataAtualizacaoTexto = getRelativePublicationDate(currentProperty);

  return (
    <div
      className="bg-slate-50 min-h-screen pb-16 touch-pan-y"
      id={`portal-property-details-${imovel.id}`}
    >
      {/* ========================================================================= */}
      {/* 1. VISUALIZAÇÃO CELULAR (MOBILE) - < lg                                   */}
      {/* - Sem contador de fotos na galeria                                        */}
      {/* - Sem o responsável pelo imóvel                                           */}
      {/* - Indicação destacada "Publicado há 7 meses" em baixo do código do imóvel */}
      {/* ========================================================================= */}
      <div className="block lg:hidden">
        {/* Header no estilo do corretor com Voltar e Título */}
        <div className="bg-white border-b border-slate-100 px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <button
            type="button"
            id="btn-voltar-topo"
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-[#003366] hover:bg-slate-100 rounded-full transition-colors flex items-center cursor-pointer"
            title="Voltar para a busca"
          >
            <ArrowLeft size={20} className="mr-1" />
            <span className="text-xs font-semibold">Voltar</span>
          </button>

          <span className="font-bold text-slate-800 text-sm">Visualização de Imóvel</span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="btn-favoritar-mobile"
              onClick={() => onToggleFavorite?.(imovel.id)}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                isFavorite
                  ? 'text-rose-600 bg-rose-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              aria-label="Favoritar"
            >
              <Heart size={19} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
            </button>

            <button
              type="button"
              id="btn-compartilhar-mobile"
              onClick={handleShare}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Compartilhar"
              aria-label="Compartilhar"
            >
              <Share2 size={19} />
            </button>
          </div>
        </div>

        {/* Conteúdo Centralizado Mobile */}
        <div
          className="max-w-xl mx-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Galeria de Fotos 4:3 com Dots (SEM contador de fotos na galeria conforme solicitado) */}
          <div
            className="relative aspect-4/3 bg-slate-900 overflow-hidden select-none touch-pan-y cursor-grab active:cursor-grabbing"
            onClick={() => setIsGalleryOpen(true)}
          >
            <img
              src={getValidImage(fotos?.[activePhotoIndex])}
              alt=""
              onError={handleImageError}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none pointer-events-none"
            />

            {/* NOTA: Contador de fotos na galeria foi RETIRADO conforme solicitado */}

            {/* Dots Indicator */}
            {fotos.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                {fotos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIndex(idx);
                    }}
                    className={`h-2.5 rounded-full border border-black/10 transition-all ${
                      idx === activePhotoIndex ? 'bg-[#003366] scale-110 w-4' : 'bg-white/70 w-2.5'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Palavra Destacada Badge */}
            {currentProperty.palavraDestacada?.trim() && (
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-indigo-400/40">
                  {currentProperty.palavraDestacada.trim()}
                </span>
              </div>
            )}
          </div>

          {/* Faixa de Miniaturas (Thumbnail gallery preview) */}
          {fotos.length > 1 && (
            <div
              ref={mobileThumbnailsRef}
              className="bg-white p-3 border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-thin"
            >
              {fotos.map((foto, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`relative w-16 h-12 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                    idx === activePhotoIndex
                      ? 'border-[#003366] ring-2 ring-[#003366]/10'
                      : 'border-slate-100 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getValidImage(foto)}
                    alt=""
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Informações Principais do Imóvel */}
          <div className="p-4 space-y-4 bg-white border-b border-slate-100">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {currentProperty.nomeEdificio ? (
                  <div className="flex items-center text-[#003366] gap-1">
                    <Building2 size={12} />
                    <span>{currentProperty.nomeEdificio}</span>
                  </div>
                ) : currentProperty.construtora ? (
                  <div className="flex items-center text-[#003366] gap-1">
                    <Building2 size={12} />
                    <span>{currentProperty.construtora}</span>
                  </div>
                ) : (
                  <span>Residencial</span>
                )}
              </div>

              <h1 className="font-bold text-slate-900 text-lg md:text-xl mt-1 leading-snug">
                {currentProperty.titulo}
              </h1>

              <div className="flex items-center text-slate-500 text-xs mt-1.5 flex-wrap gap-x-2">
                <span className="flex items-center">
                  <MapPin size={13} className="mr-1 text-slate-400 shrink-0" />
                  {enderecoFormatado}
                </span>
              </div>
            </div>

            {/* Faixa de Valores e Código com a indicação destacada "Publicado há 7 meses" em baixo do código */}
            <div className="py-3 border-y border-slate-100 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  {currentProperty.tipo === 'ambos' ? 'Valores' : 'Valor'}
                </span>

                {currentProperty.tipo === 'ambos' ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Venda:
                      </span>
                      {currentProperty.valorAnterior && currentProperty.valorAnterior > currentProperty.valor ? (
                        <div className="flex flex-col mt-0.5">
                          <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                            De {formatPrice(currentProperty.valorAnterior)}
                          </span>
                          <span className="text-base font-bold text-emerald-600 leading-tight">
                            Por {formatPrice(currentProperty.valor)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-base font-bold text-[#003366]">
                          {formatPrice(currentProperty.valor)}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Locação:
                      </span>
                      <span className="text-base font-bold text-emerald-800">
                        {formatPrice(currentProperty.valorLocacao || 0)}
                        <span className="text-xs font-medium text-slate-500"> /mês</span>
                      </span>
                    </div>
                  </div>
                ) : currentProperty.tipo === 'locação' ? (
                  currentProperty.valorLocacaoAnterior &&
                  currentProperty.valorLocacaoAnterior >
                    (currentProperty.valorLocacao || currentProperty.valor) ? (
                    <div className="flex flex-col mt-0.5">
                      <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                        De {formatPrice(currentProperty.valorLocacaoAnterior)}
                      </span>
                      <span className="text-base font-bold text-emerald-600 leading-tight">
                        Por {formatPrice(currentProperty.valorLocacao || currentProperty.valor)}
                        <span className="text-xs font-medium text-slate-500"> /mês</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-base font-bold text-emerald-800">
                      {formatPrice(currentProperty.valorLocacao || currentProperty.valor)}
                      <span className="text-xs font-medium text-slate-500"> /mês</span>
                    </span>
                  )
                ) : currentProperty.valorAnterior && currentProperty.valorAnterior > currentProperty.valor ? (
                  <div className="flex flex-col mt-0.5">
                    <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                      De {formatPrice(currentProperty.valorAnterior)}
                    </span>
                    <span className="text-base font-bold text-emerald-600 leading-tight">
                      Por {formatPrice(currentProperty.valor)}
                    </span>
                  </div>
                ) : (
                  <span className="text-base font-bold text-slate-900">
                    {formatPrice(currentProperty.valor)}
                  </span>
                )}
              </div>

              {/* Lado Direito: Código do Imóvel + Indicação Destacada com Ícone de Relógio EM BAIXO */}
              <div className="text-right flex flex-col items-end shrink-0">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  Código do Imóvel
                </span>
                <span className="text-xs font-mono font-bold text-[#003366] bg-[#003366]/5 px-2.5 py-1 rounded-md inline-block mt-0.5 border border-[#003366]/10">
                  #{codigoImovel}
                </span>

                {/* Indicação destacada solicitada: com ícone de relógio em baixo do código do imóvel */}
                <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold mt-2 bg-slate-100/90 px-2.5 py-1 rounded-full border border-slate-200/90 shadow-2xs">
                  <Clock size={12} className="text-slate-500 shrink-0" />
                  <span className="whitespace-nowrap">{dataAtualizacaoTexto}</span>
                </div>
              </div>
            </div>

            {/* Características Essenciais */}
            <div className="grid grid-cols-4 gap-2 py-1">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                <Bed size={15} className="text-[#003366] mb-1" />
                <span className="text-[9px] uppercase text-slate-400 font-bold">Dorm.</span>
                <span className="text-xs font-extrabold text-slate-800">{quartosCount}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                <Bath size={15} className="text-[#003366] mb-1" />
                <span className="text-[9px] uppercase text-slate-400 font-bold">BWC</span>
                <span className="text-xs font-extrabold text-slate-800">{banheirosCount}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                <Car size={15} className="text-[#003366] mb-1" />
                <span className="text-[9px] uppercase text-slate-400 font-bold">Vagas</span>
                <span className="text-xs font-extrabold text-slate-800">{vagasCount}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                <Maximize size={15} className="text-[#003366] mb-1" />
                <span className="text-[9px] uppercase text-slate-400 font-bold">Área</span>
                <span className="text-xs font-extrabold text-slate-800">{metragemCount} m²</span>
              </div>
            </div>

            {/* Encargos Adicionais: Condomínio e IPTU */}
            {(Boolean(currentProperty.condominio) || Boolean(currentProperty.iptu)) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-0.5">
                {currentProperty.condominio ? (
                  <div className="text-xs bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                      Condomínio:
                    </span>
                    <span className="font-bold text-slate-800">
                      R$ {currentProperty.condominio.toLocaleString('pt-BR')} /mês
                    </span>
                  </div>
                ) : null}
                {currentProperty.iptu ? (
                  <div className="text-xs bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">IPTU:</span>
                    <span className="font-bold text-slate-800">
                      R$ {currentProperty.iptu.toLocaleString('pt-BR')} /ano
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Descrição do Imóvel */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Descrição do Imóvel
              </span>
              <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {currentProperty.descricao ? (
                  currentProperty.descricao
                ) : loadingFull ? (
                  <div className="space-y-2 animate-pulse py-1">
                    <div className="h-3.5 bg-slate-200 rounded w-11/12" />
                    <div className="h-3.5 bg-slate-200 rounded w-full" />
                    <div className="h-3.5 bg-slate-200 rounded w-4/5" />
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-xs">Nenhuma descrição informada.</span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Ações Mobile: Agendar Visita e Compartilhar                              */}
          {/* (NOTA: O bloco do 'Responsável pelo Imóvel' foi RETIRADO conforme pedido) */}
          {/* ========================================================================= */}
          <div className="p-4 bg-white border-b border-slate-100 space-y-2.5">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Calendar size={16} />
              <span>Agendar Visita</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2.5 px-4 rounded-xl border border-slate-200/80 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs cursor-pointer"
            >
              <Share2 size={14} />
              <span>Compartilhar / Copiar Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. VISUALIZAÇÃO COMPUTADOR / NOTEBOOK (WIDESCREEN) - >= lg               */}
      {/* - Retirado 'Buscar outros imóveis' do cabeçalho                           */}
      {/* - Retirado o tag do código do imóvel do card da direita                  */}
      {/* ========================================================================= */}
      <div className="hidden lg:block">
        {/* Cabeçalho Widescreen (Sem botão Voltar e SEM 'Buscar outros imóveis') */}
        <header className="bg-white border-b border-slate-200/80 px-6 lg:px-8 py-3.5 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Logo e Nome da Marca */}
            <button
              type="button"
              onClick={onGoHome || onClose}
              className="flex items-center gap-2.5 cursor-pointer focus:outline-hidden group"
              aria-label="Ir para a página inicial"
              title="Ir para a página inicial"
            >
              <img
                src="/icone_imobishare.png"
                alt="ImobiShare Logo"
                className="w-8 h-8 object-contain rounded-lg shadow-2xs group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = LOGO_IMAGE;
                }}
              />
              <span className="font-black text-[#003366] tracking-tight text-lg">
                IMOBISHARE
              </span>
            </button>

            {/* Ações Rápidas no Cabeçalho (Sem o botão 'Buscar outros imóveis') */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-favoritar-header-desktop"
                onClick={() => onToggleFavorite?.(imovel.id)}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  isFavorite
                    ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={isFavorite ? 'Remover dos favoritos' : 'Favoritar imóvel'}
                aria-label="Favoritar"
              >
                <Heart size={20} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
              </button>

              <button
                type="button"
                id="btn-compartilhar-header-desktop"
                onClick={handleShare}
                className="p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Compartilhar link do imóvel"
                aria-label="Compartilhar"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Container Principal Widescreen */}
        <main className="max-w-7xl mx-auto px-6 lg:px-8 pt-6">
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* ---------------------------------------------------- */}
            {/* COLUNA ESQUERDA (8 colunas) - Movimenta-se ao rolar  */}
            {/* ---------------------------------------------------- */}
            <div className="col-span-8 space-y-5">
              {/* 1. Galeria de Fotos Widescreen */}
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs">
                <div
                  className="relative aspect-16/10 bg-slate-900 overflow-hidden select-none cursor-pointer group"
                  onClick={() => setIsGalleryOpen(true)}
                >
                  <img
                    src={getValidImage(fotos?.[activePhotoIndex])}
                    alt={currentProperty.titulo}
                    onError={handleImageError}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-500 group-hover:scale-102"
                  />

                  {/* Selo Palavra Destacada */}
                  {currentProperty.palavraDestacada?.trim() && (
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-block text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-md border border-indigo-400/40">
                        {currentProperty.palavraDestacada.trim()}
                      </span>
                    </div>
                  )}

                  {/* Botão Ver Todas as Fotos */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGalleryOpen(true);
                    }}
                    className="absolute bottom-4 right-4 bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md text-xs font-bold px-3.5 py-2 rounded-xl border border-white/20 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                  >
                    <Images size={15} />
                    <span>Ver todas as fotos ({fotos.length})</span>
                  </button>

                  {/* Botões Laterais de Navegação */}
                  {fotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-md"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-md"
                        aria-label="Próxima foto"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  {/* Dots Indicator */}
                  {fotos.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                      {fotos.slice(0, 10).map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded-full transition-all ${
                            idx === activePhotoIndex ? 'bg-white w-5 shadow-xs' : 'bg-white/60 w-2'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Breadcrumb e Data da Publicação EM BAIXO DA GALERIA */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                {/* Breadcrumb: (Início > Balneário Camboriú > Centro > Rua sem o número > Imóvel 2217893) */}
                <nav
                  aria-label="Navegação estrutural"
                  className="flex items-center flex-wrap gap-1.5 text-xs sm:text-[13px] text-slate-500 font-medium"
                >
                  <button
                    type="button"
                    onClick={onGoHome || onClose}
                    className="hover:text-[#003366] hover:underline transition-colors cursor-pointer font-semibold text-slate-700"
                  >
                    Início
                  </button>
                  <span className="text-slate-400 select-none">&gt;</span>
                  <span className="text-slate-600 hover:text-slate-800 transition-colors">
                    {cidadeFormatada}
                  </span>
                  <span className="text-slate-400 select-none">&gt;</span>
                  <span className="text-slate-600 hover:text-slate-800 transition-colors">
                    {bairroFormatado}
                  </span>
                  <span className="text-slate-400 select-none">&gt;</span>
                  <span className="text-slate-600 hover:text-slate-800 transition-colors">
                    {streetWithoutNumber}
                  </span>
                  <span className="text-slate-400 select-none">&gt;</span>
                  <span className="text-[#003366] font-bold">
                    Imóvel {codigoImovel}
                  </span>
                </nav>

                {/* Data da atualização / publicação: "Publicado há 7 meses" */}
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs shrink-0">
                  <Clock size={13} className="text-slate-400 shrink-0" />
                  <span>{dataAtualizacaoTexto}</span>
                </div>
              </div>

              {/* 3. Informações Principais do Imóvel Widescreen */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#003366] uppercase tracking-wider">
                    {currentProperty.nomeEdificio ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-[#003366]" />
                        <span>{currentProperty.nomeEdificio}</span>
                      </div>
                    ) : currentProperty.construtora ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-[#003366]" />
                        <span>{currentProperty.construtora}</span>
                      </div>
                    ) : (
                      <span>{currentProperty.tipoImovel || 'Imóvel'}</span>
                    )}
                  </div>

                  <h1 className="font-extrabold text-slate-900 text-2xl lg:text-3xl mt-1.5 leading-snug">
                    {currentProperty.titulo}
                  </h1>

                  <div className="flex items-center text-slate-600 text-sm mt-2 flex-wrap gap-x-2">
                    <span className="flex items-center">
                      <MapPin size={15} className="mr-1.5 text-slate-400 shrink-0" />
                      {enderecoFormatado}
                    </span>
                  </div>
                </div>

                {/* Características Essenciais */}
                <div className="grid grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Bed size={20} className="text-[#003366] mb-1.5" />
                    <span className="text-xs uppercase text-slate-400 font-extrabold">Dormitórios</span>
                    <span className="text-base font-black text-slate-800">{quartosCount}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Bath size={20} className="text-[#003366] mb-1.5" />
                    <span className="text-xs uppercase text-slate-400 font-extrabold">Banheiros</span>
                    <span className="text-base font-black text-slate-800">{banheirosCount}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Car size={20} className="text-[#003366] mb-1.5" />
                    <span className="text-xs uppercase text-slate-400 font-extrabold">Vagas</span>
                    <span className="text-base font-black text-slate-800">{vagasCount}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Maximize size={20} className="text-[#003366] mb-1.5" />
                    <span className="text-xs uppercase text-slate-400 font-extrabold">Área Privativa</span>
                    <span className="text-base font-black text-slate-800">{metragemCount} m²</span>
                  </div>
                </div>
              </div>

              {/* 4. Descrição Detalhada Widescreen */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Descrição do Imóvel
                </h2>
                <div className="text-slate-700 text-base leading-relaxed whitespace-pre-line font-normal">
                  {currentProperty.descricao ? (
                    currentProperty.descricao
                  ) : loadingFull ? (
                    <div className="space-y-2.5 animate-pulse py-2">
                      <div className="h-4 bg-slate-200 rounded-md w-11/12" />
                      <div className="h-4 bg-slate-200 rounded-md w-full" />
                      <div className="h-4 bg-slate-200 rounded-md w-4/5" />
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-sm">Nenhuma descrição informada.</span>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* COLUNA DIREITA (4 colunas) - Sticky Card Widescreen */}
            {/* (NOTA: O tag do código do imóvel foi RETIRADO daqui) */}
            {/* ---------------------------------------------------- */}
            <div className="col-span-4 h-full">
              <div className="sticky top-24 bg-white rounded-2xl border border-slate-200/90 shadow-md p-6 space-y-5">
                {/* Topo do Card: Status Comercial (Sem a tag do código do imóvel) */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {currentProperty.tipo === 'ambos' ? 'Venda & Locação' : currentProperty.tipo === 'locação' ? 'Locação' : 'Venda'}
                  </span>

                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    {currentProperty.statusComercial || 'Disponível'}
                  </span>
                </div>

                {/* Valor do Imóvel */}
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-extrabold block tracking-wider mb-1">
                    {currentProperty.tipo === 'ambos' ? 'Valores' : 'Valor do Imóvel'}
                  </span>

                  {currentProperty.tipo === 'ambos' ? (
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-[#003366]">
                        Venda: {formatPrice(currentProperty.valor)}
                      </div>
                      <div className="text-xl font-black text-emerald-800 pt-1">
                        Locação: {formatPrice(currentProperty.valorLocacao || 0)}
                        <span className="text-xs font-medium text-slate-500"> /mês</span>
                      </div>
                    </div>
                  ) : currentProperty.tipo === 'locação' ? (
                    <div>
                      <div className="text-3xl font-black text-emerald-800">
                        {formatPrice(currentProperty.valorLocacao || currentProperty.valor)}
                        <span className="text-sm font-semibold text-slate-500"> /mês</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl font-black text-[#003366] tracking-tight">
                        {formatPrice(currentProperty.valor)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Condomínio e IPTU */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Condomínio:</span>
                    <span className="font-bold text-slate-800">
                      {currentProperty.condominio
                        ? `R$ ${currentProperty.condominio.toLocaleString('pt-BR')} /mês`
                        : 'Sob consulta'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                    <span className="text-slate-500 font-semibold">IPTU:</span>
                    <span className="font-bold text-slate-800">
                      {currentProperty.iptu
                        ? `R$ ${currentProperty.iptu.toLocaleString('pt-BR')} /ano`
                        : 'Sob consulta'}
                    </span>
                  </div>
                </div>

                {/* Botões de Ação Widescreen */}
                <div className="space-y-3 pt-1">
                  {/* Botão de Agendar Visita (Principal) */}
                  <button
                    type="button"
                    id="btn-agendar-visita-widescreen"
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-sm"
                  >
                    <Calendar size={18} />
                    <span>Agendar Visita</span>
                  </button>

                  {/* Botão de Favoritar & Compartilhar lado a lado */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      id="btn-favoritar-widescreen"
                      onClick={() => onToggleFavorite?.(imovel.id)}
                      className={`w-full py-3 px-3 rounded-xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isFavorite
                          ? 'border-rose-300 bg-rose-50 text-rose-600 shadow-2xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                      title={isFavorite ? 'Remover dos favoritos' : 'Favoritar este imóvel'}
                    >
                      <Heart size={17} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
                      <span>{isFavorite ? 'Favorito' : 'Favoritar'}</span>
                    </button>

                    <button
                      type="button"
                      id="btn-compartilhar-widescreen"
                      onClick={handleShare}
                      className="w-full py-3 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                      title="Compartilhar ou copiar link"
                    >
                      <Share2 size={17} />
                      <span>Compartilhar</span>
                    </button>
                  </div>
                </div>

                {/* Selo de Garantia e Conexão Direta */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-xs text-center">
                  <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                  <span>Imóvel verificado na rede ImobiShare</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Toast flutuante de confirmação ao copiar link */}
      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs border border-white/20 flex items-center gap-2 animate-fade-in">
          <Check size={15} className="text-emerald-400" />
          <span>Link do imóvel copiado com sucesso!</span>
        </div>
      )}

      {/* Modal de Agendamento de Visita */}
      <PortalScheduleModal
        imovel={currentProperty}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Modal de Galeria Completa */}
      <PortalGalleryModal
        titulo={currentProperty.nomeEdificio?.trim() || currentProperty.titulo || 'Empreendimento'}
        fotos={fotos}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </div>
  );
}
