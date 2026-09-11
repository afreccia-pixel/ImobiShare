/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

export function PortalPropertyDetailPage({
  imovel,
  isFavorite = false,
  onToggleFavorite,
  onClose,
  onGoHome,
}: PortalPropertyDetailPageProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const [fullImovel, setFullImovel] = useState<Partial<PortalProperty> | null>(() => {
    return imovel.descricao ? imovel : null;
  });
  const [loadingFull, setLoadingFull] = useState(!imovel.descricao);
  const [fullFotos, setFullFotos] = useState<string[]>(imovel.fotos || []);

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
    fotos: fullFotos.length > 0 ? fullFotos : (imovel.fotos || []),
  };

  const fotos = currentProperty.fotos && currentProperty.fotos.length > 0
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
    const diffX = endX - touchStartPos.x; // positive = swipe right (left to right)
    const diffY = Math.abs(endY - touchStartPos.y);

    // If dragged horizontally from left to right (> 65px and dominant horizontal gesture) -> Go back
    if (diffX > 65 && diffX > diffY * 1.2) {
      onClose();
      setTouchStartPos(null);
      return;
    }

    // Photo carousel swipe logic
    if (Math.abs(diffX) > 35 && fotos.length > 1) {
      if (diffX < 0) {
        // Swiped left -> Next photo
        setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
      } else if (activePhotoIndex > 0) {
        // Swiped right -> Previous photo
        setActivePhotoIndex((prev) => prev - 1);
      }
    }
    setTouchStartPos(null);
  };

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Generate public link format
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

  return (
    <div
      className="bg-slate-50 min-h-screen pb-16 touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      id={`portal-property-details-${imovel.id}`}
    >
      {/* Cabeçalho apenas com Logo e Nome do ImobiShare */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center sticky top-0 z-30 shadow-2xs">
        <button
          type="button"
          onClick={onGoHome || onClose}
          className="flex items-center gap-2.5 cursor-pointer focus:outline-hidden group"
          aria-label="Ir para a página inicial do ImobiShare"
        >
          <img
            src="/icone_imobishare.png"
            alt="ImobiShare Logo"
            className="w-7 h-7 object-contain rounded-lg shadow-2xs group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = LOGO_IMAGE;
            }}
          />
          <span className="text-xl font-black text-[#003366] tracking-tight font-sans">
            IMOBISHARE
          </span>
        </button>
      </header>

      <div className="max-w-xl mx-auto">
        {/* Carrossel de Fotos com Botões Sobrepostos */}
        <div
          className="relative aspect-4/3 bg-slate-900 overflow-hidden select-none touch-pan-y cursor-pointer"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsGalleryOpen(true)}
        >
          <img
            src={getValidImage(fotos?.[activePhotoIndex])}
            alt=""
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover select-none pointer-events-none"
          />

          {/* Canto superior esquerdo: Botão circular de Voltar */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3.5 left-3.5 z-20 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border border-white/20"
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Canto superior direito: Botões circulares de Favoritar e Compartilhar */}
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(imovel.id);
              }}
              className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border ${
                isFavorite
                  ? 'bg-rose-600/90 text-white border-rose-400/40'
                  : 'bg-slate-900/60 hover:bg-slate-900/80 text-white border-white/20'
              }`}
              title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              aria-label="Favoritar"
            >
              <Heart size={18} className={isFavorite ? 'fill-white' : ''} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border border-white/20"
              title="Compartilhar"
              aria-label="Compartilhar"
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Dots Indicator */}
          {fotos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {fotos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full border border-black/10 transition-all cursor-pointer ${
                    idx === activePhotoIndex ? 'bg-[#003366] scale-110 w-4' : 'bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Palavra Destacada Badge (abaixo dos botões do canto superior esquerdo) */}
          {currentProperty.palavraDestacada?.trim() && (
            <div className="absolute top-14 left-3.5 z-10">
              <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-indigo-400/40">
                {currentProperty.palavraDestacada.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Informações Principais do Imóvel */}
        <div className="p-4 space-y-4 bg-white border-b border-slate-100">
          <div>
            {/* Nome da Construtora em azul escuro (#003366) */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#003366] uppercase tracking-wider">
              <Building2 size={13} className="text-[#003366] shrink-0" />
              <span>{currentProperty.construtora?.trim() || 'Construtora não informada'}</span>
            </div>

            <h1 className="font-bold text-slate-900 text-lg md:text-xl mt-1 leading-snug">
              {currentProperty.titulo}
            </h1>

            <div className="flex items-center text-slate-500 text-xs mt-1.5 flex-wrap gap-x-2">
              <span className="flex items-center">
                <MapPin size={13} className="mr-1 text-slate-400 shrink-0" />
                {currentProperty.endereco?.trim()
                  ? `${currentProperty.endereco}${
                      currentProperty.bairro &&
                      !currentProperty.endereco.toLowerCase().includes(currentProperty.bairro.toLowerCase())
                        ? ` · ${currentProperty.bairro}`
                        : ''
                    }${currentProperty.cidade ? ` - ${currentProperty.cidade}` : ''}`
                  : currentProperty.localizacao ||
                    `${currentProperty.bairro || ''}${currentProperty.cidade ? ` - ${currentProperty.cidade}` : ''}` ||
                    'Localização não informada'}
              </span>
            </div>
          </div>

          <div className="py-3 border-y border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                {currentProperty.tipo === 'ambos' ? 'Valores' : 'Valor'}
              </span>
              {currentProperty.tipo === 'ambos' ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Venda:</span>
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
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Locação:</span>
                    <span className="text-base font-bold text-emerald-800">
                      {formatPrice(currentProperty.valorLocacao || 0)}
                      <span className="text-xs font-medium text-slate-500"> /mês</span>
                    </span>
                  </div>
                </div>
              ) : currentProperty.tipo === 'locação' ? (
                currentProperty.valorLocacaoAnterior &&
                currentProperty.valorLocacaoAnterior > (currentProperty.valorLocacao || currentProperty.valor) ? (
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

            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Código do Imóvel</span>
              <span className="text-xs font-mono font-bold text-[#003366] bg-[#003366]/5 px-2.5 py-1 rounded-md inline-block mt-0.5 border border-[#003366]/10">
                #{getPropertyCode(currentProperty)}
              </span>
            </div>
          </div>

          {/* Características Essenciais */}
          {(() => {
            const isTerreno = currentProperty.tipoImovel === 'Terreno';
            const isComercial = currentProperty.tipoImovel === 'Comercial';

            if (isTerreno) {
              return (
                <div className="py-1">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <Maximize size={18} className="text-[#003366]" />
                      <span className="text-[11px] uppercase text-slate-500 font-bold">Área do Terreno</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800">
                      {currentProperty.metragem ?? 0} m²
                    </span>
                  </div>
                </div>
              );
            }

            if (isComercial) {
              return (
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Bath size={15} className="text-[#003366] mb-1" />
                    <span className="text-[9px] uppercase text-slate-400 font-bold">BWC</span>
                    <span className="text-xs font-extrabold text-slate-800">{currentProperty.banheiros ?? 0}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Car size={15} className="text-[#003366] mb-1" />
                    <span className="text-[9px] uppercase text-slate-400 font-bold">Vagas</span>
                    <span className="text-xs font-extrabold text-slate-800">{currentProperty.vagas ?? 0}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                    <Maximize size={15} className="text-[#003366] mb-1" />
                    <span className="text-[9px] uppercase text-slate-400 font-bold">Área</span>
                    <span className="text-xs font-extrabold text-slate-800">{currentProperty.metragem ?? 0} m²</span>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-4 gap-2 py-1">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                  <Bed size={15} className="text-[#003366] mb-1" />
                  <span className="text-[9px] uppercase text-slate-400 font-bold">Dorm.</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {currentProperty.dormitorios ?? currentProperty.quartos ?? 0}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                  <Bath size={15} className="text-[#003366] mb-1" />
                  <span className="text-[9px] uppercase text-slate-400 font-bold">BWC</span>
                  <span className="text-xs font-extrabold text-slate-800">{currentProperty.banheiros ?? 0}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                  <Car size={15} className="text-[#003366] mb-1" />
                  <span className="text-[9px] uppercase text-slate-400 font-bold">Vagas</span>
                  <span className="text-xs font-extrabold text-slate-800">{currentProperty.vagas ?? 0}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                  <Maximize size={15} className="text-[#003366] mb-1" />
                  <span className="text-[9px] uppercase text-slate-400 font-bold">Área</span>
                  <span className="text-xs font-extrabold text-slate-800">{currentProperty.metragem ?? 0} m²</span>
                </div>
              </div>
            );
          })()}

          {/* Encargos Adicionais: Condomínio e IPTU */}
          {(Boolean(currentProperty.condominio) || Boolean(currentProperty.iptu)) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-0.5">
              {currentProperty.condominio ? (
                <div className="text-xs bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-slate-600">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Condomínio:</span>
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

        {/* Rodapé: Botão Agendar Visita */}
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            type="button"
            id="btn-agendar-visita-footer"
            onClick={() => setIsScheduleModalOpen(true)}
            className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 text-sm cursor-pointer"
          >
            <Calendar size={18} />
            <span>Agendar Visita</span>
          </button>
        </div>
      </div>

      {/* Toast flutuante de confirmação ao copiar o link */}
      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs border border-white/20 flex items-center gap-2 animate-fade-in">
          <Check size={15} className="text-emerald-400" />
          <span>Link do imóvel copiado!</span>
        </div>
      )}

      {/* Modal de Agendamento de Visita */}
      <PortalScheduleModal
        imovel={currentProperty}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Modal de Todas as Fotos */}
      <PortalGalleryModal
        titulo={currentProperty.construtora || currentProperty.nomeEdificio || currentProperty.titulo}
        fotos={fotos}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </div>
  );
}
