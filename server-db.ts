/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { Imovel, Corretor, Parceria, Favorito } from './src/types';

// Helper for error logging
export function logBackendError(endpoint: string, err: any): void {
  const msg = err?.message || String(err);
  const stack = err?.stack || '';
  console.error(`❌ [BACKEND ERROR] ${endpoint} -> ${msg}`, stack ? `\n${stack}` : '');
}

// Helper for memory logging
export function logMemory(context?: string): void {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  if (heapMB > 300) {
    console.warn(`⚠️ [HIGH MEMORY] ${context ? `(${context}) ` : ''}Heap: ${heapMB}MB, RSS: ${rssMB}MB`);
  }
}

interface LocalJsonDb {
  brokers: Corretor[];
  properties: Imovel[];
  partnerships: Parceria[];
  favorites: Favorito[];
}

export class ServerDb {
  public static isPostgres = false;
  public static pool: Pool | null = null;
  private static jsonDbPath = path.join(process.cwd(), 'imobishare_db.json');
  private static localData: LocalJsonDb = {
    brokers: [],
    properties: [],
    partnerships: [],
    favorites: []
  };

  /**
   * Inicializa o banco de dados (PostgreSQL Neon ou Local JSON fallback)
   */
  public static async init(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl && dbUrl.trim() !== '') {
      try {
        console.log('🔌 Conectando ao PostgreSQL (Neon)...');
        this.pool = new Pool({
          connectionString: dbUrl.trim(),
          ssl: { rejectUnauthorized: false },
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        });

        // Test connection
        const client = await this.pool.connect();
        try {
          const res = await client.query('SELECT NOW() as now, current_database() as db');
          console.log(`✅ Conectado ao PostgreSQL Neon (${res.rows[0].db}) em ${res.rows[0].now}`);
          this.isPostgres = true;

          // Garantir tabelas e índices essenciais
          await this.ensureTables(client);
        } finally {
          client.release();
        }
        return;
      } catch (err: any) {
        console.warn('⚠️ Falha ao conectar ao PostgreSQL. Alternando para banco local JSON:', err?.message);
        this.isPostgres = false;
        this.pool = null;
      }
    }

    // Fallback JSON
    console.log('📁 Inicializando banco de dados local JSON (imobishare_db.json)...');
    await this.loadLocalJson();
  }

  private static async ensureTables(client: any): Promise<void> {
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS corretores (
          email VARCHAR PRIMARY KEY,
          id VARCHAR,
          nome VARCHAR,
          creci VARCHAR,
          telefone VARCHAR,
          cidade VARCHAR,
          estado VARCHAR,
          imobiliaria_ou_autonomo VARCHAR,
          foto_url TEXT,
          slug_site VARCHAR,
          is_admin BOOLEAN DEFAULT FALSE,
          restringir_parceiros BOOLEAN DEFAULT FALSE,
          parceiros_emails TEXT,
          password TEXT,
          reset_token TEXT,
          reset_token_expires BIGINT,
          role VARCHAR
        );

        CREATE TABLE IF NOT EXISTS imoveis (
          id VARCHAR PRIMARY KEY,
          corretor_email VARCHAR,
          cep VARCHAR,
          endereco TEXT,
          cidade VARCHAR,
          bairro VARCHAR,
          tipo VARCHAR,
          modalidade VARCHAR,
          valor_venda NUMERIC,
          valor_locacao NUMERIC,
          quartos INTEGER,
          bwc INTEGER,
          vagas INTEGER,
          area_privativa NUMERIC,
          nome_edificio VARCHAR,
          titulo VARCHAR,
          palavra_destacada VARCHAR,
          descricao TEXT,
          visibilidade VARCHAR,
          dados_proprietario TEXT,
          imagens TEXT,
          data_cadastro VARCHAR,
          valor_anterior NUMERIC,
          valor_locacao_anterior NUMERIC,
          informacoes TEXT,
          status_imovel TEXT,
          origem VARCHAR,
          construtora VARCHAR,
          website VARCHAR,
          compartilhar VARCHAR,
          codigo VARCHAR,
          latitude NUMERIC,
          longitude NUMERIC,
          condominio NUMERIC,
          iptu NUMERIC,
          codigo_im VARCHAR,
          unidade VARCHAR,
          bloco_torre VARCHAR,
          condicao_imovel VARCHAR,
          status_global VARCHAR,
          escopo VARCHAR,
          telefone_construtora VARCHAR,
          atualizado_dw TEXT
        );

        CREATE TABLE IF NOT EXISTS parcerias (
          corretor_email VARCHAR,
          corretor_parceiro_email VARCHAR,
          PRIMARY KEY (corretor_email, corretor_parceiro_email)
        );

        CREATE TABLE IF NOT EXISTS favoritos (
          corretor_email VARCHAR,
          imovel_id VARCHAR,
          PRIMARY KEY (corretor_email, imovel_id)
        );

        CREATE TABLE IF NOT EXISTS corretor_imoveis (
          id VARCHAR PRIMARY KEY,
          corretor_email VARCHAR,
          imovel_id VARCHAR,
          status_carteira VARCHAR,
          dados_proprietario TEXT,
          nome_proprietario VARCHAR,
          telefone_proprietario VARCHAR,
          comissao NUMERIC,
          autorizacao VARCHAR,
          observacoes_internas TEXT,
          criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS imovel_origens (
          id SERIAL PRIMARY KEY,
          imovel_id VARCHAR,
          origem VARCHAR,
          origem_id VARCHAR,
          ultima_sincronizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS imovel_duplicidades_revisao (
          id SERIAL PRIMARY KEY,
          imovel_novo_id VARCHAR,
          imovel_existente_id VARCHAR,
          corretor_email VARCHAR,
          grau_confianca VARCHAR,
          motivo TEXT,
          status VARCHAR,
          criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS imovel_historico (
          id SERIAL PRIMARY KEY,
          imovel_id VARCHAR,
          usuario_email VARCHAR,
          tipo_usuario VARCHAR,
          campo_alterado VARCHAR,
          valor_anterior TEXT,
          valor_novo TEXT,
          data_hora TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
      `);

      // Índices úteis
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_imoveis_cidade ON imoveis (cidade);
        CREATE INDEX IF NOT EXISTS idx_imoveis_corretor ON imoveis (corretor_email);
        CREATE INDEX IF NOT EXISTS idx_imoveis_codigo ON imoveis (codigo);
        CREATE INDEX IF NOT EXISTS idx_imoveis_codigo_im ON imoveis (codigo_im);
      `);
    } catch (err: any) {
      console.warn('Aviso ao validar tabelas no PostgreSQL:', err?.message);
    }
  }

  private static async loadLocalJson(): Promise<void> {
    try {
      const data = await fs.readFile(this.jsonDbPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.localData = {
        brokers: parsed.brokers || [],
        properties: parsed.properties || [],
        partnerships: parsed.partnerships || [],
        favorites: parsed.favorites || []
      };
    } catch {
      this.localData = { brokers: [], properties: [], partnerships: [], favorites: [] };
      await this.saveLocalJson();
    }
  }

  private static async saveLocalJson(): Promise<void> {
    try {
      await fs.writeFile(this.jsonDbPath, JSON.stringify(this.localData, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Erro ao salvar imobishare_db.json:', err);
    }
  }

  public static async runDiagnostics(): Promise<any> {
    let dbStatus: 'success' | 'error' = 'success';
    let dbType = this.isPostgres ? 'PostgreSQL (Neon)' : 'Local JSON';
    let countProperties = 0;
    let countBrokers = 0;
    let message = 'Banco de dados operacional';

    try {
      if (this.isPostgres && this.pool) {
        const propCountRes = await this.pool.query('SELECT COUNT(*) as count FROM imoveis');
        const brokerCountRes = await this.pool.query('SELECT COUNT(*) as count FROM corretores');
        countProperties = parseInt(propCountRes.rows[0].count, 10);
        countBrokers = parseInt(brokerCountRes.rows[0].count, 10);
        message = `PostgreSQL Neon ativo com ${countProperties} imóveis e ${countBrokers} corretores.`;
      } else {
        countProperties = this.localData.properties.length;
        countBrokers = this.localData.brokers.length;
        message = `Banco Local JSON com ${countProperties} imóveis e ${countBrokers} corretores.`;
      }
    } catch (err: any) {
      dbStatus = 'error';
      message = `Erro ao diagnosticar banco: ${err?.message || err}`;
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          id: 'db-check',
          name: 'Banco de Dados',
          description: 'Conexão e integridade com a base de dados',
          status: dbStatus,
          type: dbType,
          message,
          details: {
            totalImoveis: countProperties,
            totalCorretores: countBrokers
          }
        }
      }
    };
  }

  // --- PASSWORD UTILITIES ---
  public static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      try {
        return await bcrypt.compare(password, hash);
      } catch {
        return false;
      }
    }
    return password === hash;
  }

  // --- CORRETORES ---
  public static async getCorretorByEmail(email: string): Promise<Corretor | null> {
    const cleanEmail = email.toLowerCase().trim();
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
      if (res.rows.length === 0) return null;
      return this.mapRowToCorretor(res.rows[0]);
    }

    const found = this.localData.brokers.find(b => b.email.toLowerCase().trim() === cleanEmail);
    return found ? { ...found } : null;
  }

  public static async getCorretorByPhone(phone: string): Promise<Corretor | null> {
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits) return null;

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores');
      for (const row of res.rows) {
        const rowDigits = (row.telefone || '').replace(/\D/g, '');
        if (rowDigits && (rowDigits === cleanDigits || rowDigits.endsWith(cleanDigits) || cleanDigits.endsWith(rowDigits))) {
          return this.mapRowToCorretor(row);
        }
      }
      return null;
    }

    const found = this.localData.brokers.find(b => {
      const bDigits = (b.telefone || b.whatsapp || '').replace(/\D/g, '');
      return bDigits && (bDigits === cleanDigits || bDigits.endsWith(cleanDigits) || cleanDigits.endsWith(bDigits));
    });
    return found ? { ...found } : null;
  }

  public static async saveCorretor(corretorData: Partial<Corretor>): Promise<Corretor> {
    const cleanEmail = (corretorData.email || '').toLowerCase().trim();
    if (!cleanEmail) throw new Error('E-mail é obrigatório para salvar corretor.');

    const existing = await this.getCorretorByEmail(cleanEmail);

    const merged: Corretor = {
      id: corretorData.id || existing?.id || `broker-${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
      email: cleanEmail,
      nome: corretorData.nome || existing?.nome || cleanEmail.split('@')[0],
      creci: corretorData.creci !== undefined ? corretorData.creci : (existing?.creci || ''),
      telefone: corretorData.telefone !== undefined ? corretorData.telefone : (existing?.telefone || ''),
      whatsapp: corretorData.whatsapp !== undefined ? corretorData.whatsapp : (existing?.whatsapp || corretorData.telefone || existing?.telefone || ''),
      cidade: corretorData.cidade || existing?.cidade || 'Balneário Camboriú',
      estado: corretorData.estado || existing?.estado || 'SC',
      imobiliaria: corretorData.imobiliaria !== undefined ? corretorData.imobiliaria : (existing?.imobiliaria || ''),
      tipoAtuacao: corretorData.tipoAtuacao || existing?.tipoAtuacao || 'autonomo',
      foto: corretorData.foto !== undefined ? corretorData.foto : (existing?.foto || ''),
      slugSite: corretorData.slugSite || existing?.slugSite || '',
      isAdmin: cleanEmail === 'afreccia@gmail.com' ? true : (corretorData.isAdmin !== undefined ? corretorData.isAdmin : (existing?.isAdmin || false)),
      role: cleanEmail === 'afreccia@gmail.com' ? 'admin' : (corretorData.role || existing?.role || 'corretor'),
      password: corretorData.password !== undefined ? corretorData.password : (existing?.password || ''),
      resetToken: corretorData.resetToken !== undefined ? corretorData.resetToken : existing?.resetToken,
      resetTokenExpires: corretorData.resetTokenExpires !== undefined ? corretorData.resetTokenExpires : existing?.resetTokenExpires,
      restringirParceiros: corretorData.restringirParceiros !== undefined ? corretorData.restringirParceiros : (existing?.restringirParceiros || false),
      parceirosEmails: corretorData.parceirosEmails || existing?.parceirosEmails || []
    };

    if (this.isPostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO corretores (
          email, id, nome, creci, telefone, cidade, estado, 
          imobiliaria_ou_autonomo, foto_url, slug_site, is_admin, 
          restringir_parceiros, parceiros_emails, password, reset_token, reset_token_expires, role
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        ON CONFLICT (email) DO UPDATE SET
          nome = EXCLUDED.nome,
          creci = EXCLUDED.creci,
          telefone = EXCLUDED.telefone,
          cidade = EXCLUDED.cidade,
          estado = EXCLUDED.estado,
          imobiliaria_ou_autonomo = EXCLUDED.imobiliaria_ou_autonomo,
          foto_url = EXCLUDED.foto_url,
          slug_site = EXCLUDED.slug_site,
          is_admin = EXCLUDED.is_admin,
          restringir_parceiros = EXCLUDED.restringir_parceiros,
          parceiros_emails = EXCLUDED.parceiros_emails,
          password = EXCLUDED.password,
          reset_token = EXCLUDED.reset_token,
          reset_token_expires = EXCLUDED.reset_token_expires,
          role = EXCLUDED.role`,
        [
          merged.email,
          merged.id,
          merged.nome,
          merged.creci,
          merged.telefone,
          merged.cidade,
          merged.estado,
          merged.imobiliaria,
          merged.foto,
          merged.slugSite,
          merged.isAdmin,
          merged.restringirParceiros,
          JSON.stringify(merged.parceirosEmails || []),
          merged.password,
          merged.resetToken || null,
          merged.resetTokenExpires || null,
          merged.role
        ]
      );
      return merged;
    }

    const idx = this.localData.brokers.findIndex(b => b.email.toLowerCase().trim() === cleanEmail);
    if (idx >= 0) {
      this.localData.brokers[idx] = merged;
    } else {
      this.localData.brokers.push(merged);
    }
    await this.saveLocalJson();
    return merged;
  }

  public static async getAllCorretores(): Promise<Corretor[]> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores ORDER BY nome ASC');
      return res.rows.map(r => this.mapRowToCorretor(r));
    }
    return [...this.localData.brokers];
  }

  private static mapRowToCorretor(row: any): Corretor {
    let parceiros: string[] = [];
    try {
      parceiros = row.parceiros_emails ? JSON.parse(row.parceiros_emails) : [];
    } catch {}

    return {
      id: row.id || `broker-${row.email}`,
      email: row.email,
      nome: row.nome || '',
      creci: row.creci || '',
      telefone: row.telefone || '',
      whatsapp: row.telefone || '',
      cidade: row.cidade || 'Balneário Camboriú',
      estado: row.estado || 'SC',
      imobiliaria: row.imobiliaria_ou_autonomo || '',
      tipoAtuacao: row.imobiliaria_ou_autonomo ? 'imobiliaria' : 'autonomo',
      foto: row.foto_url || '',
      slugSite: row.slug_site || '',
      isAdmin: Boolean(row.is_admin || row.email === 'afreccia@gmail.com'),
      role: row.role || (row.email === 'afreccia@gmail.com' ? 'admin' : 'corretor'),
      password: row.password || '',
      resetToken: row.reset_token || undefined,
      resetTokenExpires: row.reset_token_expires ? Number(row.reset_token_expires) : undefined,
      restringirParceiros: Boolean(row.restringir_parceiros),
      parceirosEmails: parceiros
    };
  }

  // --- CIDADES ---
  public static async getCidades(): Promise<Array<{ cidade: string; count: number }>> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query(`
        SELECT cidade, COUNT(*) as count 
        FROM imoveis 
        WHERE cidade IS NOT NULL AND TRIM(cidade) <> ''
        GROUP BY cidade 
        ORDER BY count DESC, cidade ASC
      `);
      return res.rows.map(r => ({ cidade: r.cidade, count: parseInt(r.count, 10) }));
    }

    const counts: Record<string, number> = {};
    for (const p of this.localData.properties) {
      if (p.cidade) {
        counts[p.cidade] = (counts[p.cidade] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([cidade, count]) => ({ cidade, count }));
  }

  // --- IMOVEIS MAPPER ---
  private static mapRowToImovel(row: any, isSummary: boolean = false): Imovel {
    let fotos: string[] = [];
    if (row.imagens) {
      if (Array.isArray(row.imagens)) {
        fotos = row.imagens;
      } else if (typeof row.imagens === 'string') {
        try {
          fotos = JSON.parse(row.imagens);
        } catch {
          fotos = [row.imagens];
        }
      }
    }

    // Em listagens e resumos, envia apenas a foto de capa (fotos[0]).
    // Isso reduz o payload JSON de ~30MB para ~200KB, evitando travamentos de rede e OOM no Render.
    if (isSummary && fotos.length > 1) {
      fotos = [fotos[0]];
    }

    return {
      id: row.id,
      codigo: row.codigo || undefined,
      codigoIm: row.codigo_im || undefined,
      corretorEmail: row.corretor_email || '',
      corretorId: `broker-${row.corretor_email}`,
      cep: row.cep || undefined,
      endereco: row.endereco || undefined,
      localizacao: row.endereco || undefined,
      cidade: row.cidade || 'Balneário Camboriú',
      bairro: row.bairro || '',
      tipoImovel: (row.tipo as any) || 'Apartamento',
      condicaoImovel: row.condicao_imovel || row.status_imovel || 'Na Planta',
      statusImovel: row.status_imovel || row.condicao_imovel || 'Na Planta',
      statusComercial: (row.status_global as any) || 'Disponível',
      tipo: (row.modalidade as any) || 'venda',
      unidade: row.unidade || undefined,
      bloco: row.bloco_torre || undefined,
      valor: row.valor_venda !== null && row.valor_venda !== undefined ? Number(row.valor_venda) : 0,
      valorVenda: row.valor_venda !== null && row.valor_venda !== undefined ? Number(row.valor_venda) : undefined,
      valorAnterior: row.valor_anterior !== null && row.valor_anterior !== undefined ? Number(row.valor_anterior) : undefined,
      valorLocacao: row.valor_locacao !== null && row.valor_locacao !== undefined ? Number(row.valor_locacao) : undefined,
      valorLocacaoAnterior: row.valor_locacao_anterior !== null && row.valor_locacao_anterior !== undefined ? Number(row.valor_locacao_anterior) : undefined,
      condominio: row.condominio !== null && row.condominio !== undefined ? Number(row.condominio) : undefined,
      iptu: row.iptu !== null && row.iptu !== undefined ? Number(row.iptu) : undefined,
      dormitorios: row.quartos !== null && row.quartos !== undefined ? Number(row.quartos) : 0,
      quartos: row.quartos !== null && row.quartos !== undefined ? Number(row.quartos) : 0,
      banheiros: row.bwc !== null && row.bwc !== undefined ? Number(row.bwc) : 0,
      vagas: row.vagas !== null && row.vagas !== undefined ? Number(row.vagas) : 0,
      metragem: row.area_privativa !== null && row.area_privativa !== undefined ? Number(row.area_privativa) : 0,
      nomeEdificio: row.nome_edificio || undefined,
      titulo: row.titulo || '',
      palavraDestacada: row.palavra_destacada || undefined,
      descricao: row.descricao || '',
      informacoes: row.informacoes || undefined,
      website: (row.website as any) || 'SIM',
      compartilhar: (row.compartilhar as any) || 'SIM',
      visibilidade: (row.visibilidade as any) || 'todos',
      dadosProprietario: row.dados_proprietario || undefined,
      fotos,
      dataCadastro: row.data_cadastro || new Date().toISOString(),
      origem: row.origem || 'Imobishare',
      construtora: row.construtora || undefined,
      telefoneConstrutora: row.telefone_construtora || undefined,
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
      escopo: (row.escopo as any) || 'CARTEIRA'
    };
  }

  // --- GET IMOVEIS (PUBLIC / SEARCH) ---
  public static async getImoveis(filters: any = {}): Promise<{ data: Imovel[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean } | Imovel[]> {
    const page = filters.page ? Math.max(1, Number(filters.page)) : 1;
    const limit = filters.limit ? Math.max(1, Math.min(1000, Number(filters.limit))) : 50;
    const isPaginated = Boolean(filters.paginate || filters.page);

    if (this.isPostgres && this.pool) {
      let conditions: string[] = [];
      let params: any[] = [];
      let pIdx = 1;

      if (filters.cidade && filters.cidade !== 'Todas') {
        const c = filters.cidade.trim().toLowerCase();
        if (c === 'camboriú' || c === 'camboriu') {
          conditions.push(`LOWER(TRIM(cidade)) = $${pIdx++}`);
          params.push('camboriú');
        } else {
          conditions.push(`LOWER(cidade) LIKE LOWER($${pIdx++})`);
          params.push(`%${filters.cidade.trim()}%`);
        }
      }
      if (filters.bairro && filters.bairro !== 'Todos os bairros') {
        conditions.push(`LOWER(bairro) LIKE LOWER($${pIdx++})`);
        params.push(`%${filters.bairro.trim()}%`);
      }
      if (filters.finalidade && filters.finalidade !== 'Todos') {
        const f = filters.finalidade.toLowerCase();
        if (f.includes('compr') || f.includes('venda')) {
          conditions.push(`(LOWER(modalidade) = 'venda' OR LOWER(modalidade) = 'ambos' OR modalidade IS NULL OR TRIM(modalidade) = '')`);
        } else if (f.includes('alug') || f.includes('loca')) {
          conditions.push(`(LOWER(modalidade) = 'locação' OR LOWER(modalidade) = 'ambos' OR LOWER(modalidade) = 'locacao')`);
        }
      }
      if (filters.categoria && filters.categoria !== 'Todos') {
        if (filters.categoria === 'Lançamentos') {
          conditions.push(`(LOWER(status_imovel) LIKE '%planta%' OR LOWER(condicao_imovel) LIKE '%planta%')`);
        } else if (filters.categoria === 'Prontos') {
          conditions.push(`(LOWER(status_imovel) NOT LIKE '%planta%' AND LOWER(condicao_imovel) NOT LIKE '%planta%')`);
        }
      }
      if (filters.tipoImovel && filters.tipoImovel.toLowerCase() !== 'todos') {
        conditions.push(`LOWER(tipo) = LOWER($${pIdx++})`);
        params.push(filters.tipoImovel.trim());
      }
      if (filters.statusImovel) {
        conditions.push(`(LOWER(status_imovel) = LOWER($${pIdx}) OR LOWER(condicao_imovel) = LOWER($${pIdx}))`);
        params.push(filters.statusImovel.trim());
        pIdx++;
      }
      if (filters.construtora) {
        conditions.push(`LOWER(construtora) LIKE LOWER($${pIdx++})`);
        params.push(`%${filters.construtora.trim()}%`);
      }
      if (filters.precoMin !== undefined && !isNaN(filters.precoMin)) {
        conditions.push(`valor_venda >= $${pIdx++}`);
        params.push(filters.precoMin);
      }
      if (filters.precoMax !== undefined && !isNaN(filters.precoMax)) {
        conditions.push(`valor_venda <= $${pIdx++}`);
        params.push(filters.precoMax);
      }
      if (filters.quartos !== undefined && !isNaN(filters.quartos)) {
        conditions.push(`quartos >= $${pIdx++}`);
        params.push(filters.quartos);
      }
      if (filters.banheiros !== undefined && !isNaN(filters.banheiros)) {
        conditions.push(`bwc >= $${pIdx++}`);
        params.push(filters.banheiros);
      }
      if (filters.vagas !== undefined && !isNaN(filters.vagas)) {
        conditions.push(`vagas >= $${pIdx++}`);
        params.push(filters.vagas);
      }
      if (filters.metragemMin !== undefined && !isNaN(filters.metragemMin)) {
        conditions.push(`area_privativa >= $${pIdx++}`);
        params.push(filters.metragemMin);
      }
      if (filters.metragemMax !== undefined && !isNaN(filters.metragemMax)) {
        conditions.push(`area_privativa <= $${pIdx++}`);
        params.push(filters.metragemMax);
      }
      if (filters.busca) {
        const q = `%${filters.busca.trim()}%`;
        conditions.push(`(
          LOWER(titulo) LIKE LOWER($${pIdx}) OR 
          LOWER(descricao) LIKE LOWER($${pIdx}) OR 
          LOWER(bairro) LIKE LOWER($${pIdx}) OR 
          LOWER(cidade) LIKE LOWER($${pIdx}) OR 
          LOWER(nome_edificio) LIKE LOWER($${pIdx}) OR 
          LOWER(codigo) LIKE LOWER($${pIdx}) OR 
          LOWER(codigo_im) LIKE LOWER($${pIdx}) OR 
          LOWER(construtora) LIKE LOWER($${pIdx})
        )`);
        params.push(q);
        pIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countRes = await this.pool.query(`SELECT COUNT(*) as total FROM imoveis ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit) || 1;

      // Select data query
      const offset = (page - 1) * limit;
      const dataRes = await this.pool.query(
        `SELECT * FROM imoveis ${whereClause} ORDER BY data_cadastro DESC NULLS LAST, id DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        [...params, limit, offset]
      );

      const items = dataRes.rows.map(r => this.mapRowToImovel(r, true));

      if (isPaginated) {
        return {
          data: items,
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages
        };
      }
      return items;
    }

    // Local JSON filter
    let filtered = [...this.localData.properties];
    if (filters.cidade) filtered = filtered.filter(p => p.cidade?.toLowerCase().includes(filters.cidade.toLowerCase()));
    if (filters.bairro) filtered = filtered.filter(p => p.bairro?.toLowerCase().includes(filters.bairro.toLowerCase()));
    if (filters.tipoImovel) filtered = filtered.filter(p => p.tipoImovel === filters.tipoImovel);
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      filtered = filtered.filter(p => 
        p.titulo?.toLowerCase().includes(q) ||
        p.descricao?.toLowerCase().includes(q) ||
        p.bairro?.toLowerCase().includes(q) ||
        p.cidade?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = filtered.slice(startIndex, startIndex + limit);

    if (isPaginated) {
      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      };
    }
    return data;
  }

  // --- GET MEUS IMOVEIS ---
  public static async getMeusImoveis(email: string, options: any = {}): Promise<{ data: Imovel[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean } | Imovel[]> {
    const cleanEmail = email.toLowerCase().trim();
    const page = options.page ? Math.max(1, Number(options.page)) : 1;
    const limit = options.limit ? Math.max(1, Math.min(200, Number(options.limit))) : 50;
    const isPaginated = Boolean(options.paginate || options.page);

    if (this.isPostgres && this.pool) {
      const countRes = await this.pool.query(
        'SELECT COUNT(*) as total FROM imoveis WHERE LOWER(corretor_email) = LOWER($1)',
        [cleanEmail]
      );
      const total = parseInt(countRes.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;

      const dataRes = await this.pool.query(
        'SELECT * FROM imoveis WHERE LOWER(corretor_email) = LOWER($1) ORDER BY data_cadastro DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3',
        [cleanEmail, limit, offset]
      );

      const items = dataRes.rows.map(r => this.mapRowToImovel(r, true));

      if (isPaginated) {
        return {
          data: items,
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages
        };
      }
      return items;
    }

    const mine = this.localData.properties.filter(p => p.corretorEmail.toLowerCase().trim() === cleanEmail);
    const total = mine.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const data = mine.slice(startIndex, startIndex + limit);

    if (isPaginated) {
      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      };
    }
    return data;
  }

  // --- MAP MARKERS ---
  public static async getImoveisMapa(filters: any = {}): Promise<any[]> {
    if (this.isPostgres && this.pool) {
      let conditions: string[] = [];
      let params: any[] = [];
      let pIdx = 1;

      if (filters.cidade && filters.cidade !== 'Todas') {
        const c = filters.cidade.trim().toLowerCase();
        if (c === 'camboriú' || c === 'camboriu') {
          conditions.push(`LOWER(TRIM(cidade)) = $${pIdx++}`);
          params.push('camboriú');
        } else {
          conditions.push(`LOWER(cidade) LIKE LOWER($${pIdx++})`);
          params.push(`%${filters.cidade.trim()}%`);
        }
      }
      if (filters.bairro && filters.bairro !== 'Todos os bairros') {
        conditions.push(`LOWER(bairro) LIKE LOWER($${pIdx++})`);
        params.push(`%${filters.bairro.trim()}%`);
      }
      if (filters.finalidade && filters.finalidade !== 'Todos') {
        const f = filters.finalidade.toLowerCase();
        if (f.includes('compr') || f.includes('venda')) {
          conditions.push(`(LOWER(modalidade) = 'venda' OR LOWER(modalidade) = 'ambos' OR modalidade IS NULL OR TRIM(modalidade) = '')`);
        } else if (f.includes('alug') || f.includes('loca')) {
          conditions.push(`(LOWER(modalidade) = 'locação' OR LOWER(modalidade) = 'ambos' OR LOWER(modalidade) = 'locacao')`);
        }
      }
      if (filters.categoria && filters.categoria !== 'Todos') {
        if (filters.categoria === 'Lançamentos') {
          conditions.push(`(LOWER(status_imovel) LIKE '%planta%' OR LOWER(condicao_imovel) LIKE '%planta%')`);
        } else if (filters.categoria === 'Prontos') {
          conditions.push(`(LOWER(status_imovel) NOT LIKE '%planta%' AND LOWER(condicao_imovel) NOT LIKE '%planta%')`);
        }
      }
      if (filters.tipoImovel && filters.tipoImovel.toLowerCase() !== 'todos') {
        conditions.push(`LOWER(tipo) LIKE LOWER($${pIdx++})`);
        params.push(`%${filters.tipoImovel.trim()}%`);
      }
      if (filters.statusImovel && filters.statusImovel.toLowerCase() !== 'todos') {
        conditions.push(`(LOWER(status_imovel) LIKE LOWER($${pIdx}) OR LOWER(condicao_imovel) LIKE LOWER($${pIdx}))`);
        params.push(`%${filters.statusImovel.trim()}%`);
        pIdx++;
      }
      if (filters.construtora && filters.construtora !== 'Todas as construtoras') {
        conditions.push(`LOWER(construtora) LIKE LOWER($${pIdx++})`);
        params.push(`%${filters.construtora.trim()}%`);
      }
      if (filters.precoMin !== undefined && !isNaN(filters.precoMin) && Number(filters.precoMin) > 0) {
        conditions.push(`valor_venda >= $${pIdx++}`);
        params.push(Number(filters.precoMin));
      }
      if (filters.precoMax !== undefined && !isNaN(filters.precoMax) && Number(filters.precoMax) > 0 && Number(filters.precoMax) < 15000000) {
        conditions.push(`valor_venda <= $${pIdx++}`);
        params.push(Number(filters.precoMax));
      }
      if (filters.quartosMin !== undefined && !isNaN(filters.quartosMin) && Number(filters.quartosMin) > 0) {
        conditions.push(`quartos >= $${pIdx++}`);
        params.push(Number(filters.quartosMin));
      }
      if (filters.banheirosMin !== undefined && !isNaN(filters.banheirosMin) && Number(filters.banheirosMin) > 0) {
        conditions.push(`bwc >= $${pIdx++}`);
        params.push(Number(filters.banheirosMin));
      }
      if (filters.vagasMin !== undefined && !isNaN(filters.vagasMin) && Number(filters.vagasMin) > 0) {
        conditions.push(`vagas >= $${pIdx++}`);
        params.push(Number(filters.vagasMin));
      }
      if (filters.metragemMin !== undefined && !isNaN(filters.metragemMin) && Number(filters.metragemMin) > 0) {
        conditions.push(`area_privativa >= $${pIdx++}`);
        params.push(Number(filters.metragemMin));
      }
      if (filters.metragemMax !== undefined && !isNaN(filters.metragemMax) && Number(filters.metragemMax) > 0) {
        conditions.push(`area_privativa <= $${pIdx++}`);
        params.push(Number(filters.metragemMax));
      }
      if (filters.busca && filters.busca.trim()) {
        const q = `%${filters.busca.trim()}%`;
        conditions.push(`(
          LOWER(titulo) LIKE LOWER($${pIdx}) OR 
          LOWER(descricao) LIKE LOWER($${pIdx}) OR 
          LOWER(bairro) LIKE LOWER($${pIdx}) OR 
          LOWER(cidade) LIKE LOWER($${pIdx}) OR 
          LOWER(nome_edificio) LIKE LOWER($${pIdx}) OR 
          LOWER(codigo) LIKE LOWER($${pIdx}) OR 
          LOWER(codigo_im) LIKE LOWER($${pIdx}) OR 
          LOWER(construtora) LIKE LOWER($${pIdx})
        )`);
        params.push(q);
        pIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await this.pool.query(
        `SELECT id, codigo, codigo_im, titulo, valor_venda, valor_locacao, cidade, bairro, latitude, longitude, tipo, status_imovel, condicao_imovel, quartos, bwc, vagas, area_privativa, corretor_email FROM imoveis ${whereClause} LIMIT 1000`,
        params
      );

      return res.rows.map(r => {
        return {
          id: r.id,
          codigo: r.codigo || r.codigo_im,
          titulo: r.titulo,
          valor: Number(r.valor_venda || 0),
          valorLocacao: r.valor_locacao ? Number(r.valor_locacao) : undefined,
          cidade: r.cidade,
          bairro: r.bairro,
          latitude: r.latitude ? Number(r.latitude) : undefined,
          longitude: r.longitude ? Number(r.longitude) : undefined,
          fotos: [], // Marcadores do mapa não utilizam fotos (economiza centenas de MB de memória e evita 502 Bad Gateway)
          tipoImovel: r.tipo,
          statusImovel: r.status_imovel,
          condicaoImovel: r.condicao_imovel,
          dormitorios: Number(r.quartos || 0),
          banheiros: Number(r.bwc || 0),
          vagas: Number(r.vagas || 0),
          metragem: Number(r.area_privativa || 0),
          corretorEmail: r.corretor_email
        };
      });
    }

    let localFiltered = [...this.localData.properties];
    if (filters.cidade && filters.cidade !== 'Todas') {
      const c = filters.cidade.trim().toLowerCase();
      localFiltered = localFiltered.filter(p => (p.cidade || '').toLowerCase().trim() === c || (p.cidade || '').toLowerCase().includes(c));
    }
    if (filters.bairro && filters.bairro !== 'Todos os bairros') {
      const b = filters.bairro.trim().toLowerCase();
      localFiltered = localFiltered.filter(p => (p.bairro || '').toLowerCase().includes(b));
    }
    if (filters.precoMin) {
      localFiltered = localFiltered.filter(p => p.valor >= Number(filters.precoMin));
    }
    if (filters.precoMax) {
      localFiltered = localFiltered.filter(p => p.valor <= Number(filters.precoMax));
    }

    return localFiltered.map(p => ({
      id: p.id,
      codigo: p.codigo || p.codigoIm,
      titulo: p.titulo,
      valor: p.valor,
      valorLocacao: p.valorLocacao,
      cidade: p.cidade,
      bairro: p.bairro,
      latitude: p.latitude,
      longitude: p.longitude,
      fotos: p.fotos.slice(0, 1),
      tipoImovel: p.tipoImovel,
      statusImovel: p.statusImovel,
      condicaoImovel: p.condicaoImovel,
      dormitorios: p.dormitorios,
      banheiros: p.banheiros,
      vagas: p.vagas,
      metragem: p.metragem,
      corretorEmail: p.corretorEmail
    }));
  }

  // --- GET SINGLE IMOVEL BY ID OR CODE ---
  public static async getImovelById(idOrCode: string): Promise<Imovel | null> {
    const clean = idOrCode.trim();
    const cleanLower = clean.toLowerCase();
    const cleanNoPrefix = cleanLower.replace(/^imovel-/, '').replace(/^prop-/, '');

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query(
        'SELECT * FROM imoveis WHERE LOWER(id) = $1 OR LOWER(codigo) = $1 OR LOWER(codigo_im) = $1 OR LOWER(codigo) = $2 OR LOWER(codigo_im) = $2 LIMIT 1',
        [cleanLower, cleanNoPrefix]
      );
      if (res.rows.length === 0) return null;
      return this.mapRowToImovel(res.rows[0]);
    }

    const found = this.localData.properties.find(
      p =>
        (p.id || '').toLowerCase() === cleanLower ||
        (p.codigo || '').toLowerCase() === cleanLower ||
        (p.codigoIm || '').toLowerCase() === cleanLower ||
        (p.codigo || '').toLowerCase() === cleanNoPrefix ||
        (p.codigoIm || '').toLowerCase() === cleanNoPrefix
    );
    return found ? { ...found } : null;
  }

  // --- SAVE IMOVEL (CREATE / UPDATE) ---
  public static async saveImovel(propertyData: any, ownerEmail: string): Promise<Imovel> {
    const cleanEmail = ownerEmail.toLowerCase().trim();
    let imovelId = propertyData.id;

    const isNew = !imovelId;
    if (isNew) {
      imovelId = `imovel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    // Código IM central sequencial se novo
    let codigoIm = propertyData.codigoIm;
    if (!codigoIm) {
      if (this.isPostgres && this.pool) {
        const countRes = await this.pool.query('SELECT COUNT(*) as count FROM imoveis');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
        codigoIm = `IM${nextNum.toString().padStart(6, '0')}`;
      } else {
        codigoIm = `IM${(this.localData.properties.length + 1).toString().padStart(6, '0')}`;
      }
    }

    let codigo = propertyData.codigo || codigoIm;

    const dataCadastro = propertyData.dataCadastro || new Date().toISOString();

    const imovelToSave: Imovel = {
      ...propertyData,
      id: imovelId,
      corretorEmail: propertyData.corretorEmail || cleanEmail,
      codigo,
      codigoIm,
      dataCadastro,
      valor: propertyData.valor !== undefined ? Number(propertyData.valor) : 0,
      valorVenda: propertyData.valorVenda !== undefined ? Number(propertyData.valorVenda) : (propertyData.valor ? Number(propertyData.valor) : undefined),
      valorLocacao: propertyData.valorLocacao ? Number(propertyData.valorLocacao) : undefined,
      condominio: propertyData.condominio ? Number(propertyData.condominio) : undefined,
      iptu: propertyData.iptu ? Number(propertyData.iptu) : undefined,
      dormitorios: propertyData.dormitorios !== undefined ? Number(propertyData.dormitorios) : 0,
      quartos: propertyData.quartos !== undefined ? Number(propertyData.quartos) : (propertyData.dormitorios ? Number(propertyData.dormitorios) : 0),
      banheiros: propertyData.banheiros !== undefined ? Number(propertyData.banheiros) : 0,
      vagas: propertyData.vagas !== undefined ? Number(propertyData.vagas) : 0,
      metragem: propertyData.metragem !== undefined ? Number(propertyData.metragem) : 0,
      fotos: Array.isArray(propertyData.fotos) ? propertyData.fotos : []
    };

    if (this.isPostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO imoveis (
          id, corretor_email, cep, endereco, cidade, bairro, tipo, modalidade,
          valor_venda, valor_locacao, quartos, bwc, vagas, area_privativa,
          nome_edificio, titulo, palavra_destacada, descricao, visibilidade,
          dados_proprietario, imagens, data_cadastro, valor_anterior, valor_locacao_anterior,
          informacoes, status_imovel, origem, construtora, website, compartilhar,
          codigo, latitude, longitude, condominio, iptu, codigo_im, unidade, bloco_torre,
          condicao_imovel, status_global, escopo, telefone_construtora
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
          $39, $40, $41, $42
        )
        ON CONFLICT (id) DO UPDATE SET
          corretor_email = EXCLUDED.corretor_email,
          cep = EXCLUDED.cep,
          endereco = EXCLUDED.endereco,
          cidade = EXCLUDED.cidade,
          bairro = EXCLUDED.bairro,
          tipo = EXCLUDED.tipo,
          modalidade = EXCLUDED.modalidade,
          valor_venda = EXCLUDED.valor_venda,
          valor_locacao = EXCLUDED.valor_locacao,
          quartos = EXCLUDED.quartos,
          bwc = EXCLUDED.bwc,
          vagas = EXCLUDED.vagas,
          area_privativa = EXCLUDED.area_privativa,
          nome_edificio = EXCLUDED.nome_edificio,
          titulo = EXCLUDED.titulo,
          palavra_destacada = EXCLUDED.palavra_destacada,
          descricao = EXCLUDED.descricao,
          visibilidade = EXCLUDED.visibilidade,
          dados_proprietario = EXCLUDED.dados_proprietario,
          imagens = EXCLUDED.imagens,
          valor_anterior = EXCLUDED.valor_anterior,
          valor_locacao_anterior = EXCLUDED.valor_locacao_anterior,
          informacoes = EXCLUDED.informacoes,
          status_imovel = EXCLUDED.status_imovel,
          origem = EXCLUDED.origem,
          construtora = EXCLUDED.construtora,
          website = EXCLUDED.website,
          compartilhar = EXCLUDED.compartilhar,
          codigo = EXCLUDED.codigo,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          condominio = EXCLUDED.condominio,
          iptu = EXCLUDED.iptu,
          codigo_im = EXCLUDED.codigo_im,
          unidade = EXCLUDED.unidade,
          bloco_torre = EXCLUDED.bloco_torre,
          condicao_imovel = EXCLUDED.condicao_imovel,
          status_global = EXCLUDED.status_global,
          escopo = EXCLUDED.escopo,
          telefone_construtora = EXCLUDED.telefone_construtora`,
        [
          imovelToSave.id,
          imovelToSave.corretorEmail,
          imovelToSave.cep || null,
          imovelToSave.endereco || imovelToSave.localizacao || null,
          imovelToSave.cidade || 'Balneário Camboriú',
          imovelToSave.bairro || '',
          imovelToSave.tipoImovel || 'Apartamento',
          imovelToSave.tipo || 'venda',
          imovelToSave.valor || null,
          imovelToSave.valorLocacao || null,
          imovelToSave.dormitorios || 0,
          imovelToSave.banheiros || 0,
          imovelToSave.vagas || 0,
          imovelToSave.metragem || null,
          imovelToSave.nomeEdificio || null,
          imovelToSave.titulo || '',
          imovelToSave.palavraDestacada || null,
          imovelToSave.descricao || '',
          imovelToSave.visibilidade || 'todos',
          imovelToSave.dadosProprietario || null,
          JSON.stringify(imovelToSave.fotos || []),
          imovelToSave.dataCadastro,
          imovelToSave.valorAnterior || null,
          imovelToSave.valorLocacaoAnterior || null,
          imovelToSave.informacoes || null,
          imovelToSave.statusImovel || 'Na Planta',
          imovelToSave.origem || 'Imobishare',
          imovelToSave.construtora || null,
          imovelToSave.website || 'SIM',
          imovelToSave.compartilhar || 'SIM',
          imovelToSave.codigo || null,
          imovelToSave.latitude || null,
          imovelToSave.longitude || null,
          imovelToSave.condominio || null,
          imovelToSave.iptu || null,
          imovelToSave.codigoIm || null,
          imovelToSave.unidade || null,
          imovelToSave.bloco || null,
          imovelToSave.condicaoImovel || 'Na Planta',
          imovelToSave.statusComercial || 'Disponível',
          imovelToSave.escopo || 'CARTEIRA',
          imovelToSave.telefoneConstrutora || null
        ]
      );
      return imovelToSave;
    }

    const idx = this.localData.properties.findIndex(p => p.id === imovelToSave.id);
    if (idx >= 0) {
      this.localData.properties[idx] = imovelToSave;
    } else {
      this.localData.properties.unshift(imovelToSave);
    }
    await this.saveLocalJson();
    return imovelToSave;
  }

  // --- DELETE IMOVEL ---
  public static async deleteImovel(id: string, userEmail: string): Promise<void> {
    const cleanEmail = userEmail.toLowerCase().trim();
    const isAdmin = cleanEmail === 'afreccia@gmail.com';

    if (this.isPostgres && this.pool) {
      if (isAdmin) {
        await this.pool.query('DELETE FROM imoveis WHERE id = $1', [id]);
      } else {
        const res = await this.pool.query('DELETE FROM imoveis WHERE id = $1 AND LOWER(corretor_email) = LOWER($2)', [id, cleanEmail]);
        if (res.rowCount === 0) {
          throw new Error('Imóvel não encontrado ou você não tem permissão para excluí-lo.');
        }
      }
      return;
    }

    const idx = this.localData.properties.findIndex(p => p.id === id);
    if (idx < 0) throw new Error('Imóvel não encontrado.');
    if (!isAdmin && this.localData.properties[idx].corretorEmail.toLowerCase().trim() !== cleanEmail) {
      throw new Error('Você não tem permissão para excluir este imóvel.');
    }
    this.localData.properties.splice(idx, 1);
    await this.saveLocalJson();
  }

  // --- PARCERIAS ---
  public static async getPartners(email: string): Promise<any[]> {
    const clean = email.toLowerCase().trim();
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query(`
        SELECT c.* 
        FROM corretores c
        INNER JOIN parcerias p ON LOWER(c.email) = LOWER(p.corretor_parceiro_email)
        WHERE LOWER(p.corretor_email) = LOWER($1)
        ORDER BY c.nome ASC
      `, [clean]);
      return res.rows.map(r => this.mapRowToCorretor(r));
    }

    const partnerEmails = this.localData.partnerships
      .filter(p => p.corretorEmail.toLowerCase().trim() === clean)
      .map(p => p.corretorParceiroEmail.toLowerCase().trim());
    return this.localData.brokers.filter(b => partnerEmails.includes(b.email.toLowerCase().trim()));
  }

  public static async addPartner(email: string, partnerEmail: string): Promise<any[]> {
    const cleanUser = email.toLowerCase().trim();
    const cleanPartner = partnerEmail.toLowerCase().trim();

    if (this.isPostgres && this.pool) {
      await this.pool.query(`
        INSERT INTO parcerias (corretor_email, corretor_parceiro_email)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [cleanUser, cleanPartner]);
      return await this.getPartners(cleanUser);
    }

    const exists = this.localData.partnerships.some(p => 
      p.corretorEmail.toLowerCase().trim() === cleanUser && 
      p.corretorParceiroEmail.toLowerCase().trim() === cleanPartner
    );
    if (!exists) {
      this.localData.partnerships.push({ corretorEmail: cleanUser, corretorParceiroEmail: cleanPartner });
      await this.saveLocalJson();
    }
    return await this.getPartners(cleanUser);
  }

  public static async removePartner(email: string, partnerEmail: string): Promise<any[]> {
    const cleanUser = email.toLowerCase().trim();
    const cleanPartner = partnerEmail.toLowerCase().trim();

    if (this.isPostgres && this.pool) {
      await this.pool.query(`
        DELETE FROM parcerias
        WHERE LOWER(corretor_email) = LOWER($1) AND LOWER(corretor_parceiro_email) = LOWER($2)
      `, [cleanUser, cleanPartner]);
      return await this.getPartners(cleanUser);
    }

    this.localData.partnerships = this.localData.partnerships.filter(p => 
      !(p.corretorEmail.toLowerCase().trim() === cleanUser && p.corretorParceiroEmail.toLowerCase().trim() === cleanPartner)
    );
    await this.saveLocalJson();
    return await this.getPartners(cleanUser);
  }

  // --- FAVORITOS ---
  public static async getFavorites(email: string): Promise<string[]> {
    const clean = email.toLowerCase().trim();
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query(
        'SELECT imovel_id FROM favoritos WHERE LOWER(corretor_email) = LOWER($1)',
        [clean]
      );
      return res.rows.map(r => r.imovel_id);
    }

    return this.localData.favorites
      .filter(f => f.corretorEmail.toLowerCase().trim() === clean)
      .map(f => f.imovelId);
  }

  public static async toggleFavorite(email: string, imovelId: string): Promise<string[]> {
    const clean = email.toLowerCase().trim();
    const id = imovelId.trim();

    if (this.isPostgres && this.pool) {
      const check = await this.pool.query(
        'SELECT * FROM favoritos WHERE LOWER(corretor_email) = LOWER($1) AND imovel_id = $2',
        [clean, id]
      );
      if (check.rows.length > 0) {
        await this.pool.query(
          'DELETE FROM favoritos WHERE LOWER(corretor_email) = LOWER($1) AND imovel_id = $2',
          [clean, id]
        );
      } else {
        await this.pool.query(
          'INSERT INTO favoritos (corretor_email, imovel_id) VALUES ($1, $2)',
          [clean, id]
        );
      }
      return await this.getFavorites(clean);
    }

    const idx = this.localData.favorites.findIndex(f => 
      f.corretorEmail.toLowerCase().trim() === clean && f.imovelId === id
    );
    if (idx >= 0) {
      this.localData.favorites.splice(idx, 1);
    } else {
      this.localData.favorites.push({ corretorEmail: clean, imovelId: id });
    }
    await this.saveLocalJson();
    return await this.getFavorites(clean);
  }
}
