/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Exportador DWV -> ImobiShare
 * ============================
 *
 * Varre pastas de construtora/empreendimento, seleciona e compacta fotos,
 * extrai dados de tabela (PDF/JSON/CSV) e gera copywriting com IA (Gemini).
 *
 * Diferença em relação à versão anterior: este script NÃO usa mais nenhum
 * banco local (JSON/SQLite em `C:\Sqlite`, `data/db.json`, etc.). Ele grava
 * diretamente no banco de produção do ImobiShare — PostgreSQL hospedado no
 * Neon — através da mesma classe `ServerDb` usada pelo servidor Express
 * (server.ts), lendo a connection string de `process.env.DATABASE_URL`.
 *
 * LIMITAÇÃO IMPORTANTE DE SCHEMA:
 * A tabela `imoveis` do ImobiShare guarda UM imóvel por linha (não existe
 * uma tabela de "unidades" por empreendimento). Por isso, cada pasta de
 * empreendimento processada aqui vira (ou atualiza) UM único registro em
 * `imoveis`, representando a unidade de menor valor disponível encontrada
 * na tabela. As demais unidades lidas do PDF/JSON/CSV são usadas só para
 * calcular essa menor unidade e enriquecer a descrição — elas não são
 * persistidas individualmente. Se no futuro for necessário listar cada
 * unidade como um anúncio próprio, isso exige uma tabela nova, fora do
 * escopo deste script.
 *
 * SEGURANÇA DE DADOS:
 * Diferente da versão anterior, este script NUNCA fabrica um empreendimento
 * ou uma unidade/preço que não exista nos arquivos de origem. Se nenhuma
 * pasta for encontrada, ou se nenhuma unidade/preço real puder ser extraído
 * de um empreendimento, o script pula esse item (não cria nem atualiza nada
 * no banco de produção) em vez de inserir dados fictícios — pois isso iria
 * parar no site público do ImobiShare como se fosse um anúncio real.
 *
 * ARQUIVO endereco_descricao:
 * Cada pasta de empreendimento pode conter um arquivo de texto chamado
 * "endereco_descricao" ou "[nome_do_empreendimento]_endereco_descricao"
 * (com ou sem extensão .txt/.md) preenchido manualmente, no formato de
 * rótulos por linha:
 *
 *   Endereço: Rua 3750, 181, Centro, Bal. Camboriú - SC
 *   Latitude: -26.9895
 *   Longitude: -48.6295
 *   Descrição das unidades:
 *   • Acabamento em gesso
 *   • Aquecimento a Gás
 *   ...
 *   Características do empreendimento:
 *   • Academia
 *   • Piscina
 *   ...
 *
 * Quando presente, este script usa o "Endereço" para atualizar o campo
 * `endereco` do imóvel no ImobiShare (tem prioridade sobre o endereço lido
 * do PDF/JSON/CSV ou encontrado via pesquisa online), usa "Latitude"/
 * "Longitude" para atualizar os campos numéricos `latitude`/`longitude` do
 * imóvel (mesmos campos já existentes em `Imovel` — não precisa de coluna
 * nova no banco), e usa a "Descrição das unidades" e as "Características do
 * empreendimento" como fonte adicional de fatos reais para melhorar a
 * descrição gerada pela IA (ver `readEnderecoDescricaoFile` e
 * `generateAiEnhancedDescription`). "Latitude"/"Longitude" são opcionais —
 * quando ausentes ou inválidas, o script simplesmente não mexe no que já
 * estava gravado (nunca apaga uma coordenada boa por falta de dado novo).
 *
 * CACHE LOCAL (VELOCIDADE):
 * Este script mantém uma pasta de cache (".cache_exportar_imobishare", na raiz do projeto,
 * NUNCA enviada ao banco) pra não refazer trabalho caro numa execução que não mudou nada
 * desde a última vez: fotos já compactadas (".../photos/<hash>.jpg", reaproveitada quando a
 * foto de origem tem o mesmo caminho/tamanho/data de modificação — ver `compressPhotoToMax50Kb`)
 * e descrições já geradas pela IA (".../ai_cache.json", reaproveitada quando nenhum dos dados
 * que alimentam o prompt do Gemini mudou pra aquele empreendimento — ver `hashEntradaIA`). Uma
 * foto de origem que já está com <= 50 KB também pula a recompactação direto, sem nem
 * consultar o cache. Pode apagar essa pasta a qualquer momento pra forçar tudo a ser
 * reprocessado do zero (ex.: depois de mudar o algoritmo de compactação, ou pra forçar a IA a
 * gerar um texto novo pra todos os empreendimentos).
 *
 * STATUS DO IMÓVEL:
 * O status de origem do empreendimento (Lançamento / Pré-Lançamento / Pronto
 * para morar / Terceiros exclusivos — ver `detectarStatusOrigem` para onde
 * esse dado é procurado) é mapeado para o campo `statusImovel` do ImobiShare
 * (ver `mapStatusOrigemParaStatusImovel`):
 *   Lançamento / Pré-Lançamento -> "Na planta"
 *   Pronto para morar           -> "Sem mobília"
 *   Terceiros exclusivos        -> "Mobiliado"
 * O campo `informacoes` do imóvel sempre inclui construtora, unidade,
 * se é "Terceiros exclusivos" e se é importação DWV, além de entrega/incorporação.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { Jimp } from 'jimp';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import dotenv from 'dotenv';
import { ServerDb, logBackendError, logMemory } from '../server-db';
import type { Imovel } from '../src/types';

// Carrega o .env local (mesma convenção usada em server.ts) — sem isso,
// DATABASE_URL e GEMINI_API_KEY nunca chegam até este script quando rodado
// isoladamente via `npm run export:imobishare`.
dotenv.config();

/** Extrai o texto de um PDF usando a API do pdf-parse v2 (não é mais uma função
 * chamável direto como na v1 — agora é a classe PDFParse). */
async function extractTextFromPdf(dataBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: dataBuffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

// E-mail do corretor "dono" dos imóveis importados via DWV no ImobiShare.
// Esse corretor precisa existir (ou será criado automaticamente por
// ServerDb.saveImovel) — por padrão usa o admin do sistema.
// Pode ser sobrescrito com a variável de ambiente IMPORT_OWNER_EMAIL.
const IMPORT_OWNER_EMAIL = (process.env.IMPORT_OWNER_EMAIL || 'afreccia@gmail.com').toLowerCase().trim();

// Cidade padrão de todos os lançamentos DWV (mesma convenção usada no restante do app: sem "- SC").
const CIDADE_PADRAO = 'Balneário Camboriú';

// Pasta de cache local (persiste entre execuções do script, na raiz do projeto) usada para
// pular trabalho já feito em execuções anteriores quando nada mudou: fotos já compactadas
// (ver `compressPhotoToMax50Kb`) e descrições já geradas pela IA (ver `ai_cache.json`
// carregado em `executeExportToImobiShare`). Nunca é enviada ao banco — é só um atalho local.
const CACHE_DIR = path.join(process.cwd(), '.cache_exportar_imobishare');
const PHOTOS_CACHE_DIR = path.join(CACHE_DIR, 'photos');
const AI_CACHE_PATH = path.join(CACHE_DIR, 'ai_cache.json');
// Teste FG/Baggio: nenhuma chamada à IA nem reutilização de textos gerados por IA.
const USAR_IA_NESTE_TESTE: boolean = false;
const DWV_RESULTADOS_CSV = process.env.DWV_RESULTADOS_CSV || 'C:\\Sqlite\\DWV\\tests\\dwv_resultados.csv';

interface DadosCsvDwv {
  dataAtualizacao: string;
  descricaoUnidades: string;
  descricaoEmpreendimento: string;
  endereco: string;
  latitude?: number;
  longitude?: number;
  bairro: string;
}

// Respeita campos entre aspas, inclusive descrições com quebra de linha e ponto e vírgula.
function lerRegistrosCsv(conteudo: string, separador: string): string[][] {
  const registros: string[][] = [];
  let linha: string[] = [], campo = '', aspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (c === '"') {
      if (aspas && conteudo[i + 1] === '"') { campo += '"'; i++; }
      else aspas = !aspas;
    } else if (c === separador && !aspas) {
      linha.push(campo); campo = '';
    } else if ((c === '\n' || c === '\r') && !aspas) {
      if (c === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some(v => v.trim())) registros.push(linha);
      linha = []; campo = '';
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some(v => v.trim())) registros.push(linha);
  return registros;
}

function chaveCsv(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function carregarResultadosDwv(caminho = DWV_RESULTADOS_CSV): Map<string, DadosCsvDwv> {
  const dados = new Map<string, DadosCsvDwv>();
  if (!fs.existsSync(caminho)) {
    console.warn(`[ImobiShare Exporter] CSV DWV não encontrado: ${caminho}`);
    return dados;
  }
  const conteudo = fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '');
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0];
  const linhas = lerRegistrosCsv(conteudo, primeiraLinha.split(';').length >= primeiraLinha.split(',').length ? ';' : ',');
  const cabecalho = (linhas.shift() || []).map(chaveCsv);
  const indice = (...nomes: string[]) => nomes.map(chaveCsv).map(n => cabecalho.indexOf(n)).find(i => i >= 0) ?? -1;
  const pegar = (linha: string[], ...nomes: string[]) => (linha[indice(...nomes)] || '').trim();
  if (indice('Construtora') < 0 || indice('Empreendimento') < 0) {
    console.warn(`[ImobiShare Exporter] CSV sem colunas Construtora/Empreendimento: ${caminho}`);
    return dados;
  }
  for (const linha of linhas) {
    const construtora = pegar(linha, 'Construtora');
    const empreendimento = pegar(linha, 'Empreendimento');
    if (!construtora || !empreendimento) continue;
    const lat = parseCoordenada(pegar(linha, 'Latitude', 'Lat'), [-90, 90]);
    const lon = parseCoordenada(pegar(linha, 'Longitude', 'Lng', 'Lon'), [-180, 180]);
    const entrada: DadosCsvDwv = {
      dataAtualizacao: pegar(linha, 'Data_atualizacao_DWV', 'Data_atualizacao', 'Atualizado_dw'),
      descricaoUnidades: pegar(linha, 'Descricao_unidade', 'Descricao_unidades'),
      descricaoEmpreendimento: pegar(linha, 'Descricao_empreendimento', 'Descricao'),
      endereco: pegar(linha, 'Endereco', 'Endereço'),
      latitude: lat, longitude: lon,
      bairro: pegar(linha, 'Bairro')
    };
    const chave = `${chaveCsv(construtora)}|${chaveCsv(empreendimento)}`;
    const anterior = dados.get(chave);
    // Se houver mais de uma linha para o mesmo empreendimento, preserve os campos preenchidos.
    dados.set(chave, {
      ...anterior, ...Object.fromEntries(Object.entries(entrada).filter(([, valor]) => valor !== '' && valor !== undefined))
    } as DadosCsvDwv);
  }
  console.log(`[ImobiShare Exporter] ${dados.size} empreendimentos lidos de ${caminho}`);
  return dados;
}

export interface ExportProgressEvent {
  step: 'scanning' | 'images' | 'pdf' | 'ai' | 'database' | 'skipped' | 'complete' | 'error';
  construtora?: string;
  empreendimento?: string;
  message: string;
  percent: number;
  data?: any;
}

export interface DevelopmentFolderData {
  construtora: string;
  empreendimento: string;
  folderPath: string;
  imagePaths: string[];
  pdfPaths: string[];
  jsonPath?: string;
  csvPath?: string;
  /** Caminho do arquivo "endereco_descricao" (texto com rótulos), se existir na pasta. */
  enderecoDescricaoPath?: string;
}

/** Condições de pagamento lidas da tabela (quando a seção tiver essas colunas) —
 * ver `normalizarColunaPagamento` e o trecho que lê `currentPaymentColumns` em
 * `parseUnidadesFromDwvTemplate`. */
export interface CondicoesPagamento {
  entrada?: number;
  reforco?: number;
  /** Quantidade de reforços anuais, lida do próprio rótulo da coluna (ex.: "REFORÇO 5X" -> 5). */
  reforcoVezes?: number;
  parcelamento?: number;
  /** Quantidade de parcelas, lida do próprio rótulo da coluna (ex.: "PARCELAMENTO 60X" -> 60). */
  parcelamentoVezes?: number;
}

/** Unidade lida do PDF/JSON/CSV de um empreendimento. Uso interno apenas —
 * não existe tabela própria no ImobiShare para persistir cada unidade. */
export interface UnidadeExtraida {
  id: string;
  numero_unidade: string;
  torre?: string;
  andar?: number;
  tipologia?: string;
  dormitorios?: number;
  suites?: number;
  banheiros?: number;
  vagas?: number;
  area_privativa: number;
  area_total?: number;
  valor: number;
  pagamento?: CondicoesPagamento;
  status: 'disponivel' | 'indisponivel' | 'reservada' | 'vendida';
}

/** Dados lidos manualmente do arquivo "endereco_descricao" de um empreendimento. */
export interface EnderecoDescricaoData {
  /** Endereço completo, ex: "Rua 3750, 181, Centro, Bal. Camboriú - SC". */
  endereco: string;
  /** Latitude do empreendimento (rótulo "Latitude:" no arquivo) — undefined quando o rótulo
   * não existe no arquivo ou o valor não é um número válido (nunca inventa). */
  latitude?: number;
  /** Longitude do empreendimento (rótulo "Longitude:" no arquivo) — mesma regra de `latitude`. */
  longitude?: number;
  /** Texto (geralmente lista com "•") descrevendo o acabamento/itens das unidades. */
  descricaoUnidades: string;
  /** Texto (geralmente lista com "•") descrevendo os itens de lazer/infra do empreendimento. */
  caracteristicas: string;
}

/** Converte o texto de um rótulo "Latitude:"/"Longitude:" do arquivo endereco_descricao pra
 * número — aceita tanto ponto quanto vírgula como separador decimal (a vírgula é comum
 * quando alguém digita a coordenada copiando do Google Maps em pt-BR). Retorna undefined
 * (nunca inventa/arredonda um valor) quando o texto não é um número, ou quando está fora da
 * faixa geográfica válida (latitude entre -90 e 90, longitude entre -180 e 180) — um valor
 * fora dessa faixa quase certamente é erro de digitação, não uma coordenada real. */
function parseCoordenada(raw: string, faixa: [number, number]): number | undefined {
  const limpo = raw.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return undefined;
  const valor = parseFloat(limpo);
  if (!Number.isFinite(valor) || valor < faixa[0] || valor > faixa[1]) return undefined;
  return valor;
}

/**
 * 1. Varre as pastas de construtora/empreendimento em C:\Sqlite, public/downloads e data
 */
export function scanDevelopmentFolders(): DevelopmentFolderData[] {
  const results: DevelopmentFolderData[] = [];
  const searchRoots: string[] = [];

  // Raizes possiveis
  if (process.platform === 'win32' && fs.existsSync('C:\\Sqlite')) {
    searchRoots.push('C:\\Sqlite');
    if (fs.existsSync('C:\\Sqlite\\DWV')) searchRoots.push('C:\\Sqlite\\DWV');
  }
  const publicDownloads = path.join(process.cwd(), 'public', 'downloads');
  if (fs.existsSync(publicDownloads)) {
    searchRoots.push(publicDownloads);
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    searchRoots.push(dataDir);
  }

  const seenKeys = new Set<string>();

  for (const root of searchRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      const construtoras = fs.readdirSync(root, { withFileTypes: true });

      for (const cEntry of construtoras) {
        if (!cEntry.isDirectory()) continue;
        const construtoraName = cEntry.name;
        // Ignora pastas de sistema ou downloads genericos
        if (['optimized_images', 'images', 'DWV', 'node_modules', '.git'].includes(construtoraName)) continue;

        const construtoraPath = path.join(root, construtoraName);
        let empEntries: fs.Dirent[] = [];
        try {
          empEntries = fs.readdirSync(construtoraPath, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const empEntry of empEntries) {
          if (!empEntry.isDirectory()) continue;
          // Nome real da pasta no disco (usado pra abrir arquivos) vs. nome "limpo" pra exibir
          // (título, descrição, campo gravado no banco) — corrige nome colado sem espaçamento
          // (ex.: "EssenzaResidence" -> "Essenza Residence"), selo de status colado (ex.: "Le
          // MajesticPronto para morar" -> "Le Majestic") e pasta com nome colado em
          // duplicidade (ex.: "San Paolo ResidenzialeSan Paolo Residenziale").
          const empName = empEntry.name;
          const empNameLimpo = removerNomeDuplicado(removerStatusColado(adicionarEspacamentoNome(empName)));
          const key = `${construtoraName.toLowerCase()}_${empName.toLowerCase()}`;
          if (seenKeys.has(key)) continue;

          const empFolder = path.join(construtoraPath, empName);

          // Coletar imagens
          const imagePaths: string[] = [];
          const pdfPaths: string[] = [];
          let jsonPath: string | undefined;
          let csvPath: string | undefined;
          let enderecoDescricaoPath: string | undefined;

          // Buscar na raiz da pasta do empreendimento
          const files = fs.readdirSync(empFolder);
          for (const f of files) {
            const fullFilePath = path.join(empFolder, f);
            const lower = f.toLowerCase();
            // Nome do arquivo sem extensão, pra aceitar .txt, .md ou sem extensão.
            const baseNoExt = lower.replace(/\.[a-z0-9]+$/i, '');

            if (/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
              imagePaths.push(fullFilePath);
            } else if (lower.endsWith('.pdf')) {
              pdfPaths.push(fullFilePath);
            } else if (lower === 'empreendimento.json') {
              jsonPath = fullFilePath;
            } else if (lower === 'tabela.csv') {
              csvPath = fullFilePath;
            } else if (/(^|_)endereco_descricao$/.test(baseNoExt) && /\.(txt|md)$/i.test(lower)) {
              // Aceita tanto "endereco_descricao.txt" quanto
              // "[nome_do_empreendimento]_endereco_descricao.txt" (prefixo com o nome
              // do empreendimento, convenção usada nos arquivos reais).
              enderecoDescricaoPath = fullFilePath;
            } else if (/(^|_)endereco_descricao$/.test(lower)) {
              // Mesma coisa, mas sem extensão nenhuma.
              enderecoDescricaoPath = fullFilePath;
            }
          }

          // Buscar em subpastas fotos/ ou imagens/ se houver
          const fotosSubdir = path.join(empFolder, 'fotos');
          if (fs.existsSync(fotosSubdir)) {
            const fotosFiles = fs.readdirSync(fotosSubdir);
            for (const f of fotosFiles) {
              if (/\.(jpg|jpeg|png|webp)$/i.test(f.toLowerCase())) {
                imagePaths.push(path.join(fotosSubdir, f));
              }
            }
          }

          seenKeys.add(key);
          results.push({
            construtora: construtoraName,
            empreendimento: empNameLimpo,
            folderPath: empFolder,
            imagePaths,
            pdfPaths,
            jsonPath,
            csvPath,
            enderecoDescricaoPath
          });
        }
      }
    } catch (err) {
      console.warn(`[ImobiShare Exporter] Erro ao varrer raiz ${root}:`, err);
    }
  }

  // Nota: propositalmente NÃO há mais um fallback de empreendimentos fictícios
  // quando nenhuma pasta é encontrada. Isso escrevia dados fabricados
  // (construtora, preço, unidades) direto no banco de produção. Se nada for
  // encontrado, o chamador simplesmente não terá o que exportar.

  return results;
}

/**
 * Lê e interpreta o arquivo "endereco_descricao" de um empreendimento (quando existir).
 *
 * Formato esperado (rótulos por linha, preenchido manualmente):
 *
 *   Endereço: Rua 3750, 181, Centro, Bal. Camboriú - SC
 *   Descrição das unidades:
 *   • Acabamento em gesso
 *   • Aquecimento a Gás
 *   ...
 *   Características do empreendimento:
 *   • Academia
 *   • Piscina
 *   ...
 *
 * O rótulo "Endereço:" normalmente vem com o valor na mesma linha; os rótulos
 * "Descrição das unidades:" e "Características do empreendimento:" normalmente
 * vêm sozinhos na linha, seguidos por uma lista (com "•" ou "-") nas linhas
 * seguintes, até o próximo rótulo ou o fim do arquivo. Este parser aceita as
 * duas formas (rótulo com conteúdo inline OU conteúdo nas linhas seguintes) e
 * é tolerante a acentuação/maiúsculas. "Latitude:"/"Longitude:" são rótulos
 * opcionais (também inline) — ver `parseCoordenada` para o formato aceito.
 *
 * Retorna null se o arquivo não existir ou não puder ser lido — nesse caso o
 * chamador segue sem esses dados extras, sem inventar nada.
 */
export function readEnderecoDescricaoFile(filePath: string | undefined): EnderecoDescricaoData | null {
  if (!filePath || !fs.existsSync(filePath)) return null;

  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(`[ImobiShare Exporter] Aviso ao ler ${filePath}:`, err);
    return null;
  }

  const lines = raw.split(/\r?\n/);

  type Secao = 'endereco' | 'latitude' | 'longitude' | 'descricaoUnidades' | 'caracteristicas';

  const HEADERS: Array<{ key: Secao; regex: RegExp }> = [
    { key: 'endereco', regex: /^endere[cç]o\s*:?\s*(.*)$/i },
    { key: 'latitude', regex: /^latitude\s*:?\s*(.*)$/i },
    { key: 'longitude', regex: /^longitude\s*:?\s*(.*)$/i },
    { key: 'descricaoUnidades', regex: /^descri[cç][ãa]o\s+das\s+unidades\s*:?\s*(.*)$/i },
    { key: 'caracteristicas', regex: /^caracter[ií]sticas\s+do\s+empreendimento\s*:?\s*(.*)$/i }
  ];

  const buffers: Record<Secao, string[]> = {
    endereco: [],
    latitude: [],
    longitude: [],
    descricaoUnidades: [],
    caracteristicas: []
  };

  let currentSection: Secao | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const matchedHeader = HEADERS.find((h) => h.regex.test(line));
    if (matchedHeader) {
      currentSection = matchedHeader.key;
      const inlineContent = line.match(matchedHeader.regex)?.[1]?.trim();
      if (inlineContent) {
        buffers[matchedHeader.key].push(inlineContent);
      }
      continue;
    }

    if (currentSection) {
      buffers[currentSection].push(line);
    }
  }

  const endereco = buffers.endereco.join(', ').trim();
  const descricaoUnidades = buffers.descricaoUnidades.join('\n').trim();
  const caracteristicas = buffers.caracteristicas.join('\n').trim();
  const latitude = parseCoordenada(buffers.latitude.join(' '), [-90, 90]);
  const longitude = parseCoordenada(buffers.longitude.join(' '), [-180, 180]);

  if (!endereco && !descricaoUnidades && !caracteristicas && latitude === undefined && longitude === undefined) {
    return null;
  }

  return { endereco, latitude, longitude, descricaoUnidades, caracteristicas };
}

/**
 * 2. Ordena fotos garantindo que a FACHADA seja a primeira (index 0) e seleciona ate 15 fotos
 */
export function sortAndSelect15Photos(imagePaths: string[], _empreendimentoName: string): string[] {
  if (imagePaths.length === 0) {
    return [];
  }

  // Pontua as imagens para identificar fachada
  const scored = imagePaths.map((p) => {
    const lower = path.basename(p).toLowerCase();
    let score = 0;

    if (lower.includes('fachada') || lower.includes('facade')) score += 100;
    if (lower.includes('perspectiva') || lower.includes('externa') || lower.includes('exterior')) score += 80;
    if (lower.includes('predio') || lower.includes('torre') || lower.includes('edificio')) score += 60;
    if (lower.includes('foto_01') || lower.includes('foto_1.') || lower.includes('01.') || lower.includes('img_1.')) score += 40;
    if (lower.includes('lazer') || lower.includes('piscina') || lower.includes('living')) score += 10;

    return { path: p, score, name: lower };
  });

  // Ordena decrescente pelo score da fachada
  scored.sort((a, b) => b.score - a.score);

  // Seleciona ate 15 fotos reais (sem preencher com placeholders sintéticos)
  return scored.slice(0, 15).map((s) => s.path);
}

/**
 * 3. Compacta uma imagem para ter NO MAXIMO 50 KB (51.200 bytes) com alta nitidez
 */
/** Extensão do arquivo -> mime type real, usado só no atalho de "já está pequena" abaixo
 * (quando a foto NÃO passa pelo Jimp, o data URI tem que refletir o formato de origem de
 * verdade — .png/.webp — em vez de assumir JPEG). */
function mimeTypeDaExtensao(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg'; // .jpg/.jpeg e qualquer outra extensão aceita (ver sortAndSelect15Photos)
}

/** Identifica de forma estável a MESMA foto de origem entre execuções (caminho + tamanho +
 * data de modificação do arquivo) — se nada disso mudou desde a última vez, a versão já
 * compactada em `PHOTOS_CACHE_DIR` pode ser reaproveitada sem rodar o Jimp de novo. Se o
 * arquivo de origem for trocado/atualizado, tamanho e/ou mtime mudam e o hash muda junto,
 * então a foto é recompactada normalmente (nunca reaproveita uma foto errada). */
function hashArquivoFoto(imagePath: string, isFacade: boolean): string {
  const stat = fs.statSync(imagePath);
  return crypto
    .createHash('sha1')
    .update(imagePath)
    .update(String(stat.size))
    .update(String(Math.round(stat.mtimeMs)))
    .update(isFacade ? 'facade' : 'normal')
    .digest('hex');
}

export async function compressPhotoToMax50Kb(
  imagePath: string,
  empreendimentoName: string,
  index: number,
  isFacade: boolean
): Promise<{ url: string; sizeKb: number; width: number; height: number }> {
  const MAX_BYTES = 50 * 1024; // 51200 bytes

  // Atalho 1: a foto de origem já está dentro do limite de 50 KB — usa o arquivo original
  // direto, sem decodificar/recomprimir com o Jimp (recomprimir de novo só gastaria CPU à
  // toa e ainda poderia piorar a qualidade sem necessidade nenhuma). width/height ficam em 0
  // porque nada aqui usa esses valores — só `.url` é consumido pelo chamador — e calculá-los
  // exigiria decodificar a imagem, que é exatamente o custo que este atalho evita.
  const statOriginal = fs.statSync(imagePath);
  if (statOriginal.size <= MAX_BYTES) {
    const buffer = fs.readFileSync(imagePath);
    return {
      url: `data:${mimeTypeDaExtensao(imagePath)};base64,${buffer.toString('base64')}`,
      sizeKb: Math.round((buffer.length / 1024) * 10) / 10,
      width: 0,
      height: 0
    };
  }

  // Atalho 2: essa mesma foto (mesmo caminho/tamanho/data) já foi compactada numa execução
  // anterior deste script — reaproveita o resultado do cache em vez de rodar o Jimp de novo.
  const hashFoto = hashArquivoFoto(imagePath, isFacade);
  const caminhoCache = path.join(PHOTOS_CACHE_DIR, `${hashFoto}.jpg`);
  if (fs.existsSync(caminhoCache)) {
    const buffer = fs.readFileSync(caminhoCache);
    return {
      url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      sizeKb: Math.round((buffer.length / 1024) * 10) / 10,
      width: 0,
      height: 0
    };
  }

  const inputBuffer = fs.readFileSync(imagePath);

  let img;
  try {
    img = await Jimp.read(inputBuffer);
  } catch (err) {
    throw new Error(`Não foi possível ler a imagem ${imagePath}: ${(err as Error)?.message || err}`);
  }

  // Algoritmo de compressao adaptativa para <= 50 KB (51200 bytes)
  let quality = 75;
  let targetWidth = Math.min(img.width, 1200);

  let outputBuffer: Buffer | null = null;
  let attempts = 0;

  while (attempts < 6) {
    attempts++;

    const cloned = img.clone();
    if (cloned.width > targetWidth) {
      cloned.resize({ w: targetWidth });
    }

    outputBuffer = await cloned.getBuffer('image/jpeg', { quality });

    if (outputBuffer.length <= MAX_BYTES || (quality <= 30 && targetWidth <= 480)) {
      break;
    }

    if (outputBuffer.length > MAX_BYTES * 1.5) {
      targetWidth = Math.round(targetWidth * 0.75);
      quality = Math.max(quality - 15, 35);
    } else {
      quality = Math.max(quality - 10, 30);
      targetWidth = Math.round(targetWidth * 0.85);
    }
  }

  if (!outputBuffer) {
    outputBuffer = await img.getBuffer('image/jpeg', { quality: 50 });
  }

  const finalSizeKb = Math.round((outputBuffer.length / 1024) * 10) / 10;

  // IMPORTANTE: as fotos são retornadas como data URI base64 embutido, NÃO como
  // caminho de arquivo em disco. O resto do ImobiShare (veja src/components/
  // PropertyForm.tsx, que usa FileReader.readAsDataURL) já guarda fotos assim —
  // como string "data:image/...;base64,..." direto na coluna `imagens`. Um
  // caminho tipo "/optimized_images/foto.webp" só funcionaria se este script
  // rodasse no mesmo servidor que serve o site, o que não é o caso aqui (o
  // servidor roda no Cloud Run, com disco efêmero, enquanto este script roda
  // localmente na sua máquina) — era por isso que as fotos não apareciam.
  const dataUri = `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;

  // Grava o resultado no cache pra próxima execução não precisar recompactar essa mesma foto
  // de novo (ver Atalho 2 acima) — falha ao gravar o cache não é motivo pra falhar a foto em
  // si (a compactação já funcionou), só significa que a próxima execução recompacta de novo.
  try {
    fs.mkdirSync(PHOTOS_CACHE_DIR, { recursive: true });
    fs.writeFileSync(caminhoCache, outputBuffer);
  } catch (err) {
    console.warn(`[ImobiShare Exporter] Não foi possível gravar cache da foto compactada de ${empreendimentoName}:`, err);
  }

  return {
    url: dataUri,
    sizeKb: finalSizeKb,
    width: img.width,
    height: img.height
  };
}

/**
 * Parser dedicado ao layout de tabela em PDF gerado pelo sistema DWV (rodapé
 * "Tecnologia e Design DWV"). Esse layout tem uma particularidade: para unidades
 * DISPONÍVEIS, o número da unidade e o status "Disponível" NÃO aparecem junto do
 * bloco de área/valor no texto extraído do PDF — eles aparecem só depois, em um
 * lote separado, na mesma ordem em que os blocos sem número apareceram. Ex.:
 *
 *   CASA - MAR
 *   UNIDADE	VALOR
 *   Área privativa 344.29m² Área total 402.02m²
 *   2 Vagas de garagem 4 Dormitórios sendo 4 Suítes
 *   R$ 11.650.000,00
 *   ...
 *   01          <- número da unidade "CASA - MAR", só aparece aqui
 *   Disponível
 *
 * Já unidades VENDIDAS/RESERVADAS aparecem inline, sem esse problema:
 *   CASA - AZUL
 *   UNIDADE	VALOR
 *   02	Vendido
 *
 * Esta função varre o texto inteiro (não só a linha logo após cada cabeçalho —
 * uma seção pode ter várias unidades, vendidas ou disponíveis) e reconstrói a
 * associação correta pareando, na ordem de aparição, os blocos de unidade
 * disponível (sem número) com os pares número+status encontrados depois no
 * texto. Duas variações do layout também são tratadas:
 *
 * 1. Tabelas com colunas extras de plano de pagamento
 *    ("UNIDADE ENTRADA PARCELAMENTO 60X REFORÇOS ANUAIS 5X VALOR" em vez do
 *    simples "UNIDADE VALOR") — o cabeçalho só serve para identificar o rótulo
 *    da seção atual (ex. "APARTAMENTO - TIPOS"), aplicado a toda unidade lida
 *    depois dele até o próximo cabeçalho.
 * 2. Unidades cujo "lote" final traz uma etiqueta de produto (ex. "Diferenciado",
 *    "Cobertura") em vez do status "Disponível/Reservado" — nesse caso a unidade
 *    é tratada como disponível (unidades vendidas já saem marcadas inline, nunca
 *    chegam a esse lote sem status) e a etiqueta é anexada à tipologia.
 */
export function parseUnidadesFromDwvTemplate(pdfText: string, empreendimentoName: string): UnidadeExtraida[] {
  const lines = pdfText.split('\n').map((l) => l.trim());
  const unidades: UnidadeExtraida[] = [];
  const pendingAvailable: Array<{
    tipologia: string;
    area_privativa: number;
    area_total: number;
    vagas?: number;
    dormitorios?: number;
    suites?: number;
    valor: number;
    pagamento?: CondicoesPagamento;
  }> = [];
  const availablePairs: Array<{ numero: string; status: 'disponivel' | 'reservada'; tag: string | null }> = [];

  // Rótulo da seção atual (ex. "APARTAMENTO - TIPOS", "SALA COMERCIAL - UNIDADE"),
  // atualizado sempre que um novo cabeçalho de tabela é encontrado — usado para
  // marcar a tipologia de toda unidade lida dentro dessa seção.
  let currentSectionLabel = 'Unidade';

  // Colunas de plano de pagamento (Entrada / Reforço / Parcelamento) da seção atual, na
  // ORDEM em que aparecem no cabeçalho — essa ordem varia entre seções do mesmo PDF (ex.:
  // "ENTRADA REFORÇO 5X PARCELAMENTO 60X" numa seção, "ENTRADA PARCELAMENTO 60X REFORÇO 5X"
  // noutra), por isso é lida de novo a cada cabeçalho em vez de assumida fixa. `vezes` guarda
  // o "NX" do próprio rótulo (ex. "REFORÇO 5X" -> 5), quando houver — usado para montar a
  // frase "5x R$ ..." sem inventar o número de parcelas/reforços. Fica vazia (sem colunas de
  // pagamento) para seções que só têm "UNIDADE VALOR".
  let currentPaymentColumns: Array<{ key: 'entrada' | 'reforco' | 'parcelamento'; vezes?: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Cabeçalho da tabela de unidades — aceita tanto o formato simples "UNIDADE VALOR"
    // quanto variações com colunas extras no meio (ex. plano de pagamento). As colunas
    // do meio (entre "UNIDADE" e "VALOR", separadas por tabulação no texto extraído do
    // PDF) dizem em que ordem ler os valores de Entrada/Reforço/Parcelamento logo abaixo.
    if (/^UNIDADE\b.*\bVALOR$/i.test(line)) {
      currentSectionLabel = (lines[i - 1] || '').trim() || currentSectionLabel;
      const headerColumns = line
        .split(/\t+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(1, -1) // remove "UNIDADE" (primeira) e "VALOR" (última)
        .map((tokenBruto) => {
          const key = normalizarColunaPagamento(tokenBruto);
          if (!key) return null;
          const vezesMatch = tokenBruto.match(/(\d+)\s*X\b/i);
          return { key, vezes: vezesMatch ? parseInt(vezesMatch[1], 10) : undefined };
        })
        .filter((c): c is { key: 'entrada' | 'reforco' | 'parcelamento'; vezes: number | undefined } => c !== null);
      currentPaymentColumns = headerColumns;
      continue;
    }

    // Unidade vendida/reservada inline: "numero  Vendido/Reservado" — pode aparecer em
    // qualquer linha da seção, não só logo após o cabeçalho (uma seção pode ter várias).
    const soldMatch = line.match(/^(\d{1,4}[A-Z]?)\s*(Vendid[oa]|Reservad[oa])$/i);
    if (soldMatch) {
      unidades.push({
        id: `${empreendimentoName}_${soldMatch[1]}`,
        numero_unidade: soldMatch[1],
        torre: 'Torre Única',
        tipologia: currentSectionLabel,
        area_privativa: 0,
        valor: 0,
        status: /vendid/i.test(soldMatch[2]) ? 'vendida' : 'reservada'
      });
      continue;
    }

    // Bloco de unidade disponível sem número (área + specs + valor) — também pode se
    // repetir várias vezes dentro da mesma seção, uma vez por unidade disponível.
    const areaMatch = line.match(/Área privativa\s*([\d.,]+)\s*m²\s*Área total\s*([\d.,]+)\s*m²/i);
    if (areaMatch) {
      const specsLine = lines[i + 1] || '';
      // Aceita duas variações de como a tabela descreve os quartos: "N Dormitórios sendo M
      // Suítes" (quando nem todo dormitório é suíte) OU só "N Suítes" (empreendimentos onde
      // TODOS os dormitórios são suíte — nesse caso não existe uma linha "Dormitórios"
      // separada, e a contagem de dormitórios é a própria contagem de suítes).
      const specsMatch = specsLine.match(
        /(\d+)\s*Vagas?\s*de\s*garagem\s*(?:(\d+)\s*Dormit[oó]rios(?:\s*sendo\s*(\d+)\s*Su[ií]tes)?|(\d+)\s*Su[ií]tes)/i
      );
      const vagasNum = specsMatch ? parseInt(specsMatch[1], 10) : undefined;
      // specsMatch[2] = "N Dormitórios" (quando presente); specsMatch[4] = "N Suítes" sem
      // "Dormitórios" (dormitórios = suítes, nesse caso); specsMatch[3] = "sendo M Suítes"
      // dentro do primeiro formato.
      const dormitoriosNum = specsMatch ? parseInt(specsMatch[2] ?? specsMatch[4], 10) : undefined;
      const suitesNum = specsMatch
        ? specsMatch[3]
          ? parseInt(specsMatch[3], 10)
          : specsMatch[4]
            ? parseInt(specsMatch[4], 10)
            : undefined
        : undefined;

      const valorLine = lines[i + 2] || '';
      const valorMatch = valorLine.match(/R\$\s*([\d.,]+)/);

      // Condições de pagamento (Entrada/Reforço/Parcelamento) da unidade: quando a seção
      // atual tem essas colunas (ver currentPaymentColumns), os valores aparecem na linha
      // IMEDIATAMENTE ANTES do bloco "Área privativa...", um valor "R$ ..." por coluna,
      // na mesma ordem lida do cabeçalho. Só aceita quando a quantidade de valores bate
      // exatamente com a quantidade de colunas esperada — caso contrário não inventa
      // (fica sem condições de pagamento para essa unidade).
      let pagamento: CondicoesPagamento | undefined;
      if (currentPaymentColumns.length > 0) {
        const paymentLine = lines[i - 1] || '';
        const amounts = paymentLine
          .split(/\t+/)
          .map((t) => t.trim())
          .filter(Boolean);
        if (amounts.length === currentPaymentColumns.length && amounts.every((a) => /^R\$\s*[\d.,]+$/.test(a))) {
          pagamento = {};
          currentPaymentColumns.forEach(({ key, vezes }, idx) => {
            const valorNum = parseFloat(amounts[idx].replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')) || 0;
            if (valorNum > 0) {
              pagamento![key] = valorNum;
              if (key === 'reforco' && vezes) pagamento!.reforcoVezes = vezes;
              if (key === 'parcelamento' && vezes) pagamento!.parcelamentoVezes = vezes;
            }
          });
          if (Object.keys(pagamento).length === 0) pagamento = undefined;
        }
      }

      if (valorMatch) {
        pendingAvailable.push({
          tipologia: currentSectionLabel,
          area_privativa: parseFloat(areaMatch[1]) || 0,
          area_total: parseFloat(areaMatch[2]) || 0,
          vagas: vagasNum,
          dormitorios: dormitoriosNum,
          suites: suitesNum,
          valor: parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) || 0,
          pagamento
        });
      }
      continue;
    }

    // Número solto isolado em linha própria — pertence ao "lote" final de unidades
    // disponíveis. Procura um status explícito (Disponível/Reservado) até achar o
    // próximo número solto (limite da unidade seguinte) ou 6 linhas à frente. Se não
    // achar status explícito, assume "disponível" — unidades vendidas já saem
    // marcadas inline acima, então um número que chega até aqui sem status nunca é
    // "vendida". A primeira linha curta encontrada nesse meio tempo (quando não é o
    // status) é guardada como etiqueta de produto (ex. "Diferenciado").
    if (/^\d{1,4}[A-Z]?$/.test(line)) {
      let status: 'disponivel' | 'reservada' | null = null;
      let tag: string | null = null;
      for (let k = i + 1; k < lines.length && k <= i + 6; k++) {
        const next = lines[k];
        if (/^\d{1,4}[A-Z]?$/.test(next)) break;
        if (/^Dispon[ií]vel$/i.test(next)) {
          status = 'disponivel';
          break;
        }
        if (/^Reservad[oa]$/i.test(next)) {
          status = 'reservada';
          break;
        }
        if (!tag && next && next.length <= 30 && /^[A-Za-zÀ-ÿ\s]+$/.test(next)) {
          tag = next;
        }
      }
      availablePairs.push({ numero: line, status: status || 'disponivel', tag: status ? null : tag });
    }
  }

  // Pareia na ordem de aparição — se as contagens não baterem, pareia só o que dá
  // pra parear com segurança e loga o resto como aviso (não inventa números).
  const pairCount = Math.min(pendingAvailable.length, availablePairs.length);
  if (pendingAvailable.length !== availablePairs.length) {
    console.warn(
      `[ImobiShare Exporter] ${empreendimentoName}: ${pendingAvailable.length} bloco(s) de unidade disponível sem número ` +
      `vs ${availablePairs.length} par(es) número/status encontrados no PDF — parseando só os ${pairCount} que batem.`
    );
  }
  for (let i = 0; i < pairCount; i++) {
    const block = pendingAvailable[i];
    const pair = availablePairs[i];
    unidades.push({
      id: `${empreendimentoName}_${pair.numero}`,
      numero_unidade: pair.numero,
      torre: 'Torre Única',
      tipologia: pair.tag ? `${block.tipologia} (${pair.tag})` : block.tipologia,
      area_privativa: block.area_privativa,
      area_total: block.area_total,
      vagas: block.vagas,
      dormitorios: block.dormitorios,
      suites: block.suites,
      valor: block.valor,
      pagamento: block.pagamento,
      status: pair.status
    });
  }

  return unidades;
}

/** Remove acentos e baixa a caixa — usado para comparar texto de forma tolerante a acentuação/maiúsculas. */
function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Insere espaço em nome de empreendimento colado sem espaçamento — comum quando o nome foi
 * capturado colado a outra palavra no site de origem (ex.: "EssenzaResidence" -> "Essenza
 * Residence", "San PaoloResidenziale" -> "San Paolo Residenziale", "Le MajesticPronto para
 * morar" -> "Le Majestic Pronto para morar"). Duas regras, aplicadas em sequência:
 * 1. Fronteira minúscula/dígito -> maiúscula (o caso geral de duas palavras coladas).
 * 2. Reforço específico para "Residence"/"Residencial"/"Residenziale" coladas à palavra
 *    anterior, cobrindo o caso em que a palavra anterior também está toda em maiúsculas (sem
 *    fronteira de caixa detectável pela regra 1).
 * Roda ANTES de `removerStatusColado` e `removerNomeDuplicado`, pra que essas duas funções
 * consigam reconhecer corretamente as palavras já separadas. Nunca mexe em nomes que já têm
 * espaço no lugar certo.
 */
function adicionarEspacamentoNome(nome: string): string {
  const espacado = nome
    .replace(/([a-zà-öø-ÿ0-9])([A-ZÀ-ÖØ-Þ])/g, '$1 $2')
    .replace(/([a-zà-öø-ÿ0-9A-ZÀ-ÖØ-Þ])(Residence|Residencial|Residenziale)\b/gi, '$1 $2');
  return espacado.replace(/\s+/g, ' ').trim();
}

/**
 * Corrige nome de pasta colado em duplicidade (ex.: "San Paolo ResidenzialeSan Paolo Residenziale"
 * ou "San Paolo Residenziale San Paolo Residenziale"), problema comum quando a pasta do
 * empreendimento foi copiada/renomeada errado no disco. Detecta o texto repetido duas vezes
 * seguidas (com ou sem espaço/traço/underline entre as cópias) e mantém só a primeira ocorrência.
 * Não mexe no `folderPath` real (o caminho no disco continua correto) — só limpa o nome exibido
 * (título, descrição, campo `nomeEdificio` gravado no banco).
 */
function removerNomeDuplicado(nome: string): string {
  const trimmed = nome.trim();
  // "TextoTexto" — duas cópias coladas, sem separador nenhum.
  const semSeparador = trimmed.match(/^(.+)\1$/);
  if (semSeparador && semSeparador[1].trim().length >= 3) {
    return semSeparador[1].trim();
  }
  // "Texto Texto" / "Texto_Texto" / "Texto-Texto" — duas cópias com um separador entre elas.
  const comSeparador = trimmed.match(/^(.+?)[\s_-]\1$/);
  if (comSeparador && comSeparador[1].trim().length >= 3) {
    return comSeparador[1].trim();
  }
  return trimmed;
}

/**
 * Remove, de qualquer ponto do nome do empreendimento (não só do final), um status de
 * origem que veio colado sem espaço (ou com espaço) por causa de como o nome foi capturado
 * no site da DWV: o card mostra o nome do empreendimento e, ao lado/dentro do mesmo
 * elemento, um selo de status ("Pronto para morar", "Terceiros Exclusivos", "Lançamento",
 * "Pré-Lançamento") — sem espaço nenhum entre os dois no HTML de origem, capturar o texto
 * do elemento gruda os dois em uma string só (ex.: "Le MajesticPronto para morar"). Esse
 * status não faz parte do nome do empreendimento e não deve aparecer nele em nenhuma
 * posição (início, meio ou fim). Como esses status já são detectados separadamente por
 * `detectarStatusOrigem`, aqui só interessa limpar o nome exibido (título, descrição, campo
 * `nomeEdificio` gravado no banco) — não mexe no `folderPath` real, mesma lógica de
 * `removerNomeDuplicado`. Espera rodar DEPOIS de `adicionarEspacamentoNome`, pra que o
 * status já esteja separado do resto do nome por espaços de verdade.
 */
function removerStatusColado(nome: string): string {
  const SUFIXOS_DE_STATUS = [
    /\bpronto\s*para\s*morar\b/gi,
    /\bterceiros\s*exclusivos\b/gi,
    /\bpr[ée]\s*-?\s*lan[çc]amento\b/gi,
    /\blan[çc]amento\b/gi,
  ];
  let limpo = nome.trim();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const regex of SUFIXOS_DE_STATUS) {
      const semStatus = limpo.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      if (semStatus !== limpo && semStatus.length >= 3) {
        limpo = semStatus;
        mudou = true;
      }
    }
  }
  return limpo;
}

/** Pausa por N milissegundos (usado entre tentativas de regravar no banco apos uma falha de conexao). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Formata um valor numerico como moeda brasileira (ex.: 3300000 -> "R$ 3.300.000,00"). */
function formatarValorBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/** Reconhece o rótulo de uma coluna de plano de pagamento da tabela DWV (ex.: "ENTRADA",
 * "REFORÇO 5X", "PARCELAMENTO 60X") e devolve a chave normalizada correspondente, ou null
 * se o rótulo não for uma dessas três colunas conhecidas (ex.: "UNIDADE", "VALOR"). Usado
 * para descobrir, a partir do próprio cabeçalho de cada seção da tabela, em que ordem os
 * valores de pagamento aparecem — a ordem varia entre seções do mesmo PDF (ver
 * `parseUnidadesFromDwvTemplate`). */
function normalizarColunaPagamento(label: string): 'entrada' | 'reforco' | 'parcelamento' | null {
  const n = normalizarTexto(label);
  if (n.includes('entrada')) return 'entrada';
  if (n.includes('reforc')) return 'reforco';
  if (n.includes('parcelamento')) return 'parcelamento';
  return null;
}

/** Formata um valor numerico como moeda brasileira SEM os centavos (ex.: 2300000 -> "2.300.000")
 * e sem o prefixo "R$" — cada lugar que usa isso decide se/como prefixar (ver o bloco "💰
 * Valores..." e a linha de condições de pagamento em `montarBlocoValoresEPagamento`, que usam
 * espaçamento levemente diferente entre si). */
function formatarValorBRLInteiro(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(valor));
}

/** Reformata "mês ano" (ex.: "junho 2028", como normalmente vem do PDF/JSON) para "mês/ano"
 * (ex.: "junho/2028"), no padrão pedido para o bloco "💰 Valores...". Quando o texto não bate
 * nesse formato (ex.: "A definir", "2º trimestre de 2027"), devolve o texto original sem
 * mexer — nunca inventa uma data que não está no formato esperado. */
function formatarEntregaCurta(dtEntrega: string): string {
  const m = dtEntrega.trim().match(/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/);
  return m ? `${m[1]}/${m[2]}` : dtEntrega;
}

/** Monta a linha "Entrada R$460.000 + 5x R$232.800 + 60x R$10.200" com as condições de
 * pagamento da unidade de referência, na ORDEM Entrada/Reforço/Parcelamento, usando a
 * quantidade de parcelas/reforços lida do próprio cabeçalho da tabela (`reforcoVezes`/
 * `parcelamentoVezes` — ver `CondicoesPagamento`). Cada parte só aparece se o dado
 * correspondente foi realmente lido; retorna '' quando não há nenhuma condição de pagamento
 * disponível (a seção da tabela não tinha essas colunas, ou os valores não vieram) — nesse
 * caso o chamador simplesmente omite a linha (nunca inventa). */
function formatarLinhaPagamento(pagamento?: CondicoesPagamento): string {
  if (!pagamento) return '';
  const partes: string[] = [];
  if (pagamento.entrada) partes.push(`Entrada R$${formatarValorBRLInteiro(pagamento.entrada)}`);
  if (pagamento.reforco) {
    const vezes = pagamento.reforcoVezes ? `${pagamento.reforcoVezes}x ` : '';
    partes.push(`${vezes}R$${formatarValorBRLInteiro(pagamento.reforco)}`);
  }
  if (pagamento.parcelamento) {
    const vezes = pagamento.parcelamentoVezes ? `${pagamento.parcelamentoVezes}x ` : '';
    partes.push(`${vezes}R$${formatarValorBRLInteiro(pagamento.parcelamento)}`);
  }
  return partes.join(' + ');
}

/** Monta o bloco final e fixo da descrição — "💰 Valores a partir de R$ ..." + a linha de
 * condições de pagamento (quando houver) — sempre gerado pelo código (nunca pela IA), pra
 * garantir formatação e valores numéricos idênticos e corretos em todos os empreendimentos
 * (ver `generateAiEnhancedDescription`, onde só o texto de cima do bloco vem da IA). O número
 * de incorporação é público (vai nessa mesma frase, junto da entrega) — só fica de fora
 * quando não foi lido de nenhuma fonte (não inventa). */
function montarBlocoValoresEPagamento(menorValor: number, dtEntrega: string, incorporacao: string, pagamento?: CondicoesPagamento): string {
  const entregaText = dtEntrega && dtEntrega !== 'A definir' ? ` — entrega prevista para ${formatarEntregaCurta(dtEntrega)}` : '';
  const incorporacaoText = incorporacao ? ` (Incorporação ${incorporacao})` : '';
  const linhaPagamento = formatarLinhaPagamento(pagamento);
  return `💰 Valores a partir de R$ ${formatarValorBRLInteiro(menorValor)}${entregaText}${incorporacaoText}.${linhaPagamento ? `\n${linhaPagamento}` : ''}`;
}

/**
 * Chama uma funcao que faz uma requisicao ao Gemini, tentando de novo com espera quando o
 * erro for de limite de uso (HTTP 429 / RESOURCE_EXHAUSTED) -- comum em chaves do nivel
 * gratuito ao processar varios empreendimentos em sequencia (cada um faz duas chamadas: a
 * pesquisa online e a geracao do texto). Quando a resposta de erro do Gemini traz um
 * "retryDelay" sugerido (ex.: RetryInfo com "21s"), usa esse valor; senao usa um backoff
 * padrao crescente (20s, 40s, 60s). Erros que NAO sao de limite de uso (chave invalida,
 * rede fora, etc.) nao sao re-tentados -- propagam na hora pro chamador tratar (que ja tem
 * fallback sem IA pronto pra esses casos).
 */
async function chamarGeminiComRetry<T>(fn: () => Promise<T>, maxTentativas: number = 3): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await fn();
    } catch (err) {
      ultimoErro = err;
      const msg = typeof (err as any)?.message === 'string' ? (err as any).message : JSON.stringify(err || '');
      const isRateLimit = /429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
      if (!isRateLimit || tentativa === maxTentativas) throw err;

      let delayMs = 20000 * tentativa; // 20s, 40s, ... enquanto nao ha um valor sugerido
      const retryMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
      if (retryMatch) delayMs = parseInt(retryMatch[1], 10) * 1000 + 2000; // +2s de folga

      console.warn(
        `[ImobiShare Exporter] Limite de uso do Gemini atingido (tentativa ${tentativa}/${maxTentativas}) — ` +
        `aguardando ${Math.round(delayMs / 1000)}s antes de tentar de novo.`
      );
      await sleep(delayMs);
    }
  }
  throw ultimoErro;
}

/**
 * Detecta o "status de origem" do empreendimento — Lançamento, Pré-Lançamento, Pronto
 * para morar ou Terceiros exclusivos — a partir das fontes disponíveis, em ordem de
 * prioridade: (1) campo "status" ou "situacao" no empreendimento.json, a fonte mais
 * confiável quando presente; (2) texto extraído do PDF da tabela; (3) nome/caminho da
 * pasta do empreendimento. Retorna '' se nada for reconhecido — nesse caso o chamador
 * usa o status padrão "Na planta" (mesmo comportamento fixo de antes deste mapeamento
 * existir).
 *
 * OBS: o nome exato do campo no JSON ("status"/"situacao") é uma suposição, já que não
 * há uma fonte confirmada para esse dado — se o seu empreendimento.json usar outro nome
 * de campo (ou esse status vier de outro lugar), é só avisar que ajusto o parser aqui.
 */
function detectarStatusOrigem(jsonData: any, pdfRawText: string, folderHint: string): string {
  const camposJson = [jsonData?.status, jsonData?.situacao].find((v) => typeof v === 'string' && v.trim());
  if (camposJson) return camposJson.trim();

  const haystack = `${folderHint}\n${pdfRawText}`;
  if (/terceiros\s+exclusivos/i.test(haystack)) return 'Terceiros exclusivos';
  if (/pronto\s+para\s+morar/i.test(haystack)) return 'Pronto para morar';
  if (/pr[ée]\s*-?\s*lan[çc]amento/i.test(haystack)) return 'Pré-Lançamento';
  if (/lan[çc]amento/i.test(haystack)) return 'Lançamento';
  return '';
}

/**
 * Mapeia o status de origem (lido de empreendimento.json, PDF ou nome da pasta, via
 * `detectarStatusOrigem`) para o valor gravado no campo `statusImovel` do ImobiShare:
 *   Lançamento           -> "Na planta"
 *   Pré-Lançamento        -> "Na planta"
 *   Pronto para morar     -> "Sem mobília"
 *   Terceiros exclusivos  -> "Mobiliado"
 * Qualquer outro valor (ou string vazia, quando nada foi detectado) cai no padrão
 * "Na planta" — o mesmo valor fixo que esta função sempre usou antes deste mapeamento.
 */
function mapStatusOrigemParaStatusImovel(statusOrigem: string): Imovel['statusImovel'] {
  const norm = normalizarTexto(statusOrigem);
  if (norm.includes('terceiros exclusivos')) return 'Mobiliado' as Imovel['statusImovel'];
  if (norm.includes('pronto para morar')) return 'Sem mobília' as Imovel['statusImovel'];
  // Cobre tanto "Lançamento" quanto "Pré-Lançamento" — ambos mapeiam pro mesmo valor.
  return 'Na planta' as Imovel['statusImovel'];
}

/**
 * 4. Le arquivo PDF/JSON/CSV e extrai unidades disponiveis, menor valor e metadados.
 * Retorna unidadesEncontradas=false quando NENHUM dado real de unidade pôde ser lido —
 * nesse caso o chamador deve pular o empreendimento em vez de gravar valores fictícios.
 */
export async function extractPdfData(
  pdfPaths: string[],
  jsonPath?: string,
  csvPath?: string,
  empreendimentoName: string = '',
  folderPath: string = ''
): Promise<{
  unidades: UnidadeExtraida[];
  unidadesEncontradas: boolean;
  menorValorDisponivel: number;
  menorUnidadeDisponivel: UnidadeExtraida | null;
  areaPrivativaMenor: number;
  dtEntrega: string;
  incorporacao: string;
  bairro: string;
  endereco: string;
  temCobertura: boolean;
  temDiferenciado: boolean;
  pdfRawText: string;
  statusOrigem: string;
}> {
  let pdfRawText = '';
  let unidades: UnidadeExtraida[] = [];

  // Tentar ler arquivo PDF se disponivel
  if (pdfPaths.length > 0) {
    for (const p of pdfPaths) {
      try {
        if (fs.existsSync(p)) {
          const dataBuffer = fs.readFileSync(p);
          const text = await extractTextFromPdf(dataBuffer);
          pdfRawText += `\n--- PDF ${path.basename(p)} ---\n` + text;
        }
      } catch (err) {
        console.warn(`[ImobiShare Exporter] Aviso ao ler PDF ${p}:`, err);
      }
    }
  }

  // Tentar ler JSON de metadados se existir
  let jsonData: any = null;
  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      if (jsonData.unidades && Array.isArray(jsonData.unidades)) {
        unidades = jsonData.unidades;
      }
    } catch {
      // ignore
    }
  }

  // Tentar ler CSV se existir e unidades estiver vazio
  if (unidades.length === 0 && csvPath && fs.existsSync(csvPath)) {
    try {
      const csvLines = fs.readFileSync(csvPath, 'utf-8').split('\n');
      for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;
        const cols = line.split(';').map((c) => c.replace(/^"|"$/g, ''));
        if (cols.length >= 10) {
          const valorNum = parseFloat(cols[9].replace(/\./g, '').replace(',', '.')) || 0;
          const areaNum = parseFloat(cols[8].replace(/\./g, '').replace(',', '.')) || 0;
          const rawStatus = (cols[10] || 'disponivel').toLowerCase();
          const safeStatus: 'disponivel' | 'indisponivel' | 'reservada' | 'vendida' =
            rawStatus === 'vendida' ? 'vendida' : rawStatus === 'reservada' ? 'reservada' : rawStatus === 'indisponivel' ? 'indisponivel' : 'disponivel';

          unidades.push({
            id: `${empreendimentoName}_${cols[0]}`,
            numero_unidade: cols[0],
            torre: cols[1] || 'Torre Única',
            andar: cols[2] ? parseInt(cols[2]) : undefined,
            tipologia: cols[3] || 'Apartamento Tipo',
            dormitorios: cols[4] ? parseInt(cols[4]) : undefined,
            suites: cols[5] ? parseInt(cols[5]) : undefined,
            banheiros: cols[6] ? parseInt(cols[6]) : undefined,
            vagas: cols[7] ? parseInt(cols[7]) : undefined,
            area_privativa: areaNum,
            area_total: areaNum * 1.4,
            valor: valorNum,
            status: safeStatus
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // Se nao encontrou unidades no JSON/CSV, tenta o parser específico do template
  // de tabela em PDF usado pelo DWV (ver parseUnidadesFromDwvTemplate) e, se ainda
  // assim nada for encontrado, cai para uma regex genérica como último recurso.
  if (unidades.length === 0 && pdfRawText) {
    unidades = parseUnidadesFromDwvTemplate(pdfRawText, empreendimentoName);
  }

  if (unidades.length === 0 && pdfRawText) {
    const unitMatches = pdfRawText.matchAll(/(?:Apto|Apartamento|Unidade|Cob|Cobertura)\s*(\d{2,4}[A-Z]?)[^\n\r]*?R\$\s*([\d.,]+)/gi);
    for (const match of unitMatches) {
      const uNum = match[1];
      const valStr = match[2];
      const valNum = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;
      if (valNum > 500000) {
        unidades.push({
          id: `${empreendimentoName}_${uNum}`,
          numero_unidade: uNum,
          torre: 'Torre Única',
          tipologia: uNum.toLowerCase().includes('cob') ? 'Cobertura Duplex' : 'Apartamento Tipo',
          area_privativa: 0,
          valor: valNum,
          status: 'disponivel'
        });
      }
    }
  }

  // Regra de negócio: quando a tabela fala em suítes, a quantidade de suítes
  // É a quantidade de banheiros da unidade (não soma nada além disso). Aplica
  // em TODAS as unidades, não importa de qual fonte (JSON, CSV, PDF) elas vieram.
  for (const u of unidades) {
    if (typeof u.suites === 'number' && u.suites > 0) {
      u.banheiros = u.suites;
    }
  }

  // IMPORTANTE: ao contrário da versão anterior, NÃO há mais fallback com
  // unidades/preços inventados (ex: "401" a R$2.450.000). Se nada de real foi
  // extraído, unidadesEncontradas fica false e o chamador deve pular este
  // empreendimento — gravar um preço fictício num anúncio real seria
  // apresentar um dado fabricado como se fosse verdadeiro.
  const unidadesEncontradas = unidades.length > 0;

  // Filtrar unidades disponiveis com valor válido. Unidades do tipo "Comercial" (salas
  // comerciais etc. — identificadas pela tipologia/seção da tabela, ex. "SALA COMERCIAL -
  // UNIDADE") ficam de fora da escolha do "menor valor disponível": o imóvel exportado
  // para o ImobiShare é sempre residencial (apartamento/cobertura), nunca uma sala
  // comercial, mesmo que ela seja a unidade mais barata da tabela.
  const disponiveis = unidades.filter(
    (u) =>
      (u.status || 'disponivel').toLowerCase() === 'disponivel' &&
      (u.valor || 0) > 0 &&
      !normalizarTexto(u.tipologia || '').includes('comercial')
  );

  // Ordenar pelo menor valor
  disponiveis.sort((a, b) => (a.valor || 0) - (b.valor || 0));

  const menorUnidadeDisponivel = disponiveis.length > 0 ? disponiveis[0] : null;
  const menorValorDisponivel = menorUnidadeDisponivel?.valor || jsonData?.valor_venda || 0;
  const areaPrivativaMenor = menorUnidadeDisponivel?.area_privativa || jsonData?.area_privativa || 0;

  const temCobertura = unidades.some((u) => (u.tipologia || '').toLowerCase().includes('cobertura')) || Boolean(jsonData?.tem_cobertura);
  const temDiferenciado = unidades.some((u) => (u.tipologia || '').toLowerCase().includes('diferenciado')) || Boolean(jsonData?.tem_diferenciado);

  // Número de incorporação (ex: "INCORPORAÇÃO 7-27.147"), lido do PDF quando não vem no JSON.
  const incorporacaoMatch = pdfRawText.match(/INCORPORA[ÇC][ÃA]O\s*([\w./-]+)/i);
  const incorporacao = jsonData?.incorporacao || incorporacaoMatch?.[1]?.trim() || '';

  // Previsão de entrega: prioriza o JSON, mas tenta ler do PDF quando ausente
  // (ex: "Previsão de entrega: maio 2025").
  const dtEntregaMatch = pdfRawText.match(/Previs[ãa]o de entrega:?\s*([^\n]+)/i);
  const dtEntrega = jsonData?.dt_entrega || dtEntregaMatch?.[1]?.trim() || 'A definir';

  // Status de origem (Lançamento / Pré-Lançamento / Pronto para morar / Terceiros
  // exclusivos) — ver detectarStatusOrigem para a ordem de prioridade das fontes.
  const statusOrigem = detectarStatusOrigem(jsonData, pdfRawText, `${empreendimentoName} ${folderPath}`);

  return {
    unidades,
    unidadesEncontradas,
    menorValorDisponivel,
    menorUnidadeDisponivel,
    areaPrivativaMenor,
    dtEntrega,
    incorporacao,
    bairro: jsonData?.bairro || 'A definir',
    endereco: jsonData?.endereco || '',
    temCobertura,
    temDiferenciado,
    pdfRawText,
    statusOrigem
  };
}

/**
 * Pesquisa na internet (Gemini com Google Search grounding) informações públicas
 * e verificáveis sobre o empreendimento — usado para enriquecer a descrição com
 * fatos reais, para descobrir o CEP do endereço e, quando o endereço não veio da
 * tabela/PDF nem do arquivo endereco_descricao, tentar descobri-lo também.
 * Retorna null se não houver GEMINI_API_KEY ou se a pesquisa falhar — nesse caso
 * o chamador segue só com os dados já extraídos, sem pesquisa.
 */
async function pesquisarEmpreendimentoOnline(
  nomeEdificio: string,
  construtora: string,
  incorporacao: string,
  enderecoAtual: string
): Promise<{ endereco: string; cep: string; fatos: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Pesquise na internet informações públicas e verificáveis sobre o empreendimento imobiliário "${nomeEdificio}", da construtora "${construtora}", em Balneário Camboriú - SC${incorporacao ? ` (registro de incorporação ${incorporacao})` : ''}.

${enderecoAtual ? `O endereço já conhecido é: "${enderecoAtual}".` : 'O endereço deste empreendimento ainda não é conhecido — tente encontrá-lo.'}

Responda SOMENTE neste formato, sem markdown e sem texto extra:
ENDERECO: <endereço completo encontrado, ou "NAO ENCONTRADO" se não achar algo confiável>
CEP: <CEP do endereço acima, no formato 00000-000, ou "NAO ENCONTRADO" se não achar com confiança>
FATOS: <até 3 fatos públicos e verificáveis sobre o empreendimento ou sua região, separados por ponto e vírgula; escreva "NENHUM" se não encontrar nada relevante>

Não invente nada. Se não tiver certeza de uma informação, responda "NAO ENCONTRADO" ou "NENHUM".`;

    const response = await chamarGeminiComRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      })
    );

    const text = response.text?.trim() || '';
    const enderecoMatch = text.match(/ENDERECO:\s*(.+)/i);
    const cepMatch = text.match(/CEP:\s*(.+)/i);
    const fatosMatch = text.match(/FATOS:\s*(.+)/i);
    const enderecoEncontrado = enderecoMatch?.[1]?.trim() || '';
    const cepEncontrado = cepMatch?.[1]?.trim() || '';
    const fatosEncontrados = fatosMatch?.[1]?.trim() || '';

    return {
      endereco: enderecoEncontrado && !/NAO ENCONTRADO|N[ÃA]O ENCONTRADO/i.test(enderecoEncontrado) ? enderecoEncontrado : '',
      // Só aceita o CEP se vier no formato esperado (00000-000 ou 00000000) — qualquer
      // outra coisa (incluindo "NAO ENCONTRADO") é tratada como "não achou", sem inventar.
      cep: /^\d{5}-?\d{3}$/.test(cepEncontrado) ? cepEncontrado : '',
      fatos: fatosEncontrados && !/^NENHUM/i.test(fatosEncontrados) ? fatosEncontrados : ''
    };
  } catch (err) {
    console.warn('[ImobiShare Exporter] Erro ao pesquisar informações online:', err);
    return null;
  }
}

/**
 * Extrai o bairro a partir do texto de um endereço no formato
 * "Rua/Av., número, Bairro, Cidade - UF" — o bairro é sempre o penúltimo pedaço
 * entre vírgulas (o que vem logo antes de "Cidade - UF"), independente de quantos
 * pedaços vierem antes dele (nome de rua com esquina, complemento, etc.). Ex.:
 *   "R. Figueira, esq. R. Mapa, 622, Tabuleiro, Camboriú - SC"      -> "Tabuleiro"
 *   "Rua Uganda, 601, Nações, Bal. Camboriú - SC"                   -> "Nações"
 * Retorna '' se o endereço não tiver pelo menos 2 pedaços separados por vírgula
 * (não dá pra identificar o bairro com segurança) — nesse caso o chamador não
 * sobrescreve o bairro já conhecido, para não gravar algo errado.
 */
function extrairBairroDoEndereco(endereco: string): string {
  const partes = (endereco || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length < 2) return '';
  return partes[partes.length - 2];
}

/**
 * 5. Inteligencia Artificial (Gemini) melhora a descricao com base nas informacoes do PDF,
 * no arquivo manual "endereco_descricao" (Descrição das unidades / Características do
 * empreendimento) e em pesquisa na internet. NUNCA menciona o nome da construtora nem o
 * número/código da unidade específica usada como referência de preço em nenhum lugar do
 * texto público (esse fica só no campo interno `informacoes` — ver o loop principal em
 * `executeExportToImobiShare`). O número de incorporação É público — mas sempre citado pelo
 * código no bloco fixo de valores (ver abaixo), nunca pela IA, pra não sair duplicado.
 *
 * PADRONIZAÇÃO: a abertura ("🏡 {empreendimento} — {bairro}, Balneário Camboriú" + frase-
 * resumo com área/tipologia/vagas) e o bloco final ("💰 Valores... (Incorporação ...)") são
 * SEMPRE montados pelo código (`montarBlocoAberturaEResumo` / `montarBlocoValoresEPagamento`),
 * nunca pela IA — isso garante que esses dois blocos saem idênticos em formatação e número-a-
 * número corretos em TODOS os empreendimentos do catálogo, com ou sem IA disponível (ver
 * `montarDescricaoFallback`, o caminho sem IA, que usa exatamente os mesmos dois helpers).
 * A IA entra só no meio: uma lista curada de diferenciais (bullets), a única parte que
 * exige julgamento editorial (o que destacar, como agrupar/frasear).
 */
export async function generateAiEnhancedDescription(
  nomeEdificio: string,
  construtora: string,
  bairro: string,
  enderecoAtual: string,
  menorValor: number,
  areaPrivativa: number,
  dormitorios: number,
  suites: number | undefined,
  vagas: number,
  dtEntrega: string,
  incorporacao: string,
  temCobertura: boolean,
  temDiferenciado: boolean,
  pdfSnippet: string,
  descricaoUnidadesTexto: string = '',
  caracteristicasTexto: string = '',
  tipoImovel: Imovel['tipoImovel'] = 'Apartamento' as Imovel['tipoImovel'],
  condicoesPagamento?: CondicoesPagamento
): Promise<{ titulo: string; descricao: string; endereco: string; cep: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const itemPorAndar = extrairItemPorAndar(extrairItensLista(descricaoUnidadesTexto));
  const blocoAbertura = montarBlocoAberturaEResumo(nomeEdificio, bairro, areaPrivativa, dormitorios, suites, vagas, itemPorAndar);
  const blocoValores = montarBlocoValoresEPagamento(menorValor, dtEntrega, incorporacao, condicoesPagamento);

  if (apiKey) {
    const pesquisa = await pesquisarEmpreendimentoOnline(nomeEdificio, construtora, incorporacao, enderecoAtual);
    const enderecoFinal = enderecoAtual || pesquisa?.endereco || '';
    // O CEP só vem da pesquisa online (não há como ler CEP do PDF/JSON/CSV nem do arquivo
    // endereco_descricao) — fica em branco se a pesquisa não achar um CEP confiável.
    const cepFinal = pesquisa?.cep || '';

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Você é um especialista em copywriting imobiliário de altíssimo padrão em Balneário Camboriú - SC.
Com base nas informações captadas da tabela/PDF do empreendimento "${nomeEdificio}":

- Empreendimento: ${nomeEdificio}
- Tipo de imóvel: ${tipoImovel}
- Bairro: ${bairro}
- Possui Cobertura: ${temCobertura ? 'SIM' : 'NÃO'}
- Possui Apartamento Diferenciado: ${temDiferenciado ? 'SIM' : 'NÃO'}
- Detalhes adicionais da tabela: ${pdfSnippet.substring(0, 500)}
- Descrição das unidades (fonte: arquivo do empreendimento, itens reais de acabamento): ${descricaoUnidadesTexto || 'não informado'}
- Características do empreendimento (fonte: arquivo do empreendimento, itens reais de lazer/infra): ${caracteristicasTexto || 'não informado'}
- Fatos adicionais pesquisados na internet (podem estar vazios): ${pesquisa?.fatos || 'nenhum'}

O título e a abertura da descrição (área, tipologia, vagas, valor, entrega, condições de
pagamento) já estão prontos e NÃO fazem parte do que você vai gerar — sua única tarefa é a
lista de "diferenciais".

INSTRUÇÕES (siga rigorosamente):
1. Monte um Título Comercial curto para o catálogo ImobiShare, otimizado para SEO: comece com "${tipoImovel} à venda" seguido do bairro e "Balneário Camboriú" (ex.: "${tipoImovel} à venda no ${bairro}, Balneário Camboriú"), e só depois inclua o nome do empreendimento, de forma natural e comercial. Procure manter entre 50 e 65 caracteres quando possível, sem forçar se isso cortar informação relevante.
2. Monte uma lista de 5 a 10 "diferenciais" (bullets curtos, cada um uma string separada no array — sem marcador "•", o código adiciona isso depois) a partir da "Descrição das unidades" e das "Características do empreendimento" acima. NÃO repita área privativa, quantidade de suítes/dormitórios, vagas de garagem ou "apartamento(s) por andar" — isso já aparece na abertura da descrição.
3. NUNCA mencione o nome da construtora, o número de incorporação, nem o número/código de uma unidade específica (ex.: "unidade 900") em nenhum diferencial nem no título.
4. NÃO invente nenhum diferencial que não esteja nos itens reais listados acima — cite os itens mais relevantes, pode agrupar itens próximos num único bullet mais natural (ex.: juntar "Academia", "Espaço Grill" e "Espaço Happy Hour" num só bullet, se fizer sentido), mas sem adicionar fatos que não estão nas listas.
5. Se "Possui Cobertura" for SIM e a "Descrição das unidades" já tiver um item real sobre cobertura (área, número de suítes etc.), use esse item real; só escreva um bullet genérico de cobertura se não houver esse detalhe real disponível. O mesmo vale para "Possui Apartamento Diferenciado".
6. Retorne em formato JSON estruturado com os campos "titulo" (string) e "diferenciais" (array de strings).
`;

      const response = await chamarGeminiComRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                titulo: { type: Type.STRING },
                diferenciais: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['titulo', 'diferenciais']
            }
          }
        })
      );

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.titulo && Array.isArray(parsed.diferenciais)) {
          const diferenciais: string[] = parsed.diferenciais.filter((d: unknown) => typeof d === 'string' && d.trim());
          const blocoDiferenciais = diferenciais.length > 0 ? `✨ Diferenciais:\n${diferenciais.map((d) => `• ${d.trim()}`).join('\n')}` : '';
          return {
            titulo: parsed.titulo,
            descricao: [blocoAbertura, blocoDiferenciais, blocoValores].filter(Boolean).join('\n\n'),
            endereco: enderecoFinal,
            cep: cepFinal
          };
        }
      }
    } catch (err) {
      console.warn('[ImobiShare Exporter] Erro ao chamar Gemini AI, usando modelo estruturado:', err);
    }

    // Se chegou aqui, a chamada de geração falhou mas a pesquisa de endereço/CEP pode
    // ter funcionado — usa o fallback abaixo, mas já com o que a pesquisa encontrou.
    return {
      ...montarDescricaoFallback(
        nomeEdificio,
        bairro,
        areaPrivativa,
        menorValor,
        dormitorios,
        suites,
        vagas,
        dtEntrega,
        incorporacao,
        temCobertura,
        temDiferenciado,
        descricaoUnidadesTexto,
        caracteristicasTexto,
        tipoImovel,
        condicoesPagamento
      ),
      endereco: enderecoFinal,
      cep: cepFinal
    };
  }

  // Sem GEMINI_API_KEY: fallback direto, sem pesquisa online (não é possível sem chave) —
  // sem pesquisa também não há como descobrir o CEP, então fica em branco.
  return {
    ...montarDescricaoFallback(
      nomeEdificio,
      bairro,
      areaPrivativa,
      menorValor,
      dormitorios,
      suites,
      vagas,
      dtEntrega,
      incorporacao,
      temCobertura,
      temDiferenciado,
      descricaoUnidadesTexto,
      caracteristicasTexto,
      tipoImovel,
      condicoesPagamento
    ),
    endereco: enderecoAtual,
    cep: ''
  };
}

/** Separa o texto em bruto do arquivo endereco_descricao (uma lista com "•"/"-", uma por linha)
 * em itens individuais, limpos (sem marcador, sem espaço sobrando, sem linhas vazias). */
function extrairItensLista(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean)
    // Descarta itens que são só um número (ex.: "222" digitado por engano na lista de
    // features, ou o próprio número da unidade colado ali por engano) — a descrição
    // NUNCA menciona o número da unidade (ver montarDescricaoFallback), então um item
    // assim não pode ser tratado como se fosse uma característica do imóvel.
    .filter((item) => !/^\d+$/.test(item));
}

/** Junta uma lista de itens em uma frase corrida e natural em portugues ("X, Y e Z"), limitando
 * a no maximo `max` itens para nao virar uma enumeracao gigante e ilegivel -- quando ha mais
 * itens do que o limite, fecha com "entre outros" em vez de listar tudo cruamente. Usado no
 * fallback sem IA (a IA, quando disponivel, ja recebe instrucao pra fazer essa selecao sozinha). */
function formatarListaNatural(itens: string[], max: number = 6): string {
  if (itens.length === 0) return '';
  const selecionados = itens.slice(0, max);
  const restantes = itens.length - selecionados.length;
  const texto =
    selecionados.length === 1
      ? selecionados[0]
      : `${selecionados.slice(0, -1).join(', ')} e ${selecionados[selecionados.length - 1]}`;
  return restantes > 0 ? `${texto}, entre outros` : texto;
}

/** Procura, na lista de itens da "Descrição das unidades" do arquivo manual, o item que fala
 * de quantos apartamentos há por andar (ex.: "01 apartamento por andar") — usado na frase-
 * resumo do padrão de descrição (ver `montarBlocoAberturaEResumo`) quando presente, e por
 * isso excluído da lista de diferenciais (`montarListaDiferenciais`) pra não repetir a mesma
 * informação duas vezes. Retorna undefined quando a lista não tem um item assim (não inventa). */
function extrairItemPorAndar(itens: string[]): string | undefined {
  return itens.find((item) => /apartamento.*andar|andar.*apartamento/i.test(item));
}

/** Monta as duas primeiras linhas do padrão de descrição — "🏡 {empreendimento} —
 * {bairro}, Balneário Camboriú" seguido da frase-resumo com área, tipologia (suítes ou
 * dormitórios, o que a tabela de origem trouxer) e vagas, incluindo "N apartamento(s) por
 * andar" quando essa informação estiver no arquivo manual "endereco_descricao" (ver
 * `extrairItemPorAndar`). Sempre gerado pelo código (nunca pela IA) — ver
 * `generateAiEnhancedDescription`, que só pede à IA os diferenciais. */
function montarBlocoAberturaEResumo(
  nomeEdificio: string,
  bairro: string,
  areaPrivativa: number,
  dormitorios: number,
  suites: number | undefined,
  vagas: number,
  itemPorAndar: string | undefined
): string {
  const tipologiaLabel =
    suites && suites > 0
      ? `${suites} suíte${suites === 1 ? '' : 's'}`
      : `${dormitorios} dormitório${dormitorios === 1 ? '' : 's'}`;
  const partesResumo = [
    `${Math.round(areaPrivativa)} m² privativos`,
    ...(itemPorAndar ? [itemPorAndar.toLowerCase()] : []),
    tipologiaLabel,
    `${vagas} vaga${vagas === 1 ? '' : 's'} de garagem`
  ];
  const resumo = `Unidade exclusiva com ${formatarListaNatural(partesResumo, partesResumo.length)}.`;
  return `🏡 ${nomeEdificio} — ${bairro}, Balneário Camboriú\n${resumo}`;
}

/** Monta a lista de diferenciais (bullets com "• ") a partir da Descrição das unidades e das
 * Características do empreendimento do arquivo manual — usadas quando não há IA disponível
 * (ver `generateAiEnhancedDescription`, que pede à IA uma versão mais curada/agrupada dos
 * mesmos itens). Aqui não há curadoria — lista os itens reais como vieram, só removendo (a)
 * o item de "apartamento por andar" (já usado no resumo, ver `extrairItemPorAndar`), (b) a
 * contagem pura de vagas de garagem (já no resumo) e (c) duplicados entre as duas listas.
 * Acrescenta uma linha genérica de Cobertura/Diferenciado só quando `temCobertura`/
 * `temDiferenciado` forem verdadeiros E nenhum item da lista já mencionar isso (evita
 * repetir a mesma informação de duas formas). Retorna '' quando não há nenhum diferencial
 * real pra listar — nesse caso o chamador omite a seção inteira (nunca inventa). */
function montarListaDiferenciais(
  descricaoUnidadesTexto: string,
  caracteristicasTexto: string,
  itemPorAndar: string | undefined,
  temCobertura: boolean,
  temDiferenciado: boolean
): string {
  const itensUnidades = extrairItensLista(descricaoUnidadesTexto).filter(
    (item) => item !== itemPorAndar && !/^\d+\s*vagas?\s*de\s*garagem$/i.test(item)
  );
  const todosItens = [...itensUnidades, ...extrairItensLista(caracteristicasTexto)];
  const vistos = new Set<string>();
  const itensUnicos = todosItens.filter((item) => {
    const chave = normalizarTexto(item);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const jaMencionaCobertura = itensUnicos.some((item) => /cobertura/i.test(item));
  if (temCobertura && !jaMencionaCobertura) itensUnicos.push('Opções de Cobertura Duplex disponíveis');
  const jaMencionaDiferenciado = itensUnicos.some((item) => /diferenciad[oa]/i.test(item));
  if (temDiferenciado && !jaMencionaDiferenciado) itensUnicos.push('Plantas Diferenciadas disponíveis');

  if (itensUnicos.length === 0) return '';
  return `✨ Diferenciais:\n${itensUnicos.map((item) => `• ${item}`).join('\n')}`;
}

/** Fallback sem IA — nunca menciona construtora nem o número/código da unidade específica
 * (fala só de preço, área e condições, nunca de qual unidade exata foi usada como
 * referência — esse dado fica só no campo interno `informacoes`, nunca no texto público).
 *
 * PADRONIZAÇÃO: monta exatamente o mesmo padrão pedido à IA em `generateAiEnhancedDescription`
 * — "🏡 {empreendimento} — {bairro}, Balneário Camboriú" + frase-resumo, "✨ Diferenciais:" com
 * bullets, e o bloco fixo "💰 Valores... (Incorporação ...)" (sempre gerado pelo código, nunca
 * pela IA, pra manter os números idênticos nos dois caminhos) — pra que a versão com IA e a
 * versão sem IA nunca fiquem com formatos diferentes entre si. Nunca menciona o nome da
 * construtora (esse fica só no campo interno `informacoes`) — mas o número de incorporação É
 * público, junto da entrega no bloco de valores. */
function montarDescricaoFallback(
  nomeEdificio: string,
  bairro: string,
  areaPrivativa: number,
  menorValor: number,
  dormitorios: number,
  suites: number | undefined,
  vagas: number,
  dtEntrega: string,
  incorporacao: string,
  temCobertura: boolean,
  temDiferenciado: boolean,
  descricaoUnidadesTexto: string = '',
  caracteristicasTexto: string = '',
  tipoImovel: Imovel['tipoImovel'] = 'Apartamento' as Imovel['tipoImovel'],
  condicoesPagamento?: CondicoesPagamento
): { titulo: string; descricao: string } {
  const itemPorAndar = extrairItemPorAndar(extrairItensLista(descricaoUnidadesTexto));
  const blocoAbertura = montarBlocoAberturaEResumo(nomeEdificio, bairro, areaPrivativa, dormitorios, suites, vagas, itemPorAndar);
  const blocoDiferenciais = montarListaDiferenciais(descricaoUnidadesTexto, caracteristicasTexto, itemPorAndar, temCobertura, temDiferenciado);
  const blocoValores = montarBlocoValoresEPagamento(menorValor, dtEntrega, incorporacao, condicoesPagamento);

  return {
    titulo: `${tipoImovel} à venda no ${bairro}, Balneário Camboriú — ${nomeEdificio}`,
    descricao: [blocoAbertura, blocoDiferenciais, blocoValores].filter(Boolean).join('\n\n')
  };
}

/**
 * Procura, entre os imóveis já cadastrados pelo corretor "dono" das importações DWV,
 * um que corresponda ao mesmo empreendimento (nome do edifício + cidade).
 *
 * A comparação ignora TODOS os espaços (além de acentuação/maiúsculas) — não só
 * `trim()`+lowercase — porque o nome "limpo" gravado no banco pode mudar de uma execução
 * pra outra sem o empreendimento em si ter mudado: ex. uma correção de espaçamento no nome
 * (ver `adicionarEspacamentoNome`) muda "Sistina TowerResidence" pra "Sistina Tower
 * Residence". Com uma comparação exata (só trim+lowercase), essa mudança faria o script não
 * reconhecer o registro já existente e inserir um NOVO imóvel duplicado em vez de atualizar
 * o antigo — foi exatamente isso que aconteceu com o "Sistina Tower Residence" antes desta
 * correção. Ignorando espaço na comparação, os dois nomes continuam batendo.
 */
function encontrarImovelDoEmpreendimento(
  imoveisDoDono: Imovel[],
  nomeEdificio: string,
  cidade: string
): Imovel | undefined {
  const nomeNorm = normalizarTexto(nomeEdificio).replace(/\s+/g, '');
  const cidadeNorm = normalizarTexto(cidade).replace(/\s+/g, '');
  return imoveisDoDono.find(
    (i) =>
      normalizarTexto(i.nomeEdificio || '').replace(/\s+/g, '') === nomeNorm &&
      normalizarTexto(i.cidade || '').replace(/\s+/g, '') === cidadeNorm
  );
}

/** Um empreendimento processado e cacheado pela IA na `ai_cache.json`: o `inputHash`
 * identifica exatamente quais dados de entrada geraram esse resultado (ver `hashEntradaIA`)
 * — se os dados de origem mudarem (novo preço, novo bairro, arquivo endereco_descricao
 * editado, etc.), o hash muda e o cache desse empreendimento deixa de valer. */
interface AiCacheEntry {
  inputHash: string;
  titulo: string;
  descricao: string;
  endereco: string;
  cep: string;
}

/** Calcula um hash estável de TODOS os dados que entram no prompt/decisão da IA em
 * `generateAiEnhancedDescription` — usado pra saber se dá pra reaproveitar o resultado já
 * gerado numa execução anterior (ver `ai_cache.json`) em vez de chamar o Gemini de novo.
 * Cada valor usado aqui precisa refletir fielmente o que é passado pra IA: se algo que
 * influencia o texto gerado não entrar aqui, uma mudança real (preço, unidades, bairro,
 * características) pode passar despercebida e o cache ficaria desatualizado sem ser
 * invalidado. Na dúvida, é sempre mais seguro incluir um campo a mais aqui do que de menos —
 * o pior caso de um campo a mais é rodar a IA de novo sem necessidade; o pior caso de um
 * campo a menos é o site ficar com um texto desatualizado sem ninguém perceber. */
function hashEntradaIA(entrada: {
  nomeEdificio: string;
  construtora: string;
  bairro: string;
  enderecoAtual: string;
  menorValor: number;
  areaPrivativa: number;
  dormitorios: number;
  suites: number | undefined;
  vagas: number;
  dtEntrega: string;
  incorporacao: string;
  temCobertura: boolean;
  temDiferenciado: boolean;
  pdfSnippet: string;
  descricaoUnidadesTexto: string;
  caracteristicasTexto: string;
  tipoImovel: string;
  condicoesPagamento: CondicoesPagamento | undefined;
}): string {
  const chaves = Object.keys(entrada).sort();
  const canonical = JSON.stringify(entrada, chaves);
  return crypto.createHash('sha1').update(canonical).digest('hex');
}

/** Carrega o cache de resultados de IA já gerados (ver `AI_CACHE_PATH`) — arquivo ausente,
 * corrompido ou ilegível não é motivo pra falhar a exportação, só significa que ela roda
 * sem cache dessa vez (equivalente ao comportamento de antes, sem essa otimização). */
function carregarAiCache(): Record<string, AiCacheEntry> {
  try {
    if (fs.existsSync(AI_CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(AI_CACHE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.warn('[ImobiShare Exporter] Não foi possível ler o cache de IA existente, começando sem cache:', err);
  }
  return {};
}

/** Grava o cache de resultados de IA em disco (ver `AI_CACHE_PATH`) — chamado depois de cada
 * empreendimento processado com sucesso na passada 2, pra não perder o progresso já feito se
 * a execução for interrompida no meio. Falha ao gravar não interrompe a exportação. */
function salvarAiCache(cache: Record<string, AiCacheEntry>): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(AI_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[ImobiShare Exporter] Não foi possível gravar o cache de IA:', err);
  }
}

/**
 * 6. Executa a Exportacao Completa para o ImobiShare (grava direto no Postgres/Neon via ServerDb)
 */
export async function executeExportToImobiShare(
  onProgress?: (event: ExportProgressEvent) => void
): Promise<{
  totalPastasEncontradas: number;
  totalExportados: number;
  totalPulados: number;
  novosCadastrados: number;
  atualizados: number;
  fotosCompactadas: number;
  detalhes: Array<{
    nome_edificio: string;
    construtora: string;
    acao: 'inserido' | 'atualizado' | 'pulado';
    motivo?: string;
    menorValor?: number;
    unidadeSelecionada?: string;
    fotosCount?: number;
    imovelId?: string;
  }>;
}> {
  // Verifique antes de inicializar: esta versão do ServerDb cai no banco JSON
  // quando DATABASE_URL está ausente e não oferece isUsingPostgres().
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL não definida. Configure a conexão Neon no .env da raiz do ImobiShare. ' +
      'Exportação interrompida antes de gravar dados.'
    );
  }
  await ServerDb.init();
  const diagnostico = await ServerDb.runDiagnostics();
  if (diagnostico.checks.database?.status !== 'success' || diagnostico.checks.database?.type !== 'PostgreSQL (Neon)') {
    throw new Error(
      `A conexão Neon não está ativa (${diagnostico.checks.database?.type || diagnostico.checks.database?.error || 'desconhecida'}). ` +
      'Exportação interrompida antes de gravar imóveis.'
    );
  }

  // Etapa de teste: somente FG e Baggio. A checagem ocorre antes de qualquer
  // gravação, em ambas as passadas (normal e IA), pois ambas usam esta lista.
  const folders = scanDevelopmentFolders().filter(({ construtora }) => {
    const nome = chaveCsv(construtora);
    return /^(?:construtora)?(?:fg|baggio)(?:empreendimentos|incorporadora)?$/.test(nome);
  });
  if (folders.length === 0) {
    throw new Error('Nenhuma pasta da FG ou Baggio encontrada. Confira C:\\Sqlite\\DWV\\<construtora>\\<empreendimento>.');
  }
  console.log(`[ImobiShare Exporter] TESTE FG/BAGGIO: ${folders.length} empreendimento(s) selecionado(s).`);
  const resultadosDwv = carregarResultadosDwv();
  const detalhes: Array<{
    nome_edificio: string;
    construtora: string;
    acao: 'inserido' | 'atualizado' | 'pulado';
    motivo?: string;
    menorValor?: number;
    unidadeSelecionada?: string;
    fotosCount?: number;
    imovelId?: string;
  }> = [];

  let novosCadastrados = 0;
  let atualizados = 0;
  let totalPulados = 0;
  let fotosCompactadas = 0;

  if (onProgress) {
    onProgress({
      step: 'scanning',
      message: `Localizadas ${folders.length} pastas de empreendimentos para exportação ao ImobiShare.`,
      percent: 10
    });
  }

  // Carrega uma vez todos os imóveis já cadastrados pelo corretor "dono" das importações,
  // para conseguir identificar duplicidade por nome do edifício sem precisar de uma
  // função findImovelByEdificio dedicada (que não existe no ServerDb real).
  let imoveisDoDono: Imovel[] = [];
  for (let pagina = 1; ; pagina++) {
    const resultado = await ServerDb.getMeusImoveis(IMPORT_OWNER_EMAIL, { page: pagina, limit: 100, paginate: true });
    if (Array.isArray(resultado)) throw new Error('Paginação de imóveis não disponível nesta versão de ServerDb.');
    imoveisDoDono.push(...resultado.data);
    if (!resultado.hasMore) break;
  }

  // Cache de resultados de IA já gerados em execuções anteriores (ver `hashEntradaIA` e
  // `AiCacheEntry`) — quando os dados de origem de um empreendimento não mudaram desde a
  // última vez, o texto gerado pela IA é reaproveitado direto na passada 1 (ver mais abaixo),
  // sem gastar uma chamada ao Gemini nem passar pela passada 2 pra esse empreendimento.
  const aiCache = USAR_IA_NESTE_TESTE ? carregarAiCache() : {} as Record<string, AiCacheEntry>;

  // Empreendimentos salvos com sucesso na passada 1 (com descrição simples, sem IA) que ainda
  // precisam ter título/descrição/endereço/CEP melhorados na passada 2 — só populado quando há
  // GEMINI_API_KEY E o cache de IA não tem um resultado válido pra esse empreendimento (ver
  // `hashEntradaIA`/`aiCache` acima). Guardar aqui em vez de chamar a IA dentro do loop
  // principal evita que uma espera por limite de uso do Gemini (ver chamarGeminiComRetry)
  // atrase a leitura de PDF, a compactação de fotos e a gravação no banco dos DEMAIS
  // empreendimentos da lista.
  const pendentesDeIA: Array<{
    folder: DevelopmentFolderData;
    pdfData: Awaited<ReturnType<typeof extractPdfData>>;
    salvo: Imovel;
    bairroParaUsar: string;
    enderecoParaUsar: string;
    tipoImovelSelecionado: Imovel['tipoImovel'];
    menorUnidadeNumero: string;
    enderecoDescricao: EnderecoDescricaoData | null;
    chaveAiCache: string;
    inputHashIA: string;
  }> = [];

  // ===== PASSADA 1: ler PDF/fotos e gravar TODOS os empreendimentos, com descrição simples
  // (sem IA) — garante que nada fica de fora por causa de um limite de uso do Gemini. =====
  for (let idx = 0; idx < folders.length; idx++) {
    const f = folders[idx];
    // Reserva 15-90% pra esta passada; 90-99% fica pra passada 2 (melhoria com IA), 100% no final.
    const progressPercent = Math.round(15 + ((idx + 1) / folders.length) * 75);

    if (onProgress) {
      onProgress({
        step: 'images',
        construtora: f.construtora,
        empreendimento: f.empreendimento,
        message: `[${idx + 1}/${folders.length}] Processando fotos e fachada de ${f.empreendimento} (${f.construtora})...`,
        percent: progressPercent - 5
      });
    }

    // B. Ler PDF/JSON/CSV e extrair menor valor disponivel ANTES de gastar tempo com fotos
    if (onProgress) {
      onProgress({
        step: 'pdf',
        construtora: f.construtora,
        empreendimento: f.empreendimento,
        message: `Lendo tabela de ${f.empreendimento} e buscando menor valor disponível...`,
        percent: progressPercent - 3
      });
    }

    const pdfData = await extractPdfData(f.pdfPaths, f.jsonPath, f.csvPath, f.empreendimento, f.folderPath);

    if (!pdfData.unidadesEncontradas || !pdfData.menorUnidadeDisponivel || pdfData.menorValorDisponivel <= 0) {
      totalPulados++;
      const motivo = 'Nenhuma unidade/preço real encontrado em PDF, JSON ou CSV — pulado para não gravar dado fictício.';
      if (onProgress) {
        onProgress({
          step: 'skipped',
          construtora: f.construtora,
          empreendimento: f.empreendimento,
          message: `[${idx + 1}/${folders.length}] ${f.empreendimento}: ${motivo}`,
          percent: progressPercent
        });
      }
      detalhes.push({
        nome_edificio: f.empreendimento,
        construtora: f.construtora,
        acao: 'pulado',
        motivo
      });
      continue;
    }

    const menorUnidadeNumero = pdfData.menorUnidadeDisponivel.numero_unidade || 'Disponível';
    // Tipo do imóvel selecionado (Apartamento ou Cobertura) — calculado aqui pra já usar essa
    // palavra-chave no título/descrição (ver SEO em montarDescricaoFallback/generateAiEnhancedDescription).
    const tipoImovelSelecionado: Imovel['tipoImovel'] = (pdfData.menorUnidadeDisponivel.tipologia || '')
      .toLowerCase()
      .includes('cobertura')
      ? 'Cobertura'
      : 'Apartamento';

    // Lê o arquivo manual "endereco_descricao" (Endereço / Descrição das unidades /
    // Características do empreendimento), quando existir na pasta do empreendimento.
    const enderecoDescricao = readEnderecoDescricaoFile(f.enderecoDescricaoPath);
    const dadosCsv = resultadosDwv.get(`${chaveCsv(f.construtora)}|${chaveCsv(f.empreendimento)}`);
    const descricaoUnidadesFonte = dadosCsv?.descricaoUnidades || enderecoDescricao?.descricaoUnidades || '';
    const caracteristicasFonte = dadosCsv?.descricaoEmpreendimento || enderecoDescricao?.caracteristicas || '';
    // O endereço do arquivo manual tem prioridade sobre o endereço lido do PDF/JSON/CSV
    // (que costuma vir vazio/"A definir") — é ele que atualiza o campo `endereco` do imóvel.
    const enderecoParaUsar = dadosCsv?.endereco || enderecoDescricao?.endereco || pdfData.endereco;
    // Bairro: usa o valor explícito do JSON quando existir (raro); senão, tenta extrair do
    // endereço que será usado (arquivo manual ou PDF/JSON/CSV) — ver extrairBairroDoEndereco.
    // Se nada der certo, mantém "A definir" (não inventa bairro). Isso não depende de IA, então
    // já sai certo desde a passada 1.
    const bairroParaUsar =
      dadosCsv?.bairro || (pdfData.bairro && pdfData.bairro !== 'A definir'
        ? pdfData.bairro
        : extrairBairroDoEndereco(enderecoParaUsar) || 'A definir');

    // A. Ordenar e selecionar até 15 fotos reais com Fachada na posicao 0 (só depois de confirmar que há dados válidos)
    const realPhotos = sortAndSelect15Photos(f.imagePaths, f.empreendimento);
    const optimizedUrls: string[] = [];

    for (let pIdx = 0; pIdx < realPhotos.length; pIdx++) {
      const isFacade = pIdx === 0;
      try {
        const compressed = await compressPhotoToMax50Kb(realPhotos[pIdx], f.empreendimento, pIdx, isFacade);
        optimizedUrls.push(compressed.url);
        fotosCompactadas++;
      } catch (err) {
        console.warn(`[ImobiShare Exporter] Falha ao compactar foto ${pIdx + 1} de ${f.empreendimento}:`, err);
      }
    }

    // C. Montar título/descrição SEM IA (determinístico, sem chamar o Gemini) — a versão com IA
    // (pesquisa online + copywriting) roda depois, na passada 2, pra não travar este loop.
    const existente = encontrarImovelDoEmpreendimento(imoveisDoDono, f.empreendimento, CIDADE_PADRAO);
    const menorUnidade = pdfData.menorUnidadeDisponivel;
    // Dormitórios/banheiros/vagas da unidade de referência — usados tanto no imóvel salvo
    // quanto na descrição (ver montarDescricaoFallback/generateAiEnhancedDescription). Regra
    // de negócio: quando a tabela só informa suítes (sem "Dormitórios" separado), dormitórios
    // = suítes (ver parseUnidadesFromDwvTemplate); banheiros = suítes (aplicado em extractPdfData).
    const dormitoriosSelecionados = menorUnidade.dormitorios ?? menorUnidade.suites ?? 0;
    const banheirosSelecionados = menorUnidade.banheiros ?? 0;
    const vagasSelecionadas = menorUnidade.vagas ?? 0;

    const semIA = montarDescricaoFallback(
      f.empreendimento,
      bairroParaUsar,
      pdfData.areaPrivativaMenor,
      pdfData.menorValorDisponivel,
      dormitoriosSelecionados,
      menorUnidade.suites,
      vagasSelecionadas,
      pdfData.dtEntrega,
      pdfData.incorporacao,
      pdfData.temCobertura,
      pdfData.temDiferenciado,
      descricaoUnidadesFonte,
      caracteristicasFonte,
      tipoImovelSelecionado,
      menorUnidade.pagamento
    );

    // C.1 Verifica se já existe, no cache local, um resultado de IA válido pra ESTES dados
    // exatos (ver `hashEntradaIA`) — se sim, reaproveita título/descrição/endereço/CEP já
    // gerados antes em vez de chamar o Gemini de novo. Só é considerado quando há
    // GEMINI_API_KEY (senão nunca haveria um resultado de IA pra reaproveitar de qualquer jeito).
    const chaveAiCache = `${f.construtora}||${f.empreendimento}`.trim().toLowerCase();
    const inputHashIA = hashEntradaIA({
      nomeEdificio: f.empreendimento,
      construtora: f.construtora,
      bairro: bairroParaUsar,
      enderecoAtual: enderecoParaUsar,
      menorValor: pdfData.menorValorDisponivel,
      areaPrivativa: pdfData.areaPrivativaMenor,
      dormitorios: dormitoriosSelecionados,
      suites: menorUnidade.suites,
      vagas: vagasSelecionadas,
      dtEntrega: pdfData.dtEntrega,
      incorporacao: pdfData.incorporacao,
      temCobertura: pdfData.temCobertura,
      temDiferenciado: pdfData.temDiferenciado,
      pdfSnippet: pdfData.pdfRawText.substring(0, 500),
      descricaoUnidadesTexto: descricaoUnidadesFonte,
      caracteristicasTexto: caracteristicasFonte,
      tipoImovel: tipoImovelSelecionado,
      condicoesPagamento: menorUnidade.pagamento
    });
    const cacheIA = USAR_IA_NESTE_TESTE && process.env.GEMINI_API_KEY ? aiCache[chaveAiCache] : undefined;
    const usarCacheIA = !!cacheIA && cacheIA.inputHash === inputHashIA;

    // D. Salvar (inserir ou atualizar) direto na tabela `imoveis` do ImobiShare
    if (onProgress) {
      onProgress({
        step: 'database',
        construtora: f.construtora,
        empreendimento: f.empreendimento,
        message: `Gravando ${f.empreendimento} no banco do ImobiShare (Neon)...`,
        percent: progressPercent
      });
    }

    // "Terceiros exclusivos" é ao mesmo tempo um status de origem (mapeado pra
    // statusImovel "Mobiliado" acima) e uma informação que sempre aparece no campo
    // `informacoes`, junto com construtora, unidade e a indicação de importação DWV —
    // conforme pedido, independente do que mais estiver disponível pro empreendimento.
    const isTerceirosExclusivos = normalizarTexto(pdfData.statusOrigem).includes('terceiros exclusivos');

    // Uma informação de controle por linha (em vez de uma frase só, corrida) — mais fácil
    // de ler rapidamente no cadastro. Mantém o limite de 200 caracteres do campo
    // (ver `informacoes.substring(0, 200)` abaixo); se o texto ultrapassar o limite, o
    // corte acontece no fim, nunca no meio do rótulo de uma linha, já que cada linha é
    // adicionada por inteiro, uma de cada vez, até estourar o limite.
    const infoLinhas = [
      `Construtora: ${f.construtora}`,
      `Unidade: ${menorUnidadeNumero}`,
      `Terceiros exclusivos: ${isTerceirosExclusivos ? 'Sim' : 'Não'}`,
      `Importação DWV: Sim`,
      ...(dadosCsv?.dataAtualizacao ? [`Atualização DWV: ${dadosCsv.dataAtualizacao}`] : []),
      `Entrega: ${pdfData.dtEntrega}`,
      ...(pdfData.incorporacao ? [`Incorporação: ${pdfData.incorporacao}`] : []),
      `${pdfData.unidades.length} unidade(s) mapeada(s) na tabela de origem (não listadas individualmente no ImobiShare)`
    ];
    let informacoes = '';
    for (const linha of infoLinhas) {
      const proximo = informacoes ? `${informacoes}\n${linha}` : linha;
      if (proximo.length > 200) break;
      informacoes = proximo;
    }

    const imovelParaSalvar: Imovel = {
      id: existente?.id || '',
      corretorEmail: IMPORT_OWNER_EMAIL,
      // Endereço: se o cache de IA tem um endereço válido pra estes mesmos dados (ver
      // `usarCacheIA` acima), usa ele; senão prioriza o valor do arquivo manual
      // "endereco_descricao", com fallback pro que o PDF/JSON/CSV trouxer. A busca online (só
      // roda quando não há cache e o endereço não vem de nenhuma dessas fontes) acontece na
      // passada 2, com IA.
      endereco: (usarCacheIA && cacheIA!.endereco) || enderecoParaUsar,
      cidade: CIDADE_PADRAO,
      // Bairro: usa o que foi extraído/lido agora (ver bairroParaUsar); se nada foi achado
      // nesta execução mas o imóvel já tinha um bairro real gravado antes, mantém o antigo
      // em vez de sobrescrever com "A definir".
      bairro: bairroParaUsar !== 'A definir' ? bairroParaUsar : existente?.bairro || bairroParaUsar,
      // CEP: usa o do cache de IA quando válido pra estes dados; senão mantém o que já estava
      // gravado antes (se houver) — CEP novo só vem de pesquisa online (passada 2, com IA),
      // sem apagar o que já existia.
      cep: (usarCacheIA && cacheIA!.cep) || existente?.cep || '',
      tipoImovel: tipoImovelSelecionado,
      // Lançamento/Pré-Lançamento -> "Na planta"; Pronto para morar -> "Sem mobília";
      // Terceiros exclusivos -> "Mobiliado" (ver mapStatusOrigemParaStatusImovel).
      statusImovel: mapStatusOrigemParaStatusImovel(pdfData.statusOrigem),
      tipo: 'venda',
      valor: pdfData.menorValorDisponivel,
      valorVenda: pdfData.menorValorDisponivel,
      dormitorios: dormitoriosSelecionados,
      quartos: dormitoriosSelecionados,
      banheiros: banheirosSelecionados,
      vagas: vagasSelecionadas,
      metragem: pdfData.areaPrivativaMenor,
      areaTotal: menorUnidade.area_total,
      // Latitude/longitude: vêm dos rótulos opcionais "Latitude:"/"Longitude:" do arquivo
      // manual "endereco_descricao" (ver `readEnderecoDescricaoFile`/`parseCoordenada`) —
      // mesmos campos numéricos que já existem em `Imovel`, sem precisar de coluna nova no
      // banco. Quando o arquivo não tem essas linhas (ou o valor não é uma coordenada válida),
      // mantém o que já estava gravado antes em vez de apagar uma coordenada boa.
      latitude: dadosCsv?.latitude ?? enderecoDescricao?.latitude ?? existente?.latitude,
      longitude: dadosCsv?.longitude ?? enderecoDescricao?.longitude ?? existente?.longitude,
      ...(dadosCsv?.dataAtualizacao ? { atualizadoDw: dadosCsv.dataAtualizacao } : {}),
      nomeEdificio: f.empreendimento,
      // Título/descrição: reaproveita o resultado do cache de IA quando válido pra estes
      // mesmos dados (ver `usarCacheIA` acima); senão usa a versão sem IA por enquanto — se
      // houver GEMINI_API_KEY e não houver cache válido, a passada 2 melhora isso depois.
      titulo: (usarCacheIA && cacheIA!.titulo) || semIA.titulo,
      descricao: (usarCacheIA && cacheIA!.descricao) || semIA.descricao,
      informacoes: informacoes.substring(0, 200),
      website: 'SIM',
      compartilhar: 'SIM',
      fotos: optimizedUrls,
      dataCadastro: existente?.dataCadastro || new Date().toISOString(),
      origem: 'DWV',
      construtora: f.construtora
    };

    // Grava no banco com algumas tentativas: em exportacoes longas (varios empreendimentos,
    // cada um com fotos entre uma gravacao e outra) e um banco serverless como o Neon, e comum
    // a conexao cair por ociosidade ("Connection terminated unexpectedly"). Sem retry, isso
    // derrubava a exportacao inteira e perdia todos os empreendimentos seguintes. Agora tenta
    // de novo com espera crescente e, so se mesmo assim falhar, pula ESTE empreendimento (sem
    // inventar nada) e segue para o proximo.
    const MAX_TENTATIVAS_SALVAR = 3;
    let salvo: Imovel | null = null;
    let erroAoSalvar: Error | null = null;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_SALVAR; tentativa++) {
      try {
        salvo = await ServerDb.saveImovel(imovelParaSalvar, IMPORT_OWNER_EMAIL);
        erroAoSalvar = null;
        break;
      } catch (err) {
        erroAoSalvar = err as Error;
        console.warn(
          `[ImobiShare Exporter] ${f.empreendimento}: tentativa ${tentativa}/${MAX_TENTATIVAS_SALVAR} de gravar no banco falhou — ${erroAoSalvar?.message || erroAoSalvar}`
        );
        if (tentativa < MAX_TENTATIVAS_SALVAR) {
          await sleep(2000 * tentativa); // 2s, depois 4s
        }
      }
    }

    if (!salvo) {
      totalPulados++;
      const motivo = `Falha ao gravar no banco apos ${MAX_TENTATIVAS_SALVAR} tentativas: ${erroAoSalvar?.message || 'erro desconhecido'}`;
      if (onProgress) {
        onProgress({
          step: 'skipped',
          construtora: f.construtora,
          empreendimento: f.empreendimento,
          message: `[${idx + 1}/${folders.length}] ${f.empreendimento}: ${motivo}`,
          percent: progressPercent
        });
      }
      detalhes.push({
        nome_edificio: f.empreendimento,
        construtora: f.construtora,
        acao: 'pulado',
        motivo
      });
      continue;
    }

    const acao: 'inserido' | 'atualizado' = existente ? 'atualizado' : 'inserido';
    if (acao === 'inserido') {
      novosCadastrados++;
      imoveisDoDono = [...imoveisDoDono, salvo];
    } else {
      atualizados++;
      imoveisDoDono = imoveisDoDono.map((i: Imovel) => (i.id === salvo.id ? salvo : i));
    }

    detalhes.push({
      nome_edificio: f.empreendimento,
      construtora: f.construtora,
      acao,
      menorValor: pdfData.menorValorDisponivel,
      unidadeSelecionada: menorUnidadeNumero,
      fotosCount: optimizedUrls.length,
      imovelId: salvo.id
    });

    // Só entra na fila da passada 2 se houver chave E não houver, no cache local, um
    // resultado de IA já válido pra estes mesmos dados (ver `usarCacheIA` acima) — sem
    // chave, generateAiEnhancedDescription simplesmente devolveria o mesmo texto sem IA que
    // já foi gravado agora; com cache válido, o resultado já foi reaproveitado direto acima,
    // sem necessidade de chamar o Gemini de novo.
    if (USAR_IA_NESTE_TESTE && process.env.GEMINI_API_KEY && !usarCacheIA) {
      pendentesDeIA.push({
        folder: f,
        pdfData,
        salvo,
        bairroParaUsar,
        enderecoParaUsar,
        tipoImovelSelecionado,
        menorUnidadeNumero,
        enderecoDescricao: {
          endereco: enderecoParaUsar,
          latitude: dadosCsv?.latitude ?? enderecoDescricao?.latitude,
          longitude: dadosCsv?.longitude ?? enderecoDescricao?.longitude,
          descricaoUnidades: descricaoUnidadesFonte,
          caracteristicas: caracteristicasFonte
        },
        chaveAiCache,
        inputHashIA
      });
    }
  }

  // ===== PASSADA 2: melhorar título/descrição/endereço/CEP com IA (Gemini + pesquisa online),
  // agora que TODOS os empreendimentos já estão salvos no banco com a versão simples. Uma
  // falha (ou limite de uso esgotado mesmo após as tentativas) aqui só mantém o texto simples
  // do empreendimento — nunca desfaz o que já foi gravado na passada 1. =====
  if (pendentesDeIA.length > 0) {
    for (let idx = 0; idx < pendentesDeIA.length; idx++) {
      const item = pendentesDeIA[idx];
      const progressPercent = Math.round(90 + ((idx + 1) / pendentesDeIA.length) * 9);

      if (onProgress) {
        onProgress({
          step: 'ai',
          construtora: item.folder.construtora,
          empreendimento: item.folder.empreendimento,
          message: `[IA ${idx + 1}/${pendentesDeIA.length}] Melhorando título/descrição de ${item.folder.empreendimento}...`,
          percent: progressPercent
        });
      }

      try {
        const aiCopy = await generateAiEnhancedDescription(
          item.folder.empreendimento,
          item.folder.construtora,
          item.bairroParaUsar,
          item.enderecoParaUsar,
          item.pdfData.menorValorDisponivel,
          item.pdfData.areaPrivativaMenor,
          item.pdfData.menorUnidadeDisponivel?.dormitorios ?? item.pdfData.menorUnidadeDisponivel?.suites ?? 0,
          item.pdfData.menorUnidadeDisponivel?.suites,
          item.pdfData.menorUnidadeDisponivel?.vagas ?? 0,
          item.pdfData.dtEntrega,
          item.pdfData.incorporacao,
          item.pdfData.temCobertura,
          item.pdfData.temDiferenciado,
          item.pdfData.pdfRawText,
          item.enderecoDescricao?.descricaoUnidades || '',
          item.enderecoDescricao?.caracteristicas || '',
          item.tipoImovelSelecionado,
          item.pdfData.menorUnidadeDisponivel?.pagamento
        );

        const imovelAtualizado: Imovel = {
          ...item.salvo,
          endereco: item.enderecoDescricao?.endereco || aiCopy.endereco || item.salvo.endereco,
          cep: aiCopy.cep || item.salvo.cep || '',
          titulo: aiCopy.titulo,
          descricao: aiCopy.descricao
        };

        const salvoAtualizado = await ServerDb.saveImovel(imovelAtualizado, IMPORT_OWNER_EMAIL);
        imoveisDoDono = imoveisDoDono.map((i: Imovel) => (i.id === salvoAtualizado.id ? salvoAtualizado : i));

        // Grava no cache local pra próxima execução não precisar chamar o Gemini de novo
        // pra este empreendimento, enquanto os dados de origem (preço, unidades, bairro,
        // características etc.) não mudarem (ver `hashEntradaIA`). Grava a cada item (em vez
        // de só no final) pra não perder o progresso já feito se a execução for interrompida
        // no meio da passada 2.
        aiCache[item.chaveAiCache] = {
          inputHash: item.inputHashIA,
          titulo: aiCopy.titulo,
          descricao: aiCopy.descricao,
          endereco: imovelAtualizado.endereco || '',
          cep: imovelAtualizado.cep || ''
        };
        salvarAiCache(aiCache);
      } catch (err) {
        console.warn(
          `[ImobiShare Exporter] ${item.folder.empreendimento}: falha ao melhorar descrição com IA — mantendo o texto simples já gravado. ${(err as Error)?.message || err}`
        );
      }
    }
  }

  const totalExportados = novosCadastrados + atualizados;

  if (onProgress) {
    onProgress({
      step: 'complete',
      message: `Exportação concluída: ${totalExportados} empreendimento(s) gravado(s) no Neon (${novosCadastrados} novo(s), ${atualizados} atualizado(s)), ${totalPulados} pulado(s) por falta de dados reais.`,
      percent: 100
    });
  }

  return {
    totalPastasEncontradas: folders.length,
    totalExportados,
    totalPulados,
    novosCadastrados,
    atualizados,
    fotosCompactadas,
    detalhes
  };
}

/**
 * Execução via linha de comando: `npm run export:imobishare`
 */
async function main() {
  try {
    const resultado = await executeExportToImobiShare((evt) => {
      console.log(`[${evt.percent.toString().padStart(3, ' ')}%] ${evt.message}`);
    });
    console.log('\n📊 Resumo da exportação:');
    console.table(resultado.detalhes);
    console.log(
      `Total de pastas: ${resultado.totalPastasEncontradas} | Exportados: ${resultado.totalExportados} ` +
      `(${resultado.novosCadastrados} novos, ${resultado.atualizados} atualizados) | Pulados: ${resultado.totalPulados} | Fotos compactadas: ${resultado.fotosCompactadas}`
    );
  } catch (err) {
    console.error('❌ Erro na exportação para o ImobiShare:', err);
    process.exitCode = 1;
  } finally {
    // Algumas versões do ServerDb não expõem close().
    const close = (ServerDb as unknown as { close?: () => Promise<void> }).close;
    if (typeof close === 'function') await close.call(ServerDb);
  }
}

// Só roda o CLI quando o arquivo é executado diretamente (não quando importado por outro módulo).
// Usa pathToFileURL em vez de comparar strings na mão — comparar "file://" + process.argv[1]
// direto quebra no Windows (barras invertidas, letra de unidade, etc.) e faz o script encerrar
// sem nunca chamar main(), sem erro nenhum.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
