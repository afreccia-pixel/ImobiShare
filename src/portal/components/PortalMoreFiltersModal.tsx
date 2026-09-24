/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PortalFilterState, PortalProperty } from '../types';
import { DbService } from '../../services/db';

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
  const [finalidade, setFinalidade] = useState<'Comprar' | 'Alugar' | 'Todos'>(filters.finalidade || 'Comprar');
  const [tipoImovel, setTipoImovel] = useState<string>(filters.tipoImovel || '');
  const [statusImovel, setStatusImovel] = useState<string>(filters.statusImovel || '');
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
      setFinalidade(filters.finalidade || 'Comprar');
      setTipoImovel(filters.tipoImovel && filters.tipoImovel !== 'todos' ? filters.tipoImovel : '');
      setStatusImovel(filters.statusImovel && filters.statusImovel !== 'todos' ? filters.statusImovel : '');
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

  // Garante que o modal utilize todo o acervo disponível em memória para cálculo exato do total do filtro
  const effectiveProperties = useMemo(() => {
    const syncList = DbService.getImoveisSync();
    if (properties && properties.length >= syncList.length && properties.length > 0) {
      return properties;
    }
    return syncList.length > 0 ? (syncList as any) : properties;
  }, [properties]);

  // Dynamically extract unique construtoras from properties
  const availableConstrutoras = useMemo(() => {
    const set = new Set<string>();
    effectiveProperties.forEach((p: any) => {
      if (p.construtora && p.construtora.trim()) set.add(p.construtora.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [effectiveProperties]);

  // Dynamic preview count of properties matching the modal state
  const matchingCount = useMemo(() => {
    if (!effectiveProperties || effectiveProperties.length === 0) return 0;
    return effectiveProperties.filter((p: any) => {
      // Cidade já definida externamente (preserva o filtro da tela inicial)
      if (filters.cidade && filters.cidade !== 'Todas') {
        const c = filters.cidade.toLowerCase().trim();
        const pCity = (p.cidade || '').toLowerCase().trim();
        if (pCity !== c) {
          return false;
        }
      }

      // Bairro já definido externamente (preserva se houver)
      if (filters.bairro && filters.bairro.trim() && filters.bairro !== 'Todos os bairros') {
        if (!(p.bairro || '').toLowerCase().includes(filters.bairro.toLowerCase().trim())) return false;
      }

      // Finalidade: se for 'Todos' ou vazio, não restringe
      if (finalidade === 'Comprar' && p.tipo !== 'venda' && p.tipo !== 'ambos') return false;
      if (finalidade === 'Alugar' && p.tipo !== 'locação' && p.tipo !== 'ambos') return false;

      // Tipo de imóvel: se vazio, é todos (não filtra)
      if (tipoImovel && tipoImovel !== 'todos') {
        const t = tipoImovel.toLowerCase();
        const pType = (p.tipoImovel || '').toLowerCase();
        if (t === 'casa' && (pType.includes('casa') || pType.includes('sobrado'))) {
          // match
        } else if (!pType.includes(t)) {
          return false;
        }
      }

      // Condição do imóvel: se vazio, é todos (não filtra)
      if (statusImovel && statusImovel !== 'todos') {
        const s = statusImovel.toLowerCase().trim();
        const pCond = (p.condicaoImovel || p.statusImovel || '').toLowerCase().trim();
        if (s.includes('planta')) {
          if (!pCond.includes('planta') && !pCond.includes('obra') && !pCond.includes('constru')) return false;
        } else if (s.includes('sem')) {
          if (!pCond.includes('sem')) return false;
        } else if (s.includes('mobil')) {
          if (!pCond.includes('mobil') || pCond.includes('sem')) return false;
        } else if (pCond !== s) {
          return false;
        }
      }

      // Valor
      if (precoMin > 0 && p.valor < precoMin) return false;
      if (precoMax > 0 && precoMax < 15000000 && p.valor > precoMax) return false;

      // Quartos: se 0, é todos (não filtra)
      if (quartos > 0 && (p.dormitorios || p.quartos || 0) < quartos) return false;

      // Banheiros: se 0, é todos (não filtra)
      if (banheiros > 0 && (p.banheiros || 0) < banheiros) return false;

      // Vagas: se 0, é todos (não filtra)
      if (vagas > 0 && (p.vagas || 0) < vagas) return false;

      // Metragem
      if (metragemMin > 0 && (p.metragem || 0) < metragemMin) return false;
      if (metragemMax > 0 && (p.metragem || 0) > metragemMax) return false;

      // Construtora: se vazio, é todos (não filtra)
      if (construtora && construtora.trim()) {
        if (!(p.construtora || '').toLowerCase().includes(construtora.toLowerCase().trim())) return false;
      }

      return true;
    }).length;
  }, [
    effectiveProperties,
    filters.cidade,
    filters.bairro,
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
    construtora,
  ]);

  const handleClear = () => {
    setFinalidade('Comprar');
    setTipoImovel('');
    setStatusImovel('');
    setPrecoMin(0);
    setPrecoMax(15000000);
    setQuartos(0);
    setBanheiros(0);
    setVagas(0);
    setMetragemMin(0);
    setMetragemMax(0);
    setConstrutora('');

    onApply({
      finalidade: 'Comprar',
      tipoImovel: undefined,
      statusImovel: undefined,
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
      finalidade,
      tipoImovel: tipoImovel && tipoImovel !== 'todos' ? tipoImovel : undefined,
      statusImovel: statusImovel && statusImovel !== 'todos' ? statusImovel : undefined,
      precoMin: precoMin > 0 ? precoMin : undefined,
      precoMax: precoMax > 0 && precoMax < 15000000 ? precoMax : undefined,
      quartosMin: quartos > 0 ? quartos : undefined,
      banheirosMin: banheiros > 0 ? banheiros : undefined,
      vagasMin: vagas > 0 ? vagas : undefined,
      metragemMin: metragemMin > 0 ? metragemMin : undefined,
      metragemMax: metragemMax > 0 ? metragemMax : undefined,
      construtora: construtora.trim() ? construtora.trim() : undefined,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="modal-mais-filtros"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-white w-full max-w-xl max-h-[90vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo Limpo / Botão de Fechar e Título */}
            <div className="px-5 sm:px-7 pt-4 pb-3 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-slate-100">
              <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-900 tracking-tight">
                Filtros de busca
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo com Scroll e Espaçamento Generoso (~24px) */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
              {/* 1. Negócio: Venda e Aluguel (sem botão Todos) */}
              <div className="space-y-3">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Negócio</span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Comprar', label: 'Venda' },
                    { id: 'Alugar', label: 'Aluguel' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFinalidade(finalidade === opt.id ? 'Todos' : (opt.id as 'Comprar' | 'Alugar'))}
                      className={`h-12 px-4 rounded-xl font-medium text-[15px] transition-all cursor-pointer flex items-center justify-center ${
                        finalidade === opt.id
                          ? 'bg-[#003366] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Condição do Imóvel (sem botão Todos; desmarcado = todos) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Condição do imóvel</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Na Planta', label: 'Na Planta' },
                    { id: 'Mobiliado', label: 'Mobiliado' },
                    { id: 'Sem Mobília', label: 'Sem Mobília' },
                  ].map((st) => {
                    const isSelected = statusImovel.toLowerCase() === st.id.toLowerCase();
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatusImovel(isSelected ? '' : st.id)}
                        className={`h-11 px-2 rounded-xl font-medium text-[13.5px] sm:text-[15px] whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Tipo de Imóvel (sem botão Todos; desmarcado = todos) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Tipo de imóvel</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'Apartamento', label: 'Apartamento' },
                    { id: 'Casa', label: 'Casa' },
                    { id: 'Cobertura', label: 'Cobertura' },
                    { id: 'Terreno', label: 'Terreno' },
                    { id: 'Comercial', label: 'Comercial' },
                    { id: 'Diferenciado', label: 'Diferenciado' },
                    { id: 'Outro', label: 'Outro' },
                  ].map((t) => {
                    const isSelected = tipoImovel.toLowerCase() === t.id.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTipoImovel(isSelected ? '' : t.id)}
                        className={`h-11 px-1.5 sm:px-2 rounded-xl font-medium text-[13.5px] sm:text-[15px] whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Faixa de Valor */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Faixa de valor</span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Valor mínimo"
                    value={precoMin === 0 ? '' : precoMin}
                    onChange={(e) => setPrecoMin(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[16px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003366] focus:bg-white font-normal"
                  />
                  <input
                    type="number"
                    placeholder="Valor máximo"
                    value={precoMax >= 15000000 || precoMax === 0 ? '' : precoMax}
                    onChange={(e) => setPrecoMax(e.target.value === '' ? 15000000 : Number(e.target.value))}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[16px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003366] focus:bg-white font-normal"
                  />
                </div>

                {/* Atalhos discretos em cinza claro */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'Até R$ 1 Mio', min: 0, max: 1000000 },
                    { label: 'R$ 1M a 2.5M', min: 1000000, max: 2500000 },
                    { label: 'R$ 2.5M a 4M', min: 2500000, max: 4000000 },
                    { label: 'R$ 4M+', min: 4000000, max: 15000000 },
                  ].map((shortcut) => {
                    const isActive = precoMin === shortcut.min && precoMax === shortcut.max;
                    return (
                      <button
                        key={shortcut.label}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setPrecoMin(0);
                            setPrecoMax(15000000);
                          } else {
                            setPrecoMin(shortcut.min);
                            setPrecoMax(shortcut.max);
                          }
                        }}
                        className={`py-2 px-2 rounded-lg text-[13px] sm:text-[14px] font-medium whitespace-nowrap text-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {shortcut.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Quartos (sem botão Todos; desmarcado = todos) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Quartos</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: '1+' },
                    { val: 2, label: '2+' },
                    { val: 3, label: '3+' },
                    { val: 4, label: '4+' },
                  ].map((item) => {
                    const isSelected = quartos === item.val;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setQuartos(isSelected ? 0 : item.val)}
                        className={`h-11 rounded-xl font-medium text-[15px] transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Banheiros (sem botão Todos; desmarcado = todos) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Banheiros</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: '1+' },
                    { val: 2, label: '2+' },
                    { val: 3, label: '3+' },
                    { val: 4, label: '4+' },
                  ].map((item) => {
                    const isSelected = banheiros === item.val;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setBanheiros(isSelected ? 0 : item.val)}
                        className={`h-11 rounded-xl font-medium text-[15px] transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. Vagas (sem botão Todos; desmarcado = todos) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Vagas</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: '1+' },
                    { val: 2, label: '2+' },
                    { val: 3, label: '3+' },
                    { val: 4, label: '4+' },
                  ].map((item) => {
                    const isSelected = vagas === item.val;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setVagas(isSelected ? 0 : item.val)}
                        className={`h-11 rounded-xl font-medium text-[15px] transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 8. Área Privativa */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Área privativa</span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Área mínima (m²)"
                    value={metragemMin === 0 ? '' : metragemMin}
                    onChange={(e) => setMetragemMin(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[16px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003366] focus:bg-white font-normal"
                  />
                  <input
                    type="number"
                    placeholder="Área máxima (m²)"
                    value={metragemMax === 0 ? '' : metragemMax}
                    onChange={(e) => setMetragemMax(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[16px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003366] focus:bg-white font-normal"
                  />
                </div>
              </div>

              {/* 9. Construtora / Incorporadora (sem botão Todas; desmarcado = todas) */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-[15px] sm:text-[16px] font-semibold text-slate-800 block">Construtora / Incorporadora</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    ...availableConstrutoras.slice(0, 6),
                    'FG Empreendimentos',
                    'Embraed',
                    'Baggio',
                  ]
                    .filter((val, idx, self) => self.indexOf(val) === idx)
                    .map((c) => {
                      const isSelected = construtora.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConstrutora(isSelected ? '' : c)}
                          className={`h-11 px-3.5 rounded-xl font-medium text-[13.5px] sm:text-[14px] whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#003366] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Rodapé Fixo */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-4 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={handleClear}
                className="text-[15px] font-semibold text-slate-600 hover:text-slate-900 underline sm:no-underline sm:hover:underline transition-colors cursor-pointer py-2 px-1"
              >
                Limpar
              </button>
              <button
                type="button"
                id="btn-aplicar-mais-filtros"
                onClick={handleApply}
                className="flex-1 sm:flex-initial bg-[#003366] hover:bg-[#002244] active:scale-[0.99] text-white font-semibold text-[15px] py-3.5 px-6 rounded-xl shadow-xs transition-all cursor-pointer text-center flex items-center justify-center gap-2"
              >
                Ver {matchingCount} {matchingCount === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
