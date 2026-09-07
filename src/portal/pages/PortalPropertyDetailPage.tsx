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
  Building2,
  Maximize2,
  BedDouble,
  Bath,
  Car,
  Receipt,
  Clock,
} from 'lucide-react';
import { PortalProperty } from '../types';
import {
  formatCurrencyBRL,
  formatValorM2,
} from '../data/mockPortalData';
import { getValidImage, handleImageError } from '../../utils/imageUtils';
import { LOGO_IMAGE } from '../../assets/logo';
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
 * Calcula o tempo decorrido desde a publicação no formato:
 * "Publicado a 1 dia", "Publicado a 10 dias", "Publicado a 1 mês", "Publicado a 2 meses", etc.
 */
function formatTempoPublicacao(dataCadastro?: string, dataPublicacao?: string): string {
  let date: Date | null = null;

  if (dataCadastro) {
    const parsed = new Date(dataCadastro);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date && dataPublicacao) {
    const meses: Record<string, number> = {
      janeiro: 0,
      fevereiro: 1,
      marco: 2,
      março: 2,
      abril: 3,
      maio: 4,
      junho: 5,
      julho: 6,
      agosto: 7,
      setembro: 8,
      outubro: 9,
      novembro: 10,
      dezembro: 11,
    };
    const match = dataPublicacao.toLowerCase().match(/(\d{1,2})\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/);
    if (match) {
      const dia = parseInt(match[1], 10);
      const mesNome = match[2];
      const ano = parseInt(match[3], 10);
      if (meses[mesNome] !== undefined) {
        date = new Date(ano, meses[mesNome], dia);
      }
    } else {
      const parsed = new Date(dataPublicacao);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
  }

  if (!date) {
    return 'Publicado a poucos dias';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    if (diffHours <= 1) return 'Publicado a 1 hora';
    if (diffHours < 24) return `Publicado a ${diffHours} horas`;
    return 'Publicado hoje';
  }
  if (diffDays === 1) {
    return 'Publicado a 1 dia';
  }
  if (diffDays < 30) {
    return `Publicado a ${diffDays} dias`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) {
    return 'Publicado a 1 mês';
  }
  if (diffMonths < 12) {
    return `Publicado a ${diffMonths} meses`;
  }
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) {
    return 'Publicado a 1 ano';
  }
  return `Publicado a ${diffYears} anos`;
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

  const fotos = imovel.fotos && imovel.fotos.length > 0
    ? imovel.fotos
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

  const valorM2Formatted = formatValorM2(imovel.valor, imovel.metragem);

  // Valores formatados para as 6 características em destaque com ícones após o preço
  const areaPrivativaText = imovel.metragem
    ? `${imovel.metragem} m²`
    : (imovel.areaTotal ? `${imovel.areaTotal} m²` : '-');

  const totalQuartos = imovel.dormitorios || imovel.quartos;
  const quartosText = totalQuartos
    ? `${totalQuartos} ${totalQuartos === 1 ? 'quarto' : 'quartos'}`
    : '-';

  const banheirosText = imovel.banheiros
    ? `${imovel.banheiros} ${imovel.banheiros === 1 ? 'banheiro' : 'banheiros'}`
    : '-';

  const vagasText = imovel.vagas
    ? `${imovel.vagas} ${imovel.vagas === 1 ? 'vaga' : 'vagas'}`
    : '-';

  const condominioText = imovel.condominioFormatado || (
    imovel.condominio ? `R$ ${imovel.condominio.toLocaleString('pt-BR')} / mês` : 'Sob consulta'
  );

  const iptuText = imovel.iptuFormatado || (
    imovel.iptu ? `R$ ${imovel.iptu.toLocaleString('pt-BR')} / ano` : 'Sob consulta'
  );

  const tempoPublicacaoText = formatTempoPublicacao(imovel.dataCadastro, imovel.dataPublicacao);

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
            {/* ♡ Favoritar / ♥ Favoritado */}
            <button
              type="button"
              id="btn-detail-favorite-top"
              onClick={() => onToggleFavorite?.(imovel.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-xs active:scale-95 ${
                isFavorite
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Heart
                size={14}
                className={isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}
              />
              <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>

            {/* ✕ Fechar */}
            <button
              type="button"
              id="btn-detail-close-top"
              onClick={onClose}
              aria-label="Fechar detalhes do imóvel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <X size={15} />
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
                <li>›</li>
                <li>
                  <span className="hover:text-slate-600 transition-colors">
                    {imovel.cidade}
                  </span>
                </li>
                <li>›</li>
                <li>
                  <span className="hover:text-slate-600 transition-colors">
                    {imovel.bairro}
                  </span>
                </li>
                {imovel.endereco && (
                  <>
                    <li>›</li>
                    <li>
                      <span className="hover:text-slate-600 transition-colors">
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
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {imovel.titulo}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span>{tempoPublicacaoText}</span>
              </div>
            </section>

            {/* 24. PREÇO & VALOR POR M² */}
            <section className="space-y-1">
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {formatCurrencyBRL(imovel.valor)}
                </span>
                {valorM2Formatted && (
                  <span className="text-sm sm:text-base font-bold text-slate-500">
                    {valorM2Formatted}
                  </span>
                )}
              </div>
            </section>

            {/* 25. CARACTERÍSTICAS EM DESTAQUE COM ÍCONES */}
            <section className="py-4 border-y border-slate-100" id="caracteristicas-destaque-imovel">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Área privativa */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <Maximize2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Área privativa
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={areaPrivativaText}>
                      {areaPrivativaText}
                    </span>
                  </div>
                </div>

                {/* Quartos */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <BedDouble size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Quartos
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={quartosText}>
                      {quartosText}
                    </span>
                  </div>
                </div>

                {/* Banheiros */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <Bath size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Banheiros
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={banheirosText}>
                      {banheirosText}
                    </span>
                  </div>
                </div>

                {/* Vagas */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <Car size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vagas
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={vagasText}>
                      {vagasText}
                    </span>
                  </div>
                </div>

                {/* Condomínio */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Condomínio
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={condominioText}>
                      {condominioText}
                    </span>
                  </div>
                </div>

                {/* IPTU */}
                <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-2xl border border-slate-100/90 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-[#003366] shrink-0 shadow-2xs">
                    <Receipt size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      IPTU
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate" title={iptuText}>
                      {iptuText}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 26. DESCRIÇÃO (boa largura, legibilidade, espaçamento) */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Descrição do Imóvel
              </h3>
              <div className="text-slate-700 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line font-normal">
                {imovel.descricao}
              </div>

              {/* Botão grande: Agendar Visita sem o ícone */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-agendar-visita-descricao"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="w-full py-4 px-8 bg-[#003366] hover:bg-[#002244] text-white text-base sm:text-lg font-extrabold rounded-2xl shadow-lg shadow-[#003366]/20 hover:shadow-xl hover:shadow-[#003366]/30 transition-all duration-200 cursor-pointer active:scale-[0.99] text-center"
                >
                  Agendar Visita
                </button>
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA STICKY (4 colunas no lg) - Apenas desktop, oculta no celular para não duplicar informações abaixo de Agendar Visita */}
          <div className="hidden lg:block lg:col-span-4 space-y-5 lg:sticky lg:top-20 self-start">
            {/* Bloco de Título, Empreendimento/Edifício, Preço e Favoritar */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#003366] bg-blue-50 px-2.5 py-1 rounded-full inline-block mb-2">
                  {imovel.nomeEdificio || 'Lançamento Exclusivo'}
                </span>
                <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                  {imovel.titulo}
                </h1>
              </div>

              {/* Preço e Valor por m² */}
              <div className="pt-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatCurrencyBRL(imovel.valor)}
                  </span>
                  {valorM2Formatted && (
                    <span className="text-xs font-semibold text-slate-500">
                      {valorM2Formatted}
                    </span>
                  )}
                </div>
              </div>

              {/* Botão secundário: ♡ Favoritar */}
              <button
                type="button"
                id="btn-favoritar-sidebar"
                onClick={() => onToggleFavorite?.(imovel.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isFavorite
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <Heart
                  size={14}
                  className={isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}
                />
                <span>{isFavorite ? '♥ Favoritado na sua lista' : '♡ Adicionar aos Favoritos'}</span>
              </button>
            </div>

            {/* 21. MAPA DO IMÓVEL (Card de Localização) - Apenas no computador (desktop), oculto no celular */}
            <div className="hidden lg:block">
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
