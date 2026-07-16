/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import logoImg from '../assets/images/imobishare_logo_1784239677798.jpg';
import { Imovel } from '../types';
import { MOCK_CORRETORES } from '../data';
import { MapPin, Phone, MessageCircle, Building2, Check, ArrowLeft, Home, Bed, Car, Maximize } from 'lucide-react';

interface PublicViewProps {
  imovel: Imovel;
  onExit: () => void;
}

export function PublicView({ imovel, onExit }: PublicViewProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Find listing broker's actual contacts
  const ownerBroker = MOCK_CORRETORES.find(c => c.id === imovel.corretorId) || MOCK_CORRETORES[0];

  const handleWhatsAppClick = () => {
    const textMessage = `Olá! Vi o anúncio público do imóvel *${imovel.titulo}* (${formatPrice(imovel.valor)}) e gostaria de mais informações.`;
    const waUrl = `https://wa.me/${ownerBroker.whatsapp}?text=${encodeURIComponent(textMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans select-none" id={`public-view-imovel-${imovel.id}`}>
      
      {/* Simulation Banner at top */}
      <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs flex justify-between items-center text-center">
        <span>🌐 Você está visualizando o <b>Link Público do Cliente</b> (Simulado)</span>
        <button 
          onClick={onExit}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-colors"
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
            src={imovel.fotos[activePhotoIdx] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80'}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

          {/* Dots */}
          {imovel.fotos.length > 1 && (
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

          <span className={`absolute top-4 left-4 text-xs font-bold uppercase text-white px-2.5 py-0.5 rounded-full ${
            imovel.tipo === 'venda' ? 'bg-[#003366]' : 'bg-emerald-600'
          }`}>
            {imovel.tipo === 'venda' ? 'Compra' : 'Aluguel'}
          </span>
        </div>

        {/* Thumbnails preview */}
        {imovel.fotos.length > 1 && (
          <div className="p-3 bg-slate-50 flex gap-2 overflow-x-auto border-b border-slate-100">
            {imovel.fotos.map((foto, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative w-14 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 ${
                  idx === activePhotoIdx ? 'border-[#003366]' : 'border-transparent opacity-70'
                }`}
              >
                <img src={foto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
              <span className="text-[9px] uppercase text-slate-400 font-bold block">Preço</span>
              <span className="text-xl font-bold text-slate-900">
                {formatPrice(imovel.valor)}
                {imovel.tipo === 'locação' && <span className="text-xs font-normal text-slate-500"> /mês</span>}
              </span>
            </div>
            
            <div className="text-right">
              <span className="text-[9px] uppercase text-slate-400 font-bold block">Código do Imóvel</span>
              <span className="text-xs font-mono font-bold text-slate-600 mt-1 block">#{imovel.id.replace('imovel-', '')}</span>
            </div>
          </div>

          {/* Características Essenciais */}
          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Bed size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Dormitórios</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.dormitorios ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Car size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Vagas</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.vagas ?? 0}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center text-center">
              <Maximize size={15} className="text-[#003366] mb-1" />
              <span className="text-[9px] uppercase text-slate-400 font-bold">Área Privativa</span>
              <span className="text-xs font-extrabold text-slate-800">{imovel.metragem ?? 0} m²</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição detalhada</span>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {imovel.descricao}
            </p>
          </div>

          {/* Broker footer details */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={ownerBroker.foto}
                alt={ownerBroker.nome}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-100"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Corretor Responsável</span>
                <span className="text-[10px] text-slate-400">{ownerBroker.nome} | {ownerBroker.creci}</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Action button */}
          <button
            onClick={handleWhatsAppClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
          >
            <MessageCircle size={18} /> Falar no WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
}
