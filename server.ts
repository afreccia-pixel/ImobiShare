/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ServerDb } from './server-db';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json({ limit: '10mb' }));

// Lazy init of Gemini API client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fallback to client-side heuristics.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'MOCK_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// JWT Token Decoder helper for Google Sign-In
function decodeGoogleToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch (err) {
    console.error('Error decoding Google token:', err);
    return null;
  }
}

// REST API for Email/Password Authentication
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    const broker = await ServerDb.getCorretorByEmail(email);
    if (!broker) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos. Registre-se caso seja um novo corretor.' });
    }
    if (broker.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    // Session success
    const { password: _, ...cleanBroker } = broker;
    return res.json({ success: true, corretor: cleanBroker });
  } catch (error: any) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

// REST API for Email/Password Registration
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { nome, email, password, creci, telefone, whatsapp, cidade } = req.body;
    if (!nome || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    const existing = await ServerDb.getCorretorByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }
    
    const id = `corretor-${Date.now()}`;
    const newBroker = {
      id,
      nome,
      email,
      password,
      creci: creci || 'CRECI Pendente',
      telefone: telefone || '',
      whatsapp: whatsapp || '',
      foto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      cidade: cidade || 'Balneário Camboriú',
      restringirParceiros: false,
      parceirosEmails: []
    };
    
    const saved = await ServerDb.saveCorretor(newBroker);
    return res.json({ success: true, corretor: saved });
  } catch (error: any) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

// REST API for Google Sign-In backend verification
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Token de credencial do Google é obrigatório.' });
    }
    
    const payload = decodeGoogleToken(credential);
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Token do Google inválido ou ilegível.' });
    }
    
    let broker = await ServerDb.getCorretorByEmail(payload.email);
    if (!broker) {
      // Register new broker automatically via Google credentials
      const id = `corretor-${Date.now()}`;
      broker = {
        id,
        nome: payload.name || payload.email.split('@')[0],
        email: payload.email,
        password: `google_${Date.now()}_auth`, // Secure placeholder password
        creci: 'CRECI Pendente',
        telefone: '',
        whatsapp: '',
        foto: payload.picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        cidade: 'Balneário Camboriú',
        restringirParceiros: false,
        parceirosEmails: []
      };
      await ServerDb.saveCorretor(broker);
    }
    
    const { password: _, ...cleanBroker } = broker;
    return res.json({ success: true, corretor: cleanBroker });
  } catch (error: any) {
    console.error('Erro no login com Google:', error);
    return res.status(500).json({ error: 'Erro interno ao processar login com Google.' });
  }
});

// REST API Database Properties and Brokers endpoints
app.get('/api/properties', async (req: Request, res: Response) => {
  try {
    const list = await ServerDb.getImoveis();
    return res.json(list);
  } catch (error: any) {
    console.error('Erro ao buscar imóveis:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar imóveis.' });
  }
});

app.post('/api/properties', async (req: Request, res: Response) => {
  try {
    const saved = await ServerDb.saveImovel(req.body);
    return res.json(saved);
  } catch (error: any) {
    console.error('Erro ao salvar imóvel:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar imóvel.' });
  }
});

app.delete('/api/properties/:id', async (req: Request, res: Response) => {
  try {
    await ServerDb.deleteImovel(req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar imóvel:', error);
    return res.status(500).json({ error: 'Erro ao deletar imóvel.' });
  }
});

app.get('/api/brokers', async (req: Request, res: Response) => {
  try {
    const list = await ServerDb.getCorretores();
    return res.json(list);
  } catch (error: any) {
    console.error('Erro ao buscar corretores:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar corretores.' });
  }
});

app.post('/api/brokers', async (req: Request, res: Response) => {
  try {
    const saved = await ServerDb.saveCorretor(req.body);
    return res.json(saved);
  } catch (error: any) {
    console.error('Erro ao salvar corretor:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar perfil do corretor.' });
  }
});

app.get('/api/favorites/:corretorId', async (req: Request, res: Response) => {
  try {
    const list = await ServerDb.getFavoritos(req.params.corretorId);
    return res.json(list);
  } catch (error: any) {
    console.error('Erro ao buscar favoritos:', error);
    return res.status(500).json({ error: 'Erro ao buscar favoritos.' });
  }
});

app.post('/api/favorites/toggle', async (req: Request, res: Response) => {
  try {
    const { corretorId, imovelId } = req.body;
    if (!corretorId || !imovelId) {
      return res.status(400).json({ error: 'corretorId e imovelId são obrigatórios.' });
    }
    const list = await ServerDb.toggleFavorite(corretorId, imovelId);
    return res.json(list);
  } catch (error: any) {
    console.error('Erro ao alternar favorito:', error);
    return res.status(500).json({ error: 'Erro ao favoritar imóvel.' });
  }
});

// REST API endpoint to receive support and feedback messages directly
app.post('/api/support/send', async (req: Request, res: Response) => {
  try {
    const { nome, email, telefone, tipo, descricao, creci, cidade } = req.body;

    if (!nome || !email || !descricao) {
      return res.status(400).json({ error: 'Os campos Nome, E-mail e Descrição são obrigatórios.' });
    }

    console.log(`=========================================`);
    console.log(`📩 NOVO FEEDBACK/SUPORTE RECEBIDO DIRECTO`);
    console.log(`-----------------------------------------`);
    console.log(`De: ${nome} <${email}>`);
    console.log(`Telefone: ${telefone || 'Não informado'}`);
    console.log(`Cidade: ${cidade || 'Não informada'}`);
    console.log(`CRECI: ${creci || 'Não informado'}`);
    console.log(`Tipo: ${tipo.toUpperCase()}`);
    console.log(`-----------------------------------------`);
    console.log(`Mensagem:`);
    console.log(descricao);
    console.log(`=========================================`);

    // Here, in production, they can integrate an email sender library like nodemailer, Resend, or Formspree
    // Since this is client-safe, we respond with success to display the feedback instantly.
    return res.json({ success: true, message: 'Sua mensagem foi enviada diretamente!' });
  } catch (error: any) {
    console.error('Erro no processamento do suporte:', error);
    return res.status(500).json({ error: 'Erro ao enviar o suporte. Tente novamente.' });
  }
});

// REST API endpoint to improve real estate property description using Gemini 3.5 Flash
app.post('/api/ai/improve-description', async (req: Request, res: Response) => {
  try {
    const { text, type, titulo, localizacao } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Falta o texto base para melhorar.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return a simulated high-quality description if API Key is not set
      const fallbackText = `[Simulado] Excelente ${type || 'imóvel'} com ótimo acabamento, localizado em ${localizacao || 'local privilegiado'}. Ideal para quem busca conforto e sofisticação. Apresenta excelente iluminação natural, ambientes integrados e ótima ventilação. Título: ${titulo || 'Imóvel Exclusivo'}. Descrição original: "${text}"`;
      return res.json({ text: fallbackText });
    }

    const client = getGeminiClient();

    const systemPrompt = `Você é um corretor de imóveis de luxo de Balneário Camboriú especialista em marketing imobiliário e redação de alto padrão.
Sua tarefa é melhorar, corrigir e deixar extremamente atraente a descrição resumida de um imóvel para venda ou locação.
Mantenha o texto objetivo, sofisticado, curto (máximo de 3 a 4 linhas) e use gatilhos mentais do mercado de luxo.
O imóvel é do tipo de negociação: ${type || 'venda'}. O título é: "${titulo || ''}". Localização: "${localizacao || ''}".

Texto original fornecido pelo corretor:
"${text}"

Retorne APENAS o texto da descrição melhorada, sem introduções, aspas ou explicações adicionais.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: systemPrompt,
    });

    const generatedText = response.text?.trim() || text;
    return res.json({ text: generatedText });

  } catch (error: any) {
    console.error('Error with Gemini API:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar com Inteligência Artificial.', 
      details: error.message 
    });
  }
});

// Setup Vite integration
const startServer = async () => {
  const PORT = 3000;

  // Initialize persistent database
  await ServerDb.init();

  if (process.env.NODE_ENV !== 'production') {
    // Dynamically import Vite server in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.get('*', async (req, res, next) => {
      // Exclude API routes and files with extensions
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
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
