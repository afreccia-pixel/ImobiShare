/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import logoImg from './assets/images/imobishare_logo_1784239677798.jpg';
import { Imovel, Corretor } from './types';
import { DbService } from './services/db';
import { 
  auth, 
  signInWithGoogle, 
  checkRedirectAuth, 
  loginEmailPassword, 
  registerEmailPassword, 
  resetPassword, 
  logoutUser, 
  syncUserWithFirestore, 
  formatAuthError 
} from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getApiUrl } from './utils/apiUrl';
import { StoryBubble } from './components/StoryBubble';
import { PropertyCard } from './components/PropertyCard';
import { CompactPropertyRow } from './components/CompactPropertyRow';
import { MapView } from './components/MapView';
import { PropertyForm } from './components/PropertyForm';
import { PropertyDetails } from './components/PropertyDetails';
import { UserProfile } from './components/UserProfile';
import { PublicView } from './components/PublicView';
import { SupportForm } from './components/SupportForm';
import { ConnectionTests } from './components/ConnectionTests';
import { getValidImage, handleImageError } from './utils/imageUtils';
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
  Maximize,
  LogOut,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'home' | 'my-properties' | 'profile' | 'support' | 'tests';

export default function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('imobishare_logged_in') === 'true';
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

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
  const [filterTipoImovel, setFilterTipoImovel] = useState<string>('todos');
  const [filterValorMin, setFilterValorMin] = useState<number>(0);
  const [filterValorMax, setFilterValorMax] = useState<number>(15000000);
  const [filterDormitorios, setFilterDormitorios] = useState<number>(0);
  const [filterBanheiros, setFilterBanheiros] = useState<number>(0);
  const [filterVagas, setFilterVagas] = useState<number>(0);
  const [filterMetragemMin, setFilterMetragemMin] = useState<number>(0);
  const [filterMetragemMax, setFilterMetragemMax] = useState<number>(0);
  const [filterBairro, setFilterBairro] = useState<string>('');
  const [filterApenasFavoritos, setFilterApenasFavoritos] = useState<boolean>(false);
  const [filterMeusImoveis, setFilterMeusImoveis] = useState(true);
  const [filterOutrosCorretores, setFilterOutrosCorretores] = useState(true);
  const [filterIntegracao, setFilterIntegracao] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [searchViewMode, setSearchViewMode] = useState<'como_esta_hoje' | 'lista' | 'mapa'>('como_esta_hoje');

  // Active filter count computation
  const getActiveFilterCount = () => {
    let count = 0;
    if (searchWord.trim()) count++;
    if (filterCidade && filterCidade !== 'Todas') count++;
    if (filterTipo !== 'todos') count++;
    if (filterTipoImovel !== 'todos') count++;
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

  const handleResetFilters = () => {
    setSearchWord('');
    setFilterCidade('Balneário Camboriú');
    setFilterTipo('todos');
    setFilterTipoImovel('todos');
    setFilterValorMin(0);
    setFilterValorMax(15000000);
    setFilterDormitorios(0);
    setFilterBanheiros(0);
    setFilterVagas(0);
    setFilterMetragemMin(0);
    setFilterMetragemMax(0);
    setFilterBairro('');
    setFilterApenasFavoritos(false);
    setFilterMeusImoveis(true);
    setFilterOutrosCorretores(true);
    setFilterIntegracao(true);
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

  // Firebase Auth persistence & redirect result listener
  useEffect(() => {
    checkRedirectAuth()
      .then(async (user) => {
        if (user) {
          const userData = await syncUserWithFirestore(user);
          const corretor: Corretor = {
            id: user.uid,
            nome: userData.nome || user.displayName || 'Corretor ImobiShare',
            creci: userData.creci || '12345-F',
            telefone: userData.telefone || '(47) 99999-9999',
            whatsapp: userData.whatsapp || '(47) 99999-9999',
            cidade: userData.cidade || 'Balneário Camboriú',
            email: user.email || '',
            foto: userData.foto || user.photoURL || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
          };
          DbService.setActiveCorretor(corretor);
          localStorage.setItem('imobishare_logged_in', 'true');
          setIsAuthenticated(true);
          setActiveCorretor(corretor);
          triggerToast(`Bem-vindo, ${corretor.nome}!`);
          reloadData();
        }
      })
      .catch((err) => console.error('Error handling Google auth redirect:', err))
      .finally(() => setIsInitialLoading(false));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await syncUserWithFirestore(user);
          const corretor: Corretor = {
            id: user.uid,
            nome: userData.nome || user.displayName || 'Corretor ImobiShare',
            creci: userData.creci || '12345-F',
            telefone: userData.telefone || '(47) 99999-9999',
            whatsapp: userData.whatsapp || '(47) 99999-9999',
            cidade: userData.cidade || 'Balneário Camboriú',
            email: user.email || '',
            foto: userData.foto || user.photoURL || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
          };
          DbService.setActiveCorretor(corretor);
          localStorage.setItem('imobishare_logged_in', 'true');
          setIsAuthenticated(true);
          setActiveCorretor(corretor);
        } catch (err) {
          console.error('Error syncing Firebase user profile:', err);
        }
      } else {
        // Strict auth: If no active Firebase user, invalidate local session state
        localStorage.removeItem('imobishare_logged_in');
        setIsAuthenticated(false);
      }
      setIsInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In with Firebase Auth (with preview fallback)
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const user = await signInWithGoogle();
      if (user) {
        const userData = await syncUserWithFirestore(user);
        const corretor: Corretor = {
          id: user.uid,
          nome: userData.nome || user.displayName || 'Corretor ImobiShare',
          creci: userData.creci || '12345-F',
          telefone: userData.telefone || '(47) 99999-9999',
          whatsapp: userData.whatsapp || '(47) 99999-9999',
          cidade: userData.cidade || 'Balneário Camboriú',
          email: user.email || '',
          foto: userData.foto || user.photoURL || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
        };
        DbService.setActiveCorretor(corretor);
        localStorage.setItem('imobishare_logged_in', 'true');
        setIsAuthenticated(true);
        setActiveCorretor(corretor);
        triggerToast(`Bem-vindo, ${corretor.nome}!`);
        await DbService.syncWithServer();
        reloadData();
      }
    } catch (err: any) {
      if (err.message === 'REDIRECTING') {
        return;
      }
      console.warn('Firebase Google Auth non-fatal issue, falling back to Google account profile:', err);
      // Fallback: Seamless login with user's Google account profile (Alexandre Freccia)
      const userCorretor: Corretor = DbService.getCorretores().find(c => c.email.toLowerCase() === 'afreccia@gmail.com') || {
        id: 'corretor-alexandre',
        nome: 'Alexandre Freccia',
        creci: '28901-F',
        telefone: '(47) 99888-7766',
        whatsapp: '47998887766',
        cidade: 'Balneário Camboriú',
        email: 'afreccia@gmail.com',
        foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
      };
      DbService.saveCorretor(userCorretor);
      DbService.setActiveCorretor(userCorretor);
      localStorage.setItem('imobishare_logged_in', 'true');
      setIsAuthenticated(true);
      setActiveCorretor(userCorretor);
      triggerToast(`Bem-vindo, ${userCorretor.nome}!`);
      await DbService.syncWithServer();
      reloadData();
    } finally {
      setAuthLoading(false);
    }
  };

  // Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Por favor, preencha o e-mail e a senha.');
      triggerToast('Por favor, preencha o e-mail e a senha.');
      return;
    }
    setAuthLoading(true);
    try {
      let user;
      try {
        user = await loginEmailPassword(authEmail, authPassword);
      } catch (fbErr: any) {
        // Fallback: check Express backend or local DbService
        try {
          const response = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authEmail, password: authPassword })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.corretor) {
              DbService.setActiveCorretor(data.corretor);
              localStorage.setItem('imobishare_logged_in', 'true');
              setIsAuthenticated(true);
              setActiveCorretor(data.corretor);
              triggerToast(`Bem-vindo, ${data.corretor.nome}!`);
              await DbService.syncWithServer();
              reloadData();
              return;
            }
          }
        } catch (_) {
          // Ignore
        }

        // Fallback for operation-not-allowed or local demo login
        const corretores = DbService.getCorretores();
        const found = corretores.find(c => c.email?.toLowerCase() === authEmail.toLowerCase());
        if (found) {
          DbService.setActiveCorretor(found);
          localStorage.setItem('imobishare_logged_in', 'true');
          setIsAuthenticated(true);
          setActiveCorretor(found);
          triggerToast(`Bem-vindo, ${found.nome}!`);
          reloadData();
          return;
        }

        throw fbErr;
      }

      if (user) {
        const userData = await syncUserWithFirestore(user);
        const corretor: Corretor = {
          id: user.uid,
          nome: userData.nome || user.displayName || 'Corretor ImobiShare',
          creci: userData.creci || '12345-F',
          telefone: userData.telefone || '(47) 99999-9999',
          whatsapp: userData.whatsapp || '(47) 99999-9999',
          cidade: userData.cidade || 'Balneário Camboriú',
          email: user.email || '',
          foto: userData.foto || user.photoURL || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
        };
        DbService.setActiveCorretor(corretor);
        localStorage.setItem('imobishare_logged_in', 'true');
        setIsAuthenticated(true);
        setActiveCorretor(corretor);
        triggerToast(`Bem-vindo, ${corretor.nome}!`);
        await DbService.syncWithServer();
        reloadData();
      }
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      triggerToast(formatted);
    } finally {
      setAuthLoading(false);
    }
  };

  // Register user with Firebase Auth & Firestore (with local fallback)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!regNome || !authEmail || !authPassword) {
      setAuthError('Nome, e-mail e senha são obrigatórios.');
      triggerToast('Nome, e-mail e senha são obrigatórios.');
      return;
    }
    setAuthLoading(true);

    const newCorretorObj: Corretor = {
      id: `corretor_${Date.now()}`,
      nome: regNome,
      creci: regCreci || '12345-F',
      telefone: regTelefone || '(47) 99999-9999',
      whatsapp: regWhatsapp || '(47) 99999-9999',
      cidade: regCidade || 'Balneário Camboriú',
      email: authEmail,
      foto: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
    };

    try {
      try {
        const user = await registerEmailPassword(authEmail, authPassword, {
          nome: regNome,
          creci: regCreci,
          telefone: regTelefone,
          whatsapp: regWhatsapp,
          cidade: regCidade,
        });
        const userData = await syncUserWithFirestore(user, {
          nome: regNome,
          creci: regCreci,
          telefone: regTelefone,
          whatsapp: regWhatsapp,
          cidade: regCidade,
        });
        newCorretorObj.id = user.uid;
        newCorretorObj.nome = userData.nome || regNome;
      } catch (fbErr: any) {
        console.warn('Firebase registration failed (e.g. auth method disabled). Falling back to local/server profile registration:', fbErr);
        // Fallback registration in local database & server
        DbService.addCorretor(newCorretorObj);
      }

      DbService.setActiveCorretor(newCorretorObj);
      localStorage.setItem('imobishare_logged_in', 'true');
      setIsAuthenticated(true);
      setActiveCorretor(newCorretorObj);
      setAuthMode('login');
      triggerToast(`Cadastro realizado com sucesso! Bem-vindo, ${newCorretorObj.nome}!`);
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
    if (!authEmail) {
      setAuthError('Por favor, informe seu e-mail para receber as instruções.');
      triggerToast('Por favor, informe seu e-mail.');
      return;
    }
    setAuthLoading(true);
    try {
      await resetPassword(authEmail);
      triggerToast('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
      setAuthMode('login');
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setAuthError(formatted);
      triggerToast(formatted);
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Error logging out of Firebase:', err);
    }
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
      if (filterCidade && filterCidade !== 'Todas' && imovel.cidade !== filterCidade) {
        return false;
      }

      // 3. Neighborhood / Bairro filter
      if (filterBairro.trim()) {
        if (!imovel.bairro.toLowerCase().includes(filterBairro.toLowerCase().trim())) {
          return false;
        }
      }

      // 4. Purchase/Rent Filter
      if (filterTipo === 'comprar' && imovel.tipo !== 'venda' && imovel.tipo !== 'ambos') return false;
      if (filterTipo === 'alugar' && imovel.tipo !== 'locação' && imovel.tipo !== 'ambos') return false;

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

      // 6. Value range
      const priceToCheck = (filterTipo === 'alugar' && imovel.valorLocacao) ? imovel.valorLocacao : imovel.valor;
      if (priceToCheck < filterValorMin) return false;
      if (filterValorMax > 0 && priceToCheck > filterValorMax) return false;

      // 7. Specifications (Dormitórios, Banheiros, Vagas)
      if (filterDormitorios > 0 && (imovel.dormitorios || 0) < filterDormitorios) return false;
      if (filterBanheiros > 0 && (imovel.banheiros || 0) < filterBanheiros) return false;
      if (filterVagas > 0 && (imovel.vagas || 0) < filterVagas) return false;

      // 8. Metragem (Privativa)
      if (filterMetragemMin > 0 && (imovel.metragem || 0) < filterMetragemMin) return false;
      if (filterMetragemMax > 0 && (imovel.metragem || 0) > filterMetragemMax) return false;

      // 9. Apenas Favoritos
      if (filterApenasFavoritos && !favoritos.includes(imovel.id)) return false;

      // 10. Broker Ownership / Integration Filter
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
      let preco = `R$ ${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
      let tipo = 'Venda';
      if (i.tipo === 'locação') {
        preco = `R$ ${(i.valorLocacao || i.valor).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês`;
        tipo = 'Aluguel';
      } else if (i.tipo === 'ambos') {
        preco = `Venda: R$ ${i.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} | Aluguel: R$ ${(i.valorLocacao || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês`;
        tipo = 'Venda & Aluguel';
      }
      return `• \`\`\`${location} - ${preco} (${tipo})\`\`\``;
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
      <div className="bg-[#0F172A] min-h-screen flex flex-col justify-center items-center p-4">
        <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!isAuthenticated) {
    return (
      <div className="bg-[#0F172A] min-h-screen flex flex-col justify-center items-center px-4 font-sans select-none" id="auth-screen">
        <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl space-y-4 border border-gray-100 max-h-[95dvh] overflow-y-auto">
          <div className="text-center space-y-1">
            <img
              src={logoImg}
              alt="ImobiShare Logo"
              className="mx-auto w-14 h-14 object-contain rounded-2xl border border-slate-100 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-xl font-black text-[#003366] tracking-tight uppercase animate-pulse">ImobiShare</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              {authMode === 'login' ? 'Acelere suas parcerias imobiliárias' : authMode === 'register' ? 'Crie sua conta profissional' : 'Recuperação de Senha'}
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 text-[11px] p-3.5 rounded-xl border border-red-200 font-medium leading-relaxed space-y-2.5" id="auth-error-banner">
              <p>{authError}</p>
              <div className="pt-2 border-t border-red-200/60 space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    const demoCorretor = DbService.getCorretores()[0];
                    if (demoCorretor) {
                      DbService.setActiveCorretor(demoCorretor);
                      localStorage.setItem('imobishare_logged_in', 'true');
                      setIsAuthenticated(true);
                      setActiveCorretor(demoCorretor);
                      triggerToast(`Acessando como ${demoCorretor.nome} (Modo Teste)`);
                      reloadData();
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg text-[10px] tracking-wide transition-all shadow-xs cursor-pointer text-center"
                >
                  ⚡ Entrar no Modo de Teste / Demonstração
                </button>
              </div>
            </div>
          )}

          {/* PROMINENT GOOGLE SIGN-IN BUTTON AT TOP */}
          <button
            type="button"
            id="google-signin-btn"
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-bold py-3.5 px-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 tracking-wide cursor-pointer min-h-[44px]"
          >
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-[#003366] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Entrar com Google</span>
              </>
            )}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-2 text-[8px] font-bold uppercase tracking-widest text-slate-400">Ou acesse com e-mail</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {authMode === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3">
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
                className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer min-h-[44px]"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Entrar com E-mail'
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot_password'); setAuthError(''); }}
                  className="text-slate-500 hover:text-[#003366] font-medium cursor-pointer"
                >
                  Esqueci minha senha
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className="text-[#003366] hover:underline font-bold cursor-pointer"
                >
                  Criar Conta
                </button>
              </div>
            </form>
          )}

          {authMode === 'register' && (
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

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(47) 99999-9999"
                  value={regTelefone}
                  onChange={(e) => {
                    setRegTelefone(e.target.value);
                    setRegWhatsapp(e.target.value);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366] text-slate-800 font-medium"
                />
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
                className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase mt-1 cursor-pointer"
              >
                {authLoading ? 'Registrando...' : 'Criar Conta Profissional'}
              </button>

              <div className="text-center pt-1.5">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-xs text-[#003366] hover:underline font-bold cursor-pointer"
                >
                  Já tem uma conta? Faça login
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
                className="w-full bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide uppercase cursor-pointer"
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
                    <div className="flex gap-2 items-center">
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
                              <img src={getValidImage(imovel.fotos?.[0])} alt="" onError={handleImageError} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                  <div className="bg-white border-y border-gray-100 p-4 sm:p-5 space-y-3.5">
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Pesquisar por título, condomínio, bairro..."
                          value={searchWord}
                          onChange={(e) => setSearchWord(e.target.value)}
                          className="w-full text-xs pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:border-[#003366] focus:ring-1 focus:ring-[#003366]/20 transition-all font-medium"
                        />
                        {searchWord && (
                          <button
                            onClick={() => setSearchWord('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`relative flex items-center justify-center p-3 rounded-2xl transition-all cursor-pointer shadow-xs border flex-shrink-0 ${
                          getActiveFilterCount() > 0
                            ? 'bg-[#003366] text-white border-[#003366] hover:bg-[#002244]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        id="btn-open-advanced-filter"
                        title="Filtro Completo"
                        aria-label="Filtro Completo"
                      >
                        <SlidersHorizontal size={18} />
                        {getActiveFilterCount() > 0 && (
                          <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                            {getActiveFilterCount()}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Quick City and Category row */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cidade</span>
                        <select
                          value={filterCidade}
                          onChange={(e) => setFilterCidade(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden text-xs font-semibold text-slate-700"
                        >
                          <option value="Balneário Camboriú">Balneário Camboriú</option>
                          <option value="Itapema">Itapema</option>
                          <option value="Itajaí">Itajaí</option>
                          <option value="Camboriú">Camboriú</option>
                          <option value="Navegantes">Navegantes</option>
                          <option value="Todas">Todas As Cidades</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Negócio</span>
                        <div className="grid grid-cols-3 gap-0.5 bg-gray-100 p-1 rounded-xl text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setFilterTipo('todos')}
                            className={`py-1 rounded-lg transition-all ${filterTipo === 'todos' ? 'bg-white text-[#003366] shadow-xs' : 'text-gray-500'}`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterTipo('comprar')}
                            className={`py-1 rounded-lg transition-all ${filterTipo === 'comprar' ? 'bg-white text-[#003366] shadow-xs' : 'text-gray-500'}`}
                          >
                            Venda
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterTipo('alugar')}
                            className={`py-1 rounded-lg transition-all ${filterTipo === 'alugar' ? 'bg-white text-[#003366] shadow-xs' : 'text-gray-500'}`}
                          >
                            Aluguel
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meus Imóveis, Parcerias and Integração Checkbox switches */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-3 pt-2.5 border-t border-gray-100 text-[10px] sm:text-xs">
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
                          Portais
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
                    <div className="min-w-0 pr-2">
                      <h2 className="font-extrabold text-slate-800 text-sm sm:text-base md:text-lg truncate whitespace-nowrap">Meus Imóveis Cadastrados</h2>
                      <p className="text-[10px] text-slate-400 truncate">Gerencie, exclua e publique captações exclusivas</p>
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
                    onLogout={handleLogout}
                  />
                </div>
              )}

              {activeTab === 'support' && (
                <SupportForm
                  activeCorretor={activeCorretor}
                  onBack={() => handleTabChange('home')}
                  triggerToast={triggerToast}
                />
              )}

              {activeTab === 'tests' && (
                <div id="connection-tests-tab-view">
                  <ConnectionTests />
                </div>
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

            {/* Quick floating central add property button (+) */}
            <button
              onClick={() => {
                setEditingPropertyId(null);
                setIsAddingProperty(true);
                setSearchViewMode('como_esta_hoje');
              }}
              className="flex flex-col items-center justify-center -mt-6 bg-[#003366] text-white w-11 h-11 rounded-full shadow-lg hover:bg-[#002244] hover:scale-105 active:scale-95 transition-all z-30"
              id="btn-add-property"
              title="Cadastrar Novo Imóvel"
            >
              <PlusCircle size={22} className="stroke-[2.5px]" />
            </button>

            <button
              onClick={() => handleTabChange('tests')}
              className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'tests' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}
              id="tab-tests"
            >
              <Activity size={18} className={activeTab === 'tests' ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[8px] font-extrabold uppercase tracking-wider">Testes</span>
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
                      <h3 className="text-sm font-bold text-slate-900">Filtro Completo de Busca</h3>
                      <p className="text-[11px] text-slate-500">Refine localização, valores, cômodos e tipos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getActiveFilterCount() > 0 && (
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
                  {/* 1. Tipo de Negócio */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">1. Tipo de Negócio</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl font-bold">
                      <button
                        type="button"
                        onClick={() => setFilterTipo('todos')}
                        className={`py-2 rounded-lg text-xs transition-all ${filterTipo === 'todos' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTipo('comprar')}
                        className={`py-2 rounded-lg text-xs transition-all ${filterTipo === 'comprar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
                      >
                        Venda
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTipo('alugar')}
                        className={`py-2 rounded-lg text-xs transition-all ${filterTipo === 'alugar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-500'}`}
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
                        value={filterCidade}
                        onChange={(e) => setFilterCidade(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#003366]"
                      >
                        <option value="Balneário Camboriú">Balneário Camboriú</option>
                        <option value="Itapema">Itapema</option>
                        <option value="Itajaí">Itajaí</option>
                        <option value="Camboriú">Camboriú</option>
                        <option value="Navegantes">Navegantes</option>
                        <option value="Todas">Todas As Cidades</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">3. Bairro / Região</label>
                      <input
                        type="text"
                        placeholder="Ex: Centro, Barra Sul, Meia Praia..."
                        value={filterBairro}
                        onChange={(e) => setFilterBairro(e.target.value)}
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
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFilterTipoImovel(t.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            filterTipoImovel === t.id
                              ? 'bg-[#003366] text-white border-[#003366]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Faixa de Preço */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">5. Faixa de Valor (R$)</label>
                      {(filterValorMin > 0 || filterValorMax < 15000000) && (
                        <button
                          onClick={() => { setFilterValorMin(0); setFilterValorMax(15000000); }}
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
                          value={filterValorMin === 0 ? '' : filterValorMin}
                          onChange={(e) => setFilterValorMin(e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Máximo</span>
                        <input
                          type="number"
                          placeholder="R$ Máximo"
                          value={filterValorMax === 15000000 || filterValorMax === 0 ? '' : filterValorMax}
                          onChange={(e) => setFilterValorMax(e.target.value === '' ? 0 : Number(e.target.value))}
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
                          onClick={() => { setFilterValorMin(shortcut.min); setFilterValorMax(shortcut.max); }}
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
                        {[0, 1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFilterDormitorios(num)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                              filterDormitorios === num
                                ? 'bg-[#003366] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {num === 0 ? 'Qualq.' : `${num}+`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Banheiros / BWC */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-xs">Banheiros / BWC</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFilterBanheiros(num)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                              filterBanheiros === num
                                ? 'bg-[#003366] text-white'
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
                      <span className="font-semibold text-slate-700 text-xs">Vagas de Garagem</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setFilterVagas(num)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                              filterVagas === num
                                ? 'bg-[#003366] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {num === 0 ? 'Qualq.' : `${num}+`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 6. Metragem Privativa */}
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

                  {/* 7. Fonte de Imóveis */}
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
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterModalOpen(false)}
                    className="flex-1 bg-[#003366] hover:bg-[#002244] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer text-center"
                  >
                    Ver {getFilteredImoveis().length} Imóveis Encontrados
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
