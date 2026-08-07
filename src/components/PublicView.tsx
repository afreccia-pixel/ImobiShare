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
    const textMessage = `Olá ${broker.nome.split(' ')[0]}, vi o anúncio público do imóvel "${imovel.nomeEdificio?.trim() || imovel.titulo}" (#${getPropertyCode(imovel)}) e gostaria de mais informações.`;
    const waUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(textMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans select-none" id={`public-view-imovel-${imovel.id}`}>
      
      {/* Public Banner at top */}
      <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-4 py-2 text-xs flex justify-between items-center text-center">
        <span>🌐 Você está visualizando o <b>Link Público do Imóvel</b></span>
        <button 
          onClick={onExit}
          className="bg-[#003366] hover:bg-[#002244] text-white font-bold px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer shadow-2xs"
        >
          Voltar ao App
        </button>
      </div>

      {/* Brand logo bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-[#003366] font-bold text-sm">
          <img
            src={logoImg}
            alt="ImobiShare Logo"
            className="w-5 h-5 object-contain rounded-md"
            referrerPolicy="no-referrer"
          />
          <span className="font-extrabold text-[#003366] tracking-tight">ImobiShare</span>
        </div>
        <div className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-1 rounded-full uppercase">
          Anúncio Ativo
        </div>
      </div>

      <div className="max-w-xl mx-auto bg-white shadow-xs rounded-b-xl overflow-hidden">
        {/* Main photo slider */}
        <div className="relative aspect-4/3 bg-slate-900">
          <img
            src={getValidImage(imovel.fotos?.[activePhotoIdx])}
            alt=""
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

          {/* Dots */}
          {imovel.fotos && imovel.fotos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1 z-10">
              {imovel.fotos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`w-2 h-2 rounded-full ${
                    idx === activePhotoIdx ? 'bg-[#003366] w-3' : 'bg-white/65'
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
          <div className="p-3 bg-slate-50 flex gap-2 overflow-x-auto border-b border-slate-100">
            {imovel.fotos.map((foto, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative w-14 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 ${
                  idx === activePhotoIdx ? 'border-[#003366]' : 'border-transparent opacity-70'
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
            <h1 className="font-bold text-slate-900 text-lg md:text-xl leading-snug">
              {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
            </h1>
            <div className="flex items-center text-slate-500 text-xs mt-1.5">
              <MapPin size={12} className="mr-1 text-slate-400" />
              <span>{imovel.bairro}, {imovel.cidade} - SC</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase text-slate-400 font-bold block">
                {imovel.tipo === 'ambos' ? 'Valores' : 'Preço'}
              </span>
              {imovel.tipo === 'ambos' ? (
                <div className="flex flex-col gap-1 mt-0.5">
                  <span className="text-sm font-bold text-[#003366]">
                    Venda: {formatPrice(imovel.valor)}
                  </span>
                  <span className="text-sm font-bold text-emerald-800">
                    Locação: {formatPrice(imovel.valorLocacao || 0)}/mês
                  </span>
                </div>
              ) : imovel.tipo === 'locação' ? (
                <span className="text-xl font-bold text-emerald-800">
                  {formatPrice(imovel.valorLocacao || imovel.valor)}
                  <span className="text-xs font-normal text-slate-500"> /mês</span>
                </span>
              ) : (
                <span className="text-xl font-bold text-slate-900">
                  {formatPrice(imovel.valor)}
                </span>
              )}
            </div>
            
            <div className="text-right">
              <span className="text-[9px] uppercase text-slate-400 font-bold block">Código do Imóvel</span>
              <span className="text-xs font-mono font-bold text-slate-600 mt-1 block">#{getPropertyCode(imovel)}</span>
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição detalhada</span>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {imovel.descricao}
            </p>
          </div>

          {/* Broker details card */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {isValidImageString(broker.foto) ? (
                <img
                  src={broker.foto}
                  alt={broker.nome}
                  onError={handleImageError}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#003366] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(broker.nome || 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block truncate">Corretor: {broker.nome}</span>
                <span className="text-[10px] text-slate-400 block truncate">
                  CRECI: {broker.creci ? broker.creci.replace(/^creci[\:\s]*/i, '') : 'Não informado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg transition-all border border-slate-200/80 active:scale-95 cursor-pointer"
                title="Ligar para o corretor"
              >
                <Phone size={12} className="text-[#003366]" />
                <span>Ligar</span>
              </a>
              <button
                onClick={handleWhatsAppClick}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Enviar WhatsApp ao corretor"
              >
                <MessageCircle size={12} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

