/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import logoImg from '../assets/images/app_icon_1785762115971.jpg';
import { Imovel, Corretor } from '../types';
import { MOCK_CORRETORES } from '../data';
import { DbService } from '../services/db';
import { MapPin, Phone, MessageCircle, Bed, Car, Maximize, Bath } from 'lucide-react';
import { getValidImage, isValidImageString, handleImageError } from '../utils/imageUtils';
import { getPropertyCode } from '../utils/codeUtils';

interface PublicViewProps {
  imovel: Imovel;
  activeCorretor?: Corretor;
  onExit: () => void;
}

export function PublicView({ imovel, activeCorretor, onExit }: PublicViewProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Find listing broker or active logged-in broker
  const corretores = DbService.getCorretores();
  const broker = activeCorretor || 
    corretores.find(c => (c.id && c.id === imovel.corretorId) || (c.email && c.email.toLowerCase().trim() === imovel.corretorEmail?.toLowerCase().trim())) || 
    MOCK_CORRETORES[0];

  const rawPhone = broker?.telefone || '(47) 99888-7766';
  const rawWhatsapp = broker?.whatsapp || broker?.telefone || '47998887766';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const cleanWhatsapp = rawWhatsapp.replace(/\D/g, '');

  const handleWhatsAppClick = () => {
    const textMessage = `Olá ${broker.nome.split(' ')[0]}, vi o anúncio do imóvel "${imovel.nomeEdificio?.trim() || imovel.titulo}" (#${getPropertyCode(imovel)}) e gostaria de mais informações.`;
    const waUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(textMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans select-none" id={`public-view-imovel-${imovel.id}`}>
      {/* Brand logo bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2 text-[#003366] font-bold text-sm">
          <img
            src={logoImg}
            alt="ImobiShare Logo"
            className="w-5 h-5 object-contain rounded-md"
            referrerPolicy="no-referrer"
          />
          <span className="font-extrabold text-[#003366] tracking-tight text-base">ImobiShare</span>
        </div>
        <div className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          Anúncio Ativo
        </div>
      </div>

      <div className="max-w-xl mx-auto bg-white shadow-xs rounded-b-xl overflow-hidden">
        {/* Main compact photo container */}
        <div className="relative h-52 sm:h-64 bg-slate-900 overflow-hidden">
          <img
            src={getValidImage(imovel.fotos?.[activePhotoIdx])}
            alt=""
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

          {/* Dots */}
          {imovel.fotos && imovel.fotos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-10">
              {imovel.fotos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activePhotoIdx ? 'bg-[#003366] w-3.5' : 'bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Palavra Destacada Badge overlay on main image */}
          {imovel.palavraDestacada?.trim() && (
            <div className="absolute top-3 left-3 z-10">
              <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-wider text-white bg-indigo-600/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-md border border-indigo-400/40">
                {imovel.palavraDestacada.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnails preview */}
        {imovel.fotos && imovel.fotos.length > 1 && (
          <div className="p-2.5 bg-slate-50 flex gap-2 overflow-x-auto border-b border-slate-100">
            {imovel.fotos.map((foto, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative w-14 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                  idx === activePhotoIdx ? 'border-[#003366] scale-105' : 'border-transparent opacity-70'
                }`}
              >
                <img src={getValidImage(foto)} alt="" onError={handleImageError} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}

        {/* Content Info */}
        <div className="p-4 space-y-4">
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg md:text-xl leading-snug">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
            </h1>
            <div className="flex items-center text-slate-500 text-xs mt-1 font-medium">
              <MapPin size={13} className="mr-1 text-slate-400 flex-shrink-0" />
              <span>{imovel.bairro}, {imovel.cidade} - SC</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
            <div>
              <span className="text-[9px] uppercase text-slate-400 font-extrabold block tracking-wider">
                {imovel.tipo === 'ambos' ? 'Valores' : 'Preço'}
              </span>
              {imovel.tipo === 'ambos' ? (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <span className="text-sm font-black text-[#003366]">
                    Venda: {formatPrice(imovel.valor)}
                  </span>
                  <span className="text-sm font-black text-emerald-800">
                    Locação: {formatPrice(imovel.valorLocacao || 0)}/mês
                  </span>
                </div>
              ) : imovel.tipo === 'locação' ? (
                <span className="text-xl font-black text-emerald-800">
                  {formatPrice(imovel.valorLocacao || imovel.valor)}
                  <span className="text-xs font-semibold text-slate-500"> /mês</span>
                </span>
              ) : (
                <span className="text-xl font-black text-[#003366]">
                  {formatPrice(imovel.valor)}
                </span>
              )}
            </div>
            
            <div className="text-right">
              <span className="text-[9px] uppercase text-slate-400 font-extrabold block tracking-wider">Código</span>
              <span className="text-xs font-mono font-bold text-slate-600 mt-1 block">#{getPropertyCode(imovel)}</span>
            </div>
          </div>

          {/* Características Essenciais */}
          <div className="grid grid-cols-4 gap-2 py-1">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Bed size={16} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-extrabold">Dorm.</span>
              <span className="text-xs font-black text-slate-800">{imovel.dormitorios ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Bath size={16} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-extrabold">BWC</span>
              <span className="text-xs font-black text-slate-800">{imovel.banheiros ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Car size={16} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-extrabold">Vagas</span>
              <span className="text-xs font-black text-slate-800">{imovel.vagas ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Maximize size={16} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-extrabold">Área</span>
              <span className="text-xs font-black text-slate-800">{imovel.metragem ?? 0} m²</span>
            </div>
          </div>

          {imovel.descricao && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição detalhada</span>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                {imovel.descricao}
              </p>
            </div>
          )}

          {/* Broker details card - buttons positioned directly under broker name */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-3">
              {isValidImageString(broker.foto) ? (
                <img
                  src={broker.foto}
                  alt={broker.nome}
                  onError={handleImageError}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#003366] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                  {(broker.nome || 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 block truncate">
                  Corretor: {broker.nome}
                </span>
                <span className="text-[11px] text-slate-400 block truncate mt-0.5 font-medium">
                  CRECI: {broker.creci ? broker.creci.replace(/^creci[\:\s]*/i, '') : 'Não informado'}
                </span>
              </div>
            </div>

            {/* Action buttons under broker info */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200/80 active:scale-95 cursor-pointer"
                title="Ligar para o corretor"
              >
                <Phone size={13} className="text-[#003366]" />
                <span>Ligar</span>
              </a>
              <button
                onClick={handleWhatsAppClick}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Enviar WhatsApp ao corretor"
              >
                <MessageCircle size={13} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

