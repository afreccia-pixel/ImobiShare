/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Imovel } from '../types';
import { DbService } from '../services/db';
import { Sparkles, MapPin, Search, Plus, Trash2, Check, ArrowLeft, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PropertyFormProps {
  imovelId?: string | null; // If editing
  onSave: (saved: Imovel) => void;
  onCancel: () => void;
}

// Preset luxury images for quick assignment
const PRESET_GALLERY = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80'
];

export function PropertyForm({ imovelId, onSave, onCancel }: PropertyFormProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState<number | ''>('');
  const [tipo, setTipo] = useState<'venda' | 'locação'>('venda');
  const [cidade, setCidade] = useState(() => DbService.getActiveCorretor().cidade);
  const [bairro, setBairro] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [nomeEdificio, setNomeEdificio] = useState('');
  const [nomeProprietario, setNomeProprietario] = useState('');
  const [telefoneProprietario, setTelefoneProprietario] = useState('');
  const [favorito, setFavorito] = useState(false);
  const [compartilhar, setCompartilhar] = useState(true); // marked by default
  const [fotos, setFotos] = useState<string[]>([]);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  
  const [dormitorios, setDormitorios] = useState<number | ''>(3);
  const [vagas, setVagas] = useState<number | ''>(2);
  const [metragem, setMetragem] = useState<number | ''>(120);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Example description display
  const exampleDescription = "Lindo apartamento de 3 suítes finamente mobiliado, com sacada integrada, churrasqueira a carvão e 3 vagas de garagem no centro de Balneário Camboriú. Condomínio com área de lazer estilo resort.";

  useEffect(() => {
    if (imovelId) {
      const imoveis = DbService.getImoveis();
      const found = imoveis.find(i => i.id === imovelId);
      if (found) {
        setTitulo(found.titulo);
        setDescricao(found.descricao);
        setValor(found.valor);
        setTipo(found.tipo);
        setCidade(found.cidade);
        setBairro(found.bairro);
        setLocalizacao(found.localizacao);
        setNomeEdificio(found.nomeEdificio || '');
        setNomeProprietario(found.nomeProprietario);
        setTelefoneProprietario(found.telefoneProprietario);
        setFavorito(found.favorito);
        setCompartilhar(found.compartilhar);
        setFotos(found.fotos);
        setDormitorios(found.dormitorios ?? '');
        setVagas(found.vagas ?? '');
        setMetragem(found.metragem ?? '');
      }
    } else {
      // Create mode - pre-select first preset photo
      setFotos([PRESET_GALLERY[0]]);
    }
  }, [imovelId]);

  // Handle Autocomplete Address
  const handleAutocomplete = () => {
    if (!localizacao.trim()) {
      setErrorMsg('Escreva uma localização (rua, avenida ou ponto de referência) primeiro para autocompletar.');
      return;
    }
    setErrorMsg('');
    setAutocompleteLoading(true);

    setTimeout(() => {
      // Simulate intelligent parsing of common locations in Balneário Camboriú/Itapema
      const text = localizacao.toLowerCase();
      let detectedBairro = 'Centro';
      let detectedCidade = DbService.getActiveCorretor().cidade;
      let detectedEdificio = '';

      if (text.includes('barra sul') || text.includes('atlântica 4000') || text.includes('atlântica 5000')) {
        detectedBairro = 'Centro - Barra Sul';
        detectedEdificio = 'Yachthouse Residence';
      } else if (text.includes('pioneiros') || text.includes('atlântica 100') || text.includes('atlântica 500')) {
        detectedBairro = 'Pioneiros';
        detectedEdificio = 'Infinity Coast';
      } else if (text.includes('itapema') || text.includes('meia praia') || text.includes('rua 2')) {
        detectedCidade = 'Itapema';
        detectedBairro = 'Meia Praia';
      } else if (text.includes('rua 3100') || text.includes('rua 1500')) {
        detectedBairro = 'Centro';
      } else if (text.includes('haras') || text.includes('rio do ouro')) {
        detectedBairro = 'Bandeirantes';
        detectedEdificio = 'Haras Rio do Ouro';
      }

      setCidade(detectedCidade);
      setBairro(detectedBairro);
      if (detectedEdificio && !nomeEdificio) {
        setNomeEdificio(detectedEdificio);
      }
      
      // Update full location format nicely
      if (!localizacao.includes(detectedCidade)) {
        setLocalizacao(`${localizacao}, ${detectedBairro} - ${detectedCidade} - SC`);
      }
      
      setAutocompleteLoading(false);
    }, 800);
  };

  // Handle AI Description Improvement
  const handleAiImprove = async () => {
    if (!descricao.trim()) {
      setErrorMsg('Por favor, escreva uma descrição resumida básica antes de usar a Inteligência Artificial.');
      return;
    }
    setErrorMsg('');
    setAiLoading(true);

    try {
      const improved = await DbService.improveDescription(
        descricao,
        tipo,
        titulo || nomeEdificio || 'Imóvel de Alto Padrão',
        localizacao || cidade
      );
      setDescricao(improved);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao conectar com a Inteligência Artificial. Usando heurística local.');
    } finally {
      setAiLoading(false);
    }
  };

  // Add photos
  const handleAddPresetPhoto = (url: string) => {
    if (fotos.includes(url)) {
      setFotos(fotos.filter(f => f !== url));
    } else {
      setFotos([...fotos, url]);
    }
  };

  const handleAddCustomPhoto = () => {
    if (!customPhotoUrl.trim()) return;
    if (!fotos.includes(customPhotoUrl)) {
      setFotos([...fotos, customPhotoUrl]);
    }
    setCustomPhotoUrl('');
  };

  const handleRemovePhoto = (index: number) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      setErrorMsg('Título é obrigatório.');
      return;
    }
    if (!descricao.trim()) {
      setErrorMsg('Descrição resumida é obrigatória.');
      return;
    }
    if (!valor || Number(valor) <= 0) {
      setErrorMsg('Valor deve ser maior que zero.');
      return;
    }
    if (!localizacao.trim()) {
      setErrorMsg('Localização / Endereço é obrigatório.');
      return;
    }
    if (fotos.length === 0) {
      setErrorMsg('Adicione pelo menos uma foto ao imóvel.');
      return;
    }

    const saved = DbService.saveImovel({
      id: imovelId || undefined,
      titulo,
      descricao,
      valor: Number(valor),
      tipo,
      cidade,
      bairro: bairro || 'Centro',
      localizacao,
      nomeEdificio: nomeEdificio || undefined,
      nomeProprietario,
      telefoneProprietario,
      favorito,
      compartilhar,
      fotos,
      dormitorios: dormitorios !== '' ? Number(dormitorios) : undefined,
      vagas: vagas !== '' ? Number(vagas) : undefined,
      metragem: metragem !== '' ? Number(metragem) : undefined,
    });

    onSave(saved);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-12" id="property-form-container">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onCancel} className="p-1 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-slate-800 text-base">
          {imovelId ? 'Editar Imóvel' : 'Cadastrar Imóvel'}
        </h1>
        <div className="w-8" /> {/* Balance spacer */}
      </div>

      <form onSubmit={handleSave} className="p-4 max-w-xl mx-auto space-y-5">
        
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3">
            {errorMsg}
          </div>
        )}

        {/* Fotos section */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Fotos do Imóvel ({fotos.length} selecionadas)
          </label>
          
          {/* Selected photos thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {fotos.map((foto, index) => (
              <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                <img src={foto} alt={`Foto ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            
            {fotos.length === 0 && (
              <div className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400">
                <Image size={20} />
                <span className="text-[10px] mt-1">Vazio</span>
              </div>
            )}
          </div>

          {/* Quick preset gallery picker */}
          <div className="space-y-1.5 pt-1.5">
            <span className="text-[11px] text-slate-400 font-medium block">Galeria Modelo (Toque para adicionar/remover)</span>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_GALLERY.map((url, i) => {
                const selected = fotos.includes(url);
                return (
                  <div
                    key={i}
                    onClick={() => handleAddPresetPhoto(url)}
                    className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                      selected ? 'border-[#003366] ring-2 ring-[#003366]/10' : 'border-transparent hover:scale-105'
                    }`}
                  >
                    <img src={url} alt="modelo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {selected && (
                      <div className="absolute inset-0 bg-[#003366]/20 flex items-center justify-center">
                        <Check size={14} className="text-white drop-shadow-sm font-bold" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom URL */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Ou cole uma URL externa de foto..."
              value={customPhotoUrl}
              onChange={(e) => setCustomPhotoUrl(e.target.value)}
              className="flex-grow text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50"
            />
            <button
              type="button"
              onClick={handleAddCustomPhoto}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors"
            >
              <Plus size={14} className="mr-1" /> Add
            </button>
          </div>
        </div>

        {/* Basic fields */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipo de Negócio</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTipo('venda')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    tipo === 'venda' ? 'bg-white text-[#003366] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Venda
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('locação')}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    tipo === 'locação' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Locação
                </button>
              </div>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Valor {tipo === 'locação' ? '(mês)' : ''}
              </label>
              <input
                type="number"
                placeholder="R$ Valor"
                value={valor}
                onChange={(e) => setValor(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
              />
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Título do Anúncio</label>
            <input
              type="text"
              placeholder="Ex: Apartamento Alto Padrão Frente Mar Barra Sul"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
            />
          </div>

          {/* Edifício */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nome do Edifício</label>
            <input
              type="text"
              placeholder="Ex: Ibiza Towers Residence"
              value={nomeEdificio}
              onChange={(e) => setNomeEdificio(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
            />
          </div>

          {/* Características Essenciais */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Dormitórios</label>
              <input
                type="number"
                placeholder="Ex: 3"
                value={dormitorios}
                onChange={(e) => setDormitorios(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
                min="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vagas Garagem</label>
              <input
                type="number"
                placeholder="Ex: 2"
                value={vagas}
                onChange={(e) => setVagas(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
                min="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Área Privativa (m²)</label>
              <input
                type="number"
                placeholder="Ex: 120"
                value={metragem}
                onChange={(e) => setMetragem(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Descrição com Inteligência Artificial */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição Resumida</label>
            
            <button
              type="button"
              onClick={handleAiImprove}
              disabled={aiLoading}
              className="text-[11px] font-bold text-[#003366] flex items-center bg-[#003366]/5 hover:bg-[#003366]/10 px-2.5 py-1 rounded-full transition-all interactive-action"
            >
              <Sparkles size={12} className={`mr-1 text-indigo-600 ${aiLoading ? 'animate-spin' : ''}`} />
              {aiLoading ? 'Melhorando...' : 'Melhorar com IA'}
            </button>
          </div>

          <textarea
            placeholder="Escreva uma descrição básica aqui... Ex: 'Apto 3 suites com vista mar decorado na barra sul'"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
          />
        </div>

        {/* Localização com Autocomplete */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Localização e Endereço</label>
            <button
              type="button"
              onClick={handleAutocomplete}
              disabled={autocompleteLoading}
              className="text-[11px] font-bold text-emerald-800 flex items-center bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full transition-all"
            >
              <Search size={12} className="mr-1" />
              {autocompleteLoading ? 'Autocompletando...' : 'Autocompletar'}
            </button>
          </div>

          {/* Localização input */}
          <div>
            <span className="text-[11px] text-slate-400 mb-1 block">Endereço (Rua, nº ou região):</span>
            <input
              type="text"
              placeholder="Ex: Av. Atlântica, 4500 ou Yachthouse"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Cidade */}
            <div>
              <span className="text-[11px] text-slate-400 mb-1 block">Cidade:</span>
              <input
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>

            {/* Bairro */}
            <div>
              <span className="text-[11px] text-slate-400 mb-1 block">Bairro:</span>
              <input
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
              />
            </div>
          </div>
        </div>

        {/* Proprietário (só visível para o corretor cadastrado) */}
        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-3.5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
              Dados do Proprietário (Confidencial)
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Estes dados nunca são compartilhados ou visíveis para outros corretores.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-slate-300 block mb-1">Nome do Proprietário (Opcional):</span>
              <input
                type="text"
                placeholder="Ex: Carlos Albuquerque"
                value={nomeProprietario}
                onChange={(e) => setNomeProprietario(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-hidden focus:border-amber-400"
              />
            </div>

            <div>
              <span className="text-[11px] text-slate-300 block mb-1">Telefone (Opcional):</span>
              <input
                type="text"
                placeholder="Ex: (47) 99888-7766"
                value={telefoneProprietario}
                onChange={(e) => setTelefoneProprietario(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Switches / Switches */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferências do Imóvel</label>
          
          {/* Favorito */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block">⭐ Marcar como Favorito</span>
              <span className="text-[10px] text-slate-400">Mostra este imóvel no carrossel de destaques rápidos.</span>
            </div>
            <button
              type="button"
              onClick={() => setFavorito(!favorito)}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors focus:outline-hidden ${
                favorito ? 'bg-[#003366]' : 'bg-slate-200'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                favorito ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Compartilhar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-700 block">☑ Compartilhar com outros corretores</span>
              <span className="text-[10px] text-slate-400">Se ativo, outros corretores poderão visualizar e vender em parceria.</span>
            </div>
            <button
              type="button"
              onClick={() => setCompartilhar(!compartilhar)}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors focus:outline-hidden ${
                compartilhar ? 'bg-[#003366]' : 'bg-slate-200'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                compartilhar ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-wider text-[10px]"
        >
          Salvar Imóvel
        </button>

      </form>
    </div>
  );
}
