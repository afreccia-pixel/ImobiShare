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
      } catch (err) {
        console.error('❌ Failed to connect to PostgreSQL database. Falling back to JSON database:', err);
        this.isPostgres = false;
        await this.initJsonDb();
      }
    } else {
      console.log('📂 No DATABASE_URL found. Using persistent JSON database fallback...');
      this.isPostgres = false;
      await this.initJsonDb();
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
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tipo_imovel VARCHAR(100);`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS banheiros INTEGER;`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS area_total NUMERIC;`);
    await this.pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cep VARCHAR(20);`);

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
        password: r.password,
        restringirParceiros: r.restringir_parceiros,
        parceirosEmails: r.parceiros_emails ? r.parceiros_emails.split(',') : []
      };
    } else {
      const db = await this.readJson();
      const found = db.brokers.find(b => b.email.toLowerCase().trim() === cleanEmail);
      return found || null;
    }
  }

  static async saveCorretor(broker: Corretor & { password?: string }): Promise<Corretor> {
    if (this.isPostgres && this.pool) {
      // Check if exists
      const check = await this.pool.query('SELECT id FROM brokers WHERE id = $1', [broker.id]);
      const partners = broker.parceirosEmails ? broker.parceirosEmails.join(',') : '';
      if (check.rows.length > 0) {
        // Update
        if (broker.password) {
          await this.pool.query(`
            UPDATE brokers SET nome = $2, creci = $3, telefone = $4, whatsapp = $5, email = $6, password = $7, foto = $8, cidade = $9, restringir_parceiros = $10, parceiros_emails = $11
            WHERE id = $1
          `, [broker.id, broker.nome, broker.creci, broker.telefone, broker.whatsapp, broker.email, broker.password, broker.foto, broker.cidade, broker.restringirParceiros || false, partners]);
        } else {
          await this.pool.query(`
            UPDATE brokers SET nome = $2, creci = $3, telefone = $4, whatsapp = $5, email = $6, foto = $7, cidade = $8, restringir_parceiros = $9, parceiros_emails = $10
            WHERE id = $1
          `, [broker.id, broker.nome, broker.creci, broker.telefone, broker.whatsapp, broker.email, broker.foto, broker.cidade, broker.restringirParceiros || false, partners]);
        }
      } else {
        // Insert
        await this.pool.query(`
          INSERT INTO brokers (id, nome, creci, telefone, whatsapp, email, password, foto, cidade, restringir_parceiros, parceiros_emails)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [broker.id, broker.nome, broker.creci, broker.telefone, broker.whatsapp, broker.email, broker.password || 'password123', broker.foto, broker.cidade, broker.restringirParceiros || false, partners]);
      }
      const { password, ...cleanBroker } = broker;
      return cleanBroker;
    } else {
      const db = await this.readJson();
      const idx = db.brokers.findIndex(b => b.id === broker.id);
      if (idx !== -1) {
        db.brokers[idx] = { ...db.brokers[idx], ...broker };
      } else {
        db.brokers.push({ ...broker, password: broker.password || 'password123' });
      }
      await this.writeJson(db);
      const { password, ...cleanBroker } = broker;
      return cleanBroker;
    }
  }

  static async getImoveis(): Promise<Imovel[]> {
    if (this.isPostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM properties ORDER BY data_cadastro DESC');
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
        fotos: r.fotos ? r.fotos.split(',') : [],
        dataCadastro: r.data_cadastro,
        corretorId: r.corretor_id,
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
      return db.properties;
    }
  }

  static async saveImovel(prop: Imovel): Promise<Imovel> {
    if (this.isPostgres && this.pool) {
      const fotosStr = prop.fotos.join(',');
      const check = await this.pool.query('SELECT id FROM properties WHERE id = $1', [prop.id]);
      if (check.rows.length > 0) {
        // Update
        await this.pool.query(`
          UPDATE properties SET 
            titulo = $2, descricao = $3, valor = $4, tipo = $5, cidade = $6, bairro = $7, 
            localizacao = $8, nome_edificio = $9, nome_proprietario = $10, telefone_proprietario = $11, 
            favorito = $12, compartilhar = $13, fotos = $14, data_cadastro = $15, corretor_id = $16, 
            corretor_nome = $17, dormitorios = $18, vagas = $19, metragem = $20, integrado = $21, 
            integracao_origem = $22, latitude = $23, longitude = $24, tipo_imovel = $25, banheiros = $26, area_total = $27, cep = $28
          WHERE id = $1
        `, [
          prop.id, prop.titulo, prop.descricao, prop.valor, prop.tipo, prop.cidade, prop.bairro, 
          prop.localizacao, prop.nomeEdificio || '', prop.nomeProprietario, prop.telefoneProprietario, 
          prop.favorito || false, prop.compartilhar !== false, fotosStr, prop.dataCadastro, 
          prop.corretorId, prop.corretorNome, prop.dormitorios || 0, prop.vagas || 0, prop.metragem || 0, 
          prop.integrado || false, prop.integracaoOrigem || '', prop.latitude || null, prop.longitude || null,
          prop.tipoImovel || null, prop.banheiros || null, prop.areaTotal || null, prop.cep || null
        ]);
      } else {
        // Insert
        await this.pool.query(`
          INSERT INTO properties (
            id, titulo, descricao, valor, tipo, cidade, bairro, localizacao, nome_edificio, 
            nome_proprietario, telefone_proprietario, favorito, compartilhar, fotos, 
            data_cadastro, corretor_id, corretor_nome, dormitorios, vagas, metragem, 
            integrado, integracao_origem, latitude, longitude, tipo_imovel, banheiros, area_total, cep
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        `, [
          prop.id, prop.titulo, prop.descricao, prop.valor, prop.tipo, prop.cidade, prop.bairro, 
          prop.localizacao, prop.nomeEdificio || '', prop.nomeProprietario, prop.telefoneProprietario, 
          prop.favorito || false, prop.compartilhar !== false, fotosStr, prop.dataCadastro, 
          prop.corretorId, prop.corretorNome, prop.dormitorios || 0, prop.vagas || 0, prop.metragem || 0, 
          prop.integrado || false, prop.integracaoOrigem || '', prop.latitude || null, prop.longitude || null,
          prop.tipoImovel || null, prop.banheiros || null, prop.areaTotal || null, prop.cep || null
        ]);
      }
      return prop;
    } else {
      const db = await this.readJson();
      const idx = db.properties.findIndex(p => p.id === prop.id);
      if (idx !== -1) {
        db.properties[idx] = prop;
      } else {
        db.properties.unshift(prop);
      }
      await this.writeJson(db);
      return prop;
    }
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
