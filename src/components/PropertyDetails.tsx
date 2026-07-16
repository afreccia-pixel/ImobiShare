/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Imovel, Corretor } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, MessageCircle, ArrowLeft, Building2, UserCheck, ShieldAlert, Check, Bed, Car, Maximize } from 'lucide-react';

interface PropertyDetailsProps {
  imovel: Imovel;
  activeCorretor: Corretor;
  onBack: () => void;
}

export function PropertyDetails({ imovel, activeCorretor, onBack }: PropertyDetailsProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const isOwner = imovel.corretorId === activeCorretor.id;

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
    const tipoLabel = imovel.tipo === 'venda' ? 'Venda' : 'Aluguel';
    const preco = formatPrice(imovel.valor) + (imovel.tipo === 'locação' ? '/mês' : '');
    const caracteristicas = `${imovel.dormitorios ?? 0} dorms • ${imovel.vagas ?? 0} vagas • ${imovel.metragem ?? 0}m²`;

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
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <button onClick={onBack} className="p-1 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex items-center">
          <ArrowLeft size={20} className="mr-1" />
          <span className="text-xs font-semibold">Voltar</span>
        </button>
        <span className="font-bold text-slate-800 text-sm">Visualização de Imóvel</span>
        <div className="w-12" /> {/* spacing element */}
      </div>

      <div className="max-w-xl mx-auto">
        {/* Gallery */}
        <div className="relative aspect-4/3 bg-slate-900 overflow-hidden">
          <img
            src={imovel.fotos[activePhotoIndex] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80'}
            alt={`${imovel.titulo} - Foto ${activePhotoIndex + 1}`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

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

          {/* Type Badge */}
          <span className={`absolute top-4 left-4 text-xs font-bold uppercase tracking-wider text-white px-3 py-1 rounded-full shadow-md ${
            imovel.tipo === 'venda' ? 'bg-[#003366]' : 'bg-emerald-600'
          }`}>
            {imovel.tipo === 'venda' ? 'Venda' : 'Locação'}
          </span>
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
                <img src={foto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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

            <div className="flex items-center text-slate-500 text-xs mt-1.5">
              <MapPin size={13} className="mr-1 text-slate-400" />
              <span>{imovel.localizacao}</span>
            </div>
          </div>

          <div className="py-3 border-y border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Valor Solicitado</span>
              <span className="text-xl font-extrabold text-slate-900">
                {formatPrice(imovel.valor)}
                {imovel.tipo === 'locação' && <span className="text-sm font-medium text-slate-500"> /mês</span>}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Parceria</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-md inline-block mt-0.5 ${
                imovel.compartilhar ? 'bg-[#003366]/5 text-[#003366]' : 'bg-slate-100 text-slate-500'
              }`}>
                {imovel.compartilhar ? 'Aberta a Outros Corretores' : 'Exclusiva'}
              </span>
            </div>
          </div>

          {/* Características Essenciais */}
          <div className="grid grid-cols-3 gap-2.5 py-1">
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição do Imóvel</span>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {imovel.descricao}
            </p>
          </div>
        </div>

        {/* Broker Information */}
        <div className="p-4 bg-white border-b border-slate-100 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsável pelo Cadastro</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                {isOwner ? (
                  <img src={activeCorretor.foto} alt="Você" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-[#003366] flex items-center justify-center text-white font-bold text-sm">
                    {imovel.corretorNome.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-800 text-sm block">
                  {isOwner ? 'Você' : imovel.corretorNome}
                </span>
                <span className="text-xs text-slate-400">
                  {isOwner ? activeCorretor.creci : 'Parceria Autorizada'}
                </span>
              </div>
            </div>

            {/* Quick Contact badge */}
            {!isOwner && (
              <a
                href={`https://wa.me/${imovel.corretorId === 'corretor-2' ? '47992345678' : '47993456789'}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center text-xs font-bold text-[#003366] bg-[#003366]/5 hover:bg-[#003366]/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Phone size={13} className="mr-1" /> Falar com Colega
              </a>
            )}
          </div>
        </div>

        {/* Confidential Section - ONLY Visivel para o corretor que cadastrou */}
        {isOwner && (
          <div className="p-4 bg-slate-900 text-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                <ShieldAlert size={14} className="mr-1.5" />
                Controle do Proprietário (Confidencial)
              </h4>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-sm">Somente Você</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Nome Proprietário:</span>
                <span className="font-semibold text-slate-200">{imovel.nomeProprietario?.trim() || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Telefone Proprietário:</span>
                {imovel.telefoneProprietario?.trim() ? (
                  <a href={`tel:${imovel.telefoneProprietario}`} className="font-semibold text-amber-400 hover:underline flex items-center mt-0.5">
                    <Phone size={12} className="mr-1" /> {imovel.telefoneProprietario}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-400 block mt-0.5">Não informado</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Share preview helper block */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link Público de Compartilhamento</span>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 gap-2">
            <span className="text-xs text-slate-500 truncate flex-grow select-all font-mono">
              {publicLink}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                alert('Link público copiado com sucesso! Você pode compartilhar onde quiser.');
              }}
              className="text-xs font-bold text-[#003366] hover:text-[#002244] flex-shrink-0"
            >
              Copiar Link
            </button>
          </div>
        </div>

        {/* Bottom Floating Action bar */}
        <div className="bg-white border-t border-slate-100 p-4 sticky bottom-0 left-0 right-0 flex gap-3">
          <button
            onClick={handleSendWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
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
