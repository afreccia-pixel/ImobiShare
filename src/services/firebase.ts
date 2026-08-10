  import { initializeApp, getApps, getApp } from 'firebase/app';
  import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithCredential,
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult,
    signInWithEmailAndPassword as fbSignInWithEmail, 
    createUserWithEmailAndPassword as fbCreateUserWithEmail,
    sendPasswordResetEmail,
    signOut as fbSignOut,
    onAuthStateChanged,
    User
  } from 'firebase/auth';
  import { Capacitor } from '@capacitor/core';
  import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
  import { getApiUrl } from '../utils/apiUrl';
  import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
  } from 'firebase/firestore';
  import firebaseConfigJson from '../../firebase-applet-config.json';
  
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  };
  
  // Global handler for Firebase Auth background errors (e.g. invalid template API key)
  if (typeof window !== 'undefined') {
    // Override console.error to filter out template Firebase API key logs
    const originalConsoleError = console.error;
    console.error = function (...args: any[]) {
      const str = args.map(a => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a))).join(' ');
      if (
        str.includes('api-key-not-valid') ||
        str.includes('invalid-api-key') ||
        str.includes('API_KEY_NOT_VALID') ||
        str.includes('auth/api-key-not-valid')
      ) {
        console.warn('ℹ️ [Firebase Auth Config] Chave de API indisponível no cliente. Operando em modo de autenticação direta via servidor.');
        return;
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || '');
      const code = reason?.code || '';
      if (
        code === 'auth/api-key-not-valid' ||
        code === 'auth/invalid-api-key' ||
        msg.includes('api-key-not-valid') ||
        msg.includes('invalid-api-key') ||
        msg.includes('API_KEY_NOT_VALID')
      ) {
        console.warn('ℹ️ Firebase Auth: Chave de API de template/placeholder detectada. Usando autenticação direta do servidor.', msg);
        event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
      }
    });

    window.addEventListener('error', (event) => {
      const msg = event.message || '';
      if (msg.includes('api-key-not-valid') || msg.includes('invalid-api-key') || msg.includes('API_KEY_NOT_VALID')) {
        console.warn('ℹ️ Firebase Auth: Capturado erro de chave de API no console.', msg);
        event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
      }
    }, true);
  }

  // Initialize Firebase safely
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  
  // Use custom database ID if specified in config, else default
  export const db = firebaseConfigJson.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
    : getFirestore(app);
  
  export const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  export interface UserFirestoreData {
    uid: string;
    nome: string;
    email: string;
    foto: string;
    creci?: string;
    telefone?: string;
    whatsapp?: string;
    cidade?: string;
    createdAt: string;
    lastLoginAt: string;
  }
  
  /**
   * Friendly error messages in Portuguese
   */
  export function formatAuthError(error: any): string {
    if (!error) return 'Ocorreu um erro ao processar sua solicitação.';
    const code = error.code || '';
    const message = error.message || '';
  
    if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key' || message.includes('api-key-not-valid') || message.includes('invalid-api-key')) {
      return 'Chave de API do Firebase ausente ou inválida. O aplicativo utilizará autenticação direta do servidor.';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'O login com o Google foi cancelado.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Este domínio não está autorizados no Firebase Console (Authentication > Settings > Authorized domains).';
    }
    if (code === 'auth/user-not-found') {
      return 'Usuário não encontrado. Verifique se digitou o e-mail corretamente.';
    }
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'E-mail ou senha incorretos. Por favor, verifique seus dados.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado. Tente fazer login com o Google ou recupere sua senha.';
    }
    if (code === 'auth/invalid-email') {
      return 'O formato do e-mail digitado é inválido.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    if (code === 'auth/popup-blocked') {
      return 'O navegador bloqueou o popup de login. Por favor, permita popups para este site.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'O login com Google não está ativado no Firebase Console.';
    }
    if (message.includes('offline') || message.includes('network')) {
      return 'Sem conexão com a internet. Verifique sua rede.';
    }
  
    return 'Ocorreu um erro ao realizar a autenticação. Por favor, tente novamente.';
  }
  
  /**
   * Saves user details in Neon PostgreSQL database via API
   */
  export async function syncUserWithNeon(
    user: User, 
    extraData?: {
      nome?: string;
      creci?: string;
      telefone?: string;
      whatsapp?: string;
      cidade?: string;
      estado?: string;
      imobiliaria?: string;
    }
  ): Promise<UserFirestoreData> {
    const payload = {
      uid: user.uid,
      email: (user.email || '').toLowerCase().trim(),
      foto: user.photoURL || '',
      primeiroAcesso: true
    };
  
    try {
      const res = await fetch(getApiUrl('/api/auth/sync-firebase-user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.corretor) {
          return {
            uid: user.uid,
            nome: data.corretor.nome,
            email: data.corretor.email,
            foto: data.corretor.foto,
            creci: data.corretor.creci,
            telefone: data.corretor.telefone,
            whatsapp: data.corretor.whatsapp,
            cidade: data.corretor.cidade,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.warn('Could not sync user with Neon PostgreSQL API:', err);
    }
  
const now = new Date().toISOString();

return {
  uid: user.uid,
  nome: '',
  email: payload.email,
  foto: payload.foto,
  creci: '',
  telefone: '',
  whatsapp: '',
  cidade: '',
  createdAt: now,
  lastLoginAt: now,
};  }
  
  // Backwards compatibility alias
  export const syncUserWithFirestore = syncUserWithNeon;
  
  /**
   * Sign in with Google using native Capacitor Auth on Android / iOS or Web fallback
   * 
   * CHECKLIST DE AUTENTICAÇÃO NO FIREBASE CONSOLE:
   * 1. Domínios Autorizados (Authorized Domains):
   *    - Adicione o domínio da web app (ex: www.imobishare.app.br ou seu domínio de hospedagem).
   *    - Para Android com Capacitor, garanta que o schema de redirect / localhost / domínios do app estejam autorizados.
   * 2. Android SHA-1 e SHA-256:
   *    - Cadastre a chave SHA-1 do keystore (ex: 43:88:6C:EB:F4:D4:81:67:5E:21:9D:CD:26:C0:D5:5D:16:BD:CB:B4) no app Android no Firebase Console.
   *    - Baixe e substitua o google-services.json atualizado em /android/app/google-services.json.
   */
  export async function signInWithGoogle(): Promise<User> {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    console.log(`signInWithGoogle - Platform: ${platform}, isNativePlatform: ${isNative}`);

    // Use native Google Sign-In when running on Android/iOS native Capacitor container
    if (isNative || platform === 'android' || platform === 'ios') {
      try {
        console.log(`Iniciando login nativo com Google (${platform}) via @capacitor-firebase/authentication...`);
        const result = await FirebaseAuthentication.signInWithGoogle();
        
        const idToken = result.credential?.idToken;
        if (!idToken) {
          throw new Error('Não foi possível obter o ID Token do Google Sign-In nativo.');
        }
  
        // Authenticate with Firebase JS SDK using the native credential
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      } catch (nativeError: any) {
        console.error(nativeError?.code || 'native_google_auth_error', nativeError?.message || nativeError, nativeError);
        throw nativeError;
      }
    }
  
    // Web / PWA browser environment
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: any) {
      // Registrar erros reais do Firebase no console
      console.error(error?.code || 'google_auth_error', error?.message || error, error);
  
      const redirectErrorCodes = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/network-request-failed',
        'auth/unauthorized-domain',
        'auth/internal-error'
      ];
  
      if (redirectErrorCodes.includes(error?.code) || (error?.message && error.message.toLowerCase().includes('popup'))) {
        console.log('Tentando signInWithRedirect como fallback do popup...');
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error(redirectErr?.code || 'google_redirect_error', redirectErr?.message || redirectErr, redirectErr);
          throw redirectErr;
        }
        // Throw control signal after try/catch so it is not caught as a fake error
        throw new Error('REDIRECTING');
      }
  
      throw error;
    }
  }
  
  /**
   * Handle redirect result if user returned from Google redirect auth flow
   */
  export async function checkRedirectAuth(): Promise<User | null> {
    try {
      const result = await getRedirectResult(auth);
      return result ? result.user : null;
    } catch (err: any) {
      if (err?.code === 'auth/api-key-not-valid' || err?.code === 'auth/invalid-api-key' || (err?.message && err.message.includes('api-key-not-valid'))) {
        console.warn('ℹ️ Firebase API Key não configurada. Ignorando getRedirectResult.');
        return null;
      }
      console.error('Error handling redirect auth:', err);
      return null;
    }
  }
  
  /**
   * Sign in with Email and Password
   */
  export async function loginEmailPassword(email: string, pass: string): Promise<User> {
    try {
      const credential = await fbSignInWithEmail(auth, email, pass);
      return credential.user;
    } catch (err: any) {
      if (err?.code === 'auth/api-key-not-valid' || err?.code === 'auth/invalid-api-key' || (err?.message && err.message.includes('api-key-not-valid'))) {
        throw new Error('Chave do Firebase não configurada. Utilizando autenticação via servidor.');
      }
      throw err;
    }
  }
  
  /**
   * Register with Email and Password
   */
  export async function registerEmailPassword(
    email: string, 
    pass: string,
    extraData: {
      nome: string;
      creci?: string;
      telefone?: string;
      whatsapp?: string;
      cidade?: string;
      estado?: string;
      imobiliaria?: string;
    }
  ): Promise<User> {
    try {
      const credential = await fbCreateUserWithEmail(auth, email, pass);
      await syncUserWithFirestore(credential.user, extraData);
      return credential.user;
    } catch (err: any) {
      if (err?.code === 'auth/api-key-not-valid' || err?.code === 'auth/invalid-api-key' || (err?.message && err.message.includes('api-key-not-valid'))) {
        throw new Error('Chave do Firebase não configurada. Utilizando cadastro via servidor.');
      }
      throw err;
    }
  }
  
  /**
   * Send password reset email via Backend API (or Firebase Auth fallback)
   */
  export async function resetPassword(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    console.log(`🔑 Requesting password reset for: ${cleanEmail}`);
    
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível enviar o e-mail de redefinição.');
      }
      console.log(`✅ Password reset requested successfully via server API for: ${cleanEmail}`);
      return;
    } catch (err: any) {
      console.warn('⚠️ Backend forgot-password failed, checking client SDK fallback:', err?.message);
      // If server returned a business error (e.g. user not found), rethrow
      if (err?.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw err;
      }
      // Try client SDK as fallback if client key exists
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        console.log(`✅ Password reset email dispatched via client SDK for: ${cleanEmail}`);
      } catch (clientErr: any) {
        console.error('❌ Firebase Auth client sendPasswordResetEmail error:', clientErr);
        if (clientErr?.code === 'auth/api-key-not-valid' || clientErr?.code === 'auth/invalid-api-key' || (clientErr?.message && clientErr.message.includes('api-key-not-valid'))) {
          throw new Error('Não foi possível enviar o e-mail de redefinição. Tente novamente mais tarde.');
        }
        throw clientErr;
      }
    }
  }
  
  /**
   * Sign out
   */
  export async function logoutUser(): Promise<void> {
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'android') {
      try {
        await FirebaseAuthentication.signOut();
      } catch (e) {
        console.warn('Erro ao deslogar do plugin nativo de auth:', e);
      }
    }
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Aviso no logout do Firebase:', err);
    }
  }
