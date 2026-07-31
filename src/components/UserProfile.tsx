/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Corretor } from '../types';
import { DbService } from '../services/db';
import { User, Phone, Mail, MapPin, Award, Check, RefreshCw, LogOut, CheckCircle2, Users, Plus, Trash2, Camera, Edit2, Save, X } from 'lucide-react';
import { motion } from 'motion/react';
import { getApiUrl } from '../utils/apiUrl';

interface UserProfileProps {
  corretor: Corretor;
  onProfileSwitched: (newProfile: Corretor) => void;
  onLogout?: () => void;
}

export function UserProfile({ corretor, onProfileSwitched, onLogout }: UserProfileProps) {
  const [allCorretores, setAllCorretores] = useState<Corretor[]>([]);
  const [stats, setStats] = useState({ qtdVendas: 0, qtdLocacoes: 0, qtdParcerias: 0 });
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth: number = 512, maxHeight: number = 512, quality: number = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = window.Image ? new window.Image() : document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    try {
      setSuccessMsg('Processando e salvando imagem de perfil...');
      const compressedBase64 = await compressImage(file, 512, 512, 0.75);
      
      const updatedCorretor = {
        ...corretor,
        foto: compressedBase64
      };
      
      DbService.saveCorretor(updatedCorretor);
      onProfileSwitched(updatedCorretor);
      
      setSuccessMsg('Sua foto de perfil foi atualizada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error updating profile photo:', err);
      setSuccessMsg('Erro ao atualizar foto de perfil.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState(corretor.nome || '');
  const [editCreci, setEditCreci] = useState(corretor.creci || '');
  const [editTelefone, setEditTelefone] = useState(corretor.telefone || '');
  const [editWhatsapp, setEditWhatsapp] = useState(corretor.whatsapp || '');
  const [editCidade, setEditCidade] = useState(corretor.cidade || '');
  const [editEstado, setEditEstado] = useState(corretor.estado || '');
  const [editImobiliaria, setEditImobiliaria] = useState(corretor.imobiliaria || '');

  // Partner broker sharing states
  const [restringir, setRestringir] = useState(corretor.restringirParceiros || false);
  const [parceiros, setParceiros] = useState<string[]>(corretor.parceirosEmails || []);
  const [newEmail, setNewEmail] = useState('');
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setAllCorretores(DbService.getCorretores());
    setStats(DbService.getBrokerStats(corretor.id));
    
    // Sync partner & profile states when corretor changes
    setRestringir(corretor.restringirParceiros || false);
    setParceiros(corretor.parceirosEmails || []);
    setNewEmail('');
    setInputError('');

    setEditNome(corretor.nome || '');
    setEditCreci(corretor.creci || '');
    setEditTelefone(corretor.telefone || '');
    setEditWhatsapp(corretor.whatsapp || '');
    setEditCidade(corretor.cidade || '');
    setEditEstado(corretor.estado || '');
    setEditImobiliaria(corretor.imobiliaria || '');
  }, [corretor]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNome.trim()) {
      alert('Por favor, informe seu nome.');
      return;
    }

    const updatedCorretor: Corretor = {
      ...corretor,
      nome: editNome.trim(),
      creci: editCreci.trim(),
      telefone: editTelefone.trim() || editWhatsapp.trim(),
      whatsapp: editWhatsapp.trim() || editTelefone.trim(),
      cidade: editCidade.trim(),
      estado: editEstado.trim().toUpperCase(),
      imobiliaria: editImobiliaria.trim()
    };

    DbService.saveCorretor(updatedCorretor);
    onProfileSwitched(updatedCorretor);
    setIsEditing(false);

    // Sync updated info to server
    try {
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
    } catch (err) {
      console.warn('Could not sync updated profile to backend:', err);
    }

    setSuccessMsg('Dados do perfil salvos com sucesso!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

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


  return (
    <div className="bg-slate-50 min-h-screen pb-16" id="user-profile-container">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 sticky top-0 z-10 flex items-center justify-between">
        <div className="w-8"></div>
        <h1 className="font-bold text-slate-800 text-base text-center flex-grow">Meu Perfil Profissional</h1>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            title="Sair do Sistema"
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        ) : (
          <div className="w-8"></div>
        )}
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
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Clique para alterar sua foto de perfil">
            <img
              src={corretor.foto}
              alt={corretor.nome}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-sm group-hover:opacity-80 transition-opacity"
            />
            <div className="absolute bottom-0 right-0 bg-[#003366] text-white p-1.5 rounded-full border border-white shadow-sm group-hover:scale-110 transition-transform">
              <Camera size={14} />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <h2 className="font-bold text-slate-800 text-base mt-3">{corretor.nome}</h2>
          
          <div className="flex items-center text-xs text-slate-400 font-medium mt-1 gap-1.5">
            <Award size={13} className="text-[#003366]" />
            <span>{corretor.creci}</span>
          </div>

          {/* Dynamic broker stats counters */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full mt-5 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-tight">Imóveis a Venda</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900 mt-1 block">{stats.qtdVendas}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-tight">Para Locação</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900 mt-1 block">{stats.qtdLocacoes}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase block leading-tight">Imóveis de Parceria</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900 mt-1 block">{stats.qtdParcerias}</span>
            </div>
          </div>
        </div>

        {/* Contact info list & Edit profile section */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dados Profissionais</h3>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-[#003366] hover:bg-[#003366]/5 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Edit2 size={13} />
                <span>Editar Dados</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {!isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <Award size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">CRECI:</span>
                  <span className="font-medium text-slate-800">{corretor.creci || <span className="text-amber-500 font-bold">Não informado (Clique em Editar)</span>}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">WhatsApp / Celular:</span>
                  <span className="font-medium text-slate-800">{corretor.whatsapp || corretor.telefone || <span className="text-amber-500 font-bold">Não informado</span>}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">E-mail Corporativo:</span>
                  <span className="font-medium text-slate-800">{corretor.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Cidade / Estado:</span>
                  <span className="font-medium text-slate-800">
                    {corretor.cidade ? `${corretor.cidade}${corretor.estado ? ` - ${corretor.estado}` : ''}` : <span className="text-amber-500 font-bold">Não informado</span>}
                  </span>
                </div>
              </div>

              {corretor.imobiliaria && (
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <User size={14} className="text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Imobiliária / Empresa:</span>
                    <span className="font-medium text-slate-800">{corretor.imobiliaria}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">CRECI</label>
                <input
                  type="text"
                  placeholder="Ex: 28901-F"
                  value={editCreci}
                  onChange={(e) => setEditCreci(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ex: (47) 99999-8888"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Telefone Alternativo</label>
                  <input
                    type="text"
                    placeholder="Ex: (47) 3333-2222"
                    value={editTelefone}
                    onChange={(e) => setEditTelefone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Cidade Principal de Atuação</label>
                  <input
                    type="text"
                    placeholder="Ex: Balneário Camboriú"
                    value={editCidade}
                    onChange={(e) => setEditCidade(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="SC"
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value.toUpperCase())}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800 uppercase text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Imobiliária / Empresa (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Imobiliária Brasil ou Autônomo"
                  value={editImobiliaria}
                  onChange={(e) => setEditImobiliaria(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#003366] font-medium text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <Save size={14} />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          )}
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

        {/* Logout Section Card */}
        {onLogout && (
          <div className="bg-white border border-red-100 rounded-xl p-4 shadow-xs space-y-2 text-center" id="profile-logout-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Encerrar Sessão</h3>
            <p className="text-[11px] text-slate-500">
              Deseja sair da sua conta no ImobiShare neste dispositivo?
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="w-full mt-2 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 border border-red-200 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <LogOut size={16} />
              <span>Sair do Sistema</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
