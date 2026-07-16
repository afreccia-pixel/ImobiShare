/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Corretor } from '../types';
import { DbService } from '../services/db';
import { User, Phone, Mail, MapPin, Award, Check, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  corretor: Corretor;
  onProfileSwitched: (newProfile: Corretor) => void;
}

export function UserProfile({ corretor, onProfileSwitched }: UserProfileProps) {
  const [allCorretores, setAllCorretores] = useState<Corretor[]>([]);
  const [stats, setStats] = useState({ qtdImoveis: 0, qtdLocacoes: 0, qtdVendas: 0 });
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setAllCorretores(DbService.getCorretores());
    setStats(DbService.getBrokerStats(corretor.id));
  }, [corretor]);

  const handleSwitchBroker = (broker: Corretor) => {
    DbService.setActiveCorretor(broker);
    onProfileSwitched(broker);
    setSuccessMsg(`Simulando login como: ${broker.nome}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16" id="user-profile-container">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 sticky top-0 z-10 text-center">
        <h1 className="font-bold text-slate-800 text-base">Meu Perfil Profissional</h1>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-5">
        {successMsg && (
          <div className="bg-[#003366] text-white text-xs font-semibold rounded-xl p-3 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-slate-200" />
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* Profile Details Card */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs flex flex-col items-center text-center">
          <div className="relative">
            <img
              src={corretor.foto}
              alt={corretor.nome}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-sm"
            />
            <div className="absolute bottom-0 right-0 bg-[#003366] text-white p-1.5 rounded-full border border-white">
              <User size={14} />
            </div>
          </div>

          <h2 className="font-bold text-slate-800 text-base mt-3">{corretor.nome}</h2>
          
          <div className="flex items-center text-xs text-slate-400 font-medium mt-1 gap-1.5">
            <Award size={13} className="text-[#003366]" />
            <span>{corretor.creci}</span>
          </div>

          {/* Dynamic broker stats counters */}
          <div className="grid grid-cols-2 gap-4 w-full mt-5 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Imóveis Cadastrados</span>
              <span className="text-xl font-bold text-slate-900">{stats.qtdImoveis}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Para Locação</span>
              <span className="text-xl font-bold text-slate-900">{stats.qtdLocacoes}</span>
            </div>
          </div>
        </div>

        {/* Contact info list */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dados de Contato</h3>
          
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <Phone size={14} className="text-slate-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">WhatsApp / Celular:</span>
              <span className="font-medium text-slate-800">{corretor.telefone}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <Mail size={14} className="text-slate-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">E-mail Corporativo:</span>
              <span className="font-medium text-slate-800">{corretor.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <MapPin size={14} className="text-slate-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">Cidade Principal:</span>
              <span className="font-medium text-slate-800">{corretor.cidade}</span>
            </div>
          </div>
        </div>

        {/* Dynamic switcher simulated login bar */}
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
              Simular outro Corretor (Multiusuário)
            </h4>
            <p className="text-[10px] text-slate-300 mt-1">
              Altere para outro corretor para testar a dinâmica de parcerias e imóveis privados!
            </p>
          </div>

          <div className="space-y-2">
            {allCorretores.map((broker) => {
              const active = broker.id === corretor.id;
              return (
                <button
                  key={broker.id}
                  onClick={() => handleSwitchBroker(broker)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    active 
                      ? 'bg-[#003366] border border-[#003366]/40 text-white font-bold' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img src={broker.foto} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700" referrerPolicy="no-referrer" />
                    <div>
                      <span>{broker.nome}</span>
                      <span className="text-[9px] block text-slate-400 font-normal">{broker.creci}</span>
                    </div>
                  </div>
                  {active && <Check size={14} className="text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
