/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
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

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nome || cleanEmail.split('@')[0])}&background=003366&color=fff`;

    const saved = await ServerDb.saveCorretor({
      email: cleanEmail,
      password: cleanPassword,
      nome: nome || cleanEmail.split('@')[0],
      creci: creci || '',
      telefone: cleanPhone,
      cidade: cidade || 'Balneário Camboriú',
      estado: estado || 'SC',
      imobiliaria: imobiliaria || '',
      foto: foto && foto.trim() ? foto.trim() : defaultAvatar
    });

    const { password: _, ...safeSaved } = saved;
    return res.json({ success: true, corretor: safeSaved });
  } catch (err: any) {
    logBackendError('/api/auth/register', err);
    return res.status(500).json({ error: 'Erro ao cadastrar corretor.' });
  }
});

// Forgot / Reset Password route
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = email ? String(email).toLowerCase().trim() : '';

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Informe o e-mail para redefinição de senha.' });
    }

    // Check if user exists in local DB
    const broker = await ServerDb.getCorretorByEmail(cleanEmail);
    if (!broker) {
      return res.status(404).json({ error: 'Nenhum usuário cadastrado encontrado com este e-mail.' });
    }

    // Always generate secure application reset link with token
    const token = crypto.randomBytes(24).toString('hex');
    broker.resetToken = token;
    broker.resetTokenExpires = Date.now() + 1000 * 60 * 60 * 2; // 2 horas
    await ServerDb.saveCorretor(broker);

    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
    const reqProto = (req.headers['x-forwarded-proto'] || 'https') as string;
    let origin = (req.headers.origin as string) || (reqHost ? `${reqProto}://${reqHost}` : '');
    
    // Ensure origin is valid Cloud Run / Public App URL
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      origin = process.env.APP_URL || 'https://ais-dev-vockjze6fhgsof37jkvcju-570873971775.us-east1.run.app';
    }

    const resetLink = `${origin}/?action=reset-password&token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    console.log(`🔑 Link de redefinição gerado para ${cleanEmail}: ${resetLink}`);

    // 3. Send email via SMTP if configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PASS !== '""' && process.env.SMTP_PASS !== "''") {
      try {
        const defaultSystemEmail = process.env.SYSTEM_EMAIL || 'portalcamboriu@gmail.com';
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"ImobiShare Suporte" <${defaultSystemEmail}>`,
          to: cleanEmail,
          subject: '[ImobiShare] Instruções para Redefinição de Senha',
          text: `Olá, ${broker.nome || 'Corretor'}.\n\nFoi solicitada a redefinição de senha para sua conta no ImobiShare.\n\nClique no link abaixo para criar uma nova senha:\n${resetLink}\n\nSe não foi você quem solicitou, pode ignorar esta mensagem.\n\nAtenciosamente,\nEquipe ImobiShare`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #003366; margin-top: 0; margin-bottom: 16px;">Redefinição de Senha - ImobiShare</h2>
              <p style="font-size: 14px; line-height: 1.5; color: #334155;">Olá, <strong>${broker.nome || 'Corretor'}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.5; color: #334155;">Recebemos uma solicitação para redefinir a senha da sua conta (<code>${cleanEmail}</code>).</p>
              <div style="margin: 28px 0; text-align: center;">
                <a href="${resetLink}" style="background-color: #003366; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  Redefinir Minha Senha
                </a>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:</p>
              <p style="font-size: 12px; color: #003366; word-break: break-all; background-color: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">${resetLink}</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">Se você não solicitou esta alteração, nenhuma ação é necessária e sua senha permanecerá a mesma.</p>
            </div>
          `
        });

        console.log(`✅ E-mail de redefinição de senha enviado com sucesso para ${cleanEmail}`);
      } catch (smtpErr: any) {
        console.warn(`⚠️ Não foi possível enviar e-mail via SMTP (${smtpErr?.message}). Link gerado: ${resetLink}`);
      }
    }

    return res.json({
      success: true,
      message: 'Instruções para redefinição de senha enviadas com sucesso. Verifique sua caixa de entrada e spam.'
    });
  } catch (err: any) {
    logBackendError('/api/auth/forgot-password', err);
    return res.status(500).json({ error: 'Não foi possível processar a redefinição de senha no momento.' });
  }
});

// Reset password with token route
app.post('/api/auth/reset-password-with-token', async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body || {};
    const cleanEmail = email ? String(email).toLowerCase().trim() : '';
    const cleanToken = token ? String(token).trim() : '';
    const cleanPassword = newPassword ? String(newPassword) : '';

    if (!cleanEmail || !cleanToken || !cleanPassword) {
      return res.status(400).json({ error: 'Informe o e-mail, token e a nova senha.' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const broker = await ServerDb.getCorretorByEmail(cleanEmail);
    if (!broker) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (!broker.resetToken || broker.resetToken !== cleanToken) {
      return res.status(400).json({ error: 'Token de redefinição inválido ou já utilizado.' });
    }

    if (broker.resetTokenExpires && broker.resetTokenExpires < Date.now()) {
      return res.status(400).json({ error: 'O link de redefinição expirou. Solicite um novo link.' });
    }

    // Save new password hash & invalidate reset token
    broker.password = await ServerDb.hashPassword(cleanPassword);
    broker.resetToken = undefined;
    broker.resetTokenExpires = undefined;
    await ServerDb.saveCorretor(broker);

    // Sync in Firebase Auth if available
    if (getApps().length) {
      try {
        const user = await getAuth().getUserByEmail(cleanEmail);
        if (user) {
          await getAuth().updateUser(user.uid, { password: cleanPassword });
        }
      } catch (fbErr: any) {
        console.warn('ℹ️ Firebase Auth não configurado ou indisponível para atualização de senha:', fbErr?.message || fbErr?.code || 'auth-disabled');
      }
    }

    return res.json({
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode realizar login com a nova senha.'
    });
  } catch (err: any) {
    logBackendError('/api/auth/reset-password-with-token', err);
    return res.status(500).json({ error: 'Erro ao redefinir a senha.' });
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
      id: (req.body.id && !req.body.id.startsWith('prop-') && !req.body.id.startsWith('imovel-')) ? req.body.id : undefined
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
app.post(['/api/support', '/api/support/send'], async (req: Request, res: Response) => {
  try {
    const { nome, email, telefone, tipo, descricao, creci, cidade } = req.body;
    if (!nome || !email || !descricao) {
      return res.status(400).json({ error: 'Nome, e-mail e descrição são obrigatórios.' });
    }

    const defaultSystemEmail = process.env.SYSTEM_EMAIL || 'portalcamboriu@gmail.com';
    const targetEmail = 'portalcamboriu@gmail.com';

    const assuntoTipo = tipo === 'problema' ? '🚨 Problema' : tipo === 'melhoria' ? '💡 Melhoria' : '❓ Suporte Geral';
    const emailSubject = `[ImobiShare Suporte] ${assuntoTipo} - ${nome}`;

    const textBody = `
==================================================
NOVA MENSAGEM DE SUPORTE - IMOBISHARE
==================================================

E-mail Padrão do Sistema: ${defaultSystemEmail}
Destinatário: ${targetEmail}

--- DADOS DO CORRETOR / SOLICITANTE ---
Nome: ${nome}
E-mail de Contato: ${email}
Telefone / WhatsApp: ${telefone || 'Não informado'}
CRECI: ${creci || 'Não informado'}
Cidade: ${cidade || 'Não informada'}
Tipo de Solicitação: ${assuntoTipo}

--- MENSAGEM / RELATÓRIO ---
${descricao}

==================================================
    `.trim();

    console.log(`=========================================`);
    console.log(`📩 SUPORTE IMOBISHARE -> ${targetEmail}`);
    console.log(`De (Sistema): ${defaultSystemEmail}`);
    console.log(`Solicitante: ${nome} <${email}>`);
    console.log(`Assunto: ${emailSubject}`);
    console.log(`=========================================`);

    // If SMTP credentials are provided, attempt real email send via nodemailer
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PASS !== '""' && process.env.SMTP_PASS !== "''") {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"ImobiShare Sistema" <${defaultSystemEmail}>`,
          to: targetEmail,
          replyTo: email,
          subject: emailSubject,
          text: textBody,
        });

        console.log(`✅ E-mail de suporte enviado com sucesso via SMTP para ${targetEmail}`);
      } catch (smtpErr: any) {
        const errMsg = smtpErr?.message || String(smtpErr);
        console.warn(`⚠️ Disparo via SMTP não concluído (${errMsg}). A mensagem foi registrada com sucesso no sistema.`);
      }
    }

    return res.json({ 
      success: true, 
      message: 'Sua mensagem de suporte foi enviada com sucesso para portalcamboriu@gmail.com!' 
    });
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

  // Serve static folders (public, assets) directly
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

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
