/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

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
