/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, SlidersHorizontal, Building, MapPin, DollarSign, Home, BedDouble, Bath, Car, Maximize2 } from 'lucide-react';
import { PortalFilterState, PortalProperty } from '../types';

interface PortalMoreFiltersModalProps {
  filters: PortalFilterState;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updated: Partial<PortalFilterState>) => void;
  properties?: PortalProperty[];
}

export function PortalMoreFiltersModal({
  filters,
  isOpen,
  onClose,
  onApply,
  properties = [],
}: PortalMoreFiltersModalProps) {
  // Local state initialized from incoming filters
  const [cidade, setCidade] = useState<string>(filters.cidade || 'Balneário Camboriú');
  const [bairro, setBairro] = useState<string>(filters.bairro || '');
  const [finalidade, setFinalidade] = useState<'Comprar' | 'Alugar' | 'Todos'>(filters.finalidade || 'Comprar');
  const [tipoImovel, setTipoImovel] = useState<string>(filters.tipoImovel || 'todos');
  const [statusImovel, setStatusImovel] = useState<string>(filters.statusImovel || 'todos');
  const [precoMin, setPrecoMin] = useState<number>(filters.precoMin || 0);
  const [precoMax, setPrecoMax] = useState<number>(filters.precoMax || 15000000);
  const [quartos, setQuartos] = useState<number>(filters.quartosMin || 0);
  const [banheiros, setBanheiros] = useState<number>(filters.banheirosMin || 0);
  const [vagas, setVagas] = useState<number>(filters.vagasMin || 0);
  const [metragemMin, setMetragemMin] = useState<number>(filters.metragemMin || 0);
  const [metragemMax, setMetragemMax] = useState<number>(filters.metragemMax || 0);
  const [construtora, setConstrutora] = useState<string>(filters.construtora || '');

  // Keep local state in sync whenever modal opens with new external filters
  useEffect(() => {
    if (isOpen) {
      setCidade(filters.cidade || 'Balneário Camboriú');
      setBairro(filters.bairro || '');
      setFinalidade(filters.finalidade || 'Comprar');
      setTipoImovel(filters.tipoImovel || 'todos');
      setStatusImovel(filters.statusImovel || 'todos');
      setPrecoMin(filters.precoMin || 0);
      setPrecoMax(filters.precoMax || 15000000);
      setQuartos(filters.quartosMin || 0);
      setBanheiros(filters.banheirosMin || 0);
      setVagas(filters.vagasMin || 0);
      setMetragemMin(filters.metragemMin || 0);
      setMetragemMax(filters.metragemMax || 0);
      setConstrutora(filters.construtora || '');
    }
  }, [isOpen, filters]);

  // Dynamically extract unique cities from properties
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (p.cidade && p.cidade.trim()) set.add(p.cidade.trim());
    });
    if (set.size === 0) {
      ['Balneário Camboriú', 'Itapema', 'Itajaí', 'Praia Brava', 'Navegantes', 'Porto Belo'].forEach((c) => set.add(c));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [properties]);

  // Dynamically extract unique construtoras from properties
  const availableConstrutoras = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (p.construtora && p.construtora.trim()) set.add(p.construtora.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [properties]);

  // Popular neighborhoods for quick chips
  const popularNeighborhoods = [
    'Centro',
    'Barra Sul',
    'Pioneiros',
    'Nações',
    'Praia Brava',
    'Meia Praia',
    'Fazenda',
  ];

  // Dynamic preview count of properties matching the modal state
  const matchingCount = useMemo(() => {
    if (!properties || properties.length === 0) return 0;
    return properties.filter((p) => {
      // Cidade
      if (cidade && cidade !== 'Todas') {
        const c = cidade.toLowerCase();
        if (!p.cidade.toLowerCase().includes(c) && !c.includes(p.cidade.toLowerCase())) {
          return false;
        }
      }

      // Finalidade
      if (finalidade === 'Comprar' && p.tipo !== 'venda' && p.tipo !== 'ambos') return false;
      if (finalidade === 'Alugar' && p.tipo !== 'locação' && p.tipo !== 'ambos') return false;

      // Tipo de imóvel
      if (tipoImovel && tipoImovel !== 'todos') {
        const t = tipoImovel.toLowerCase();
        const pType = (p.tipoImovel || '').toLowerCase();
        if (t === 'casa' && (pType.includes('casa') || pType.includes('sobrado'))) {
          // match
        } else if (!pType.includes(t)) {
          return false;
        }
      }

      // Status
      if (statusImovel && statusImovel !== 'todos') {
        const s = statusImovel.toLowerCase();
        if ((p.statusImovel || '').toLowerCase() !== s) return false;
      }

      // Valor
      if (precoMin > 0 && p.valor < precoMin) return false;
      if (precoMax > 0 && precoMax < 15000000 && p.valor > precoMax) return false;

      // Quartos
      if (quartos > 0 && (p.dormitorios || p.quartos || 0) < quartos) return false;

      // Banheiros
      if (banheiros > 0 && (p.banheiros || 0) < banheiros) return false;

      // Vagas
      if (vagas > 0 && (p.vagas || 0) < vagas) return false;

      // Metragem
      if (metragemMin > 0 && (p.metragem || 0) < metragemMin) return false;
      if (metragemMax > 0 && (p.metragem || 0) > metragemMax) return false;

      // Bairro
      if (bairro && bairro.trim() && bairro !== 'Todos os bairros') {
        if (!p.bairro.toLowerCase().includes(bairro.toLowerCase().trim())) return false;
      }

      // Construtora
      if (construtora && construtora.trim() && construtora !== 'Todas as construtoras') {
        if (!(p.construtora || '').toLowerCase().includes(construtora.toLowerCase().trim())) return false;
      }

      return true;
    }).length;
  }, [
    properties,
    cidade,
    finalidade,
    tipoImovel,
    statusImovel,
    precoMin,
    precoMax,
    quartos,
    banheiros,
    vagas,
    metragemMin,
    metragemMax,
    bairro,
    construtora,
  ]);

  if (!isOpen) return null;

  const handleClear = () => {
    setCidade('Balneário Camboriú');
    setBairro('');
    setFinalidade('Comprar');
    setTipoImovel('todos');
    setStatusImovel('todos');
    setPrecoMin(0);
    setPrecoMax(15000000);
    setQuartos(0);
    setBanheiros(0);
    setVagas(0);
    setMetragemMin(0);
    setMetragemMax(0);
    setConstrutora('');

    onApply({
      cidade: 'Balneário Camboriú',
      bairro: undefined,
      finalidade: 'Comprar',
      tipoImovel: 'todos',
      statusImovel: 'todos',
      precoMin: undefined,
      precoMax: undefined,
      quartosMin: undefined,
      banheirosMin: undefined,
      vagasMin: undefined,
      metragemMin: undefined,
      metragemMax: undefined,
      construtora: undefined,
    });
    onClose();
  };

  const handleApply = () => {
    onApply({
      cidade,
      bairro: bairro.trim() || undefined,
      finalidade,
      tipoImovel: tipoImovel !== 'todos' ? tipoImovel : undefined,
      statusImovel: statusImovel !== 'todos' ? statusImovel : undefined,
      precoMin: precoMin > 0 ? precoMin : undefined,
      precoMax: precoMax > 0 && precoMax < 15000000 ? precoMax : undefined,
      quartosMin: quartos > 0 ? quartos : undefined,
      banheirosMin: banheiros > 0 ? banheiros : undefined,
      vagasMin: vagas > 0 ? vagas : undefined,
      metragemMin: metragemMin > 0 ? metragemMin : undefined,
      metragemMax: metragemMax > 0 ? metragemMax : undefined,
      construtora: construtora.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      id="modal-mais-filtros"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#003366] flex items-center justify-center">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Filtros de Busca
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Personalize os critérios para encontrar o imóvel ideal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros avançados"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Content - Segue exatamente o modelo do ImobiShare */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* 1. Modalidade / Finalidade (Comprar / Alugar / Todos) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Modalidade de Negócio
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'Todos', label: 'Todos' },
                { id: 'Comprar', label: 'Venda' },
                { id: 'Alugar', label: 'Alugar (Locação)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFinalidade(opt.id as 'Comprar' | 'Alugar' | 'Todos')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    finalidade === opt.id
                      ? 'bg-white text-[#003366] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Cidade e Bairro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                <MapPin size={12} className="text-[#003366]" />
                2. Cidade
              </label>
              <select
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366] cursor-pointer"
              >
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Todas">Todas As Cidades</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                3. Bairro / Região
              </label>
              <input
                type="text"
                placeholder="Ex: Barra Sul, Pioneiros, Centro..."
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366]"
              />
            </div>
          </div>

          {/* Atalhos de Bairros populares */}
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-slate-400 block">Bairros mais buscados:</span>
            <div className="flex flex-wrap gap-1.5">
              {popularNeighborhoods.map((n) => {
                const isSelected = bairro.toLowerCase() === n.toLowerCase();
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBairro(isSelected ? '' : n)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-50 border-[#003366] text-[#003366]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tipo de Imóvel */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Home size={12} className="text-[#003366]" />
              4. Tipo de Imóvel
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'Apartamento', label: 'Apartamento' },
                { id: 'Casa', label: 'Casa / Sobrado' },
                { id: 'Cobertura', label: 'Cobertura' },
                { id: 'Terreno', label: 'Terreno / Lote' },
                { id: 'Comercial', label: 'Comercial' },
                { id: 'Diferenciado', label: 'Diferenciado' },
                { id: 'Outro', label: 'Outro' },
              ].map((t) => {
                const isSelected = tipoImovel.toLowerCase() === t.id.toLowerCase();
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoImovel(t.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Status do Imóvel */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Status do Imóvel
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'todos', label: 'Todos os Status' },
                { id: 'Na planta', label: 'Na Planta / Lançamento' },
                { id: 'Mobiliado', label: 'Mobiliado' },
                { id: 'Sem mobília', label: 'Sem Mobília' },
              ].map((st) => {
                const isSelected = statusImovel.toLowerCase() === st.id.toLowerCase();
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusImovel(st.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Faixa de Preço */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                <DollarSign size={12} className="text-[#003366]" />
                5. Faixa de Valor (R$)
              </label>
              {(precoMin > 0 || (precoMax > 0 && precoMax < 15000000)) && (
                <button
                  type="button"
                  onClick={() => {
                    setPrecoMin(0);
                    setPrecoMax(15000000);
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Redefinir preço
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Mínimo</span>
                <input
                  type="number"
                  placeholder="R$ Mínimo"
                  value={precoMin === 0 ? '' : precoMin}
                  onChange={(e) => setPrecoMin(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366]"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Máximo</span>
                <input
                  type="number"
                  placeholder="R$ Máximo"
                  value={precoMax >= 15000000 || precoMax === 0 ? '' : precoMax}
                  onChange={(e) => setPrecoMax(e.target.value === '' ? 15000000 : Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366]"
                />
              </div>
            </div>

            {/* Shortcuts for price */}
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                { label: 'Até R$ 1 Mio', min: 0, max: 1000000 },
                { label: 'R$ 1M a 2.5M', min: 1000000, max: 2500000 },
                { label: 'R$ 2.5M a 4M', min: 2500000, max: 4000000 },
                { label: 'R$ 4M+', min: 4000000, max: 15000000 },
              ].map((sc) => (
                <button
                  key={sc.label}
                  type="button"
                  onClick={() => {
                    setPrecoMin(sc.min);
                    setPrecoMax(sc.max);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 transition-all cursor-pointer"
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Cômodos Mínimos (Quartos, Banheiros, Vagas) */}
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              6. Cômodos Mínimos
            </label>

            {/* Quartos */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                <BedDouble size={14} className="text-slate-400" />
                Quartos / Dormitórios
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuartos(num)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      quartos === num
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {num === 0 ? 'Qualq.' : `${num}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Banheiros */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                <Bath size={14} className="text-slate-400" />
                Banheiros / BWC
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBanheiros(num)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      banheiros === num
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {num === 0 ? 'Qualq.' : `${num}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Vagas */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                <Car size={14} className="text-slate-400" />
                Vagas de Garagem
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setVagas(num)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      vagas === num
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {num === 0 ? 'Qualq.' : `${num}+`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 7. Metragem Privativa (m²) */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Maximize2 size={12} className="text-[#003366]" />
              7. Metragem Privativa (m²)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Área Mínima</span>
                <input
                  type="number"
                  placeholder="Ex: 80 m²"
                  value={metragemMin === 0 ? '' : metragemMin}
                  onChange={(e) => setMetragemMin(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366]"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Área Máxima</span>
                <input
                  type="number"
                  placeholder="Ex: 300 m²"
                  value={metragemMax === 0 ? '' : metragemMax}
                  onChange={(e) => setMetragemMax(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:border-[#003366]"
                />
              </div>
            </div>
          </div>

          {/* 8. Construtora / Incorporadora */}
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Building size={12} className="text-[#003366]" />
              8. Construtora / Incorporadora
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Todas as construtoras',
                ...availableConstrutoras.slice(0, 6),
                'FG Empreendimentos',
                'Embraed',
                'Baggio',
              ]
                .filter((val, idx, self) => self.indexOf(val) === idx)
                .map((c) => {
                  const isSelected = (!construtora && c === 'Todas as construtoras') || construtora.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConstrutora(c === 'Todas as construtoras' ? '' : c)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Modal Footer (Idêntico ao ImobiShare) */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-xs transition-all cursor-pointer"
          >
            Limpar
          </button>
          <button
            type="button"
            id="btn-aplicar-mais-filtros"
            onClick={handleApply}
            className="flex-1 bg-[#003366] hover:bg-[#002244] text-white py-3 px-4 rounded-full font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-2"
          >
            Ver {matchingCount} {matchingCount === 1 ? 'Imóvel Encontrado' : 'Imóveis Encontrados'}
          </button>
        </div>
      </div>
    </div>
  );
}
