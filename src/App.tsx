/**
 * @license
 * SPDX-License-Identifier: Apache-2.0.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LOGO_IMAGE from './assets/logo';
const logoImg = LOGO_IMAGE;
import { Imovel, Corretor } from './types';
import { DbService, isProfileComplete } from './services/db';
import { 
  auth, 
  loginEmailPassword, 
  registerEmailPassword, 
  resetPassword, 
  logoutUser, 
  syncUserWithFirestore, 
  formatAuthError 
} from './services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getApiUrl } from './utils/apiUrl';
import { StoryBubble } from './components/StoryBubble';
import { PropertyCard } from './components/PropertyCard';
import { CompactPropertyRow } from './components/CompactPropertyRow';
import { getPropertyCode } from './utils/codeUtils';
import { MapView } from './components/MapView';
import { PropertyForm } from './components/PropertyForm';
import { PropertyDetails } from './components/PropertyDetails';
import { UserProfile } from './components/UserProfile';
import { PublicView } from './components/PublicView';
import { SupportForm } from './components/SupportForm';
import { PortalApp } from './portal/PortalApp';
import { getValidImage, isValidImageString, handleImageError } from './utils/imageUtils';
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
  Smartphone,
  Lock,
  Mail,
  X,
  MapPin,
  Bed,
  Car,
  Maximize,
  LogOut,
  Eye,
  WifiOff,
  ArrowUpDown,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'home' | 'my-properties' | 'profile' | 'support';

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('imobishare_logged_in') === 'true';
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'email_login' | 'register' | 'forgot_password'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Application Mode: 'portal' (Portal Público) | 'broker' (Plataforma Corretor) | 'auth' (Login Corretor)
  const [appMode, setAppMode] = useState<'portal' | 'broker' | 'auth'>(() => {
    const hostname = window.location.hostname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Regra do projeto: Se acessar via imobishare.app.br (ou www.imobishare.app.br),
    // sempre abre diretamente o portal dos clientes
    if (hostname.includes('imobishare.app.br')) {
      if (params.get('action') === 'reset-password' || params.get('mode') === 'resetPassword') {
        return 'auth';
      }
      return 'portal';
    }

    // Regra do projeto: Se acessar via imobishare.onrender.com (ou onrender.com),
    // é a aplicação oficial dos corretores (ImobiShare App)
    if (hostname.includes('imobishare.onrender.com') || hostname.includes('onrender.com')) {
      if (params.get('portal') === '1' || hash === '#portal' || hash.startsWith('#portal') || hash.startsWith('#imovel/')) {
        return 'portal';
      }
      return 'broker';
    }

    // Reset password mode
    if (params.get('action') === 'reset-password' || params.get('mode') === 'resetPassword') {
      return 'auth';
    }
    // Explicit broker mode
    if (params.get('app') === '1' || hash === '#app' || hash.startsWith('#app/')) {
      return 'broker';
    }
    // Default: Public Portal immediately
    return 'portal';
  });

  // Listen to hash changes for seamless navigation (#portal, #home, #busca, #app, #auth, #imovel/)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      const hostname = window.location.hostname.toLowerCase();
      const isRender = hostname.includes('imobishare.onrender.com') || hostname.includes('onrender.com');

      if (hash === '#app' || hash.startsWith('#app/')) {
        setAppMode('broker');
      } else if (
        hash === '#portal' ||
        hash === '#home' ||
        hash === '#busca' ||
        hash.startsWith('#portal') ||
        hash.startsWith('#imovel/')
      ) {
        setAppMode('portal');
      } else if (hash === '#auth' || hash === '#login') {
        setAppMode('auth');
      } else if (hash === '' || hash === '#') {
        if (isRender) {
          setAppMode('broker');
        } else {
          setAppMode('portal');
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Reset password token modal states
  const [resetTokenData, setResetTokenData] = useState<{ email: string; token: string } | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetFormError, setResetFormError] = useState('');

  // Check URL parameters for reset password link
  useEffect(() => {
    const getParam = (paramName: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get(paramName)) return searchParams.get(paramName);

      if (window.location.hash) {
        const hashQuery = window.location.hash.includes('?') 
          ? window.location.hash.substring(window.location.hash.indexOf('?'))
          : window.location.hash;
        const hashParams = new URLSearchParams(hashQuery);
        if (hashParams.get(paramName)) return hashParams.get(paramName);
      }

      const match = new RegExp(`[?&]${paramName}=([^&]*)`).exec(window.location.href);
      return match ? decodeURIComponent(match[1]) : null;
    };

    let action = getParam('action');
    let token = getParam('token');
    let email = getParam('email');

    if (!action && getParam('mode') === 'resetPassword') {
      action = 'reset-password';
      token = getParam('oobCode') || getParam('token') || '';
    }

    if (action === 'reset-password' && token && email) {
      setResetTokenData({ email, token });
    }
  }, []);

  // Registration form states
  const [regNome, setRegNome] = useState('');
  const [regCreci, setRegCreci] = useState('');
  const [regTelefone, setRegTelefone] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regCidade, setRegCidade] = useState('Balneário Camboriú');
  const [regEstado, setRegEstado] = useState('SC');
  const [regImobiliaria, setRegImobiliaria] = useState('');

  // Core App states
  const [activeCorretor, setActiveCorretor] = useState<Corretor | null>(() => DbService.getActiveCorretor());
  const [allImoveis, setAllImoveis] = useState<Imovel[]>(() => DbService.getImoveisSync());
  const [allCorretores, setAllCorretores] = useState<Corretor[]>(() => DbService.getCorretores());
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    const active = DbService.getActiveCorretor();
    return active ? DbService.getFavoritos(active.id) : [];
  });

  const corretoresMap = useMemo(() => {
    const map = new Map<string, Corretor>();
    allCorretores.forEach((c) => {
      if (c.id) map.set(c.id, c);
      if (c.email) map.set(c.email.toLowerCase().trim(), c);
    });
    return map;
  }, [allCorretores]);

  // Helper: determines if a given property belongs to the currently active broker.
  // Uses corretorEmail (normalized) as the primary source of truth, falling back to
  // the legacy corretorId comparison for older records or active Firebase user context.
  const isMyProperty = useCallback((imovel: Imovel): boolean => {
    if (!activeCorretor) return false;
    const userEmail = (activeCorretor.email || '').toLowerCase().trim();
    const userId = activeCorretor.id;

    const propEmail = (imovel.corretorEmail || '').toLowerCase().trim();
    const propId = imovel.corretorId;

    if (userEmail && propEmail && propEmail === userEmail) {
      return true;
    }

    if (userId && propId && propId === userId) {
      return true;
    }

    return false;
  }, [activeCorretor]);
  
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
      const imoveis = DbService.getImoveisSync();
      const found = imoveis.find(i => 
        i.id.toLowerCase() === imovelId.toLowerCase() || 
        (i.codigo && i.codigo.toLowerCase() === imovelId.toLowerCase()) ||
        getPropertyCode(i).toLowerCase() === imovelId.toLowerCase() ||
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
      const ids = imoveisRaw.split(',').map(s => s.trim());
      const imoveis = DbService.getImoveisSync();
      const foundList = imoveis.filter(i => {
        const cleanId = i.id.replace('imovel-', '');
        return ids.some(paramId => {
          const cleanParam = paramId.replace('imovel-', '');
          return i.id === paramId || cleanId === cleanParam || i.id.endsWith(cleanParam) || cleanParam.endsWith(cleanId);
        });
      });
      if (foundList.length > 0) return foundList;
    }
    return null;
  });

  // Helper to dynamically determine the city with the most properties
  const topCityAndBairro = useMemo(() => {
    if (!allImoveis || allImoveis.length === 0) {
      return { cidade: 'Balneário Camboriú', bairro: '' };
    }
    const cityCounts: Record<string, number> = {};
    allImoveis.forEach((i) => {
      const c = (i.cidade || '').trim();
      if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    });

    let topCity = 'Balneário Camboriú';
    let maxCityCount = -1;
    Object.entries(cityCounts).forEach(([city, count]) => {
      if (count > maxCityCount) {
        maxCityCount = count;
        topCity = city;
      }
    });

    return { cidade: topCity, bairro: '' };
  }, [allImoveis]);

  // Filters & Search State (Home Tab)
  const [searchWord, setSearchWord] = useState('');
  const [filterCidade, setFilterCidade] = useState(() => {
    const initial = DbService.getImoveisSync();
    const cityCounts: Record<string, number> = {};
    initial.forEach(i => {
      const c = (i.cidade || '').trim();
      if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    });
    let top = 'Balneário Camboriú';
    let max = -1;
    Object.entries(cityCounts).forEach(([c, cnt]) => {
      if (cnt > max) { max = cnt; top = c; }
    });
    return top;
  });

  const [filterBairro, setFilterBairro] = useState<string>('');

  // Dynamically compute list of unique cities from properties + active broker city
  const availableCities = useMemo(() => {
    const citiesSet = new Set<string>();
    if (activeCorretor?.cidade?.trim()) {
      citiesSet.add(activeCorretor.cidade.trim());
    }
    allImoveis.forEach((i) => {
      if (i.cidade && i.cidade.trim()) {
        citiesSet.add(i.cidade.trim());
      }
    });
    if (citiesSet.size === 0) {
      ['Balneário Camboriú', 'Itapema', 'Itajaí', 'Camboriú', 'Navegantes'].forEach(c => citiesSet.add(c));
    }
    return Array.from(citiesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allImoveis, activeCorretor?.cidade]);

  const availableMyCities = useMemo(() => {
    const citiesSet = new Set<string>();
    if (activeCorretor?.cidade?.trim()) {
      citiesSet.add(activeCorretor.cidade.trim());
    }
    allImoveis.filter(isMyProperty).forEach((i) => {
      if (i.cidade && i.cidade.trim()) {
        citiesSet.add(i.cidade.trim());
      }
    });
    if (citiesSet.size === 0) {
      availableCities.forEach(c => citiesSet.add(c));
    }
    return Array.from(citiesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allImoveis, isMyProperty, activeCorretor?.cidade, availableCities]);

  // Home tab filters: Venda pre-selected by default, property type 'todos'
  const [filterTipo, setFilterTipo] = useState<'comprar' | 'alugar' | 'todos'>('comprar');
  const [filterTipoImovel, setFilterTipoImovel] = useState<string>('todos');
  const [filterStatusImovel, setFilterStatusImovel] = useState<string>('todos');
  const [filterValorMin, setFilterValorMin] = useState<number>(0);
  const [filterValorMax, setFilterValorMax] = useState<number>(15000000);
  const [filterDormitorios, setFilterDormitorios] = useState<number>(0);
  const [filterBanheiros, setFilterBanheiros] = useState<number>(0);
  const [filterVagas, setFilterVagas] = useState<number>(0);
  const [filterMetragemMin, setFilterMetragemMin] = useState<number>(0);
  const [filterMetragemMax, setFilterMetragemMax] = useState<number>(0);
  const [filterApenasFavoritos, setFilterApenasFavoritos] = useState<boolean>(false);
  const [filterMeusImoveis, setFilterMeusImoveis] = useState(true);
  const [filterOutrosCorretores, setFilterOutrosCorretores] = useState(true);
  const [filterIntegracao, setFilterIntegracao] = useState(true);
  const [filterModalTab, setFilterModalTab] = useState<'home' | 'my-properties'>('home');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [searchViewMode, setSearchViewMode] = useState<'como_esta_hoje' | 'lista' | 'mapa'>('como_esta_hoje');
  const [isMapClusterOpen, setIsMapClusterOpen] = useState<boolean>(false);

  // Sorting state for search results
  const [sortBy, setSortBy] = useState<'relevancia' | 'menor_preco' | 'maior_preco' | 'mais_recentes' | 'maior_area'>('relevancia');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);

  // Quick inline enterprise (empreendimento) search in main search card
  const [isSearchingEmpreendimento, setIsSearchingEmpreendimento] = useState<boolean>(false);
  const empreendimentoInputRef = useRef<HTMLInputElement>(null);

  // Computed display text for main search card (First line: City and Neighborhood)
  const searchCardCityAndNeighborhood = useMemo(() => {
    if (filterCidade && filterCidade !== 'Todas') {
      if (filterBairro && filterBairro.trim()) {
        return `${filterCidade}, ${filterBairro.trim()}`;
      }
      return filterCidade;
    }
    return filterBairro && filterBairro.trim() ? filterBairro.trim() : 'Todas as cidades';
  }, [filterCidade, filterBairro]);

  // Computed display text for main search card (Second line: smaller info, e.g., "Venda - Sem filtros de imóvel")
  const searchCardSubtext = useMemo(() => {
    const tipoLabel = filterTipo === 'comprar' ? 'Venda' : filterTipo === 'alugar' ? 'Aluguel' : 'Venda e Aluguel';
    
    // Check if extra filters are active beyond default
    const extraFilters: string[] = [];
    if (searchWord.trim()) extraFilters.push(`"${searchWord.trim()}"`);
    if (filterTipoImovel !== 'todos') extraFilters.push(filterTipoImovel);
    if (filterStatusImovel !== 'todos') extraFilters.push(filterStatusImovel);
    if (filterValorMin > 0) extraFilters.push(`Min R$ ${formatPriceBRL(filterValorMin)}`);
    if (filterValorMax > 0 && filterValorMax < 15000000) extraFilters.push(`Até R$ ${formatPriceBRL(filterValorMax)}`);
    if (filterDormitorios > 0) extraFilters.push(`${filterDormitorios}+ qts`);
    if (filterBanheiros > 0) extraFilters.push(`${filterBanheiros}+ bwc`);
    if (filterVagas > 0) extraFilters.push(`${filterVagas}+ vagas`);
    if (filterMetragemMin > 0) extraFilters.push(`${filterMetragemMin}+ m²`);
    if (filterApenasFavoritos) extraFilters.push('Favoritos');
    if (!filterMeusImoveis || !filterOutrosCorretores || !filterIntegracao) {
      extraFilters.push('Canais');
    }

    if (extraFilters.length === 0) {
      return `${tipoLabel} - Sem filtros de imóvel`;
    }
    return `${tipoLabel} - ${extraFilters.slice(0, 2).join(', ')}${extraFilters.length > 2 ? ` (+${extraFilters.length - 2})` : ''}`;
  }, [
    filterTipo,
    searchWord,
    filterTipoImovel,
    filterStatusImovel,
    filterValorMin,
    filterValorMax,
    filterDormitorios,
    filterBanheiros,
    filterVagas,
    filterMetragemMin,
    filterApenasFavoritos,
    filterMeusImoveis,
    filterOutrosCorretores,
    filterIntegracao
  ]);

  // Filters & Search State (My Properties Tab - strictly independent)
  const [myPropertiesSearch, setMyPropertiesSearch] = useState('');
  const [filterMyCidade, setFilterMyCidade] = useState<string>('Todas');
  const [filterMyTipo, setFilterMyTipo] = useState<'comprar' | 'alugar' | 'todos'>('todos');
  const [filterMyTipoImovel, setFilterMyTipoImovel] = useState<string>('todos');
  const [filterMyStatusImovel, setFilterMyStatusImovel] = useState<string>('todos');
  const [filterMyValorMin, setFilterMyValorMin] = useState<number>(0);
  const [filterMyValorMax, setFilterMyValorMax] = useState<number>(15000000);
  const [filterMyDormitorios, setFilterMyDormitorios] = useState<number>(0);
  const [filterMyBanheiros, setFilterMyBanheiros] = useState<number>(0);
  const [filterMyVagas, setFilterMyVagas] = useState<number>(0);
  const [filterMyBairro, setFilterMyBairro] = useState<string>('');

  // Active filter count computation for Home
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchWord.trim()) count++;
    if (filterCidade && filterCidade !== 'Todas') count++;
    if (filterTipo !== 'todos') count++;
    if (filterTipoImovel !== 'todos') count++;
    if (filterStatusImovel !== 'todos') count++;
    if (filterValorMin > 0) count++;
    if (filterValorMax > 0 && filterValorMax < 15000000) count++;
    if (filterDormitorios > 0) count++;
    if (filterBanheiros > 0) count++;
    if (filterVagas > 0) count++;
    if (filterMetragemMin > 0) count++;
    if (filterMetragemMax > 0) count++;
    if (filterBairro.trim()) count++;
    if (filterApenasFavoritos) count++;
    if (!filterMeusImoveis || !filterOutrosCorretores || !filterIntegracao) count++;
    return count;
  };

  // Active filter count computation for My Properties Tab
  const getMyPropertiesActiveFilterCount = () => {
    let count = 0;
    if (myPropertiesSearch.trim()) count++;
    if (filterMyCidade && filterMyCidade !== 'Todas') count++;
    if (filterMyTipo !== 'todos') count++;
    if (filterMyTipoImovel !== 'todos') count++;
    if (filterMyStatusImovel !== 'todos') count++;
    if (filterMyValorMin > 0) count++;
    if (filterMyValorMax > 0 && filterMyValorMax < 15000000) count++;
    if (filterMyDormitorios > 0) count++;
    if (filterMyBanheiros > 0) count++;
    if (filterMyVagas > 0) count++;
    if (filterMyBairro.trim()) count++;
    return count;
  };

  const handleResetFilters = () => {
    if (filterModalTab === 'home') {
      setHomePage(1);
      setSearchWord('');
      setFilterCidade(topCityAndBairro.cidade || 'Balneário Camboriú');
      setFilterBairro('');
      setFilterTipo('comprar');
      setFilterTipoImovel('todos');
      setFilterStatusImovel('todos');
      setFilterValorMin(0);
      setFilterValorMax(15000000);
      setFilterDormitorios(0);
      setFilterBanheiros(0);
      setFilterVagas(0);
      setFilterMetragemMin(0);
      setFilterMetragemMax(0);
      setFilterApenasFavoritos(false);
      setFilterMeusImoveis(true);
      setFilterOutrosCorretores(true);
      setFilterIntegracao(true);
    } else {
      setMyPropertiesSearch('');
      setFilterMyCidade('Todas');
      setFilterMyTipo('todos');
      setFilterMyTipoImovel('todos');
      setFilterMyStatusImovel('todos');
      setFilterMyValorMin(0);
      setFilterMyValorMax(15000000);
      setFilterMyDormitorios(0);
      setFilterMyBanheiros(0);
      setFilterMyVagas(0);
      setFilterMyBairro('');
    }
  };

  // Multiple selection state
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');

  // Reload database data helper
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchViewMode('como_esta_hoje');
    setSelectedPropertyId(null);
    setIsAddingProperty(false);
  };

  const reloadData = (updateCity = false) => {
    const currentCorretor = DbService.getActiveCorretor();
    setActiveCorretor(currentCorretor);
    setAllImoveis(DbService.getImoveisSync());
    setAllCorretores(DbService.getCorretores());
    if (currentCorretor) {
      setFavoritos(DbService.getFavoritos(currentCorretor.id));
      if (updateCity && currentCorretor.cidade) {
        setFilterCidade(currentCorretor.cidade);
      }
    } else {
      setFavoritos([]);
    }
  };

  // Swipe to refresh Home screen logic
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [homeTouchStartPos, setHomeTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  // Loading indicator for property results (thin RTL animated bar)
  const [isLoadingImoveis, setIsLoadingImoveis] = useState(true);

  useEffect(() => {
    // Initial loading animation for smooth feedback on startup
    const timer = setTimeout(() => {
      setIsLoadingImoveis(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleRefreshHome = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsLoadingImoveis(true);
    
    try {
      await DbService.syncWithServer();
      reloadData();
    } catch (err) {
      console.error('Erro ao atualizar imóveis:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoadingImoveis(false);
    }
  };

  const handleHomeTouchStart = (e: React.TouchEvent) => {
    setHomeTouchStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  const handleHomeTouchEnd = (e: React.TouchEvent) => {
    if (!homeTouchStartPos) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffY = Math.abs(endY - homeTouchStartPos.y);
    const diffX = Math.abs(endX - homeTouchStartPos.x);

    // Vertical swipe up or down (> 60px) triggers home refresh
    if (diffY > 60 && diffY > diffX * 1.2) {
      handleRefreshHome();
    }
    setHomeTouchStartPos(null);
  };

  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Perform background data synchronization on startup safely
    DbService.syncWithServer().catch(err => {
      console.warn('Silent network error on startup:', err);
    });

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
        i.id.toLowerCase() === imovelId.toLowerCase() || 
        (i.codigo && i.codigo.toLowerCase() === imovelId.toLowerCase()) ||
        getPropertyCode(i).toLowerCase() === imovelId.toLowerCase() ||
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
      const selectedList = allImoveis.filter(i => {
        const cleanId = i.id.replace('imovel-', '');
        return ids.some(paramId => {
          const cleanParam = paramId.replace('imovel-', '');
          return i.id === paramId || cleanId === cleanParam || i.id.endsWith(cleanParam) || cleanParam.endsWith(cleanId);
        });
      });
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
  const handleFavoriteToggle = async (imovelId: string) => {
    const corretorId = activeCorretor?.id || (activeCorretor?.email ? `broker-${activeCorretor.email.replace(/[^a-z0-9]/gi, '_')}` : 'broker-user');
    const updatedFavs = await DbService.toggleFavorite(corretorId, imovelId);
    setFavoritos(updatedFavs);
    
    const isFavNow = updatedFavs.includes(imovelId);
    setAllImoveis((prev) =>
      prev.map((i) => (i.id === imovelId ? { ...i, favorito: isFavNow } : i))
    );
    
    triggerToast(isFavNow ? 'Imóvel adicionado aos favoritos!' : 'Imóvel removido dos favoritos.');
  };

  // Toggle Property Website status ('SIM' / 'NAO')
  const handleWebsiteToggle = async (imovelId: string) => {
    const imoveis = DbService.getImoveisSync();
    const found = imoveis.find(i => i.id === imovelId) || allImoveis.find(i => i.id === imovelId);
    if (found) {
      const isCurrentlyWebsite = found.website !== 'NAO';
      const newWebsiteState = isCurrentlyWebsite ? 'NAO' : 'SIM';

      setAllImoveis((prev) =>
        prev.map((i) => (i.id === imovelId ? { ...i, website: newWebsiteState } : i))
      );

      const updated = await DbService.saveImovel({
        ...found,
        website: newWebsiteState
      });
      reloadData();
      triggerToast(
        updated?.website !== 'NAO'
          ? 'Imóvel publicado no website!'
          : 'Imóvel ocultado do website.'
      );
    }
  };

  // Toggle Property Share / Parceria status
  const handleShareToggle = async (imovelId: string) => {
    const imoveis = DbService.getImoveisSync();
    const found = imoveis.find(i => i.id === imovelId) || allImoveis.find(i => i.id === imovelId);
    if (found) {
      const isCurrentlyShared = found.compartilhar !== false && found.compartilhar !== 'NAO';
      const newShareState = !isCurrentlyShared;

      setAllImoveis((prev) =>
        prev.map((i) => (i.id === imovelId ? { ...i, compartilhar: newShareState } : i))
      );

      const updated = await DbService.saveImovel({
        ...found,
        compartilhar: newShareState
      });
      reloadData();
      triggerToast(
        (updated?.compartilhar !== false && updated?.compartilhar !== 'NAO')
          ? 'Imóvel ativado para parcerias na rede de corretores!'
          : 'Parceria desativada. Imóvel mantido como privado.'
      );
    }
  };

  // Share single property link via WhatsApp & copy link
  const handleShareSingleProperty = (imovel: Imovel) => {
    const code = imovel.id.replace('imovel-', '');
    const publicLink = `${window.location.origin}/?imovel=${code}`;
    const priceText = imovel.valor
      ? `R$ ${imovel.valor.toLocaleString('pt-BR')}`
      : imovel.valorLocacao
      ? `R$ ${imovel.valorLocacao.toLocaleString('pt-BR')}/mês`
      : 'Consulte';
    const mainImg = imovel.fotos?.[0] ? getValidImage(imovel.fotos[0]) : '';
    const isExternalImg = mainImg.startsWith('http://') || mainImg.startsWith('https://');
    const title = imovel.nomeEdificio?.trim() || imovel.titulo || 'Imóvel';
    const location = [imovel.bairro?.trim(), imovel.cidade?.trim()].filter(Boolean).join(' - ') || 'Localização sob consulta';

    let message = `🏠 ${title}\n📍 ${location}\n💰 ${priceText}`;
    if (isExternalImg) {
      message += `\n🖼️ Foto: ${mainImg}`;
    }
    message += `\n\nConfira todos os detalhes e fotos no link:\n👉 ${publicLink}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicLink);
    }

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
    triggerToast('Link do imóvel copiado! Abrindo WhatsApp...');
  };

  // Delete property
  const handleDeleteProperty = async (imovelId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este imóvel permanentemente?')) {
      await DbService.deleteImovel(imovelId);
      setSelectedPropertyIds(prev => prev.filter(id => id !== imovelId));
      reloadData();
      triggerToast('Imóvel excluído com sucesso.');
    }
  };

  // Duplicate property
  const handleDuplicateProperty = async (imovelId: string) => {
    const duplicated = await DbService.duplicateImovel(imovelId);
    if (duplicated) {
      reloadData();
      triggerToast(`Imóvel duplicado com sucesso: ${duplicated.titulo}`);
    }
  };

  const [regFoto, setRegFoto] = useState<string>('');

  // Helper to sync, process and activate logged-in user profile
  const processAuthenticatedUser = async (user: any, extraData?: any) => {
    await DbService.syncWithServer();
    const existingBrokers = DbService.getCorretores();
    const userEmail = (user.email || extraData?.email || '').toLowerCase().trim();
    const userUid = user.uid || extraData?.uid;
    const userPhone = user.phoneNumber || extraData?.telefone || '';
    
    let existing = existingBrokers.find(b => {
      const emailMatch = userEmail && b.email && b.email.toLowerCase().trim() === userEmail;
      const uidMatch = userUid && b.id && b.id === userUid;
      return Boolean(emailMatch || uidMatch);
    });

    // Also check server directly by email if not found in local cache
    if (!existing && userEmail) {
      try {
        const res = await fetch(getApiUrl(`/api/brokers`));
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            existing = list.find((b: Corretor) => {
              const emailMatch = userEmail && b.email && b.email.toLowerCase().trim() === userEmail;
              const uidMatch = userUid && b.id && b.id === userUid;
              return Boolean(emailMatch || uidMatch);
            });
          }
        }
      } catch (err) {
        console.warn('Failed to query brokers by email from server:', err);
      }
    }

    if (existing) {
      DbService.saveCorretor(existing);
      DbService.setActiveCorretor(existing);
      localStorage.setItem('imobishare_logged_in', 'true');
      setIsAuthenticated(true);
      setActiveCorretor(existing);
      return existing;
    }

    // Auto-create & activate broker profile for authenticated email
    if (userEmail) {
      const defaultBroker: Corretor = {
        id: userUid || `broker-${userEmail.replace(/[^a-z0-9]/g, '_')}`,
        nome: user.displayName || extraData?.nome || userEmail.split('@')[0],
        email: userEmail,
        creci: extraData?.creci || '',
        telefone: userPhone || extraData?.telefone || '',
        whatsapp: userPhone || extraData?.telefone || '',
        foto: user.photoURL || extraData?.foto || '',
        cidade: extraData?.cidade || '',
        estado: extraData?.estado || '',
        imobiliaria: extraData?.imobiliaria || '',
        restringirParceiros: false,
        parceirosEmails: []
      };
      DbService.saveCorretor(defaultBroker);
      DbService.setActiveCorretor(defaultBroker);
      localStorage.setItem('imobishare_logged_in', 'true');
      setIsAuthenticated(true);
      setActiveCorretor(defaultBroker);
      return defaultBroker;
    }

    // Fallback if no email
    setIsAuthenticated(false);
    setAuthEmail(userEmail || '');
    setRegNome(user.displayName || extraData?.nome || (userEmail ? userEmail.split('@')[0] : ''));
    if (user.photoURL || extraData?.foto) {
      setRegFoto(user.photoURL || extraData?.foto);
    }
    setAuthMode('login');
    return null;
  };

// Função auxiliar para tratar usuário autenticado
const handleAuthenticatedUser = async (user: FirebaseUser | null) => {
  if (!user) {
    const isLoggedInLocally = localStorage.getItem('imobishare_logged_in') === 'true';
    const activeCorretor = DbService.getActiveCorretor();
    if (isLoggedInLocally && activeCorretor) {
      setIsAuthenticated(true);
      setActiveCorretor(activeCorretor);
      setIsInitialLoading(false);
      return;
    }
    setIsAuthenticated(false);
    setAuthMode('login');
    setIsInitialLoading(false);
    return;
  }

  try {
    const corretor = await processAuthenticatedUser(user);
    if (corretor) {
      reloadData();
      setIsAuthenticated(true);
    }
  } catch (err) {
    console.error('Error syncing Firebase user profile:', err);
  } finally {
    setIsInitialLoading(false);
  }
};

// Listener para mudanças de autenticação
useEffect(() => {
  let unsubscribe = () => {};
  const safetyTimer = setTimeout(() => {
    setIsInitialLoading(false);
  }, 1500);

  try {
    unsubscribe = onAuthStateChanged(
      auth, 
      (user) => {
        clearTimeout(safetyTimer);
        handleAuthenticatedUser(user);
      },
      (error) => {
        clearTimeout(safetyTimer);
        console.warn('Firebase Auth listener encountered error (using server/local auth fallback):', error);
        setIsInitialLoading(false);
      }
    );
  } catch (err) {
    clearTimeout(safetyTimer);
    console.warn('Failed to bind onAuthStateChanged listener:', err);
    setIsInitialLoading(false);
  }

  return () => {
    clearTimeout(safetyTimer);
    unsubscribe();
  };
}, []);

  // Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Por favor, informe seu e-mail e senha.');
      triggerToast('Informe seu e-mail e senha.');
      return;
    }
    setAuthLoading(true);
    try {
      let foundCorretor: Corretor | null = null;
      let backendErrorMsg = '';

      // 1. Try backend authentication endpoint
      try {
        const response = await fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword })
        });
        const data = await response.json();
        if (response.ok && data.corretor) {
          foundCorretor = data.corretor;
        } else {
          backendErrorMsg = data.error || 'E-mail ou senha incorretos.';
        }
      } catch (_) {
        // Backend offline fallback
      }

      // If backend explicitly rejected credentials (wrong password / user not found), show error and stop
      if (!foundCorretor && backendErrorMsg) {
        setAuthError(backendErrorMsg);
        triggerToast(backendErrorMsg);
        setAuthLoading(false);
        return;
      }

      // 2. Fallback: Check Firebase Auth
      if (!foundCorretor) {
        try {
          const user = await loginEmailPassword(authEmail, authPassword);
          if (user) {
            foundCorretor = await processAuthenticatedUser(user);
          }
        } catch (fbErr: any) {
          const formatted = formatAuthError(fbErr);
          setAuthError(formatted);
          triggerToast(formatted);
          setAuthLoading(false);
          return;
        }
      }

      // 3. Fallback: Check local DbService
      if (!foundCorretor) {
        const corretores = DbService.getCorretores();
        const matched = corretores.find(c => c.email?.toLowerCase().trim() === authEmail.toLowerCase().trim());
        if (matched) {
          if (matched.password && matched.password !== authPassword) {
            const err = 'Senha incorreta. Verifique os dados digitados.';
            setAuthError(err);
            triggerToast(err);
            setAuthLoading(false);
            return;
          }
          if (!matched.password) {
            matched.password = authPassword;
          }
          foundCorretor = matched;
        }
      }

      if (foundCorretor) {
        DbService.setActiveCorretor(foundCorretor);
        localStorage.setItem('imobishare_logged_in', 'true');
        setIsAuthenticated(true);
        setActiveCorretor(foundCorretor);
        setAppMode('broker');
        window.location.hash = '#app';
        setActiveTab('home');
        setSelectedPropertyId(null);
        setIsAddingProperty(false);
        setEditingPropertyId(null);

        await DbService.syncWithServer();
        reloadData();
        return;
      }

      const defaultErr = 'Usuário não encontrado ou senha incorreta.';
      setAuthError(defaultErr);
      triggerToast(defaultErr);
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      triggerToast(formatted);
    } finally {
      setAuthLoading(false);
    }
  };

  // Register user with backend / Firebase Auth
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanNome = regNome.trim();
    const cleanCreci = regCreci.trim();
    const cleanPhone = regTelefone.trim() || regWhatsapp.trim();
    const cleanCidade = regCidade.trim();
    const cleanEstado = regEstado.trim().toUpperCase();

    if (!cleanNome || !cleanEmail || !authPassword || !cleanCreci || !cleanPhone || !cleanCidade || !cleanEstado) {
      setAuthError('Por favor, preencha todos os campos obrigatórios (Nome, E-mail, Senha, CRECI, Telefone/WhatsApp, Cidade e Estado).');
      triggerToast('Por favor, preencha todos os campos do cadastro.');
      return;
    }

    setAuthLoading(true);

    const newCorretorObj: Corretor = {
      id: `corretor_${Date.now()}`,
      nome: cleanNome,
      email: cleanEmail,
      password: authPassword,
      creci: cleanCreci.toUpperCase().startsWith('CRECI') ? cleanCreci : `CRECI ${cleanCreci}`,
      telefone: cleanPhone,
      whatsapp: regWhatsapp.trim() || cleanPhone,
      cidade: cleanCidade,
      estado: cleanEstado,
      imobiliaria: regImobiliaria.trim(),
      foto: regFoto.trim() || '',
    };

    try {
      // 1. Send to backend REST API
      let backendSuccess = false;
      try {
        const response = await fetch(getApiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: newCorretorObj.nome,
            email: newCorretorObj.email,
            password: authPassword,
            creci: newCorretorObj.creci,
            telefone: newCorretorObj.telefone,
            whatsapp: newCorretorObj.whatsapp,
            cidade: newCorretorObj.cidade,
            estado: newCorretorObj.estado,
            imobiliaria: newCorretorObj.imobiliaria
          })
        });
        const resData = await response.json();
        if (!response.ok) {
          const errMsg = resData.error || 'Erro ao realizar cadastro.';
          setAuthError(errMsg);
          triggerToast(errMsg);
          setAuthLoading(false);
          return;
        }
        backendSuccess = true;
      } catch (backendErr) {
        console.warn('Backend register endpoint warning:', backendErr);
      }

      // If backend was offline, check local DbService duplicates
      if (!backendSuccess) {
        const existingEmail = DbService.getCorretores().find(c => c.email?.toLowerCase().trim() === cleanEmail);
        if (existingEmail) {
          const err = 'Já existe uma conta cadastrada com este e-mail.';
          setAuthError(err);
          triggerToast(err);
          setAuthLoading(false);
          return;
        }
        const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');
        if (cleanPhoneDigits) {
          const existingPhone = DbService.getCorretores().find(c => {
            const p = (c.telefone || c.whatsapp || '').replace(/\D/g, '');
            return p && (p === cleanPhoneDigits || (p.length >= 8 && cleanPhoneDigits.length >= 8 && (p.endsWith(cleanPhoneDigits) || cleanPhoneDigits.endsWith(p))));
          });
          if (existingPhone) {
            const err = 'Já existe uma conta cadastrada com este telefone.';
            setAuthError(err);
            triggerToast(err);
            setAuthLoading(false);
            return;
          }
        }
      }

      // 2. Firebase Auth registration
      try {
        await registerEmailPassword(cleanEmail, authPassword, {
          nome: cleanNome,
          creci: newCorretorObj.creci,
          telefone: cleanPhone,
          whatsapp: newCorretorObj.whatsapp,
          cidade: cleanCidade,
          estado: cleanEstado
        });
      } catch (fbErr: any) {
        console.warn('Firebase registration notice:', fbErr);
      }

      DbService.saveCorretor(newCorretorObj);
      DbService.setActiveCorretor(newCorretorObj);
      localStorage.setItem('imobishare_logged_in', 'true');
      setIsAuthenticated(true);
      setActiveCorretor(newCorretorObj);
      setAppMode('broker');
      window.location.hash = '#app';
      setActiveTab('home');
      setSelectedPropertyId(null);
      setIsAddingProperty(false);
      setEditingPropertyId(null);
      triggerToast('Conta criada com sucesso!');

      await DbService.syncWithServer();
      reloadData();
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      triggerToast(formatted);
    } finally {
      setAuthLoading(false);
    }
  };

  // Reset password via Firebase
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = authEmail.toLowerCase().trim();
    if (!cleanEmail) {
      setAuthError('Por favor, informe seu e-mail para receber as instruções.');
      triggerToast('Por favor, informe seu e-mail.');
      return;
    }
    setAuthLoading(true);
    try {
      // Direct call to sendPasswordResetEmail(auth, cleanEmail)
      await resetPassword(cleanEmail);
      triggerToast('E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada e a pasta de spam.');
      setAuthError('');
      setAuthMode('login');
    } catch (err: any) {
      console.error('Erro ao enviar e-mail de redefinição de senha:', err);
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      triggerToast(formatted);
    } finally {
      setAuthLoading(false);
    }
  };

  // Execute password reset with token
  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFormError('');

    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetFormError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetFormError('As senhas digitadas não coincidem.');
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password-with-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetTokenData?.email,
          token: resetTokenData?.token,
          newPassword: resetNewPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir a senha.');
      }

      triggerToast('Senha redefinida com sucesso! Entre com sua nova senha.');
      setResetTokenData(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
      window.history.replaceState({}, '', window.location.pathname);
      setAuthMode('login');
      if (resetTokenData?.email) {
        setAuthEmail(resetTokenData.email);
      }
    } catch (err: any) {
      setResetFormError(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Modal de Redefinição de Senha (Renderiza sobre a tela de login ou sobre o app)
  const renderResetPasswordModal = () => {
    if (!resetTokenData) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 border border-slate-100 animate-fade-in">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-blue-50 text-[#003366] rounded-2xl flex items-center justify-center">
              <Lock size={24} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">Redefinir Sua Senha</h3>
            <p className="text-xs text-slate-500">
              Crie uma nova senha de acesso para a conta <strong className="text-slate-700">{resetTokenData.email}</strong>
            </p>
          </div>

          {resetFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {resetFormError}
            </div>
          )}

          <form onSubmit={handleExecuteResetPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Nova Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#003366]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Repita a nova senha"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#003366]"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetTokenData(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={resetSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-4 rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {resetSubmitting ? (
                  <span>Salvando...</span>
                ) : (
                  <span>Salvar Nova Senha</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Error logging out of Firebase:', err);
    }
    DbService.setActiveCorretor(null);
    localStorage.removeItem('imobishare_logged_in');
    localStorage.removeItem('imobishare_active_corretor');
    setActiveCorretor(null);
    setIsAuthenticated(false);
    setAppMode('portal');
    window.location.hash = '#portal';
    setAuthMode('login');
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    triggerToast('Sessão encerrada com sucesso.');
  };

  // Continuar navegação como Visitante (Guest)
  const handleContinueAsGuest = () => {
    const guestCorretor: Corretor = {
      id: 'corretor_visitante',
      nome: 'Corretor Visitante',
      email: 'visitante@imobishare.com.br',
      creci: 'CRECI Pendente',
      telefone: '(47) 99999-9999',
      whatsapp: '(47) 99999-9999',
      cidade: 'Balneário Camboriú',
      estado: 'SC',
      imobiliaria: 'Visitante ImobiShare',
      foto: ''
    };
    DbService.setActiveCorretor(guestCorretor);
    localStorage.setItem('imobishare_logged_in', 'true');
    setIsAuthenticated(true);
    setActiveCorretor(guestCorretor);
    setAppMode('broker');
    window.location.hash = '#app';
    triggerToast('Acessando como Visitante. Explore o catálogo de imóveis.');
  };


  // Filter properties based on current filters and search word
  const filteredImoveis = useMemo(() => {
    const activeEmail = (activeCorretor?.email || '').toLowerCase().trim();
    const query = searchWord.toLowerCase().replace('#', '').trim();
    const bairroQuery = filterBairro.toLowerCase().trim();

    const results = allImoveis.filter((imovel) => {
      // 1. Text keyword search (title, description, neighborhood, building, reference code like FRE03)
      if (query) {
        const propCode = getPropertyCode(imovel, allImoveis).toLowerCase();
        const rawCode = (imovel.codigo || '').toLowerCase();
        const rawId = (imovel.id || '').toLowerCase();
        const title = (imovel.titulo || '').toLowerCase();
        const desc = (imovel.descricao || '').toLowerCase();
        const endereco = (imovel.endereco || imovel.localizacao || '').toLowerCase();
        const cep = (imovel.cep || '').toLowerCase();
        const bairro = (imovel.bairro || '').toLowerCase();
        const cidade = (imovel.cidade || '').toLowerCase();
        const building = (imovel.nomeEdificio || '').toLowerCase();
        const palavra = (imovel.palavraDestacada || '').toLowerCase();
        const info = (imovel.informacoes || '').toLowerCase();
        const origem = (imovel.origem || '').toLowerCase();
        const integracaoOrigem = (imovel.integracaoOrigem || '').toLowerCase();
        const construtora = (imovel.construtora || '').toLowerCase();

        const matchesQuery = 
          propCode.includes(query) ||
          rawCode.includes(query) ||
          rawId.includes(query) ||
          title.includes(query) ||
          desc.includes(query) ||
          endereco.includes(query) ||
          cep.includes(query) ||
          bairro.includes(query) ||
          cidade.includes(query) ||
          building.includes(query) ||
          palavra.includes(query) ||
          info.includes(query) ||
          origem.includes(query) ||
          integracaoOrigem.includes(query) ||
          construtora.includes(query);

        if (!matchesQuery) return false;
      }

      // 2. City Filter (Robust normalized matching)
      if (filterCidade && filterCidade !== 'Todas') {
        const targetCity = filterCidade.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const imovelCity = (imovel.cidade || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (imovelCity !== targetCity && !imovelCity.includes(targetCity) && !targetCity.includes(imovelCity)) {
          return false;
        }
      }

      // 3. Neighborhood / Bairro filter
      if (bairroQuery) {
        if (!imovel.bairro || !imovel.bairro.toLowerCase().includes(bairroQuery)) {
          return false;
        }
      }

      // 4. Purchase/Rent Filter (Item 5: dual sales/rental property appears in both)
      const hasSales = Boolean((imovel.valor && imovel.valor > 0) || (imovel.valorVenda && imovel.valorVenda > 0) || imovel.tipo === 'venda' || imovel.tipo === 'ambos');
      const hasRental = Boolean((imovel.valorLocacao && imovel.valorLocacao > 0) || imovel.tipo === 'locação' || imovel.tipo === 'ambos');

      if (filterTipo === 'comprar' && !hasSales) return false;
      if (filterTipo === 'alugar' && !hasRental) return false;

      // 5. Property Type (Tipo de Imóvel)
      if (filterTipoImovel !== 'todos') {
        const impTipo = (imovel.tipoImovel || 'Apartamento').toLowerCase();
        const targetTipo = filterTipoImovel.toLowerCase();
        if (targetTipo === 'casa') {
          if (!impTipo.includes('casa') && !impTipo.includes('sobrado')) return false;
        } else if (!impTipo.includes(targetTipo)) {
          return false;
        }
      }

      // 5b. Status do Imóvel (Na planta, Mobiliado, Sem mobília)
      if (filterStatusImovel !== 'todos') {
        if (imovel.statusImovel !== filterStatusImovel) {
          return false;
        }
      }

      // 6. Value range
      const priceToCheck = (filterTipo === 'alugar' && imovel.valorLocacao) ? imovel.valorLocacao : (imovel.valor || imovel.valorVenda || 0);
      if (filterValorMin > 0 && priceToCheck < filterValorMin) return false;
      if (filterValorMax > 0 && filterValorMax < 15000000 && priceToCheck > filterValorMax) return false;

      // 7. Specifications (Dormitórios, Banheiros, Vagas)
      if (filterDormitorios > 0 && (imovel.dormitorios || 0) < filterDormitorios) return false;
      if (filterBanheiros > 0 && (imovel.banheiros || 0) < filterBanheiros) return false;
      if (filterVagas > 0 && (imovel.vagas || 0) < filterVagas) return false;

      // 8. Metragem (Privativa)
      if (filterMetragemMin > 0 && (imovel.metragem || 0) < filterMetragemMin) return false;
      if (filterMetragemMax > 0 && (imovel.metragem || 0) > filterMetragemMax) return false;

      // 9. Apenas Favoritos
      if (filterApenasFavoritos && !favoritos.includes(imovel.id) && !imovel.favorito) return false;

      // 10. Broker Ownership / Integration (Portais & DWV) Filter
      const isMine = isMyProperty(imovel);
      const isDWVOrPortal = Boolean(
        imovel.integrado === true ||
        (imovel.integracaoOrigem && imovel.integracaoOrigem.trim().length > 0) ||
        (imovel.origem && imovel.origem.trim().toLowerCase() !== 'imobishare' && imovel.origem.trim().length > 0) ||
        (imovel.origem && imovel.origem.trim().toLowerCase().includes('dwv')) ||
        (imovel.origem && imovel.origem.trim().toLowerCase().includes('portal'))
      );

      if (isDWVOrPortal) {
        if (!filterIntegracao) return false;
      } else if (isMine) {
        // If it's mine, check "Meus imóveis" switch
        if (!filterMeusImoveis) return false;
      } else {
        // If it belongs to someone else (Rede de Parcerias), check "Outros corretores" switch
        if (!filterOutrosCorretores) return false;
        // Also must be SHARED to be visible to others
        const isShared = imovel.compartilhar !== false && (imovel.compartilhar as any) !== 'NAO';
        if (!isShared) return false;

        const vis = (imovel.visibilidade as string) || 'todos';
        if (vis === 'meus') return false;

        // --- PARTNER GROUP EXCLUSIVITY RESTRICTION (O(1) Map Lookup) ---
        const owner = (imovel.corretorId && corretoresMap.get(imovel.corretorId)) ||
                      (imovel.corretorEmail && corretoresMap.get(imovel.corretorEmail.toLowerCase().trim()));
        
        const partnerEmails = owner?.parceirosEmails || [];
        const isPartner = Boolean(activeEmail && partnerEmails.some(p => p.toLowerCase().trim() === activeEmail));

        // 1. Property explicitly set to 'parceiros'
        if (vis === 'parceiros') {
          if (!isPartner) return false;
        }

        // 2. Broker has partner group restriction
        if (partnerEmails.length > 0 || owner?.restringirParceiros) {
          if (!isPartner) return false;
        }
      }

      return true;
    });

    // Apply sorting
    if (sortBy === 'menor_preco') {
      results.sort((a, b) => {
        const priceA = (filterTipo === 'alugar' && a.valorLocacao) ? a.valorLocacao : (a.valor || a.valorVenda || 0);
        const priceB = (filterTipo === 'alugar' && b.valorLocacao) ? b.valorLocacao : (b.valor || b.valorVenda || 0);
        return priceA - priceB;
      });
    } else if (sortBy === 'maior_preco') {
      results.sort((a, b) => {
        const priceA = (filterTipo === 'alugar' && a.valorLocacao) ? a.valorLocacao : (a.valor || a.valorVenda || 0);
        const priceB = (filterTipo === 'alugar' && b.valorLocacao) ? b.valorLocacao : (b.valor || b.valorVenda || 0);
        return priceB - priceA;
      });
    } else if (sortBy === 'mais_recentes') {
      results.sort((a, b) => {
        const dateA = a.dataCadastro ? new Date(a.dataCadastro).getTime() : 0;
        const dateB = b.dataCadastro ? new Date(b.dataCadastro).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === 'maior_area') {
      results.sort((a, b) => (b.metragem || 0) - (a.metragem || 0));
    }

    return results;
  }, [
    allImoveis,
    searchWord,
    filterCidade,
    filterBairro,
    filterTipo,
    filterTipoImovel,
    filterStatusImovel,
    filterValorMin,
    filterValorMax,
    filterDormitorios,
    filterBanheiros,
    filterVagas,
    filterMetragemMin,
    filterMetragemMax,
    filterApenasFavoritos,
    favoritos,
    filterIntegracao,
    filterMeusImoveis,
    filterOutrosCorretores,
    isMyProperty,
    activeCorretor,
    corretoresMap,
    sortBy
  ]);

  // Batch size for property search with high performance (24 properties per load)
  const PAGE_SIZE = 24;
  const [homePage, setHomePage] = useState<number>(1);

  // Automatically reset to page 1 whenever any filter or search query changes
  useEffect(() => {
    setHomePage(1);
  }, [
    searchWord,
    filterCidade,
    filterBairro,
    filterTipo,
    filterTipoImovel,
    filterStatusImovel,
    filterValorMin,
    filterValorMax,
    filterDormitorios,
    filterBanheiros,
    filterVagas,
    filterMetragemMin,
    filterMetragemMax,
    filterApenasFavoritos,
    filterMeusImoveis,
    filterOutrosCorretores,
    filterIntegracao,
    sortBy
  ]);

  const totalHomePages = Math.max(1, Math.ceil(filteredImoveis.length / PAGE_SIZE));
  const currentHomePage = Math.min(Math.max(1, homePage), totalHomePages);

  const paginatedHomeImoveis = useMemo(() => {
    return filteredImoveis.slice(0, currentHomePage * PAGE_SIZE);
  }, [filteredImoveis, currentHomePage]);

  const handleHomePageChange = (newPage: number) => {
    const targetPage = Math.min(Math.max(1, newPage), totalHomePages);
    setHomePage(targetPage);
  };

  // Check which properties are stories (registered within 24h by others and shared)
  const storyImoveis = useMemo(() => {
    const activeEmail = (activeCorretor?.email || '').toLowerCase().trim();
    const now = Date.now();

    return allImoveis.filter((imovel) => {
      const hours = (now - new Date(imovel.dataCadastro).getTime()) / (1000 * 60 * 60);
      const isShared = imovel.compartilhar !== false;
      const isEligible = hours <= 24 && activeCorretor && !isMyProperty(imovel) && isShared;
      if (!isEligible) return false;

      // Check partner restriction (O(1) Map Lookup)
      const owner = (imovel.corretorId && corretoresMap.get(imovel.corretorId)) ||
                    (imovel.corretorEmail && corretoresMap.get(imovel.corretorEmail.toLowerCase().trim()));
      if (owner && owner.restringirParceiros) {
        const partners = owner.parceirosEmails || [];
        if (partners.length > 0) {
          const hasAccess = partners.some(p => p.toLowerCase().trim() === activeEmail);
          if (!hasAccess) return false;
        }
      }

      return true;
    });
  }, [allImoveis, activeCorretor, isMyProperty, corretoresMap]);

  // Favorite properties of the active broker
  const favoriteImoveis = useMemo(() => {
    return allImoveis.filter((imovel) => {
      const isFav = favoritos.includes(imovel.id) || imovel.favorito === true;
      if (!isFav) return false;

      return isMyProperty(imovel);
    });
  }, [allImoveis, favoritos, isMyProperty]);

  // Active broker properties memoized
  const rawMyProperties = useMemo(() => {
    return allImoveis.filter((i) => isMyProperty(i));
  }, [allImoveis, isMyProperty]);

  const filteredMyProperties = useMemo(() => {
    let result = rawMyProperties;

    if (myPropertiesSearch.trim()) {
      const term = myPropertiesSearch.toLowerCase().replace('#', '').trim();
      result = result.filter((imovel) => {
        const title = (imovel.nomeEdificio || imovel.titulo || '').toLowerCase();
        const neighborhood = (imovel.bairro || '').toLowerCase();
        const address = (imovel.endereco || imovel.localizacao || '').toLowerCase();
        const code = getPropertyCode(imovel, allImoveis).toLowerCase();
        const rawCode = (imovel.codigo || '').toLowerCase();
        const rawId = (imovel.id || '').toLowerCase();
        const keyword = (imovel.palavraDestacada || '').toLowerCase();
        const city = (imovel.cidade || '').toLowerCase();
        return (
          title.includes(term) ||
          neighborhood.includes(term) ||
          address.includes(term) ||
          code.includes(term) ||
          rawCode.includes(term) ||
          rawId.includes(term) ||
          keyword.includes(term) ||
          city.includes(term)
        );
      });
    }

    if (filterMyCidade && filterMyCidade !== 'Todas') {
      const targetCity = filterMyCidade.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(i => {
        const imovelCity = (i.cidade || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return imovelCity === targetCity || imovelCity.includes(targetCity) || targetCity.includes(imovelCity);
      });
    }

    if (filterMyBairro.trim()) {
      const bTerm = filterMyBairro.toLowerCase().trim();
      result = result.filter(i => i.bairro && i.bairro.toLowerCase().includes(bTerm));
    }

    if (filterMyTipo === 'comprar') {
      result = result.filter(i => (i.valor && i.valor > 0) || i.tipo === 'venda' || i.tipo === 'ambos');
    } else if (filterMyTipo === 'alugar') {
      result = result.filter(i => (i.valorLocacao && i.valorLocacao > 0) || i.tipo === 'locação' || i.tipo === 'ambos');
    }

    if (filterMyTipoImovel !== 'todos') {
      const targetTipo = filterMyTipoImovel.toLowerCase();
      result = result.filter(i => {
        const impTipo = (i.tipoImovel || 'Apartamento').toLowerCase();
        if (targetTipo === 'casa') {
          return impTipo.includes('casa') || impTipo.includes('sobrado');
        }
        return impTipo.includes(targetTipo);
      });
    }

    if (filterMyStatusImovel !== 'todos') {
      result = result.filter(i => i.statusImovel === filterMyStatusImovel);
    }

    if (filterMyValorMin > 0) {
      result = result.filter(i => (i.valorLocacao || i.valor || 0) >= filterMyValorMin);
    }
    if (filterMyValorMax > 0 && filterMyValorMax < 15000000) {
      result = result.filter(i => (i.valorLocacao || i.valor || 0) <= filterMyValorMax);
    }

    if (filterMyDormitorios > 0) {
      result = result.filter(i => (i.dormitorios || 0) >= filterMyDormitorios);
    }
    if (filterMyBanheiros > 0) {
      result = result.filter(i => (i.banheiros || 0) >= filterMyBanheiros);
    }
    if (filterMyVagas > 0) {
      result = result.filter(i => (i.vagas || 0) >= filterMyVagas);
    }

    return result;
  }, [
    rawMyProperties,
    myPropertiesSearch,
    filterMyCidade,
    filterMyBairro,
    filterMyTipo,
    filterMyTipoImovel,
    filterMyStatusImovel,
    filterMyValorMin,
    filterMyValorMax,
    filterMyDormitorios,
    filterMyBanheiros,
    filterMyVagas,
    allImoveis
  ]);

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
      const title = i.nomeEdificio?.trim() || i.titulo || 'Imóvel';
      const location = i.bairro ? `${title} (${i.bairro})` : title;
      let preco = `R$ ${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
      let tipo = 'Venda';
      if (i.tipo === 'locação') {
        preco = `R$ ${(i.valorLocacao || i.valor).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês`;
        tipo = 'Aluguel';
      } else if (i.tipo === 'ambos') {
        preco = `Venda: R$ ${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} | Aluguel: R$ ${(i.valorLocacao || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês`;
        tipo = 'Venda & Aluguel';
      }
      const imgUrl = i.fotos?.[0] ? getValidImage(i.fotos[0]) : '';
      const isExternalImg = imgUrl.startsWith('http://') || imgUrl.startsWith('https://');
      return `• ${location} - ${preco} (${tipo})${isExternalImg ? `\n  Foto: ${imgUrl}` : ''}`;
    }).join('\n\n');
    
    const idsJoined = selectedPropertyIds.map(id => id.replace('imovel-', '')).join(',');
    const multiLink = `${window.location.origin}/?selecao=${idsJoined}`;

    const textMessage = `Selecionei estes imóveis especiais que combinam com seu perfil:

${listItems}

Toque abaixo para ver a seleção completa:
👉 ${multiLink}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`, '_blank', 'noopener,noreferrer');
    triggerToast('Compartilhando seleção via WhatsApp!');
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
        activeCorretor={activeCorretor}
        onExit={() => setPublicViewProperty(null)} 
      />
    );
  }

  // If user is opening a shared selection of properties
  if (publicSelectionImoveis) {
    return (
      <div className="bg-slate-50 min-h-screen pb-16 font-sans">
        {/* Brand logo bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center shadow-xs">
          <div className="flex items-center gap-2 text-[#003366] font-bold text-sm">
            <img
              src={logoImg}
              alt="ImobiShare Logo"
              className="w-5 h-5 object-contain rounded-md"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = LOGO_IMAGE; }}
            />
            <span className="font-extrabold text-[#003366] tracking-tight text-base">ImobiShare</span>
          </div>
          <div className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Seleção
          </div>
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
                    src={getValidImage(imovel.fotos?.[0])}
                    alt={imovel.titulo}
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className={`absolute top-1 left-1 text-[6.5px] font-extrabold uppercase tracking-tight text-white px-1 py-0.5 rounded-xs shadow-xs ${
                    imovel.tipo === 'venda' ? 'bg-[#003366]' : imovel.tipo === 'locação' ? 'bg-emerald-700' : 'bg-indigo-900'
                  }`}>
                    {imovel.tipo === 'venda' ? 'Venda' : imovel.tipo === 'locação' ? 'Aluguel' : 'Venda & Aluguel'}
                  </span>
                </div>

                <div className="flex-grow min-w-0 flex flex-col justify-between h-20 sm:h-24 py-0.5">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate tracking-tight leading-tight">
                      {imovel.nomeEdificio?.trim() ? imovel.nomeEdificio : imovel.titulo}
                    </h3>
                    <div className="flex items-center text-slate-400 text-[10px] mt-0.5 font-medium truncate">
                      <MapPin size={10} className="mr-0.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{imovel.endereco ? `${imovel.endereco} · ` : ''}{imovel.bairro}, {imovel.cidade}</span>
                    </div>

                    {(() => {
                      const isTerreno = imovel.tipoImovel === 'Terreno';
                      const isComercial = imovel.tipoImovel === 'Comercial';

                      return (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 text-[9px] mt-1 bg-slate-50 py-0.5 px-2 rounded-lg border border-slate-100/60 w-fit font-bold">
                          {!isComercial && !isTerreno && (
                            <>
                              <span className="flex items-center gap-0.5">
                                <Bed size={10} className="text-slate-400 flex-shrink-0" />
                                <span>{imovel.dormitorios ?? 0} {imovel.dormitorios === 1 ? 'dorm' : 'dorms'}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                            </>
                          )}
                          {!isTerreno && (
                            <>
                              <span className="flex items-center gap-0.5">
                                <Car size={10} className="text-slate-400 flex-shrink-0" />
                                <span>{imovel.vagas ?? 0} {imovel.vagas === 1 ? 'vaga' : 'vagas'}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                            </>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Maximize size={10} className="text-slate-400 flex-shrink-0" />
                            <span>{imovel.metragem ?? 0} m²</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100/60 pt-1 mt-1">
                    <div>
                      {imovel.tipo === 'ambos' ? (
                        <div className="flex flex-col">
                          <span className="font-extrabold text-[#003366] text-xs leading-tight">
                            {formatPriceBRL(imovel.valor)} <span className="text-[8px] font-normal text-slate-400">(Venda)</span>
                          </span>
                          <span className="font-extrabold text-emerald-800 text-[10px] leading-tight">
                            {formatPriceBRL(imovel.valorLocacao || 0)}/mês
                          </span>
                        </div>
                      ) : imovel.tipo === 'locação' ? (
                        <span className="font-extrabold text-emerald-800 text-xs sm:text-sm leading-tight">
                          {formatPriceBRL(imovel.valorLocacao || imovel.valor)}
                          <span className="text-[9px] font-normal text-slate-500"> /mês</span>
                        </span>
                      ) : (
                        <span className="font-extrabold text-[#003366] text-xs sm:text-sm leading-tight">
                          {formatPriceBRL(imovel.valor)}
                        </span>
                      )}
                    </div>
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

  // --- INITIAL LOADING SCREEN ---
  if (isInitialLoading) {
    return (
      <div className="bg-[#0F172A] min-h-screen flex flex-col justify-center items-center p-6 font-sans select-none">
        <div className="flex flex-col items-center space-y-5 animate-fade-in text-center">
          <div className="relative">
            <img
              src={logoImg}
              alt="ImobiShare Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-3xl border-2 border-white/20 shadow-2xl animate-pulse"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = LOGO_IMAGE; }}
            />
            <div className="absolute -inset-3 rounded-3xl bg-indigo-500/20 blur-xl -z-10 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase">ImobiShare</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Carregando sistema...</p>
          </div>
          <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mt-2" />
        </div>
      </div>
    );
  }

  // --- PUBLIC REAL ESTATE PORTAL (IMOBISHARE PORTAL ETAPA 1) ---
  if (appMode === 'portal') {
    return (
      <PortalApp
        realProperties={allImoveis}
        isLoggedIn={isAuthenticated}
        onOpenAuth={() => {
          if (isAuthenticated) {
            setAppMode('broker');
            window.location.hash = '#app';
          } else {
            setAuthMode('login');
            setAuthError('');
            setAppMode('auth');
            window.location.hash = '#auth';
          }
        }}
      />
    );
  }

  // --- LOGIN SCREEN IF NOT AUTHENTICATED OR EXPLICIT AUTH MODE ---
  if (appMode === 'auth' || !isAuthenticated) {
    return (
      <div className="bg-[#0F172A] min-h-screen flex flex-col justify-center items-center px-4 font-sans select-none relative" id="auth-screen">
        {renderResetPasswordModal()}
        
        {/* Back to Public Portal button */}
        <div className="w-full max-w-sm mb-3 px-1">
          <button
            type="button"
            onClick={() => {
              setAppMode('portal');
              window.location.hash = '#portal';
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            ← Voltar ao Portal Público ImobiShare
          </button>
        </div>

        <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl space-y-4 border border-gray-100 max-h-[95dvh] overflow-y-auto">
          <div className="text-center space-y-1">
            <img
              src={logoImg}
              alt="ImobiShare Logo"
              className="mx-auto w-14 h-14 object-contain rounded-2xl border border-slate-100 shadow-xs"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = LOGO_IMAGE; }}
            />
            <h1 className="text-xl font-black text-[#003366] tracking-tight uppercase animate-pulse">ImobiShare</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              {authMode === 'register' ? 'Crie sua conta profissional' : 'Acelere suas parcerias imobiliárias'}
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-xl border border-red-200 font-medium leading-relaxed" id="auth-error-banner">
              <p>{authError}</p>
            </div>
          )}

          {authMode === 'login' && (
            <div className="space-y-3">
              {/* EMAIL & PASSWORD LOGIN FORM */}
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="corretor@empresa.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Senha de acesso</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 px-4 rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer mt-1"
                >
                  {authLoading ? 'Entrando...' : 'Login'}
                </button>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot_password'); setAuthError(''); }}
                    className="text-slate-500 hover:text-[#003366] text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Esqueci a minha senha
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    className="text-[#003366] text-[11px] font-bold hover:underline cursor-pointer"
                  >
                    Criar conta
                  </button>
                </div>
              </form>
            </div>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-2.5">

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome Completo do Corretor"
                  value={regNome}
                  onChange={(e) => setRegNome(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Profissional *</label>
                <input
                  type="email"
                  required
                  placeholder="seuemail@empresa.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Senha *</label>
                <input
                  type="password"
                  required
                  placeholder="Sua senha de acesso"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CRECI *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 12345-F"
                  value={regCreci}
                  onChange={(e) => setRegCreci(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="(47) 99999-9999"
                  value={regTelefone}
                  onChange={(e) => {
                    setRegTelefone(e.target.value);
                    setRegWhatsapp(e.target.value);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cidade *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Balneário Camboriú"
                    value={regCidade}
                    onChange={(e) => setRegCidade(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Estado (UF) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="SC"
                    value={regEstado}
                    onChange={(e) => setRegEstado(e.target.value.toUpperCase())}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium uppercase text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Imobiliária (Opcional)</label>
                <input
                  type="text"
                  placeholder="Nome da imobiliária ou Autônomo"
                  value={regImobiliaria}
                  onChange={(e) => setRegImobiliaria(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 px-4 rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase mt-2 cursor-pointer"
              >
                {authLoading ? 'Criando Conta...' : 'Cadastrar e Acessar'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-xs text-slate-500 hover:text-[#003366] font-bold cursor-pointer"
                >
                  ← Voltar para Opções de Login
                </button>
              </div>
            </form>
          )}

          {authMode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Informe o e-mail da sua conta abaixo para receber um link seguro de redefinição de senha.
              </p>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">E-mail Cadastrado</label>
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

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 px-4 rounded-full shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer"
              >
                {authLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-xs text-[#003366] hover:underline font-bold cursor-pointer"
                >
                  Voltar ao Login
                </button>
              </div>
            </form>
          )}

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

        {/* Offline indicator bar if internet connection is lost */}
        {isOffline && (
          <div className="bg-amber-500 text-slate-900 text-[11px] font-bold px-4 py-1.5 flex items-center justify-center gap-1.5 border-b border-amber-600 shadow-xs select-none">
            <WifiOff size={13} className="text-slate-900 flex-shrink-0" />
            <span>Modo Offline: exibindo dados salvos no dispositivo</span>
          </div>
        )}

        {/* Dynamic Inner screens navigation */}
        <div className={`flex-grow ${
          searchViewMode === 'mapa' && activeTab === 'home' && !isAddingProperty && !selectedPropertyId
            ? 'overflow-hidden flex flex-col h-full pb-0'
            : 'overflow-y-auto ' + (
                activeTab === 'home' && !isAddingProperty && !selectedPropertyId 
                  ? (selectedPropertyIds.length > 0 ? 'pb-40' : 'pb-32') 
                  : 'pb-20'
              )
        }`}>
          
          {isAddingProperty ? (
            /* ADD / EDIT PROPERTY FORM */
            <PropertyForm
              imovelId={editingPropertyId}
              onSave={async (saved) => {
                await DbService.getImoveis();
                reloadData();
                setIsAddingProperty(false);
                setEditingPropertyId(null);
                setActiveTab('my-properties');
                triggerToast('Imóvel salvo com sucesso');
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
                <div 
                  className={
                    searchViewMode === 'mapa'
                      ? "flex-1 flex flex-col h-full overflow-hidden w-full"
                      : "space-y-4 touch-pan-y min-h-screen"
                  }
                  onTouchStart={searchViewMode === 'mapa' ? undefined : handleHomeTouchStart} 
                  onTouchEnd={searchViewMode === 'mapa' ? undefined : handleHomeTouchEnd} 
                  id="home-tab-view"
                >
                  {/* Instagram-inspired Top Bar */}
                  <div className="bg-white border-b border-gray-100 flex-shrink-0 sticky top-0 z-30 shadow-2xs">
                    <div className="px-5 pt-6 pb-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <img
                          src={logoImg}
                          alt="ImobiShare Logo"
                          className="w-7 h-7 object-contain rounded-lg border border-slate-100/50 shadow-xs"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = LOGO_IMAGE; }}
                        />
                        <h1 className="text-[#003366] text-base font-black tracking-tight uppercase leading-none">ImobiShare</h1>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setAppMode('portal');
                            window.location.hash = '#portal';
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-[#003366] bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200/80 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                          title="Acessar Portal Público de Imóveis"
                        >
                          <span>🌐 Portal</span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs shadow-xs" title="Notificações ativas">
                          🔔
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#003366] flex items-center justify-center text-white text-[10px] font-bold shadow-sm" title={`Logado como ${activeCorretor?.nome || 'Corretor'}`}>
                          {activeCorretor?.nome ? activeCorretor.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                        </div>
                      </div>
                    </div>

                    {/* Barra fina em movimento da direita para a esquerda indicando que os imóveis estão carregando */}
                    <div
                      className={`h-0.5 sm:h-1 w-full bg-slate-100 overflow-hidden relative transition-opacity duration-300 ${
                        (isLoadingImoveis || allImoveis.length === 0 || isRefreshing) ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {(isLoadingImoveis || allImoveis.length === 0 || isRefreshing) && (
                        <div className="h-full w-2/5 bg-gradient-to-l from-[#003366] via-blue-500 to-[#003366] rounded-full absolute right-0 animate-progress-rtl" />
                      )}
                    </div>
                  </div>

                  {/* STORIES BUBBLES CAROUSEL */}
                  {searchViewMode !== 'mapa' && storyImoveis.length > 0 && (
                    <div className="bg-white py-2.5 border-b border-slate-100">
                      <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none pb-0.5">
                        {storyImoveis.map((imovel) => (
                          <StoryBubble
                            key={imovel.id}
                            imovel={imovel}
                            corretor={imovel.corretorId ? corretoresMap.get(imovel.corretorId) : undefined}
                            onClick={() => setSelectedPropertyId(imovel.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FAVORITES CAROUSEL */}
                  {searchViewMode !== 'mapa' && favoriteImoveis.length > 0 && (
                    <div className="px-4 pt-1">
                      <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x">
                        {favoriteImoveis.map((imovel) => {
                          const buildingName = imovel.nomeEdificio?.trim() || imovel.titulo;
                          const hasBoth = Boolean(((imovel.valor && imovel.valor > 0) || (imovel.valorVenda && imovel.valorVenda > 0)) && (imovel.valorLocacao && imovel.valorLocacao > 0));

                          return (
                            <motion.div
                              whileTap={{ scale: 0.97 }}
                              whileHover={{ y: -2 }}
                              key={imovel.id}
                              onClick={() => setSelectedPropertyId(imovel.id)}
                              className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs flex-shrink-0 w-28 sm:w-32 cursor-pointer hover:border-[#003366] hover:shadow-xs transition-all snap-start flex flex-col"
                            >
                              <div className="h-20 w-full bg-slate-100 relative overflow-hidden flex-shrink-0">
                                <img 
                                  src={getValidImage(imovel.fotos?.[0])} 
                                  alt={buildingName} 
                                  onError={handleImageError} 
                                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                                  referrerPolicy="no-referrer" 
                                />
                                {/* Coração no canto superior esquerdo da imagem */}
                                <div className="absolute top-1.5 left-1.5 bg-white/80 backdrop-blur-xs p-1 rounded-full shadow-xs">
                                  <Heart size={12} className="text-rose-500 fill-rose-500" />
                                </div>
                              </div>
                              <div className="p-1.5 flex flex-col justify-between flex-1 gap-0.5 leading-none">
                                <h4 
                                  className="font-extrabold text-slate-800 text-[9px] leading-tight line-clamp-2" 
                                  title={buildingName}
                                >
                                  {buildingName}
                                </h4>
                                <div className="pt-0.5 leading-none">
                                  {hasBoth ? (
                                    <div className="flex flex-col gap-0.5 leading-none">
                                      <span className="text-[#003366] font-extrabold text-[9px] block truncate">
                                        {formatPriceBRL(imovel.valor || imovel.valorVenda || 0)}
                                      </span>
                                      <span className="text-emerald-800 font-extrabold text-[8px] block truncate">
                                        A: {formatPriceBRL(imovel.valorLocacao!)}/mês
                                      </span>
                                    </div>
                                  ) : imovel.tipo === 'locação' && imovel.valorLocacao ? (
                                    <span className="text-emerald-800 font-extrabold text-[9px] block truncate leading-none">
                                      {formatPriceBRL(imovel.valorLocacao)}/mês
                                    </span>
                                  ) : (
                                    <span className="text-[#003366] font-extrabold text-[9px] block truncate leading-none">
                                      {formatPriceBRL(imovel.valor || imovel.valorVenda || 0)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SEARCH CARD & PILLS GROUP WITH TIGHT LINE SPACING */}
                  <div className={searchViewMode === 'mapa' ? "flex-shrink-0 bg-white border-b border-slate-100/80 shadow-xs" : "space-y-1"}>
                    {/* 1. MAIN SEARCH CARD */}
                    <div className={`px-4 ${searchViewMode === 'mapa' ? 'py-2' : 'pt-1'}`}>
                      <div
                        onClick={() => {
                          if (!isSearchingEmpreendimento) {
                            setIsSearchingEmpreendimento(true);
                            setTimeout(() => empreendimentoInputRef.current?.focus(), 50);
                          }
                        }}
                        className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-[#003366]/40 transition-all flex items-center justify-between gap-3 cursor-pointer"
                      >
                        {/* Left: Two-line textual summary with instant inline enterprise search */}
                        <div className="flex-1 min-w-0">
                          {isSearchingEmpreendimento ? (
                            <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                              {/* 1st line: Seamless text input with search icon, smaller font, no underline */}
                              <div className="relative flex items-center">
                                <Search size={16} className="text-slate-400 flex-shrink-0 mr-2" />
                                <input
                                  ref={empreendimentoInputRef}
                                  type="text"
                                  placeholder="Buscar Imóvel"
                                  value={searchWord}
                                  onChange={(e) => {
                                    setSearchWord(e.target.value);
                                    setHomePage(1);
                                  }}
                                  onBlur={() => {
                                    if (!searchWord.trim()) {
                                      setIsSearchingEmpreendimento(false);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      empreendimentoInputRef.current?.blur();
                                    }
                                    if (e.key === 'Escape') {
                                      setSearchWord('');
                                      setHomePage(1);
                                      setIsSearchingEmpreendimento(false);
                                    }
                                  }}
                                  className="w-full text-xs sm:text-sm font-medium text-slate-800 bg-transparent border-0 border-none outline-hidden focus:outline-hidden focus:ring-0 p-0 pr-6 placeholder:text-slate-400 placeholder:font-normal"
                                  autoFocus
                                />
                                {searchWord ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSearchWord('');
                                      setHomePage(1);
                                      empreendimentoInputRef.current?.focus();
                                    }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    title="Limpar busca"
                                  >
                                    <X size={14} />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setIsSearchingEmpreendimento(false)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-0.5 cursor-pointer"
                                    title="Fechar"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              {/* 1st line: Cidade e bairro com mais imóveis ou Empreendimento ativo */}
                              <div className="mb-0.5 flex items-center gap-1.5 min-w-0">
                                {searchWord ? (
                                  <>
                                    <h3 className="text-sm sm:text-base font-extrabold text-[#003366] tracking-tight truncate flex items-center gap-1">
                                      <Building size={15} className="text-[#003366] flex-shrink-0" />
                                      <span>{searchWord}</span>
                                    </h3>
                                    <span className="text-[11px] text-slate-400 font-medium truncate">
                                      em {searchCardCityAndNeighborhood}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchWord('');
                                        setHomePage(1);
                                      }}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 ml-0.5 cursor-pointer"
                                      title="Remover filtro de empreendimento"
                                    >
                                      <X size={13} />
                                    </button>
                                  </>
                                ) : (
                                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate hover:text-[#003366] transition-colors">
                                    {searchCardCityAndNeighborhood}
                                  </h3>
                                )}
                              </div>

                              {/* 2nd line: Informações menores (Venda - Sem filtros de imóvel) */}
                              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                                {searchWord ? `${searchWord} • ${searchCardSubtext}` : searchCardSubtext}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: Circular filter button with very light gray background */}
                        <button
                          type="button"
                          id="btn-search-card-filters"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterModalTab('home');
                            setIsFilterModalOpen(true);
                          }}
                          className="w-11 h-11 rounded-full bg-slate-100/90 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer border border-slate-200/50 shadow-xs relative"
                          title="Filtros de busca"
                          aria-label="Filtros de busca"
                        >
                          <SlidersHorizontal size={18} className="text-slate-700" />
                          {getActiveFilterCount() > 2 && (
                            <span className="absolute -top-1 -right-1 bg-[#003366] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs">
                              {getActiveFilterCount() - 2}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 2. CATEGORY & VALUE PILLS (Horizontal Capsules) - Only in list mode */}
                    {searchViewMode !== 'mapa' && (
                      <>
                        {/* 2. CATEGORY PILLS (Horizontal Capsules) */}
                        <div className="px-4">
                      <div className="flex items-center gap-[7px] overflow-x-auto no-scrollbar scrollbar-none py-0.5">
                        {[
                          { id: 'todos', label: 'Todos' },
                          { id: 'Apartamento', label: 'Apartamento' },
                          { id: 'Casa', label: 'Casa' },
                          { id: 'Cobertura', label: 'Cobertura' },
                          { id: 'Sobrado', label: 'Sobrado' },
                          { id: 'Terreno', label: 'Terreno' },
                          { id: 'Comercial', label: 'Comercial' },
                          { id: 'Diferenciado', label: 'Diferenciado' },
                          { id: 'Outro', label: 'Outro' },
                        ].map((cat) => {
                          const isSelected = filterTipoImovel.toLowerCase() === cat.id.toLowerCase();
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setFilterTipoImovel(cat.id);
                                setHomePage(1);
                              }}
                              className={`px-[7px] py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer flex-shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2.1 VALUE / PRICE PILLS (Horizontal Capsules for Values) */}
                    <div className="px-4">
                      <div className="flex items-center gap-[7px] overflow-x-auto no-scrollbar scrollbar-none py-0.5">
                        {(filterTipo === 'alugar' ? [
                          { id: 'todos', label: 'Todos', min: 0, max: 15000000 },
                          { id: 'ate_2k5', label: 'Até R$ 2.500', min: 0, max: 2500 },
                          { id: '2k5_5k', label: 'R$ 2.500 a 5.000', min: 2500, max: 5000 },
                          { id: '5k_10k', label: 'R$ 5.000 a 10.000', min: 5000, max: 10000 },
                          { id: '10k_20k', label: 'R$ 10.000 a 20.000', min: 10000, max: 20000 },
                          { id: 'acima_20k', label: 'Acima de R$ 20.000', min: 20000, max: 15000000 },
                        ] : [
                          { id: 'todos', label: 'Todos', min: 0, max: 15000000 },
                          { id: 'ate_500k', label: 'Até R$ 500 mil', min: 0, max: 500000 },
                          { id: '500k_1m', label: 'R$ 500 mil a 1 mi', min: 500000, max: 1000000 },
                          { id: '1m_2m', label: 'R$ 1 mi a 2 mi', min: 1000000, max: 2000000 },
                          { id: '2m_3m', label: 'R$ 2 mi a 3 mi', min: 2000000, max: 3000000 },
                          { id: '3m_5m', label: 'R$ 3 mi a 5 mi', min: 3000000, max: 5000000 },
                          { id: 'acima_5m', label: 'Acima de R$ 5 mi', min: 5000000, max: 15000000 },
                        ]).map((band) => {
                          const isSelected =
                            band.min === 0 && band.max >= 15000000
                              ? filterValorMin === 0 && (filterValorMax === 0 || filterValorMax >= 15000000)
                              : band.max >= 15000000
                              ? filterValorMin === band.min && (filterValorMax === 0 || filterValorMax >= 15000000)
                              : filterValorMin === band.min && filterValorMax === band.max;

                          return (
                            <button
                              key={band.id}
                              type="button"
                              onClick={() => {
                                if (band.min === 0 && band.max >= 15000000) {
                                  setFilterValorMin(0);
                                  setFilterValorMax(15000000);
                                } else {
                                  setFilterValorMin(band.min);
                                  setFilterValorMax(band.max);
                                }
                                setHomePage(1);
                              }}
                              className={`px-[7px] py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer flex-shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {band.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                      </>
                    )}
                  </div>

                  {/* 3. MAIN CONTENT: FULL SCREEN MAP OR PROPERTY SEARCH RESULTS LIST */}
                  {searchViewMode === 'mapa' ? (
                    <div className="flex-1 w-full relative min-h-0 overflow-hidden" id="full-screen-map-container">
                      <MapView
                        imoveis={filteredImoveis}
                        selectedIds={selectedPropertyIds}
                        onSelectToggle={handleSelectToggle}
                        onViewDetails={setSelectedPropertyId}
                        isFullScreen
                        onClusterChange={setIsMapClusterOpen}
                      />
                    </div>
                  ) : (
                    <div className="px-4 space-y-3.5 pt-1" id="property-search-results-section">
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Contagem de imóveis e página ao lado na mesma linha */}
                      <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                          {filteredImoveis.length.toLocaleString('pt-BR')} {filteredImoveis.length === 1 ? 'imóvel' : 'imóveis'}
                        </h2>
                      </div>

                      {/* Right: Selected badge (if any) and Sort icon button without borders */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {selectedPropertyIds.length > 0 && (
                          <span className="text-[10px] font-bold text-[#003366] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                            {selectedPropertyIds.length} selecionado(s)
                          </span>
                        )}

                        {/* Sorting button: only icon, without borders, on the right */}
                        <div className="relative">
                          <button
                            type="button"
                            id="btn-sort-results"
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                            className="p-1.5 text-slate-600 hover:text-[#003366] active:scale-95 transition-all cursor-pointer rounded-lg hover:bg-slate-100"
                            title="Ordenar resultados"
                            aria-label="Ordenar resultados"
                          >
                            <ArrowUpDown size={18} className={sortBy !== 'relevancia' ? 'text-[#003366]' : 'text-slate-600'} />
                          </button>

                          {isSortMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsSortMenuOpen(false)} />
                              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-40 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                                  Ordenar resultados
                                </div>
                                {[
                                  { id: 'relevancia', label: 'Relevância (Padrão)' },
                                  { id: 'menor_preco', label: 'Menor preço' },
                                  { id: 'maior_preco', label: 'Maior preço' },
                                  { id: 'mais_recentes', label: 'Mais recentes' },
                                  { id: 'maior_area', label: 'Maior metragem' },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setSortBy(opt.id as any);
                                      setIsSortMenuOpen(false);
                                      setHomePage(1);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                      sortBy === opt.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span>{opt.label}</span>
                                    {sortBy === opt.id && <Check size={14} className="stroke-[3]" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const favSet = new Set(favoritos);
                        const selSet = new Set(selectedPropertyIds);
                        return paginatedHomeImoveis.map((imovel) => {
                          const isMine = isMyProperty(imovel);
                          const isFav = favSet.has(imovel.id) || imovel.favorito === true;
                          const isSel = selSet.has(imovel.id);

                          if (searchViewMode === 'lista') {
                            return (
                              <CompactPropertyRow
                                key={imovel.id}
                                imovel={imovel}
                                isMyProperty={isMine}
                                isFavorite={isFav}
                                isSelected={isSel}
                                onSelectToggle={() => handleSelectToggle(imovel.id)}
                                onShareSingle={() => handleShareSingleProperty(imovel)}
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
                              onShareSingle={() => handleShareSingleProperty(imovel)}
                              onClick={() => setSelectedPropertyId(imovel.id)}
                            />
                          );
                        });
                      })()}

                      {filteredImoveis.length === 0 && (
                        <div className="text-center py-10 bg-white border border-slate-100 rounded-xl">
                          <span className="text-xs text-slate-400">Nenhum imóvel encontrado com os filtros selecionados.</span>
                        </div>
                      )}

                      {/* CONTROLE "VER MAIS" (carregamento contínuo sem barra de paginação) */}
                      {filteredImoveis.length > PAGE_SIZE && currentHomePage < totalHomePages && (
                        <div className="pt-2 pb-6" id="home-pagination-controls">
                          <button
                            type="button"
                            onClick={() => handleHomePageChange(currentHomePage + 1)}
                            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99] border border-blue-500/30"
                          >
                            <span>Ver mais imóveis</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

              {activeTab === 'my-properties' && (
                <div className="p-3.5 space-y-3" id="my-properties-tab-view">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-extrabold text-slate-800 text-sm sm:text-base truncate whitespace-nowrap">Meus Imóveis Cadastrados</h2>
                        <p className="text-xs text-slate-400 truncate">Gerencie, edite, exclua e compartilhe seus imóveis</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          setEditingPropertyId(null);
                          setIsAddingProperty(true);
                        }}
                        title="Cadastrar Novo Imóvel"
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl flex items-center justify-center shadow-xs transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <PlusCircle size={16} />
                      </button>
                    </div>

                    {/* Search Field + Filter Button */}
                    <div className="flex items-center gap-2 w-full">
                      <div className="relative flex-1 min-w-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={myPropertiesSearch}
                          onChange={(e) => setMyPropertiesSearch(e.target.value)}
                          placeholder="Buscar nos meus imóveis (título, bairro, código...)"
                          className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:border-[#003366] transition-all shadow-xs"
                        />
                        {myPropertiesSearch && (
                          <button
                            onClick={() => setMyPropertiesSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                            title="Limpar busca"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => { setFilterModalTab('my-properties'); setIsFilterModalOpen(true); }}
                        className="relative bg-white hover:bg-slate-50 border border-slate-200 text-[#003366] p-2 rounded-lg font-medium text-xs flex items-center justify-center shadow-xs transition-colors cursor-pointer flex-shrink-0"
                        title="Filtros Avançados"
                      >
                        <SlidersHorizontal size={15} />
                        {getMyPropertiesActiveFilterCount() > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-[#003366] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                            {getMyPropertiesActiveFilterCount()}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* My properties list in list format */}
                    <div className="bg-slate-100/70 p-1 sm:p-1.5 rounded-xl border border-slate-200/50 space-y-1.5">
                      {filteredMyProperties.map((imovel) => {
                        return (
                          <CompactPropertyRow
                            key={imovel.id}
                            imovel={imovel}
                            isMyProperty={true}
                            onEdit={() => {
                              setEditingPropertyId(imovel.id);
                              setIsAddingProperty(true);
                            }}
                            onWebsiteToggle={() => handleWebsiteToggle(imovel.id)}
                            onShareToggle={() => handleShareToggle(imovel.id)}
                            onDelete={() => handleDeleteProperty(imovel.id)}
                            onClick={() => setSelectedPropertyId(imovel.id)}
                          />
                        );
                      })}

                      {rawMyProperties.length === 0 && (
                        <div className="text-center py-12 bg-white border border-slate-100 rounded-xl space-y-2">
                          <p className="text-xs text-slate-400">Você ainda não tem imóveis cadastrados.</p>
                          <button
                            onClick={() => setIsAddingProperty(true)}
                            className="text-xs font-bold text-[#003366] hover:underline cursor-pointer"
                          >
                            Cadastre seu primeiro imóvel agora!
                          </button>
                        </div>
                      )}

                      {rawMyProperties.length > 0 && filteredMyProperties.length === 0 && (
                        <div className="text-center py-10 bg-white border border-slate-100 rounded-xl space-y-2">
                          <p className="text-xs text-slate-400">Nenhum imóvel encontrado para "{myPropertiesSearch}".</p>
                          <button
                            onClick={() => setMyPropertiesSearch('')}
                            className="text-xs font-bold text-[#003366] hover:underline cursor-pointer"
                          >
                            Limpar busca
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
              )}
              {activeTab === 'profile' && activeCorretor && (
                <div id="profile-tab-view">
                  <UserProfile
                    corretor={activeCorretor}
                    onProfileSwitched={(newBroker) => {
                      reloadData(true);
                    }}
                    onLogout={handleLogout}
                  />
                </div>
              )}

              {activeTab === 'support' && activeCorretor && (
                <SupportForm
                  activeCorretor={activeCorretor}
                  onBack={() => handleTabChange('home')}
                  triggerToast={triggerToast}
                />
              )}
            </>
          )}

        </div>

        {/* MULTIPLE SHARE ACTION FLOATING BAR */}
        <AnimatePresence>
          {selectedPropertyIds.length > 0 && !isAddingProperty && !selectedPropertyId && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="absolute bottom-18 left-4 right-4 bg-blue-600 text-white px-4 py-2.5 rounded-full shadow-xl flex items-center justify-between z-30 border border-white/20"
              id="multi-selection-floating-bar"
            >
              <div className="flex items-center gap-2">
                <span className="text-[8.5px] font-semibold uppercase tracking-wider text-amber-300 bg-black/20 px-2 py-0.5 rounded-full">
                  {selectedPropertyIds.length} {selectedPropertyIds.length === 1 ? 'imóvel selecionado' : 'imóveis selecionados'}
                </span>
                <button
                  onClick={() => setSelectedPropertyIds([])}
                  className="text-white/80 hover:text-white text-[9px] font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Limpar
                </button>
              </div>
              
              <button
                onClick={handleShareMultiple}
                title="Compartilhar selecionados"
                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Share2 size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>



        {/* Floating single toggle button: Mostrar mapa / Mostrar lista */}
        {activeTab === 'home' && !selectedPropertyId && !isAddingProperty && selectedPropertyIds.length === 0 && (
          <div className={`absolute ${
            searchViewMode === 'mapa'
              ? (isMapClusterOpen ? 'bottom-72' : 'bottom-5')
              : 'bottom-20'
          } left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all duration-300`}>
            <button
              type="button"
              id="btn-floating-view-toggle"
              onClick={() => {
                if (searchViewMode === 'mapa') {
                  setSearchViewMode('como_esta_hoje');
                } else {
                  setSearchViewMode('mapa');
                }
              }}
              className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-[0_8px_25px_rgba(37,99,235,0.35)] active:scale-95 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center border border-white/25"
            >
              {searchViewMode === 'mapa' ? 'Mostrar lista' : 'Mostrar mapa'}
            </button>
          </div>
        )}

        {/* BOTTOM NAVIGATION TABS MENU (Similar to native mobile tabs bar) - Hidden when viewing map */}
        {!isAddingProperty && !selectedPropertyId && !(activeTab === 'home' && searchViewMode === 'mapa') && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-20">
            <button
              onClick={() => handleTabChange('home')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'home' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-home"
            >
              <HomeIcon size={18} className={activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Início</span>
            </button>

            <button
              onClick={() => handleTabChange('my-properties')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'my-properties' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-my-properties"
            >
              <Building size={18} className={activeTab === 'my-properties' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Imóveis</span>
            </button>

            <button
              onClick={() => handleTabChange('support')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'support' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-support"
            >
              <MessageCircle size={18} className={activeTab === 'support' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Suporte</span>
            </button>

            <button
              onClick={() => handleTabChange('profile')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'profile' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-profile"
            >
              <User size={18} className={activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Perfil</span>
            </button>
          </div>
        )}

        {/* COMPREHENSIVE SEARCH FILTER MODAL */}
        <AnimatePresence>
          {isFilterModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ duration: 0.2 }}
                className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100"
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#003366]/10 text-[#003366] flex items-center justify-center">
                      <SlidersHorizontal size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {filterModalTab === 'home' ? 'Filtro da Tela Início' : 'Filtro dos Meus Imóveis'}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {filterModalTab === 'home' ? 'Refine os imóveis exibidos na tela inicial' : 'Refine a busca nos seus imóveis cadastrados'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(filterModalTab === 'home' ? getActiveFilterCount() : getMyPropertiesActiveFilterCount()) > 0 && (
                      <button
                        onClick={handleResetFilters}
                        className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Limpar tudo
                      </button>
                    )}
                    <button
                      onClick={() => setIsFilterModalOpen(false)}
                      className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-500 transition-all cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Scrollable Form */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
                  {/* Busca por Palavra-Chave / Código */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                      Buscar por termo, edifício ou código
                    </label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Ex: frente mar, piscina, FRE01..."
                        value={filterModalTab === 'home' ? searchWord : myPropertiesSearch}
                        onChange={(e) => filterModalTab === 'home' ? setSearchWord(e.target.value) : setMyPropertiesSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:border-[#003366]"
                      />
                      {(filterModalTab === 'home' ? searchWord : myPropertiesSearch) && (
                        <button
                          type="button"
                          onClick={() => filterModalTab === 'home' ? setSearchWord('') : setMyPropertiesSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. Tipo de Negócio */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">1. Tipo de Negócio</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl font-bold">
                      <button
                        type="button"
                        onClick={() => filterModalTab === 'home' ? setFilterTipo('todos') : setFilterMyTipo('todos')}
                        className={`py-2 rounded-lg text-xs transition-all ${(filterModalTab === 'home' ? filterTipo : filterMyTipo) === 'todos' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => filterModalTab === 'home' ? setFilterTipo('comprar') : setFilterMyTipo('comprar')}
                        className={`py-2 rounded-lg text-xs transition-all ${(filterModalTab === 'home' ? filterTipo : filterMyTipo) === 'comprar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
                      >
                        Venda
                      </button>
                      <button
                        type="button"
                        onClick={() => filterModalTab === 'home' ? setFilterTipo('alugar') : setFilterMyTipo('alugar')}
                        className={`py-2 rounded-lg text-xs transition-all ${(filterModalTab === 'home' ? filterTipo : filterMyTipo) === 'alugar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
                      >
                        Alugar (Locação)
                      </button>
                    </div>
                  </div>

                  {/* 2. Cidade e Bairro */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">2. Cidade</label>
                      <select
                        value={filterModalTab === 'home' ? filterCidade : filterMyCidade}
                        onChange={(e) => filterModalTab === 'home' ? setFilterCidade(e.target.value) : setFilterMyCidade(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#003366]"
                      >
                        {(filterModalTab === 'home' ? availableCities : availableMyCities).map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                        <option value="Todas">Todas As Cidades</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">3. Bairro / Região</label>
                      <input
                        type="text"
                        placeholder="Ex: Todos os bairros, ou digite Barra Sul, Meia Praia..."
                        value={filterModalTab === 'home' ? filterBairro : filterMyBairro}
                        onChange={(e) => filterModalTab === 'home' ? setFilterBairro(e.target.value) : setFilterMyBairro(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:border-[#003366]"
                      />
                    </div>
                  </div>

                  {/* 3. Tipo de Imóvel */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">4. Tipo de Imóvel</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'Apartamento', label: 'Apartamento' },
                        { id: 'Casa', label: 'Casa / Sobrado' },
                        { id: 'Cobertura', label: 'Cobertura' },
                        { id: 'Terreno', label: 'Terreno / Lote' },
                        { id: 'Comercial', label: 'Comercial' },
                      ].map((t) => {
                        const cur = filterModalTab === 'home' ? filterTipoImovel : filterMyTipoImovel;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => filterModalTab === 'home' ? setFilterTipoImovel(t.id) : setFilterMyTipoImovel(t.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              cur === t.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status do Imóvel */}
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Status do Imóvel</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'todos', label: 'Todos os Status' },
                        { id: 'Na planta', label: 'Na Planta' },
                        { id: 'Mobiliado', label: 'Mobiliado' },
                        { id: 'Sem mobília', label: 'Sem Mobília' },
                      ].map((st) => {
                        const cur = filterModalTab === 'home' ? filterStatusImovel : filterMyStatusImovel;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => filterModalTab === 'home' ? setFilterStatusImovel(st.id) : setFilterMyStatusImovel(st.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              cur === st.id
                                ? 'bg-blue-600 text-white border-blue-600'
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
                      <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">5. Faixa de Valor (R$)</label>
                      {((filterModalTab === 'home' ? filterValorMin : filterMyValorMin) > 0 || (filterModalTab === 'home' ? filterValorMax : filterMyValorMax) < 15000000) && (
                        <button
                          onClick={() => {
                            if (filterModalTab === 'home') {
                              setFilterValorMin(0); setFilterValorMax(15000000);
                            } else {
                              setFilterMyValorMin(0); setFilterMyValorMax(15000000);
                            }
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
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
                          value={(filterModalTab === 'home' ? filterValorMin : filterMyValorMin) === 0 ? '' : (filterModalTab === 'home' ? filterValorMin : filterMyValorMin)}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            if (filterModalTab === 'home') setFilterValorMin(val);
                            else setFilterMyValorMin(val);
                          }}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Máximo</span>
                        <input
                          type="number"
                          placeholder="R$ Máximo"
                          value={((filterModalTab === 'home' ? filterValorMax : filterMyValorMax) === 15000000 || (filterModalTab === 'home' ? filterValorMax : filterMyValorMax) === 0) ? '' : (filterModalTab === 'home' ? filterValorMax : filterMyValorMax)}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            if (filterModalTab === 'home') setFilterValorMax(val);
                            else setFilterMyValorMax(val);
                          }}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Shortcuts for price */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        { label: 'Até R$ 1 Mio', min: 0, max: 1000000 },
                        { label: 'R$ 1M a 3M', min: 1000000, max: 3000000 },
                        { label: 'R$ 3M a 5M', min: 3000000, max: 5000000 },
                        { label: 'R$ 5M+', min: 5000000, max: 15000000 },
                      ].map((shortcut) => (
                        <button
                          key={shortcut.label}
                          type="button"
                          onClick={() => {
                            if (filterModalTab === 'home') {
                              setFilterValorMin(shortcut.min); setFilterValorMax(shortcut.max);
                            } else {
                              setFilterMyValorMin(shortcut.min); setFilterMyValorMax(shortcut.max);
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 transition-all cursor-pointer"
                        >
                          {shortcut.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Cômodos e Especificações */}
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">6. Cômodos Mínimos</label>

                    {/* Quartos */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">Quartos / Dormitórios</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((num) => {
                          const cur = filterModalTab === 'home' ? filterDormitorios : filterMyDormitorios;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => filterModalTab === 'home' ? setFilterDormitorios(num) : setFilterMyDormitorios(num)}
                              className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                cur === num
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {num === 0 ? 'Qualq.' : `${num}+`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Banheiros / BWC */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">Banheiros / BWC</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((num) => {
                          const cur = filterModalTab === 'home' ? filterBanheiros : filterMyBanheiros;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => filterModalTab === 'home' ? setFilterBanheiros(num) : setFilterMyBanheiros(num)}
                              className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                cur === num
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {num === 0 ? 'Qualq.' : `${num}+`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Vagas */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">Vagas de Garagem</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((num) => {
                          const cur = filterModalTab === 'home' ? filterVagas : filterMyVagas;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => filterModalTab === 'home' ? setFilterVagas(num) : setFilterMyVagas(num)}
                              className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                cur === num
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {num === 0 ? 'Qualq.' : `${num}+`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 6. Metragem Privativa - only for Home */}
                  {filterModalTab === 'home' && (
                    <div className="space-y-1.5 border-t border-slate-100 pt-3">
                      <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">7. Metragem Privativa (m²)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Área Mínima</span>
                          <input
                            type="number"
                            placeholder="Ex: 80 m²"
                            value={filterMetragemMin === 0 ? '' : filterMetragemMin}
                            onChange={(e) => setFilterMetragemMin(e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Área Máxima</span>
                          <input
                            type="number"
                            placeholder="Ex: 300 m²"
                            value={filterMetragemMax === 0 ? '' : filterMetragemMax}
                            onChange={(e) => setFilterMetragemMax(e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 7. Fonte de Imóveis - only for Home */}
                  {filterModalTab === 'home' && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">8. Origem e Visibilidade</label>
                      <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterMeusImoveis}
                            onChange={(e) => setFilterMeusImoveis(e.target.checked)}
                            className="w-4 h-4 text-[#003366] rounded accent-[#003366]"
                          />
                          <span className="font-semibold text-slate-800">Meus imóveis cadastrados</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterOutrosCorretores}
                            onChange={(e) => setFilterOutrosCorretores(e.target.checked)}
                            className="w-4 h-4 text-[#003366] rounded accent-[#003366]"
                          />
                          <span className="font-semibold text-slate-800">Rede de Parcerias (Outros Corretores)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterIntegracao}
                            onChange={(e) => setFilterIntegracao(e.target.checked)}
                            className="w-4 h-4 text-amber-500 rounded accent-amber-500"
                          />
                          <span className="font-semibold text-slate-800">Integração com Portais CRM</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200/60">
                          <input
                            type="checkbox"
                            checked={filterApenasFavoritos}
                            onChange={(e) => setFilterApenasFavoritos(e.target.checked)}
                            className="w-4 h-4 text-rose-500 rounded accent-rose-500"
                          />
                          <span className="font-bold text-rose-700 flex items-center gap-1">
                            <Heart size={13} className="fill-rose-500 text-rose-500" />
                            Apenas meus imóveis Favoritos
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-xs transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterModalOpen(false)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer text-center"
                  >
                    Ver {filterModalTab === 'home' ? filteredImoveis.length : filteredMyProperties.length} Imóveis Encontrados
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Redefinição de Senha (via Link com Token) */}
        {renderResetPasswordModal()}

      </div>
    </div>
  );
}
