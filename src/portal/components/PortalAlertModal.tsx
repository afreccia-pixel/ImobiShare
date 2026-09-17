/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Bell, CheckCircle2, Mail, Smartphone } from 'lucide-react';
import { PortalFilterState } from '../types';

interface PortalAlertModalProps {
  filters: PortalFilterState;
  isOpen: boolean;
  onClose: () => void;
}

export function PortalAlertModal({ filters, isOpen, onClose }: PortalAlertModalProps) {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setEmail('');
    setWhatsapp('');
    onClose();
  };

  return (
    <div
      id="modal-criar-alerta"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-md rounded-2xl lg:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative">
        <div className="flex items-center justify-between p-4 sm:p-5 lg:p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#003366] flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <span className="text-[10px] lg:text-xs font-semibold text-[#003366] uppercase tracking-wider block">
                Alerta Personalizado
              </span>
              <h2 className="text-base lg:text-lg font-bold text-slate-900">
                Criar Alerta de Imóvel
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Fechar modal de alerta"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {submitted ? (
            <div className="text-center py-5 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Alerta Ativado com Sucesso!
              </h3>
              <p className="text-xs lg:text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Você receberá em primeira mão no WhatsApp ou E-mail os novos lançamentos em {filters.cidade || 'Balneário Camboriú'}.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="h-10 px-6 bg-[#003366] text-white text-xs lg:text-sm font-semibold rounded-xl hover:bg-[#002244] transition-all cursor-pointer shadow-sm"
                >
                  Entendi
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs lg:text-[13px] text-slate-600 leading-relaxed">
                Receba novidades e oportunidades de lançamentos em{' '}
                <strong className="text-slate-900 font-semibold">{filters.cidade || 'Balneário Camboriú'}</strong>{' '}
                assim que forem publicados.
              </p>

              <div>
                <label className="block text-xs lg:text-[13px] font-semibold text-slate-600 mb-1.5">
                  Seu E-mail
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs lg:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs lg:text-[13px] font-semibold text-slate-600 mb-1.5">
                  WhatsApp (opcional)
                </label>
                <div className="relative">
                  <Smartphone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(47) 99999-9999"
                    className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs lg:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-confirmar-alerta"
                  className="w-full h-11 lg:h-12 bg-[#003366] hover:bg-[#002244] text-white text-xs lg:text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  Ativar Alertas Gratuitos
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
