/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Imovel } from '../types';
import { DbService } from '../services/db';
import { auth } from '../services/firebase';
import { Sparkles, MapPin, Search, Plus, Trash2, Check, ArrowLeft, Image as ImageIcon, Upload, Building2, Bed, Car, Maximize, Bath, Star, GripVertical } from 'lucide-react';
import { getValidImage, handleImageError } from '../utils/imageUtils';
import { getPropertyCode } from '../utils/codeUtils';

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
  const [cidade, setCidade] = useState(() => DbService.getActiveCorretor()?.cidade || 'Balneário Camboriú');
  const [bairro, setBairro] = useState('');

  // 3. Tipo de imóvel, Status, Negócio e Valor
  const [tipoImovel, setTipoImovel] = useState<PropertyTypeOption | ''>('Apartamento');
  const [statusImovel, setStatusImovel] = useState<'Na planta' | 'Mobiliado' | 'Sem mobília' | ''>('');
  const [tipo, setTipo] = useState<'venda' | 'locação' | 'ambos'>('venda');
  const [valor, setValor] = useState<number | ''>('');
  const [valorLocacao, setValorLocacao] = useState<number | ''>('');

  // 4. Quartos (Dormitórios)
  const [dormitorios, setDormitorios] = useState<number | ''>('');

  // 6. Garagem (Vagas)
  const [vagas, setVagas] = useState<number | ''>('');

  // 7. Número de banheiros
  const [banheiros, setBanheiros] = useState<number | ''>('');

  // 8. Metragem privativa
  const [metragem, setMetragem] = useState<number | ''>('');

  // 9. Nome do edifício e Construtora
  const [nomeEdificio, setNomeEdificio] = useState('');
  const [construtora, setConstrutora] = useState('');

  // 10. Título e Palavra Destacada
  const [titulo, setTitulo] = useState('');
  const [palavraDestacada, setPalavraDestacada] = useState('');

  // 11. Descrição
  const [descricao, setDescricao] = useState('');

  // 12. Informações
  const [informacoes, setInformacoes] = useState('');

  // 12. Preferências
  const [favorito, setFavorito] = useState(false);
  const [website, setWebsite] = useState<'SIM' | 'NAO'>('SIM');
  const [compartilhar, setCompartilhar] = useState<'SIM' | 'NAO'>('SIM');

  // 13. Dados do proprietário
  const [nomeProprietario, setNomeProprietario] = useState('');
  const [telefoneProprietario, setTelefoneProprietario] = useState('');

  // Loading & error states
  const [aiLoading, setAiLoading] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Drag and drop states for photo reordering
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const [dragOverPhotoIndex, setDragOverPhotoIndex] = useState<number | null>(null);

  // Conditional mandatory status check: Terreno or Comercial makes bedrooms, building name and garage optional
  const isLandOrCommercial = tipoImovel === 'Terreno' || tipoImovel === 'Comercial';

  // Lista de construtoras já cadastradas no sistema para autocomplete e verificação
  const construtorasCadastradas = useMemo(() => {
    const list = DbService.getImoveisSync()
      .map(i => i.construtora?.trim())
      .filter((c): c is string => Boolean(c));
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, []);

  const construtoraExiste = useMemo(() => {
    if (!construtora.trim()) return false;
    const cleanInput = construtora.trim().toLowerCase();
    return construtorasCadastradas.some(c => c.toLowerCase() === cleanInput);
  }, [construtora, construtorasCadastradas]);

  useEffect(() => {
    if (imovelId) {
      const imoveis = DbService.getImoveisSync();
      const found = imoveis.find(i => i.id === imovelId);
      if (found) {
        setFotos(found.fotos || []);
        setCep(found.cep || '');
        setLocalizacao(found.localizacao || '');
        setCidade(found.cidade || DbService.getActiveCorretor()?.cidade || 'Balneário Camboriú');
        setBairro(found.bairro || '');
        setTipoImovel((found.tipoImovel as PropertyTypeOption) || 'Apartamento');
        setStatusImovel((found.statusImovel as any) || '');
        const isLocacaoOnly = found.tipo === 'locação' || (found.valorLocacao && !found.valorVenda && (!found.valor || found.valor === found.valorLocacao));
        const currentTipo = isLocacaoOnly ? 'locação' : 'venda';
        setTipo(currentTipo);

        const salePrice = found.valorVenda || (!isLocacaoOnly && found.valor && found.valor !== found.valorLocacao ? found.valor : '');
        setValor(salePrice || '');
        setValorLocacao(found.valorLocacao || '');
        setDormitorios(found.dormitorios ?? '');
        setVagas(found.vagas ?? '');
        setBanheiros(found.banheiros ?? '');
        setMetragem(found.metragem ?? '');
        setNomeEdificio(found.nomeEdificio || '');
        setConstrutora(found.construtora || '');
        setTitulo(found.titulo || '');
        setPalavraDestacada(found.palavraDestacada || '');
        setDescricao(found.descricao || '');
        setInformacoes(found.informacoes || '');
        setFavorito(found.favorito || false);
        setWebsite(found.website === 'NAO' ? 'NAO' : 'SIM');
        setCompartilhar(found.compartilhar === 'NAO' || (found.compartilhar as any) === false ? 'NAO' : 'SIM');
        const rawN = found.nomeProprietario?.trim() || '';
        const rawP = found.telefoneProprietario?.trim() || '';
        const rawD = found.dadosProprietario?.trim() || '';

        const combined = [rawN, rawP, rawD].filter(Boolean).join(' ');
        const phoneRegex = /(?:\+?55\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
        const matches = Array.from(combined.matchAll(phoneRegex));

        let cleanP = '';
        if (matches.length > 0) {
          const bestMatch = matches.reduce((best, cur) => {
            const curDigits = cur[0].replace(/\D/g, '');
            const bestDigits = best.replace(/\D/g, '');
            return curDigits.length >= bestDigits.length ? cur[0] : best;
          }, matches[0][0]);

          if (bestMatch.replace(/\D/g, '').length >= 8) {
            cleanP = bestMatch.trim();
          }
        }

        if (!cleanP && rawP) {
          if (rawP.replace(/\D/g, '').length >= 8) {
            cleanP = rawP.trim();
          }
        }

        let nameSource = rawN;
        if (!nameSource || (cleanP && nameSource.replace(/\D/g, '') === cleanP.replace(/\D/g, ''))) {
          nameSource = rawD;
        }
        if (!nameSource || (cleanP && nameSource.replace(/\D/g, '') === cleanP.replace(/\D/g, ''))) {
          nameSource = rawP;
        }

        let cleanN = nameSource;
        if (cleanP) {
          cleanN = cleanN.replace(cleanP, '');
        }
        cleanN = cleanN.replace(/(?:\+?55\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g, '');
        cleanN = cleanN.replace(/^[\s\-:/|.,;]+|[\s\-:/|.,;]+$/g, '').trim();

        if (cleanN) {
          const chunks = cleanN.split(/[\-/|,]|\s+-\s+/).map(c => c.trim()).filter(Boolean);
          const uniqueChunks: string[] = [];
          for (const chunk of chunks) {
            if (!uniqueChunks.some(u => u.toLowerCase() === chunk.toLowerCase())) {
              uniqueChunks.push(chunk);
            }
          }
          cleanN = uniqueChunks.join(' - ');
        }

        setNomeProprietario(cleanN);
        setTelefoneProprietario(cleanP);
      }
    }
  }, [imovelId]);

  // Handle Autocomplete Address (CEP, Cidade, Bairro, Endereço)
  const handleAutocomplete = async () => {
    if (!localizacao.trim()) {
      setErrorMsg('Escreva uma localização (rua, avenida ou ponto de referência) primeiro para autocompletar.');
      return;
    }
    setErrorMsg('');
    setAutocompleteLoading(true);

    try {
      const query = `${localizacao.trim()}, ${cidade || DbService.getActiveCorretor().cidade}, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=br&limit=1&q=${encodeURIComponent(query)}`);
      
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const addr = results[0].address;
          const detectedBairro = addr.suburb || addr.neighbourhood || addr.residential || addr.district || addr.quarter || 'Centro';
          const detectedCidade = addr.city || addr.town || addr.municipality || addr.village || cidade || DbService.getActiveCorretor().cidade;
          const detectedPostcode = addr.postcode ? addr.postcode.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
          const detectedRoad = addr.road || addr.pedestrian || addr.street;

          if (detectedBairro) setBairro(detectedBairro);
          if (detectedCidade) setCidade(detectedCidade);
          if (detectedPostcode && !cep) setCep(detectedPostcode);
          if (detectedRoad && (!localizacao || localizacao.length < detectedRoad.length)) {
            setLocalizacao(detectedRoad);
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar autocomplete via geocoding:', err);
    } finally {
      const text = localizacao.toLowerCase();
      let detectedBairro = bairro || 'Centro';
      let detectedCidade = cidade || DbService.getActiveCorretor().cidade;
      let detectedEdificio = '';

      if (text.includes('barra sul') || text.includes('atlântica 4000') || text.includes('atlântica 5000')) {
        detectedBairro = 'Centro - Barra Sul';
        detectedEdificio = 'Yachthouse Residence';
      } else if (text.includes('pioneiros') || text.includes('atlântica 100') || text.includes('atlântica 500')) {
        detectedBairro = 'Pioneiros';
        detectedEdificio = 'Infinity Coast';
      } else if (text.includes('itapema') || text.includes('meia praia')) {
        detectedCidade = 'Itapema';
        detectedBairro = 'Meia Praia';
      }

      if (detectedCidade) setCidade(detectedCidade);
      if (detectedBairro) setBairro(detectedBairro);
      if (detectedEdificio && !nomeEdificio && !isLandOrCommercial) {
        setNomeEdificio(detectedEdificio);
      }
      setAutocompleteLoading(false);
    }
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
          const formattedCep = raw.replace(/^(\d{5})(\d{3})$/, '$1-$2');
          setCep(formattedCep);
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
        modalidade: tipo,
        tipoImovel: tipoImovel || 'Imóvel',
        titulo: titulo || nomeEdificio || 'Imóvel Exclusivo',
        localizacao: localizacao || cidade,
        nomeEdificio: nomeEdificio,
        dormitorios: dormitorios !== '' ? Number(dormitorios) : undefined,
        vagas: vagas !== '' ? Number(vagas) : undefined,
        banheiros: banheiros !== '' ? Number(banheiros) : undefined,
        metragem: metragem !== '' ? Number(metragem) : undefined,
        valor: valor !== '' ? Number(valor) : undefined,
      });

      setDescricao(improved.replace(/\*/g, ''));
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao conectar com a IA. Tente novamente.');
    } finally {
      setAiLoading(false);
    }
  };

  // Image Compression helper
  const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.65): Promise<string> => {
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

    if (fotos.length >= 20) {
      setErrorMsg('Você já atingiu o limite máximo de 20 fotos por imóvel.');
      e.target.value = '';
      return;
    }

    const availableSlots = 20 - fotos.length;
    const filesToUpload: File[] = (Array.from(files) as File[]).slice(0, availableSlots);

    if (files.length > availableSlots) {
      setErrorMsg(`Foram selecionadas ${availableSlots} foto(s) para respeitar o limite máximo de 20.`);
    }

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        const compressedBase64 = await compressImage(file);
        setFotos((prev) => {
          if (prev.length < 20 && !prev.includes(compressedBase64)) {
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
              if (prev.length < 20 && !prev.includes(resultStr)) {
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

  const handleMovePhotoLeft = (index: number) => {
    if (index <= 0) return;
    setFotos(prev => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMovePhotoRight = (index: number) => {
    if (index >= fotos.length - 1) return;
    setFotos(prev => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleSetPrimaryPhoto = (index: number) => {
    if (index <= 0) return;
    setFotos(prev => {
      const selected = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [selected, ...rest];
    });
  };

  // Drag and drop photo reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedPhotoIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPhotoIndex !== index) {
      setDragOverPhotoIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverPhotoIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedPhotoIndex !== null && draggedPhotoIndex !== targetIndex) {
      setFotos(prev => {
        const copy = [...prev];
        const [moved] = copy.splice(draggedPhotoIndex, 1);
        copy.splice(targetIndex, 0, moved);
        return copy;
      });
    }
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 1. Fotos validation
    if (fotos.length === 0) {
      setErrorMsg('Adicione pelo menos uma foto ao imóvel.');
      return;
    }

    if (fotos.length > 20) {
      setErrorMsg('O limite máximo é de 20 fotos por imóvel.');
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

    // Valor validation based on business type
    const numValor = valor !== '' && valor !== null && !isNaN(Number(valor)) ? Number(valor) : 0;
    const numValorLocacao = valorLocacao !== '' && valorLocacao !== null && !isNaN(Number(valorLocacao)) ? Number(valorLocacao) : 0;

    let finalTipo: 'venda' | 'locação' | 'ambos' = tipo;

    if (numValor <= 0 && numValorLocacao <= 0) {
      setErrorMsg('É obrigatório preencher o valor de Venda ou o valor de Locação. Se o valor de Venda estiver em branco, o valor de Locação é obrigatório (e vice-versa).');
      return;
    }

    if (numValor > 0 && numValorLocacao > 0) {
      finalTipo = 'ambos';
    } else if (numValor > 0) {
      finalTipo = 'venda';
    } else if (numValorLocacao > 0) {
      finalTipo = 'locação';
    }

    // 4. Quartos validation (conditional)
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

    // 12. Status do imóvel validation
    if (!statusImovel) {
      setErrorMsg('Status do imóvel (Na planta, Mobiliado, Sem mobília) é obrigatório.');
      return;
    }

    setIsSaving(true);

    const activeCorretor = DbService.getActiveCorretor();
    if (!activeCorretor && !auth.currentUser) {
      setErrorMsg('Você precisa estar logado para salvar um imóvel.');
      setIsSaving(false);
      return;
    }

    const activeEmail = (activeCorretor?.email || auth.currentUser?.email || '').toLowerCase().trim();
    const activeId = activeCorretor?.id || auth.currentUser?.uid || `broker-${activeEmail.replace(/[^a-z0-9]/g, '_')}`;
    const activeNome = activeCorretor?.nome || auth.currentUser?.displayName || (activeEmail ? activeEmail.split('@')[0] : 'Corretor');

    // Calculate valorAnterior if price was lowered during edit
    let valorAnteriorCalculado: number | undefined = undefined;
    let valorLocacaoAnteriorCalculado: number | undefined = undefined;

    const existingImovel = imovelId ? DbService.getImoveisSync().find(i => i.id === imovelId) : undefined;

    if (existingImovel) {
      const targetValor = numValor > 0 ? numValor : numValorLocacao;
      const previousBaseValor = existingImovel.valorAnterior || existingImovel.valor;
      if (targetValor > 0 && previousBaseValor > 0 && targetValor < previousBaseValor) {
        valorAnteriorCalculado = previousBaseValor;
      } else if (targetValor >= previousBaseValor) {
        valorAnteriorCalculado = undefined;
      }

      if (numValorLocacao > 0) {
        const previousLocBase = existingImovel.valorLocacaoAnterior || existingImovel.valorLocacao;
        if (previousLocBase && previousLocBase > 0 && numValorLocacao < previousLocBase) {
          valorLocacaoAnteriorCalculado = previousLocBase;
        } else if (previousLocBase && numValorLocacao >= previousLocBase) {
          valorLocacaoAnteriorCalculado = undefined;
        }
      }
    }

    try {
      const imovelPayload: Imovel = {
        id: imovelId || `imovel-${Date.now()}`,
        corretorEmail: activeEmail,
        corretorId: activeId,
        corretorNome: activeNome,
        titulo: titulo.trim().slice(0, 90),
        palavraDestacada: palavraDestacada.trim().slice(0, 20) || undefined,
        descricao: descricao.trim().slice(0, 6000),
        informacoes: informacoes.trim().slice(0, 200) || undefined,
        valor: numValor > 0 ? numValor : 0,
        valorVenda: numValor > 0 ? numValor : undefined,
        valorAnterior: valorAnteriorCalculado,
        valorLocacao: numValorLocacao > 0 ? numValorLocacao : undefined,
        valorLocacaoAnterior: valorLocacaoAnteriorCalculado,
        tipo: finalTipo,
        tipoImovel: tipoImovel as any,
        statusImovel: statusImovel || undefined,
        cidade,
        bairro: bairro || 'Centro',
        localizacao,
        cep: cep.trim() || undefined,
        nomeEdificio: nomeEdificio.trim() || undefined,
        construtora: construtora.trim() || undefined,
        origem: 'Imobishare',
        nomeProprietario: nomeProprietario.trim(),
        telefoneProprietario: telefoneProprietario.trim(),
        dadosProprietario: [nomeProprietario.trim(), telefoneProprietario.trim()].filter(Boolean).join(' - ') || undefined,
        favorito,
        website,
        compartilhar,
        fotos,
        dormitorios: dormitorios !== '' ? Number(dormitorios) : undefined,
        vagas: vagas !== '' ? Number(vagas) : undefined,
        banheiros: banheiros !== '' ? Number(banheiros) : undefined,
        metragem: metragem !== '' ? Number(metragem) : undefined,
        visibilidade: 'todos',
        dataCadastro: existingImovel?.dataCadastro || new Date().toISOString(),
      };

      imovelPayload.codigo = existingImovel?.codigo || getPropertyCode(imovelPayload);

      const saved = await DbService.saveImovel({
        ...imovelPayload,
        id: imovelId || undefined,
      });

      onSave(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar imóvel.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16" id="property-form-container">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
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
            <span className={`text-[10px] font-bold ${fotos.length >= 20 ? 'text-amber-600' : 'text-slate-400'}`}>
              {fotos.length}/20 {fotos.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
          
          {/* Photos list thumbnail strip with drag and drop reordering */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none">
            {fotos.map((foto, index) => {
              const isBeingDragged = draggedPhotoIndex === index;
              const isDragOver = dragOverPhotoIndex === index;

              return (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border cursor-grab active:cursor-grabbing transition-all duration-150 select-none group ${
                    isBeingDragged
                      ? 'opacity-30 border-dashed border-[#003366] scale-95'
                      : isDragOver
                      ? 'border-[#003366] ring-2 ring-[#003366]/40 scale-105 z-20'
                      : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <img
                    src={getValidImage(foto)}
                    alt={`Foto ${index + 1}`}
                    onError={handleImageError}
                    className="w-full h-full object-cover pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Drag Handle Indicator */}
                  <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                    <GripVertical size={14} className="rotate-90 opacity-80" />
                  </div>

                  {/* Primary Photo Badge */}
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-[#003366] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shadow-xs uppercase tracking-wider flex items-center gap-0.5 z-10">
                      <Star size={9} className="fill-amber-400 text-amber-400" />
                      Principal
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePhoto(index);
                    }}
                    className="absolute top-1 right-1 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-full transition-colors z-10"
                    title="Remover foto"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
            
            {fotos.length === 0 && (
              <div className="w-full h-20 border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 bg-slate-50/50 px-3">
                <ImageIcon size={18} className="text-slate-300" />
                <span className="text-xs text-slate-500">Nenhuma foto anexada. Adicione até 20 fotos.</span>
              </div>
            )}
          </div>

          {/* Prominent Upload Button */}
          {fotos.length < 20 ? (
            <>
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
                <span>Adicionar Fotos ({20 - fotos.length} restante{20 - fotos.length === 1 ? '' : 's'})</span>
              </button>
            </>
          ) : (
            <div className="text-center py-1.5 px-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-semibold">
              Limite máximo de 20 fotos atingido.
            </div>
          )}
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

            <div>
              <span className="text-[10px] text-[#003366] font-bold block mb-0.5 whitespace-nowrap">Status do imóvel *:</span>
              <select
                value={statusImovel}
                onChange={(e) => setStatusImovel(e.target.value as any)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:outline-hidden focus:border-[#003366]"
                required
              >
                <option value="">Selecione o status *</option>
                <option value="Na planta">Na planta</option>
                <option value="Mobiliado">Mobiliado</option>
                <option value="Sem mobília">Sem mobília</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block mb-0.5 whitespace-nowrap">Modalidade de Negócio:</span>
                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setTipo('venda')}
                    className={`py-1.5 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      tipo === 'venda' ? 'bg-white text-[#003366] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Venda
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo('locação')}
                    className={`py-1.5 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      tipo === 'locação' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Locação
                  </button>
                </div>
              </div>

              <div>
                {tipo === 'venda' ? (
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block mb-0.5 whitespace-nowrap">
                      Valor de Venda (R$) <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="R$ 0"
                      value={formatNumberWithSeparators(valor)}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/\D/g, '');
                        const newValor = cleanValue === '' ? '' : Number(cleanValue);
                        setValor(newValor);
                      }}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] font-bold text-[#003366] bg-white"
                    />
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block mb-0.5 whitespace-nowrap">
                      Valor de Locação / Mês (R$) <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="R$ 0 /mês"
                      value={formatNumberWithSeparators(valorLocacao)}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/\D/g, '');
                        const newValorLoc = cleanValue === '' ? '' : Number(cleanValue);
                        setValorLocacao(newValorLoc);
                      }}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-700 font-bold text-emerald-800 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Especificações do Imóvel (Quartos, BWC, Vagas, Area Privativa) */}
        <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              4. Especificações do Imóvel <span className="text-rose-500">*</span>
            </label>
            {isLandOrCommercial && (
              <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                Opcional p/ {tipoImovel}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {/* Linha 1: Quartos, BWC, Vagas */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1 whitespace-nowrap">
                  Quartos {!isLandOrCommercial && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Qtd"
                  value={dormitorios}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setDormitorios(clean === '' ? '' : Number(clean));
                  }}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50/50 font-semibold text-center"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1 whitespace-nowrap">
                  BWC <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Qtd"
                  value={banheiros}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setBanheiros(clean === '' ? '' : Number(clean));
                  }}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50/50 font-semibold text-center"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1 whitespace-nowrap">
                  Vagas {!isLandOrCommercial && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Qtd"
                  value={vagas}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setVagas(clean === '' ? '' : Number(clean));
                  }}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50/50 font-semibold text-center"
                />
              </div>
            </div>

            {/* Linha 2: Área Privativa */}
            <div>
              <label className="text-[10px] font-semibold text-slate-600 block mb-1 whitespace-nowrap">
                Área Privativa (m²) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 120"
                  value={metragem}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setMetragem(clean === '' ? '' : Number(clean));
                  }}
                  className="w-full text-xs px-2.5 py-1.5 pr-8 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50/50 font-semibold"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold pointer-events-none">m²</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. EDIFÍCIO */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
              5. EDIFÍCIO {!isLandOrCommercial && <span className="text-rose-500">*</span>}
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

        {/* 6. CONSTRUTORA (opcional) */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
              6. CONSTRUTORA <span className="text-slate-400 font-normal lowercase">(opcional)</span>
            </label>
            {construtoraExiste && (
              <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check size={10} className="text-emerald-700" />
                Construtora cadastrada no sistema
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              list="construtoras-list"
              placeholder="Ex: FG Empreendimentos, Embraed, Pasqualotto..."
              value={construtora}
              onChange={(e) => setConstrutora(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
            />
            <datalist id="construtoras-list">
              {construtorasCadastradas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {construtorasCadastradas.length > 0 && !construtora && (
            <p className="text-[10px] text-slate-400">
              💡 Dica: {construtorasCadastradas.length} construtora{construtorasCadastradas.length > 1 ? 's já cadastradas' : ' já cadastrada'} no sistema. Selecione da lista ou digite uma nova.
            </p>
          )}
        </div>

        {/* 7. DESCRIÇÃO DO IMÓVEL */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
            7. Descrição do Imóvel
          </label>

          {/* Título do Anúncio (90 caracteres) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Título do Anúncio <span className="text-rose-500">*</span>
              </span>
              <span className={`text-[10px] font-bold ${titulo.length >= 90 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}`}>
                {titulo.length}/90
              </span>
            </div>
            <input
              type="text"
              maxLength={90}
              placeholder="Ex: Apartamento Alto Padrão Barra Sul"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, 90))}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366]"
            />
          </div>

          {/* Descrição do Imóvel (6000 caracteres) */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Descrição do Imóvel <span className="text-rose-500">*</span>
              </span>
              
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${descricao.length >= 6000 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}`}>
                  {descricao.length}/6000
                </span>
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
            </div>

            <textarea
              placeholder="Escreva a descrição completa do imóvel aqui... Toque em 'Melhorar com IA' para que o sistema aprimore o texto utilizando os dados cadastrados."
              value={descricao}
              maxLength={6000}
              onChange={(e) => setDescricao(e.target.value.slice(0, 6000))}
              rows={4}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] leading-relaxed"
            />
          </div>

          {/* Palavra Destacada em outra cor (20 caracteres) */}
          <div className="pt-2.5 border-t border-slate-100 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100 space-y-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                Palavra Destacada
              </label>
              <span className={`text-[10px] font-bold ${palavraDestacada.length >= 20 ? 'text-amber-600 font-extrabold' : 'text-indigo-600'}`}>
                {palavraDestacada.length}/20
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                maxLength={20}
                placeholder="Ex: Vista Panorâmica"
                value={palavraDestacada}
                onChange={(e) => setPalavraDestacada(e.target.value.slice(0, 20))}
                className="w-full text-xs px-2.5 py-1.5 border-2 border-indigo-200 bg-white text-indigo-950 font-bold rounded-lg focus:outline-hidden focus:border-indigo-600 placeholder:text-indigo-300"
              />
              {palavraDestacada.trim() && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                  {palavraDestacada.trim()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 8. Preferências */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">8. Preferências do Imóvel</label>
          
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            {/* Favorito */}
            <div className="flex flex-col items-center justify-between text-center bg-slate-50 p-2 rounded-lg border border-slate-100 gap-1.5 min-w-0">
              <div className="flex flex-col items-center min-w-0 w-full">
                <span className="text-[11px] font-bold text-slate-800 leading-tight">⭐ Favorito</span>
                <span className="text-[8px] text-slate-500 font-medium">Destaque</span>
              </div>
              <button
                type="button"
                onClick={() => setFavorito(!favorito)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-hidden cursor-pointer flex-shrink-0 ${
                  favorito ? 'bg-[#003366]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  favorito ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Site (visível no website) */}
            <div className="flex flex-col items-center justify-between text-center bg-slate-50 p-2 rounded-lg border border-slate-100 gap-1.5 min-w-0">
              <div className="flex flex-col items-center min-w-0 w-full">
                <span className="text-[11px] font-bold text-slate-800 leading-tight">🌐 Site</span>
                <span className="text-[8px] text-slate-500 font-medium">No website</span>
              </div>
              <button
                type="button"
                onClick={() => setWebsite(website === 'SIM' ? 'NAO' : 'SIM')}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-hidden cursor-pointer flex-shrink-0 ${
                  website === 'SIM' ? 'bg-[#003366]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  website === 'SIM' ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Compartilhar / Parceria */}
            <div className="flex flex-col items-center justify-between text-center bg-slate-50 p-2 rounded-lg border border-slate-100 gap-1.5 min-w-0">
              <div className="flex flex-col items-center min-w-0 w-full">
                <span className="text-[11px] font-bold text-slate-800 leading-tight">🤝 Parceria</span>
                <span className="text-[8px] text-slate-500 font-medium">Rede parceira</span>
              </div>
              <button
                type="button"
                onClick={() => setCompartilhar(compartilhar === 'SIM' ? 'NAO' : 'SIM')}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-hidden cursor-pointer flex-shrink-0 ${
                  compartilhar === 'SIM' ? 'bg-[#003366]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  compartilhar === 'SIM' ? 'translate-x-4' : 'translate-x-0'
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

        {/* 10. Informações para Corretores */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
              10. Informações
            </label>
            <span className={`text-[10px] font-bold flex-shrink-0 ${informacoes.length >= 200 ? 'text-amber-600 font-extrabold' : 'text-slate-400'}`}>
              {informacoes.length}/200
            </span>
          </div>

          <p className="text-[10px] text-slate-500 leading-snug">
            Visível para todos os corretores
          </p>

          <textarea
            maxLength={200}
            placeholder="Ex: Chave na portaria social, visitas de seg a sex das 9h às 18h, senha da fechadura eletrônica: 1234#"
            value={informacoes}
            onChange={(e) => setInformacoes(e.target.value.slice(0, 200))}
            rows={2}
            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#003366] bg-slate-50/50"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-wider text-[11px] flex items-center justify-center min-h-[44px]"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            imovelId ? 'Atualizar Imóvel' : 'Salvar Imóvel'
          )}
        </button>

      </form>
    </div>
  );
}
