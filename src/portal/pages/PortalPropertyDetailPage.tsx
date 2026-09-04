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
  Images,
  Calendar,
  Building2,
  CalendarCheck,
  Compass,
  Layers,
  MapPin,
  Maximize2
} from 'lucide-react';
import { PortalProperty } from '../types';
import {
  formatCurrencyBRL,
  formatValorM2,
  calculateValorM2,
} from '../data/mockPortalData';
import { getValidImage, handleImageError } from '../../utils/imageUtils';
import { PortalGalleryModal } from '../components/PortalGalleryModal';
import { PortalScheduleModal } from '../components/PortalScheduleModal';
import { PortalPropertyLocationMap } from '../components/PortalPropertyLocationMap';

interface PortalPropertyDetailPageProps {
  imovel: PortalProperty;
  isFavorite?: boolean;
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
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

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
      if (isGalleryOpen || isScheduleOpen) return;
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPhoto, nextPhoto, onClose, isGalleryOpen, isScheduleOpen]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [imovel.id]);

  const valorM2Formatted = formatValorM2(imovel.valor, imovel.metragem);

  // Características detalhadas para seção "Informações Completas"
  // Regra estrita: mostrar SOMENTE campos que possuam informações
  const fullDetailsList = [
    { label: 'Área privativa', value: imovel.metragem ? `${imovel.metragem} m²` : null },
    { label: 'Área total', value: imovel.areaTotal ? `${imovel.areaTotal} m²` : null },
    { label: 'Quartos', value: imovel.dormitorios || imovel.quartos },
    { label: 'Suítes', value: imovel.suites },
    { label: 'Banheiros', value: imovel.banheiros },
    { label: 'Vagas', value: imovel.vagas },
    { label: 'Andar', value: imovel.andar },
    { label: 'Mobiliado', value: imovel.statusImovel },
    { label: 'Condomínio', value: imovel.condominioFormatado },
    { label: 'IPTU', value: imovel.iptuFormatado },
    { label: 'Edifício', value: imovel.nomeEdificio },
    { label: 'Construtora', value: imovel.construtora },
    { label: 'Data de entrega', value: imovel.dataEntrega },
    { label: 'Tipo', value: imovel.tipoImovel },
    { label: 'Finalidade', value: imovel.tipo ? (imovel.tipo === 'venda' ? 'Venda' : imovel.tipo === 'locação' ? 'Locação' : 'Venda e Locação') : null },
    { label: 'Bairro', value: imovel.bairro },
    { label: 'Cidade', value: imovel.cidade },
    { label: 'Código do imóvel', value: imovel.codigo || imovel.id },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');

  // Formatação das características principais em uma linha limpa
  const mainFeatures: string[] = [];
  if (imovel.metragem) mainFeatures.push(`${imovel.metragem} m²`);
  const totalQuartos = imovel.dormitorios || imovel.quartos;
  if (totalQuartos) mainFeatures.push(`${totalQuartos} ${totalQuartos === 1 ? 'quarto' : 'quartos'}`);
  if (imovel.banheiros) mainFeatures.push(`${imovel.banheiros} ${imovel.banheiros === 1 ? 'banheiro' : 'banheiros'}`);
  if (imovel.vagas) mainFeatures.push(`${imovel.vagas} ${imovel.vagas === 1 ? 'vaga' : 'vagas'}`);
  if (imovel.suites) mainFeatures.push(`${imovel.suites} ${imovel.suites === 1 ? 'suíte' : 'suítes'}`);

  return (
    <div className="bg-white min-h-screen text-slate-900 font-sans pb-24" id="portal-property-detail-page">
      {/* 16. TOPO: IMOBISHARE + ♡ Favoritar + ✕ Fechar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 h-16">
        <div className="max-w-(--breakpoint-2xl) mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 cursor-pointer focus:outline-hidden"
            aria-label="Voltar para a pesquisa"
          >
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <X size={15} />
              <span>Fechar</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <main className="max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        {/* 19. PROPORÇÃO SUPERIOR: ~70% Fotos / ~30% Informações + Ações + Mapa */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 70% -> GALERIA PRINCIPAL COM CARROSSEL (8 colunas no lg) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="relative aspect-16/10 sm:aspect-16/9 bg-slate-900 rounded-3xl overflow-hidden shadow-sm group">
              <img
                src={getValidImage(fotos[activePhotoIdx])}
                alt={`${imovel.titulo} - Foto ${activePhotoIdx + 1}`}
                onError={handleImageError}
                className="w-full h-full object-cover transition-opacity duration-200"
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

              {/* 18. Botão: Ver todas as fotos */}
              <button
                type="button"
                id="btn-view-all-photos"
                onClick={() => setIsGalleryOpen(true)}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-full backdrop-blur-md shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Images size={14} className="text-[#003366]" />
                <span>Ver todas as fotos</span>
              </button>
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

          {/* 30% -> INFORMAÇÕES SUPERIORES + AÇÕES + MAPA (4 colunas no lg) */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
            {/* Bloco de Título, Preço e Ações */}
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

              {/* Botão Principal: AGENDAR VISITA */}
              <button
                type="button"
                id="btn-agendar-visita-topo"
                onClick={() => setIsScheduleOpen(true)}
                className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
              >
                <CalendarCheck size={16} />
                <span>Agendar Visita</span>
              </button>

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

            {/* 21. MAPA DO IMÓVEL (Card de Localização) */}
            <PortalPropertyLocationMap
              latitude={imovel.latitude}
              longitude={imovel.longitude}
              endereco={imovel.endereco}
              bairro={imovel.bairro}
              cidade={imovel.cidade}
            />
          </div>
        </div>

        {/* 22. BREADCRUMB: Início > Balneário Camboriú > Centro > Av. Brasil > IMB-001245 */}
        <nav aria-label="Navegação estrutural" className="pt-4 border-t border-slate-100">
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
        <section className="space-y-2 max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {imovel.titulo}
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Publicado em {imovel.dataPublicacao || '04 de setembro de 2026'}
          </p>
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

        {/* 25. CARACTERÍSTICAS PRINCIPAIS (linha limpa) */}
        {mainFeatures.length > 0 && (
          <section className="py-3 border-y border-slate-100">
            <p className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
              {mainFeatures.join(' • ')}
            </p>
          </section>
        )}

        {/* 26. DESCRIÇÃO (boa largura, legibilidade, espaçamento) */}
        <section className="space-y-3 max-w-3xl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Descrição do Imóvel
          </h3>
          <div className="text-slate-700 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line font-normal">
            {imovel.descricao}
          </div>

          {/* 27. AGENDAR VISITA (segundo botão abaixo da descrição) */}
          <div className="pt-6">
            <button
              type="button"
              id="btn-agendar-visita-descricao"
              onClick={() => setIsScheduleOpen(true)}
              className="px-8 py-3.5 bg-[#003366] hover:bg-[#002244] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer inline-flex items-center gap-2.5"
            >
              <CalendarCheck size={16} />
              <span>Agendar Visita</span>
            </button>
          </div>
        </section>

        {/* 29. INFORMAÇÕES COMPLETAS (Mostra SOMENTE campos que possuem informações) */}
        <section className="pt-8 border-t border-slate-100 space-y-5 max-w-4xl">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            Características do Imóvel
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {fullDetailsList.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100/90 space-y-1"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {item.label}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate">
                  {String(item.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
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
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
      />
    </div>
  );
}
