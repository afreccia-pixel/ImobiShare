/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Imovel } from '../types';
import { DbService } from '../services/db';
import { Sparkles, MapPin, Search, Plus, Trash2, Check, ArrowLeft, Image as ImageIcon, Upload, Building2, Bed, Car, Maximize, Bath } from 'lucide-react';

interface PropertyFormProps {
  imovelId?: string | null; // If editing
  onSave: (saved: Imovel) => void;
  onCancel: () => void;
}

const PROPERTY_TYPES = [
  'Apartamento',
  'Casa',
  'Casa em condomínio',
  'Cobertura',
  'Terreno',
  'Comercial',
  'Outro'
] as const;

type PropertyTypeOption = typeof PROPERTY_TYPES[number];

// Helper to format the number as a Portuguese thousands separator string
const formatNumberWithSeparators = (val: number | '') => {
  if (val === '') return '';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0
  }).format(val);
};

export function PropertyForm({ imovelId, onSave, onCancel }: PropertyFormProps) {
  // 1. Fotos
  const [fotos, setFotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Localização & CEP
  const [cep, setCep] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [cidade, setCidade] = useState(() => DbService.getActiveCorretor().cidade);
  const [bairro, setBairro] = useState('');

  // 3. Tipo de imóvel, Negócio e Valor
  const [tipoImovel, setTipoImovel] = useState<PropertyTypeOption | ''>('Apartamento');
  const [tipo, setTipo] = useState<'venda' | 'locação'>('venda');
  const [valor, setValor] = useState<number | ''>('');

  // 4. Área Total
  const [areaTotal, setAreaTotal] = useState<number | ''>('');

  // 5. Quartos (Dormitórios)
  const [dormitorios, setDormitorios] = useState<number | ''>('');

  // 6. Garagem (Vagas)
  const [vagas, setVagas] = useState<number | ''>('');

  // 7. Número de banheiros
  const [banheiros, setBanheiros] = useState<number | ''>('');

  // 8. Metragem privativa
  const [metragem, setMetragem] = useState<number | ''>('');

  // 9. Nome do edifício
  const [nomeEdificio, setNomeEdificio] = useState('');

  // 10. Título
  const [titulo, setTitulo] = useState('');

  // 11. Descrição
  const [descricao, setDescricao] = useState('');

  // 12. Preferências
  const [favorito, setFavorito] = useState(false);
  const [compartilhar, setCompartilhar] = useState(true);

  // 13. Dados do proprietário
  const [nomeProprietario, setNomeProprietario] = useState('');
  const [telefoneProprietario, setTelefoneProprietario] = useState('');

  // Loading & error states
  const [aiLoading, setAiLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Conditional mandatory status check: Terreno or Comercial makes bedrooms, building name and garage optional
  const isLandOrCommercial = tipoImovel === 'Terreno' || tipoImovel === 'Comercial';

  useEffect(() => {
    if (imovelId) {
      const imoveis = DbService.getImoveis();
      const found = imoveis.find(i => i.id === imovelId);
      if (found) {
        setFotos(found.fotos || []);
        setCep(found.cep || '');
        setLocalizacao(found.localizacao || '');
        setCidade(found.cidade || DbService.getActiveCorretor().cidade);
        setBairro(found.bairro || '');
        setTipoImovel((found.tipoImovel as PropertyTypeOption) || 'Apartamento');
        setTipo(found.tipo || 'venda');
        setValor(found.valor || '');
        setAreaTotal(found.areaTotal ?? found.metragem ?? '');
        setDormitorios(found.dormitorios ?? '');
        setVagas(found.vagas ?? '');
        setBanheiros(found.banheiros ?? '');
        setMetragem(found.metragem ?? '');
        setNomeEdificio(found.nomeEdificio || '');
        setTitulo(found.titulo || '');
        setDescricao(found.descricao || '');
        setFavorito(found.favorito || false);
        setCompartilhar(found.compartilhar !== false);
        setNomeProprietario(found.nomeProprietario || '');
        setTelefoneProprietario(found.telefoneProprietario || '');
      }
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
      } else if (text.includes('haras') || text.includes('rio do ouro')) {
        detectedBairro = 'Bandeirantes';
        detectedEdificio = 'Haras Rio do Ouro';
      }

      setCidade(detectedCidade);
      setBairro(detectedBairro);
      if (detectedEdificio && !nomeEdificio && !isLandOrCommercial) {
        setNomeEdificio(detectedEdificio);
      }

      if (!localizacao.includes(detectedCidade)) {
        setLocalizacao(`${localizacao}, ${detectedBairro} - ${detectedCidade} - SC`);
      }

      setAutocompleteLoading(false);
    }, 600);
  };

  // Handle Fetch CEP via ViaCEP API
  const handleFetchCep = async (cepInput?: string) => {
    const raw = (cepInput !== undefined ? cepInput : cep).replace(/\D/g, '');
    if (raw.length !== 8) {
      if (cepInput === undefined) {
        setErrorMsg('Informe um CEP válido com 8 dígitos.');
      }
      return;
    }

    setAutocompleteLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          if (data.logradouro) setLocalizacao(data.logradouro);
          if (data.bairro) setBairro(data.bairro);
          if (data.localidade) setCidade(data.localidade);
        } else {
          setErrorMsg('CEP não encontrado. Verifique os dígitos informados.');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setAutocompleteLoading(false);
    }
  };

  // Handle AI Description Improvement
  const handleAiImprove = async () => {
    setErrorMsg('');
    setAiLoading(true);

    try {
      const improved = await DbService.improveDescription({
        text: descricao,
        type: tipo,
        tipoImovel: tipoImovel || 'Imóvel',
        titulo: titulo || nomeEdificio || 'Imóvel Exclusivo',
        localizacao: localizacao || cidade,
        nomeEdificio: nomeEdificio,
        dormitorios: dormitorios !== '' ? Number(dormitorios) : undefined,
        vagas: vagas !== '' ? Number(vagas) : undefined,
        banheiros: banheiros !== '' ? Number(banheiros) : undefined,
        metragem: metragem !== '' ? Number(metragem) : undefined,
        areaTotal: areaTotal !== '' ? Number(areaTotal) : undefined,
        valor: valor !== '' ? Number(valor) : undefined,
      });

      setDescricao(improved);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao conectar com a IA. Tente novamente.');
    } finally {
      setAiLoading(false);
    }
  };

  // Image Compression helper
  const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.75): Promise<string> => {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedBase64 = await compressImage(file);
        setFotos((prev) => {
          if (!prev.includes(compressedBase64)) {
            return [...prev, compressedBase64];
          }
          return prev;
        });
      } catch (error) {
        console.error('Error compressing image:', error);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const resultStr = reader.result;
            setFotos((prev) => {
              if (!prev.includes(resultStr)) {
                return [...prev, resultStr];
              }
              return prev;
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Fotos validation
    if (fotos.length === 0) {
      setErrorMsg('Adicione pelo menos uma foto ao imóvel.');
      return;
    }

    // 2. Localização validation
    if (!localizacao.trim()) {
      setErrorMsg('Localização / Endereço é obrigatória.');
      return;
    }

    // 3. Tipo de imóvel validation
    if (!tipoImovel) {
      setErrorMsg('Tipo de imóvel é obrigatório.');
      return;
    }

    if (!valor || Number(valor) <= 0) {
      setErrorMsg('Valor do imóvel é obrigatório e deve ser maior que zero.');
      return;
    }

    // 4. Área Total validation
    if (areaTotal === '' || Number(areaTotal) <= 0) {
      setErrorMsg('Área total é obrigatória.');
      return;
    }

    // 5. Quartos validation (conditional)
    if (!isLandOrCommercial && (dormitorios === '' || Number(dormitorios) < 0)) {
      setErrorMsg('Número de quartos é obrigatório.');
      return;
    }

    // 6. Garagem validation (conditional)
    if (!isLandOrCommercial && (vagas === '' || Number(vagas) < 0)) {
      setErrorMsg('Número de vagas de garagem é obrigatório.');
      return;
    }

    // 7. Número de banheiros validation
    if (banheiros === '' || Number(banheiros) < 0) {
      setErrorMsg('Número de banheiros é obrigatório.');
      return;
    }

    // 8. Metragem privativa validation
    if (metragem === '' || Number(metragem) <= 0) {
      setErrorMsg('Metragem privativa é obrigatória.');
      return;
    }

    // 9. Nome do edifício validation (conditional)
    if (!isLandOrCommercial && !nomeEdificio.trim()) {
      setErrorMsg('Nome do edifício / condomínio é obrigatório.');
      return;
    }

    // 10. Título validation
    if (!titulo.trim()) {
      setErrorMsg('Título do anúncio é obrigatório.');
      return;
    }

    // 11. Descrição validation
    if (!descricao.trim()) {
      setErrorMsg('Descrição do imóvel é obrigatória.');
      return;
    }

    const saved = DbService.saveImovel({
      id: imovelId || undefined,
      titulo,
      descricao,
      valor: Number(valor),
      tipo,
      tipoImovel: tipoImovel as any,
      cidade,
      bairro: bairro || 'Centro',
      localizacao,
      cep: cep.trim() || undefined,
      nomeEdificio: nomeEdificio.trim() || undefined,
      nomeProprietario: nomeProprietario.trim(),
      telefoneProprietario: telefoneProprietario.trim(),
      favorito,
      compartilhar,
      fotos,
      dormitorios: dormitorios !== '' ? Number(dormitorios) : undefined,
      vagas: vagas !== '' ? Number(vagas) : undefined,
      banheiros: banheiros !== '' ? Number(banheiros) : undefined,
      metragem: metragem !== '' ? Number(metragem) : undefined,
      areaTotal: areaTotal !== '' ? Number(areaTotal) : undefined,
    });

    onSave(saved);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16" id="property-form-container">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onCancel} className="p-1 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-slate-800 text-base">
          {imovelId ? 'Editar Imóvel' : 'Cadastrar Imóvel'}
        </h1>
        <div className="w-8" />
      </div>

      <form onSubmit={handleSave} className="p-2.5 sm:p-4 max-w-xl mx-auto space-y-2.5">
        
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-2.5 font-medium flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Anexar imagens */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Anexar imagens <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] font-semibold text-slate-400">
              {fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
          
          {/* Photos list thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {fotos.map((foto, index) => (
              <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200 shadow-2xs">
                <img src={foto} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-0.5 right-0.5 bg-slate-900/80 text-white p-0.5 rounded-full hover:bg-rose-600 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            
            {fotos.length === 0 && (
              <div className="w-full h-16 border border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-2 text-slate-400 bg-slate-50/50 px-3">
                <ImageIcon size={18} className="text-slate-300" />
                <span className="text-xs text-slate-500">Nenhuma foto anexada. Toque no botão abaixo para adicionar.</span>
              </div>
            )}
          </div>

          {/* Prominent Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-[#003366] bg-[#003366]/5 hover:bg-[#003366]/10 rounded-lg cursor-pointer text-xs font-bold text-[#003366] transition-all text-center active:scale-[0.99]"
          >
            <Upload size={15} className="text-[#003366]" />
            <span>Adicionar Fotos do Celular / Galeria</span>
          </button>
        </div>

        {/* 2. Localização & CEP * */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Localização <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAutocomplete}
              disabled={autocompleteLoading}
              className="text-[10px] font-bold text-emerald-800 flex items-center bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-all"
            >
              <Search size={11} className="mr-1" />
              {autocompleteLoading ? 'Autocompletando...' : 'Autocompletar'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">CEP:</span>
              <input
                type="text"
                placeholder="88330-000"
                value={cep}
                onChange={(e) => {
                  const val = e.target.value;
                  setCep(val);
                  if (val.replace(/\D/g, '').length === 8) {
                    handleFetchCep(val);
                  }
                }}
                onBlur={() => handleFetchCep()}
                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50 font-medium"
              />
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Endereço (Rua, nº ou ref.):</span>
              <input
                type="text"
                placeholder="Ex: Av. Atlântica, 4500 ou Yachthouse"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Cidade:</span>
              <input
                type="text"
                placeholder="Cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-medium"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Bairro:</span>
              <input
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* 3. Tipo de imóvel * */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            3. Tipo de imóvel & Negócio <span className="text-rose-500">*</span>
          </label>

          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Tipo de Imóvel:</span>
              <select
                value={tipoImovel}
                onChange={(e) => setTipoImovel(e.target.value as PropertyTypeOption)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:outline-hidden focus:border-[#003366]"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Negócio:</span>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTipo('venda')}
                    className={`py-1 text-xs font-bold rounded-md transition-all ${
                      tipo === 'venda' ? 'bg-white text-[#003366] shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Venda
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo('locação')}
                    className={`py-1 text-xs font-bold rounded-md transition-all ${
                      tipo === 'locação' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    Locação
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">
                  Valor {tipo === 'locação' ? '(mês)' : ''} <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ Valor"
                  value={formatNumberWithSeparators(valor)}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const cleanValue = rawValue.replace(/\D/g, '');
                    setValor(cleanValue === '' ? '' : Number(cleanValue));
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-bold text-[#003366]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Especificações do Imóvel (Metragens, Quartos, Vagas, Banheiros) */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              4. Especificações do Imóvel <span className="text-rose-500">*</span>
            </label>
            {isLandOrCommercial && (
              <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                Opcional p/ {tipoImovel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            <div>
              <span className="text-[10px] font-semibold text-slate-600 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title="Área Total (m²)">
                Área Total <span className="text-rose-500">*</span>
              </span>
              <input
                type="number"
                placeholder="m²"
                value={areaTotal}
                onChange={(e) => setAreaTotal(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-medium text-center"
                min="0"
              />
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-600 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title="Metragem Privativa (m²)">
                Privativa <span className="text-rose-500">*</span>
              </span>
              <input
                type="number"
                placeholder="m²"
                value={metragem}
                onChange={(e) => setMetragem(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-medium text-center"
                min="0"
              />
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-600 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title="Quartos / Dormitórios">
                Quartos {!isLandOrCommercial && <span className="text-rose-500">*</span>}
              </span>
              <input
                type="number"
                placeholder="Qtd"
                value={dormitorios}
                onChange={(e) => setDormitorios(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-medium text-center"
                min="0"
              />
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-600 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title="Vagas de Garagem">
                Vagas {!isLandOrCommercial && <span className="text-rose-500">*</span>}
              </span>
              <input
                type="number"
                placeholder="Qtd"
                value={vagas}
                onChange={(e) => setVagas(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-medium text-center"
                min="0"
              />
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-600 block mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis" title="Banheiros">
                Banheiros <span className="text-rose-500">*</span>
              </span>
              <input
                type="number"
                placeholder="Qtd"
                value={banheiros}
                onChange={(e) => setBanheiros(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs px-1.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-medium text-center"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* 5. Nome do edifício * */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
              5. Nome do Edifício / Condomínio {!isLandOrCommercial && <span className="text-rose-500">*</span>}
            </label>
            {isLandOrCommercial && (
              <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">Opcional</span>
            )}
          </div>
          <input
            type="text"
            placeholder={isLandOrCommercial ? "Opcional" : "Ex: Ibiza Towers Residence"}
            value={nomeEdificio}
            onChange={(e) => setNomeEdificio(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
          />
        </div>

        {/* 6. Título * */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
            6. Título do Anúncio <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Apartamento Alto Padrão Frente Mar Barra Sul"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
          />
        </div>

        {/* 7. Descrição * (com botão "Melhorar com IA") */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
              7. Descrição do Imóvel <span className="text-rose-500">*</span>
            </label>
            
            <button
              type="button"
              onClick={handleAiImprove}
              disabled={aiLoading}
              className="text-[10px] font-bold text-[#003366] flex items-center bg-[#003366]/5 hover:bg-[#003366]/10 px-2.5 py-1 rounded-full transition-all interactive-action shadow-2xs active:scale-95"
            >
              <Sparkles size={12} className={`mr-1 text-indigo-600 ${aiLoading ? 'animate-spin' : ''}`} />
              {aiLoading ? 'Melhorando...' : 'Melhorar com IA'}
            </button>
          </div>

          <textarea
            placeholder="Escreva uma breve descrição ou anotações aqui... Toque em 'Melhorar com IA' para que o sistema aprimore o texto utilizando todos os dados cadastrados."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] leading-relaxed"
          />
        </div>

        {/* 8. Preferências */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">8. Preferências do Imóvel</label>
          
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Favorito */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-xs font-bold text-slate-800">⭐ Favorito</span>
              <button
                type="button"
                onClick={() => setFavorito(!favorito)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-hidden ${
                  favorito ? 'bg-[#003366]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                  favorito ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Compartilhar */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-xs font-bold text-slate-800">☑ Compartilhar</span>
              <button
                type="button"
                onClick={() => setCompartilhar(!compartilhar)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-hidden ${
                  compartilhar ? 'bg-[#003366]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                  compartilhar ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 9. Dados do proprietário */}
        <div className="bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800 space-y-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
              9. Dados do Proprietário (Confidencial)
            </h4>
            <p className="text-[10px] text-slate-400">Visível apenas para você. Nunca é compartilhado com terceiros.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-300 block mb-0.5 whitespace-nowrap">Nome do Proprietário:</span>
              <input
                type="text"
                placeholder="Ex: Carlos Albuquerque"
                value={nomeProprietario}
                onChange={(e) => setNomeProprietario(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-hidden focus:border-amber-400"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-300 block mb-0.5 whitespace-nowrap">Telefone / WhatsApp:</span>
              <input
                type="text"
                placeholder="Ex: (47) 99888-7766"
                value={telefoneProprietario}
                onChange={(e) => setTelefoneProprietario(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-wider text-[11px]"
        >
          {imovelId ? 'Atualizar Imóvel' : 'Salvar Imóvel'}
        </button>

      </form>
    </div>
  );
}
