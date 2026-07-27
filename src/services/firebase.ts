import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
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

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'O login com o Google foi cancelado.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este domínio de visualização ainda não está na lista de domínios autorizados do Firebase. Para prosseguir, utilize o login com E-mail ou o botão "Entrar no Modo de Teste".';
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'E-mail ou senha incorretos. Por favor, verifique seus dados.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.';
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
    return 'O navegador bloqueou a janela de login do Google. Ative os pop-ups para este site ou utilize a opção "Entrar no Modo de Teste".';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'O login com Google não está habilitado no seu console Firebase. Acesse o Console -> Authentication -> Sign-in method e ative o provedor Google.';
  }
  if (message.includes('offline') || message.includes('network')) {
    return 'Sem conexão com a internet. Verifique sua rede.';
  }

  return 'Não foi possível fazer login com o Google no momento. Tente com E-mail/Senha ou use o "Modo de Teste".';
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
  }
): Promise<UserFirestoreData> {
  const payload = {
    uid: user.uid,
    nome: extraData?.nome || user.displayName || user.email?.split('@')[0] || 'Corretor ImobiShare',
    email: user.email || '',
    foto: user.photoURL || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
    creci: extraData?.creci || '12345-F',
    telefone: extraData?.telefone || '(47) 99999-9999',
    whatsapp: extraData?.whatsapp || '(47) 99999-9999',
    cidade: extraData?.cidade || 'Balneário Camboriú',
  };

  try {
    const res = await fetch('/api/auth/sync-firebase-user', {
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
    nome: payload.nome,
    email: payload.email,
    foto: payload.foto,
    creci: payload.creci,
    telefone: payload.telefone,
    whatsapp: payload.whatsapp,
    cidade: payload.cidade,
    createdAt: now,
    lastLoginAt: now,
  };
}

// Backwards compatibility alias
export const syncUserWithFirestore = syncUserWithNeon;

/**
 * Sign in with Google using Popup or Redirect fallback
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      console.log('Popup blocked or closed, attempting redirect mode...');
      await signInWithRedirect(auth, googleProvider);
      // signInWithRedirect will navigate away, or complete via getRedirectResult
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
  } catch (err) {
    console.error('Error handling redirect auth:', err);
    return null;
  }
}

/**
 * Sign in with Email and Password
 */
export async function loginEmailPassword(email: string, pass: string): Promise<User> {
  const credential = await fbSignInWithEmail(auth, email, pass);
  return credential.user;
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
  }
): Promise<User> {
  const credential = await fbCreateUserWithEmail(auth, email, pass);
  await syncUserWithFirestore(credential.user, extraData);
  return credential.user;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}
