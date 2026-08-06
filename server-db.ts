/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Imovel, Corretor } from './src/types';

interface DbSchema {
  brokers: Corretor[];
  properties: Imovel[];
  partnerships: { corretorEmail: string; corretorParceiroEmail: string }[];
  favorites: { corretorEmail: string; imovelId: string }[];
}

// In-memory log store for recent backend errors
export const recentErrorLogs: Array<{ timestamp: string; route: string; error: string }> = [];

export function logBackendError(route: string, error: any) {
  const message = error?.message || String(error);
  console.error(`❌ [BACKEND ERROR] [${route}]:`, message);
  recentErrorLogs.unshift({
    timestamp: new Date().toISOString(),
    route,
    error: message,
  });
  if (recentErrorLogs.length > 50) {
    recentErrorLogs.pop();
  }
}

export class ServerDb {
  private static pool: pg.Pool | null = null;
  private static isPostgres = false;
  private static jsonPath = path.resolve(process.cwd(), 'imobishare_db.json');

  static async init(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      console.log('🔌 Conectando ao banco de dados PostgreSQL...');
      try {
        this.pool = new pg.Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
        });
        await this.pool.query('SELECT NOW()');
        this.isPostgres = true;
        console.log('✅ Conectado ao PostgreSQL com sucesso!');
        await this.createTables();
        await this.seedInitialAdminIfNeeded();
      } catch (err: any) {
        logBackendError('ServerDb.init', err);
        console.error('⚠️ Falha ao conectar ao PostgreSQL. Ativando fallback JSON DB:', err?.message);
        this.isPostgres = false;
        await this.initJsonDb();
      }
    } else {
      console.log('📂 Sem DATABASE_URL definida. Utilizando banco de dados JSON persistente...');
      this.isPostgres = false;
      await this.initJsonDb();
    }
  }

  private static async createTables(): Promise<void> {
    if (!this.pool) return;

    // 1. Tabela corretores
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS corretores (
        email VARCHAR(255) PRIMARY KEY,
        id VARCHAR(100),
        nome VARCHAR(255) NOT NULL,
        creci VARCHAR(100),
        telefone VARCHAR(100),
        cidade VARCHAR(255),
        estado VARCHAR(100),
        imobiliaria_ou_autonomo VARCHAR(100),
        foto_url TEXT,
        slug_site VARCHAR(255) UNIQUE,
        is_admin BOOLEAN DEFAULT false,
        restringir_parceiros BOOLEAN DEFAULT false,
        parceiros_emails TEXT DEFAULT '[]',
        password TEXT
      );
    `);

    // Ensure columns exist on legacy tables
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS slug_site VARCHAR(255);`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS imobiliaria_ou_autonomo VARCHAR(100);`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS restringir_parceiros BOOLEAN DEFAULT false;`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS parceiros_emails TEXT DEFAULT '[]';`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS password TEXT;`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS reset_token TEXT;`);
    await this.pool.query(`ALTER TABLE corretores ADD COLUMN IF NOT EXISTS reset_token_expires BIGINT;`);

    // 2. Tabela imoveis
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS imoveis (
        id VARCHAR(100) PRIMARY KEY,
        corretor_email VARCHAR(255) NOT NULL REFERENCES corretores(email) ON DELETE CASCADE,
        cep VARCHAR(20),
        endereco TEXT,
        cidade VARCHAR(100) NOT NULL,
        bairro VARCHAR(100) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        modalidade VARCHAR(50) NOT NULL,
        valor_venda NUMERIC,
        status_imovel TEXT,
        valor_locacao NUMERIC,
        quartos INTEGER DEFAULT 0,
        bwc INTEGER DEFAULT 0,
        vagas INTEGER DEFAULT 0,
        area_privativa NUMERIC DEFAULT 0,
        nome_edificio VARCHAR(255),
        titulo VARCHAR(255) NOT NULL,
        palavra_destacada VARCHAR(20),
        descricao TEXT NOT NULL,
        visibilidade VARCHAR(50) DEFAULT 'todos',
        dados_proprietario TEXT,
        imagens TEXT NOT NULL,
        data_cadastro VARCHAR(100) NOT NULL,
        origem VARCHAR(100) DEFAULT 'Imobishare',
        construtora VARCHAR(255)
      );
    `);

    // Ensure columns on imoveis
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS palavra_destacada VARCHAR(20);`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS status_imovel TEXT;`);
    await this.pool.query(`ALTER TABLE imoveis DROP COLUMN IF EXISTS valor_venda_com_desconto;`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS visibilidade VARCHAR(50) DEFAULT 'todos';`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS valor_anterior NUMERIC;`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS valor_locacao_anterior NUMERIC;`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS informacoes TEXT;`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS origem VARCHAR(100) DEFAULT 'Imobishare';`);
    await this.pool.query(`ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS construtora VARCHAR(255);`);

    // 3. Tabela parcerias
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS parcerias (
        corretor_email VARCHAR(255) NOT NULL,
        corretor_parceiro_email VARCHAR(255) NOT NULL,
        PRIMARY KEY (corretor_email, corretor_parceiro_email)
      );
    `);

    // 4. Tabela favoritos
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS favoritos (
        corretor_email VARCHAR(255) NOT NULL,
        imovel_id VARCHAR(100) NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
        PRIMARY KEY (corretor_email, imovel_id)
      );
    `);

    console.log('✅ Tabelas do PostgreSQL verificadas.');
  }

  private static async seedInitialAdminIfNeeded(): Promise<void> {
    if (!this.pool) return;
    try {
      // Ensure default admin account exists or is_admin flag is set for afreccia@gmail.com
      const adminEmail = 'afreccia@gmail.com';
      await this.pool.query(`
        INSERT INTO corretores (email, id, nome, creci, telefone, cidade, estado, is_admin)
        VALUES ($1, 'broker-afreccia', 'Alexandre Freccia', '12345-F', '(47) 99999-9999', 'Balneário Camboriú', 'SC', true)
        ON CONFLICT (email) DO UPDATE SET is_admin = true;
      `, [adminEmail]);
    } catch (e) {
      // ignore
    }
  }

  private static async initJsonDb(): Promise<void> {
    try {
      await fs.access(this.jsonPath);
    } catch {
      const defaultDb: DbSchema = {
        brokers: [
          {
            id: 'broker-afreccia',
            nome: 'Alexandre Freccia',
            email: 'afreccia@gmail.com',
            creci: '12345-F',
            telefone: '(47) 99999-9999',
            whatsapp: '(47) 99999-9999',
            cidade: 'Balneário Camboriú',
            estado: 'SC',
            imobiliaria: 'ImobiShare',
            foto: '',
            isAdmin: true,
            slugSite: 'alexandre-freccia'
          }
        ],
        properties: [],
        partnerships: [],
        favorites: []
      };
      await fs.writeFile(this.jsonPath, JSON.stringify(defaultDb, null, 2), 'utf-8');
    }
  }

  private static async readJson(): Promise<DbSchema> {
    try {
      const data = await fs.readFile(this.jsonPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      await this.initJsonDb();
      const data = await fs.readFile(this.jsonPath, 'utf-8');
      return JSON.parse(data);
    }
  }

  private static async writeJson(db: DbSchema): Promise<void> {
    await fs.writeFile(this.jsonPath, JSON.stringify(db, null, 2), 'utf-8');
  }

  // --- CORRETORES ---

  static async getAllCorretores(): Promise<Corretor[]> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores');
      return res.rows.map(r => ({
        id: r.id || `broker-${r.email.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`,
        email: r.email,
        nome: r.nome,
        creci: r.creci || '',
        telefone: r.telefone || '',
        whatsapp: r.telefone || '',
        cidade: r.cidade || '',
        estado: r.estado || '',
        imobiliaria: r.imobiliaria_ou_autonomo || '',
        tipoAtuacao: r.imobiliaria_ou_autonomo === 'autonomo' ? 'autonomo' : 'imobiliaria',
        foto: r.foto_url || '',
        slugSite: r.slug_site || '',
        isAdmin: Boolean(r.is_admin),
        restringirParceiros: Boolean(r.restringir_parceiros),
        parceirosEmails: Array.isArray(r.parceiros_emails) ? r.parceiros_emails : (r.parceiros_emails ? JSON.parse(r.parceiros_emails) : [])
      }));
    } else {
      const db = await this.readJson();
      return db.brokers || [];
    }
  }

  static async hashPassword(password: string): Promise<string> {
    if (!password) return '';
    if (password.startsWith('$2a$') || password.startsWith('$2b$')) return password;
    return await bcrypt.hash(password, 10);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || !password) return false;
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      return await bcrypt.compare(password, hash);
    }
    // Fallback for plain text legacy passwords
    return password === hash;
  }

  static async getCorretorByPhone(phone: string): Promise<Corretor | null> {
    const targetDigits = phone ? phone.replace(/\D/g, '') : '';
    if (!targetDigits || targetDigits.length < 8) return null;

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores WHERE telefone IS NOT NULL AND telefone <> \'\'');
      for (const r of res.rows) {
        const dbDigits = (r.telefone || '').replace(/\D/g, '');
        if (dbDigits && (dbDigits === targetDigits || (dbDigits.length >= 8 && targetDigits.length >= 8 && (dbDigits.endsWith(targetDigits) || targetDigits.endsWith(dbDigits))))) {
          return {
            id: r.id || `broker-${r.email.replace(/[^a-z0-9]/gi, '_')}`,
            email: r.email,
            nome: r.nome,
            creci: r.creci || '',
            telefone: r.telefone || '',
            whatsapp: r.telefone || '',
            cidade: r.cidade || '',
            estado: r.estado || '',
            imobiliaria: r.imobiliaria_ou_autonomo || '',
            tipoAtuacao: r.imobiliaria_ou_autonomo === 'autonomo' ? 'autonomo' : 'imobiliaria',
            foto: r.foto_url || '',
            slugSite: r.slug_site || '',
            isAdmin: Boolean(r.is_admin) || (r.email && r.email.toLowerCase().trim() === 'afreccia@gmail.com'),
            password: r.password || '',
            restringirParceiros: Boolean(r.restringir_parceiros),
            parceirosEmails: Array.isArray(r.parceiros_emails) ? r.parceiros_emails : (r.parceiros_emails ? JSON.parse(r.parceiros_emails) : [])
          };
        }
      }
      return null;
    } else {
      const db = await this.readJson();
      const found = (db.brokers || []).find(b => {
        const dbDigits = (b.telefone || b.whatsapp || '').replace(/\D/g, '');
        return dbDigits && (dbDigits === targetDigits || (dbDigits.length >= 8 && targetDigits.length >= 8 && (dbDigits.endsWith(targetDigits) || targetDigits.endsWith(dbDigits))));
      });
      return found || null;
    }
  }

  static async getCorretorByEmail(email: string): Promise<Corretor | null> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return null;

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM corretores WHERE LOWER(email) = $1', [cleanEmail]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id || `broker-${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
        email: r.email,
        nome: r.nome,
        creci: r.creci || '',
        telefone: r.telefone || '',
        whatsapp: r.telefone || '',
        cidade: r.cidade || '',
        estado: r.estado || '',
        imobiliaria: r.imobiliaria_ou_autonomo || '',
        tipoAtuacao: r.imobiliaria_ou_autonomo === 'autonomo' ? 'autonomo' : 'imobiliaria',
        foto: r.foto_url || '',
        slugSite: r.slug_site || '',
        isAdmin: Boolean(r.is_admin) || (cleanEmail === 'afreccia@gmail.com'),
        password: r.password || '',
        resetToken: r.reset_token || undefined,
        resetTokenExpires: r.reset_token_expires ? Number(r.reset_token_expires) : undefined,
        restringirParceiros: Boolean(r.restringir_parceiros),
        parceirosEmails: Array.isArray(r.parceiros_emails) ? r.parceiros_emails : (r.parceiros_emails ? JSON.parse(r.parceiros_emails) : [])
      };
    } else {
      const db = await this.readJson();
      const found = db.brokers.find(b => b.email && b.email.toLowerCase().trim() === cleanEmail);
      return found || null;
    }
  }

  static async saveCorretor(corretor: Partial<Corretor> & { email: string }): Promise<Corretor> {
    const cleanEmail = corretor.email.toLowerCase().trim();
    const cleanNome = corretor.nome || cleanEmail.split('@')[0];

    let passwordHash = corretor.password || '';
    if (passwordHash && !passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$')) {
      passwordHash = await this.hashPassword(passwordHash);
    }

    if (this.isPostgres && this.pool) {
      await this.pool.query(`
        INSERT INTO corretores (email, id, nome, creci, telefone, cidade, estado, imobiliaria_ou_autonomo, foto_url, slug_site, is_admin, restringir_parceiros, parceiros_emails, password, reset_token, reset_token_expires)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (email) DO UPDATE SET
          nome = EXCLUDED.nome,
          creci = COALESCE(NULLIF(EXCLUDED.creci, ''), corretores.creci),
          telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), corretores.telefone),
          cidade = COALESCE(NULLIF(EXCLUDED.cidade, ''), corretores.cidade),
          estado = COALESCE(NULLIF(EXCLUDED.estado, ''), corretores.estado),
          imobiliaria_ou_autonomo = COALESCE(NULLIF(EXCLUDED.imobiliaria_ou_autonomo, ''), corretores.imobiliaria_ou_autonomo),
          foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), corretores.foto_url),
          slug_site = COALESCE(NULLIF(EXCLUDED.slug_site, ''), corretores.slug_site),
          is_admin = COALESCE(EXCLUDED.is_admin, corretores.is_admin),
          restringir_parceiros = EXCLUDED.restringir_parceiros,
          parceiros_emails = EXCLUDED.parceiros_emails,
          password = COALESCE(NULLIF(EXCLUDED.password, ''), corretores.password),
          reset_token = EXCLUDED.reset_token,
          reset_token_expires = EXCLUDED.reset_token_expires;
      `, [
        cleanEmail,
        corretor.id || `broker-${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
        cleanNome,
        corretor.creci || '',
        corretor.whatsapp || corretor.telefone || '',
        corretor.cidade || '',
        corretor.estado || '',
        corretor.imobiliaria || corretor.tipoAtuacao || '',
        corretor.foto || '',
        corretor.slugSite || null,
        Boolean(corretor.isAdmin),
        Boolean(corretor.restringirParceiros),
        JSON.stringify(corretor.parceirosEmails || []),
        passwordHash,
        corretor.resetToken || null,
        corretor.resetTokenExpires || null
      ]);

      const saved = await this.getCorretorByEmail(cleanEmail);
      return saved!;
    } else {
      const db = await this.readJson();
      let idx = db.brokers.findIndex(b => b.email && b.email.toLowerCase().trim() === cleanEmail);
      const updatedBroker: Corretor = {
        id: corretor.id || (idx >= 0 ? db.brokers[idx].id : `broker-${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`),
        email: cleanEmail,
        nome: cleanNome,
        creci: corretor.creci || (idx >= 0 ? db.brokers[idx].creci : ''),
        telefone: corretor.whatsapp || corretor.telefone || (idx >= 0 ? db.brokers[idx].telefone : ''),
        whatsapp: corretor.whatsapp || corretor.telefone || (idx >= 0 ? db.brokers[idx].whatsapp : ''),
        cidade: corretor.cidade || (idx >= 0 ? db.brokers[idx].cidade : ''),
        estado: corretor.estado || (idx >= 0 ? db.brokers[idx].estado : ''),
        imobiliaria: corretor.imobiliaria || (idx >= 0 ? db.brokers[idx].imobiliaria : ''),
        foto: corretor.foto || (idx >= 0 ? db.brokers[idx].foto : ''),
        slugSite: corretor.slugSite || (idx >= 0 ? db.brokers[idx].slugSite : ''),
        isAdmin: corretor.isAdmin !== undefined ? corretor.isAdmin : (idx >= 0 ? db.brokers[idx].isAdmin : cleanEmail === 'afreccia@gmail.com'),
        password: passwordHash || (idx >= 0 ? db.brokers[idx].password : ''),
        resetToken: corretor.resetToken !== undefined ? corretor.resetToken : (idx >= 0 ? db.brokers[idx].resetToken : undefined),
        resetTokenExpires: corretor.resetTokenExpires !== undefined ? corretor.resetTokenExpires : (idx >= 0 ? db.brokers[idx].resetTokenExpires : undefined),
        restringirParceiros: corretor.restringirParceiros !== undefined ? corretor.restringirParceiros : (idx >= 0 ? db.brokers[idx].restringirParceiros : false),
        parceirosEmails: corretor.parceirosEmails !== undefined ? corretor.parceirosEmails : (idx >= 0 ? db.brokers[idx].parceirosEmails : [])
      };

      if (idx >= 0) {
        db.brokers[idx] = updatedBroker;
      } else {
        db.brokers.push(updatedBroker);
      }
      await this.writeJson(db);
      return updatedBroker;
    }
  }

  // --- IMOVEIS ---

  static async getImoveis(userEmail?: string): Promise<Imovel[]> {
    const cleanUserEmail = userEmail ? userEmail.toLowerCase().trim() : '';

    if (this.isPostgres && this.pool) {
      let query = `
        SELECT i.*, c.nome as corretor_nome_db, c.foto_url as corretor_foto_db, c.telefone as corretor_telefone_db
        FROM imoveis i
        LEFT JOIN corretores c ON LOWER(i.corretor_email) = LOWER(c.email)
      `;
      const params: any[] = [];

      if (cleanUserEmail) {
        query += `
          WHERE i.visibilidade = 'todos'
             OR LOWER(i.corretor_email) = $1
             OR (
               i.visibilidade = 'grupo_especifico' 
               AND LOWER(i.corretor_email) IN (
                 SELECT LOWER(corretor_email) 
                 FROM parcerias 
                 WHERE LOWER(corretor_parceiro_email) = $1
               )
             )
        `;
        params.push(cleanUserEmail);
      } else {
        query += ` WHERE i.visibilidade = 'todos' `;
      }

      query += ` ORDER BY i.data_cadastro DESC `;

      const res = await this.pool.query(query, params);
      return res.rows.map(r => this.mapPostgresRowToImovel(r, cleanUserEmail));
    } else {
      const db = await this.readJson();
      const partnerEmails = cleanUserEmail 
        ? db.partnerships.filter(p => p.corretorParceiroEmail.toLowerCase().trim() === cleanUserEmail).map(p => p.corretorEmail.toLowerCase().trim())
        : [];

      const filtered = db.properties.filter(p => {
        const propEmail = (p.corretorEmail || '').toLowerCase().trim();
        if (p.visibilidade === 'todos' || !p.visibilidade) return true;
        if (cleanUserEmail && propEmail === cleanUserEmail) return true;
        if (p.visibilidade === 'grupo_especifico' && partnerEmails.includes(propEmail)) return true;
        return false;
      });

      return filtered.map(p => {
        const isOwner = cleanUserEmail && (p.corretorEmail || '').toLowerCase().trim() === cleanUserEmail;
        return {
          ...p,
          corretorId: p.corretorId || `broker-${(p.corretorEmail || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          compartilhar: p.compartilhar !== false,
          dadosProprietario: isOwner ? p.dadosProprietario : undefined,
          nomeProprietario: isOwner ? p.nomeProprietario : 'Confidencial',
          telefoneProprietario: isOwner ? p.telefoneProprietario : 'Confidencial'
        };
      });
    }
  }

  static async getMeusImoveis(tokenEmail: string): Promise<Imovel[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    if (!cleanEmail) return [];

    if (this.isPostgres && this.pool) {
      const query = `
        SELECT i.*, c.nome as corretor_nome_db
        FROM imoveis i
        LEFT JOIN corretores c ON LOWER(i.corretor_email) = LOWER(c.email)
        WHERE LOWER(i.corretor_email) = $1
        ORDER BY i.data_cadastro DESC
      `;
      const res = await this.pool.query(query, [cleanEmail]);
      return res.rows.map(r => this.mapPostgresRowToImovel(r, cleanEmail, true));
    } else {
      const db = await this.readJson();
      return db.properties.filter(p => (p.corretorEmail || '').toLowerCase().trim() === cleanEmail);
    }
  }

  static async getImovelById(id: string): Promise<Imovel | null> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM imoveis WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      return this.mapPostgresRowToImovel(res.rows[0], '', true);
    } else {
      const db = await this.readJson();
      return db.properties.find(p => p.id === id) || null;
    }
  }

  static async saveImovel(imovel: Imovel, tokenEmail: string): Promise<Imovel> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    if (!cleanEmail) throw new Error('Token de e-mail é obrigatório para salvar imóvel.');

    // Guarantee corretor exists in DB
    let broker = await this.getCorretorByEmail(cleanEmail);
    if (!broker) {
      broker = await this.saveCorretor({ email: cleanEmail, nome: cleanEmail.split('@')[0] });
    }

    const finalImovel: Imovel = {
      ...imovel,
      corretorEmail: cleanEmail,
      corretorNome: broker.nome || cleanEmail.split('@')[0],
      corretorId: broker.id,
      origem: imovel.origem || 'Imobishare',
      construtora: imovel.construtora || '',
      fotos: Array.isArray(imovel.fotos) ? imovel.fotos.slice(0, 15) : [],
      dataCadastro: imovel.dataCadastro || new Date().toISOString()
    };

    if (this.isPostgres && this.pool) {
      const fotosJson = JSON.stringify(finalImovel.fotos);
      const valorVenda = finalImovel.valorVenda || finalImovel.valor || 0;
      const modalidade = finalImovel.valorLocacao && valorVenda ? 'ambos' : (finalImovel.valorLocacao ? 'locação' : 'venda');

      await this.pool.query(`
        INSERT INTO imoveis (
          id, corretor_email, cep, endereco, cidade, bairro, tipo, modalidade,
          valor_venda, status_imovel, valor_locacao, quartos, bwc, vagas,
          area_privativa, nome_edificio, titulo, palavra_destacada, descricao,
          visibilidade, dados_proprietario, imagens, data_cadastro,
          valor_anterior, valor_locacao_anterior, informacoes, origem, construtora
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27, $28
        ) ON CONFLICT (id) DO UPDATE SET
          cep = EXCLUDED.cep,
          endereco = EXCLUDED.endereco,
          cidade = EXCLUDED.cidade,
          bairro = EXCLUDED.bairro,
          tipo = EXCLUDED.tipo,
          modalidade = EXCLUDED.modalidade,
          valor_venda = EXCLUDED.valor_venda,
          status_imovel = EXCLUDED.status_imovel,
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
          origem = EXCLUDED.origem,
          construtora = EXCLUDED.construtora;
      `, [
        finalImovel.id,
        cleanEmail,
        finalImovel.cep || '',
        finalImovel.endereco || finalImovel.localizacao || '',
        finalImovel.cidade,
        finalImovel.bairro,
        finalImovel.tipoImovel,
        modalidade,
        valorVenda,
        finalImovel.statusImovel || null,
        finalImovel.valorLocacao || null,
        finalImovel.dormitorios || finalImovel.quartos || 0,
        finalImovel.banheiros || 0,
        finalImovel.vagas || 0,
        finalImovel.metragem || 0,
        finalImovel.nomeEdificio || '',
        finalImovel.titulo,
        (finalImovel.palavraDestacada || '').substring(0, 20),
        finalImovel.descricao,
        finalImovel.visibilidade || 'todos',
        finalImovel.dadosProprietario || finalImovel.nomeProprietario || '',
        fotosJson,
        finalImovel.dataCadastro,
        finalImovel.valorAnterior || null,
        finalImovel.valorLocacaoAnterior || null,
        finalImovel.informacoes || null,
        finalImovel.origem || 'Imobishare',
        finalImovel.construtora || ''
      ]);

      return finalImovel;
    } else {
      const db = await this.readJson();
      const idx = db.properties.findIndex(p => p.id === finalImovel.id);
      if (idx >= 0) {
        db.properties[idx] = finalImovel;
      } else {
        db.properties.unshift(finalImovel);
      }
      await this.writeJson(db);
      return finalImovel;
    }
  }

  static async deleteImovel(id: string, tokenEmail: string): Promise<boolean> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    const existing = await this.getImovelById(id);
    if (!existing) return false;
    if (existing.corretorEmail.toLowerCase().trim() !== cleanEmail) {
      throw new Error('Permissão negada: você não é o dono deste imóvel.');
    }

    if (this.isPostgres && this.pool) {
      await this.pool.query('DELETE FROM imoveis WHERE id = $1 AND LOWER(corretor_email) = $2', [id, cleanEmail]);
      return true;
    } else {
      const db = await this.readJson();
      db.properties = db.properties.filter(p => !(p.id === id && (p.corretorEmail || '').toLowerCase().trim() === cleanEmail));
      await this.writeJson(db);
      return true;
    }
  }

  // Helper for PostgreSQL row conversion
  private static mapPostgresRowToImovel(r: any, cleanUserEmail: string, forceIncludeOwnerData = false): Imovel {
    const isOwner = forceIncludeOwnerData || (cleanUserEmail && r.corretor_email && r.corretor_email.toLowerCase().trim() === cleanUserEmail);
    const emailClean = (r.corretor_email || '').toLowerCase().trim();
    const isShared = r.visibilidade !== 'exclusivo' && r.visibilidade !== 'privado';

    let fotosArr: string[] = [];
    try {
      if (r.imagens) {
        fotosArr = typeof r.imagens === 'string' ? JSON.parse(r.imagens) : r.imagens;
      }
    } catch {
      fotosArr = r.imagens ? r.imagens.split(',') : [];
    }

    const valorVenda = r.valor_venda ? parseFloat(r.valor_venda) : 0;
    const valorLocacao = r.valor_locacao ? parseFloat(r.valor_locacao) : undefined;

    return {
      id: r.id,
      corretorId: r.corretor_id || `broker-${emailClean.replace(/[^a-z0-9]/g, '_')}`,
      corretorEmail: r.corretor_email,
      corretorNome: r.corretor_nome_db || (emailClean ? emailClean.split('@')[0] : 'Corretor'),
      compartilhar: isShared,
      cep: r.cep || '',
      endereco: r.endereco || '',
      localizacao: r.endereco || `${r.bairro}, ${r.cidade}`,
      cidade: r.cidade,
      bairro: r.bairro,
      tipoImovel: r.tipo || 'Apartamento',
      statusImovel: r.status_imovel || undefined,
      tipo: r.modalidade || (valorLocacao && valorVenda ? 'ambos' : (valorLocacao ? 'locação' : 'venda')),
      valor: valorVenda,
      valorVenda,
      valorAnterior: r.valor_anterior ? parseFloat(r.valor_anterior) : undefined,
      valorLocacao,
      valorLocacaoAnterior: r.valor_locacao_anterior ? parseFloat(r.valor_locacao_anterior) : undefined,
      dormitorios: parseInt(r.quartos || '0', 10),
      quartos: parseInt(r.quartos || '0', 10),
      banheiros: parseInt(r.bwc || '0', 10),
      vagas: parseInt(r.vagas || '0', 10),
      metragem: r.area_privativa ? parseFloat(r.area_privativa) : 0,
      nomeEdificio: r.nome_edificio || '',
      titulo: r.titulo,
      palavraDestacada: r.palavra_destacada || '',
      descricao: r.descricao,
      informacoes: r.informacoes || undefined,
      origem: r.origem || 'Imobishare',
      construtora: r.construtora || '',
      visibilidade: r.visibilidade || 'todos',
      dadosProprietario: isOwner ? (r.dados_proprietario || '') : undefined,
      nomeProprietario: isOwner ? (r.dados_proprietario || '') : 'Confidencial',
      telefoneProprietario: isOwner ? (r.dados_proprietario || '') : 'Confidencial',
      fotos: Array.isArray(fotosArr) ? fotosArr : [],
      dataCadastro: r.data_cadastro
    };
  }

  // --- PARCERIAS ---

  static async getPartners(tokenEmail: string): Promise<string[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    if (!cleanEmail) return [];

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT corretor_parceiro_email FROM parcerias WHERE LOWER(corretor_email) = $1', [cleanEmail]);
      return res.rows.map(r => r.corretor_parceiro_email);
    } else {
      const db = await this.readJson();
      return db.partnerships.filter(p => p.corretorEmail.toLowerCase().trim() === cleanEmail).map(p => p.corretorParceiroEmail);
    }
  }

  static async addPartner(tokenEmail: string, partnerEmail: string): Promise<string[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    const cleanPartner = partnerEmail.toLowerCase().trim();
    if (!cleanEmail || !cleanPartner || cleanEmail === cleanPartner) return this.getPartners(cleanEmail);

    if (this.isPostgres && this.pool) {
      await this.pool.query(`
        INSERT INTO parcerias (corretor_email, corretor_parceiro_email)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cleanEmail, cleanPartner]);
      return this.getPartners(cleanEmail);
    } else {
      const db = await this.readJson();
      const exists = db.partnerships.some(p => p.corretorEmail.toLowerCase().trim() === cleanEmail && p.corretorParceiroEmail.toLowerCase().trim() === cleanPartner);
      if (!exists) {
        db.partnerships.push({ corretorEmail: cleanEmail, corretorParceiroEmail: cleanPartner });
        await this.writeJson(db);
      }
      return this.getPartners(cleanEmail);
    }
  }

  static async removePartner(tokenEmail: string, partnerEmail: string): Promise<string[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    const cleanPartner = partnerEmail.toLowerCase().trim();

    if (this.isPostgres && this.pool) {
      await this.pool.query('DELETE FROM parcerias WHERE LOWER(corretor_email) = $1 AND LOWER(corretor_parceiro_email) = $2', [cleanEmail, cleanPartner]);
      return this.getPartners(cleanEmail);
    } else {
      const db = await this.readJson();
      db.partnerships = db.partnerships.filter(p => !(p.corretorEmail.toLowerCase().trim() === cleanEmail && p.corretorParceiroEmail.toLowerCase().trim() === cleanPartner));
      await this.writeJson(db);
      return this.getPartners(cleanEmail);
    }
  }

  // --- FAVORITOS ---

  static async getFavorites(tokenEmail: string): Promise<string[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();
    if (!cleanEmail) return [];

    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT imovel_id FROM favoritos WHERE LOWER(corretor_email) = $1', [cleanEmail]);
      return res.rows.map(r => r.imovel_id);
    } else {
      const db = await this.readJson();
      return db.favorites.filter(f => f.corretorEmail.toLowerCase().trim() === cleanEmail).map(f => f.imovelId);
    }
  }

  static async toggleFavorite(tokenEmail: string, imovelId: string): Promise<string[]> {
    const cleanEmail = tokenEmail.toLowerCase().trim();

    if (this.isPostgres && this.pool) {
      const check = await this.pool.query('SELECT 1 FROM favoritos WHERE LOWER(corretor_email) = $1 AND imovel_id = $2', [cleanEmail, imovelId]);
      if (check.rows.length > 0) {
        await this.pool.query('DELETE FROM favoritos WHERE LOWER(corretor_email) = $1 AND imovel_id = $2', [cleanEmail, imovelId]);
      } else {
        await this.pool.query('INSERT INTO favoritos (corretor_email, imovel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cleanEmail, imovelId]);
      }
      return this.getFavorites(cleanEmail);
    } else {
      const db = await this.readJson();
      const idx = db.favorites.findIndex(f => f.corretorEmail.toLowerCase().trim() === cleanEmail && f.imovelId === imovelId);
      if (idx >= 0) {
        db.favorites.splice(idx, 1);
      } else {
        db.favorites.push({ corretorEmail: cleanEmail, imovelId });
      }
      await this.writeJson(db);
      return this.getFavorites(cleanEmail);
    }
  }

  // --- DIAGNOSTICS FOR ADMIN ---

  static async runDiagnostics() {
    const startTime = Date.now();
    const checks: Record<string, any> = {};

    // 1. Database connection check
    try {
      if (this.isPostgres && this.pool) {
        const dbStart = Date.now();
        const brokersCountRes = await this.pool.query('SELECT COUNT(*) FROM corretores');
        const imoveisCountRes = await this.pool.query('SELECT COUNT(*) FROM imoveis');
        checks.database = {
          status: 'success',
          type: 'PostgreSQL (Neon)',
          brokersCount: parseInt(brokersCountRes.rows[0].count, 10),
          propertiesCount: parseInt(imoveisCountRes.rows[0].count, 10),
          responseTimeMs: Date.now() - dbStart
        };
      } else {
        const db = await this.readJson();
        checks.database = {
          status: 'success',
          type: 'JSON DB Fallback',
          brokersCount: db.brokers.length,
          propertiesCount: db.properties.length,
          jsonPath: this.jsonPath
        };
      }
    } catch (err: any) {
      checks.database = { status: 'error', error: err?.message || String(err) };
    }

    // 2. Data Integrity / Orphan Check
    try {
      if (this.isPostgres && this.pool) {
        const orphansRes = await this.pool.query(`
          SELECT COUNT(*) as count 
          FROM imoveis i 
          LEFT JOIN corretores c ON LOWER(i.corretor_email) = LOWER(c.email) 
          WHERE c.email IS NULL OR i.corretor_email IS NULL
        `);
        const orphanCount = parseInt(orphansRes.rows[0].count, 10);
        checks.dataIntegrity = {
          status: orphanCount === 0 ? 'success' : 'error',
          orphanPropertiesCount: orphanCount,
          message: orphanCount === 0 ? 'Todos os imóveis possuem vínculo válido com um corretor cadastrado.' : `Existem ${orphanCount} imóveis órfãos no banco de dados.`
        };
      } else {
        const db = await this.readJson();
        const orphanCount = db.properties.filter(p => !db.brokers.some(b => b.email.toLowerCase() === (p.corretorEmail || '').toLowerCase())).length;
        checks.dataIntegrity = {
          status: orphanCount === 0 ? 'success' : 'error',
          orphanPropertiesCount: orphanCount,
          message: orphanCount === 0 ? 'Todos os imóveis possuem vínculo válido com um corretor.' : `Existem ${orphanCount} imóveis sem corretor correspondente.`
        };
      }
    } catch (err: any) {
      checks.dataIntegrity = { status: 'error', error: err?.message || String(err) };
    }

    // 3. Environment Variables Check
    checks.environment = {
      status: 'success',
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
      nodeEnv: process.env.NODE_ENV || 'development'
    };

    // 4. Recent Backend Error Logs
    checks.errorLogs = {
      status: 'success',
      totalCaptured: recentErrorLogs.length,
      logs: recentErrorLogs.slice(0, 10)
    };

    return {
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startTime,
      checks
    };
  }
}
