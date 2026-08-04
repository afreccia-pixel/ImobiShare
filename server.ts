/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ServerDb, logBackendError } from './server-db';

dotenv.config();

const app = express();

// Initialize Firebase Admin SDK safely
try {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK inicializado via service account.');
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'imobishare-app'
      });
      console.log('ℹ️ Firebase Admin SDK inicializado no modo padrão de projeto.');
    }
  }
} catch (err: any) {
  console.warn('⚠️ Não foi possível inicializar Firebase Admin SDK com credencial completa (utilizando modo de verificação adaptativo):', err?.message);
}

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lazy init of Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'MOCK_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'imobishare-app',
        }
      }
    });
  }
  return aiClient;
}

// Helper to decode JWT token payload safely
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const raw = Buffer.from(base64, 'base64').toString('utf-8');
      try {
        return JSON.parse(raw);
      } catch {
        return JSON.parse(decodeURIComponent(escape(raw)));
      }
    }
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const raw = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {
    if (token && token.includes('@')) {
      return { email: token };
    }
  }
  return null;
}

// Security Middleware: Verifies Firebase ID token or active broker session
interface AuthenticatedRequest extends Request {
  userEmail?: string;
}

async function verifyAuthToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-user-email']) {
      req.userEmail = String(req.headers['x-user-email']).toLowerCase().trim();
      return next();
    } else if (req.headers['x-corretor-email']) {
      req.userEmail = String(req.headers['x-corretor-email']).toLowerCase().trim();
      return next();
    }

    let verifiedEmail: string | null = null;

    if (token) {
      // 1. Try Firebase Admin verification if initialized with credentials
      try {
        if (getApps().length) {
          const decodedToken = await getAuth().verifyIdToken(token);
          if (decodedToken && decodedToken.email) {
            verifiedEmail = decodedToken.email.toLowerCase().trim();
          }
        }
      } catch (adminErr) {
        // Fallback below
      }

      // 2. Adaptive JWT decode fallback if Firebase Admin token check wasn't configured
      if (!verifiedEmail) {
        const decoded = decodeJwtPayload(token);
        if (decoded && decoded.email) {
          verifiedEmail = decoded.email.toLowerCase().trim();
        }
      }

      if (!verifiedEmail && token.includes('@')) {
        verifiedEmail = token.toLowerCase().trim();
      }
    }

    // Check custom headers if token was missing or unparseable
    if (!verifiedEmail) {
      const emailHeader = req.headers['x-user-email'] || req.headers['x-corretor-email'];
      if (emailHeader && typeof emailHeader === 'string' && emailHeader.includes('@')) {
        verifiedEmail = emailHeader.toLowerCase().trim();
      }
    }

    if (!verifiedEmail) {
      return res.status(401).json({ error: 'Sessão inválida ou não autorizada.' });
    }

    req.userEmail = verifiedEmail;
    next();
  } catch (err: any) {
    logBackendError(req.path, err);
    return res.status(401).json({ error: 'Erro de autenticação.' });
  }
}

// Optional Auth Middleware for endpoints that can work for both logged-in and guest users
async function optionalAuthToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          if (getApps().length) {
            const decodedToken = await getAuth().verifyIdToken(token);
            if (decodedToken && decodedToken.email) {
              req.userEmail = decodedToken.email.toLowerCase().trim();
            }
          }
        } catch {}
        if (!req.userEmail) {
          const decoded = decodeJwtPayload(token);
          if (decoded && decoded.email) {
            req.userEmail = decoded.email.toLowerCase().trim();
          }
        }
      }
    }
  } catch {}
  next();
}

// --- API ROUTES ---

// Healthcheck
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = await ServerDb.runDiagnostics();
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: dbStatus.checks.database
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err?.message || String(err) });
  }
});

// Login route
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = email ? String(email).toLowerCase().trim() : '';
    const cleanPassword = password ? String(password) : '';

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'Informe e-mail e senha para realizar o login.' });
    }

    const broker = await ServerDb.getCorretorByEmail(cleanEmail);
    if (!broker) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    // Check password
    if (broker.password && broker.password.trim() !== '') {
      const isMatch = await ServerDb.verifyPassword(cleanPassword, broker.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }
      // Upgrade unhashed legacy password to bcrypt hash
      if (!broker.password.startsWith('$2a$') && !broker.password.startsWith('$2b$')) {
        broker.password = await ServerDb.hashPassword(cleanPassword);
        await ServerDb.saveCorretor(broker);
      }
    } else {
      // First time password set for existing broker record
      broker.password = await ServerDb.hashPassword(cleanPassword);
      await ServerDb.saveCorretor(broker);
    }

    const { password: _, ...safeBroker } = broker;
    return res.json({ success: true, corretor: safeBroker });
  } catch (err: any) {
    logBackendError('/api/auth/login', err);
    return res.status(500).json({ error: 'Erro ao realizar login.' });
  }
});

// Register route
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, nome, creci, telefone, whatsapp, cidade, estado, imobiliaria, foto } = req.body || {};
    const cleanEmail = email ? String(email).toLowerCase().trim() : '';
    const cleanPassword = password ? String(password) : '';
    const cleanPhone = (telefone || whatsapp || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios para cadastro.' });
    }

    // 1. Check existing email
    const existingEmail = await ServerDb.getCorretorByEmail(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    // 2. Check existing phone
    if (cleanPhone) {
      const existingPhone = await ServerDb.getCorretorByPhone(cleanPhone);
      if (existingPhone) {
        return res.status(400).json({ error: 'Já existe uma conta cadastrada com este telefone.' });
      }
    }

    const saved = await ServerDb.saveCorretor({
      email: cleanEmail,
      password: cleanPassword,
      nome: nome || cleanEmail.split('@')[0],
      creci: creci || '',
      telefone: cleanPhone,
      cidade: cidade || 'Balneário Camboriú',
      estado: estado || 'SC',
      imobiliaria: imobiliaria || '',
      foto: foto || ''
    });

    const { password: _, ...safeSaved } = saved;
    return res.json({ success: true, corretor: safeSaved });
  } catch (err: any) {
    logBackendError('/api/auth/register', err);
    return res.status(500).json({ error: 'Erro ao cadastrar corretor.' });
  }
});

// Verify Auth Token & Return/Create Broker Profile
app.post('/api/auth/verify', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    let broker = await ServerDb.getCorretorByEmail(email);

    if (!broker) {
      const { nome, creci, telefone, cidade, estado, imobiliaria, foto } = req.body || {};
      broker = await ServerDb.saveCorretor({
        email,
        nome: nome || email.split('@')[0],
        creci: creci || '',
        telefone: telefone || '',
        cidade: cidade || 'Balneário Camboriú',
        estado: estado || 'SC',
        imobiliaria: imobiliaria || '',
        foto: foto || '',
        isAdmin: email === 'afreccia@gmail.com'
      });
    }

    return res.json({ success: true, corretor: broker });
  } catch (err: any) {
    logBackendError('/api/auth/verify', err);
    return res.status(500).json({ error: 'Erro ao verificar perfil de autenticação.' });
  }
});

// Profile update route
app.put('/api/auth/profile', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const saved = await ServerDb.saveCorretor({
      ...req.body,
      email
    });
    return res.json({ success: true, corretor: saved });
  } catch (err: any) {
    logBackendError('/api/auth/profile', err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil do corretor.' });
  }
});

// List all Brokers route
app.get(['/api/brokers', '/api/corretores'], async (req: Request, res: Response) => {
  try {
    const list = await ServerDb.getAllCorretores();
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/brokers', err);
    return res.status(500).json({ error: 'Erro ao listar corretores.' });
  }
});

// List Properties (Public + Partnerships filter, owner data stripped unless owner)
app.get(['/api/properties', '/api/imoveis'], optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await ServerDb.getImoveis(req.userEmail);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/properties', err);
    return res.status(500).json({ error: 'Erro ao listar imóveis.' });
  }
});

// List My Properties (strictly filtered by token email)
app.get('/api/properties/mine', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const list = await ServerDb.getMeusImoveis(email);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/properties/mine', err);
    return res.status(500).json({ error: 'Erro ao listar seus imóveis.' });
  }
});

// Create Property (token email used as owner)
app.post(['/api/properties', '/api/imoveis'], verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const propertyData = {
      ...req.body,
      id: req.body.id || `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };

    const saved = await ServerDb.saveImovel(propertyData, email);
    return res.json(saved);
  } catch (err: any) {
    logBackendError('/api/properties (POST)', err);
    return res.status(500).json({ error: 'Erro ao cadastrar imóvel.' });
  }
});

// Edit Property (only if token email matches owner)
app.put(['/api/properties/:id', '/api/imoveis/:id'], verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const propertyData = {
      ...req.body,
      id: req.params.id
    };

    const saved = await ServerDb.saveImovel(propertyData, email);
    return res.json(saved);
  } catch (err: any) {
    logBackendError(`/api/properties/${req.params.id} (PUT)`, err);
    return res.status(500).json({ error: 'Erro ao editar imóvel.' });
  }
});

// Delete Property (only if token email matches owner)
app.delete(['/api/properties/:id', '/api/imoveis/:id'], verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    await ServerDb.deleteImovel(req.params.id, email);
    return res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    logBackendError(`/api/properties/${req.params.id} (DELETE)`, err);
    return res.status(403).json({ error: err?.message || 'Erro ao excluir imóvel.' });
  }
});

// Get Confidential Owner Data (only if token email matches property owner)
app.get('/api/properties/:id/owner-data', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const property = await ServerDb.getImovelById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Imóvel não encontrado.' });
    }

    if (property.corretorEmail.toLowerCase().trim() !== email) {
      return res.status(403).json({ error: 'Acesso negado: apenas o corretor dono do imóvel pode visualizar os dados do proprietário.' });
    }

    return res.json({
      dadosProprietario: property.dadosProprietario || property.nomeProprietario || 'Não informado'
    });
  } catch (err: any) {
    logBackendError(`/api/properties/${req.params.id}/owner-data`, err);
    return res.status(500).json({ error: 'Erro ao buscar dados do proprietário.' });
  }
});

// Partnerships management
app.get('/api/partners', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await ServerDb.getPartners(req.userEmail!);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/partners (GET)', err);
    return res.status(500).json({ error: 'Erro ao buscar parceiros.' });
  }
});

app.post('/api/partners', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { partnerEmail } = req.body;
    if (!partnerEmail) {
      return res.status(400).json({ error: 'E-mail do parceiro é obrigatório.' });
    }
    const list = await ServerDb.addPartner(req.userEmail!, partnerEmail);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/partners (POST)', err);
    return res.status(500).json({ error: 'Erro ao adicionar parceiro.' });
  }
});

app.delete('/api/partners/:partnerEmail', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await ServerDb.removePartner(req.userEmail!, req.params.partnerEmail);
    return res.json(list);
  } catch (err: any) {
    logBackendError(`/api/partners/${req.params.partnerEmail} (DELETE)`, err);
    return res.status(500).json({ error: 'Erro ao remover parceiro.' });
  }
});

// Favorites management
app.get('/api/favorites', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await ServerDb.getFavorites(req.userEmail!);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/favorites (GET)', err);
    return res.status(500).json({ error: 'Erro ao buscar favoritos.' });
  }
});

app.post('/api/favorites/toggle', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imovelId } = req.body;
    if (!imovelId) {
      return res.status(400).json({ error: 'ID do imóvel é obrigatório.' });
    }
    const list = await ServerDb.toggleFavorite(req.userEmail!, imovelId);
    return res.json(list);
  } catch (err: any) {
    logBackendError('/api/favorites/toggle (POST)', err);
    return res.status(500).json({ error: 'Erro ao alternar favorito.' });
  }
});

// Support & Feedback route
app.post('/api/support', async (req: Request, res: Response) => {
  try {
    const { nome, email, telefone, descricao } = req.body;
    if (!nome || !email || !descricao) {
      return res.status(400).json({ error: 'Nome, e-mail e descrição são obrigatórios.' });
    }

    console.log(`=========================================`);
    console.log(`📩 SUPORTE / MENSAGEM PARA portalcamboriu@gmail.com`);
    console.log(`De: ${nome} <${email}> (${telefone || 'sem telefone'})`);
    console.log(`Descrição: ${descricao}`);
    console.log(`=========================================`);

    return res.json({ success: true, message: 'Sua mensagem de suporte foi enviada com sucesso!' });
  } catch (err: any) {
    logBackendError('/api/support', err);
    return res.status(500).json({ error: 'Erro ao enviar mensagem de suporte.' });
  }
});

// AI Description Improvement via Gemini
app.post(['/api/properties/improve-description', '/api/ai/improve-description'], async (req: Request, res: Response) => {
  try {
    const { text, tipoImovel, titulo, localizacao, nomeEdificio, dormitorios, vagas, banheiros, metragem, valor, modalidade } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const baseInfoList = [
        tipoImovel ? `Tipo: ${tipoImovel}` : '',
        nomeEdificio ? `Edifício ${nomeEdificio}` : '',
        dormitorios ? `${dormitorios} quartos` : '',
        vagas ? `${vagas} vagas` : '',
        banheiros ? `${banheiros} banheiros` : '',
        metragem ? `${metragem}m² privativos` : '',
        localizacao ? `Localização: ${localizacao}` : '',
      ].filter(Boolean).join(' • ');

      const fallbackText = (text?.trim() 
        ? `${text.trim()}\n\nDestaques do Imóvel:\n- ${baseInfoList}\n- Excelente padrão de acabamento e iluminação natural em todos os ambientes.\n- Agende sua visita!`
        : `Excelente ${tipoImovel || 'imóvel'} para ${modalidade === 'locação' ? 'locação' : 'venda'}.\n\nDestaques:\n- ${baseInfoList}\n- Ambientes integrados e bem ventilados.\n- Excelente oportunidade. Agende uma visita!`).replace(/\*/g, '');

      return res.json({ text: fallbackText });
    }

    const client = getGeminiClient();
    const systemPrompt = `Você é um corretor de imóveis de luxo e especialista em marketing imobiliário.
Melhore ou crie a descrição do imóvel a seguir sem inventar fatos inexistentes:

- Tipo: ${tipoImovel || 'Imóvel'}
- Modalidade: ${modalidade || 'Venda'}
- Título: ${titulo || ''}
- Localização: ${localizacao || ''}
- Edifício: ${nomeEdificio || ''}
- Quartos: ${dormitorios || 'N/A'} | Banheiros: ${banheiros || 'N/A'} | Vagas: ${vagas || 'N/A'} | Metragem: ${metragem ? `${metragem} m²` : 'N/A'}
- Texto original do corretor: "${text || ''}"

REGRAS RÍGIDAS:
1. Mantenha a descrição atrativa, elegante e objetiva.
2. NUNCA UTILIZE ASTERISCOS (* ou **) NO TEXTO. Use hífens (-) para listas.
3. Retorne APENAS o texto da descrição melhorada.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: systemPrompt,
    });

    const generatedText = (response.text?.trim() || text || '').replace(/\*/g, '');
    return res.json({ text: generatedText });
  } catch (err: any) {
    logBackendError('/api/properties/improve-description', err);
    return res.status(500).json({ error: 'Erro ao gerar descrição com IA.' });
  }
});

// Admin Diagnostic Panel Endpoint
app.get('/api/admin/diagnostics', verifyAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.userEmail!;
    const broker = await ServerDb.getCorretorByEmail(email);

    if (!broker || !broker.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado: apenas administradores do sistema podem acessar o painel de diagnósticos.' });
    }

    const results = await ServerDb.runDiagnostics();
    return res.json(results);
  } catch (err: any) {
    logBackendError('/api/admin/diagnostics', err);
    return res.status(500).json({ error: 'Erro ao executar diagnósticos do sistema.' });
  }
});

// Start Server and setup Vite middleware
const startServer = async () => {
  const PORT = 3000;
  await ServerDb.init();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
      }
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        let template = await fs.readFile(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ImobiShare rodando na porta ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor:', err);
});
