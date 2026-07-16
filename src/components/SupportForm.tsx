/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Corretor } from '../types';
import { Mail, Phone, User, MessageCircle, AlertCircle, ArrowLeft, Send, Loader2 } from 'lucide-react';

interface SupportFormProps {
  activeCorretor: Corretor;
  onBack?: () => void;
  triggerToast: (msg: string) => void;
}

export function SupportForm({ activeCorretor, onBack, triggerToast }: SupportFormProps) {
  const [nome, setNome] = useState(activeCorretor.nome);
  const [email, setEmail] = useState(activeCorretor.email);
  const [telefone, setTelefone] = useState(activeCorretor.telefone || activeCorretor.whatsapp || '');
  const [tipo, setTipo] = useState<'problema' | 'melhoria' | 'outros'>('melhoria');
  const [descricao, setDescricao] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!descricao.trim()) {
      triggerToast('Por favor, preencha a descrição do que gostaria.');
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/support/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          tipo,
          descricao: descricao.trim(),
          creci: activeCorretor.creci,
          cidade: activeCorretor.cidade
        }),
      });

      if (response.ok) {
        setIsSent(true);
        triggerToast('Sua mensagem foi enviada diretamente aos desenvolvedores!');
      } else {
        const data = await response.json();
        triggerToast(data.error || 'Erro ao enviar a mensagem. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Erro de conexão. Tente novamente mais tarde.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full pb-10" id="support-container">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shadow-xs sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              onClick={onBack}
              disabled={isSending}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors mr-1 disabled:opacity-50"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-slate-800 font-extrabold text-sm sm:text-base leading-tight">Suporte & Sugestões</h1>
            <p className="text-[10px] text-slate-400 font-semibold">Fale diretamente com os desenvolvedores</p>
          </div>
        </div>
        <div className="bg-amber-50 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200">
          Atendimento Direto
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {isSent ? (
          <div className="bg-white border border-emerald-100 rounded-3xl p-6 text-center space-y-4 shadow-xs animate-fadeIn">
            <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <Send size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-sm">Mensagem Enviada com Sucesso!</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-2">
                Sua sugestão ou relatório foi enviado diretamente para a nossa equipe e será analisado imediatamente.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60 text-left space-y-1 text-[11px] text-slate-600">
              <p><strong>De:</strong> {nome} ({email})</p>
              <p><strong>Assunto:</strong> [Suporte] {tipo === 'problema' ? '🚨 Problema' : tipo === 'melhoria' ? '💡 Melhoria' : '❓ Dúvida'}</p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setDescricao('');
                  setIsSent(false);
                }}
                className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all uppercase tracking-wider"
              >
                Escrever nova mensagem
              </button>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-all"
                >
                  Voltar ao Início
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs space-y-4">
            
            {/* Context Notice */}
            <div className="bg-[#003366]/5 border border-[#003366]/10 rounded-2xl p-3 flex gap-2.5">
              <AlertCircle size={16} className="text-[#003366] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#003366]/90 leading-normal font-medium">
                Tem alguma dúvida, melhoria para o app ou achou algo que não funciona? Preencha os dados e relate abaixo para aperfeiçoarmos a plataforma!
              </p>
            </div>

            {/* Nome Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Seu Nome</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] text-slate-800 font-medium"
                  placeholder="Nome Completo"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Seu E-mail de Contato</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] text-slate-800 font-medium"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            {/* Telefone Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Seu Telefone / WhatsApp</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] text-slate-800 font-medium"
                  placeholder="(47) 99999-9999"
                />
              </div>
            </div>

            {/* Tipo de Feedback Selector */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">O que você gostaria?</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setTipo('melhoria')}
                  className={`py-1.5 px-1 rounded-lg transition-all text-center ${
                    tipo === 'melhoria' 
                      ? 'bg-[#003366] text-white shadow-xs' 
                      : 'text-slate-500 hover:bg-slate-200/50'
                  }`}
                >
                  💡 Melhoria
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('problema')}
                  className={`py-1.5 px-1 rounded-lg transition-all text-center ${
                    tipo === 'problema' 
                      ? 'bg-rose-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:bg-slate-200/50'
                  }`}
                >
                  🚨 Problema
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('outros')}
                  className={`py-1.5 px-1 rounded-lg transition-all text-center ${
                    tipo === 'outros' 
                      ? 'bg-slate-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:bg-slate-200/50'
                  }`}
                >
                  ❓ Outros
                </button>
              </div>
            </div>

            {/* Descricao Textarea */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Descrição detalhada</label>
              <textarea
                required
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={
                  tipo === 'problema'
                    ? 'Descreva o problema encontrado (ex: "Ao salvar o imóvel X, as fotos não aparecem...")'
                    : tipo === 'melhoria'
                      ? 'Qual nova funcionalidade ou melhoria você gostaria de ver no sistema?'
                      : 'Escreva suas dúvidas ou comentários aqui...'
                }
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] text-slate-800 font-medium placeholder-slate-400 resize-none leading-relaxed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-[#003366] hover:bg-[#002244] text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-[0.99] uppercase tracking-wider mt-2 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>Enviar Mensagem</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center space-y-1 text-slate-400 text-[10px] py-2">
          <p className="font-medium text-[9px] max-w-xs mx-auto leading-normal">
            Sua opinião é fundamental para nós! Analisamos todas as sugestões e problemas reportados e respondemos o mais rápido possível.
          </p>
        </div>
      </div>
    </div>
  );
}
