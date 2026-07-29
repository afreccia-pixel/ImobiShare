/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Corretor } from '../types';
import { DbService } from '../services/db';
import { getApiUrl } from '../utils/apiUrl';
import { Award, Phone, MapPin, User, CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react';

interface CompleteProfileModalProps {
  corretor: Corretor;
  onSave: (updated: Corretor) => void;
  onClose?: () => void;
}

export function CompleteProfileModal({ corretor, onSave, onClose }: CompleteProfileModalProps) {
  const [nome, setNome] = useState(corretor.nome || '');
  const [creci, setCreci] = useState(corretor.creci && corretor.creci !== 'CRECI Pendente' ? corretor.creci : '');
  const [whatsapp, setWhatsapp] = useState(corretor.whatsapp || corretor.telefone || '');
  const [telefone, setTelefone] = useState(corretor.telefone || '');
  const [cidade, setCidade] = useState(corretor.cidade || 'Balneário Camboriú');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nome.trim()) {
      setError('Por favor, preencha o seu nome completo.');
      return;
    }

    if (!creci.trim()) {
      setError('Por favor, informe o seu número de CRECI.');
      return;
    }

    if (!whatsapp.trim()) {
      setError('Por favor, informe o seu número de WhatsApp com DDD.');
      return;
    }

    setLoading(true);

    const formattedCreci = creci.toUpperCase().startsWith('CRECI') 
      ? creci.trim() 
      : `CRECI ${creci.trim()}`;

    const updatedCorretor: Corretor = {
      ...corretor,
      nome: nome.trim(),
      creci: formattedCreci,
      whatsapp: whatsapp.trim(),
      telefone: telefone.trim() || whatsapp.trim(),
      cidade: cidade.trim() || 'Balneário Camboriú'
    };

    try {
      DbService.saveCorretor(updatedCorretor);
      DbService.setActiveCorretor(updatedCorretor);

      // Sync backend
      await fetch(getApiUrl('/api/auth/sync-firebase-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: updatedCorretor.id,
          email: updatedCorretor.email,
          nome: updatedCorretor.nome,
          foto: updatedCorretor.foto,
          creci: updatedCorretor.creci,
          telefone: updatedCorretor.telefone,
          whatsapp: updatedCorretor.whatsapp,
          cidade: updatedCorretor.cidade
        })
      });

      onSave(updatedCorretor);
    } catch (err: any) {
      console.error('Error saving complete profile:', err);
      // Even if network call fails, save locally
      onSave(updatedCorretor);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#003366] text-white p-6 relative">
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
          
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            <span>Perfil Profissional</span>
          </div>

          <h2 className="text-xl font-extrabold text-white">Complete seu Cadastro</h2>
          <p className="text-slate-200 text-xs mt-1 leading-relaxed">
            Olá, <strong className="text-white">{corretor.nome || 'Corretor'}</strong>! Para visualizar e compartilhar imóveis na rede com segurança, informe seus dados reais abaixo.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* User Photo Preview & Email */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <img 
              src={corretor.foto} 
              alt={corretor.nome} 
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-xs"
            />
            <div className="flex-grow min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Conta Google Conectada</span>
              <span className="text-xs font-bold text-slate-800 block truncate">{corretor.email}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Alexandre Freccia"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Número de CRECI <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Award size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                value={creci}
                onChange={(e) => setCreci(e.target.value)}
                placeholder="Ex: 28901-F ou CRECI 28901-F"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">O CRECI identifica você perante os clientes e parceiros.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                WhatsApp com DDD <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(47) 99888-7766"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Telefone Alternativo
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(47) 3333-2222"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Cidade Principal de Atuação <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: Balneário Camboriú"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
              >
                Preencher Depois
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Salvar e Concluir Cadastro</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
