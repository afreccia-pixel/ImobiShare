var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_promises = __toESM(require("fs/promises"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "10mb" }));
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fallback to client-side heuristics.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.post("/api/support/send", async (req, res) => {
  try {
    const { nome, email, telefone, tipo, descricao, creci, cidade } = req.body;
    if (!nome || !email || !descricao) {
      return res.status(400).json({ error: "Os campos Nome, E-mail e Descri\xE7\xE3o s\xE3o obrigat\xF3rios." });
    }
    console.log(`=========================================`);
    console.log(`\u{1F4E9} NOVO FEEDBACK/SUPORTE RECEBIDO DIRECTO`);
    console.log(`-----------------------------------------`);
    console.log(`De: ${nome} <${email}>`);
    console.log(`Telefone: ${telefone || "N\xE3o informado"}`);
    console.log(`Cidade: ${cidade || "N\xE3o informada"}`);
    console.log(`CRECI: ${creci || "N\xE3o informado"}`);
    console.log(`Tipo: ${tipo.toUpperCase()}`);
    console.log(`-----------------------------------------`);
    console.log(`Mensagem:`);
    console.log(descricao);
    console.log(`=========================================`);
    return res.json({ success: true, message: "Sua mensagem foi enviada diretamente!" });
  } catch (error) {
    console.error("Erro no processamento do suporte:", error);
    return res.status(500).json({ error: "Erro ao enviar o suporte. Tente novamente." });
  }
});
app.post("/api/ai/improve-description", async (req, res) => {
  try {
    const { text, type, titulo, localizacao } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Falta o texto base para melhorar." });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackText = `[Simulado] Excelente ${type || "im\xF3vel"} com \xF3timo acabamento, localizado em ${localizacao || "local privilegiado"}. Ideal para quem busca conforto e sofistica\xE7\xE3o. Apresenta excelente ilumina\xE7\xE3o natural, ambientes integrados e \xF3tima ventila\xE7\xE3o. T\xEDtulo: ${titulo || "Im\xF3vel Exclusivo"}. Descri\xE7\xE3o original: "${text}"`;
      return res.json({ text: fallbackText });
    }
    const client = getGeminiClient();
    const systemPrompt = `Voc\xEA \xE9 um corretor de im\xF3veis de luxo de Balne\xE1rio Cambori\xFA especialista em marketing imobili\xE1rio e reda\xE7\xE3o de alto padr\xE3o.
Sua tarefa \xE9 melhorar, corrigir e deixar extremamente atraente a descri\xE7\xE3o resumida de um im\xF3vel para venda ou loca\xE7\xE3o.
Mantenha o texto objetivo, sofisticado, curto (m\xE1ximo de 3 a 4 linhas) e use gatilhos mentais do mercado de luxo.
O im\xF3vel \xE9 do tipo de negocia\xE7\xE3o: ${type || "venda"}. O t\xEDtulo \xE9: "${titulo || ""}". Localiza\xE7\xE3o: "${localizacao || ""}".

Texto original fornecido pelo corretor:
"${text}"

Retorne APENAS o texto da descri\xE7\xE3o melhorada, sem introdu\xE7\xF5es, aspas ou explica\xE7\xF5es adicionais.`;
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt
    });
    const generatedText = response.text?.trim() || text;
    return res.json({ text: generatedText });
  } catch (error) {
    console.error("Error with Gemini API:", error);
    return res.status(500).json({
      error: "Erro ao processar com Intelig\xEAncia Artificial.",
      details: error.message
    });
  }
});
var startServer = async () => {
  const PORT = 3e3;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.includes(".")) {
        return next();
      }
      try {
        const templatePath = import_path.default.resolve(process.cwd(), "index.html");
        let template = await import_promises.default.readFile(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).send(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
};
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
