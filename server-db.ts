/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { Imovel, Corretor } from './src/types';
import { MOCK_CORRETORES, INITIAL_IMOVEIS, INTEGRATED_IMOVEIS } from './src/data';

interface DbSchema {
  brokers: (Corretor & { password?: string })[];
  properties: Imovel[];
  favorites: { [corretorId: string]: string[] };
}

export class ServerDb {
  private static pool: pg.Pool | null = null;
  private static isPostgres = false;
  private static jsonPath = path.resolve(process.cwd(), 'imobishare_db.json');

  static async init(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      console.log('🔌 Connecting to production PostgreSQL database...');
      try {
        this.pool = new pg.Pool({
          connectionString: dbUrl,
          ssl: {
            rejectUnauthorized: false, // Standard for cloud-hosted DBs like Heroku/Supabase
          },
        });
        // Test connection
        await this.pool.query('SELECT NOW()');
        this.isPostgres = true;
        console.log('✅ Connected to PostgreSQL database successfully!');
        await this.createTables();
        await this.seedPostgresIfNeeded();
        await this.clearTestData();
      } catch (err) {
        console.error('❌ Failed to connect to PostgreSQL database. Falling back to JSON database:', err);
        this.isPostgres = false;
        await this.initJsonDb();
        await this.clearTestData();
      }
    } else {
      console.log('📂 No DATABASE_URL found. Using persistent JSON database fallback...');
      this.isPostgres = false;
      await this.initJsonDb();
      await this.clearTestData();
    }
  }

  private static async createTables(): Promise<void> {
    if (!this.pool) return;
    console.log('🛠️ Verifying PostgreSQL tables...');
    
    // Brokers table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS brokers (
        id VARCHAR(100) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        creci VARCHAR(100),
        telefone VARCHAR(100),
        whatsapp VARCHAR(100),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        foto TEXT,
        cidade VARCHAR(255),
        restringir_parceiros BOOLEAN DEFAULT false,
        parceiros_emails TEXT
      )
    `);

    // Properties table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR(100) PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        valor NUMERIC NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        tipo_imovel VARCHAR(100),
        cidade VARCHAR(100) NOT NULL,
        bairro VARCHAR(100) NOT NULL,
        localizacao TEXT,
        nome_edificio VARCHAR(255),
        nome_proprietario VARCHAR(255),
        telefone_proprietario VARCHAR(100),
        favorito BOOLEAN DEFAULT false,
        compartilhar BOOLEAN DEFAULT true,
        fotos TEXT, -- comma-separated
        data_cadastro VARCHAR(100),
        corretor_id VARCHAR(100) REFERENCES brokers(id) ON DELETE CASCADE,
        corretor_nome VARCHAR(255),
        dormitorios INTEGER,
        vagas INTEGER,
        banheiros INTEGER,
        metragem NUMERIC,
        area_total NUMERIC,
        integrado BOOLEAN DEFAULT false,
        integracao_origem VARCHAR(100),
        latitude NUMERIC,
        longitude NUMERIC
      )
    `);

    // Ensure columns exist for existing tables
    await this.pool.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS estado VARCHAR(100);`);
    await this.pool.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS imobiliaria VARCHAR(255);`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tipo_imovel VARCHAR(100);`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS banheiros INTEGER;`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS area_total NUMERIC;`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cep VARCHAR(20);`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS corretor_email VARCHAR(255);`);

    // Migration: Populate corretor_email from brokers.email for legacy properties
    try {
      await this.pool.query(`
        UPDATE properties p
        SET corretor_email = LOWER(TRIM(b.email))
        FROM brokers b
        WHERE (p.corretor_email IS NULL OR TRIM(p.corretor_email) = '')
          AND p.corretor_id = b.id;
      `);

      // Fallback migration: Assign any remaining orphan properties to afreccia@gmail.com
      await this.pool.query(`
        UPDATE properties
        SET corretor_email = 'afreccia@gmail.com'
        WHERE corretor_email IS NULL OR TRIM(corretor_email) = '';
      `);

      // Validation: Check orphan properties without corretor_email
      const orphans = await this.pool.query(`
        SELECT COUNT(*) AS count 
        FROM properties 
        WHERE corretor_email IS NULL OR TRIM(corretor_email) = ''
      `);
      const orphanCount = parseInt(orphans.rows[0].count, 10);
      if (orphanCount > 0) {
        console.warn(`⚠️ [MIGRATION] Existem ${orphanCount} imóvel(is) órfão(s) sem corretor_email preenchido.`);
      } else {
        console.log(`✅ [MIGRATION] 100% dos imóveis possuem corretor_email vinculado.`);
      }
    } catch (migErr) {
      console.warn('⚠️ Migration for corretor_email skipped or failed:', migErr);
    }

    // Favorites table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        corretor_id VARCHAR(100) REFERENCES brokers(id) ON DELETE CASCADE,
        imovel_id VARCHAR(100) REFERENCES properties(id) ON DELETE CASCADE,
        PRIMARY KEY (corretor_id, imovel_id)
      )
    `);
    
    console.log('✅ PostgreSQL tables checked and ready!');
  }

  private static async seedPostgresIfNeeded(): Promise<void> {
    if (!this.pool) return;
    const brokersRes = await this.pool.query('SELECT COUNT(*) FROM brokers');
    const count = parseInt(brokersRes.rows[0].count, 10);
    
    if (count === 0) {
      console.log('🌱 Seeding PostgreSQL with initial mock data...');
      
      // Seed brokers
      for (const broker of MOCK_CORRETORES) {
        // Use '123456' as default password for initial brokers in production
        const password = 'password123'; 
        const partners = broker.parceirosEmails ? broker.parceirosEmails.join(',') : '';
        await this.pool.query(`
          INSERT INTO brokers (id, nome, creci, telefone, whatsapp, email, password, foto, cidade, restringir_parceiros, parceiros_emails)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          broker.id, 
          broker.nome, 
          broker.creci, 
          broker.telefone, 
          broker.whatsapp, 
          broker.email, 
          password, 
          broker.foto, 
          broker.cidade, 
          broker.restringirParceiros || false, 
          partners
        ]);
      }

      // Seed properties
      const allInitial = [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS];
      for (const prop of allInitial) {
        const fotosStr = prop.fotos.join(',');
        await this.pool.query(`
          INSERT INTO properties (
            id, titulo, descricao, valor, tipo, cidade, bairro, localizacao, nome_edificio, 
            nome_proprietario, telefone_proprietario, favorito, compartilhar, fotos, 
            data_cadastro, corretor_id, corretor_nome, dormitorios, vagas, metragem, 
            integrado, integracao_origem, latitude, longitude
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        `, [
          prop.id, prop.titulo, prop.descricao, prop.valor, prop.tipo, prop.cidade, prop.bairro, 
          prop.localizacao, prop.nomeEdificio || '', prop.nomeProprietario, prop.telefoneProprietario, 
          prop.favorito || false, prop.compartilhar !== false, fotosStr, prop.dataCadastro, 
          prop.corretorId, prop.corretorNome, prop.dormitorios || 0, prop.vagas || 0, prop.metragem || 0, 
          prop.integrado || false, prop.integracaoOrigem || '', prop.latitude || null, prop.longitude || null
        ]);
      }
      
      console.log('✅ PostgreSQL seeded successfully!');
    }
  }

  private static async initJsonDb(): Promise<void> {
    try {
      await fs.access(this.jsonPath);
    } catch {
      // Create empty db with mock data
      const defaultDb: DbSchema = {
        brokers: MOCK_CORRETORES.map(b => ({ ...b, password: 'password123' })),
        properties: [...INITIAL_IMOVEIS, ...INTEGRATED_IMOVEIS],
        favorites: {}
      };
      // For initial favorites
      for (const b of MOCK_CORRETORES) {
        defaultDb.favorites[b.id] = INITIAL_IMOVEIS.filter(i => i.favorito).map(i => i.id);
      }
      await fs.writeFile(this.jsonPath, JSON.stringify(defaultDb, null, 2), 'utf-8');
      console.log('✅ Created local JSON database at:', this.jsonPath);
    }
  }

  private static async readJson(): Promise<DbSchema> {
    const data = await fs.readFile(this.jsonPath, 'utf-8');
    return JSON.parse(data);
  }

  private static async writeJson(db: DbSchema): Promise<void> {
    await fs.writeFile(this.jsonPath, JSON.stringify(db, null, 2), 'utf-8');
  }

  // --- PUBLIC API METHODS ---

  static async getCorretores(): Promise<Corretor[]> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM brokers');
      return res.rows.map(r => ({
        id: r.id,
        nome: r.nome,
        creci: r.creci,
        telefone: r.telefone,
        whatsapp: r.whatsapp,
        email: r.email,
        foto: r.foto,
        cidade: r.cidade,
        estado: r.estado || '',
        imobiliaria: r.imobiliaria || '',
        restringirParceiros: r.restringir_parceiros,
        parceirosEmails: r.parceiros_emails ? r.parceiros_emails.split(',') : []
      }));
    } else {
      const db = await this.readJson();
      return db.brokers.map(({ password, ...b }) => b);
    }
  }

  static async getCorretorByEmail(email: string): Promise<(Corretor & { password?: string }) | null> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return null;
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM brokers WHERE LOWER(email) = $1', [cleanEmail]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        nome: r.nome,
        creci: r.creci,
        telefone: r.telefone,
        whatsapp: r.whatsapp,
        email: r.email,
        foto: r.foto,
        cidade: r.cidade,
        estado: r.estado || '',
        imobiliaria: r.imobiliaria || '',
        password: r.password,
        restringirParceiros: r.restringir_parceiros,
        parceirosEmails: r.parceiros_emails ? r.parceiros_emails.split(',') : []
      };
    } else {
      const db = await this.readJson();
      const found = db.brokers.find(b => b.email && b.email.toLowerCase().trim() === cleanEmail);
      return found || null;
    }
  }

  static async saveCorretor(broker: Corretor & { password?: string }): Promise<Corretor> {
    const cleanEmail = (broker.email || '').toLowerCase().trim();
    if (this.isPostgres && this.pool) {
      // Check if broker exists by id OR by LOWER(email) to avoid duplicate broker records
      const checkById = await this.pool.query('SELECT id FROM brokers WHERE id = $1', [broker.id]);
      const checkByEmail = cleanEmail ? await this.pool.query('SELECT id FROM brokers WHERE LOWER(email) = $1', [cleanEmail]) : { rows: [] };
      
      const existingId = checkById.rows.length > 0 ? checkById.rows[0].id : (checkByEmail.rows.length > 0 ? checkByEmail.rows[0].id : broker.id);
      broker.id = existingId;
      
      const partners = broker.parceirosEmails ? broker.parceirosEmails.join(',') : '';
      
      const check = await this.pool.query('SELECT id FROM brokers WHERE id = $1', [existingId]);
      if (check.rows.length > 0) {
        // Update
        if (broker.password) {
          await this.pool.query(`
            UPDATE brokers SET nome = $2, creci = $3, telefone = $4, whatsapp = $5, email = $6, password = $7, foto = $8, cidade = $9, estado = $10, imobiliaria = $11, restringir_parceiros = $12, parceiros_emails = $13
            WHERE id = $1
          `, [existingId, broker.nome, broker.creci, broker.telefone, broker.whatsapp, cleanEmail, broker.password, broker.foto, broker.cidade, broker.estado || '', broker.imobiliaria || '', broker.restringirParceiros || false, partners]);
        } else {
          await this.pool.query(`
            UPDATE brokers SET nome = $2, creci = $3, telefone = $4, whatsapp = $5, email = $6, foto = $7, cidade = $8, estado = $9, imobiliaria = $10, restringir_parceiros = $11, parceiros_emails = $12
            WHERE id = $1
          `, [existingId, broker.nome, broker.creci, broker.telefone, broker.whatsapp, cleanEmail, broker.foto, broker.cidade, broker.estado || '', broker.imobiliaria || '', broker.restringirParceiros || false, partners]);
        }
      } else {
        // Insert
        await this.pool.query(`
          INSERT INTO brokers (id, nome, creci, telefone, whatsapp, email, password, foto, cidade, estado, imobiliaria, restringir_parceiros, parceiros_emails)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [existingId, broker.nome, broker.creci, broker.telefone, broker.whatsapp, cleanEmail, broker.password || 'password123', broker.foto, broker.cidade, broker.estado || '', broker.imobiliaria || '', broker.restringirParceiros || false, partners]);
      }
      const { password, ...cleanBroker } = broker;
      return { ...cleanBroker, email: cleanEmail };
    } else {
      const db = await this.readJson();
      const idx = db.brokers.findIndex(b => b.id === broker.id || (cleanEmail && b.email && b.email.toLowerCase().trim() === cleanEmail));
      if (idx !== -1) {
        db.brokers[idx] = { ...db.brokers[idx], ...broker, email: cleanEmail };
      } else {
        db.brokers.push({ ...broker, email: cleanEmail, password: broker.password || 'password123' });
      }
      await this.writeJson(db);
      const { password, ...cleanBroker } = broker;
      return { ...cleanBroker, email: cleanEmail };
    }
  }

  static async getImoveis(corretorEmail?: string): Promise<Imovel[]> {
    const cleanEmail = corretorEmail ? corretorEmail.toLowerCase().trim() : '';
    if (this.isPostgres && this.pool) {
      let query = 'SELECT * FROM properties';
      const params: any[] = [];
      if (cleanEmail) {
        query += ' WHERE LOWER(TRIM(corretor_email)) = $1';
        params.push(cleanEmail);
      }
      query += ' ORDER BY data_cadastro DESC';
      const res = await this.pool.query(query, params);
      return res.rows.map(r => ({
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        valor: parseFloat(r.valor),
        tipo: r.tipo as 'venda' | 'locação',
        cidade: r.cidade,
        bairro: r.bairro,
        localizacao: r.localizacao,
        nomeEdificio: r.nome_edificio,
        nomeProprietario: r.nome_proprietario,
        telefoneProprietario: r.telefone_proprietario,
        favorito: r.favorito,
        compartilhar: r.compartilhar,
        fotos: (() => {
          if (!r.fotos) return [];
          try {
            const parsed = JSON.parse(r.fotos);
            return Array.isArray(parsed) ? parsed : [r.fotos];
          } catch {
            return r.fotos.split(',').filter((f: string) => f.trim().length > 0);
          }
        })(),
        dataCadastro: r.data_cadastro,
        corretorId: r.corretor_id,
        corretorEmail: r.corretor_email || undefined,
        corretorNome: r.corretor_nome,
        dormitorios: r.dormitorios,
        vagas: r.vagas,
        banheiros: r.banheiros,
        metragem: r.metragem ? parseFloat(r.metragem) : undefined,
        areaTotal: r.area_total ? parseFloat(r.area_total) : undefined,
        tipoImovel: r.tipo_imovel,
        cep: r.cep,
        integrado: r.integrado,
        integracaoOrigem: r.integracao_origem,
        latitude: r.latitude ? parseFloat(r.latitude) : undefined,
        longitude: r.longitude ? parseFloat(r.longitude) : undefined
      }));
    } else {
      const db = await this.readJson();
      if (cleanEmail) {
        return db.properties.filter(p => p.corretorEmail && p.corretorEmail.toLowerCase().trim() === cleanEmail);
      }
      return db.properties;
    }
  }

  private static async ensureBrokerExists(corretorId?: string, email?: string, nome?: string): Promise<string> {
    if (!this.isPostgres || !this.pool) {
      return corretorId || 'corretor-anonimo';
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanId = (corretorId || '').trim();

    try {
      // 1. Check if broker exists by email
      if (cleanEmail) {
        const byEmail = await this.pool.query('SELECT id FROM brokers WHERE LOWER(TRIM(email)) = $1 LIMIT 1', [cleanEmail]);
        if (byEmail.rows.length > 0) {
          return byEmail.rows[0].id;
        }
      }

      // 2. Check if broker exists by id
      if (cleanId) {
        const byId = await this.pool.query('SELECT id FROM brokers WHERE id = $1 LIMIT 1', [cleanId]);
        if (byId.rows.length > 0) {
          return byId.rows[0].id;
        }
      }

      // 3. Create missing broker record safely
      const targetId = cleanId || (cleanEmail ? `broker-${cleanEmail.replace(/[^a-z0-9]/gi, '_')}` : `broker-${Date.now()}`);
      const targetEmail = cleanEmail || `${targetId}@imobishare.com`;
      const targetNome = nome || (cleanEmail ? cleanEmail.split('@')[0] : 'Corretor');

      await this.pool.query(`
        INSERT INTO brokers (id, nome, email, password)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET 
          email = COALESCE(NULLIF(EXCLUDED.email, ''), brokers.email),
          nome = COALESCE(NULLIF(EXCLUDED.nome, ''), brokers.nome)
      `, [targetId, targetNome, targetEmail, 'password123']);

      return targetId;
    } catch (e) {
      console.warn('⚠️ Error in ensureBrokerExists:', e);
      try {
        const fallback = await this.pool.query('SELECT id FROM brokers LIMIT 1');
        if (fallback.rows.length > 0) {
          return fallback.rows[0].id;
        }
      } catch {
        // ignore
      }
      return cleanId || 'corretor-anonimo';
    }
  }

  static async saveImovel(prop: Imovel): Promise<Imovel> {
    const cleanEmail = (prop.corretorEmail || 'afreccia@gmail.com').toLowerCase().trim();

    if (this.isPostgres && this.pool) {
      const effectiveBrokerId = await this.ensureBrokerExists(prop.corretorId, cleanEmail, prop.corretorNome);

      const fotosStr = JSON.stringify(prop.fotos || []);
      const check = await this.pool.query('SELECT id FROM properties WHERE id = $1', [prop.id]);
      if (check.rows.length > 0) {
        // Update
        await this.pool.query(`
          UPDATE properties SET 
            titulo = $2, descricao = $3, valor = $4, tipo = $5, cidade = $6, bairro = $7, 
            localizacao = $8, nome_edificio = $9, nome_proprietario = $10, telefone_proprietario = $11, 
            favorito = $12, compartilhar = $13, fotos = $14, data_cadastro = $15, corretor_id = $16, 
            corretor_nome = $17, dormitorios = $18, vagas = $19, metragem = $20, integrado = $21, 
            integracao_origem = $22, latitude = $23, longitude = $24, tipo_imovel = $25, banheiros = $26, 
            area_total = $27, cep = $28, corretor_email = $29
          WHERE id = $1
        `, [
          prop.id, prop.titulo, prop.descricao, prop.valor, prop.tipo, prop.cidade, prop.bairro, 
          prop.localizacao, prop.nomeEdificio || '', prop.nomeProprietario, prop.telefoneProprietario, 
          prop.favorito || false, prop.compartilhar !== false, fotosStr, prop.dataCadastro, 
          effectiveBrokerId, prop.corretorNome, prop.dormitorios || 0, prop.vagas || 0, prop.metragem || 0, 
          prop.integrado || false, prop.integracaoOrigem || '', prop.latitude || null, prop.longitude || null,
          prop.tipoImovel || null, prop.banheiros || null, prop.areaTotal || null, prop.cep || null,
          cleanEmail || null
        ]);
      } else {
        // Insert
        await this.pool.query(`
          INSERT INTO properties (
            id, titulo, descricao, valor, tipo, cidade, bairro, localizacao, nome_edificio, 
            nome_proprietario, telefone_proprietario, favorito, compartilhar, fotos, 
            data_cadastro, corretor_id, corretor_nome, dormitorios, vagas, metragem, 
            integrado, integracao_origem, latitude, longitude, tipo_imovel, banheiros, area_total, cep, corretor_email
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        `, [
          prop.id, prop.titulo, prop.descricao, prop.valor, prop.tipo, prop.cidade, prop.bairro, 
          prop.localizacao, prop.nomeEdificio || '', prop.nomeProprietario, prop.telefoneProprietario, 
          prop.favorito || false, prop.compartilhar !== false, fotosStr, prop.dataCadastro, 
          effectiveBrokerId, prop.corretorNome, prop.dormitorios || 0, prop.vagas || 0, prop.metragem || 0, 
          prop.integrado || false, prop.integracaoOrigem || '', prop.latitude || null, prop.longitude || null,
          prop.tipoImovel || null, prop.banheiros || null, prop.areaTotal || null, prop.cep || null,
          cleanEmail || null
        ]);
      }
      return { ...prop, corretorId: effectiveBrokerId, corretorEmail: cleanEmail };
    } else {
      const db = await this.readJson();
      const idx = db.properties.findIndex(p => p.id === prop.id);
      const finalProp = { ...prop, corretorEmail: cleanEmail };
      if (idx !== -1) {
        db.properties[idx] = finalProp;
      } else {
        db.properties.unshift(finalProp);
      }
      await this.writeJson(db);
      return finalProp;
    }
  }

  static async clearTestData(): Promise<{ propertiesRemoved: number; brokersRemoved: number }> {
    let propertiesRemoved = 0;
    let brokersRemoved = 0;

    if (this.isPostgres && this.pool) {
      try {
        const propRes = await this.pool.query(`
          DELETE FROM properties 
          WHERE id LIKE 'imovel-%' OR id LIKE 'integ-%' OR id LIKE 'test-diag-%'
        `);
        propertiesRemoved = propRes.rowCount || 0;

        const brokerRes = await this.pool.query(`
          DELETE FROM brokers 
          WHERE id IN ('corretor-1', 'corretor-2', 'corretor-3', 'test-broker-diag')
        `);
        brokersRemoved = brokerRes.rowCount || 0;

        console.log(`🧹 Purged ${propertiesRemoved} test properties and ${brokersRemoved} test brokers from PostgreSQL.`);
      } catch (err) {
        console.error('Error purging test data from PostgreSQL:', err);
      }
    } else {
      try {
        const db = await this.readJson();
        const initialPropCount = db.properties.length;
        const initialBrokerCount = db.brokers.length;

        db.properties = db.properties.filter(p => 
          p.id && !p.id.startsWith('imovel-') && !p.id.startsWith('integ-') && !p.id.startsWith('test-diag-')
        );

        db.brokers = db.brokers.filter(b => 
          b.id && !['corretor-1', 'corretor-2', 'corretor-3', 'test-broker-diag'].includes(b.id)
        );

        propertiesRemoved = initialPropCount - db.properties.length;
        brokersRemoved = initialBrokerCount - db.brokers.length;

        await this.writeJson(db);
        console.log(`🧹 Purged ${propertiesRemoved} test properties and ${brokersRemoved} test brokers from JSON DB.`);
      } catch (err) {
        console.error('Error purging test data from JSON DB:', err);
      }
    }

    return { propertiesRemoved, brokersRemoved };
  }

  static async deleteImovel(id: string): Promise<void> {
    if (this.isPostgres && this.pool) {
      await this.pool.query('DELETE FROM properties WHERE id = $1', [id]);
    } else {
      const db = await this.readJson();
      db.properties = db.properties.filter(p => p.id !== id);
      await this.writeJson(db);
    }
  }

  static async getStatus() {
    let dbOk = false;
    let dbTime: string | null = null;
    let dbError: string | null = null;

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query('SELECT NOW() as now');
        dbOk = true;
        dbTime = res.rows[0]?.now ? String(res.rows[0].now) : new Date().toISOString();
      } catch (e: any) {
        dbError = e?.message || String(e);
      }
    }

    return {
      isPostgres: this.isPostgres,
      dbOk,
      dbTime,
      dbError,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
    };
  }

  static async getFavoritos(corretorId: string): Promise<string[]> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT imovel_id FROM favorites WHERE corretor_id = $1', [corretorId]);
      return res.rows.map(r => r.imovel_id);
    } else {
      const db = await this.readJson();
      return db.favorites[corretorId] || [];
    }
  }

  static async toggleFavorite(corretorId: string, imovelId: string): Promise<string[]> {
    if (this.isPostgres && this.pool) {
      // Check if exists
      const check = await this.pool.query('SELECT 1 FROM favorites WHERE corretor_id = $1 AND imovel_id = $2', [corretorId, imovelId]);
      if (check.rows.length > 0) {
        await this.pool.query('DELETE FROM favorites WHERE corretor_id = $1 AND imovel_id = $2', [corretorId, imovelId]);
      } else {
        await this.pool.query('INSERT INTO favorites (corretor_id, imovel_id) VALUES ($1, $2)', [corretorId, imovelId]);
      }
      return this.getFavoritos(corretorId);
    } else {
      const db = await this.readJson();
      if (!db.favorites[corretorId]) {
        db.favorites[corretorId] = [];
      }
      const idx = db.favorites[corretorId].indexOf(imovelId);
      if (idx !== -1) {
        db.favorites[corretorId].splice(idx, 1);
      } else {
        db.favorites[corretorId].push(imovelId);
      }
      await this.writeJson(db);
      return db.favorites[corretorId];
    }
  }
}
