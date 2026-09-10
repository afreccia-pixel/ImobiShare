/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  BedDouble,
  Bath,
  Car,
  Clock,
  Share2,
  Calendar,
  Check,
} from 'lucide-react';
import { PortalProperty } from '../types';
import {
  formatCurrencyBRL,
  formatValorM2,
} from '../data/mockPortalData';
import { getValidImage, handleImageError } from '../../utils/imageUtils';
import { LOGO_IMAGE } from '../../assets/logo';
import { DbService } from '../../services/db';
import { PortalGalleryModal } from '../components/PortalGalleryModal';
import { PortalPropertyLocationMap } from '../components/PortalPropertyLocationMap';
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
 * Formata a data de publicação ou cadastro real do imóvel em português:
 * "Publicado em 8 de setembro de 2026"
 */
function formatDataPublicacaoReal(dataCadastro?: string, dataPublicacao?: string): string | null {
  const rawDate = dataCadastro || dataPublicacao;
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;

  const dia = parsed.getDate();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mes = meses[parsed.getMonth()];
  const ano = parsed.getFullYear();
  return `Publicado em ${dia} de ${mes} de ${ano}`;
}

export function PortalPropertyDetailPage({
  imovel,
  isFavorite = false,
  fromMap = false,
  onToggleFavorite,
  onClose,
  onGoHome,
}: PortalPropertyDetailPageProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [fullFotos, setFullFotos] = useState<string[]>(imovel.fotos || []);

  useEffect(() => {
    if (imovel.id) {
      DbService.getImovelById(imovel.id).then(full => {
        if (full && Array.isArray(full.fotos) && full.fotos.length > 0) {
          setFullFotos(full.fotos);
        }
      }).catch(() => {});
    }
  }, [imovel.id]);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: imovel.titulo,
      text: `${imovel.titulo} - ImobiShare`,
      url,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const activeFotos = fullFotos.length > 0 ? fullFotos : (imovel.fotos || []);
  const fotos = activeFotos.length > 0
    ? activeFotos
    : ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&auto=format&fit=crop&q=85'];

  const prevPhoto = useCallback(() => {
    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
  }, [fotos.length]);

  const nextPhoto = useCallback(() => {
    setActivePhotoIdx((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
  }, [fotos.length]);

  // Keyboard navigation for arrows and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGalleryOpen) return;
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPhoto, nextPhoto, onClose, isGalleryOpen]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [imovel.id]);

  const isNaPlanta = imovel.statusImovel === 'Na planta' || imovel.isLancamento;

  // Valor do m²: calculado SOMENTE quando houver preço válido e área privativa > 0
  const hasAreaPrivativaValida = typeof imovel.metragem === 'number' && imovel.metragem > 0;
  const hasPrecoValido = typeof imovel.valor === 'number' && imovel.valor > 0;
  const valorM2Calculado = (hasPrecoValido && hasAreaPrivativaValida)
    ? Math.round(imovel.valor / imovel.metragem!)
    : null;
  const valorM2Formatted = valorM2Calculado ? `R$ ${valorM2Calculado.toLocaleString('pt-BR')}/m²` : null;

  // Características reais
  const totalQuartos = (typeof imovel.dormitorios === 'number' && imovel.dormitorios > 0)
    ? imovel.dormitorios
    : ((typeof imovel.quartos === 'number' && imovel.quartos > 0) ? imovel.quartos : null);

  const hasQuartos = totalQuartos !== null;
  const hasBanheiros = typeof imovel.banheiros === 'number' && imovel.banheiros > 0;
  const hasVagas = typeof imovel.vagas === 'number' && imovel.vagas > 0;
  const hasCondominio = typeof imovel.condominio === 'number' && imovel.condominio > 0;
  const hasIptu = typeof imovel.iptu === 'number' && imovel.iptu > 0;

  const dataPublicacaoText = formatDataPublicacaoReal(imovel.dataCadastro, imovel.dataPublicacao);

  // Construtora limpa (não exibir se não informada)
  const construtoraLimpa = imovel.construtora &&
    imovel.construtora.trim() !== '' &&
    !imovel.construtora.toLowerCase().includes('não informada') &&
    !imovel.construtora.toLowerCase().includes('indefinid')
    ? imovel.construtora.trim()
    : null;

  const nomeEdificioLimpo = imovel.nomeEdificio && imovel.nomeEdificio.trim() !== ''
    ? imovel.nomeEdificio.trim()
    : null;

  const getCondominioVal = (): string | null => {
    if (typeof imovel.condominio === 'number' && imovel.condominio > 0) {
      return `R$ ${imovel.condominio.toLocaleString('pt-BR')}`;
    }
    if (imovel.condominioFormatado && imovel.condominioFormatado.trim() !== '') {
      const match = imovel.condominioFormatado.match(/R\$\s*[\d.,]+/i);
      if (match) {
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  };

  const getIptuVal = (): string | null => {
    if (typeof imovel.iptu === 'number' && imovel.iptu > 0) {
      return `R$ ${imovel.iptu.toLocaleString('pt-BR')}`;
    }
    if (imovel.iptuFormatado && imovel.iptuFormatado.trim() !== '') {
      const match = imovel.iptuFormatado.match(/R\$\s*[\d.,]+/i);
      if (match) {
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  };

  const renderActionCard = (isMobileView: boolean = false) => {
    const condVal = getCondominioVal();
    const iptuVal = getIptuVal();
    const hasTaxas = Boolean(condVal || iptuVal);

    return (
    <div
      id={isMobileView ? 'card-acao-mobile' : 'card-acao-desktop'}
      className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4"
    >
      <div>
        {construtoraLimpa && (
          <div className="mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 bg-slate-100 text-[#003366] text-[11px] sm:text-xs font-extrabold rounded-full tracking-wider uppercase border border-slate-200/60">
              {construtoraLimpa}
            </span>
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
          {imovel.titulo}
        </h1>
      </div>

      {/* Preço e Valor por m² */}
      <div className="pt-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrencyBRL(imovel.valor)}
          </span>
          {valorM2Formatted && (
            <span className="text-xs sm:text-sm font-bold text-slate-500">
              {valorM2Formatted}
            </span>
          )}
        </div>
      </div>

      {/* Condomínio e IPTU na linha abaixo do valor com /mês e /anual em tamanho menor e só mostrar se tiver valor */}
      {hasTaxas && (
        <div className="pt-3 pb-2 border-t border-slate-100 space-y-1.5">
          {condVal && (
            <div className="text-base sm:text-lg tracking-tight flex items-baseline gap-1.5 flex-wrap">
              <span className="font-black text-slate-900">{condVal}</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-500">/mês</span>
              <span className="font-bold text-slate-700">Condomínio</span>
            </div>
          )}
          {iptuVal && (
            <div className="text-base sm:text-lg tracking-tight flex items-baseline gap-1.5 flex-wrap">
              <span className="font-black text-slate-900">{iptuVal}</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-500">/anual</span>
              <span className="font-bold text-slate-700">IPTU</span>
            </div>
          )}
        </div>
      )}

      {/* DEPOIS O BOTAO DE Favoritar, Agendar e Compartilhar */}
      <div className="space-y-2.5 pt-1">
        {/* Agendar */}
        <button
          type="button"
          id={isMobileView ? 'btn-agendar-mobile' : 'btn-agendar-sidebar'}
          onClick={() => setIsScheduleModalOpen(true)}
          className="w-full py-3.5 px-4 bg-[#003366] hover:bg-[#002244] text-white text-sm sm:text-base font-extrabold rounded-xl shadow-md shadow-[#003366]/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Calendar size={18} />
          <span>Agendar Visita</span>
        </button>

        {/* Favoritar e Compartilhar */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            id={isMobileView ? 'btn-favoritar-mobile' : 'btn-favoritar-sidebar'}
            onClick={() => onToggleFavorite?.(imovel.id)}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
              isFavorite
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Heart
              size={16}
              className={isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}
            />
            <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
          </button>

          <button
            type="button"
            id={isMobileView ? 'btn-compartilhar-mobile' : 'btn-compartilhar-sidebar'}
            onClick={handleShare}
            className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            {copiedShare ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copiado!</span>
              </>
            ) : (
              <>
                <Share2 size={16} className="text-slate-500" />
                <span>Compartilhar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="bg-white min-h-screen text-slate-900 font-sans pb-24" id="portal-property-detail-page">
      {/* 16. TOPO: IMOBISHARE + ♡ Favoritar + ✕ Fechar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 h-16">
        <div className="max-w-(--breakpoint-2xl) mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <button
            type="button"
            id="portal-detail-header-logo"
            onClick={onClose}
            className="group flex items-center gap-2.5 cursor-pointer focus:outline-hidden"
            aria-label="Voltar para a pesquisa"
          >
            <img
              src={LOGO_IMAGE}
              alt="ImobiShare Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg shadow-xs group-hover:scale-105 transition-transform"
              referrerPolicy="no-referrer"
            />
            <span className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight font-sans">
              IMOBISHARE
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* ✕ Fechar */}
            <button
              type="button"
              id="btn-detail-close-top"
              onClick={onClose}
              aria-label="Fechar detalhes do imóvel"
              className="flex items-center gap-2 px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-sm sm:text-base font-bold text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300/90 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <X size={20} className="stroke-[2.5]" />
              <span>Fechar</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <main className="max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        {/* GRID COM COLUNA ESQUERDA (FOTOS, BREADCRUMB, TÍTULO, PREÇO, CARACTERÍSTICAS COM ÍCONES, DESCRIÇÃO) E COLUNA DIREITA STICKY (RESIDENCIAL SANCHO + MAPA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUNA ESQUERDA (8 colunas no lg) */}
          <div className="lg:col-span-8 space-y-8 min-w-0">
            {/* 19. GALERIA PRINCIPAL COM CARROSSEL */}
            <div className="space-y-3">
              <div className="relative aspect-16/10 sm:aspect-16/9 bg-slate-900 rounded-3xl overflow-hidden shadow-sm group">
                <img
                  src={getValidImage(fotos[activePhotoIdx])}
                  alt={`${imovel.titulo} - Foto ${activePhotoIdx + 1}`}
                  onError={handleImageError}
                  onClick={() => setIsGalleryOpen(true)}
                  className="w-full h-full object-cover transition-opacity duration-200 cursor-pointer"
                  referrerPolicy="no-referrer"
                />

                {/* Botão Anterior ‹ */}
                {fotos.length > 1 && (
                  <button
                    type="button"
                    id="btn-carousel-prev"
                    onClick={prevPhoto}
                    aria-label="Foto anterior"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center backdrop-blur-xs shadow-md transition-all active:scale-90 cursor-pointer"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}

                {/* Botão Próxima › */}
                {fotos.length > 1 && (
                  <button
                    type="button"
                    id="btn-carousel-next"
                    onClick={nextPhoto}
                    aria-label="Próxima foto"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 hover:bg-white text-slate-800 flex items-center justify-center backdrop-blur-xs shadow-md transition-all active:scale-90 cursor-pointer"
                  >
                    <ChevronRight size={22} />
                  </button>
                )}

                {/* Contador de fotos (ex: 1 / 7) */}
                <div className="absolute bottom-4 left-4 bg-slate-900/70 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xs">
                  {activePhotoIdx + 1} / {fotos.length}
                </div>
              </div>

              {/* Miniaturas horizontais rápidas */}
              {fotos.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                  {fotos.map((foto, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activePhotoIdx === idx
                          ? 'border-[#003366] opacity-100 scale-102'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getValidImage(foto)}
                        alt={`Miniatura ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 22. BREADCRUMB: Início > Balneário Camboriú > Centro > Av. Brasil > IMB-001245 */}
            <nav aria-label="Navegação estrutural" className="pt-2 border-t border-slate-100">
              <ol className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                <li>
                  <button
                    type="button"
                    onClick={onClose}
                    className="hover:text-[#003366] transition-colors cursor-pointer"
                  >
                    Início
                  </button>
                </li>
                {imovel.cidade && (
                  <>
                    <li>›</li>
                    <li>
                      <span className="text-slate-600">
                        {imovel.cidade}
                      </span>
                    </li>
                  </>
                )}
                {imovel.bairro && (
                  <>
                    <li>›</li>
                    <li>
                      <span className="text-slate-600">
                        {imovel.bairro}
                      </span>
                    </li>
                  </>
                )}
                {imovel.endereco && (
                  <>
                    <li>›</li>
                    <li>
                      <span className="text-slate-600">
                        {imovel.endereco}
                      </span>
                    </li>
                  </>
                )}
                <li>›</li>
                <li className="font-semibold text-slate-700">
                  {imovel.codigo || imovel.id}
                </li>
              </ol>
            </nav>

            {/* 23. TÍTULO COMPLETO E DATA DE PUBLICAÇÃO */}
            <section className="space-y-2">
              {construtoraLimpa && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-[#003366] text-xs sm:text-sm font-extrabold rounded-full tracking-wider uppercase border border-slate-200/60">
                    {construtoraLimpa}
                  </span>
                </div>
              )}
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {imovel.titulo}
              </h2>
              {dataPublicacaoText && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span>{dataPublicacaoText}</span>
                </div>
              )}
            </section>

            {/* CARD DE AÇÃO MOBILE (Preço, Condomínio, IPTU e Botões) */}
            <div className="lg:hidden">
              {renderActionCard(true)}
            </div>

            {/* 25. CARACTERÍSTICAS EM DESTAQUE COM ÍCONES (Área privativa, Quartos, Banheiros, Vagas) */}
            <section className="py-5 border-y border-slate-100" id="caracteristicas-destaque-imovel">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Área privativa */}
                {hasAreaPrivativaValida && (
                  <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                      <Maximize2 size={22} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider block">
                        Área privativa
                      </span>
                      <span className="text-base sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                        {imovel.metragem} m²
                      </span>
                    </div>
                  </div>
                )}

                {/* Quartos */}
                {hasQuartos && (
                  <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                      <BedDouble size={22} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider block">
                        Quartos
                      </span>
                      <span className="text-base sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                        {totalQuartos}
                      </span>
                    </div>
                  </div>
                )}

                {/* Banheiros */}
                {hasBanheiros && (
                  <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                      <Bath size={22} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider block">
                        Banheiros
                      </span>
                      <span className="text-base sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                        {imovel.banheiros}
                      </span>
                    </div>
                  </div>
                )}

                {/* Vagas */}
                {hasVagas && (
                  <div className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-slate-50/80 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                      <Car size={22} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider block">
                        Vagas
                      </span>
                      <span className="text-base sm:text-lg lg:text-xl font-black text-slate-900 block truncate">
                        {imovel.vagas}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 26. DESCRIÇÃO (boa largura, legibilidade, espaçamento) */}
            <section className="space-y-4">
              <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
                Descrição do Imóvel
              </h3>
              <div className="text-slate-800 text-base sm:text-lg lg:text-xl leading-relaxed space-y-4 whitespace-pre-line font-normal">
                {imovel.descricao}
              </div>
            </section>

            {/* Mapa no Mobile */}
            <div className="lg:hidden pt-4">
              <PortalPropertyLocationMap
                latitude={imovel.latitude}
                longitude={imovel.longitude}
                endereco={imovel.endereco}
                bairro={imovel.bairro}
                cidade={imovel.cidade}
              />
            </div>
          </div>

          {/* COLUNA DIREITA STICKY (4 colunas no lg) - Desktop */}
          <div className="hidden lg:block lg:col-span-4 space-y-5 lg:sticky lg:top-20 self-start">
            {/* Bloco de Título, Preço, Condomínio, IPTU e Botões */}
            {renderActionCard(false)}

            {/* 21. MAPA DO IMÓVEL (Card de Localização) */}
            <div>
              <PortalPropertyLocationMap
                latitude={imovel.latitude}
                longitude={imovel.longitude}
                endereco={imovel.endereco}
                bairro={imovel.bairro}
                cidade={imovel.cidade}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Todas as Fotos */}
      <PortalGalleryModal
        titulo={imovel.nomeEdificio || imovel.titulo}
        fotos={fotos}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />

      {/* Modal de Agendar Visita */}
      <PortalScheduleModal
        imovel={imovel}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />
    </div>
  );
}
