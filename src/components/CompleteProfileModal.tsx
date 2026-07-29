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
  onLogout?: () => void;
  isMandatory?: boolean;
}

export function CompleteProfileModal({ corretor, onSave, onClose, onLogout, isMandatory }: CompleteProfileModalProps) {
  const [nome, setNome] = useState(corretor.nome || '');
  const [creci, setCreci] = useState(corretor.creci && corretor.creci !== 'CRECI Pendente' && corretor.creci !== '12345-F' ? corretor.creci : '');
  const [whatsapp, setWhatsapp] = useState(corretor.whatsapp && corretor.whatsapp !== '(47) 99999-9999' ? corretor.whatsapp : (corretor.telefone || ''));
  const [telefone, setTelefone] = useState(corretor.telefone && corretor.telefone !== '(47) 99999-9999' ? corretor.telefone : '');
  const [cidade, setCidade] = useState(corretor.cidade || '');
  const [estado, setEstado] = useState(corretor.estado || '');
  const [imobiliaria, setImobiliaria] = useState(corretor.imobiliaria || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = Boolean(
    nome.trim() && 
    creci.trim() && 
    (whatsapp.trim() || telefone.trim()) && 
    cidade.trim() && 
    estado.trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setError('Por favor, preencha todos os campos obrigatórios (Nome, CRECI, Telefone/Whats, Cidade e Estado).');
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
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
      imobiliaria: imobiliaria.trim()
    };

    try {
      DbService.saveCorretor(updatedCorretor);
      DbService.setActiveCorretor(updatedCorretor);

      // Sync backend Neon PostgreSQL
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
          cidade: updatedCorretor.cidade,
          estado: updatedCorretor.estado,
          imobiliaria: updatedCorretor.imobiliaria
        })
      });

      onSave(updatedCorretor);
    } catch (err: any) {
      console.error('Error saving complete profile:', err);
      // Save locally
      onSave(updatedCorretor);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#003366] text-white p-6 relative">
          {!isMandatory && onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
          
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            <span>{isMandatory ? 'Cadastro Obrigatório (1º Acesso)' : 'Perfil Profissional'}</span>
          </div>

          <h2 className="text-xl font-extrabold text-white">Complete seu Cadastro</h2>
          <p className="text-slate-200 text-xs mt-1 leading-relaxed">
            Para acessar o ImobiShare, preencha seus dados reais de corretor. Seu cadastro ficará registrado de forma segura no banco de dados.
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
            {corretor.foto ? (
              <img 
                src={corretor.foto} 
                alt={corretor.nome || 'Usuário'} 
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#003366]/10 text-[#003366] flex items-center justify-center font-bold text-lg">
                {(corretor.nome || corretor.email || 'C').charAt(0).toUpperCase()}
              </div>
            )}
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
                placeholder="Seu nome profissional completo"
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
                placeholder="Informe seu CRECI válido (ex: 28901-F)"
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
                  placeholder="(00) 90000-0000"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Telefone / Celular
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Opcional"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Cidade <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade de atuação"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/10 font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Estado (UF) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                placeholder="Ex: SC"
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800 uppercase text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Imobiliária (Opcional)
            </label>
            <input
              type="text"
              value={imobiliaria}
              onChange={(e) => setImobiliaria(e.target.value)}
              placeholder="Nome da imobiliária ou Autônomo"
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {isMandatory && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Sair / Alterar Conta
              </button>
            ) : (!isMandatory && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
            ) : null)}

            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="flex-1 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span>Salvando no banco...</span>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Salvar Perfil e Entrar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
