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
  Clock,
  Images,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
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
  const [desktopDragStart, setDesktopDragStart] = useState<{ x: number; y: number } | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const [fullImovel, setFullImovel] = useState<Partial<PortalProperty> | null>(() => {
    return imovel.descricao ? imovel : null;
  });
  const [loadingFull, setLoadingFull] = useState(!imovel.descricao);
  const [fullFotos, setFullFotos] = useState<string[]>(imovel.fotos || []);

  // Rola a página para o topo ao abrir o imóvel (essencial no modo celular na mesma tela)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [imovel.id]);

  // Rola suavemente para centralizar a miniatura selecionada
  useEffect(() => {
    if (thumbnailsRef.current && thumbnailsRef.current.children[activePhotoIndex]) {
      (thumbnailsRef.current.children[activePhotoIndex] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activePhotoIndex]);

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

  const handleDirectWhatsApp = () => {
    const imovelNome = currentProperty.nomeEdificio || currentProperty.titulo;
    const preco = formatPrice(currentProperty.valor);
    const endereco = [currentProperty.bairro, currentProperty.cidade].filter(Boolean).join(' - ');
    const msg = `Olá! Vi o imóvel *${imovelNome}* (Cód. #${getPropertyCode(currentProperty)}) por ${preco} em ${endereco} no ImobiShare e gostaria de mais informações.`;
    const phone = currentProperty.corretorTelefone || '5547998887766';
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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

  // Valor do metro quadrado
  const valorM2 = metragemCount > 0 && currentProperty.valor > 0
    ? Math.round(currentProperty.valor / metragemCount)
    : null;

  // Função para interpretar com segurança qualquer formato de data
  const parsePropertyDate = (input: any): Date | null => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    if (typeof input === 'number') {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return null;

      // 1. Tenta formato ISO direto ou YYYY-MM-DD
      const dIso = new Date(trimmed);
      if (!isNaN(dIso.getTime())) return dIso;

      // 2. Tenta formato brasileiro DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
      const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (brMatch) {
        const day = parseInt(brMatch[1], 10);
        const month = parseInt(brMatch[2], 10) - 1;
        const year = parseInt(brMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }

      // 3. Tenta formato por extenso em português (ex: "4 de setembro de 2026")
      const meses: Record<string, number> = {
        janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
        julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
      };
      const extMatch = trimmed.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/);
      if (extMatch && meses[extMatch[2]] !== undefined) {
        const day = parseInt(extMatch[1], 10);
        const month = meses[extMatch[2]];
        const year = parseInt(extMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  // Se não houver data explícita, tenta extrair timestamp do ID do imóvel (ex: prop-1726300000000 ou imovel-1726300000000)
  const extractDateFromId = (id?: string): Date | null => {
    if (!id) return null;
    const match = id.match(/(?:imovel|prop)[-_](\d{10,13})/i);
    if (match && match[1]) {
      const ts = parseInt(match[1], 10);
      const fullTs = ts < 10000000000 ? ts * 1000 : ts;
      const d = new Date(fullTs);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Prioriza campo dataCadastro original do imóvel, depois campos de API/banco e por fim ID
  const pAny = currentProperty as any;
  const rawDate =
    currentProperty.dataCadastro ||
    pAny.data_cadastro ||
    pAny.created_at ||
    pAny.createdAt ||
    pAny.timestamp ||
    currentProperty.dataPublicacao;

  const resolvedDate = parsePropertyDate(rawDate) || extractDateFromId(currentProperty.id);

  const getPublicadoTexto = (pubDate: Date | null) => {
    if (!pubDate) return 'Publicado recentemente';
    const now = new Date();
    const diffMs = now.getTime() - pubDate.getTime();

    // Se cadastrado hoje ou com pequena diferença futura de fuso
    if (diffMs <= 0) return 'Publicado hoje';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return diffMinutes <= 5 ? 'Publicado hoje' : `Publicado há ${diffMinutes} min`;
    }
    if (diffHours < 24) {
      return diffHours === 1 ? 'Publicado há 1 hora' : `Publicado há ${diffHours} horas`;
    }
    if (diffDays === 1) return 'Publicado ontem';
    if (diffDays < 30) return `Publicado há ${diffDays} dias`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return diffMonths === 1 ? 'Publicado há 1 mês' : `Publicado há ${diffMonths} meses`;
    }

    const diffYears = Math.floor(diffDays / 365);
    return diffYears <= 1 ? 'Publicado há 1 ano' : `Publicado há mais de ${diffYears} anos`;
  };

  const publicadoTexto = getPublicadoTexto(resolvedDate);

  return (
    <div
      className="bg-slate-50 min-h-screen pb-16"
      id={`portal-property-details-${imovel.id}`}
    >
      {/* ========================================================================= */}
      {/* 1. VISUALIZAÇÃO CELULAR (MOBILE) - Mantida estritamente com o design mobile */}
      {/* ========================================================================= */}
      <div className="block md:hidden touch-pan-y" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Cabeçalho mobile apenas com Logo e Nome do ImobiShare */}
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
              id="btn-mobile-voltar"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-4 left-4 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border border-white/20"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Canto superior direito: Botões circulares de Favoritar e Compartilhar */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5">
              <button
                type="button"
                id="btn-mobile-favoritar"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite?.(imovel.id);
                }}
                className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border ${
                  isFavorite
                    ? 'bg-rose-600/90 text-white border-rose-400/40'
                    : 'bg-slate-900/60 hover:bg-slate-900/80 text-white border-white/20'
                }`}
                title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                aria-label="Favoritar"
              >
                <Heart size={20} className={isFavorite ? 'fill-white' : ''} />
              </button>

              <button
                type="button"
                id="btn-mobile-compartilhar"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer border border-white/20"
                title="Compartilhar"
                aria-label="Compartilhar"
              >
                <Share2 size={20} />
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

            {/* Palavra Destacada Badge */}
            {currentProperty.palavraDestacada?.trim() && (
              <div className="absolute top-14 left-3.5 z-10">
                <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-indigo-400/40">
                  {currentProperty.palavraDestacada.trim()}
                </span>
              </div>
            )}
          </div>

          {/* Informações Principais do Imóvel no Mobile */}
          <div className="p-4 space-y-4 bg-white border-b border-slate-100">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#003366] uppercase tracking-wider">
                <Building2 size={13} className="text-[#003366] shrink-0" />
                <span>{currentProperty.construtora?.trim() || 'Construtora não informada'}</span>
              </div>

              <h1 className="font-bold text-slate-900 text-lg mt-1 leading-snug">
                {currentProperty.titulo}
              </h1>

              <div className="flex items-center text-slate-500 text-xs mt-1.5 flex-wrap gap-x-2">
                <span className="flex items-center">
                  <MapPin size={13} className="mr-1 text-slate-400 shrink-0" />
                  {enderecoFormatado}
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

            {/* Características Essenciais no Mobile */}
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

            {/* Encargos Adicionais */}
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

          {/* Rodapé Mobile: Botão Agendar Visita */}
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
      </div>

      {/* ========================================================================= */}
      {/* 2. VISUALIZAÇÃO DESKTOP / SCREEN SIZE - Ampla, fluida e completa de portal */}
      {/* ========================================================================= */}
      <div className="hidden md:block">
        {/* Barra Superior do Portal Desktop */}
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 h-14 lg:h-15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onGoHome || onClose}
                className="flex items-center gap-3 cursor-pointer focus:outline-hidden group"
              >
                <img
                  src="/icone_imobishare.png"
                  alt="ImobiShare"
                  className="w-8 h-8 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = LOGO_IMAGE;
                  }}
                />
                <span className="text-xl font-bold text-[#003366] tracking-tight font-sans">
                  IMOBISHARE
                </span>
              </button>
            </div>

            {/* Botões Secundários: Altura 40px, Fonte 14px / 600, Radius 12px */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                id="btn-desktop-favoritar-header"
                onClick={() => onToggleFavorite?.(imovel.id)}
                className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all cursor-pointer border active:scale-95 shadow-2xs ${
                  isFavorite
                    ? 'bg-rose-50 text-rose-600 border-rose-300 ring-2 ring-rose-500/10'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Heart size={18} className={isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'} />
                <span>{isFavorite ? 'Salvo nos favoritos' : 'Favoritar'}</span>
              </button>

              <button
                type="button"
                id="btn-desktop-compartilhar-header"
                onClick={handleShare}
                className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <Share2 size={18} className="text-slate-500" />
                <span>Compartilhar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Galeria de Fotos Desktop: Cabeçalho + Foto Principal cabem juntos na mesma tela (sem miniaturas) */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-4 pb-2">
          {/* Foto Principal Grande com Carrossel */}
          <div
            className="relative w-full h-[calc(100vh-140px)] max-h-[560px] min-h-[340px] rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 bg-slate-950 group select-none cursor-grab active:cursor-grabbing"
            onTouchStart={(e) => {
              if (e.touches?.[0]) {
                setDesktopDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
              }
            }}
            onTouchEnd={(e) => {
              if (desktopDragStart && e.changedTouches?.[0]) {
                const diffX = e.changedTouches[0].clientX - desktopDragStart.x;
                const diffY = Math.abs(e.changedTouches[0].clientY - desktopDragStart.y);
                if (Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
                  if (diffX < 0) {
                    setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
                  } else {
                    setActivePhotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
                  }
                }
                setDesktopDragStart(null);
              }
            }}
            onMouseDown={(e) => {
              setDesktopDragStart({ x: e.clientX, y: e.clientY });
            }}
            onMouseUp={(e) => {
              if (desktopDragStart) {
                const diffX = e.clientX - desktopDragStart.x;
                const diffY = Math.abs(e.clientY - desktopDragStart.y);
                if (Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
                  if (diffX < 0) {
                    setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
                  } else {
                    setActivePhotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
                  }
                }
                setDesktopDragStart(null);
              }
            }}
          >
            {/* Fundo sutil com desfoque para preenchimento harmônico sem cortar a foto */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 scale-110 pointer-events-none select-none"
              style={{ backgroundImage: `url(${getValidImage(fotos[activePhotoIndex] || fotos[0])})` }}
              aria-hidden="true"
            />

            <img
              src={getValidImage(fotos[activePhotoIndex] || fotos[0])}
              alt={currentProperty.titulo}
              onError={handleImageError}
              referrerPolicy="no-referrer"
              className="relative z-10 w-full h-full object-contain mx-auto transition-all duration-200 pointer-events-none select-none"
            />

            {/* Selo Palavra Destacada (12px / 600) */}
            {currentProperty.palavraDestacada?.trim() && (
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <span className="inline-block text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-3 py-1 rounded-lg shadow-sm border border-indigo-400/30">
                  {currentProperty.palavraDestacada.trim()}
                </span>
              </div>
            )}

            {/* Botão Anterior */}
            {fotos.length > 1 && (
              <button
                type="button"
                id="btn-desktop-carrossel-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md border border-slate-200/80 cursor-pointer"
                aria-label="Foto anterior"
                title="Foto anterior"
              >
                <ChevronLeft size={20} className="text-slate-800" />
              </button>
            )}

            {/* Botão Próximo */}
            {fotos.length > 1 && (
              <button
                type="button"
                id="btn-desktop-carrossel-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex((prev) => (prev + 1) % fotos.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md border border-slate-200/80 cursor-pointer"
                aria-label="Próxima foto"
                title="Próxima foto"
              >
                <ChevronRight size={20} className="text-slate-800" />
              </button>
            )}

            {/* Indicador de Pontos na Parte Inferior */}
            {fotos.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 z-20 pointer-events-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 shadow-xs">
                  {fotos.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIndex(idx);
                      }}
                      className={`rounded-full transition-all cursor-pointer ${
                        idx === activePhotoIndex
                          ? 'bg-white w-5 h-2 shadow-xs'
                          : 'bg-white/40 hover:bg-white/70 w-2 h-2'
                      }`}
                      aria-label={`Ir para a foto ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Botão Ver Todas as Fotos */}
            <button
              type="button"
              id="btn-desktop-abrir-galeria"
              onClick={(e) => {
                e.stopPropagation();
                setIsGalleryOpen(true);
              }}
              className="absolute bottom-4 right-4 z-20 px-3.5 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-950/90 text-white backdrop-blur-md border border-white/20 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Ver todas as fotos em tela cheia"
            >
              <Images size={15} />
              <span>{fotos.length} fotos</span>
            </button>
          </div>
        </section>

        {/* Conteúdo Principal Desktop (Layout de 2 Colunas: Informações + Card Flutuante) */}
        <main className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Coluna da Esquerda: Dados completos do imóvel */}
            <div className="lg:col-span-2 space-y-6 lg:space-y-8">
              {/* Título e Localização */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#003366] uppercase tracking-wider mb-2">
                  <Building2 size={15} className="text-[#003366]" />
                  <span>{currentProperty.construtora?.trim() || 'Construtora não informada'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 font-medium">{currentProperty.tipoImovel || 'Apartamento'}</span>
                </div>

                <h1 className="text-2xl lg:text-[26px] font-bold text-slate-900 leading-tight">
                  {currentProperty.titulo}
                </h1>

                {/* Data de publicação */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span>{publicadoTexto}</span>
                </div>

                <div className="flex items-center text-slate-500 text-sm mt-2">
                  <MapPin size={16} className="text-slate-400 mr-1.5 shrink-0" />
                  <span>{enderecoFormatado}</span>
                </div>
              </div>

              {/* Painel de Métricas / Especificações Principais */}
              <div className="grid grid-cols-4 gap-3.5 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 text-center border border-slate-100/90">
                  <Maximize size={20} className="text-[#003366] mb-1.5" />
                  <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">Área Útil</span>
                  <span className="text-base font-semibold text-slate-900">{metragemCount} m²</span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 text-center border border-slate-100/90">
                  <Bed size={20} className="text-[#003366] mb-1.5" />
                  <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">Dormitórios</span>
                  <span className="text-base font-semibold text-slate-900">{quartosCount}</span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 text-center border border-slate-100/90">
                  <Bath size={20} className="text-[#003366] mb-1.5" />
                  <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">Banheiros</span>
                  <span className="text-base font-semibold text-slate-900">{banheirosCount}</span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 text-center border border-slate-100/90">
                  <Car size={20} className="text-[#003366] mb-1.5" />
                  <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">Vagas</span>
                  <span className="text-base font-semibold text-slate-900">{vagasCount}</span>
                </div>
              </div>

              {/* Descrição Completa do Imóvel */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
                <h2 className="text-lg font-bold text-slate-900">Sobre este imóvel</h2>
                <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-normal">
                  {currentProperty.descricao ? (
                    currentProperty.descricao
                  ) : loadingFull ? (
                    <div className="space-y-2 animate-pulse py-2">
                      <div className="h-4 bg-slate-200 rounded w-11/12" />
                      <div className="h-4 bg-slate-200 rounded w-full" />
                      <div className="h-4 bg-slate-200 rounded w-4/5" />
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Nenhuma descrição detalhada informada para este imóvel.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna da Direita: Card Sticky de Contato e Agendamento */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-lg space-y-5">
                {/* Header do Card */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {currentProperty.tipo === 'locação' ? 'Valor da Locação' : 'Valor'}
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#003366] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                      #{getPropertyCode(currentProperty)}
                    </span>
                  </div>
                  {/* Preço e Valor do Metro Quadrado ao lado */}
                  <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
                    <span className="text-2xl lg:text-[28px] font-bold text-slate-900">
                      {formatPrice(currentProperty.valor)}
                    </span>
                    {valorM2 ? (
                      <span className="text-sm font-semibold text-slate-500">
                        ({formatPrice(valorM2)}/m²)
                      </span>
                    ) : null}
                  </div>
                  {currentProperty.valorAnterior && currentProperty.valorAnterior > currentProperty.valor && (
                    <span className="text-xs font-medium text-slate-400 line-through mt-0.5 block">
                      De {formatPrice(currentProperty.valorAnterior)}
                    </span>
                  )}
                  {currentProperty.tipo === 'ambos' && currentProperty.valorLocacao ? (
                    <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                      Locação: {formatPrice(currentProperty.valorLocacao)}/mês
                    </div>
                  ) : null}
                  {/* Condomínio e IPTU em linhas separadas abaixo do preço */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 font-medium">Condomínio: </span>
                      <span className="font-semibold text-slate-800">
                        {currentProperty.condominio ? `R$ ${currentProperty.condominio.toLocaleString('pt-BR')}` : 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">IPTU: </span>
                      <span className="font-semibold text-slate-800">
                        {currentProperty.iptu ? `R$ ${currentProperty.iptu.toLocaleString('pt-BR')}` : 'Não informado'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Botões de Ação */}
                <div className="space-y-3">
                  <button
                    type="button"
                    id="btn-desktop-agendar-visita"
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="w-full h-12 bg-[#003366] hover:bg-[#002244] text-white font-semibold px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98 text-sm cursor-pointer"
                  >
                    <Calendar size={18} />
                    <span>Agendar Visita</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Toast flutuante de confirmação ao copiar o link */}
      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs border border-white/20 flex items-center gap-2 animate-fade-in">
          <Check size={15} className="text-emerald-400" />
          <span>Link do imóvel copiado!</span>
        </div>
      )}

      {/* Modal de Agendamento de Visita (Compartilhado Mobile + Desktop) */}
      <PortalScheduleModal
        imovel={currentProperty}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Modal de Todas as Fotos (Compartilhado Mobile + Desktop) */}
      <PortalGalleryModal
        titulo={currentProperty.nomeEdificio?.trim() || currentProperty.titulo || 'Empreendimento'}
        fotos={fotos}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </div>
  );
}
