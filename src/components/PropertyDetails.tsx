/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Imovel, Corretor } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, MessageCircle, ArrowLeft, Building2, UserCheck, ShieldAlert, Check, Bed, Car, Maximize, Bath } from 'lucide-react';
import { getValidImage, isValidImageString, handleImageError } from '../utils/imageUtils';
import { getPropertyCode } from '../utils/codeUtils';
import { DbService } from '../services/db';

interface PropertyDetailsProps {
  imovel: Imovel;
  activeCorretor: Corretor;
  onBack: () => void;
}

export function PropertyDetails({ imovel, activeCorretor, onBack }: PropertyDetailsProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const activeEmailClean = (activeCorretor?.email || '').toLowerCase().trim();
  const imovelEmailClean = (imovel.corretorEmail || '').toLowerCase().trim();
  const isOwner = (imovel.corretorId && imovel.corretorId === activeCorretor?.id) || 
                  (imovelEmailClean && activeEmailClean && imovelEmailClean === activeEmailClean) ||
                  (!imovel.corretorEmail && !imovel.corretorId);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !imovel.fotos || imovel.fotos.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 35) {
      if (diff > 0) {
        // Swiped left -> Next photo
        setActivePhotoIndex((prev) => (prev + 1) % imovel.fotos.length);
      } else {
        // Swiped right -> Previous photo
        setActivePhotoIndex((prev) => (prev - 1 + imovel.fotos.length) % imovel.fotos.length);
      }
    }
    setTouchStartX(null);
  };

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Generate public link format using query parameters for 100% platform and mobile compatibility
  const publicLink = `${window.location.origin}/?imovel=${imovel.id.replace('imovel-', '')}`;

  const handleSendWhatsApp = () => {
    // Build extremely clean and light WhatsApp text for maximum readability
    const location = imovel.nomeEdificio?.trim() ? `${imovel.nomeEdificio} (${imovel.bairro})` : imovel.bairro;
    const tipoLabel = imovel.tipo === 'venda' ? 'Venda' : imovel.tipo === 'locação' ? 'Aluguel' : 'Venda & Aluguel';
    let preco = formatPrice(imovel.valor);
    if (imovel.tipo === 'locação') {
      preco = formatPrice(imovel.valorLocacao || imovel.valor) + '/mês';
    } else if (imovel.tipo === 'ambos') {
      preco = `Venda: ${formatPrice(imovel.valor)} | Locação: ${formatPrice(imovel.valorLocacao || 0)}/mês`;
    }
    const caracteristicas = `${imovel.dormitorios ?? 0} dorms • ${imovel.banheiros ?? 0} BWC • ${imovel.vagas ?? 0} vagas • ${imovel.metragem ?? 0}m²`;

    const messageText = `🏠 \`\`\`${location}\`\`\`
💰 \`\`\`${preco} (${tipoLabel})\`\`\`
✨ \`\`\`${caracteristicas}\`\`\`

Toque abaixo para ver fotos e todos os detalhes:
👉 ${publicLink}`;

    // Generate WhatsApp URL
    const encodedMessage = encodeURIComponent(messageText);
    const waUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    
    // Open in new tab securely
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    
    setWhatsappSent(true);
    setTimeout(() => setWhatsappSent(false), 4000);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16" id={`property-details-${imovel.id}`}>
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
        <button onClick={onBack} className="p-1 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex items-center">
          <ArrowLeft size={20} className="mr-1" />
          <span className="text-xs font-semibold">Voltar</span>
        </button>
        <span className="font-bold text-slate-800 text-sm">Visualização de Imóvel</span>
        <div className="w-12" /> {/* spacing element */}
      </div>

      <div className="max-w-xl mx-auto">
        {/* Gallery */}
        <div 
          className="relative aspect-4/3 bg-slate-900 overflow-hidden select-none touch-pan-y cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={getValidImage(imovel.fotos?.[activePhotoIndex])}
            alt=""
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover select-none pointer-events-none"
          />

          {/* Gallery Counter Indicator */}
          {imovel.fotos.length > 0 && (
            <span className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/20 shadow-md">
              {activePhotoIndex + 1} / {imovel.fotos.length}
            </span>
          )}

          {/* Dots Indicator */}
          {imovel.fotos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {imovel.fotos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full border border-black/10 transition-all ${
                    idx === activePhotoIndex ? 'bg-[#003366] scale-110 w-4' : 'bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Palavra Destacada Badge overlay on top left of main image */}
          {imovel.palavraDestacada?.trim() && (
            <div className="absolute top-3 left-3 z-10">
              <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-indigo-400/40">
                {imovel.palavraDestacada.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail gallery preview */}
        {imovel.fotos.length > 1 && (
          <div className="bg-white p-3 border-b border-slate-100 flex gap-2 overflow-x-auto">
            {imovel.fotos.map((foto, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIndex(idx)}
                className={`relative w-16 h-12 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                  idx === activePhotoIndex ? 'border-[#003366] ring-2 ring-[#003366]/10' : 'border-slate-100 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={getValidImage(foto)} alt="" onError={handleImageError} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}

        {/* Main Content Info */}
        <div className="p-4 space-y-4 bg-white border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {imovel.nomeEdificio ? (
                <div className="flex items-center text-[#003366] gap-1">
                  <Building2 size={12} />
                  <span>{imovel.nomeEdificio}</span>
                </div>
              ) : (
                <span>Residencial</span>
              )}
            </div>

            <h1 className="font-bold text-slate-900 text-lg md:text-xl mt-1 leading-snug">
              {imovel.titulo}
            </h1>

            <div className="flex items-center text-slate-500 text-xs mt-1.5 flex-wrap gap-x-2">
              <span className="flex items-center">
                <MapPin size={13} className="mr-1 text-slate-400" />
                {imovel.localizacao}
              </span>
            </div>
          </div>

          <div className="py-3 border-y border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                {imovel.tipo === 'ambos' ? 'Valores' : 'Valor'}
              </span>
              {imovel.tipo === 'ambos' ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Venda:</span>
                    {imovel.valorAnterior && imovel.valorAnterior > imovel.valor ? (
                      <div className="flex flex-col mt-0.5">
                        <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                          De {formatPrice(imovel.valorAnterior)}
                        </span>
                        <span className="text-base font-bold text-emerald-600 leading-tight">
                          Por {formatPrice(imovel.valor)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-[#003366]">
                        {formatPrice(imovel.valor)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Locação:</span>
                    <span className="text-base font-bold text-emerald-800">
                      {formatPrice(imovel.valorLocacao || 0)}<span className="text-xs font-medium text-slate-500"> /mês</span>
                    </span>
                  </div>
                </div>
              ) : imovel.tipo === 'locação' ? (
                imovel.valorLocacaoAnterior && imovel.valorLocacaoAnterior > (imovel.valorLocacao || imovel.valor) ? (
                  <div className="flex flex-col mt-0.5">
                    <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                      De {formatPrice(imovel.valorLocacaoAnterior)}
                    </span>
                    <span className="text-base font-bold text-emerald-600 leading-tight">
                      Por {formatPrice(imovel.valorLocacao || imovel.valor)}
                      <span className="text-xs font-medium text-slate-500"> /mês</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-base font-bold text-emerald-800">
                    {formatPrice(imovel.valorLocacao || imovel.valor)}
                    <span className="text-xs font-medium text-slate-500"> /mês</span>
                  </span>
                )
              ) : (
                imovel.valorAnterior && imovel.valorAnterior > imovel.valor ? (
                  <div className="flex flex-col mt-0.5">
                    <span className="text-xs text-slate-400 line-through font-medium leading-tight">
                      De {formatPrice(imovel.valorAnterior)}
                    </span>
                    <span className="text-base font-bold text-emerald-600 leading-tight">
                      Por {formatPrice(imovel.valor)}
                    </span>
                  </div>
                ) : (
                  <span className="text-base font-bold text-slate-900">
                    {formatPrice(imovel.valor)}
                  </span>
                )
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Código do Imóvel</span>
              <span className="text-xs font-mono font-bold text-[#003366] bg-[#003366]/5 px-2.5 py-1 rounded-md inline-block mt-0.5 border border-[#003366]/10">
                #{getPropertyCode(imovel)}
              </span>
            </div>
          </div>

          {/* Características Essenciais */}
          <div className="grid grid-cols-4 gap-2 py-1">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Bed size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Dorm.</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.dormitorios ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Bath size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">BWC</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.banheiros ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Car size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Vagas</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.vagas ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Maximize size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Área</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.metragem ?? 0} m²</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição do Imóvel</span>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {imovel.descricao}
            </p>
          </div>
        </div>

        {/* Broker Information - ONLY shown if it's NOT the user's own property */}
        {!isOwner && (() => {
          const corretores = DbService.getCorretores();
          const responsibleBroker = corretores.find(c => (c.id && c.id === imovel.corretorId) || (c.email && c.email.toLowerCase().trim() === imovelEmailClean)) || {
            nome: imovel.corretorNome || 'Corretor ImobiShare',
            telefone: '(47) 99888-7766',
            whatsapp: '47998887766',
            creci: 'Corretor Parceiro',
            foto: ''
          };
          
          const rawPhone = responsibleBroker.telefone || '(47) 99888-7766';
          const rawWhatsapp = responsibleBroker.whatsapp || responsibleBroker.telefone || '47998887766';
          const cleanPhone = rawPhone.replace(/\D/g, '');
          const cleanWhatsapp = rawWhatsapp.replace(/\D/g, '');

          return (
            <div className="p-3.5 bg-white border-b border-slate-100 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsável pelo Cadastro</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                  {isValidImageString(responsibleBroker.foto) ? (
                    <img src={responsibleBroker.foto} alt={responsibleBroker.nome} onError={handleImageError} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-[#003366] flex items-center justify-center text-white font-bold text-sm">
                      {(responsibleBroker.nome || imovel.corretorNome || 'C').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-800 text-sm block truncate">
                    Corretor: {responsibleBroker.nome || imovel.corretorNome || 'Parceiro'}
                  </span>
                  <span className="text-xs text-slate-400 block truncate font-medium">
                    CRECI: {responsibleBroker.creci ? responsibleBroker.creci.replace(/^creci[\:\s]*/i, '') : 'Parceria Autorizada'}
                  </span>
                </div>
              </div>

              {/* Direct Action links for Phone and WhatsApp placed 2 lines below */}
              <div className="pt-1.5 flex items-center gap-2">
                <a
                  href={`tel:${cleanPhone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200/80 active:scale-95 shadow-2xs"
                  title="Ligar para o corretor responsável"
                >
                  <Phone size={14} className="text-[#003366]" />
                  <span>Ligar</span>
                </a>
                <a
                  href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Olá ${responsibleBroker.nome.split(' ')[0]}, vi o imóvel "${imovel.titulo}" (#${imovel.id.replace('imovel-', '')}) no ImobiShare e gostaria de informações.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95"
                  title="Enviar WhatsApp ao corretor responsável"
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          );
        })()}

        {/* Confidential Section - Controle do Proprietário e Informações */}
        {isOwner && (
          <div className="p-4 bg-slate-900 text-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                <ShieldAlert size={14} className="mr-1.5" />
                Controle do Proprietário (Confidencial)
              </h4>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-sm">Somente Você</span>
            </div>

            {(() => {
              const rawN = imovel.nomeProprietario?.trim() || '';
              const rawP = imovel.telefoneProprietario?.trim() || '';
              const rawD = imovel.dadosProprietario?.trim() || '';

              // Find phone number across fields
              const combined = [rawN, rawP, rawD].filter(Boolean).join(' ');
              const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
              const matches = Array.from(combined.matchAll(phoneRegex));

              let cleanPhone = '';
              if (matches.length > 0) {
                const bestMatch = matches.reduce((best, cur) => {
                  const curDigits = cur[0].replace(/\D/g, '');
                  const bestDigits = best.replace(/\D/g, '');
                  return curDigits.length >= bestDigits.length ? cur[0] : best;
                }, matches[0][0]);

                if (bestMatch.replace(/\D/g, '').length >= 8) {
                  cleanPhone = bestMatch.trim();
                }
              }

              if (!cleanPhone && rawP) {
                if (rawP.replace(/\D/g, '').length >= 8) {
                  cleanPhone = rawP.trim();
                }
              }

              // Determine source text for owner name
              let nameSource = rawN;
              if (!nameSource || (cleanPhone && nameSource.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''))) {
                nameSource = rawD;
              }
              if (!nameSource || (cleanPhone && nameSource.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''))) {
                nameSource = rawP;
              }

              // Strip phone from name
              let cleanName = nameSource;
              if (cleanPhone) {
                cleanName = cleanName.replace(cleanPhone, '');
              }
              cleanName = cleanName.replace(/(?:\+?55\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g, '');
              cleanName = cleanName.replace(/^[\s\-:/|.,;]+|[\s\-:/|.,;]+$/g, '').trim();

              // Deduplicate repeated name chunks (e.g. "Alessandro - Alessandro - Alessandro")
              if (cleanName) {
                const chunks = cleanName.split(/[\-/|,]|\s+-\s+/).map(c => c.trim()).filter(Boolean);
                const uniqueChunks: string[] = [];
                for (const chunk of chunks) {
                  if (!uniqueChunks.some(u => u.toLowerCase() === chunk.toLowerCase())) {
                    uniqueChunks.push(chunk);
                  }
                }
                cleanName = uniqueChunks.join(' - ');
              }

              return (
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nome Proprietário:</span>
                    <span className="font-semibold text-slate-200 block mt-0.5">{cleanName || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Telefone Proprietário:</span>
                    {cleanPhone ? (
                      <a href={`tel:${cleanPhone}`} className="font-semibold text-amber-400 hover:underline flex items-center mt-0.5">
                        <Phone size={12} className="mr-1 flex-shrink-0" /> {cleanPhone}
                      </a>
                    ) : (
                      <span className="font-semibold text-slate-400 block mt-0.5">Não informado</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {imovel.informacoes?.trim() && (
              <div className="pt-2.5 border-t border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Informações Adicionais / Controle:</span>
                <p className="text-xs font-medium text-amber-200/95 whitespace-pre-line leading-relaxed bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  {imovel.informacoes.trim()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Informações do imóvel para outros corretores */}
        {!isOwner && imovel.informacoes?.trim() && (
          <div className="p-4 bg-amber-50/90 border-b border-amber-200/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
              Informações do Imóvel
            </span>
            <p className="text-xs text-amber-950 font-medium whitespace-pre-line leading-relaxed">
              {imovel.informacoes.trim()}
            </p>
          </div>
        )}

        {/* Share section: Public link & WhatsApp button inline after owner controls */}
        <div className="p-4 bg-white border-t border-slate-100 space-y-3">
          {/* Link Público de Compartilhamento */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0 flex-grow">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Link Público de Compartilhamento</span>
              <span className="text-xs text-slate-600 truncate font-mono select-all">
                {publicLink}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                alert('Link público copiado com sucesso! Você pode compartilhar onde quiser.');
              }}
              className="text-xs font-bold text-[#003366] hover:text-[#002244] bg-white border border-slate-200 px-2.5 py-1.5 rounded-md flex-shrink-0 shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              Copiar Link
            </button>
          </div>

          {/* WhatsApp button below the public link */}
          <button
            onClick={handleSendWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 text-sm cursor-pointer"
          >
            {whatsappSent ? (
              <>
                <Check size={18} /> Link Gerado e Compartilhado!
              </>
            ) : (
              <>
                <MessageCircle size={18} /> Compartilhar no WhatsApp
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
