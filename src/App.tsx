/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import logoImg from './assets/images/imobishare_logo_1784239677798.jpg';
import { Imovel, Corretor } from './types';
import { DbService } from './services/db';
import { StoryBubble } from './components/StoryBubble';
import { PropertyCard } from './components/PropertyCard';
import { CompactPropertyRow } from './components/CompactPropertyRow';
import { MapView } from './components/MapView';
import { PropertyForm } from './components/PropertyForm';
import { PropertyDetails } from './components/PropertyDetails';
import { UserProfile } from './components/UserProfile';
import { PublicView } from './components/PublicView';
import { SupportForm } from './components/SupportForm';
import {
  Home as HomeIcon,
  Building,
  PlusCircle,
  User,
  Search,
  SlidersHorizontal,
  Share2,
  CheckCircle,
  MessageCircle,
  Sparkles,
  Award,
  ChevronRight,
  Heart,
  ExternalLink,
  ChevronLeft,
  Smartphone,
  Lock,
  Mail,
  X,
  MapPin,
  Bed,
  Car,
  Maximize
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'home' | 'my-properties' | 'profile' | 'support';

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('imobishare_logged_in') === 'true';
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Registration form states
  const [regNome, setRegNome] = useState('');
  const [regCreci, setRegCreci] = useState('');
  const [regTelefone, setRegTelefone] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regCidade, setRegCidade] = useState('Balneário Camboriú');

  // Core App states
  const [activeCorretor, setActiveCorretor] = useState<Corretor>(DbService.getActiveCorretor());
  const [allImoveis, setAllImoveis] = useState<Imovel[]>(() => DbService.getImoveis());
  const [favoritos, setFavoritos] = useState<string[]>(() => DbService.getFavoritos(DbService.getActiveCorretor().id));
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  
  // Foolproof synchronous public views loading directly from URL
  const [publicViewProperty, setPublicViewProperty] = useState<Imovel | null>(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    let imovelId = params.get('imovel');
    if (!imovelId) {
      const imovelMatch = path.match(/^\/imovel\/([^/]+)/);
      if (imovelMatch) imovelId = imovelMatch[1];
    }
    if (!imovelId) {
      const hashMatch = hash.match(/^#\/imovel\/([^/]+)/);
      if (hashMatch) imovelId = hashMatch[1];
    }

    if (imovelId) {
      const imoveis = DbService.getImoveis();
      const found = imoveis.find(i => 
        i.id === imovelId || 
        i.id === `imovel-${imovelId}` || 
        i.id.replace('imovel-', '') === imovelId
      );
      return found || null;
    }
    return null;
  });

  const [publicSelectionImoveis, setPublicSelectionImoveis] = useState<Imovel[] | null>(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    let imoveisRaw = params.get('selecao') || params.get('imoveis');
    if (!imoveisRaw) {
      const match = path.match(/^\/selecao\/([^/]+)/);
      if (match) imoveisRaw = match[1];
    }
    if (!imoveisRaw) {
      const match = hash.match(/^#\/selecao\/([^/]+)/);
      if (match) imoveisRaw = match[1];
    }

    if (imoveisRaw) {
      const ids = imoveisRaw.split(',');
      const imoveis = DbService.getImoveis();
      const foundList = imoveis.filter(i => 
        ids.includes(i.id) || 
        ids.includes(i.id.replace('imovel-', ''))
      );
      if (foundList.length > 0) return foundList;
    }
    return null;
  });

  // Filters & Search State
  const [searchWord, setSearchWord] = useState('');
  const [filterCidade, setFilterCidade] = useState(() => DbService.getActiveCorretor().cidade);
  const [filterTipo, setFilterTipo] = useState<'comprar' | 'alugar' | 'todos'>('todos');
  const [filterValorMin, setFilterValorMin] = useState<number>(0);
  const [filterValorMax, setFilterValorMax] = useState<number>(15000000);
  const [filterMeusImoveis, setFilterMeusImoveis] = useState(true);
  const [filterOutrosCorretores, setFilterOutrosCorretores] = useState(true);
  const [filterIntegracao, setFilterIntegracao] = useState(true);
  const [searchViewMode, setSearchViewMode] = useState<'como_esta_hoje' | 'lista' | 'mapa'>('como_esta_hoje');

  // Multiple selection state
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');

  // Reload database data helper
  const reloadData = (updateCity = false) => {
    const currentCorretor = DbService.getActiveCorretor();
    setActiveCorretor(currentCorretor);
    setAllImoveis(DbService.getImoveis());
    setFavoritos(DbService.getFavoritos(currentCorretor.id));
    if (updateCity) {
      setFilterCidade(currentCorretor.cidade);
    }
  };

  useEffect(() => {
    // Perform background data synchronization on startup
    DbService.syncWithServer();

    // Subscribe to database background synchronization completes
    const unsubscribe = DbService.subscribe(() => {
      reloadData();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (allImoveis.length === 0) return;

    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // A. Check for single imovel via query param (?imovel=id), hash (#/imovel/id) or pathname (/imovel/id)
    let imovelId = params.get('imovel');
    
    if (!imovelId) {
      const imovelMatch = path.match(/^\/imovel\/([^/]+)/);
      if (imovelMatch) {
        imovelId = imovelMatch[1];
      }
    }
    
    if (!imovelId) {
      const hashMatch = hash.match(/^#\/imovel\/([^/]+)/);
      if (hashMatch) {
        imovelId = hashMatch[1];
      }
    }

    if (imovelId) {
      const found = allImoveis.find(i => 
        i.id === imovelId || 
        i.id === `imovel-${imovelId}` || 
        i.id.replace('imovel-', '') === imovelId
      );
      if (found) {
        setPublicViewProperty(found);
      }
      return;
    }

    // B. Check for multi imoveis selection via query param (?selecao=id1,id2), pathname (/selecao?imoveis=...) or hash (#/selecao?...)
    let imoveisRaw = params.get('selecao') || params.get('imoveis');
    
    if (!imoveisRaw && path === '/selecao') {
      imoveisRaw = params.get('imoveis');
    }
    
    if (!imoveisRaw && hash.startsWith('#/selecao')) {
      const hashParams = new URLSearchParams(hash.split('?')[1] || '');
      imoveisRaw = hashParams.get('selecao') || hashParams.get('imoveis');
    }

    if (imoveisRaw) {
      const ids = imoveisRaw.split(',').map(id => id.trim());
      const selectedList = allImoveis.filter(i => 
        ids.includes(i.id) || 
        ids.includes(i.id.replace('imovel-', ''))
      );
      if (selectedList.length > 0) {
        setPublicSelectionImoveis(selectedList);
      }
    }
  }, [allImoveis]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Toggle Favorite
  const handleFavoriteToggle = (imovelId: string) => {
    const updatedFavs = DbService.toggleFavorite(activeCorretor.id, imovelId);
    setFavoritos(updatedFavs);
    
    const imoveis = DbService.getImoveis();
    const isFavNow = updatedFavs.includes(imovelId);
    triggerToast(isFavNow ? 'Imóvel adicionado aos favoritos!' : 'Imóvel removido dos favoritos.');
  };

  // Toggle Property Share status
  const handleShareToggle = (imovelId: string) => {
    const imoveis = DbService.getImoveis();
    const found = imoveis.find(i => i.id === imovelId);
    if (found) {
      const updated = DbService.saveImovel({
        ...found,
        compartilhar: !found.compartilhar
      });
      reloadData();
      triggerToast(
        updated.compartilhar 
          ? 'Imóvel compartilhado com a rede de corretores!' 
          : 'Imóvel privado. Apenas você pode visualizar.'
      );
    }
  };

  // Delete property
  const handleDeleteProperty = (imovelId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este imóvel permanentemente?')) {
      DbService.deleteImovel(imovelId);
      setSelectedPropertyIds(prev => prev.filter(id => id !== imovelId));
      reloadData();
      triggerToast('Imóvel excluído com sucesso.');
    }
  };

  // Duplicate property
  const handleDuplicateProperty = (imovelId: string) => {
    const duplicated = DbService.duplicateImovel(imovelId);
    if (duplicated) {
      reloadData();
      triggerToast(`Imóvel duplicado com sucesso: ${duplicated.titulo}`);
    }
  };

  // Google Identity Services and One-Tap loader for Google Sign-In
  useEffect(() => {
    if (isAuthenticated) return;

    // Dynamically load Google Identity Services SDK
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      try {
        const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '1014169992380-mockclientid.apps.googleusercontent.com';
        
        // @ts-ignore
        if (window.google) {
          // @ts-ignore
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              setAuthLoading(true);
              try {
                const res = await fetch('/api/auth/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });
                if (!res.ok) {
                  const errData = await res.json();
                  throw new Error(errData.error || 'Erro na autenticação com o Google.');
                }
                const data = await res.json();
                
                localStorage.setItem('imobishare_logged_in', 'true');
                localStorage.setItem('imobishare_active_corretor', JSON.stringify(data.corretor));
                
                setIsAuthenticated(true);
                triggerToast(`Bem-vindo, ${data.corretor.nome}!`);
                
                // Perform sync
                await DbService.syncWithServer();
                reloadData();
              } catch (error: any) {
                console.error(error);
                triggerToast(error.message || 'Falha no login com Google.');
              } finally {
                setAuthLoading(false);
              }
            }
          });
          
          // @ts-ignore
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-btn-container'),
            { theme: 'outline', size: 'large', width: '100%' }
          );
        }
      } catch (err) {
        console.error('Failed to init Google Sign-In:', err);
      }
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [isAuthenticated]);

  // Real Login Handlers
  const handleSocialLogin = (provider: 'Google' | 'Apple') => {
    // Elegant fallback simulation if client-id is not configured or for Apple
    setAuthLoading(true);
    setTimeout(() => {
      const mockBroker = {
        id: `corretor-mock-${provider.toLowerCase()}`,
        nome: `Corretor Demo ${provider}`,
        email: `demo-${provider.toLowerCase()}@imobishare.com.br`,
        creci: 'CRECI 12345-F',
        telefone: '(47) 99999-9999',
        whatsapp: '47999999999',
        foto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        cidade: 'Balneário Camboriú',
        restringirParceiros: false,
        parceirosEmails: []
      };
      localStorage.setItem('imobishare_logged_in', 'true');
      localStorage.setItem('imobishare_active_corretor', JSON.stringify(mockBroker));
      setIsAuthenticated(true);
      setAuthLoading(false);
      reloadData();
      triggerToast(`Bem-vindo! Logado com sucesso via ${provider} (Demonstração).`);
    }, 1000);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      triggerToast('Por favor, preencha o e-mail e a senha.');
      return;
    }
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'E-mail ou senha incorretos.');
      }
      const data = await response.json();
      localStorage.setItem('imobishare_logged_in', 'true');
      localStorage.setItem('imobishare_active_corretor', JSON.stringify(data.corretor));
      setIsAuthenticated(true);
      triggerToast(`Bem-vindo, ${data.corretor.nome}!`);
      
      // Sync DB background
      await DbService.syncWithServer();
      reloadData();
    } catch (err: any) {
      triggerToast(err.message || 'Falha na autenticação.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNome || !authEmail || !authPassword) {
      triggerToast('Nome, e-mail e senha são obrigatórios.');
      return;
    }
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: regNome,
          email: authEmail,
          password: authPassword,
          creci: regCreci,
          telefone: regTelefone,
          whatsapp: regWhatsapp,
          cidade: regCidade
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao registrar.');
      }
      const data = await response.json();
      localStorage.setItem('imobishare_logged_in', 'true');
      localStorage.setItem('imobishare_active_corretor', JSON.stringify(data.corretor));
      setIsAuthenticated(true);
      setAuthMode('login'); // Switch back to login mode for future entries
      triggerToast(`Cadastro realizado! Bem-vindo, ${data.corretor.nome}!`);
      
      // Sync DB background
      await DbService.syncWithServer();
      reloadData();
    } catch (err: any) {
      triggerToast(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('imobishare_logged_in');
    localStorage.removeItem('imobishare_active_corretor');
    setIsAuthenticated(false);
    triggerToast('Sessão encerrada com sucesso.');
  };

  // Filter properties based on current filters and search word
  const getFilteredImoveis = () => {
    return allImoveis.filter((imovel) => {
      // 1. Text keyword search (title, description, neighborhood, building)
      if (searchWord.trim()) {
        const query = searchWord.toLowerCase();
        const matchesQuery = 
          imovel.titulo.toLowerCase().includes(query) ||
          imovel.descricao.toLowerCase().includes(query) ||
          imovel.bairro.toLowerCase().includes(query) ||
          (imovel.nomeEdificio && imovel.nomeEdificio.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // 2. City Filter
      if (filterCidade && imovel.cidade !== filterCidade) {
        return false;
      }

      // 3. Purchase/Rent Filter
      if (filterTipo === 'comprar' && imovel.tipo !== 'venda') return false;
      if (filterTipo === 'alugar' && imovel.tipo !== 'locação') return false;

      // 4. Value Slider range
      if (imovel.valor < filterValorMin || imovel.valor > filterValorMax) return false;

      // 5. Broker Ownership / Integration Filter
      const isMine = imovel.corretorId === activeCorretor.id;
      const isIntegrated = imovel.integrado === true;

      if (isIntegrated) {
        if (!filterIntegracao) return false;
      } else if (isMine) {
        // If it's mine, check "Meus imóveis" switch
        if (!filterMeusImoveis) return false;
      } else {
        // If it belongs to someone else, check "Outros corretores" switch
        if (!filterOutrosCorretores) return false;
        // Also must be SHARED to be visible to others
        if (!imovel.compartilhar) return false;

        // --- PARTNER GROUP EXCLUSIVITY RESTRICTION ---
        // Find owner broker's settings
        const owner = DbService.getCorretores().find(c => c.id === imovel.corretorId);
        if (owner && owner.restringirParceiros) {
          const partners = owner.parceirosEmails || [];
          if (partners.length > 0) {
            const activeEmail = (activeCorretor.email || '').toLowerCase().trim();
            const hasAccess = partners.some(p => p.toLowerCase().trim() === activeEmail);
            if (!hasAccess) {
              return false;
            }
          }
        }
      }

      return true;
    });
  };

  // Check which properties are stories (registered within 24h by others and shared)
  const getStoryImoveis = () => {
    return allImoveis.filter((imovel) => {
      const hours = (Date.now() - new Date(imovel.dataCadastro).getTime()) / (1000 * 60 * 60);
      const isEligible = hours <= 24 && imovel.corretorId !== activeCorretor.id && imovel.compartilhar;
      if (!isEligible) return false;

      // Check partner restriction
      const owner = DbService.getCorretores().find(c => c.id === imovel.corretorId);
      if (owner && owner.restringirParceiros) {
        const partners = owner.parceirosEmails || [];
        if (partners.length > 0) {
          const activeEmail = (activeCorretor.email || '').toLowerCase().trim();
          const hasAccess = partners.some(p => p.toLowerCase().trim() === activeEmail);
          if (!hasAccess) return false;
        }
      }

      return true;
    });
  };

  // Check favorite properties of the active broker
  const getFavoriteImoveis = () => {
    // Return all properties where id is in the active broker's favorite array
    // AND is either mine, OR belongs to someone else but is shared.
    return allImoveis.filter((imovel) => {
      const isFav = favoritos.includes(imovel.id);
      if (!isFav) return false;

      const isMine = imovel.corretorId === activeCorretor.id;
      if (isMine) return true;
      if (!imovel.compartilhar) return false;

      // Check partner restriction
      const owner = DbService.getCorretores().find(c => c.id === imovel.corretorId);
      if (owner && owner.restringirParceiros) {
        const partners = owner.parceirosEmails || [];
        if (partners.length > 0) {
          const activeEmail = (activeCorretor.email || '').toLowerCase().trim();
          const hasAccess = partners.some(p => p.toLowerCase().trim() === activeEmail);
          if (!hasAccess) return false;
        }
      }

      return true;
    });
  };

  // Multi-Selection Actions
  const handleSelectToggle = (imovelId: string) => {
    setSelectedPropertyIds((prev) => {
      if (prev.includes(imovelId)) {
        return prev.filter(id => id !== imovelId);
      } else {
        return [...prev, imovelId];
      }
    });
  };

  const handleShareMultiple = () => {
    if (selectedPropertyIds.length === 0) return;
    
    const selectedList = allImoveis.filter(i => selectedPropertyIds.includes(i.id));
    const listItems = selectedList.map(i => {
      const location = i.nomeEdificio?.trim() ? `${i.nomeEdificio} (${i.bairro})` : i.bairro;
      const preco = i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + (i.tipo === 'locação' ? '/mês' : '');
      const tipo = i.tipo === 'venda' ? 'Venda' : 'Aluguel';
      return `• \`\`\`${location} - R$ ${preco} (${tipo})\`\`\``;
    }).join('\n\n');
    
    const idsJoined = selectedPropertyIds.map(id => id.replace('imovel-', '')).join(',');
    
    // Create shared multi-link simulated address using query parameters for 100% compatibility
    const multiLink = `${window.location.origin}/?selecao=${idsJoined}`;

    const textMessage = `💼 *Seleção de Imóveis para Você*

Selecionei estes imóveis especiais que combinam com seu perfil:

${listItems}

Toque abaixo para ver fotos e todos os detalhes:
👉 ${multiLink}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`, '_blank', 'noopener,noreferrer');
    triggerToast('Compartilhando seleção múltipla via WhatsApp!');
    setSelectedPropertyIds([]); // Clear selection after share
  };

  const formatPriceBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Active property for detail view
  const activeDetailProperty = allImoveis.find(i => i.id === selectedPropertyId);

  // If user is opening simulated public page
  if (publicViewProperty) {
    return (
      <PublicView 
        imovel={publicViewProperty} 
        onExit={() => setPublicViewProperty(null)} 
      />
    );
  }

  // If user is opening a shared selection of properties
  if (publicSelectionImoveis) {
    return (
      <div className="bg-slate-50 min-h-screen pb-16 font-sans">
        {/* Brand logo bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-4 flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-1.5 text-[#003366] font-bold text-sm">
            <HomeIcon size={18} />
            <span>ImobiPortal</span>
          </div>
          <button 
            onClick={() => setPublicSelectionImoveis(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
          >
            Entrar no App
          </button>
        </div>

        <div className="max-w-md mx-auto p-4 space-y-4">
          <div className="text-center py-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#003366] bg-[#003366]/5 px-2.5 py-1 rounded-full">
              Seleção Exclusiva
            </span>
            <h1 className="text-lg font-black text-slate-800 pt-1">Imóveis Escolhidos para Você</h1>
            <p className="text-xs text-slate-400">Clique em qualquer imóvel para ver fotos, detalhes e falar conosco pelo WhatsApp.</p>
          </div>

          <div className="space-y-3.5">
            {publicSelectionImoveis.map((imovel) => (
              <div 
                key={imovel.id}
                onClick={() => setPublicViewProperty(imovel)}
                className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs hover:shadow-sm hover:border-[#003366]/35 transition-all flex flex-row p-2 gap-2.5 cursor-pointer"
              >
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-50">
                  <img
                    src={imovel.fotos[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&auto=format&fit=crop&q=80'}
                    alt={imovel.titulo}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute top-1 left-1 text-[7px] font-black uppercase tracking-wider text-white px-1 py-0.5 rounded-sm shadow-xs ${
                    imovel.tipo === 'venda' ? 'bg-[#003366]' : 'bg-emerald-700'
                  }`}>
                    {imovel.tipo === 'venda' ? 'Comprar' : 'Alugar'}
                  </span>
                </div>

                <div className="flex-grow min-w-0 flex flex-col justify-between h-20 sm:h-24 py-0.5">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate tracking-tight leading-tight">
                      {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
                    </h3>
                    <div className="flex items-center text-slate-400 text-[10px] mt-0.5 font-medium truncate">
                      <MapPin size={10} className="mr-0.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{imovel.bairro}, {imovel.cidade}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 text-[9px] mt-1 bg-slate-50 py-0.5 px-2 rounded-lg border border-slate-100/60 w-fit font-bold">
                      <span className="flex items-center gap-0.5">
                        <Bed size={10} className="text-slate-400 flex-shrink-0" />
                        <span>{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-0.5">
                        <Car size={10} className="text-slate-400 flex-shrink-0" />
                        <span>{imovel.vagas ?? 0} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-0.5">
                        <Maximize size={10} className="text-slate-400 flex-shrink-0" />
                        <span>{imovel.metragem ?? 0} m²</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100/60 pt-1 mt-1">
                    <span className="font-extrabold text-[#003366] text-xs sm:text-sm leading-tight">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(imovel.valor)}
                      {imovel.tipo === 'locação' && <span className="text-[9px] font-normal text-slate-500"> /mês</span>}
                    </span>
                    <span className="text-[9px] font-bold text-[#003366] hover:underline flex items-center gap-0.5">
                      Detalhes <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!isAuthenticated) {
    return (
      <div className="bg-[#0F172A] min-h-screen flex flex-col justify-center items-center px-4 font-sans select-none" id="auth-screen">
        <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[95dvh] overflow-y-auto">
          <div className="text-center space-y-1">
            <img
              src={logoImg}
              alt="ImobiShare Logo"
              className="mx-auto w-14 h-14 object-contain rounded-2xl border border-slate-100 shadow-sm"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-xl font-black text-[#003366] tracking-tight uppercase animate-pulse">ImobiShare</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              {authMode === 'login' ? 'Acelere suas parcerias imobiliárias' : 'Crie sua conta profissional'}
            </p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Corporativo</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="corretor@empresa.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Senha de Acesso</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase"
              >
                {authLoading ? 'Conectando...' : 'Entrar com E-mail'}
              </button>

              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="text-xs text-[#003366] hover:underline font-bold"
                >
                  Não tem conta? Cadastre-se grátis
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do Corretor"
                  value={regNome}
                  onChange={(e) => setRegNome(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Profissional</label>
                <input
                  type="email"
                  required
                  placeholder="seuemail@empresa.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CRECI</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 12345-F"
                    value={regCreci}
                    onChange={(e) => setRegCreci(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(47) 99999-9999"
                    value={regTelefone}
                    onChange={(e) => setRegTelefone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="Somente números"
                    value={regWhatsapp}
                    onChange={(e) => setRegWhatsapp(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sua Cidade de Atuação</label>
                <select
                  value={regCidade}
                  onChange={(e) => setRegCidade(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                >
                  <option value="Balneário Camboriú">Balneário Camboriú</option>
                  <option value="Itapema">Itapema</option>
                  <option value="Itajaí">Itajaí</option>
                  <option value="Porto Belo">Porto Belo</option>
                  <option value="Florianópolis">Florianópolis</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase mt-1"
              >
                {authLoading ? 'Registrando...' : 'Criar Conta Profissional'}
              </button>

              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-[#003366] hover:underline font-bold"
                >
                  Já tem uma conta? Faça login
                </button>
              </div>
            </form>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-2 text-[8px] font-bold uppercase tracking-widest text-slate-400">Ou use login rápido</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="space-y-2.5">
            {/* Native official Google login button container */}
            <div id="google-signin-btn-container" className="w-full flex justify-center py-0.5"></div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSocialLogin('Google')}
                disabled={authLoading}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="text-red-500 font-extrabold font-sans">G</span> Google (Demo)
              </button>
              <button
                onClick={() => handleSocialLogin('Apple')}
                disabled={authLoading}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="text-black font-extrabold font-sans"></span> Apple
              </button>
            </div>
          </div>

          <div className="text-center pt-1">
            <p className="text-[9px] text-slate-400">Balneário Camboriú • Itapema • Região Marítima</p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP VIEW WRAPPER (Device framed / Responsive container) ---
  return (
    <div className="min-h-screen bg-[#E5E7EB] flex flex-col justify-center items-center py-0 md:py-6" id="app-viewport">
      
      {/* Device wrapper mockup styled like the ConnectImobi Artistic Flair mockup */}
      <div className="w-full h-[100dvh] md:w-[375px] md:h-[768px] bg-white md:rounded-[44px] md:border-[10px] md:border-[#0F172A] md:shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Toast Toast alerts */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 z-50 bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-lg flex items-center justify-between gap-2"
            >
              <p className="text-xs font-medium leading-tight">{toastMessage}</p>
              <button onClick={() => setToastMessage('')} className="p-1 hover:bg-white/10 rounded-full">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Inner screens navigation */}
        <div className={`flex-grow overflow-y-auto ${
          activeTab === 'home' && !isAddingProperty && !selectedPropertyId 
            ? (selectedPropertyIds.length > 0 ? 'pb-40' : 'pb-32') 
            : 'pb-20'
        }`}>
          
          {isAddingProperty ? (
            /* ADD / EDIT PROPERTY FORM */
            <PropertyForm
              imovelId={editingPropertyId}
              onSave={(saved) => {
                reloadData();
                setIsAddingProperty(false);
                setEditingPropertyId(null);
                triggerToast(editingPropertyId ? 'Imóvel atualizado com sucesso!' : 'Novo imóvel cadastrado em tempo real!');
              }}
              onCancel={() => {
                setIsAddingProperty(false);
                setEditingPropertyId(null);
              }}
            />
          ) : activeDetailProperty ? (
            /* DETAILED VIEW SCREEN */
            <PropertyDetails
              imovel={activeDetailProperty}
              activeCorretor={activeCorretor}
              onBack={() => setSelectedPropertyId(null)}
            />
          ) : (
            /* CORE TABS ROUTING (HOME, MY PROPERTIES, PROFILE) */
            <>
              {activeTab === 'home' && (
                <div className="space-y-4" id="home-tab-view">
                  {/* Instagram-inspired Top Bar with Artistic Flair styles */}
                  <div className="px-5 pt-6 pb-4 bg-white flex justify-between items-center border-b border-gray-100 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <img
                        src={logoImg}
                        alt="ImobiShare Logo"
                        className="w-7 h-7 object-contain rounded-lg border border-slate-100/50 shadow-xs"
                        referrerPolicy="no-referrer"
                      />
                      <h1 className="text-[#003366] text-base font-black tracking-tight uppercase leading-none">ImobiShare</h1>
                    </div>
                    <div className="flex gap-2.5 items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs shadow-xs" title="Notificações ativas">
                        🔔
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#003366] flex items-center justify-center text-white text-[10px] font-bold shadow-sm" title={`Logado como ${activeCorretor.nome}`}>
                        {activeCorretor.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* STORIES CAROUSEL: "New listings from other brokers" */}
                  {getStoryImoveis().length > 0 && (
                    <div className="bg-white py-3 border-b border-slate-100">
                      <div className="px-4 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Novidades das Últimas 24h</span>
                      </div>
                      <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none pb-1">
                        {getStoryImoveis().map((imovel) => (
                          <StoryBubble
                            key={imovel.id}
                            imovel={imovel}
                            corretor={DbService.getCorretores().find(c => c.id === imovel.corretorId)}
                            onClick={() => setSelectedPropertyId(imovel.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FAVORITES CAROUSEL */}
                  {getFavoriteImoveis().length > 0 && (
                    <div className="space-y-2 px-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Heart size={11} className="text-rose-500 fill-rose-500" />
                        Seus Favoritos
                      </span>
                      
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {getFavoriteImoveis().map((imovel) => (
                          <motion.div
                            whileTap={{ scale: 0.98 }}
                            key={imovel.id}
                            onClick={() => setSelectedPropertyId(imovel.id)}
                            className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs flex-shrink-0 w-44 cursor-pointer hover:border-[#003366]/40 transition-all"
                          >
                            <div className="h-24 w-full bg-slate-100 relative">
                              <img src={imovel.fotos[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-[8px] font-black uppercase text-white px-1.5 py-0.5 rounded">
                                {imovel.bairro}
                              </span>
                            </div>
                            <div className="p-3 space-y-1">
                              <h4 className="font-bold text-slate-900 text-xs truncate tracking-tight">{imovel.titulo}</h4>
                              <span className="text-[#003366] font-black text-xs">{formatPriceBRL(imovel.valor)}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEARCH AREA */}
                  <div className="bg-white border-y border-gray-100 p-5 space-y-4">
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar por título, condomínio, bairro..."
                        value={searchWord}
                        onChange={(e) => setSearchWord(e.target.value)}
                        className="w-full text-xs pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:border-[#003366] focus:ring-1 focus:ring-[#003366]/20 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Cidade Selection */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cidade</span>
                        <select
                          value={filterCidade}
                          onChange={(e) => setFilterCidade(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden text-xs font-semibold text-slate-700"
                        >
                          <option value="Balneário Camboriú">Balneário Camboriú</option>
                          <option value="Itapema">Itapema</option>
                        </select>
                      </div>

                      {/* Tipo Negócio Selector */}
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tipo de Filtro</span>
                        <div className="grid grid-cols-3 gap-0.5 bg-gray-100 p-1 rounded-xl text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setFilterTipo('todos')}
                            className={`py-1.5 rounded-lg transition-all ${filterTipo === 'todos' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500'}`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterTipo('comprar')}
                            className={`py-1.5 rounded-lg transition-all ${filterTipo === 'comprar' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500'}`}
                          >
                            Venda
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterTipo('alugar')}
                            className={`py-1.5 rounded-lg transition-all ${filterTipo === 'alugar' ? 'bg-white text-[#003366] shadow-sm' : 'text-gray-500'}`}
                          >
                            Aluguel
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Valor Slider range - Side by Side */}
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* Valor Mínimo */}
                      <div className="space-y-1.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Mínimo</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[10px] sm:text-xs font-bold text-[#003366] pointer-events-none">R$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={filterValorMin === 0 ? '' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(filterValorMin)}
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                const cleanValue = rawValue.replace(/\D/g, '');
                                const valNum = cleanValue === '' ? 0 : Number(cleanValue);
                                setFilterValorMin(valNum);
                              }}
                              placeholder="0"
                              className="w-full text-xs font-extrabold text-[#003366] pl-7 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#003366] shadow-2xs"
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="15000000"
                          step="50000"
                          value={filterValorMin}
                          onChange={(e) => setFilterValorMin(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#003366]"
                        />
                      </div>

                      {/* Valor Máximo */}
                      <div className="space-y-1.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Máximo</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[10px] sm:text-xs font-bold text-[#003366] pointer-events-none">R$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={filterValorMax === 0 ? '' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(filterValorMax)}
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                const cleanValue = rawValue.replace(/\D/g, '');
                                const valNum = cleanValue === '' ? 0 : Number(cleanValue);
                                setFilterValorMax(valNum);
                              }}
                              placeholder="15.000.000"
                              className="w-full text-xs font-extrabold text-[#003366] pl-7 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-[#003366] shadow-2xs"
                            />
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="15000000"
                          step="50000"
                          value={filterValorMax}
                          onChange={(e) => setFilterValorMax(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#003366]"
                        />
                      </div>
                    </div>

                    {/* Meus Imóveis, Parcerias and Integração Checkbox switches */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-3 pt-3 border-t border-gray-100 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1 min-w-0">
                        <input
                          type="checkbox"
                          id="chk-meus-imoveis"
                          checked={filterMeusImoveis}
                          onChange={(e) => setFilterMeusImoveis(e.target.checked)}
                          className="w-3.5 h-3.5 text-[#003366] accent-[#003366] border-slate-300 rounded focus:ring-[#003366] cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor="chk-meus-imoveis" className="font-bold text-slate-700 cursor-pointer truncate">
                          Meus imóveis
                        </label>
                      </div>

                      <div className="flex items-center gap-1 min-w-0">
                        <input
                          type="checkbox"
                          id="chk-outros-corretores"
                          checked={filterOutrosCorretores}
                          onChange={(e) => setFilterOutrosCorretores(e.target.checked)}
                          className="w-3.5 h-3.5 text-[#003366] accent-[#003366] border-slate-300 rounded focus:ring-[#003366] cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor="chk-outros-corretores" className="font-bold text-slate-700 cursor-pointer truncate">
                          Parcerias
                        </label>
                      </div>

                      <div className="flex items-center gap-1 min-w-0">
                        <input
                          type="checkbox"
                          id="chk-integracoes"
                          checked={filterIntegracao}
                          onChange={(e) => setFilterIntegracao(e.target.checked)}
                          className="w-3.5 h-3.5 text-amber-500 accent-amber-500 border-slate-300 rounded focus:ring-amber-500 cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor="chk-integracoes" className="font-bold text-slate-700 cursor-pointer truncate">
                          Integração
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* PROPERTY SEARCH RESULTS LIST */}
                  <div className="px-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Resultado da Busca ({getFilteredImoveis().length})
                      </span>
                      
                      {selectedPropertyIds.length > 0 && (
                        <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md">
                          {selectedPropertyIds.length} selecionados
                        </span>
                      )}
                    </div>



                    <div className="space-y-3">
                      {/* Render based on selected searchViewMode */}
                      {searchViewMode === 'mapa' && getFilteredImoveis().length > 0 ? (
                        <MapView
                          imoveis={getFilteredImoveis()}
                          selectedIds={selectedPropertyIds}
                          onSelectToggle={handleSelectToggle}
                          onViewDetails={setSelectedPropertyId}
                        />
                      ) : (
                        getFilteredImoveis().map((imovel) => {
                          const isMine = imovel.corretorId === activeCorretor.id;
                          const isFav = favoritos.includes(imovel.id);
                          const isSel = selectedPropertyIds.includes(imovel.id);

                          if (searchViewMode === 'lista') {
                            return (
                              <CompactPropertyRow
                                key={imovel.id}
                                imovel={imovel}
                                isMyProperty={isMine}
                                isFavorite={isFav}
                                isSelected={isSel}
                                onSelectToggle={() => handleSelectToggle(imovel.id)}
                                onFavoriteToggle={() => handleFavoriteToggle(imovel.id)}
                                onClick={() => setSelectedPropertyId(imovel.id)}
                              />
                            );
                          }

                          return (
                            <PropertyCard
                              key={imovel.id}
                              imovel={imovel}
                              isMyProperty={isMine}
                              isFavorite={isFav}
                              isSelected={isSel}
                              showCheckbox={true}
                              onSelectToggle={() => handleSelectToggle(imovel.id)}
                              onFavoriteToggle={() => handleFavoriteToggle(imovel.id)}
                              onShareToggle={() => handleShareToggle(imovel.id)}
                              onClick={() => setSelectedPropertyId(imovel.id)}
                            />
                          );
                        })
                      )}

                      {getFilteredImoveis().length === 0 && (
                        <div className="text-center py-10 bg-white border border-slate-100 rounded-xl">
                          <span className="text-xs text-slate-400">Nenhum imóvel encontrado com os filtros selecionados.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'my-properties' && (
                <div className="p-4 space-y-4" id="my-properties-tab-view">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="font-extrabold text-slate-800 text-lg">Meus Imóveis Cadastrados</h2>
                      <p className="text-[10px] text-slate-400">Gerencie, exclua e publique captações exclusivas</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setEditingPropertyId(null);
                        setIsAddingProperty(true);
                      }}
                      className="bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center shadow-lg transition-colors uppercase tracking-wider text-[10px]"
                    >
                      <PlusCircle size={14} className="mr-1.5" /> Novo
                    </button>
                  </div>

                  {/* My properties list */}
                  <div className="space-y-3">
                    {allImoveis.filter(i => i.corretorId === activeCorretor.id).map((imovel) => {
                      const isFav = favoritos.includes(imovel.id);
                      return (
                        <PropertyCard
                          key={imovel.id}
                          imovel={imovel}
                          isMyProperty={true}
                          isFavorite={isFav}
                          onFavoriteToggle={() => handleFavoriteToggle(imovel.id)}
                          onShareToggle={() => handleShareToggle(imovel.id)}
                          onEdit={() => {
                            setEditingPropertyId(imovel.id);
                            setIsAddingProperty(true);
                          }}
                          onDelete={() => handleDeleteProperty(imovel.id)}
                          onDuplicate={() => handleDuplicateProperty(imovel.id)}
                          onClick={() => setSelectedPropertyId(imovel.id)}
                        />
                      );
                    })}

                    {allImoveis.filter(i => i.corretorId === activeCorretor.id).length === 0 && (
                      <div className="text-center py-12 bg-white border border-slate-100 rounded-xl space-y-2">
                        <p className="text-xs text-slate-400">Você ainda não tem captações cadastradas.</p>
                        <button
                          onClick={() => setIsAddingProperty(true)}
                          className="text-xs font-bold text-blue-900 hover:underline"
                        >
                          Cadastre seu primeiro imóvel agora!
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div id="profile-tab-view">
                  <UserProfile
                    corretor={activeCorretor}
                    onProfileSwitched={(newBroker) => {
                      reloadData(true);
                    }}
                  />
                  <div className="px-4 pb-12 flex justify-center">
                    <button
                      onClick={handleLogout}
                      className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center py-2"
                    >
                      Sair da Conta (Simulação)
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'support' && (
                <SupportForm
                  activeCorretor={activeCorretor}
                  onBack={() => setActiveTab('home')}
                  triggerToast={triggerToast}
                />
              )}
            </>
          )}

        </div>

        {/* MULTIPLE SHARE ACTION FLOATING BAR - styled according to ConnectImobi header */}
        <AnimatePresence>
          {selectedPropertyIds.length > 0 && !isAddingProperty && !selectedPropertyId && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="absolute bottom-18 left-4 right-4 bg-[#003366] text-white p-4 rounded-2xl shadow-xl flex items-center justify-between z-30"
              id="multi-selection-floating-bar"
            >
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-amber-400">{selectedPropertyIds.length} Selecionados</span>
                <span className="text-[10px] text-slate-200">Prontos para envio</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedPropertyIds([])}
                  className="p-1 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider text-[10px]"
                >
                  Limpar
                </button>
                <button
                  onClick={handleShareMultiple}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md uppercase tracking-wider"
                >
                  <Share2 size={12} /> Compartilhar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* Floating Premium View mode switcher matching attached image */}
        {activeTab === 'home' && !selectedPropertyId && !isAddingProperty && selectedPropertyIds.length === 0 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all duration-300">
            <div className="bg-white p-1 rounded-[22px] flex items-center gap-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100/80">
              <button
                type="button"
                onClick={() => setSearchViewMode('como_esta_hoje')}
                className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-all ${
                  searchViewMode === 'como_esta_hoje'
                    ? 'bg-[#FF5A36] text-white shadow-xs'
                    : 'bg-transparent text-slate-900 hover:bg-slate-50'
                }`}
                title="Como está hoje"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="4" y1="5" x2="20" y2="5" />
                  <rect x="4" y="9" width="16" height="6" rx="1.5" />
                  <line x1="4" y1="19" x2="20" y2="19" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSearchViewMode('lista')}
                className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-all ${
                  searchViewMode === 'lista'
                    ? 'bg-[#FF5A36] text-white shadow-xs'
                    : 'bg-transparent text-slate-900 hover:bg-slate-50'
                }`}
                title="Em lista"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSearchViewMode('mapa')}
                className={`w-11 h-11 rounded-[18px] flex items-center justify-center transition-all ${
                  searchViewMode === 'mapa'
                    ? 'bg-[#FF5A36] text-white shadow-xs'
                    : 'bg-transparent text-slate-900 hover:bg-slate-50'
                }`}
                title="No mapa"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION TABS MENU (Similar to native mobile tabs bar) */}
        {!isAddingProperty && !selectedPropertyId && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-20">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'home' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-home"
            >
              <HomeIcon size={18} className={activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Início</span>
            </button>

            <button
              onClick={() => setActiveTab('my-properties')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'my-properties' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-my-properties"
            >
              <Building size={18} className={activeTab === 'my-properties' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Imóveis</span>
            </button>

            {/* Quick floating central add property button (+) */}
            <button
              onClick={() => {
                setEditingPropertyId(null);
                setIsAddingProperty(true);
              }}
              className="flex flex-col items-center justify-center -mt-6 bg-[#003366] text-white w-11 h-11 rounded-full shadow-lg hover:bg-[#002244] hover:scale-105 active:scale-95 transition-all z-30"
              id="btn-add-property"
              title="Cadastrar Novo Imóvel"
            >
              <PlusCircle size={22} className="stroke-[2.5px]" />
            </button>

            <button
              onClick={() => setActiveTab('support')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'support' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-support"
            >
              <MessageCircle size={18} className={activeTab === 'support' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Suporte</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'profile' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-profile"
            >
              <User size={18} className={activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Perfil</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
