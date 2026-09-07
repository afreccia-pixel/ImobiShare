/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Phone, Mail, MessageCircle } from 'lucide-react';
import { PortalProperty } from '../types';
import { formatCurrencyBRL } from '../data/mockPortalData';
import { DbService } from '../../services/db';

interface PortalScheduleModalProps {
  imovel: PortalProperty | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PortalScheduleModal({ imovel, isOpen, onClose }: PortalScheduleModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Identifica o corretor responsável pelo imóvel
  const brokerInfo = useMemo(() => {
    if (!imovel) {
      return {
        nome: 'Corretor ImobiShare',
        email: 'contato@imobishare.com.br',
        telefone: '47998887766',
      };
    }

    try {
      const corretores = DbService.getCorretores();
      const found = corretores.find(
        (c) =>
          (c.id && c.id === imovel.corretorId) ||
          (c.email && c.email.toLowerCase().trim() === imovel.corretorEmail?.toLowerCase().trim())
      );

      return {
        nome: imovel.corretorNome || found?.nome || 'Corretor ImobiShare',
        email: imovel.corretorEmail || found?.email || 'contato@imobishare.com.br',
        telefone: found?.whatsapp || found?.telefone || '47998887766',
      };
    } catch {
      return {
        nome: imovel.corretorNome || 'Corretor ImobiShare',
        email: imovel.corretorEmail || 'contato@imobishare.com.br',
        telefone: '47998887766',
      };
    }
  }, [imovel]);

  // Preenchimento automático inteligente (salvo anteriormente, corretor logado ou padrão)
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');

    // 1. Tenta dados salvos da sessão do cliente
    try {
      const savedData = localStorage.getItem('portal_client_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.nome) setNome(parsed.nome);
        if (parsed.telefone) setTelefone(parsed.telefone);
        if (parsed.email) setEmail(parsed.email);
        return;
      }
    } catch {
      // continua para fallback
    }

    // 2. Tenta dados do usuário ativo
    try {
      const active = DbService.getActiveCorretor();
      if (active) {
        if (active.nome) setNome(active.nome);
        if (active.telefone || active.whatsapp) setTelefone(active.telefone || active.whatsapp || '');
        if (active.email) setEmail(active.email);
        return;
      }
    } catch {
      // continua para fallback
    }

    // 3. Padrão inteligente pré-preenchido
    setNome((prev) => (prev ? prev : 'Carlos Alberto'));
    setTelefone((prev) => (prev ? prev : '(47) 99123-4567'));
    setEmail((prev) => (prev ? prev : 'carlos.interessado@gmail.com'));
  }, [isOpen]);

  if (!isOpen || !imovel) return null;

  // Persiste alterações do usuário no armazenamento local
  const saveClientData = (n: string, t: string, e: string) => {
    try {
      localStorage.setItem('portal_client_data', JSON.stringify({ nome: n, telefone: t, email: e }));
    } catch {}
  };

  const handleNameChange = (val: string) => {
    setNome(val);
    saveClientData(val, telefone, email);
  };

  const handleTelefoneChange = (val: string) => {
    setTelefone(val);
    saveClientData(nome, val, email);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    saveClientData(nome, telefone, val);
  };

  // Enviar informações para o corretor e abrir o WhatsApp
  const handleFalarComCorretor = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setErrorMessage('Por favor, informe seu Nome.');
      return;
    }
    if (!telefone.trim()) {
      setErrorMessage('Por favor, informe seu Telefone / WhatsApp.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, informe um E-mail válido.');
      return;
    }

    // 1. Salva os dados localmente
    saveClientData(nome.trim(), telefone.trim(), email.trim());

    // 2. Monta o texto completo com as informações para o corretor
    const imovelNome = imovel.nomeEdificio || imovel.titulo;
    const endereco = `${imovel.endereco ? `${imovel.endereco}, ` : ''}${imovel.bairro}, ${imovel.cidade}`;

    const messageText = 
      `Olá, ${brokerInfo.nome}!\n\n` +
      `Gostaria de agendar uma visita para o imóvel:\n` +
      `🏢 *${imovelNome}* (${imovel.codigo || imovel.id})\n` +
      `💰 *Valor:* ${formatCurrencyBRL(imovel.valor)}\n` +
      `📍 *Endereço:* ${endereco}\n\n` +
      `👤 *Meus Dados para Contato:*\n` +
      `• Nome: ${nome.trim()}\n` +
      `• Telefone: ${telefone.trim()}\n` +
      `• E-mail: ${email.trim()}\n\n` +
      `Aguardo seu retorno para combinarmos a data e horário!`;

    // 3. Envia por E-mail em segundo plano
    if (brokerInfo.email) {
      try {
        const subject = encodeURIComponent(`[Agendamento de Visita] ${imovelNome} - ${nome.trim()}`);
        const mailBody = encodeURIComponent(messageText);
        const mailLink = document.createElement('a');
        mailLink.href = `mailto:${brokerInfo.email}?subject=${subject}&body=${mailBody}`;
        mailLink.click();
      } catch {}
    }

    // 4. Abre o WhatsApp do corretor
    const cleanPhone = (brokerInfo.telefone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55')
      ? cleanPhone
      : cleanPhone.length > 0
        ? `55${cleanPhone}`
        : '5547998887766';

    const encodedMsg = encodeURIComponent(messageText);
    const waUrl = `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodedMsg}`;
    
    setTimeout(() => {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }, 150);

    // Fecha o modal
    onClose();
  };

  return (
    <div
      id="modal-agendar-visita"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative">
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Agendar Visita
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {imovel.nomeEdificio || imovel.titulo} • {formatCurrencyBRL(imovel.valor)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulário Simples: Nome, Telefone, Email */}
        <form onSubmit={handleFalarComCorretor} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Seu nome"
                className="w-full pl-9 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Telefone
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                required
                value={telefone}
                onChange={(e) => handleTelefoneChange(e.target.value)}
                placeholder="(47) 99999-9999"
                className="w-full pl-9 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-9 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Botão Falar com corretor */}
          <div className="pt-2">
            <button
              type="submit"
              id="btn-falar-com-corretor"
              className="w-full py-4 px-6 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-base font-extrabold rounded-2xl shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/35 transition-all duration-200 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} className="fill-white" />
              <span>Falar com corretor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
