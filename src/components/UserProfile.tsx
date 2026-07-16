/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Corretor } from '../types';
import { DbService } from '../services/db';
import { User, Phone, Mail, MapPin, Award, Check, RefreshCw, LogOut, CheckCircle2, Users, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  corretor: Corretor;
  onProfileSwitched: (newProfile: Corretor) => void;
}

export function UserProfile({ corretor, onProfileSwitched }: UserProfileProps) {
  const [allCorretores, setAllCorretores] = useState<Corretor[]>([]);
  const [stats, setStats] = useState({ qtdImoveis: 0, qtdLocacoes: 0, qtdVendas: 0 });
  const [successMsg, setSuccessMsg] = useState('');

  // Partner broker sharing states
  const [restringir, setRestringir] = useState(corretor.restringirParceiros || false);
  const [parceiros, setParceiros] = useState<string[]>(corretor.parceirosEmails || []);
  const [newEmail, setNewEmail] = useState('');
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setAllCorretores(DbService.getCorretores());
    setStats(DbService.getBrokerStats(corretor.id));
    
    // Sync partner states when corretor changes
    setRestringir(corretor.restringirParceiros || false);
    setParceiros(corretor.parceirosEmails || []);
    setNewEmail('');
    setInputError('');
  }, [corretor]);

  const handleToggleRestringir = (checked: boolean) => {
    setRestringir(checked);
    const updatedCorretor = {
      ...corretor,
      restringirParceiros: checked,
      parceirosEmails: parceiros
    };
    DbService.saveCorretor(updatedCorretor);
    onProfileSwitched(updatedCorretor);
    setSuccessMsg(checked ? 'Restrição de visualização ativada!' : 'Seus imóveis agora estão visíveis para todos os parceiros.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddPartner = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError('');

    const emailTrimmed = newEmail.trim().toLowerCase();
    if (!emailTrimmed) return;

    // basic regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setInputError('E-mail inválido.');
      return;
    }

    if (emailTrimmed === corretor.email.toLowerCase().trim()) {
      setInputError('Você não pode adicionar seu próprio e-mail.');
      return;
    }

    if (parceiros.some(p => p.toLowerCase() === emailTrimmed)) {
      setInputError('Este corretor já está cadastrado no seu grupo.');
      return;
    }

    const updatedParceiros = [...parceiros, emailTrimmed];
    setParceiros(updatedParceiros);
    setNewEmail('');

    const updatedCorretor = {
      ...corretor,
      restringirParceiros: restringir,
      parceirosEmails: updatedParceiros
    };
    DbService.saveCorretor(updatedCorretor);
    onProfileSwitched(updatedCorretor);
    setSuccessMsg('Corretor parceiro adicionado com sucesso!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeletePartner = (emailToDelete: string) => {
    const updatedParceiros = parceiros.filter(email => email !== emailToDelete);
    setParceiros(updatedParceiros);

    const updatedCorretor = {
      ...corretor,
      restringirParceiros: restringir,
      parceirosEmails: updatedParceiros
    };
    DbService.saveCorretor(updatedCorretor);
    onProfileSwitched(updatedCorretor);
    setSuccessMsg('Parceiro removido do grupo.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const findBrokerByEmail = (email: string) => {
    return allCorretores.find(c => c.email.toLowerCase().trim() === email.toLowerCase().trim());
  };

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

        {/* Grupo de Corretores Parceiros Panel */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs space-y-4" id="grupo-parceiros-card">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Grupo de Corretores Parceiros</h3>
            <span className="bg-[#003366]/10 text-[#003366] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {parceiros.length} {parceiros.length === 1 ? 'Parceiro' : 'Parceiros'}
            </span>
          </div>

          {/* Toggle Restriction */}
          <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100/50">
            <input
              type="checkbox"
              id="restringir-parceiros-toggle"
              checked={restringir}
              onChange={(e) => handleToggleRestringir(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-[#003366] accent-[#003366] border-slate-300 rounded focus:ring-[#003366] cursor-pointer"
            />
            <div className="flex-grow space-y-1">
              <label htmlFor="restringir-parceiros-toggle" className="text-xs font-bold text-slate-700 cursor-pointer block">
                Limitar meus imóveis ao Grupo
              </label>
              <p className="text-[10px] text-slate-400 leading-normal">
                Ao ativar, seus imóveis só serão visíveis para os corretores parceiros cadastrados por você abaixo. Se não tiver nenhum parceiro cadastrado, o sistema entende que está compartilhado com todos.
              </p>
            </div>
          </div>

          {/* Form to add partner by email */}
          <form onSubmit={handleAddPartner} className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cadastrar Corretor Parceiro (E-mail)</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Ex: mariana.costa@realtor.com"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (inputError) setInputError('');
                }}
                className="flex-grow text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] focus:ring-1 focus:ring-[#003366]/20 font-medium text-slate-800"
              />
              <button
                type="submit"
                className="bg-[#003366] hover:bg-[#002244] text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all uppercase tracking-wider text-[10px]"
              >
                <Plus size={12} />
                Adicionar
              </button>
            </div>
            {inputError && (
              <p className="text-[10px] text-red-500 font-semibold">{inputError}</p>
            )}
          </form>

          {/* List of Partner Brokers */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Lista de Corretores Parceiros do meu Grupo
            </span>

            {parceiros.length === 0 ? (
              <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <p className="text-[10px] text-slate-400 font-medium">Nenhum parceiro cadastrado.</p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-normal max-w-xs mx-auto">
                  Insira o e-mail do corretor parceiro para restringir o compartilhamento ao seu grupo exclusivo.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {parceiros.map((email) => {
                  const partnerBroker = findBrokerByEmail(email);
                  return (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs hover:border-slate-200 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        {partnerBroker ? (
                          <>
                            <img
                              src={partnerBroker.foto}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <span className="font-bold text-slate-800 block">{partnerBroker.nome}</span>
                              <span className="text-[9px] text-slate-400 block leading-tight">
                                {partnerBroker.creci} • {email}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                              @
                            </div>
                            <div>
                              <span className="font-bold text-slate-700 block truncate max-w-[160px]">{email}</span>
                              <span className="text-[9px] text-amber-500 font-medium block leading-tight">
                                Convidado (Não simulado)
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePartner(email)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir parceiro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
