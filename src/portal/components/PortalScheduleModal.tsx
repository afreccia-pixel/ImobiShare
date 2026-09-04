/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Calendar, Clock, CheckCircle2, User, Phone, MessageSquare } from 'lucide-react';
import { PortalProperty } from '../types';
import { formatCurrencyBRL } from '../data/mockPortalData';
import { getValidImage } from '../../utils/imageUtils';

interface PortalScheduleModalProps {
  imovel: PortalProperty | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PortalScheduleModal({ imovel, isOpen, onClose }: PortalScheduleModalProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [dataPref, setDataPref] = useState('');
  const [turno, setTurno] = useState<'manha' | 'tarde'>('tarde');
  const [mensagem, setMensagem] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !imovel) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação visual da Etapa 1
    setSubmitted(true);
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setNome('');
    setWhatsapp('');
    setDataPref('');
    setMensagem('');
    onClose();
  };

  const mainPhoto = getValidImage(imovel.fotos?.[0]);

  return (
    <div
      id="modal-agendar-visita"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-[#003366] uppercase tracking-wider block">
              Agendamento Exclusivo
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Agendar Visita ao Imóvel
            </h2>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Fechar modal de agendamento"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Resumo do Imóvel */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3.5">
          <img
            src={mainPhoto}
            alt={imovel.titulo}
            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-slate-800 truncate">
              {imovel.nomeEdificio || imovel.titulo}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {imovel.endereco ? `${imovel.endereco} • ` : ''}{imovel.bairro}, {imovel.cidade}
            </p>
            <p className="text-xs font-black text-[#003366] mt-0.5">
              {formatCurrencyBRL(imovel.valor)}
            </p>
          </div>
        </div>

        {/* Conteúdo: Formulário ou Sucesso */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Solicitação de Agendamento Enviada!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Agradecemos o seu interesse. Nosso consultor entrará em contato via WhatsApp com você em breve para confirmar o melhor horário da visita.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-[#003366] text-white text-xs font-bold rounded-full hover:bg-[#002244] transition-all cursor-pointer shadow-md"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  WhatsApp / Telefone
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(47) 99999-9999"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                  />
                </div>
              </div>

              {/* Data e Turno */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Data de Preferência
                  </label>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={dataPref}
                      onChange={(e) => setDataPref(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Turno
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setTurno('manha')}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        turno === 'manha'
                          ? 'bg-blue-50 border-[#003366] text-[#003366]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Manhã
                    </button>
                    <button
                      type="button"
                      onClick={() => setTurno('tarde')}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                        turno === 'tarde'
                          ? 'bg-blue-50 border-[#003366] text-[#003366]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Tarde
                    </button>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Dúvidas ou Observações (opcional)
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Gostaria de tirar dúvidas sobre as opções de pagamento na planta..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                  />
                </div>
              </div>

              {/* Botão de Envio */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-confirmar-agendamento"
                  className="w-full py-3 bg-[#003366] hover:bg-[#002244] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer"
                >
                  Confirmar Agendamento de Visita
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
