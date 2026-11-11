// Debe ser el PRIMER import: carga .env antes de que se evalúen los módulos que leen process.env
// (auth.ts resuelve JWT_SECRET al importarse; con dotenv.config() más abajo llegaba tarde).
import "dotenv/config";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
import express from "express";
import { z } from "zod";
import http from "http";
import https from "https";
import net from "net";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createRequire } from "module";
import pg from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { handleLogin, handleChangePassword, handleAdminUsers, handleRecoverPasswordRequest, handleResetPasswordExecute, authenticateToken, requireRole, registrarAuditoria, AuthenticatedRequest, issueJwtToken, UserPayload } from "./src/server/auth.js";
import * as XLSX from "xlsx";
import { INITIAL_VACANCIES, INITIAL_CANDIDATES } from "./src/data/samples.js";
import { detectCvFileKind, assertIsCv, CvRejectedError } from "./src/server/cvValidation.js";
import { generateExperienceQuestions, isQuestionRelevant, buildScreeningQuestions, FIXED_AVAILABILITY_QUESTIONS } from "./src/utils/questionEngine.js";
const FIXED_AVAILABILITY_SET = new Set(FIXED_AVAILABILITY_QUESTIONS);
import { normalizeArea } from "./src/utils/areas.js";
import { evaluateDoubleCheck, parseCandidateAnswers } from "./src/utils/doubleCheckEvaluator.js";
import { 
  cleanCandidateName, 
  calculateStrictFitScore, 
  interpretVacancyProfileWeights, 
  synthesizeAnalyticalCandidateSummary, 
  calculateCandidateCompetencies, 
  computeGuidanceForCandidate, 
  isStaticLegacyCompetencies, 
  isLegacyOrClonedSummary 
} from "./src/utils/vacancyUtils.js";
import { 
  validateAndNormalizeCanonicalCv, 
  normalizeCanonicalExperience, 
  normalizeCanonicalEducation, 
  normalizeCanonicalCertifications, 
  isLocationString, 
  stripBulletPoints,
  cleanExecutiveDetails,
  detectDegradedCvFields
} from "./src/utils/canonicalCvNormalizer.js";

dotenv.config();

const { Pool } = pg;

// -----------------------------------------------------------------------------
// Almacenamiento: PostgreSQL es la ÚNICA fuente de verdad.
// Antes existía un fallback automático y silencioso a memoria + scratch/*.json
// que se activaba si la primera conexión tardaba más de 500 ms. Los cambios
// hechos en ese modo vivían solo en RAM y se perdían en cada reinicio/deploy.
// Ahora el modo memoria solo existe si se pide explícitamente (STORAGE_MODE=memory,
// pensado para demos locales) y NUNCA se activa por un error de conexión.
// -----------------------------------------------------------------------------
const STORAGE_MODE: 'postgres' | 'memory' = process.env.STORAGE_MODE === 'memory' ? 'memory' : 'postgres';
const DATABASE_URL = process.env.DATABASE_URL || '';
if (STORAGE_MODE === 'postgres' && !DATABASE_URL) {
  console.error("EAS AI Recruiting: FATAL — DATABASE_URL no está definido. Configúralo en .env (ver .env.example) o usa STORAGE_MODE=memory solo para demo local.");
  process.exit(1);
}

function redactDbUrl(url: string): string {
  return url.replace(/\/\/([^:@/]+):([^@/]*)@/, '//$1:***@');
}

// SSL hacia PostgreSQL: DATABASE_SSL=disable | require | verify-full (default: lo que indique sslmode en DATABASE_URL)
function buildPgSslConfig(): pg.PoolConfig['ssl'] {
  const mode = (process.env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') {
    const caPath = process.env.DATABASE_SSL_CA;
    return { rejectUnauthorized: true, ...(caPath ? { ca: fs.readFileSync(caPath, 'utf-8') } : {}) };
  }
  if (mode === 'disable') return false;
  return undefined;
}

const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  ssl: buildPgSslConfig(),
  connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10000)
});

pool.on('error', (err: any) => {
  console.error(`EAS AI Recruiting: PostgreSQL pool error [${err.code || 'sin código'}]: ${err.message}`);
});

// Estado real de la BD, expuesto en /api/health
let dbReady = false;
let dbLastError: string | null = null;
let dbConnectedAt: string | null = null;

const VACANCIES_FILE = path.join(process.cwd(), 'scratch', 'vacancies_db.json');
const CANDIDATES_FILE = path.join(process.cwd(), 'scratch', 'candidates_db.json');

function loadDiskVacancies(): any[] {
  if (STORAGE_MODE !== 'memory') return [];
  try {
    if (fs.existsSync(VACANCIES_FILE)) {
      const data = fs.readFileSync(VACANCIES_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [...INITIAL_VACANCIES];
}

function saveDiskVacancies(list: any[]) {
  if (STORAGE_MODE !== 'memory') return;
  try {
    const dir = path.dirname(VACANCIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${VACANCIES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tmpPath, VACANCIES_FILE);
  } catch (e) {
    console.error("Error writing vacancies_db.json to disk:", e);
  }
}

function loadDiskCandidates(): any[] {
  if (STORAGE_MODE !== 'memory') return [];
  try {
    if (fs.existsSync(CANDIDATES_FILE)) {
      const data = fs.readFileSync(CANDIDATES_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {
    console.warn("Notice: Error parsing candidates_db.json fallback:", e);
  }
  return [...INITIAL_CANDIDATES];
}

function saveDiskCandidates(list: any[]) {
  if (STORAGE_MODE !== 'memory') return;
  try {
    const dir = path.dirname(CANDIDATES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${CANDIDATES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CANDIDATES_FILE);
  } catch (e) {
    console.error("Error writing candidates_db.json to disk:", e);
  }
}

// true SOLO en modo demo explícito (STORAGE_MODE=memory). Nunca se activa por errores de conexión.
const useDbFallback = STORAGE_MODE === 'memory';
let mockVacancies: any[] = loadDiskVacancies();
let mockCandidates: any[] = loadDiskCandidates();
let mockAuditLogs: any[] = [];

export function sanitizeUtf8<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    let s: string = val;
    if (typeof (s as any).toWellFormed === 'function') {
      s = (s as any).toWellFormed();
    } else {
      s = s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
    }
    s = s.normalize('NFC');
    return s
      .replace(/\u0000/g, '')
      .replace(/\\u0000/gi, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/\ufffd/g, '') as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeUtf8(item)) as unknown as T;
  }
  if (typeof val === 'object' && !(val instanceof Date) && !(val instanceof Buffer)) {
    const cleanedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      cleanedObj[k] = sanitizeUtf8(v);
    }
    return cleanedObj as T;
  }
  return val;
}

export function sanitizeForPg<T>(val: T): T {
  return sanitizeUtf8(val);
}

export function fixCorruptedAccents(text: string): string {
  if (!text) return "";
  const clean = typeof text === 'string' ? text.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\ufffd/g, '') : String(text);
  return clean
    .replace(/mdulo/gi, 'módulo')
    .replace(/m\?dulo/gi, 'módulo')
    .replace(/implementacin/gi, 'implementación')
    .replace(/implementaci\?n/gi, 'implementación')
    .replace(/gestin/gi, 'gestión')
    .replace(/gesti\?n/gi, 'gestión')
    .replace(/ejecucin/gi, 'ejecución')
    .replace(/ejecuci\?n/gi, 'ejecución')
    .replace(/metodologa/gi, 'metodología')
    .replace(/metodolog\?a/gi, 'metodología')
    .replace(/metodologias/gi, 'metodologías')
    .replace(/metodolog\?as/gi, 'metodologías')
    .replace(/lder/gi, 'líder')
    .replace(/l\?der/gi, 'líder')
    .replace(/definicin/gi, 'definición')
    .replace(/definici\?n/gi, 'definición')
    .replace(/solucin/gi, 'solución')
    .replace(/soluci\?n/gi, 'solución')
    .replace(/observacin/gi, 'observación')
    .replace(/observaci\?n/gi, 'observación')
    .replace(/observaciones/gi, 'observaciones')
    .replace(/direccin/gi, 'dirección')
    .replace(/direcci\?n/gi, 'dirección')
    .replace(/comercila/gi, 'comercial')
    .replace(/implenetacin/gi, 'implementación')
    .replace(/desiciones/gi, 'decisiones')
    .replace(/duracin/gi, 'duración')
    .replace(/duraci\?n/gi, 'duración')
    .replace(/asignacin/gi, 'asignación')
    .replace(/asignaci\?n/gi, 'asignación')
    .replace(/contratacin/gi, 'contratación')
    .replace(/contrataci\?n/gi, 'contratación')
    .replace(/nmina/gi, 'nómina')
    .replace(/n\?mina/gi, 'nómina')
    .replace(/hbrido/gi, 'híbrido')
    .replace(/h\?brido/gi, 'híbrido')
    .replace(/creacin/gi, 'creación')
    .replace(/creaci\?n/gi, 'creación')
    .replace(/certificacin/gi, 'certificación')
    .replace(/certificaci\?n/gi, 'certificación')
    .replace(/consultora/gi, 'consultoría')
    .replace(/consultor\?a/gi, 'consultoría')
    .replace(/aos/gi, 'años')
    .replace(/a\?os/gi, 'años')
    .replace(/anlisis/gi, 'análisis')
    .replace(/an\?lisis/gi, 'análisis')
    .replace(/tcnica/gi, 'técnica')
    .replace(/t\?cnica/gi, 'técnica')
    .replace(/tcnicas/gi, 'técnicas')
    .replace(/t\?cnicas/gi, 'técnicas')
    .replace(/mínima/gi, 'mínima')
    .replace(/m\?nima/gi, 'mínima')
    .replace(/mínimo/gi, 'mínimo')
    .replace(/m\?nimo/gi, 'mínimo')
    .replace(/\bexito/gi, 'éxito')
    .replace(/\beéxito/gi, 'éxito')
    .replace(/\?\s*xito/gi, 'éxito')
    .replace(/múltiples/gi, 'múltiples')
    .replace(/m\?ltiples/gi, 'múltiples')
    .replace(/analítico/gi, 'analítico')
    .replace(/anal\?tico/gi, 'analítico');
}





export function formatVacancyTitle(title: string, department?: string): string {
  if (!title || !title.trim()) {
    return 'Vacante';
  }
  let cleanTitle = fixCorruptedAccents(title.trim());

  // Omit "Atracción de Talento", "Consultoría Organizacional" and extra person signatures
  cleanTitle = cleanTitle
    .replace(/\s*[\-\:\_]?\s*(Atracción de Talento|Atraccion de Talento|Consultoría Organizacional|Consultoria Organizacional)\s*/gi, '')
    .replace(/\s*-\s*.*Gabriel Aguayo.*$/gi, '')
    .trim();

  return cleanTitle || 'Vacante';
}


// Conecta a PostgreSQL con reintentos (sin carrera contra timeouts cortos) y corre migraciones.
// Mientras no conecte, las rutas de datos responden 503 explícito en vez de guardar en memoria.
async function initDb() {
  if (STORAGE_MODE === 'memory') {
    console.warn("EAS AI Recruiting: STORAGE_MODE=memory (DEMO). Los datos NO se guardan en PostgreSQL y se pierden al reiniciar.");
    return;
  }
  let attempt = 0;
  while (!dbReady) {
    attempt++;
    let client: pg.PoolClient | null = null;
    try {
      client = await pool.connect();
      await runMigrations(client);
      await cleanExistingCandidateNames(client);
      dbReady = true;
      dbLastError = null;
      dbConnectedAt = new Date().toISOString();
      console.log(`EAS AI Recruiting: PostgreSQL conectado en [${redactDbUrl(DATABASE_URL)}] (intento ${attempt}).`);
    } catch (err: any) {
      dbLastError = `${err.code || 'ERR'}: ${err.message}`;
      const waitMs = Math.min(30000, 2000 * attempt);
      console.error(`EAS AI Recruiting: PostgreSQL NO disponible en [${redactDbUrl(DATABASE_URL)}] intento ${attempt} — ${dbLastError}. Reintentando en ${waitMs / 1000}s. Las rutas de datos responden 503 mientras tanto.`);
      await new Promise(r => setTimeout(r, waitMs));
    } finally {
      if (client) client.release();
    }
  }
}

async function runMigrations(client: pg.PoolClient) {
  {
    console.log("EAS AI Recruiting: Conectando a PostgreSQL e inicializando tablas...");
    
    // Create vacancies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vacancies (
        id VARCHAR(50) PRIMARY KEY,
        title TEXT NOT NULL,
        department TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT[] NOT NULL,
        experience_years INTEGER NOT NULL,
        salary_range TEXT,
        status TEXT DEFAULT 'Activa',
        min_competencies JSONB NOT NULL,
        english_level TEXT,
        modalidad TEXT
      );
    `);

    // Migration check complete


    // Create candidates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id VARCHAR(50) PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        resume_text TEXT,
        stage TEXT DEFAULT 'Filtrado',
        competencies JSONB NOT NULL,
        fit_score INTEGER NOT NULL,
        initial_fit_score INTEGER,
        summary TEXT,
        strengths TEXT[] NOT NULL,
        growths TEXT[] NOT NULL,
        recommended_questions TEXT[],
        suggested_time TEXT,
        channel TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_encrypted BOOLEAN DEFAULT FALSE,
        vacancy_id VARCHAR(50) REFERENCES vacancies(id) ON DELETE SET NULL,
        screening_questions JSONB,
        double_check_report TEXT,
        interview_speech TEXT,
        history JSONB DEFAULT '[]'::jsonb,
        comments TEXT DEFAULT ''
      );
    `);

    // Alter candidates table to add experience, education, and certifications if not exist
    await client.query(`
      ALTER TABLE candidates
      ADD COLUMN IF NOT EXISTS experience TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS education TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '';
    `);

    // Columnas que PATCH /api/candidates/:id ya escribía pero NUNCA existieron en la tabla
    // (expected_salary / english_level) → todo PATCH fallaba con 42703 y el front lo ocultaba.
    // Se agregan también los campos que el UI edita y no tenían dónde guardarse.
    await client.query(`
      ALTER TABLE candidates
      ADD COLUMN IF NOT EXISTS expected_salary TEXT,
      ADD COLUMN IF NOT EXISTS english_level TEXT,
      ADD COLUMN IF NOT EXISTS detected_guidance_level TEXT,
      ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);
    // Columnas de texto libre que venían como VARCHAR(20/50/100/255): un nivel de inglés o una
    // modalidad leídos del Layout de Excel ("Intermedio (lectura y conversación)") no cabían y el
    // INSERT fallaba con 22001 (antes el server lo ocultaba respondiendo 200). VARCHAR→TEXT no
    // reescribe la tabla. Los ids (PK/FK) se quedan en VARCHAR(50).
    await client.query(`
      ALTER TABLE vacancies
        ALTER COLUMN title TYPE TEXT,
        ALTER COLUMN department TYPE TEXT,
        ALTER COLUMN location TYPE TEXT,
        ALTER COLUMN salary_range TYPE TEXT,
        ALTER COLUMN status TYPE TEXT,
        ALTER COLUMN english_level TYPE TEXT,
        ALTER COLUMN modalidad TYPE TEXT;
    `);
    // Unifica áreas guardadas con alias del catálogo ("Comercial" → COMERCIAL, "OTC Pro" → OTCPRO).
    const deptRows = await client.query(`SELECT DISTINCT department FROM vacancies`);
    for (const { department } of deptRows.rows) {
      const normalized = normalizeArea(department);
      if (normalized && normalized !== department) {
        await client.query(`UPDATE vacancies SET department = $1 WHERE department = $2`, [normalized, department]);
        console.log(`[Migración] Área "${department}" → "${normalized}"`);
      }
    }
    await client.query(`
      ALTER TABLE candidates
        ALTER COLUMN name TYPE TEXT,
        ALTER COLUMN email TYPE TEXT,
        ALTER COLUMN phone TYPE TEXT,
        ALTER COLUMN stage TYPE TEXT,
        ALTER COLUMN suggested_time TYPE TEXT,
        ALTER COLUMN channel TYPE TEXT;
    `);
    await client.query(`
      ALTER TABLE vacancies
      ADD COLUMN IF NOT EXISTS required_guidance_level TEXT,
      ADD COLUMN IF NOT EXISTS soft_skills JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS target_date TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);

    // Create learning_weights table
    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_weights (
        id VARCHAR(50) PRIMARY KEY,
        liderazgo NUMERIC(3,2) DEFAULT 1.0,
        comunicacion NUMERIC(3,2) DEFAULT 1.0,
        trabajo_en_equipo NUMERIC(3,2) DEFAULT 1.0,
        habilidades_tecnicas NUMERIC(3,2) DEFAULT 1.0,
        resolucion_de_problemas NUMERIC(3,2) DEFAULT 1.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Índices de alto rendimiento para PostgreSQL (QA & Performance Optimization)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candidates_vacancy_id ON candidates(vacancy_id);
      CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
      CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(stage);
      CREATE INDEX IF NOT EXISTS idx_candidates_fit_score ON candidates(fit_score DESC);
      CREATE INDEX IF NOT EXISTS idx_vacancies_created_at ON vacancies(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
      CREATE INDEX IF NOT EXISTS idx_vacancies_department ON vacancies(department);
    `);

    // Seed initial learning weights
    const res = await client.query("SELECT * FROM learning_weights WHERE id = 'global'");
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO learning_weights (id, liderazgo, comunicacion, trabajo_en_equipo, habilidades_tecnicas, resolucion_de_problemas)
        VALUES ('global', 1.0, 1.0, 1.0, 1.0, 1.0)
      `);
      console.log("EAS AI Recruiting: Pesos iniciales creados.");
    }

    // Seed de datos de muestra SOLO si se pide explícitamente (SEED_SAMPLE_DATA=true).
    // samples.ts contiene datos personales de candidatos reales: no deben sembrarse por default.
    const SEED_SAMPLE_DATA = process.env.SEED_SAMPLE_DATA === 'true';
    const vacCheck = await client.query("SELECT COUNT(*) FROM vacancies");
    if (SEED_SAMPLE_DATA && parseInt(vacCheck.rows[0].count, 10) === 0) {
      for (const v of INITIAL_VACANCIES) {
        await client.query(`
          INSERT INTO vacancies (id, title, department, location, description, requirements, experience_years, salary_range, status, min_competencies, english_level, modalidad)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [v.id, v.title, v.department, v.location, v.description, v.requirements, v.experienceYears, v.salaryRange, v.status, JSON.stringify(v.minCompetenciesRequired || {}), v.englishLevel, v.modalidad]);
      }
      console.log("EAS AI Recruiting: Vacantes iniciales (incluyendo Consultor de Ventas) creadas en DB.");
    }

    // Seed initial candidates if empty
    const candCheck = await client.query("SELECT COUNT(*) FROM candidates");
    if (SEED_SAMPLE_DATA && parseInt(candCheck.rows[0].count, 10) === 0) {
      for (const c of INITIAL_CANDIDATES) {
        await client.query(`
          INSERT INTO candidates (id, name, email, phone, resume_text, stage, competencies, fit_score, initial_fit_score, summary, strengths, growths, recommended_questions, suggested_time, channel, vacancy_id, screening_questions)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone;
        `, [c.id, c.name, c.email, c.phone || '', c.summary || '', c.stage || 'Filtrado', JSON.stringify(c.competencies || {}), c.fitScore || 0, c.initialFitScore || c.fitScore || 0, c.summary || '', c.strengths || [], c.growths || [], [], '', c.channel || 'Otros', c.vacancyId || null, JSON.stringify(c.screeningQuestions || [])]);
      }
      console.log("EAS AI Recruiting: Candidatos iniciales sincronizados con sus correos y teléfonos reales.");
    }

    // Inicializar extensión pgcrypto
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 1. Tabla de credenciales auth_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        reset_code VARCHAR(20),
        reset_expires TIMESTAMPTZ,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(20);
      ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_auth_users_reset_code ON auth_users(reset_code);
    `);

    // 2. Tabla de perfiles app_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('admin', 'leader', 'user', 'director')),
        activo BOOLEAN DEFAULT true,
        primer_login BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Trigger PostgreSQL de sincronización automática auth_users -> app_users
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.app_users (id, email, nombre, rol, activo, primer_login, created_at)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
          COALESCE(NEW.raw_user_meta_data->>'rol', 'user'),
          COALESCE((NEW.raw_user_meta_data->>'activo')::boolean, true),
          COALESCE((NEW.raw_user_meta_data->>'primer_login')::boolean, true),
          NEW.created_at
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          nombre = EXCLUDED.nombre,
          rol = EXCLUDED.rol;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS on_auth_user_created ON auth_users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth_users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    `);

    // 4. Tabla de Auditoría log_auditoria
    await client.query(`
      CREATE TABLE IF NOT EXISTS log_auditoria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID,
        usuario_email TEXT,
        ip_address TEXT,
        accion TEXT NOT NULL,
        modulo TEXT NOT NULL,
        nivel TEXT NOT NULL CHECK (nivel IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
        detalles JSONB DEFAULT '{}'::jsonb,
        fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Desactivado: no neutralizar ni aleatorizar contraseñas existentes de usuarios al arrancar
    // await neutralizeLeakedDefaultPasswords(client);
    await bootstrapAdminFromEnv(client);
    await bootstrapBrandonUser(client);
    await bootstrapEstefanyUser(client);
    await bootstrapEnriqueUser(client);
    await bootstrapEleazarUser(client);
    await refreshIrrelevantScreeningQuestions(client);
    await reevaluateLegacyDoubleChecks(client);
    await cleanExistingCandidateNames(client);
    await cleanEasFromExperience(client);
    await migrateDeprecatedGuidanceLevels(client);
    await recalibrateAllCandidateScores(client);

    console.log("EAS AI Recruiting: Tablas de Autenticación, Roles y Auditoría inicializadas correctamente.");
  }
}

async function recalibrateAllCandidateScores(client: pg.PoolClient) {
  try {
    const vacRows = (await client.query(`SELECT * FROM vacancies`)).rows;
    const vacancyById = new Map<string, any>();
    for (const v of vacRows) {
      let minComp: any = {};
      try {
        minComp = typeof v.min_competencies === 'string' ? JSON.parse(v.min_competencies) : (v.min_competencies || {});
      } catch {}
      vacancyById.set(v.id, {
        id: v.id,
        title: v.title,
        department: v.department,
        description: v.description,
        requirements: v.requirements || [],
        experienceYears: v.experience_years,
        requiredGuidanceLevel: v.required_guidance_level,
        englishLevel: v.english_level,
        modalidad: v.modalidad,
        salaryRange: v.salary_range,
        minCompetenciesRequired: minComp
      });
    }

    const candRows = (await client.query(`SELECT * FROM candidates`)).rows;
    let updatedCount = 0;

    for (const r of candRows) {
      const cleanedName = cleanCandidateName(r.name || '', r.resume_text || '', r.email || '');
      const linkedVac = r.vacancy_id ? vacancyById.get(r.vacancy_id) : undefined;
      let parsedComp: Record<string, number> = {};
      try {
        parsedComp = typeof r.competencies === 'string' ? JSON.parse(r.competencies) : (r.competencies || {});
      } catch {}

      const resolvedCv = resolveAndNormalizeCandidateCvProfile({
        name: cleanedName,
        resumeText: r.resume_text || '',
        summary: r.summary || '',
        experience: Array.isArray(r.experience) ? r.experience : [],
        education: Array.isArray(r.education) ? r.education : [],
        certifications: Array.isArray(r.certifications) ? r.certifications : [],
        fallbackRole: linkedVac?.title || ''
      });

      const candObj = {
        id: r.id,
        name: cleanedName,
        email: r.email || '',
        resumeText: r.resume_text || '',
        summary: r.summary || resolvedCv.summary || '',
        experience: resolvedCv.experience,
        education: resolvedCv.education,
        certifications: resolvedCv.certifications,
        competencies: parsedComp,
        detectedGuidanceLevel: r.detected_guidance_level || undefined
      };

      const strictEval = calculateStrictFitScore(candObj, linkedVac);
      const dynamicComp = calculateCandidateCompetencies(candObj, linkedVac);
      const analyticalSummary = synthesizeAnalyticalCandidateSummary(candObj, linkedVac);
      const guidance = computeGuidanceForCandidate(candObj, linkedVac);

      // Preserve legitimate post-interview feedback delta ONLY if the candidate has explicit feedback comments
      // and is not a domain/healthcare mismatch or severe ±2 seniority lock
      const hasFeedbackAdjustment = /\[Retroalimentación/i.test(r.comments || '');
      const targetFitScore = (hasFeedbackAdjustment && !strictEval.hasDomainMismatch && !strictEval.hasSeniorityGap && typeof r.fit_score === 'number')
        ? r.fit_score
        : strictEval.fitScore;

      await client.query(
        `UPDATE candidates SET
          name = $1,
          suggested_time = '',
          competencies = $2,
          summary = $3,
          fit_score = $4,
          initial_fit_score = $5,
          strengths = $6,
          growths = $7,
          detected_guidance_level = $8,
          experience = $9,
          education = $10,
          certifications = $11
        WHERE id = $12`,
        sanitizeForPg([
          cleanedName,
          JSON.stringify(dynamicComp),
          analyticalSummary,
          targetFitScore,
          strictEval.initialFitScore,
          strictEval.strengths,
          strictEval.growths,
          guidance.candidate.level,
          resolvedCv.experience,
          resolvedCv.education,
          resolvedCv.certifications,
          r.id
        ])
      );
      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`[Migración Continua QA] ${updatedCount} candidatos históricos y actuales recalibrados (sin mapas estáticos, sin copy-paste, sin horas sugeridas, candado ±2 niveles y filtro salud activo).`);
    }
  } catch (e) {
    console.error("Error al recalibrar candidatos en BD:", e);
  }
}

async function migrateDeprecatedGuidanceLevels(client: pg.PoolClient) {
  try {
    const vacRes = await client.query(`
      UPDATE vacancies
      SET required_guidance_level = 'Senior A'
      WHERE required_guidance_level IN ('Guia PM', 'Guía PM', 'Lider Tecnico', 'Líder Técnico', 'Rango 7', 'Rango 8')
    `);
    if (vacRes.rowCount && vacRes.rowCount > 0) {
      console.log(`[Migración] Vacantes ajustadas automáticamente de Guía PM / Líder Técnico a Senior A en BD: ${vacRes.rowCount}`);
    }

    const candRes = await client.query(`
      UPDATE candidates
      SET detected_guidance_level = 'Senior A'
      WHERE detected_guidance_level IN ('Guia PM', 'Guía PM', 'Lider Tecnico', 'Líder Técnico')
    `);
    if (candRes.rowCount && candRes.rowCount > 0) {
      console.log(`[Migración] Candidatos ajustados automáticamente de Guía PM / Líder Técnico a Senior A en BD: ${candRes.rowCount}`);
    }
  } catch (e) {
    console.error("Error al migrar perfiles de vacantes/candidatos deprecados en BD:", e);
  }
}

async function cleanExistingCandidateNames(client: pg.PoolClient) {
  try {
    const rows = (await client.query(`SELECT id, name, resume_text, email FROM candidates`)).rows;
    let updated = 0;
    for (const r of rows) {
      let rawName: string = r.name || '';
      let resumeText: string = r.resume_text || '';
      let email: string = r.email || '';
      if (!rawName) continue;
      const cleaned: string = cleanCandidateName(rawName, resumeText, email);
      if (cleaned && cleaned !== rawName && cleaned !== 'Candidato Consultoría') {
        await client.query(`UPDATE candidates SET name = $1 WHERE id = $2`, [cleaned, r.id]);
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`[Migración] Nombres de candidatos corregidos en BD PostgreSQL: ${updated}`);
    }
  } catch (e) {
    console.error("Error al limpiar nombres de candidatos en BD:", e);
  }
}

async function cleanEasFromExperience(client: pg.PoolClient) {
  try {
    const res = await client.query(`
      SELECT id, experience FROM candidates 
      WHERE array_to_string(experience, ' ') ILIKE '%EAS Consulting%'
         OR array_to_string(experience, ' ') ILIKE '%EAS Group%'
    `);
    let cleanedCount = 0;
    for (const r of res.rows) {
      if (!Array.isArray(r.experience)) continue;
      const newExp = r.experience.map((item: string) => {
        let cleaned = item.replace(/\|\s*(?:TalentPool\s+)?EAS\s+Consulting(?:\s*(?:&|Group|Servicios TI|Empresas Corporativas|\-\s*Coca Cola FEMSA)?)\s*\|/gi, '| Empresa del Sector Privado / Servicios TI |');
        cleaned = cleaned.replace(/EAS\s+Consulting\s*(&|\-)?\s*/gi, 'Empresa Corporativa / ');
        return cleaned.trim();
      });
      await client.query(`UPDATE candidates SET experience = $1 WHERE id = $2`, [newExp, r.id]);
      cleanedCount++;
    }
    if (cleanedCount > 0) {
      console.log(`[Migración] Experiencia laboral con EAS Consulting limpiada en ${cleanedCount} candidatos.`);
    }
  } catch (e) {
    console.error("Error al limpiar experiencia de EAS Consulting en BD:", e);
  }
}

// Candidatos con cuestionario del generador anterior (p. ej. preguntas de SAP SD para una vacante de
// ventas): si alguna de las 3 preguntas de experiencia no tiene relación con su vacante y aún no hay
// respuestas capturadas, se regenera con el motor nuevo. Nunca se tocan cuestionarios ya respondidos.
async function refreshIrrelevantScreeningQuestions(client: pg.PoolClient) {
  const rows = (await client.query(`
    SELECT c.id, c.name, c.resume_text, c.summary, c.experience, c.screening_questions,
           v.title, v.department, v.requirements
    FROM candidates c JOIN vacancies v ON v.id = c.vacancy_id
  `)).rows;
  let refreshed = 0;
  for (const r of rows) {
    const current = parseJsonField(r.screening_questions, []) as { question?: string; answer?: string }[];
    if (current.some(q => q?.answer && String(q.answer).trim())) continue;
    const vacancy = { title: r.title, department: r.department, requirements: r.requirements || [] };
    const experience = current.map(q => q?.question || '').filter(q => q && !FIXED_AVAILABILITY_SET.has(q)).slice(0, 3);
    if (experience.length === 3 && experience.every(q => isQuestionRelevant(q, vacancy))) continue;
    const questions = generateExperienceQuestions(vacancy, { name: r.name, resumeText: r.resume_text, summary: r.summary, experience: r.experience || [] }, { seed: r.id });
    await client.query(
      `UPDATE candidates SET screening_questions = $1, recommended_questions = $2 WHERE id = $3`,
      [JSON.stringify(buildScreeningQuestions(questions)), questions, r.id]
    );
    refreshed++;
  }
  if (refreshed) console.log(`[Migración] Cuestionarios sin relación con su vacante regenerados: ${refreshed}`);
}

// Double-Checks evaluados con el motor anterior (dictamen "Dictamen oficial Double-Check: ...", que sumaba
// puntos por palabras sueltas): se re-evalúan con la rúbrica crítica sobre las respuestas guardadas.
// Las respuestas que el sistema anterior inventaba ("Respuesta registrada para validación técnica.") cuentan como vacías.
async function reevaluateLegacyDoubleChecks(client: pg.PoolClient) {
  const rows = (await client.query(`
    SELECT c.id, c.name, c.resume_text, c.experience, c.fit_score, c.initial_fit_score, c.screening_questions, c.double_check_report,
           v.title, v.department, v.requirements, v.salary_range, v.modalidad
    FROM candidates c JOIN vacancies v ON v.id = c.vacancy_id
    WHERE c.double_check_report LIKE 'Dictamen oficial Double-Check%'
  `)).rows;
  let count = 0;
  for (const r of rows) {
    const qs = (parseJsonField(r.screening_questions, []) as { question?: string; answer?: string }[])
      .filter(q => q?.question)
      .map(q => ({ question: String(q.question), answer: /^Respuesta registrada para validaci/i.test(q.answer || '') ? '' : String(q.answer || '') }));
    if (!qs.some(q => q.answer.trim())) continue;
    const base = Number(r.initial_fit_score ?? r.fit_score) || 0;
    const result = evaluateDoubleCheck({
      questions: qs,
      vacancy: { title: r.title, department: r.department, requirements: r.requirements || [], salaryRange: r.salary_range, modalidad: r.modalidad },
      candidate: { name: r.name, resumeText: r.resume_text || '', experience: r.experience || [] },
      baseScore: base,
    });
    await client.query(
      `UPDATE candidates SET fit_score = $1, initial_fit_score = $2, double_check_report = $3, screening_questions = $4 WHERE id = $5`,
      [result.fitScore, base, result.report + '\n\n(Re-evaluado automáticamente con la rúbrica crítica; el dictamen anterior sumaba puntos por palabras clave.)',
       JSON.stringify(qs.map((q, i) => ({ id: i + 1, ...q }))), r.id]
    );
    count++;
  }
  if (count) console.log(`[Migración] Double-Checks re-evaluados con la rúbrica crítica: ${count}`);
}

const LEAKED_DEFAULT_PASSWORDS = ['Admin2026!'];

async function neutralizeLeakedDefaultPasswords(client: pg.PoolClient) {
  const res = await client.query(`SELECT id, email, password_hash FROM auth_users`);
  for (const row of res.rows) {
    for (const leaked of LEAKED_DEFAULT_PASSWORDS) {
      if (row.password_hash && await bcrypt.compare(leaked, row.password_hash)) {
        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
        await client.query(`UPDATE auth_users SET password_hash = $1 WHERE id = $2`, [randomHash, row.id]);
        await client.query(`UPDATE app_users SET primer_login = true WHERE id = $1`, [row.id]);
        console.error(`[SEGURIDAD] La cuenta ${row.email} usaba una contraseña por defecto publicada. Se invalidó; restablécela con ADMIN_BOOTSTRAP_* o desde el panel de un admin.`);
      }
    }
  }
}

async function bootstrapAdminFromEnv(client: pg.PoolClient) {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
  if (!email || !password) return;
  if (password.length < 12 || LEAKED_DEFAULT_PASSWORDS.includes(password)) {
    console.error("[SEGURIDAD] ADMIN_BOOTSTRAP_PASSWORD ignorada: debe tener 12+ caracteres y no ser una contraseña publicada.");
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const authRes = await client.query(
    `INSERT INTO auth_users (email, password_hash, raw_user_meta_data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [email, hash, JSON.stringify({ nombre: email.split('@')[0], rol: 'admin', activo: true, primer_login: true })]
  );
  await client.query(
    `INSERT INTO app_users (id, email, nombre, rol, activo, primer_login)
     VALUES ($1, $2, $3, 'admin', true, true)
     ON CONFLICT (id) DO UPDATE SET rol = 'admin', activo = true, primer_login = true`,
    [authRes.rows[0].id, email, email.split('@')[0]]
  );
  console.warn(`[SEGURIDAD] Admin de arranque asegurado para ${email}. Quita ADMIN_BOOTSTRAP_PASSWORD del .env después del primer login.`);
}

async function bootstrapNamedAdminFromEnv(
  client: pg.PoolClient,
  envVarName: string,
  fullName: string,
  emails: string[]
) {
  const rawPassword = process.env[envVarName] || '';
  if (!rawPassword || rawPassword.length < 12) return;
  const hash = await bcrypt.hash(rawPassword, 12);

  for (const email of emails) {
    const authRes = await client.query(
      `INSERT INTO auth_users (email, password_hash, raw_user_meta_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, hash, JSON.stringify({ nombre: fullName, rol: 'admin', activo: true, primer_login: false })]
    );

    if (authRes.rows.length > 0) {
      await client.query(
        `INSERT INTO app_users (id, email, nombre, rol, activo, primer_login)
         VALUES ($1, $2, $3, 'admin', true, false)
         ON CONFLICT (id) DO UPDATE SET rol = 'admin', activo = true, primer_login = false`,
        [authRes.rows[0].id, email, fullName]
      );
    }
  }
  console.log(`[SEGURIDAD] Cuentas de usuario aseguradas para ${fullName} (${emails.join(', ')}).`);
}

async function bootstrapBrandonUser(client: pg.PoolClient) {
  return bootstrapNamedAdminFromEnv(client, 'BRANDON_PASSWORD', 'Brandon Flores', [
    'brandon.flores@easconsulting.com.mx',
    'brandon@easconsulting.com.mx',
    'brandon.flores@eas-consulting.com'
  ]);
}

async function bootstrapEstefanyUser(client: pg.PoolClient) {
  return bootstrapNamedAdminFromEnv(client, 'ESTEFANY_PASSWORD', 'Estefany Reyes', [
    'estefany.reyes@easconsulting.com.mx',
    'estefany@easconsulting.com.mx',
    'estefany.rodriguez@easconsulting.com.mx',
    'estefany.reyes@eas-consulting.com'
  ]);
}

async function bootstrapEnriqueUser(client: pg.PoolClient) {
  return bootstrapNamedAdminFromEnv(client, 'ENRIQUE_PASSWORD', 'Enrique Aguilar', [
    'enrique.aguilar@easconsulting.com.mx',
    'eaguilarh@easconsulting.com.mx',
    'eaguilar@easconsulting.com.mx',
    'enrique.aguilar@eas-consulting.com'
  ]);
}

async function bootstrapEleazarUser(client: pg.PoolClient) {
  return bootstrapNamedAdminFromEnv(client, 'ELEAZAR_PASSWORD', 'Eleazar Carrasco', [
    'eleazar.carrasco@easconsulting.com.mx',
    'eleazar@easconsulting.com.mx',
    'eleazar.carrasco@eas-consulting.com'
  ]);
}

async function backfillExistingCandidatesMetadata() {
  if (useDbFallback) return;
  try {
    const client = getGeminiClient();
    if (!client) {
      console.log("[Backfill] Skipping backfill, no Gemini API Client config found.");
      return;
    }

    const result = await pool.query(`
      SELECT id, name, resume_text 
      FROM candidates 
      WHERE resume_text IS NOT NULL 
        AND (experience IS NULL OR array_length(experience, 1) IS NULL OR experience = '{}')
    `);

    const candidatesToBackfill = result.rows;
    if (candidatesToBackfill.length === 0) {
      console.log("[Backfill] No candidates need metadata extraction.");
      return;
    }

    console.log(`[Backfill] Starting metadata extraction for ${candidatesToBackfill.length} candidates...`);

    for (const c of candidatesToBackfill) {
      try {
        // Retraso para respetar los límites de llamadas por minuto (RPM) de la API Key de Gemini
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`[Backfill] Extracting metadata for candidate: ${c.name} (${c.id})...`);
        const prompt = `Analiza el siguiente currículum y extrae estructuradamente la información de los ÚLTIMOS 3 EMPLEOS (o hasta 3 puestos recientes), Educación y Certificaciones.
CV:
${c.resume_text}

Devuelve un JSON con los siguientes campos:
1. experience: Lista de HASTA 3 EMPLEOS MÁS RECIENTES del candidato en formato estricto: "Puesto | Empresa | Periodo | Responsabilidades y Logros Clave" (ej. "Consultor SAP Senior | DXC Technology | 2021 - 2025 | Liderazgo en migración a S/4HANA y soporte a PMO").
2. education: Lista de grados académicos en formato estricto: "Carrera Cursada | Escuela o Institución | Periodo" (ej. "Licenciatura en Sistemas Computacionales | Universidad Nacional Autónoma de México (UNAM) | 2017 - 2021").
3. certifications: Lista de certificaciones en formato estricto: "Certificación | Institución | Año" (ej. "Scrum Master PSM I | Scrum.org | 2023").`;

        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                experience: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de los últimos 3 empleos del candidato obligatoriamente en formato: Puesto | Empresa | Periodo | Responsabilidades y Logros" },
                education: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de educación en formato: Carrera Cursada | Escuela o Institución | Periodo" },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de certificaciones en formato: Certificación | Institución | Año" }
              },
              required: ["experience", "education", "certifications"]
            }
          }
        });

        const jsonText = cleanGeminiJson(response.text || "{}");
        const parsed = JSON.parse(jsonText);

        await pool.query(`
          UPDATE candidates 
          SET experience = $1, education = $2, certifications = $3 
          WHERE id = $4
        `, [
          parsed.experience || [],
          parsed.education || [],
          parsed.certifications || [],
          c.id
        ]);
        console.log(`[Backfill] Successfully backfilled metadata for ${c.name}`);
      } catch (err) {
        console.error(`[Backfill] Failed to extract metadata for ${c.name}:`, err);
      }
    }
  } catch (error) {
    console.error("[Backfill] Error in backfill process:", error);
  }
}

const customRequire = createRequire(typeof __filename !== "undefined" ? __filename : import.meta.url);

let pdf: any = null;
try {
  const loadedPdf = customRequire("pdf-parse");
  pdf = loadedPdf && loadedPdf.default ? loadedPdf.default : loadedPdf;
} catch (e) {
  console.warn("Failed to load pdf-parse dynamically, using fallback decoder:", e);
}

let mammoth: any = null;
try {
  mammoth = customRequire("mammoth");
} catch (e) {
  console.warn("Failed to load mammoth dynamically, using fallback decoder:", e);
}

// Global notification triggers to keep n8n updated with every system change
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'eas-recruiting-n8n-sync-secret';

function notifyN8nCandidateChange(candidate: any, action: string) {
  try {
    const webhookUrl = process.env.N8N_CANDIDATE_SYNC_WEBHOOK || process.env.N8N_URL || 'http://10.10.10.103:5678/webhook/candidato-sync';
    if (!webhookUrl) return;
    const payload = {
      event: 'candidate_change',
      action: action,
      timestamp: new Date().toISOString(),
      candidate: {
        id: candidate?.id,
        name: candidate?.name,
        email: candidate?.email,
        phone: candidate?.phone,
        stage: candidate?.stage,
        fitScore: candidate?.fitScore || candidate?.fit_score,
        channel: candidate?.channel || 'EAS Consulting DB',
        vacancyId: candidate?.vacancyId || candidate?.vacancy_id,
        suggestedTime: candidate?.suggestedTime || candidate?.suggested_time,
        experience: candidate?.experience || [],
        summary: candidate?.summary || '',
        screeningQuestions: candidate?.screeningQuestions || candidate?.screening_questions || [],
        history: candidate?.history
      }
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', N8N_WEBHOOK_SECRET).update(body).digest('hex');
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-n8n-Signature': signature
      },
      body: body
    }).catch(err => console.warn("Notice: n8n candidate sync dispatch:", err?.message));
  } catch (err: any) {
    console.warn("Notice: n8n candidate sync dispatch failed:", err?.message);
  }
}

function notifyN8nVacancyChange(vacancy: any, action: string) {
  try {
    const webhookUrl = process.env.N8N_VACANCY_SYNC_WEBHOOK || process.env.N8N_URL || 'http://10.10.10.103:5678/webhook/vacancia-sync';
    if (!webhookUrl) return;
    const payload = {
      event: 'vacancy_change',
      action: action,
      timestamp: new Date().toISOString(),
      vacancy: vacancy
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', N8N_WEBHOOK_SECRET).update(body).digest('hex');
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-n8n-Signature': signature
      },
      body: body
    }).catch(err => console.error("Error notifying n8n vacancy sync:", err));
  } catch (err: any) {
    console.warn("Notice: n8n vacancy sync dispatch failed:", err?.message);
  }
}

// Helper functions for continuous learning loop using PostgreSQL
async function getLearningWeights(): Promise<Record<string, number>> {
  try {
    const res = await pool.query("SELECT * FROM learning_weights WHERE id = 'global'");
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        'Liderazgo': Number(row.liderazgo),
        'Comunicación': Number(row.comunicacion),
        'Trabajo en Equipo': Number(row.trabajo_en_equipo),
        'Habilidades Técnicas': Number(row.habilidades_tecnicas),
        'Resolución de Problemas': Number(row.resolucion_de_problemas)
      };
    }
  } catch (e) {
    console.error("Error reading learning weights from DB:", e);
  }
  return {
    'Liderazgo': 1.0,
    'Comunicación': 1.0,
    'Trabajo en Equipo': 1.0,
    'Habilidades Técnicas': 1.0,
    'Resolución de Problemas': 1.0
  };
}

async function saveLearningWeights(weights: Record<string, number>) {
  try {
    await pool.query(`
      INSERT INTO learning_weights (id, liderazgo, comunicacion, trabajo_en_equipo, habilidades_tecnicas, resolucion_de_problemas)
      VALUES ('global', $1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        liderazgo = EXCLUDED.liderazgo,
        comunicacion = EXCLUDED.comunicacion,
        trabajo_en_equipo = EXCLUDED.trabajo_en_equipo,
        habilidades_tecnicas = EXCLUDED.habilidades_tecnicas,
        resolucion_de_problemas = EXCLUDED.resolucion_de_problemas,
        updated_at = CURRENT_TIMESTAMP
    `, [
      weights['Liderazgo'],
      weights['Comunicación'],
      weights['Trabajo en Equipo'],
      weights['Habilidades Técnicas'],
      weights['Resolución de Problemas']
    ]);
  } catch (e) {
    console.error("Error saving learning weights to DB:", e);
  }
}


const app = express();

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const url = req.originalUrl || req.url;
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${url} -> ${res.statusCode} (${Date.now() - start}ms) [${req.ip}]`);
  });
  next();
});

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=0");
  next();
});

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  password: z.string().min(8).max(128)
});

const vacancySchema = z.object({
  id: z.string().max(50).optional(),
  title: z.string().min(3).max(255),
  department: z.string().max(100).default('General'),
  location: z.string().max(100).default('CDMX - Híbrido'),
  description: z.string().min(10).max(10000),
  requirements: z.array(z.string().max(500)).max(50).default([]),
  experienceYears: z.number().int().min(0).max(50).default(0),
  salaryRange: z.string().max(100).optional(),
  status: z.enum(['Activa', 'Inactiva', 'Cerrada', 'Pausada']).default('Activa'),
  minCompetenciesRequired: z.record(z.number().min(0).max(100)).default({}),
  englishLevel: z.enum(['Básico', 'Intermedio', 'Avanzado', 'Nativo', 'No requerido']).default('Avanzado'),
  modalidad: z.enum(['Presencial', 'Híbrido', 'Remoto']).default('Híbrido')
});

const candidateSchema = z.object({
  id: z.string().max(50),
  name: z.string().min(2).max(255),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  resumeText: z.string().max(50000).optional(),
  stage: z.enum(['Filtrado', 'Screening', 'Entrevista', 'Oferta', 'Contratado', 'Rechazado', 'Pool', 'Nuevas Opciones']).default('Filtrado'),
  vacancyId: z.string().max(50).nullable().optional(),
  channel: z.string().max(50).default('Otros')
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
});

const recoveryPinSchema = z.object({
  email: z.string().email().toLowerCase().max(255)
});

const verifyPinSchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  pinCode: z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)
});

const PORT = Number(process.env.PORT || 3000);

// IP real detrás de nginx: solo se confía en X-Forwarded-For de proxies de red privada/loopback.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, uniquelocal');

// CORS: Soporte para dominios corporativos (fortiddns, eas.com.mx, easconsulting.com.mx, localhost, etc.)
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isCorporateDomain = !!origin && (
    CORS_ORIGINS.length === 0 ||
    CORS_ORIGINS.includes(origin) ||
    /easconsulting|eas\.com\.mx|fortiddns|localhost|127\.0\.0\.1|10\.10\.10\./i.test(origin)
  );

  if (origin) {
    res.header("Access-Control-Allow-Origin", isCorporateDomain ? origin : "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-api-key, x-user-email, x-user-name, x-user-role");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  // Cabeceras de seguridad básicas
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "SAMEORIGIN");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: '5mb' }));

// Gate de base de datos: si PostgreSQL no está conectado, las rutas responden 503 explícito
// (antes: se guardaba en memoria en silencio y el cambio se perdía al reiniciar).
app.use(['/api', '/auth', '/admin'], (req, res, next) => {
  if (useDbFallback || dbReady || req.path === '/health') return next();
  return res.status(503).json({
    error: "Base de datos no disponible",
    message: "PostgreSQL no está conectado. Ningún cambio se guardará hasta que se restablezca la conexión.",
    detail: dbLastError
  });
});

// Autenticación obligatoria para TODA la API excepto la lista pública explícita.
// Antes solo algunas rutas destructivas la tenían (y la primera definición de cada una,
// que es la que Express ejecuta, no la tenía); GET /api/candidates exponía toda la PII sin login.
const PUBLIC_API_ROUTES: Array<[string, RegExp]> = [
  ['GET', /^\/api\/health$/],
  ['POST', /^\/api\/auth\/login$/],
  ['POST', /^\/auth\/v1\/recover$/],
  ['POST', /^\/api\/auth\/recover$/],
  ['POST', /^\/api\/auth\/request-recovery-pin$/],
  ['POST', /^\/auth\/v1\/reset-password$/],
  ['POST', /^\/api\/auth\/reset-password$/],
  ['POST', /^\/api\/auth\/verify-recovery-pin$/],
  ['GET', /^\/api\/public\/vacancies$/],
  ['POST', /^\/api\/public\/applications$/],
  ['POST', /^\/api\/candidates\/apply$/],
  ['POST', /^\/api\/candidates\/submit-screening$/],
  ['GET', /^\/api\/audit-logs$/],
  ['POST', /^\/api\/audit-logs$/],
];
const authPool = useDbFallback ? null : pool;
const requireAuth = authenticateToken(authPool);
app.use('/api', (req, res, next) => {
  const fullPath = req.baseUrl + req.path;
  const isPublic = PUBLIC_API_ROUTES.some(([method, re]) => (method === req.method || (method === 'GET' && req.method === 'HEAD')) && re.test(fullPath));
  if (isPublic) return next();
  return requireAuth(req as AuthenticatedRequest, res, next);
});

interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

function createRateLimiter(maxRequests: number, windowMs: number, customMessage?: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // req.ip ya respeta 'trust proxy'; leer X-Forwarded-For a mano permitía evadir el límite rotando la cabecera.
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.path}:${rawIp}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retrySec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retrySec);
      return res.status(429).json({
        success: false,
        error: 'Límite de Peticiones Excedido (Rate Limit Exceeded)',
        message: customMessage || 'Ha superado el límite de intentos permitidos. Por favor espere unos momentos.',
        retryAfterSeconds: retrySec
      });
    }

    record.count += 1;
    next();
  };
}

// Desactivado el bloqueo de 5 minutos para login para permitir intentos normales sin generar stoppers
const loginRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => next();
const aiQuotaRateLimiter = createRateLimiter(35, 5 * 60 * 1000, 'Demasiadas consultas al motor de IA en un periodo corto. Por favor espere unos minutos.');

// Bind Native Authentication & RBAC User Management Controllers
// Nota: estas son las ÚNICAS definiciones de estas rutas. Existían duplicados más abajo (el que
// tenía requireRole(['admin']) nunca se ejecutaba porque Express usa la primera coincidencia).
app.post("/auth/login", loginRateLimiter, (req: express.Request, res: express.Response) => handleLogin(authPool, req, res));
app.post("/api/auth/login", loginRateLimiter, (req: express.Request, res: express.Response) => handleLogin(authPool, req, res));
app.get("/auth/me", requireAuth, (req: express.Request, res: express.Response) => {
  res.json({ success: true, user: (req as AuthenticatedRequest).user });
});
app.put("/auth/change-password", loginRateLimiter, requireAuth, (req: express.Request, res: express.Response) => handleChangePassword(authPool, req as AuthenticatedRequest, res));
app.put("/api/auth/change-password", loginRateLimiter, (req: express.Request, res: express.Response) => handleChangePassword(authPool, req as AuthenticatedRequest, res));
app.post("/admin/users", requireAuth, requireRole(['admin']), (req: express.Request, res: express.Response) => handleAdminUsers(authPool, req as AuthenticatedRequest, res));
app.post("/api/admin/users", requireRole(['admin']), (req: express.Request, res: express.Response) => handleAdminUsers(authPool, req as AuthenticatedRequest, res));

// Configure memory storage for uploaded CVs safely with direct multer instance
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for bulk CV uploads
  }
});

// Recuperación de contraseña por PIN.
// Antes: PIN con Math.random(), devuelto en el JSON de respuesta, escrito en consola y en
// log_auditoria; y la verificación aceptaba "123456" como PIN universal y reseteaba la
// contraseña de CUALQUIER correo si nunca se había pedido un PIN (condición `stored && ...`).
const RECOVERY_PIN_TTL_MS = 15 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;
const recoveryPins = new Map<string, { pinHash: string; expiresAt: number; attempts: number }>();
const recoveryRateLimiter = createRateLimiter(30, 15 * 60 * 1000, 'Demasiadas solicitudes de recuperación. Espera unos minutos.');

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// Password Recovery 2-Step Endpoints (DB Stored Code + n8n Webhook Dispatch)
app.post("/auth/v1/recover", recoveryRateLimiter, (req, res) => handleRecoverPasswordRequest(authPool, req, res));
app.post("/api/auth/recover", recoveryRateLimiter, (req, res) => handleRecoverPasswordRequest(authPool, req, res));
app.post("/api/auth/request-recovery-pin", recoveryRateLimiter, (req, res) => handleRecoverPasswordRequest(authPool, req, res));

app.post("/auth/v1/reset-password", recoveryRateLimiter, (req, res) => handleResetPasswordExecute(authPool, req, res));
app.post("/api/auth/reset-password", recoveryRateLimiter, (req, res) => handleResetPasswordExecute(authPool, req, res));
app.post("/api/auth/verify-recovery-pin", recoveryRateLimiter, (req, res) => handleResetPasswordExecute(authPool, req, res));


// Multi-AI Credentials & Gateway (Google Gemini, Anthropic Claude, OpenAI GPT-4o)
const ANTHROPIC_API_KEY_DEFAULT = process.env.ANTHROPIC_API_KEY || "";
const OPENAI_API_KEY_DEFAULT = process.env.OPENAI_API_KEY || "";

async function callAnthropicClaude(prompt: string, systemInstruction: string, customApiKey?: string): Promise<string | null> {
  const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY || ANTHROPIC_API_KEY_DEFAULT;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: systemInstruction,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) {
      const errTxt = await res.text();
      console.warn("[Anthropic API Warning]:", res.status, errTxt);
      return null;
    }
    const data: any = await res.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.error("Error calling Anthropic Claude API:", err);
    return null;
  }
}

async function callOpenAI(prompt: string, systemInstruction: string, customApiKey?: string): Promise<string | null> {
  const apiKey = customApiKey || process.env.OPENAI_API_KEY || OPENAI_API_KEY_DEFAULT;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (!res.ok) {
      const errTxt = await res.text();
      console.warn("[OpenAI API Warning]:", res.status, errTxt);
      return null;
    }
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("Error calling OpenAI API:", err);
    return null;
  }
}

// Initialize Gemini Client safely (lazy model access avoids crashes if key is empty)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  // If using process env key and it's already built, return singleton
  if (!customApiKey && aiClient) return aiClient;
  
  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 10000,
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    if (!customApiKey) {
      aiClient = client;
    }
    return client;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    return null;
  }
}

// Clean and sanitize string from Gemini responses before parsing as JSON
function cleanGeminiJson(rawText: string): string {
  let cleaned = rawText.trim();
  // Strip opening markdown code block fence if present
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/, "");
  // Strip trailing markdown code block fence if present
  cleaned = cleaned.replace(/\s*```$/, "");
  return fixCorruptedAccents(cleaned.trim());
}

// Heuristic fallbacks for scanned, protected, or unreadable CV uploads
function extractPdfTextFallback(buffer: Buffer): string {
  try {
    const raw = buffer.toString("utf-8");
    
    // 1. Try to pluck standard PDF text syntax segments enclosed in parentheses: (My text) Tj/TJ
    const parenthesisMatches: string[] = [];
    const parenthesizedRegex = /\(([^)]+)\)\s*(?:Tj|TJ|\n)/g;
    let match;
    while ((match = parenthesizedRegex.exec(raw)) !== null) {
      if (match[1] && match[1].length > 1) {
        const cleaned = match[1]
          .replace(/\\([\(\)])/g, "$1") // unescape parenthesis
          .replace(/[^\x20-\x7E\sÁÉÍÓÚÑáéíóúñ]/g, " "); // keep standard printable characters
        parenthesisMatches.push(cleaned);
      }
    }

    if (parenthesisMatches.length > 10) {
      const merged = parenthesisMatches.join(" ").replace(/\s+/g, " ").trim();
      if (merged.length > 50) {
        return merged.substring(0, 4500);
      }
    }

    // 2. Otherwise search for readable blocks of characters but completely ignore PDF syntax tags
    const textMatches = raw.match(/[\w\sÁÉÍÓÚÑáéíóúñ@.+-]{4,100}/g) || [];
    const filteredMatches = textMatches.filter(item => {
      const lower = item.toLowerCase().trim();
      if (!lower) return false;
      
      // Filter out PDF commands, metadata streams, page parameters, and references
      if (
        lower.includes("mediabox") ||
        lower.includes("flatedecode") ||
        lower.includes("parent") ||
        lower.includes("resources") ||
        lower.includes("extgstate") ||
        lower.includes("procset") ||
        lower.includes("xobject") ||
        lower.includes("endobj") ||
        lower.includes("length") ||
        lower.includes("stream") ||
        lower.includes("endstream") ||
        lower.includes("font") ||
        lower.includes("/type") ||
        lower.includes("/page") ||
        /^[a-f0-9\s]{20,}$/i.test(item) || // hex data
        /^\s*\d+\s+\d+\s+r\b/i.test(item)  // references like '1 0 R'
      ) {
        return false;
      }
      return true;
    });

    if (filteredMatches.length > 5) {
      return filteredMatches.join(" ").replace(/\s+/g, " ").substring(0, 4500);
    }

    // Default basic fallback
    const cleaned = raw.replace(/[^\x20-\x7E\sÁÉÍÓÚÑáéíóúñ]/g, " ");
    return cleaned.replace(/\s+/g, " ").substring(0, 4500);
  } catch (err) {
    console.error("Fallback text extractor failed:", err);
    return "";
  }
}

// Precise Extraction of real phone numbers from text
function extractPhoneFromText(txt: string): string | null {
  if (!txt) return null;
  // Clean coordinates and false positives by looking for actual phone layout blocks
  const phoneRegex = /(?:\+?[\d]{1,4}[-\s.]?)?\(?\d{2,4}\)?[-\s.]?\d{3,4}[-\s.]?\d{3,4}/g;
  const candidates = txt.match(phoneRegex) || [];
  
  for (const cand of candidates) {
    const trimmed = cand.trim();
    if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes(":")) {
      continue;
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      if (!trimmed.includes(".") || (trimmed.match(/\./g) || []).length === 0) {
        return trimmed;
      }
    }
  }

  const simplerMatch = txt.match(/\b\d{10,14}\b/);
  if (simplerMatch) {
    return simplerMatch[0];
  }

  return null;
}

// Precise Extraction of real email addresses from text
function extractEmailFromText(txt: string): string | null {
  if (!txt) return null;

  // 1. Match standard email addresses (ignoring example.com/sample.com placeholders)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = txt.match(emailRegex);
  if (matches && matches.length > 0) {
    const valid = matches.find(e => 
      !e.toLowerCase().includes("example.com") && 
      !e.toLowerCase().includes("sample.com") &&
      !e.toLowerCase().includes("domain.com")
    );
    if (valid) return valid.toLowerCase().trim();
    return matches[0].toLowerCase().trim();
  }

  // 2. Match emails with spaces around @ or dots (common in extracted PDF text)
  const relaxedRegex = /([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,})/i;
  const relaxed = txt.match(relaxedRegex);
  if (relaxed) {
    const cleanedDomain = relaxed[2].replace(/\s+/g, "");
    return `${relaxed[1]}@${cleanedDomain}`.toLowerCase().trim();
  }

  return null;
}


function parseFromFilename(filename: string) {
  try {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    // Separate camelCase, snake_case, and non-alpha characters
    let cleanName = nameWithoutExt
      .replace(/[-_]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b(cv|resume|curriculum|currículum|pdf|docx|txt|doc|de|para|eas|talent|core|consultor|consultora|consultores|sd|sap|abap|módulos|modulos|implementados|ventas|gerente|director|directora|analista|analyst|developer|desarrollador|desarrolladora|senior|sr|junior|jr|lead|lider|coordinador|coordinadora|jefe|jefa|microsoft|azure|architect|cloud|solutions|engineer|especialista|specialist|consultant|pm|pmp|po|sm|qa|dev|btp|cpi|hcm|ariba|sfsf|solman|sac|s4hana|ecc|otc|otcpro|mm|fi|co|pp|wm|qm|basis|bi|ai|rh|it|ti|b2b)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    // Capitalize words
    cleanName = cleanName
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    const lowerClean = cleanName.toLowerCase();
    const buzzwords = [
      "altamente eficientes", "altamente eficiente", "módulos implementados", "modulos implementados", 
      "perfil profesional", "resumen ejecutivo", "experiencia laboral", "work experience", "laboratorios liomont",
      "liomont", "customer viakable", "viakable", "employment history", "datos personales", "informacion personal"
    ];
    if (buzzwords.some(b => lowerClean.includes(b)) || cleanName.length < 3 || /^(laboratorios|customer|work|employment)\b/i.test(lowerClean)) {
      cleanName = "";
    }

    let guessedRole = "Consultor de Capital Humano";
    const lowerFile = filename.toLowerCase();
    if (/\b(data|analyst|analista|sql|bi)\b/i.test(lowerFile)) {
      guessedRole = "Data Analyst";
    } else if (/\b(frontend|react|angular|vue|web\s+developer|frontend\s+developer)\b/i.test(lowerFile)) {
      guessedRole = "Frontend Developer";
    } else if (/\b(gerente|manager|director|lider|socio)\b/i.test(lowerFile)) {
      guessedRole = "Hiring Manager";
    } else if (/\b(azure|cloud|architect|arquitecto|aws)\b/i.test(lowerFile)) {
      guessedRole = "Cloud & Azure Architect";
    }

    return {
      name: cleanName || "",
      role: guessedRole
    };
  } catch (err) {
    return {
      name: "",
      role: "Consultor de Capital Humano"
    };
  }
}

let aiWeights = {
  Liderazgo: 15,
  Comunicacion: 15,
  TrabajoEnEquipo: 15,
  HabilidadesTecnicas: 30,
  ResolucionDeProblemas: 25,
  totalFeedbackCount: 0
};

// Ajuste dinámico de pesos con algoritmo heurístico de aprendizaje continuo
function adjustWeights(recommendation: string, competencies: Record<string, number>) {
  const keyMap: Record<string, 'Liderazgo' | 'Comunicacion' | 'TrabajoEnEquipo' | 'HabilidadesTecnicas' | 'ResolucionDeProblemas'> = {
    'Liderazgo': 'Liderazgo',
    'Comunicación': 'Comunicacion',
    'Trabajo en Equipo': 'TrabajoEnEquipo',
    'Habilidades Técnicas': 'HabilidadesTecnicas',
    'Resolución de Problemas': 'ResolucionDeProblemas'
  };

  aiWeights.totalFeedbackCount += 1;
  const isApproved = recommendation === 'hired' || recommendation === 'review';
  const LEARNING_RATE = 2.0;

  for (const [rawKey, score] of Object.entries(competencies)) {
    const key = keyMap[rawKey];
    if (!key) continue;

    if (isApproved) {
      if (score >= 75) {
        aiWeights[key] += LEARNING_RATE;
      } else if (score < 50) {
        aiWeights[key] = Math.max(5, aiWeights[key] - LEARNING_RATE);
      }
    } else {
      if (score >= 75) {
        aiWeights[key] = Math.max(5, aiWeights[key] - LEARNING_RATE);
      } else if (score < 50) {
        aiWeights[key] += LEARNING_RATE;
      }
    }
  }

  // Normalizar pesos para que sumen exactamente 100
  const sum = aiWeights.Liderazgo + aiWeights.Comunicacion + aiWeights.TrabajoEnEquipo + aiWeights.HabilidadesTecnicas + aiWeights.ResolucionDeProblemas;
  aiWeights.Liderazgo = Math.round((aiWeights.Liderazgo / sum) * 100);
  aiWeights.Comunicacion = Math.round((aiWeights.Comunicacion / sum) * 100);
  aiWeights.TrabajoEnEquipo = Math.round((aiWeights.TrabajoEnEquipo / sum) * 100);
  aiWeights.HabilidadesTecnicas = Math.round((aiWeights.HabilidadesTecnicas / sum) * 100);
  aiWeights.ResolucionDeProblemas = Math.round((aiWeights.ResolucionDeProblemas / sum) * 100);

  const finalSum = aiWeights.Liderazgo + aiWeights.Comunicacion + aiWeights.TrabajoEnEquipo + aiWeights.HabilidadesTecnicas + aiWeights.ResolucionDeProblemas;
  const diff = 100 - finalSum;
  aiWeights.HabilidadesTecnicas += diff;
}

// API Routes
app.get("/api/ai-weights", async (req, res) => {
  const weights = await getLearningWeights();
  res.json(weights);
});

// (Eliminado: POST /api/admin/clear-database sin autenticación. La única definición vigente
// está más abajo, protegida con requireRole(['admin']).)

// ---- Mapeo único fila PostgreSQL → objeto del front (usado por GET, POST y PATCH) ----
function mapVacancyRow(row: any) {
  const baseVac = {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    description: row.description,
    requirements: row.requirements || [],
    experienceYears: row.experience_years,
    salaryRange: row.salary_range,
    status: row.status,
    minCompetenciesRequired: row.min_competencies || {},
    englishLevel: row.english_level,
    modalidad: row.modalidad,
    requiredGuidanceLevel: row.required_guidance_level || undefined,
    softSkills: Array.isArray(row.soft_skills) ? row.soft_skills : [],
    targetDate: row.target_date || undefined,
    updatedAt: row.updated_at
  };
  return {
    ...baseVac,
    interpretedProfiles: interpretVacancyProfileWeights(baseVac)
  };
}

function toTextArray(value: any): string[] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(v => sanitizeUtf8(String(v ?? '')));
  return [sanitizeUtf8(String(value))];
}

// Vacancies Endpoints
app.get("/api/vacancies", async (req, res) => {
  const enrichVacancy = (v: any) => {
    const normalized = {
      ...v,
      title: formatVacancyTitle(v.title || '', v.department || 'General'),
      department: v.department || 'General',
      description: v.description || '',
      salaryRange: v.salaryRange || v.salary_range || 'TBD'
    };
    return {
      ...normalized,
      interpretedProfiles: interpretVacancyProfileWeights(normalized)
    };
  };

  if (useDbFallback) {
    return res.json({ vacancies: mockVacancies.map(enrichVacancy) });
  }
  try {
    const result = await pool.query("SELECT * FROM vacancies ORDER BY updated_at DESC NULLS LAST, id");
    res.json({ vacancies: result.rows.map(row => enrichVacancy(mapVacancyRow(row))) });
  } catch (err: any) {
    // Antes: devolvía la copia en memoria (datos viejos) ocultando el error.
    console.error("Error getting vacancies from DB:", err);
    res.status(500).json({ error: "Error obteniendo vacantes de la base de datos", detail: err.code });
  }
});

// Vista pública (portal /careers): solo vacantes activas y sin datos internos.
app.get("/api/public/vacancies", async (req, res) => {
  try {
    const rows = useDbFallback
      ? mockVacancies.map(v => ({ ...v }))
      : (await pool.query("SELECT * FROM vacancies WHERE status IN ('Activa', 'Open')")).rows.map(mapVacancyRow);
    res.json({
      vacancies: rows
        .filter((v: any) => v.status === 'Activa' || v.status === 'Open')
        .map((v: any) => ({
          id: v.id, title: formatVacancyTitle(v.title || '', v.department || ''), department: v.department,
          location: v.location, description: v.description, requirements: v.requirements || [],
          experienceYears: v.experienceYears, englishLevel: v.englishLevel, modalidad: v.modalidad, status: v.status,
          minCompetenciesRequired: v.minCompetenciesRequired || {}
        }))
    });
  } catch (err: any) {
    console.error("Error getting public vacancies:", err);
    res.status(500).json({ error: "Error obteniendo vacantes" });
  }
});

app.post("/api/vacancies", async (req, res) => {
  const { id, title, department, location, description, requirements, experienceYears, salaryRange, status, minCompetenciesRequired, englishLevel, modalidad, requiredGuidanceLevel, softSkills, targetDate } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "El título de la vacante es obligatorio" });
  }
  const vacancyId = id || `VAC-${crypto.randomUUID().slice(0, 8)}`;
  const formattedTitle = formatVacancyTitle(title, department || 'General');

  const v = {
    id: vacancyId,
    title: formattedTitle,
    department: normalizeArea(department) || 'General',
    location: location || 'CDMX - Híbrido',
    description: description || 'Descripción de vacante',
    requirements: toTextArray(requirements) || ['general'],
    experienceYears: Number(experienceYears) || 0,
    salaryRange: salaryRange || 'TBD (Por Definir)',
    status: status || 'Activa',
    minCompetenciesRequired: minCompetenciesRequired || {},
    englishLevel: englishLevel || 'Avanzado',
    modalidad: modalidad || 'Híbrido',
    requiredGuidanceLevel: requiredGuidanceLevel || null,
    softSkills: Array.isArray(softSkills) ? softSkills : [],
    targetDate: targetDate || null
  };

  if (useDbFallback) {
    mockVacancies = mockVacancies.filter(item => item.id !== vacancyId);
    mockVacancies.unshift(v);
    saveDiskVacancies(mockVacancies);
    notifyN8nVacancyChange(v, 'upsert');
    return res.json({ vacancy: v });
  }

  try {
    const result = await pool.query(`
      INSERT INTO vacancies (id, title, department, location, description, requirements, experience_years, salary_range, status, min_competencies, english_level, modalidad, required_guidance_level, soft_skills, target_date, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        department = EXCLUDED.department,
        location = EXCLUDED.location,
        description = EXCLUDED.description,
        requirements = EXCLUDED.requirements,
        experience_years = EXCLUDED.experience_years,
        salary_range = EXCLUDED.salary_range,
        status = EXCLUDED.status,
        min_competencies = EXCLUDED.min_competencies,
        english_level = EXCLUDED.english_level,
        modalidad = EXCLUDED.modalidad,
        required_guidance_level = EXCLUDED.required_guidance_level,
        soft_skills = EXCLUDED.soft_skills,
        target_date = EXCLUDED.target_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      v.id, v.title, v.department, v.location, v.description, v.requirements, v.experienceYears,
      v.salaryRange, v.status, JSON.stringify(v.minCompetenciesRequired), v.englishLevel, v.modalidad,
      v.requiredGuidanceLevel, JSON.stringify(v.softSkills), v.targetDate
    ]);
    const saved = mapVacancyRow(result.rows[0]);
    notifyN8nVacancyChange(saved, 'upsert');
    res.json({ vacancy: saved });
  } catch (err: any) {
    // Antes: respondía 200 aunque el INSERT fallara ("retained in mock/disk").
    console.error("Error creating vacancy in DB:", err);
    res.status(500).json({ error: "No se pudo guardar la vacante en la base de datos", detail: err.code });
  }
});

export function parseVacancyFromExcelBuffer(buffer: Buffer): any {
  let xlsxLib: any = XLSX;
  if (!xlsxLib || typeof xlsxLib.read !== 'function') {
    xlsxLib = createRequire(typeof __filename !== "undefined" ? __filename : import.meta.url)('xlsx');
  }
  const wb = xlsxLib.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((s: string) => s.toLowerCase().includes('revis') || s.toLowerCase().includes('pto') || s.toLowerCase().includes('ch')) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = xlsxLib.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const getRowText = (rowIdx: number): string => {
    const row = rows[rowIdx - 1];
    if (!row || !Array.isArray(row)) return '';
    // Restringir la lectura de celdas estrictamente de la columna A a la N (índices 0 a 13)
    const boundedRow = row.slice(0, 14);
    const nonLabelCells = boundedRow.map(c => String(c || '').trim()).filter(val => val && !/^(área solicitante|puesto a cubrir|puesto de nueva|oportunidad comercial|observaciones adicionales|tope costo|modalidad|solicitud personal|datos generales|tipo de solicitud|idioma|descripcion de puesto|objetivo del puesto)/i.test(val));
    return nonLabelCells.join(' ').trim();
  };

  const getRangeText = (startRow: number, endRow: number): string[] => {
    const lines: string[] = [];
    for (let r = startRow; r <= endRow; r++) {
      const txt = getRowText(r);
      if (txt && txt.length > 3) lines.push(txt);
    }
    return lines;
  };

  let row8Val = getRowText(8);
  let row21Val = getRowText(21);
  let row20Val = getRowText(20);

  let posTitle = row8Val || row20Val || 'Gerente de Consultoría';
  posTitle = posTitle.replace(/^(s[íi]|no)\s*[\-\:\_]?\s*/gi, '').trim();

  let oppName = row21Val.trim();
  // El título se toma únicamente de la Fila 8 (Puesto a cubrir)
  let title = posTitle;

  let department = getRowText(7) || 'General';
  department = fixCorruptedAccents(department.split('-')[0].trim()) || 'General';

  const rawDescription = getRowText(30) || 'Descripción cargada automáticamente desde el Layout.';
  let description = rawDescription;

  // La información de la Fila 21 (Oportunidad comercial) se coloca como prefijo de la descripción
  if (oppName) {
    if (rawDescription && !rawDescription.toLowerCase().startsWith(oppName.toLowerCase())) {
      description = `${oppName} - ${rawDescription}`;
    } else if (!rawDescription) {
      description = oppName;
    }
  }

  const salaryRange = getRowText(16) || 'De 80,000 a 85,000 en sueldo bruto';
  const englishLevel = getRowText(25) || 'Avanzado';
  const modality = getRowText(14) || 'Híbrido';
  const objective = getRangeText(36, 45).join('\n');
  const functions = getRangeText(47, 53);
  const requirements = getRangeText(55, 61);
  const softSkills = getRangeText(62, 66);

  const cleanT = formatVacancyTitle(title, department);

  return {
    title: fixCorruptedAccents(cleanT),
    department: normalizeArea(fixCorruptedAccents(department)),
    location: 'CDMX - Híbrido',
    description: fixCorruptedAccents(description),
    objective: fixCorruptedAccents(objective),
    functions: functions.map(f => fixCorruptedAccents(f)),
    requirements: requirements.map(r => fixCorruptedAccents(r)),
    softSkills: softSkills.map(s => fixCorruptedAccents(s)),
    salaryRange: fixCorruptedAccents(salaryRange),
    englishLevel: fixCorruptedAccents(englishLevel),
    modality: fixCorruptedAccents(modality),
    experienceYears: 10
  };
}

app.post("/api/parse-vacancy", upload.any(), async (req, res) => {
  const file = (req.files as Express.Multer.File[])?.[0] || req.file;
  if (!file || !file.buffer) {
    return res.status(400).json({ error: "No se subió ningún archivo válido." });
  }

  try {
    const buffer = file.buffer;
    const parsed = parseVacancyFromExcelBuffer(buffer);

    const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);
    if (client) {
      try {
        const prompt = `Analiza la siguiente información de vacante extraída de un Excel layout y estructura el JSON final:
${JSON.stringify(parsed, null, 2)}`;
        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt
        });
        const cleaned = cleanGeminiJson(response.text || '{}');
        const geminiParsed = JSON.parse(cleaned);
        if (geminiParsed.title) {
          geminiParsed.title = formatVacancyTitle(geminiParsed.title, geminiParsed.department || parsed.department);
          return res.json({ success: true, vacancy: geminiParsed });
        }
      } catch (gemErr) {
        console.warn("Gemini API parsing fallback to native Excel parser:", gemErr);
      }
    }

    return res.json({ success: true, vacancy: parsed });
  } catch (error) {
    console.error("Error parsing vacancy layout:", error);
    return res.status(500).json({ error: "Error procesando el archivo de vacante: " + String(error) });
  }
});

app.patch("/api/vacancies/:id", async (req, res) => {
  const { id } = req.params;
  const { title, department, location, description, requirements, experienceYears, salaryRange, status, minCompetenciesRequired, englishLevel, modalidad, requiredGuidanceLevel, softSkills, targetDate } = req.body || {};
  const formattedTitle = title ? formatVacancyTitle(title, department || '') : undefined;

  if (useDbFallback) {
    const idx = mockVacancies.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: "Vacante no encontrada" });
    mockVacancies[idx] = { ...mockVacancies[idx], ...req.body, ...(formattedTitle ? { title: formattedTitle } : {}) };
    saveDiskVacancies(mockVacancies);
    notifyN8nVacancyChange(mockVacancies[idx], 'update');
    return res.json({ success: true, vacancy: mockVacancies[idx] });
  }

  try {
    // Antes: `requirements = COALESCE($5, requirements::jsonb)` sobre una columna TEXT[] →
    // "no se puede convertir el tipo text[] a jsonb": TODA edición de vacante fallaba con 500.
    const result = await pool.query(
      `UPDATE vacancies SET
        title = COALESCE($1, title),
        department = COALESCE($2, department),
        location = COALESCE($3, location),
        description = COALESCE($4, description),
        requirements = COALESCE($5::text[], requirements),
        experience_years = COALESCE($6, experience_years),
        salary_range = COALESCE($7, salary_range),
        status = COALESCE($8, status),
        min_competencies = COALESCE($9::jsonb, min_competencies),
        english_level = COALESCE($10, english_level),
        modalidad = COALESCE($11, modalidad),
        required_guidance_level = COALESCE($12, required_guidance_level),
        soft_skills = COALESCE($13::jsonb, soft_skills),
        target_date = COALESCE($14, target_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15 RETURNING *`,
      [
        formattedTitle ?? null,
        department !== undefined ? normalizeArea(department) : null,
        location ?? null,
        description ?? null,
        toTextArray(requirements),
        experienceYears !== undefined ? Number(experienceYears) : null,
        salaryRange ?? null,
        status ?? null,
        minCompetenciesRequired !== undefined ? JSON.stringify(minCompetenciesRequired) : null,
        englishLevel ?? null,
        modalidad ?? null,
        requiredGuidanceLevel ?? null,
        softSkills !== undefined ? JSON.stringify(softSkills) : null,
        targetDate ?? null,
        id
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Vacante no encontrada" });
    }
    const vacancy = mapVacancyRow(result.rows[0]);
    notifyN8nVacancyChange(vacancy, 'update');
    res.json({ success: true, vacancy });
  } catch (err: any) {
    console.error("Error updating vacancy:", err);
    res.status(500).json({ error: "Error actualizando vacante", detail: err.code });
  }
});

app.delete("/api/vacancies/:id", async (req, res) => {
  const { id } = req.params;
  const actor = (req as AuthenticatedRequest).user;

  if (useDbFallback) {
    mockVacancies = mockVacancies.filter(item => item.id !== id);
    saveDiskVacancies(mockVacancies);
    notifyN8nVacancyChange({ id }, 'delete');
    return res.json({ success: true, message: "Vacante eliminada exitosamente" });
  }

  try {
    await pool.query("UPDATE candidates SET vacancy_id = NULL WHERE vacancy_id = $1", [id]);
    const del = await pool.query("DELETE FROM vacancies WHERE id = $1", [id]);
    if (!del.rowCount) return res.status(404).json({ error: "Vacante no encontrada" });
    await registrarAuditoria(pool, {
      usuario_id: actor?.id, usuario_email: actor?.email, ip_address: req.ip || '',
      accion: 'ELIMINAR_VACANTE', modulo: 'VACANTES', nivel: 'WARN', detalles: { vacancy_id: id }
    });
    notifyN8nVacancyChange({ id }, 'delete');
    res.json({ success: true, message: "Vacante eliminada exitosamente de PostgreSQL" });
  } catch (err: any) {
    // Antes: respondía success:true aunque el DELETE fallara.
    console.error("Error deleting vacancy from DB:", err);
    res.status(500).json({ error: "No se pudo eliminar la vacante", detail: err.code });
  }
});

// Candidates Endpoints
function parseJsonField(value: any, fallback: any) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapCandidateRow(row: any) {
  const cleanName = cleanCandidateName(row.name || '', row.resume_text || '', row.email || '');
  const rawComp = parseJsonField(row.competencies, {});
  const tempCand = {
    name: cleanName,
    resumeText: row.resume_text || '',
    summary: row.summary || '',
    experience: row.experience || [],
    education: row.education || [],
    certifications: row.certifications || [],
    competencies: rawComp
  };
  const safeCompetencies = isStaticLegacyCompetencies(rawComp)
    ? calculateCandidateCompetencies(tempCand, undefined)
    : rawComp;
  const safeSummary = synthesizeAnalyticalCandidateSummary(tempCand, undefined);

  return {
    id: row.id,
    name: cleanName,
    email: row.email,
    phone: row.phone,
    resumeText: row.resume_text,
    stage: row.stage,
    competencies: safeCompetencies,
    fitScore: row.fit_score,
    initialFitScore: row.initial_fit_score,
    summary: safeSummary,
    strengths: row.strengths || [],
    growths: row.growths || [],
    recommendedQuestions: row.recommended_questions || [],
    suggestedTime: '',
    channel: row.channel || 'Otros',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isEncrypted: row.is_encrypted,
    vacancyId: row.vacancy_id,
    screeningQuestions: parseJsonField(row.screening_questions, []),
    doubleCheckReport: row.double_check_report || '',
    interviewSpeech: row.interview_speech || '',
    experience: row.experience || [],
    education: row.education || [],
    certifications: row.certifications || [],
    history: parseJsonField(row.history, []),
    comments: row.comments || "",
    expectedSalary: row.expected_salary ?? undefined,
    englishLevel: row.english_level ?? undefined,
    detectedGuidanceLevel: row.detected_guidance_level ?? undefined,
    isStarred: !!row.is_starred,
    tags: row.tags || []
  };
}

app.get("/api/candidates", async (req, res) => {
  if (useDbFallback) {
    return res.json({ candidates: mockCandidates });
  }
  try {
    const result = await pool.query("SELECT * FROM candidates ORDER BY created_at DESC");
    res.json({ candidates: result.rows.map(mapCandidateRow) });
  } catch (err: any) {
    console.error("Error getting candidates:", err);
    res.status(500).json({ error: "Error obteniendo candidatos", detail: err.code });
  }
});

app.patch("/api/candidates/:id/stage", async (req, res) => {
  const { id } = req.params;
  const { stage, vacancyId } = req.body;
  // Atribución desde el JWT verificado (antes: cabeceras x-user-name / x-user-role, falsificables).
  const actor = (req as AuthenticatedRequest).user;
  const userName = actor?.nombre || actor?.email || 'Usuario';
  const userRole = (actor?.rol || 'user').toUpperCase();

  if (useDbFallback) {
    const c = mockCandidates.find(item => item.id === id);
    if (!c) return res.status(404).json({ error: "Candidato no encontrado" });
    c.stage = stage;
    if (stage === 'Pool') {
      c.vacancyId = '';
    } else if (vacancyId !== undefined) {
      c.vacancyId = vacancyId;
    }
    c.history = c.history || [];
    c.history.push({
      timestamp: new Date().toISOString(),
      stage,
      user: `${userName} (${userRole})`
    });

    // Trigger n8n Webhook for scheduling invitation
    if (stage === 'Entrevista') {
      const webhookUrl = process.env.N8N_ENTREVISTA_WEBHOOK || 'http://10.10.10.103:5678/webhook/candidato-entrevista';
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone || '',
          role: c.role || c.vacancyId || 'Consultor',
          suggestedTime: c.suggestedTime || '',
          interviewSpeech: c.interviewSpeech || ''
        })
      }).catch(err => console.error("Error calling n8n webhook (fallback mode):", err));
    }

    saveDiskCandidates(mockCandidates);
    notifyN8nCandidateChange(c, 'stage_change');
    return res.json({ candidate: c });
  }

  try {
    const candRes = await pool.query("SELECT * FROM candidates WHERE id = $1", [id]);
    if (candRes.rows.length === 0) {
      return res.status(404).json({ error: "Candidato no encontrado" });
    }
    
    const c = candRes.rows[0];
    const history = c.history || [];
    const auditEntry = {
      timestamp: new Date().toISOString(),
      stage: stage,
      user: `${userName} (${userRole})`
    };
    history.push(auditEntry);
    
    let targetVacId: string | null = c.vacancy_id;
    if (stage === 'Pool') {
      targetVacId = null;
    } else if (vacancyId !== undefined) {
      targetVacId = (vacancyId && vacancyId !== 'unassigned') ? vacancyId : null;
    }

    await pool.query(`
      UPDATE candidates
      SET stage = $1, vacancy_id = $2, history = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [stage, targetVacId, JSON.stringify(history), id]);

    // Trigger n8n Webhook for scheduling invitation in DB mode
    if (stage === 'Entrevista') {
      const webhookUrl = process.env.N8N_ENTREVISTA_WEBHOOK || 'http://10.10.10.103:5678/webhook/candidato-entrevista';
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone || '',
          role: c.role || c.vacancy_id || 'Consultor',
          suggestedTime: c.suggested_time || '',
          interviewSpeech: c.interview_speech || ''
        })
      }).catch(err => console.error("Error calling n8n webhook (DB mode):", err));
    }
    
    const updatedCandidate = mapCandidateRow({ ...c, stage, history });
    notifyN8nCandidateChange(updatedCandidate, 'stage_change');
    res.json({ candidate: updatedCandidate });
  } catch (err) {
    console.error("Error updating stage:", err);
    res.status(500).json({ error: "Error al actualizar fase del candidato" });
  }
});

// Evaluación CRÍTICA del Double-Check (ver src/utils/doubleCheckEvaluator.ts).
// Antes: +3 si aparecía "años"/"experiencia", +2 por "presencial", +1 por >150 caracteres, y un
// dictamen "sólida coherencia" con cualquier delta positivo; el prompt de Gemini incluso sugería 88.
app.post("/api/candidates/submit-screening", aiQuotaRateLimiter, async (req, res) => {
  const { candidate, name, role, resumeText, vacancy, answers, rawText, questions } = req.body || {};
  const candidateName = name || candidate?.name || 'Candidato';
  const roleName = role || vacancy?.title || candidate?.role || 'la vacante';

  // Preguntas + respuestas: o vienen ya pareadas (portal público) o se parsea el correo pegado.
  let qa: { question: string; answer: string }[];
  if (Array.isArray(questions) && questions.length) {
    const qTexts = questions.map((q: any) => String(typeof q === 'string' ? q : q?.question || ''));
    const parsed = parseCandidateAnswers(String(rawText || ''), qTexts);
    qa = qTexts.map((q: string, i: number) => ({ question: q, answer: parsed[i] || '' }));
  } else if (Array.isArray(answers)) {
    qa = answers.map((x: any) => ({ question: String(x?.question || ''), answer: String(x?.answer || '').trim() }));
  } else {
    return res.status(400).json({ error: "Faltan las preguntas del cuestionario." });
  }
  if (!qa.some(x => x.answer)) {
    return res.status(400).json({ error: "No se identificó ninguna respuesta. Pega el correo con las respuestas numeradas (1., 2., 3.…)." });
  }

  const vac = {
    title: vacancy?.title || roleName, department: vacancy?.department, requirements: vacancy?.requirements || [],
    salaryRange: vacancy?.salaryRange, modalidad: vacancy?.modalidad
  };
  const cand = { name: candidateName, resumeText: resumeText || candidate?.resumeText || '', experience: candidate?.experience || [] };
  // Base = encaje del CV antes del Double-Check. En el portal público aún no existe: se calcula del CV.
  let baseScore = Number(candidate?.initialFitScore ?? candidate?.fitScore);
  if (!Number.isFinite(baseScore) || baseScore <= 0) {
    baseScore = runLocalHeuristicAnalysis(candidateName, cand.resumeText, vac.title, vac).fitScore;
  }
  const result = evaluateDoubleCheck({ questions: qa, vacancy: vac, candidate: cand, baseScore });
  let report = result.report;
  let fitScore = result.fitScore;

  // Segunda opinión con IA (si hay Gemini): solo puede ENDURECER el resultado, nunca suavizarlo.
  const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);
  if (client) {
    try {
      const prompt = `Actúa como un reclutador senior EXTREMADAMENTE crítico y escéptico. Evalúa si las respuestas del candidato DEMUESTRAN la experiencia requerida para "${roleName}".
Reglas: una afirmación sin ejemplo concreto vale 0; respuestas escuetas, genéricas o fuera de tema valen menos de 15; exige situación, acción personal, herramienta/empresa y resultado cuantificado; penaliza el autoelogio; no concedas el beneficio de la duda.
Requisitos de la vacante: ${(vac.requirements || []).join('; ') || 'N/D'}
Preguntas y respuestas:
${qa.slice(0, 3).map((x, i) => `P${i + 1}: ${x.question}\nR${i + 1}: ${x.answer || '(sin respuesta)'}`).join('\n')}
Devuelve SOLO JSON: {"quality": <0-100>, "critique": "<máx 3 frases, en español, directas y críticas>"}`;
      const response = await client.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
      const ai = JSON.parse(cleanGeminiJson(response.text || '{}'));
      const aiQuality = Number(ai.quality);
      if (Number.isFinite(aiQuality) && aiQuality < result.experienceQuality) {
        const aiFit = Math.max(0, result.baseScore + Math.max(-40, Math.min(6, Math.round((aiQuality - 70) * 0.6))));
        fitScore = Math.min(fitScore, aiFit);
      }
      if (ai.critique) report += `\n\nSegunda revisión (IA, ${Number.isFinite(aiQuality) ? aiQuality + '/100' : 's/c'}): ${fixCorruptedAccents(String(ai.critique))}`;
    } catch (gemErr) {
      console.warn("Gemini double-check (segunda opinión) no disponible:", gemErr);
    }
  }
  if (fitScore !== result.fitScore) {
    report = report.replace(/Encaje con la vacante: .*$/m, `Encaje con la vacante: ${result.baseScore}% → ${fitScore}% (${fitScore - result.baseScore >= 0 ? '+' : ''}${fitScore - result.baseScore} pts, ajustado por la revisión de IA)`);
  }

  const followUps = result.answers.filter(a => a.followUp).map(a => {
    const f = a.followUp!.replace(/^En entrevista:\s*/, '');
    return f.charAt(0).toUpperCase() + f.slice(1);
  });
  const growths = [...new Set([...(candidate?.growths || []), ...result.criticalFlags.map(f => `Double-Check — ${f}`)])].slice(0, 6);
  return res.json({
    verdict: result.verdict,
    quality: result.quality,
    fitScore,
    baseScore: result.baseScore,
    doubleCheckReport: report,
    evaluation: { answers: result.answers, availability: result.availability },
    screeningQuestions: qa.map((x, i) => ({ id: i + 1, question: x.question, answer: x.answer })),
    competencies: candidate?.competencies || {},
    summary: candidate?.summary || '',
    strengths: candidate?.strengths || [],
    growths,
    interviewSpeech: followUps.length
      ? `Guía para entrevista con ${candidateName} (${roleName}) — validar:\n${followUps.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
      : (candidate?.interviewSpeech || ''),
    suggestedTime: candidate?.suggestedTime || ''
  });
});

app.patch("/api/candidates/:id/schedule", async (req, res) => {
  const { id } = req.params;
  const { suggestedTime } = req.body;

  if (useDbFallback) {
    const c = mockCandidates.find(item => item.id === id);
    if (!c) return res.status(404).json({ error: "Candidato no encontrado" });
    c.suggestedTime = suggestedTime;
    saveDiskCandidates(mockCandidates);
    return res.json({ candidate: c });
  }

  try {
    const upd = await pool.query(`
      UPDATE candidates
      SET suggested_time = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [suggestedTime, id]);
    if (!upd.rowCount) return res.status(404).json({ error: "Candidato no encontrado" });
    res.json({ candidate: mapCandidateRow(upd.rows[0]) });
  } catch (err) {
    console.error("Error scheduling candidate:", err);
    res.status(500).json({ error: "Error al agendar entrevista del candidato" });
  }
});

// Endpoint: Retroalimentación de Contratación (Comentarios para incrementar el score & Aprendizaje continuo IA)
app.post(["/api/submit-feedback", "/submit-feedback"], async (req, res) => {
  const { candidateId, outcome, feedbackComments, comments, competencies } = req.body || {};
  const cId = candidateId || req.body?.id;
  const feedbackText = String(feedbackComments || comments || '').trim();

  // Actualizar pesos de aprendizaje continuo si se envían competencias o un dictamen
  try {
    const currentWeights = await getLearningWeights();
    const keys = ['Liderazgo', 'Comunicación', 'Trabajo en Equipo', 'Habilidades Técnicas', 'Resolución de Problemas'];

    if (competencies) {
      const learningRate = 0.08;
      for (const key of keys) {
        const evaluationVal = competencies[key] || 80;
        const targetRatio = evaluationVal / 80;
        currentWeights[key] = currentWeights[key] * (1 - learningRate) + targetRatio * learningRate;
        currentWeights[key] = Math.max(0.5, Math.min(2.0, Number(currentWeights[key])));
      }
      await saveLearningWeights(currentWeights);
    } else if (outcome) {
      const learningRate = 0.05;
      const factor = (outcome === 'Hired' || outcome === 'Contratado') ? 1.05 : 0.95;
      for (const key of keys) {
        currentWeights[key] = currentWeights[key] * (1 - learningRate) + (currentWeights[key] * factor) * learningRate;
        currentWeights[key] = Math.max(0.5, Math.min(2.0, Number(currentWeights[key])));
      }
      await saveLearningWeights(currentWeights);
    }
  } catch (errWeights) {
    console.warn("[Feedback] Error actualizando pesos de aprendizaje:", errWeights);
  }

  if (!cId) {
    const weights = await getLearningWeights();
    return res.json({ success: true, message: "Retroalimentación de aprendizaje registrada", weights });
  }

  let candidate: any = null;
  if (useDbFallback) {
    candidate = mockCandidates.find(c => c.id === cId);
  } else {
    try {
      const r = await pool.query("SELECT * FROM candidates WHERE id = $1", [cId]);
      if (r.rows.length > 0) candidate = mapCandidateRow(r.rows[0]);
    } catch (dbErr) {
      console.warn("[Feedback DB] Error leyendo candidato, usando mock fallback:", dbErr);
      candidate = mockCandidates.find(c => c.id === cId);
    }
  }

  if (!candidate) {
    return res.status(404).json({ error: "Candidato no encontrado" });
  }

  const currentScore = Number(candidate.fitScore) || 75;
  let boost = 0;

  const negativeKeywords = /\b(no domina|no cuenta|no cumple|no tiene|deficiente|bajo nivel|inadecuado|rechaz|descart|reasign|brecha|insuficiente|fall|fallo|debilidad|no apto|falta|carece|sin experiencia|no sabe|poco apego|regular|dudas|insegur|no convence|desfase|requiere capacitaci|descartar|rechazado|desfavorable)\b/i;
  const positiveKeywords = /\b(adecuad[oa]s?|iniciativa|aprend(er|e|izaje)?|capacita(r|se|ci[oó]n)?|aut[oó]nom[oa]s?|an[aá]lisi?s|viabl?e?s?|potencial|alinea(n|do|da|das|dos)?|inter[eé]s|actitud|compromis[oa]|proactiv[oa]s?|correct[oa]s?|satisfactori[oa]s?|favorable(mente)?|apto|cumple|buen[oa]s?|destac[ao]|excelent[es]?|avanz[ao]|competent[es]?|recomend(able|ado)?|aprobado|contratado|sobresaliente|domina|favorable)\b/i;

  const isExplicitFeedback = feedbackText.length >= 8;
  const isExplicitOutcome = outcome === 'Hired' || outcome === 'Contratado' || outcome === 'Favorable' || outcome === 'Rejected' || outcome === 'Rechazado' || outcome === 'Desfavorable' || outcome === 'Note';
  const isRejected = outcome === 'Rejected' || outcome === 'Rechazado' || outcome === 'Desfavorable' || candidate.stage === 'Rechazado';
  const isHired = outcome === 'Hired' || outcome === 'Contratado' || outcome === 'Favorable' || candidate.stage === 'Contratado';
  const isNote = outcome === 'Note';

  const hasNegativeText = isExplicitFeedback && negativeKeywords.test(feedbackText);
  const hasPositiveText = isExplicitFeedback && positiveKeywords.test(feedbackText);

  if (isNote || (!isExplicitFeedback && !isExplicitOutcome)) {
    // Nota informativa o sin contenido sustancial: 0 pts
    boost = 0;
  } else if (isExplicitOutcome) {
    if (isHired) {
      boost = currentScore <= 45 ? +15 : +8;
    } else if (isRejected) {
      boost = -10;
    } else {
      boost = 0;
    }
  } else if (hasNegativeText) {
    boost = -10;
  } else if (hasPositiveText) {
    boost = currentScore <= 45 ? +15 : +8;
  } else {
    boost = 0;
  }

  let newScore = Math.min(98, Math.max(15, currentScore + boost));
  if (isRejected && (outcome === 'Rejected' || outcome === 'Rechazado') && newScore > 40) {
    newScore = 38;
  }

  // Ajuste dinámico de competencias evaluadas según retroalimentación
  if (candidate.competencies) {
    if (isRejected || hasNegativeText) {
      candidate.competencies['Habilidades Técnicas'] = Math.max(30, (Number(candidate.competencies['Habilidades Técnicas']) || 75) - 10);
      candidate.competencies['Resolución de Problemas'] = Math.max(30, (Number(candidate.competencies['Resolución de Problemas']) || 75) - 8);
    } else if (isHired || hasPositiveText) {
      candidate.competencies['Habilidades Técnicas'] = Math.min(98, (Number(candidate.competencies['Habilidades Técnicas']) || 75) + 8);
      candidate.competencies['Comunicación'] = Math.min(98, (Number(candidate.competencies['Comunicación']) || 75) + 6);
    }
  }

  const timestamp = new Date().toISOString();
  const outcomeLabel = isHired ? 'Favorable (+8 pts)' : isRejected ? 'Desfavorable (-10 pts)' : (boost === 0 ? 'Nota Informativa' : 'Comentarios');
  const dimensionPrefix = (req.body?.dimension) ? `${req.body.dimension} | ` : '';
  const scoreChangeLabel = boost > 0 ? `+${boost}` : `${boost}`;
  const feedbackEntry = `[${dimensionPrefix}${outcomeLabel}] ${feedbackText || 'Evaluación ejecutiva completada.'} (Score: ${currentScore}% -> ${newScore}%, ${scoreChangeLabel} pts)`;

  const updatedComments = candidate.comments ? `${candidate.comments}\n${feedbackEntry}` : feedbackEntry;
  const history = Array.isArray(candidate.history) ? [...candidate.history] : [];
  history.push({
    timestamp,
    stage: isHired ? 'Contratado' : isRejected ? 'Rechazado' : candidate.stage,
    user: 'Retroalimentación de Entrevista',
    details: feedbackEntry
  });

  candidate.fitScore = newScore;
  candidate.comments = updatedComments;
  candidate.history = history;
  if (isHired) {
    candidate.stage = 'Contratado';
  } else if (isRejected && candidate.stage !== 'Rechazado') {
    candidate.stage = 'Rechazado';
  }

  if (useDbFallback) {
    saveDiskCandidates(mockCandidates);
  } else {
    try {
      const nextStage = isHired ? 'Contratado' : isRejected ? 'Rechazado' : null;
      await pool.query(`
        UPDATE candidates
        SET fit_score = $1, comments = $2, history = $3, stage = COALESCE($4, stage), competencies = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [newScore, updatedComments, JSON.stringify(history), nextStage, JSON.stringify(candidate.competencies || {}), cId]);
    } catch (err) {
      console.error("Error guardando feedback en DB:", err);
    }
  }

  notifyN8nCandidateChange(candidate, 'feedback_update');
  return res.json({ 
    success: true, 
    candidate, 
    newScore, 
    boostApplied: boost, 
    message: `Feedback registrado exitosamente. Score actualizado a ${newScore}% (${scoreChangeLabel} pts)` 
  });
});

// Admin Endpoint: Limpiar Base de Datos (Candidates & Vacancies)
app.all(["/api/admin/clear-database", "/api/clear-database"], requireRole(['admin']), async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: "Usa POST" });
  try {
    mockCandidates = [];
    mockVacancies = [];

    if (!useDbFallback) {
      let client;
      try {
        client = await pool.connect();
        // 1. Remove foreign key references
        await client.query("UPDATE candidates SET vacancy_id = NULL WHERE vacancy_id IS NOT NULL;");
        // 2. Delete candidates records
        await client.query("DELETE FROM candidates;");
        // 3. Delete vacancies records
        await client.query("DELETE FROM vacancies;");
        // 4. Try TRUNCATE CASCADE to reset auto-increment sequences if any
        try {
          await client.query("TRUNCATE TABLE candidates, vacancies RESTART IDENTITY CASCADE;");
        } catch (truncErr) {}

        console.log("[Admin Clear DB] Cleaned candidates and vacancies from PostgreSQL database.");
      } catch (dbErr) {
        console.error("[Admin Clear DB] Error during DELETE, trying direct TRUNCATE CASCADE:", dbErr);
        try {
          if (client) {
            await client.query("TRUNCATE TABLE candidates, vacancies RESTART IDENTITY CASCADE;");
          } else {
            await pool.query("TRUNCATE TABLE candidates, vacancies RESTART IDENTITY CASCADE;");
          }
        } catch (e2) {
          console.error("[Admin Clear DB] Truncate fallback error:", e2);
        }
      } finally {
        if (client) client.release();
      }
    }

    console.log("[Admin Clear DB] Database reset complete.");
    return res.json({ success: true, message: "Base de datos limpiada exitosamente." });
  } catch (err) {
    console.error("Error clearing database:", err);
    // Graceful response so client clears UI state
    return res.json({ success: true, warning: "Memoria local y caché limpiadas.", detail: String(err) });
  }
});






app.post("/api/candidates", async (req, res) => {
  const c = sanitizeUtf8(req.body || {});
  if (!c.id || !c.name) {
    return res.status(400).json({ error: "id y name son obligatorios" });
  }

  // Resolución y normalización canónica universal obligatoria antes de persistencia
  const resolvedCv = resolveAndNormalizeCandidateCvProfile({
    name: c.name,
    resumeText: c.resumeText || '',
    summary: c.summary || '',
    experience: c.experience,
    education: c.education,
    certifications: c.certifications
  });
  c.experience = resolvedCv.experience;
  c.education = resolvedCv.education;
  c.certifications = resolvedCv.certifications;

  if (useDbFallback) {
    mockCandidates = mockCandidates.filter(item => item.id !== c.id);
    mockCandidates.unshift(c);
    saveDiskCandidates(mockCandidates);
    notifyN8nCandidateChange(c, 'upsert');
    return res.json({ candidate: c });
  }

  const sqlQuery = `
    INSERT INTO candidates (id, name, email, phone, resume_text, stage, competencies, fit_score, initial_fit_score, summary, strengths, growths, recommended_questions, suggested_time, channel, vacancy_id, screening_questions, double_check_report, interview_speech, experience, education, certifications, history, comments, expected_salary, english_level, detected_guidance_level, is_starred, tags, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      resume_text = EXCLUDED.resume_text,
      stage = EXCLUDED.stage,
      competencies = EXCLUDED.competencies,
      fit_score = EXCLUDED.fit_score,
      initial_fit_score = EXCLUDED.initial_fit_score,
      summary = EXCLUDED.summary,
      strengths = EXCLUDED.strengths,
      growths = EXCLUDED.growths,
      recommended_questions = EXCLUDED.recommended_questions,
      channel = EXCLUDED.channel,
      vacancy_id = EXCLUDED.vacancy_id,
      history = EXCLUDED.history,
      suggested_time = EXCLUDED.suggested_time,
      screening_questions = EXCLUDED.screening_questions,
      double_check_report = EXCLUDED.double_check_report,
      interview_speech = EXCLUDED.interview_speech,
      experience = EXCLUDED.experience,
      education = EXCLUDED.education,
      certifications = EXCLUDED.certifications,
      comments = EXCLUDED.comments,
      expected_salary = EXCLUDED.expected_salary,
      english_level = EXCLUDED.english_level,
      detected_guidance_level = EXCLUDED.detected_guidance_level,
      is_starred = EXCLUDED.is_starred,
      tags = EXCLUDED.tags,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const queryParams = sanitizeForPg([
    c.id, c.name, c.email || '', c.phone || '', c.resumeText || '', c.stage || 'Filtrado',
    JSON.stringify(sanitizeForPg(c.competencies || {})),
    c.fitScore || 0,
    c.initialFitScore || c.fitScore || 0,
    c.summary || '',
    toTextArray(c.strengths) || [],
    toTextArray(c.growths) || [],
    toTextArray(c.recommendedQuestions) || [],
    c.suggestedTime || '',
    c.channel || 'EAS Consulting DB',
    c.vacancyId || null,
    JSON.stringify(sanitizeForPg(c.screeningQuestions || [])),
    c.doubleCheckReport || null,
    c.interviewSpeech || null,
    toTextArray(c.experience) || [],
    toTextArray(c.education) || [],
    toTextArray(c.certifications) || [],
    JSON.stringify(sanitizeForPg(c.history || [])),
    c.comments || '',
    c.expectedSalary != null ? String(c.expectedSalary) : null,
    c.englishLevel || null,
    c.detectedGuidanceLevel || null,
    !!c.isStarred,
    toTextArray(c.tags) || []
  ]);

  try {
    let result;
    try {
      result = await pool.query(sqlQuery, queryParams);
    } catch (err: any) {
      if (err.code === '22021') {
        console.warn("[PostgreSQL] Error 22021 (character_not_in_repertoire) al guardar candidato. Reintentando con saneamiento de emergencia...");
        const cleanParams = queryParams.map(p => {
          if (typeof p === 'string') {
            return p.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
          }
          if (Array.isArray(p)) {
            return p.map(item => typeof item === 'string' ? item.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : item);
          }
          return p;
        });
        result = await pool.query(sqlQuery, cleanParams);
      } else {
        throw err;
      }
    }
    const saved = mapCandidateRow(result.rows[0]);
    notifyN8nCandidateChange(saved, 'upsert');
    res.json({ candidate: saved });
  } catch (err: any) {
    console.error("Error syncing candidate:", err);
    const msg = err.code === '23503' ? "La vacante asignada no existe" : "No se pudo guardar el candidato en la base de datos";
    res.status(err.code === '23503' ? 400 : 500).json({ error: msg, detail: err.code });
  }
});

// Postulación desde el portal público (/careers). Antes el candidato solo se agregaba al
// estado del navegador del postulante y nunca llegaba a la base de datos del reclutador.
const publicApplicationLimiter = createRateLimiter(10, 60 * 60 * 1000, 'Demasiadas postulaciones desde esta red. Intenta más tarde.');
app.post("/api/public/applications", publicApplicationLimiter, async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 255);
  const email = String(b.email || '').trim().slice(0, 255);
  const vacancyId = b.vacancyId ? String(b.vacancyId) : null;
  if (!name || !email.includes('@') || !vacancyId) {
    return res.status(400).json({ error: "Nombre, correo y vacante son obligatorios." });
  }
  const id = `cand-portal-${crypto.randomUUID()}`;
  const screeningQuestions = Array.isArray(b.screeningQuestions)
    ? b.screeningQuestions.slice(0, 20).map((q: any, i: number) => ({ id: i + 1, question: String(q.question || '').slice(0, 1000), answer: String(q.answer || '').slice(0, 5000) }))
    : [];
  const rawResumeText = String(b.resumeText || '').slice(0, 200000);
  const resolvedCv = resolveAndNormalizeCandidateCvProfile({
    name,
    resumeText: rawResumeText,
    summary: String(b.summary || '').slice(0, 5000),
    experience: b.experience,
    education: b.education,
    certifications: b.certifications
  });
  const candidate = {
    id, name, email, phone: String(b.phone || '').slice(0, 50), resumeText: rawResumeText,
    stage: 'Filtrado', competencies: typeof b.competencies === 'object' && b.competencies ? b.competencies : {},
    fitScore: Math.max(0, Math.min(100, Number(b.fitScore) || 0)), summary: String(b.summary || '').slice(0, 5000),
    strengths: toTextArray(b.strengths) || [], growths: toTextArray(b.growths) || [],
    experience: resolvedCv.experience,
    education: resolvedCv.education,
    certifications: resolvedCv.certifications,
    doubleCheckReport: String(b.doubleCheckReport || '').slice(0, 10000), channel: 'Otros', vacancyId, screeningQuestions,
    history: [{ timestamp: new Date().toISOString(), stage: 'Filtrado', user: 'Portal de Empleos' }]
  };

  if (useDbFallback) {
    mockCandidates.unshift(candidate);
    saveDiskCandidates(mockCandidates);
    return res.json({ success: true, id });
  }
  try {
    const vac = await pool.query("SELECT id FROM vacancies WHERE id = $1 AND status IN ('Activa', 'Open')", [vacancyId]);
    if (!vac.rowCount) return res.status(400).json({ error: "La vacante ya no está disponible." });
    const appParams = sanitizeForPg([id, name, email, candidate.phone, candidate.resumeText, candidate.stage, JSON.stringify(candidate.competencies), candidate.fitScore,
        candidate.summary, candidate.strengths, candidate.growths, candidate.channel, vacancyId, JSON.stringify(screeningQuestions),
        candidate.doubleCheckReport, JSON.stringify(candidate.history), candidate.experience, candidate.education, candidate.certifications]);
    await pool.query(`
      INSERT INTO candidates (id, name, email, phone, resume_text, stage, competencies, fit_score, initial_fit_score, summary, strengths, growths, channel, vacancy_id, screening_questions, double_check_report, history, experience, education, certifications, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
    `, appParams);
    notifyN8nCandidateChange(candidate, 'portal_application');
    res.json({ success: true, id });
  } catch (err: any) {
    console.error("Error guardando postulación del portal:", err);
    res.status(500).json({ error: "No se pudo registrar tu postulación. Intenta de nuevo." });
  }
});

// Audit Logging Endpoints (Log de Accesos y Auditoría)
app.get("/api/audit-logs", async (req, res) => {
  if (useDbFallback) {
    return res.json({ logs: mockAuditLogs });
  }
  try {
    const result = await pool.query("SELECT * FROM log_auditoria ORDER BY fecha DESC LIMIT 300");
    const logs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.fecha ? new Date(row.fecha).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19),
      action: row.accion,
      user: row.usuario_email || 'usuario.sistema@easconsulting.com.mx',
      ip: row.ip_address || '192.168.10.101',
      component: row.modulo,
      status: row.nivel === 'ERROR' || row.nivel === 'CRITICAL' ? 'ALERT' : row.nivel === 'WARN' ? 'WARNING' : 'SUCCESS',
      details: typeof row.detalles === 'string' ? row.detalles : JSON.stringify(row.detalles || {}),
      immutableHash: row.detalles?.immutableHash
    }));
    res.json({ logs: logs.length > 0 ? logs : mockAuditLogs });
  } catch (err) {
    console.warn("Error reading log_auditoria from DB, using fallback:", err);
    res.json({ logs: mockAuditLogs });
  }
});

app.post("/api/audit-logs", async (req, res) => {
  const { id, timestamp, action, user, ip, component, status, details, immutableHash } = req.body;
  const logItem = {
    id: id || `log-${Date.now()}`,
    timestamp: timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
    action: action || 'ACCION_DESCONOCIDA',
    // Usuario e IP salen del JWT/servidor, no del body (antes se podían falsificar entradas de auditoría).
    user: (req as AuthenticatedRequest).user?.email || 'desconocido',
    ip: req.ip || '',
    component: component || 'Sistema',
    status: status || 'SUCCESS',
    details: details || '',
    immutableHash: immutableHash || ''
  };

  mockAuditLogs = mockAuditLogs.filter(item => item.id !== logItem.id);
  mockAuditLogs.unshift(logItem);
  if (mockAuditLogs.length > 300) mockAuditLogs = mockAuditLogs.slice(0, 300);

  if (!useDbFallback) {
    try {
      const dbLevel = status === 'ALERT' ? 'ERROR' : status === 'WARNING' ? 'WARN' : 'INFO';
      await pool.query(
        "INSERT INTO log_auditoria (usuario_email, ip_address, accion, modulo, nivel, detalles) VALUES ($1, $2, $3, $4, $5, $6)",
        [logItem.user, logItem.ip, logItem.action, logItem.component, dbLevel, JSON.stringify({ details: logItem.details, immutableHash: logItem.immutableHash })]
      );
    } catch (dbErr) {
      console.warn("Error inserting log_auditoria to DB:", dbErr);
    }
  }

  res.json({ success: true, log: logItem });
});



app.post("/api/admin/reset-double-check", authenticateToken(useDbFallback ? null : pool), requireRole(['admin']), async (req, res) => {
  console.log("[Reset Double Check] Restoring candidates to original rank and initialFitScore...");
  if (useDbFallback) {
    mockCandidates = mockCandidates.map(c => ({
      ...c,
      fitScore: c.initialFitScore || c.fitScore,
      doubleCheckReport: undefined,
      interviewSpeech: undefined
    }));
    return res.json({ success: true });
  }

  try {
    await pool.query(`
      UPDATE candidates 
      SET fit_score = COALESCE(initial_fit_score, fit_score),
          double_check_report = NULL,
          interview_speech = NULL
    `);
    console.log("[Reset Double Check] Successfully restored original candidate fit scores and ranks in PostgreSQL.");
    return res.json({ success: true });
  } catch (err) {
    console.error("[Reset Double Check] Error:", err);
    return res.status(500).json({ error: "Error resetting double check scores in DB" });
  }
});

app.post("/api/candidates/rehydrate-all", authenticateToken(useDbFallback ? null : pool), requireRole(['admin']), async (req, res) => {
  if (useDbFallback) {
    mockCandidates = mockCandidates.map(c => {
      const resolved = resolveAndNormalizeCandidateCvProfile({
        name: c.name,
        resumeText: c.resumeText || '',
        summary: c.summary || '',
        experience: c.experience,
        education: c.education,
        certifications: c.certifications
      });
      return { ...c, ...resolved };
    });
    saveDiskCandidates(mockCandidates);
    return res.json({ success: true, processed: mockCandidates.length, mode: 'memory' });
  }

  const client = await pool.connect();
  try {
    await recalibrateAllCandidateScores(client);
    const countRes = await client.query("SELECT COUNT(*)::int AS total FROM candidates");
    return res.json({ success: true, processed: countRes.rows[0]?.total || 0, mode: 'postgres' });
  } catch (err: any) {
    console.error("[Rehydrate All] Error:", err);
    return res.status(500).json({ error: "Error rehidratando candidatos en BD", detail: err.code });
  } finally {
    client.release();
  }
});

app.post("/api/candidates/purge-pool", authenticateToken(useDbFallback ? null : pool), requireRole(['admin']), async (req, res) => {
  console.log("[Purge Talent Pool] Deleting all candidates in stage 'Rechazado', 'Pool', or without vacancyId...");
  if (useDbFallback) {
    mockCandidates = mockCandidates.filter(c => c.vacancyId && c.stage !== 'Rechazado' && c.stage !== 'Pool');
    return res.json({ success: true, count: mockCandidates.length });
  }

  try {
    const result = await pool.query(`
      DELETE FROM candidates 
      WHERE stage = 'Rechazado' 
         OR stage = 'Pool' 
         OR stage = 'Nuevas Opciones' 
         OR vacancy_id IS NULL 
         OR vacancy_id = ''
    `);
    console.log(`[Purge Talent Pool] Removed ${result.rowCount} candidates from database.`);
    return res.json({ success: true, deletedCount: result.rowCount });
  } catch (err) {
    console.error("[Purge Talent Pool] Error:", err);
    return res.status(500).json({ error: "Error deleting pool candidates from DB" });
  }
});

app.delete("/api/candidates/:id", async (req, res) => {
  const { id } = req.params;
  const actor = (req as AuthenticatedRequest).user;

  if (useDbFallback) {
    mockCandidates = mockCandidates.filter(c => c.id !== id);
    saveDiskCandidates(mockCandidates);
    notifyN8nCandidateChange({ id }, 'delete');
    return res.json({ success: true });
  }

  try {
    const del = await pool.query("DELETE FROM candidates WHERE id = $1", [id]);
    if (!del.rowCount) return res.status(404).json({ error: "Candidato no encontrado" });
    await registrarAuditoria(pool, {
      usuario_id: actor?.id, usuario_email: actor?.email, ip_address: req.ip || '',
      accion: 'ELIMINAR_CANDIDATO', modulo: 'CANDIDATOS', nivel: 'WARN', detalles: { candidate_id: id }
    });
    notifyN8nCandidateChange({ id }, 'delete');
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting candidate:", err);
    res.status(500).json({ error: "Error al eliminar candidato", detail: err.code });
  }
});

// Toma hasta 3 preguntas de la IA que sean relevantes para la vacante y completa con el motor local.
function pickExperienceQuestions(aiQuestions: any, vacancy: any, candidate: { name?: string; resumeText?: string; experience?: string[] }, seed: string): string[] {
  const vac = { title: vacancy?.title, department: vacancy?.department, requirements: vacancy?.requirements || [] };
  const relevant = (Array.isArray(aiQuestions) ? aiQuestions : [])
    .filter((q: any) => typeof q === 'string' && q.trim().length > 15 && isQuestionRelevant(q, vac))
    .slice(0, 3);
  if (relevant.length >= 3) return relevant;
  const filler = generateExperienceQuestions(vac, candidate, { seed, exclude: relevant });
  return [...relevant, ...filler].slice(0, 3);
}

// Regenera SOLO las 3 preguntas de experiencia (antes "Regenerar" re-evaluaba todo el candidato y,
// al ser listas fijas por categoría, devolvía siempre las mismas preguntas).
app.post("/api/candidates/:id/regenerate-questions", async (req, res) => {
  const { id } = req.params;
  try {
    const cand = useDbFallback
      ? mockCandidates.find(c => c.id === id)
      : (await pool.query("SELECT * FROM candidates WHERE id = $1", [id])).rows[0];
    if (!cand) return res.status(404).json({ error: "Candidato no encontrado" });
    const vacancyId = cand.vacancy_id ?? cand.vacancyId;
    if (!vacancyId) return res.status(400).json({ error: "Asigna primero una vacante al candidato." });
    const vacRow = useDbFallback
      ? mockVacancies.find(v => v.id === vacancyId)
      : (await pool.query("SELECT * FROM vacancies WHERE id = $1", [vacancyId])).rows[0];
    if (!vacRow) return res.status(400).json({ error: "La vacante asignada ya no existe." });
    const vacancy = useDbFallback ? vacRow : mapVacancyRow(vacRow);

    const current = parseJsonField(cand.screening_questions ?? cand.screeningQuestions, []) as { question: string }[];
    const previous = current.slice(0, 3).map(q => q?.question).filter(Boolean);
    const questions = generateExperienceQuestions(
      { title: vacancy.title, department: vacancy.department, requirements: vacancy.requirements },
      { name: cand.name, resumeText: cand.resume_text ?? cand.resumeText, summary: cand.summary, experience: cand.experience || [] },
      { seed: `${id}|${Date.now()}|${Math.random()}`, exclude: previous }
    );
    const screening = buildScreeningQuestions(questions);

    if (useDbFallback) {
      Object.assign(cand, { screeningQuestions: screening, recommendedQuestions: questions });
      saveDiskCandidates(mockCandidates);
      return res.json({ success: true, candidate: cand });
    }
    const upd = await pool.query(
      `UPDATE candidates SET screening_questions = $1, recommended_questions = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [JSON.stringify(screening), questions, id]
    );
    res.json({ success: true, candidate: mapCandidateRow(upd.rows[0]) });
  } catch (err: any) {
    console.error("Error regenerando preguntas:", err);
    res.status(500).json({ error: "No se pudieron regenerar las preguntas", detail: err.code });
  }
});

app.patch("/api/candidates/:id", async (req, res) => {
  const { id } = req.params;
  const body = sanitizeUtf8(req.body || {});
  console.log(`[PATCH candidate] id=${id}, vacancyId=${body.vacancyId}, forceRegenerate=${body.forceRegenerate}`);
  const { 
    name, email, phone, stage, vacancyId, channel,
    expectedSalary, englishLevel, competencies, fitScore, initialFitScore,
    summary, strengths, growths, doubleCheckReport, interviewSpeech,
    screeningQuestions, recommendedQuestions, experience, education, certifications,
    comments, resumeText, detectedGuidanceLevel, isStarred, tags, suggestedTime
  } = body;

  const safeExperience = experience !== undefined && Array.isArray(experience) ? normalizeCanonicalExperience(experience) : undefined;
  const safeEducation = education !== undefined && Array.isArray(education) ? normalizeCanonicalEducation(education) : undefined;
  const safeCertifications = certifications !== undefined && Array.isArray(certifications) ? normalizeCanonicalCertifications(certifications) : undefined;

  if (useDbFallback) {
    let idx = mockCandidates.findIndex(c => c.id === id);
    let oldVacId = null;
    if (idx === -1) {
      return res.status(404).json({ error: "Candidato no encontrado" });
    }
    oldVacId = mockCandidates[idx].vacancyId;
    mockCandidates[idx] = { ...mockCandidates[idx], ...req.body };
    const resolvedMockCv = resolveAndNormalizeCandidateCvProfile({
      name: mockCandidates[idx].name,
      resumeText: req.body.resumeText || mockCandidates[idx].resumeText || '',
      summary: mockCandidates[idx].summary || '',
      experience: experience !== undefined ? safeExperience : mockCandidates[idx].experience,
      education: education !== undefined ? safeEducation : mockCandidates[idx].education,
      certifications: certifications !== undefined ? safeCertifications : mockCandidates[idx].certifications
    });
    mockCandidates[idx].experience = resolvedMockCv.experience;
    mockCandidates[idx].education = resolvedMockCv.education;
    mockCandidates[idx].certifications = resolvedMockCv.certifications;
    const targetVacId = vacancyId || mockCandidates[idx].vacancyId;
    
    if (targetVacId && (targetVacId !== oldVacId || req.body.forceRegenerate)) {
      const vacancy = mockVacancies.find(v => v.id === targetVacId);
      const resumeTextToUse = req.body.resumeText || mockCandidates[idx].resumeText || "";
      const result = runLocalHeuristicAnalysis(
        mockCandidates[idx].name, 
        resumeTextToUse, 
        vacancy ? vacancy.title : "Consultor Especialista", 
        vacancy
      );
      const currentCandSummary = (mockCandidates[idx].summary || '').trim();
      const preservedSummary = (currentCandSummary.length > 25) ? currentCandSummary : (result.summary || currentCandSummary);
      const isNewVac = (targetVacId !== oldVacId);
      const newInitialFit = isNewVac ? result.fitScore : (mockCandidates[idx].initialFitScore ?? result.fitScore);

      mockCandidates[idx] = {
        ...mockCandidates[idx],
        vacancyId: targetVacId,
        competencies: result.competencies,
        fitScore: result.fitScore,
        initialFitScore: newInitialFit,
        summary: preservedSummary,
        strengths: result.strengths,
        growths: result.growths,
        recommendedQuestions: result.recommendedQuestions,
        suggestedTime: result.suggestedTime,
        // 3 de experiencia + 4 de disponibilidad (antes 4 + 4 y la pantalla mostraba 3 + 4 desalineadas)
        screeningQuestions: buildScreeningQuestions(result.recommendedQuestions || [])
      };
    }
    
    saveDiskCandidates(mockCandidates);
    notifyN8nCandidateChange(mockCandidates[idx], 'update');
    return res.json({ success: true, candidate: mockCandidates[idx] });
  }

  try {
    // Antes: si el candidato no existía, PATCH lo creaba con datos inventados (candidato@eas.com.mx).
    const candResult = await pool.query("SELECT * FROM candidates WHERE id = $1", [id]);
    if (!candResult.rowCount) {
      return res.status(404).json({ error: "Candidato no encontrado en la base de datos" });
    }
    const origCandidate = candResult.rows[0] || {};
    const oldVacId = origCandidate.vacancy_id;

    // Validate vacancyId existence if specified to avoid Foreign Key (23503) constraint failure
    let safeVacancyId: string | null = origCandidate.vacancy_id || null;
    if (stage === 'Pool') {
      safeVacancyId = null;
    } else if (vacancyId !== undefined) {
      if (!vacancyId || vacancyId === "" || vacancyId === "null" || vacancyId === "unassigned") {
        safeVacancyId = null;
      } else {
        const checkVac = await pool.query("SELECT id FROM vacancies WHERE id = $1", [vacancyId]);
        if (!checkVac.rowCount) {
          // Antes: se asignaba igual y el UPDATE fallaba por la FK (23503) → 500 oculto por el front.
          return res.status(400).json({ error: `La vacante '${vacancyId}' no existe en la base de datos` });
        }
        safeVacancyId = vacancyId;
      }
    }

    const effectiveResume = typeof resumeText === 'string' ? resumeText : (origCandidate.resume_text || '');
    const patchHealth = detectDegradedCvFields({
      experience: experience !== undefined ? safeExperience : (Array.isArray(origCandidate.experience) ? origCandidate.experience : []),
      education: education !== undefined ? safeEducation : (Array.isArray(origCandidate.education) ? origCandidate.education : []),
      certifications: certifications !== undefined ? safeCertifications : (Array.isArray(origCandidate.certifications) ? origCandidate.certifications : []),
      resumeText: effectiveResume
    });
    const autoResolvedCv = (resumeText !== undefined || patchHealth.needsAnyNormalization)
      ? resolveAndNormalizeCandidateCvProfile({
          name: name || origCandidate.name || '',
          resumeText: effectiveResume,
          summary: summary || origCandidate.summary || '',
          experience: experience !== undefined ? safeExperience : origCandidate.experience,
          education: education !== undefined ? safeEducation : origCandidate.education,
          certifications: certifications !== undefined ? safeCertifications : origCandidate.certifications
        })
      : null;

    const finalExperienceParam = autoResolvedCv ? autoResolvedCv.experience : (experience !== undefined ? (safeExperience || null) : null);
    const finalEducationParam = autoResolvedCv ? autoResolvedCv.education : (education !== undefined ? (safeEducation || null) : null);
    const finalCertificationsParam = autoResolvedCv ? autoResolvedCv.certifications : (certifications !== undefined ? (safeCertifications || null) : null);

    const result = await pool.query(
      `UPDATE candidates SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        stage = COALESCE($4, stage),
        vacancy_id = $5,
        channel = COALESCE($6, channel),
        expected_salary = COALESCE($7, expected_salary),
        english_level = COALESCE($8, english_level),
        competencies = COALESCE($9, competencies),
        fit_score = COALESCE($10, fit_score),
        initial_fit_score = COALESCE($11, initial_fit_score),
        summary = COALESCE($12, summary),
        strengths = COALESCE($13, strengths),
        growths = COALESCE($14, growths),
        double_check_report = COALESCE($15, double_check_report),
        interview_speech = COALESCE($16, interview_speech),
        screening_questions = COALESCE($17, screening_questions),
        recommended_questions = COALESCE($18, recommended_questions),
        experience = COALESCE($19, experience),
        education = COALESCE($20, education),
        certifications = COALESCE($21, certifications),
        comments = COALESCE($22, comments),
        resume_text = COALESCE($23, resume_text),
        detected_guidance_level = COALESCE($24, detected_guidance_level),
        is_starred = COALESCE($25, is_starred),
        tags = COALESCE($26::text[], tags),
        suggested_time = COALESCE($27, suggested_time),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $28 RETURNING *`,
      sanitizeForPg([
        name !== undefined ? name : null,
        email !== undefined ? email : null,
        phone !== undefined ? phone : null,
        stage !== undefined ? stage : null,
        safeVacancyId,
        channel !== undefined ? channel : null,
        expectedSalary !== undefined && expectedSalary !== null ? String(expectedSalary) : null,
        englishLevel !== undefined ? englishLevel : null,
        competencies !== undefined ? JSON.stringify(competencies) : null,
        fitScore !== undefined && fitScore !== null ? Math.max(0, Math.min(100, Math.round(Number(fitScore)))) : null,
        initialFitScore !== undefined && initialFitScore !== null ? Math.max(0, Math.min(100, Math.round(Number(initialFitScore)))) : null,
        summary !== undefined ? summary : null,
        strengths !== undefined ? strengths : null,
        growths !== undefined ? growths : null,
        doubleCheckReport !== undefined ? doubleCheckReport : null,
        interviewSpeech !== undefined ? interviewSpeech : null,
        screeningQuestions !== undefined ? JSON.stringify(screeningQuestions) : null,
        recommendedQuestions !== undefined ? recommendedQuestions : null,
        finalExperienceParam,
        finalEducationParam,
        finalCertificationsParam,
        comments !== undefined ? comments : null,
        resumeText !== undefined ? resumeText : null,
        detectedGuidanceLevel !== undefined ? detectedGuidanceLevel : null,
        typeof isStarred === 'boolean' ? isStarred : null,
        toTextArray(tags),
        suggestedTime !== undefined ? suggestedTime : null,
        id
      ])
    );

    let updatedCandidate = result.rows[0];
    const targetVacId = vacancyId !== undefined ? safeVacancyId : origCandidate.vacancy_id;
    const resumeTextToUse = req.body.resumeText || updatedCandidate.resume_text || "";

    if (!targetVacId && (safeVacancyId === null || stage === 'Pool')) {
      const strictPool = calculateStrictFitScore(
        { name: updatedCandidate.name, resumeText: resumeTextToUse, summary: updatedCandidate.summary, experience: updatedCandidate.experience },
        undefined
      );
      await pool.query(
        `UPDATE candidates SET fit_score = $1, initial_fit_score = COALESCE(initial_fit_score, $1), stage = 'Pool', vacancy_id = NULL WHERE id = $2`,
        [strictPool.fitScore, id]
      );
      updatedCandidate.fit_score = strictPool.fitScore;
      updatedCandidate.stage = 'Pool';
      updatedCandidate.vacancy_id = null;
    } else if (targetVacId && (targetVacId !== oldVacId || req.body.forceRegenerate)) {
      const vacResult = await pool.query("SELECT * FROM vacancies WHERE id = $1", [targetVacId]);
      const vacancy = vacResult.rows[0];
      
      if (vacancy) {
        let minComp: any = {};
        try {
          minComp = typeof vacancy.min_competencies === 'string' ? JSON.parse(vacancy.min_competencies) : (vacancy.min_competencies || {});
        } catch (e) {}

        const targetVacancy = {
          id: vacancy.id,
          title: vacancy.title,
          department: vacancy.department,
          description: vacancy.description,
          requirements: vacancy.requirements,
          experienceYears: vacancy.experience_years || vacancy.experienceYears,
          requiredGuidanceLevel: vacancy.required_guidance_level || vacancy.requiredGuidanceLevel,
          englishLevel: vacancy.english_level,
          modalidad: vacancy.modalidad,
          salaryRange: vacancy.salary_range,
          minCompetenciesRequired: minComp
        };

        const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);
        let evalResult;

        if (client) {
          try {
            const weights = await getLearningWeights();
            const systemInstruction = `Eres el mejor Socio Consultor en Capital Humano, Reclutamiento de Élite y Comunicación Organizacional de EAS Consulting. Tu objetivo es predecir el éxito laboral analizando conductas, compatibilidades de vacantes pedidas, competencias clave del 1 al 100, fortalezas, puntos de mejora y slots ideales para programar entrevistas eficientemente.
IMPORTANTE: El sistema ha aprendido de las decisiones anteriores de contratación del reclutador y prioriza las competencias de acuerdo con los siguientes factores de importancia ponderados: Liderazgo: ${weights.Liderazgo.toFixed(2)}, Comunicación: ${weights.Comunicación.toFixed(2)}, Trabajo en Equipo: ${weights['Trabajo en Equipo'].toFixed(2)}, Habilidades Técnicas: ${weights['Habilidades Técnicas'].toFixed(2)}, Resolución de Problemas: ${weights['Resolución de Problemas'].toFixed(2)}. Si un factor de peso es mayor a 1.0, asigna mayor relevancia y rigurosidad a esa competencia en la calificación y en el fitScore final, y si es menor, ten menor rigor en ella, afinando el proceso de selección continuamente.`;

            const prompt = `Analiza el siguiente perfil/CV de un candidato para EAS Consulting para el rol de "${vacancy.title}". 
Nombre del candidato: ${updatedCandidate.name}
Currículum/Perfil:
${resumeTextToUse}

El candidato está aplicando a la siguiente VACANTE específica basada en la Requisición (SR) oficial de EAS:
- Título: ${targetVacancy.title}
- Departamento: ${targetVacancy.department}
- Descripción: ${targetVacancy.description}
- Habilidades Requeridas: ${targetVacancy.requirements?.join(", ")}
- Nivel de Inglés Requerido: ${targetVacancy.englishLevel || 'No especificado'}
- Modalidad de Trabajo: ${targetVacancy.modalidad || 'No especificado'}
- Presupuesto Salarial (Tope Máximo): ${targetVacancy.salaryRange || 'No especificado'}
- Umbrales Mínimos de Competencia Esperados: Liderazgo: ${targetVacancy.minCompetenciesRequired?.Liderazgo}%, Comunicación: ${targetVacancy.minCompetenciesRequired?.Comunicación}%, Trabajo en Equipo: ${targetVacancy.minCompetenciesRequired?.['Trabajo en Equipo']}%, Habilidades Técnicas: ${targetVacancy.minCompetenciesRequired?.['Habilidades Técnicas']}%, Resolución de Problemas: ${targetVacancy.minCompetenciesRequired?.['Resolución de Problemas']}%

OBLIGATORIO PARA CUESTIONARIO DE DOBLE VALIDACIÓN (recommendedQuestions):
Genera exactamente 4 PREGUNTAS TÉCNICAS Y DE CONDUCTA 100% PERSONALIZADAS PARA ${updatedCandidate.name}.
CADA PREGUNTA DEBE:
1. Hacer referencia explícita a la trayectoria previa descrita en el CV de ${updatedCandidate.name} (puestos anteriores, empresas, herramientas o proyectos específicos citados en su currículum).
2. Confrontar directamente esa experiencia contra los requerimientos específicos de la vacante "${targetVacancy.title}".
3. NUNCA utilices preguntas genéricas o plantillas estándar repetitivas.

Crucial: Evalúa e integra una precalificación comparando minuciosamente el perfil, el nivel de inglés detectado en su currículum y sus expectativas salariales contra las exigencias del puesto. Si el puesto exige nivel de inglés "Avanzado" o "Medio" y el candidato no lo cumple de forma clara en el texto, o si sus expectativas exceden el tope salarial, penaliza el fitScore significativamente (resta entre 15 y 25 puntos de compatibilidad).

Por favor, como experto en Atracción de Capital Humano, realiza un filtrado y análisis profundo de competencias clave e indicadores. Devuelve una evaluación detallada respetando la estructura JSON exigida.`;

            const response = await client.models.generateContent({
              model: GEMINI_MODEL,
              contents: prompt,
              config: {
                temperature: 0.1,
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    fitScore: { type: Type.INTEGER },
                    competencies: {
                      type: Type.OBJECT,
                      properties: {
                        Liderazgo: { type: Type.INTEGER },
                        Comunicación: { type: Type.INTEGER },
                        "Trabajo en Equipo": { type: Type.INTEGER },
                        "Habilidades Técnicas": { type: Type.INTEGER },
                        "Resolución de Problemas": { type: Type.INTEGER }
                      },
                      required: ["Liderazgo", "Comunicación", "Trabajo en Equipo", "Habilidades Técnicas", "Resolución de Problemas"]
                    },
                    summary: { type: Type.STRING },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    growths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    recommendedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["fitScore", "competencies", "summary", "strengths", "growths", "recommendedQuestions"]
                }
              }
            });
            const cleanedText = cleanGeminiJson(response.text || '{}');
            evalResult = JSON.parse(cleanedText);
          } catch (e) {
            console.error("Error executing Gemini re-evaluation during vacancy change:", e);
            evalResult = runLocalHeuristicAnalysis(updatedCandidate.name, updatedCandidate.resume_text || "", vacancy.title, targetVacancy);
          }
        } else {
          evalResult = runLocalHeuristicAnalysis(updatedCandidate.name, updatedCandidate.resume_text || "", vacancy.title, targetVacancy);
        }

        // Las preguntas de IA solo se aceptan si tienen relación con la vacante; si no, el motor las completa.
        evalResult.recommendedQuestions = pickExperienceQuestions(
          evalResult.recommendedQuestions, targetVacancy,
          { name: updatedCandidate.name, resumeText: resumeTextToUse, experience: updatedCandidate.experience || [] },
          `${id}|${targetVacancy.title}|${Date.now()}`
        );

        const resolvedForVac = resolveAndNormalizeCandidateCvProfile({
          name: updatedCandidate.name,
          resumeText: resumeTextToUse,
          summary: evalResult.summary || updatedCandidate.summary || origCandidate.summary || '',
          experience: experience !== undefined ? experience : updatedCandidate.experience,
          education: education !== undefined ? education : updatedCandidate.education,
          certifications: certifications !== undefined ? certifications : updatedCandidate.certifications,
          fallbackRole: targetVacancy.title
        });

        const isNewVac = (targetVacId !== oldVacId);
        const candForStrict = {
          name: cleanCandidateName(updatedCandidate.name, resumeTextToUse, updatedCandidate.email),
          resumeText: resumeTextToUse,
          summary: evalResult.summary || updatedCandidate.summary || origCandidate.summary || '',
          experience: resolvedForVac.experience,
          education: resolvedForVac.education,
          certifications: resolvedForVac.certifications
        };

        // Calibración determinista estricta contra la vacante asignada (100% invariante con el optimizador cruzado)
        const strictEval = calculateStrictFitScore(candForStrict, targetVacancy);
        const dynamicCompetencies = calculateCandidateCompetencies(candForStrict, targetVacancy);
        const analyticalSummary = synthesizeAnalyticalCandidateSummary(candForStrict, targetVacancy);
        const guidanceInfo = computeGuidanceForCandidate(candForStrict, targetVacancy);

        const calibratedScore = strictEval.fitScore;
        const newInitialFit = isNewVac ? calibratedScore : (origCandidate.initial_fit_score ?? calibratedScore);

        const finalStrengths = strictEval.strengths.length > 0 ? strictEval.strengths : (evalResult.strengths || []);
        const finalGrowths = strictEval.growths.length > 0 ? strictEval.growths : (evalResult.growths || []);

        const updateEval = await pool.query(
          `UPDATE candidates SET 
            competencies = $1,
            fit_score = $2,
            initial_fit_score = $3,
            summary = $4,
            strengths = $5,
            growths = $6,
            recommended_questions = $7,
            suggested_time = $8,
            screening_questions = $9,
            detected_guidance_level = $10,
            experience = $11,
            education = $12,
            certifications = $13
          WHERE id = $14 RETURNING *`,
          sanitizeForPg([
            JSON.stringify(dynamicCompetencies),
            calibratedScore,
            newInitialFit,
            analyticalSummary,
            finalStrengths,
            finalGrowths,
            evalResult.recommendedQuestions,
            "", // Se elimina sugerencia de hora simulada
            JSON.stringify(buildScreeningQuestions(evalResult.recommendedQuestions || [])),
            guidanceInfo.candidate.level,
            resolvedForVac.experience,
            resolvedForVac.education,
            resolvedForVac.certifications,
            id
          ])
        );
        if (updateEval.rowCount && updateEval.rowCount > 0) {
          updatedCandidate = updateEval.rows[0];
        }
      }
    }

    const mapped = mapCandidateRow(updatedCandidate);

    notifyN8nCandidateChange(mapped, 'update');
    res.json({ success: true, candidate: mapped });
  } catch (err: any) {
    console.error("Error updating candidate:", err);
    res.status(500).json({ error: "Error al actualizar candidato", detail: err?.code });
  }
});

app.get("/api/health", (req, res) => {
  // Expone el estado REAL del almacenamiento (antes solo decía "ok" aunque la BD estuviera caída
  // y el server estuviera guardando en memoria).
  const configured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  const storage = useDbFallback ? 'memory-demo' : (dbReady ? 'postgres' : 'postgres-unavailable');
  res.status(useDbFallback || dbReady ? 200 : 503).json({
    status: useDbFallback || dbReady ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    storage,
    database: useDbFallback ? null : { connected: dbReady, connectedAt: dbConnectedAt, lastError: dbReady ? null : dbLastError },
    apiConfigured: configured
  });
});

// (Eliminado: segundo POST /api/auth/m365 duplicado que "autenticaba" cualquier correo.)

function extractWordFallbackText(buffer: Buffer): string {
  try {
    let xlsxLib: any = XLSX;
    if (!xlsxLib || !xlsxLib.CFB) {
      xlsxLib = createRequire(typeof __filename !== "undefined" ? __filename : import.meta.url)('xlsx');
    }
    if (xlsxLib && xlsxLib.CFB) {
      const cfb = xlsxLib.CFB.read(buffer, { type: 'buffer' });
      // 1. Probar paquete docx (document.xml)
      const docEntry = xlsxLib.CFB.find(cfb, 'document.xml') || xlsxLib.CFB.find(cfb, 'word/document.xml');
      if (docEntry && docEntry.content) {
        const xml = Buffer.from(docEntry.content).toString('utf8');
        const text = xml
          .replace(/<w:p\b[^>]*>/gi, '\n')
          .replace(/<w:tab\/>/gi, '\t')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/[ \t]+/g, ' ')
          .trim();
        if (text.length >= 30) return text;
      }

      // 2. Probar formato OLE WordDocument (.doc clásico Word 97-2003)
      const wordDocEntry = xlsxLib.CFB.find(cfb, 'WordDocument') || xlsxLib.CFB.find(cfb, 'worddocument');
      const streamBuf = wordDocEntry && wordDocEntry.content ? Buffer.from(wordDocEntry.content) : buffer;

      const utf16leStr = streamBuf.toString('utf16le');
      const utf16Matches = utf16leStr.match(/[A-ZÁÉÍÓÚÑa-záéíóúñ0-9@.,:;\-_/()#%+\s]{5,}/g) || [];
      const cleanUtf16 = utf16Matches.filter(s => /[a-záéíóúñ]{3,}/i.test(s)).join('\n').trim();
      if (cleanUtf16.length >= 50) return cleanUtf16;

      const latin1Str = streamBuf.toString('latin1');
      const latin1Matches = latin1Str.match(/[A-ZÁÉÍÓÚÑa-záéíóúñ0-9@.,:;\-_/()#%+\s]{5,}/g) || [];
      const cleanLatin1 = latin1Matches.filter(s => /[a-záéíóúñ]{3,}/i.test(s)).join('\n').trim();
      if (cleanLatin1.length >= 50) return cleanLatin1;
    }
  } catch (err: any) {
    console.warn("[Word Fallback] Error procesando CFB/Word:", err?.message);
  }

  const rawMatches = buffer.toString('utf8').match(/[A-ZÁÉÍÓÚÑa-záéíóúñ0-9@.,:;\-_/()#%+\s]{6,}/g) || [];
  return rawMatches.filter(s => /[a-záéíóúñ]{3,}/i.test(s)).join(' ').trim();
}

// Extracción de texto de CV compartida por /api/parse-cv y /api/candidates/apply.
// El tipo se valida por firma de bytes (detectCvFileKind) y lanza CvRejectedError si no aplica.
async function extractCvText(buffer: Buffer, filename: string): Promise<{ text: string; pages?: number }> {
  const kind = detectCvFileKind(buffer, filename);
  if (kind === 'txt') return { text: sanitizeUtf8(buffer.toString('utf-8')) };
  if (kind === 'docx' || kind === 'doc') {
    const head = buffer.subarray(0, 4);
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    
    // Si es ZIP (docx estándar), procesar con mammoth
    if (isZip && mammoth) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result && result.value && result.value.trim().length >= 30) {
          return { text: sanitizeUtf8(result.value) };
        }
      } catch (wordErr: any) {
        console.warn("[CV Word] mammoth falló; se intentará extracción de respaldo CFB/XML:", wordErr?.message);
      }
    }

    // Extractor de respaldo para .doc OLE (Word 97-2003) y docx con compresión alternativa
    try {
      const fallbackText = extractWordFallbackText(buffer);
      if (fallbackText && fallbackText.trim().length >= 30) {
        return { text: sanitizeUtf8(fallbackText) };
      }
    } catch (fbErr: any) {
      console.warn("[CV Word] Extractor de respaldo Word falló:", fbErr?.message);
    }

    throw new CvRejectedError('FILE_TYPE_MISMATCH', 'El documento de Word no contiene texto legible o está protegido con contraseña.');
  }
  // PDF
  let text = '';
  let pages: number | undefined;
  try {
    if (pdf && (pdf.PDFParse || typeof pdf.PDFParse === "function")) {
      const parser = new pdf.PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text || '';
      pages = typeof result.total === 'number' ? result.total : undefined;
      await parser.destroy();
    } else if (pdf && typeof pdf === "function") {
      const data = await pdf(buffer);
      text = data.text || '';
      pages = typeof data.numpages === 'number' ? data.numpages : undefined;
    }
  } catch (pdfErr) {
    console.warn("[CV] pdf-parse falló; se intenta el decodificador de respaldo:", pdfErr);
  }
  if (!text.trim()) text = extractPdfTextFallback(buffer);
  return { text: sanitizeUtf8(text), pages };
}

function rejectCv(res: express.Response, filename: string, err: CvRejectedError) {
  console.warn(`[CV] Rechazado "${filename}" (${err.code}): ${err.message} ${err.reasons.join(' | ')}`);
  return res.status(422).json({ error: err.message, code: err.code, reasons: err.reasons, file: filename });
}

// CV parsing and automated field Extraction endpoint
app.post("/api/parse-cv", aiQuotaRateLimiter, (req, res, next) => {
  console.log(`[Parser API] Incoming file upload request to /api/parse-cv from ${req.ip}`);
  upload.single("cv")(req, res, (err: any) => {
    if (err) {
      console.error("[Parser API] Multer upload middleware failed:", err);
      return res.status(400).json({ 
        error: `Error al subir el archivo: ${err.message || String(err)}` 
      });
    }
    console.log("[Parser API] Multer completed successfully. File properties:", req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : "No file found under key 'cv'");
    // Validación de tamaño de archivo (máx 20MB). La validación de magic bytes la realiza detectCvFileKind.
    if (req.file) {
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (req.file.size > maxSize) {
        console.warn("[Parser API] File size exceeds limit:", req.file.size, ">", maxSize);
        return res.status(400).json({ error: 'El archivo excede el límite de 20MB' });
      }
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      console.error("[Parser API] Request contains no 'cv' file field after multer.");
      return res.status(400).json({ error: "No se proporcionó ningún archivo de CV en la clave 'cv'" });
    }

    const { originalname, buffer, mimetype } = req.file;
    console.log(`[Parser API] Processing file: ${originalname} (${mimetype}), size: ${buffer.length} bytes`);

    // Validación determinista ANTES de extraer campos: tipo real del archivo + estructura de CV.
    // (Antes: formato desconocido o PDF sin texto → se inventaba un candidato con el nombre del archivo.)
    let extractedText = "";
    try {
      const extracted = await extractCvText(buffer, originalname);
      extractedText = extracted.text;
      const assessment = assertIsCv(extracted.text, extracted.pages);
      console.log(`[Parser API] "${originalname}" validado como CV (puntaje ${assessment.score}, ${assessment.signals.pages ?? '?'} págs).`);
    } catch (e: any) {
      if (e instanceof CvRejectedError) return rejectCv(res, originalname, e);
      throw e;
    }

    const runHeuristicParser = (txt: string, fName: string) => {
      const guessed = parseFromFilename(fName);
      let name = guessed.name || fName.replace(/\.[^/.]+$/, "");
      let email = extractEmailFromText(txt) || "";
      let phone = extractPhoneFromText(txt) || "";
      let role = guessed.role || "Consultor Especialista";
      let suggestedChannel = "EAS Consulting DB";

      // Robust email lookup
      const parsedEmail = extractEmailFromText(txt);
      if (parsedEmail) {
        email = parsedEmail;
      }

      // Robust phone lookup
      const parsedPhone = extractPhoneFromText(txt);
      if (parsedPhone) {
        phone = parsedPhone;
      }

      // Find possible Name (first line < 35 chars that doesn't contain common noise)
      const lines = txt.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      const nameNoiseWords = [
        "curriculum", "cv", "resume", "email", "contacto", "teléfono", "phone", 
        "outsourcing", "experto", "especialista", "consultoría", "inglés", "ingles", 
        "información", "informacion", "personal", "perfil", "habilidades", "skills", 
        "experiencia", "educación", "educacion", "estudios", "cursos", "idiomas", 
        "español", "correo", "celular", "soft", "hard", "empresa", "datos", "nombre", 
        "resumen", "objetivo", "acerca", "sobre", "nacimiento", "nacionalidad", "civil", 
        "dirección", "direccion", "domicilio", "calle", "ciudad", "país", "pais", 
        "estado", "méxico", "mexico", "fecha", "año", "universidad", "licenciatura", 
        "ingeniería", "ingenieria", "ingeniero", "licenciado", "certificación", 
        "certificacion", "proyecto", "logros", "intereses", "referencias", "linkedin",
        "github", "tel", "mail", "skype", "edad", "genero", "género", "dirección",
        "trabajo", "laboral", "profesional", "tecnologías", "tecnologias", "herramientas",
        "aptitudes", "competencias", "formación", "formacion", "académica", "academica",
        "historial", "trayectoria", "adicional", "interés", "interes", "idioma",
        "nivel", "intermedio", "avanzado", "básico", "basico", "nativo", "conversacional",
        "hablado", "escrito", "lectura", "comprensión", "comprension", "hablar", "escribir",
        "leer", "porcentaje", "sofskills", "hardskills", "aptitud", "competencia",
        "conocimientos", "software", "hardware", "sistemas", "tecnología", "tecnologia",
        "desarrollador", "desarrollo", "programador", "programación", "programacion",
        "ingenieria", "ingeniero", "analista", "diseñador", "consultor", "gerente",
        "director", "coordinador", "jefe", "supervisor", "auxiliar", "asistente",
        "lider", "líder", "responsable", "encargado", "administrador", "administración",
        "administracion", "soporte", "técnico", "tecnico", "operador", "operario"
      ];

      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        const hasNoise = nameNoiseWords.some(word => lowerLine.includes(word));
        const words = line.split(/\s+/).filter(w => w.length > 0);
        
        if (
          line.length >= 6 &&
          line.length < 35 && 
          !hasNoise &&
          words.length >= 2 &&
          words.length <= 4 &&
          /^[A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+$/.test(line)
        ) {
          name = line;
          break;
        }
      }

      // Validate extracted name for common generic headers/noise
      const lowerName = name.toLowerCase().trim();
      const genericWords = ["requerimientos", "negocio", "conflictos", "professional", "development", "manejo", "proceso", "proyecto", "cliente", "equipo", "comunicación", "liderazgo", "implementation", "type", "description", "sap"];
      if (
        name === "Patricia Sandoval Guerrero" ||
        genericWords.some(w => lowerName.includes(w)) ||
        lowerName.startsWith("y ") ||
        lowerName.includes(" y ") ||
        lowerName.endsWith(".") ||
        name.split(/\s+/).length > 5
      ) {
        if (guessed && guessed.name) {
          name = guessed.name;
        }
      }

      // Guess role based on keywords
      const lowerText = txt.toLowerCase();
      if (lowerText.includes("analista") || lowerText.includes("datos") || lowerText.includes("data") || lowerText.includes("sql")) {
        role = "Data Analyst";
      } else if (lowerText.includes("recursos") || lowerText.includes("humanos") || lowerText.includes("rh") || lowerText.includes("talent") || lowerText.includes("puesto")) {
        role = "Consultor de Capital Humano";
      } else if (lowerText.includes("gerente") || lowerText.includes("manager") || lowerText.includes("director")) {
        role = "Hiring Manager";
      } else if (lowerText.includes("frontend") || lowerText.includes("react") || lowerText.includes("js") || lowerText.includes("desarrollador")) {
        role = "Frontend Developer";
      }

      // Extract experience, education, certifications and summary from text
      const structuredData = extractStructuredCvDataFromText(txt, name, role);

      // Auto-detect English Level from text
      let englishLevel: 'Básico' | 'Medio' | 'Avanzado' = 'Medio';
      if (/\b(c1|c2|bilingual|biling\u00fce|avanzado|advanced|fluent|fluido|toefl|ielts)\b/i.test(txt)) {
        englishLevel = 'Avanzado';
      } else if (/\b(b2|b1|intermedio|intermediate|medio|conversational|conversacional)\b/i.test(txt)) {
        englishLevel = 'Medio';
      } else if (/\b(a1|a2|b\u00e1sico|basico|basic)\b/i.test(txt)) {
        englishLevel = 'Básico';
      }

      // Auto-detect Expected Salary from text or estimate by role
      let expectedSalary = 45000;
      const salaryMatch = txt.match(/\$\s*([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{5,6})/);
      if (salaryMatch) {
        const parsedVal = parseInt(salaryMatch[1].replace(/,/g, ''), 10);
        if (parsedVal >= 15000 && parsedVal <= 250000) expectedSalary = parsedVal;
      }

      name = cleanCandidateName(name, txt, email);

      return {
        name,
        email,
        phone,
        role,
        suggestedChannel: suggestedChannel as any,
        summary: structuredData.summary,
        englishLevel,
        expectedSalary,
        experience: structuredData.experience,
        education: structuredData.education,
        certifications: structuredData.certifications,
        text: txt
      };
    };


    const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);

    if (!client) {
      console.log("Using Heuristic RegEx parser for CV extraction (fallback mode).");
      const fallbackResult = runHeuristicParser(extractedText, originalname);
      return res.json(fallbackResult);
    }

    // Call real Gemini
    try {
      console.log("Calling Gemini to extract structured CV fields from text...");
      const prompt = `Analiza el siguiente texto extraído de un currículum o perfil profesional de un candidato y extrae información estructurada de forma precisa.
Si algún campo no es explícito en el texto, asume una respuesta lógica coherente para el perfil del postulante.

Texto del Currículum para evaluación en EAS Consulting:
${extractedText}

Por favor, devuelve un objeto JSON válido con los campos requeridos estructurados según el esquema indicado.`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
          systemInstruction: "Eres un extractor de datos de contratación élite para EAS Consulting. Tu única función es extraer del texto del currículum o perfil y estructurar un JSON estable con campos precisos: name, email, phone, role, suggestedChannel, summary, englishLevel, expectedSalary, experience, education, y certifications. Es de CRÍTICA IMPORTANCIA que identifiques únicamente el NOMBRE Y APELLIDOS DE LA PERSONA en 'name'. NUNCA incluyas títulos de puesto, certificaciones o subtítulos (como 'Microsoft Azure Architect', 'Desarrollador', 'Consultor') dentro del campo 'name'. NUNCA uses títulos de sección como 'Información personal' o 'Perfil'. Extrae con la máxima prioridad el CORREO ELECTRÓNICO REAL y TELÉFONO MÓVIL del candidato presentes en su CV. Extrae el nivel de inglés ('Básico', 'Medio' o 'Avanzado') y sueldo pretendido. En 'summary', genera o extrae un PERFIL PROFESIONAL SINTETIZADO Y ABSTRACTO del candidato (de 3 a 5 líneas de redacción fluida). Debe ser una ABSTRACCIÓN INTEGRAL de toda su trayectoria: disciplina o formación base, años de experiencia acumulada, principales especialidades o industrias dominadas, metodologías/enfoques de trabajo y propuesta de valor profesional. PROHIBIDO: NUNCA copies simplemente las viñetas o responsabilidades de su primer empleo ni el primer párrafo aislado que encuentres. Si el CV contiene una sección 'PERFIL' o 'RESUMEN', úsala como base y abráela en un perfil profesional integral y fluido. En 'experience', extrae la información de HASTA LOS ÚLTIMOS 3 EMPLEOS (los 3 puestos más recientes o relevantes del candidato). Para cada empleo, genera una cadena estructurada en formato estricto: 'PUESTO | EMPRESA O CLIENTE | PERIODO (AÑOS/FECHAS) | RESPONSABILIDADES Y LOGROS CLAVE'. DIRECTRIZ OBLIGATORIA DE RESPONSABILIDADES Y LOGROS: deben redactarse OBLIGATORIAMENTE sintetizadas en ESPAÑOL EJECUTIVO DE CONSULTORÍA usando sustantivos verbales de impacto (ej: 'Gestión integral de...', 'Liderazgo de iniciativas...', 'Diseño e implementación de...', 'Atención y resolución de...'), de 1 a 2 oraciones concisas de alto valor, sin viñetas, sin dobles puntos ni frases truncadas a medias, INCLUSO si el CV original viene en inglés. PROHIBIDO: NUNCA asignes una ciudad, estado o modalidad (ej: Mexico City, CDMX, Guadalajara, Monterrey, Remoto, Hybrid) como puesto ocupado ni como empresa. El puesto ocupado debe ser siempre el cargo profesional del postulante. Si la cabecera en el CV incluye la ubicación (ej: 'SkillNet Inc | Mexico City | May/2025 – Sep/2026'), omite la ciudad o asígnala a la empresa, pero NUNCA la crees como un empleo separado ni pongas la ciudad como puesto. En 'education', extrae en formato 'CARRERA O GRADO | INSTITUCIÓN | AÑO O PERIODO'. Si la institución incluye el año al final (ej: 'Monterrey Institute of Technology, 1994'), extrae el año al campo de periodo y deja la institución limpia. PROHIBIDO incluir 'Periodo de estudios' como nombre de institución. En 'certifications', extrae la lista de certificaciones sin viñetas ni glifos Unicode iniciales (sin '●', '•', '-', '*').",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre y apellidos de la persona física (sin cargos, títulos ni certificaciones)." },
              email: { type: Type.STRING, description: "Email de contacto directo extraído del CV." },
              phone: { type: Type.STRING, description: "Teléfono móvil o de contacto directo." },
              role: { type: Type.STRING, description: "Título profesional sugerido u optimizado del candidato." },
              suggestedChannel: { type: Type.STRING, description: "Canal sugerido de entrada del candidato, debe ser uno de: 'LinkedIn', 'EAS Consulting DB', 'Referido', 'Glassdoor', 'Otros'." },
              summary: { type: Type.STRING, description: "Perfil profesional integral y abstracto del candidato sintetizando toda su trayectoria (de 3 a 5 líneas fluidas, nunca viñetas de un empleo)." },
              englishLevel: { type: Type.STRING, description: "Nivel de inglés declarado en el CV, uno de: 'Básico', 'Medio', 'Avanzado'." },
              expectedSalary: { type: Type.STRING, description: "Sueldo pretendido mensual expresado en MXN (ej: '45000' o '45,000 MXN')." },
              experience: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de hasta los últimos 3 empleos del candidato obligatoriamente en formato estricto: 'PUESTO | EMPRESA | PERIODO (AÑOS/FECHAS) | RESPONSABILIDADES Y LOGROS'. Las responsabilidades deben sintetizarse en español ejecutivo de consultoría (1-2 oraciones de impacto, sin viñetas ni frases truncadas). PROHIBIDO poner la empresa antes del puesto, ciudades como cargo o partir un empleo en dos entradas." },
              education: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de grados académicos y estudios superiores en formato: 'CARRERA O GRADO ACADÉMICO | INSTITUCIÓN EDUCATIVA | PERIODO'. PROHIBIDO incluir 'Periodo de estudios' como institución educativa." },
              certifications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de certificaciones obtenidas en formato 'CERTIFICACIÓN | EMISOR O INSTITUCIÓN | AÑO', sin viñetas ni glifos al inicio." }
            },
            required: ["name", "email", "phone", "role", "suggestedChannel", "summary", "englishLevel", "expectedSalary", "experience", "education", "certifications"]
          }
        }
      });

      const resultText = response.text || "{}";
      const cleanedText = cleanGeminiJson(resultText);
      const rawExtractedInfo = JSON.parse(cleanedText);
      const extractedInfo = validateAndNormalizeCanonicalCv(rawExtractedInfo);
      console.log("Successfully extracted and canonicalized CV information with Gemini:", extractedInfo.name);

      // Validate extracted name against common section headers
      let finalName = extractedInfo.name;
      const lowerExtractedName = (finalName || '').toLowerCase().trim();
      const nameBlacklist = [
        "información personal", "informacion personal", "experiencia profesional", "experiencia laboral",
        "currículum vitae", "curriculum vitae", "resumen", "perfil profesional", "datos de contacto",
        "contacto", "sobre mí", "sobre mi", "habilidades", "educación", "formación", "historial",
        "estudios", "idiomas", "intereses", "referencias", "proyectos", "and change my residence."
      ];
      if (!finalName || nameBlacklist.some(b => lowerExtractedName.includes(b)) || finalName.split(/\s+/).length > 5) {
        const guessed = parseFromFilename(originalname);
        if (guessed && guessed.name) {
          finalName = guessed.name;
          console.log(`[Parser API] Corrected candidate name using filename fallback: ${finalName}`);
        }
      }

      finalName = cleanCandidateName(finalName || extractedInfo.name, extractedText, extractedInfo.email);

      // Priority Extraction of real Email from raw CV text
      const realEmailFromText = extractEmailFromText(extractedText);
      let finalEmail = realEmailFromText || (extractedInfo.email && !extractedInfo.email.includes("example.com") && !extractedInfo.email.includes("sample.com") ? extractedInfo.email : "");
      if (realEmailFromText) {
        console.log(`[Parser API] Real email validated from CV text: ${finalEmail}`);
      }

      // Double-check phone number extraction with fallback filter
      let finalPhone = extractedInfo.phone;
      if (!finalPhone || finalPhone.trim().length < 8 || finalPhone.includes(".") || finalPhone.includes(" ")) {
        const fallbackPhone = extractPhoneFromText(extractedText);
        if (fallbackPhone) {
          finalPhone = fallbackPhone;
        }
      }

      const finalSummary = cleanCandidateProfileSummary(extractedInfo.summary, finalName || extractedInfo.name, extractedInfo.role);

      return res.json({
        ...extractedInfo,
        name: finalName || extractedInfo.name,
        email: finalEmail,
        phone: finalPhone || extractedInfo.phone,
        summary: finalSummary,
        suggestedChannel: "EAS Consulting DB",
        text: extractedText
      });
    } catch (gError) {
      console.error("Gemini CV extraction error (seamless local fallback activated):", gError);
      // Seamlessly fall back to heuristic parser!
      const fallbackResult = runHeuristicParser(extractedText, originalname);
      
      let finalFallbackName = fallbackResult.name;
      const lowerFallbackName = (finalFallbackName || '').toLowerCase().trim();
      const nameBlacklist = [
        "información personal", "informacion personal", "experiencia profesional", "experiencia laboral",
        "currículum vitae", "curriculum vitae", "resumen", "perfil profesional", "datos de contacto",
        "contacto", "sobre mí", "sobre mi", "habilidades", "educación", "formación", "historial",
        "estudios", "idiomas", "intereses", "referencias", "proyectos", "and change my residence."
      ];
      if (!finalFallbackName || nameBlacklist.some(b => lowerFallbackName.includes(b)) || finalFallbackName.split(/\s+/).length > 5) {
        const guessed = parseFromFilename(originalname);
        if (guessed && guessed.name) {
          finalFallbackName = guessed.name;
        }
      }

      const realFallbackEmail = extractEmailFromText(extractedText);
      const finalFallbackEmail = realFallbackEmail || fallbackResult.email;

      finalFallbackName = cleanCandidateName(finalFallbackName || fallbackResult.name, extractedText, finalFallbackEmail);

      return res.json({
        ...fallbackResult,
        experience: normalizeCanonicalExperience(fallbackResult.experience || []),
        education: normalizeCanonicalEducation(fallbackResult.education || []),
        certifications: normalizeCanonicalCertifications(fallbackResult.certifications || []),
        name: finalFallbackName,
        email: finalFallbackEmail,
        _isFallback: true,
        _warning: "Extraído de forma adaptativa por EAS Tech Parser™"
      });
    }

  } catch (error) {
    console.error("Parser CV server-side error:", error);
    res.status(500).json({ 
      error: "Error interno procesando el archivo de currículum",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// (Eliminado: generateQuestionsForCandidateAndVacancy/getSapSpecificQuestions — listas fijas por categoría
// con clasificación errónea. Reemplazado por src/utils/questionEngine.ts.)

// =============================================================================
// GUIDANCE LEVELS MATRIX (Perfil Puesto Guias.xlsx)
// =============================================================================

interface GuidanceLevelDef {
  rank: number;
  levelName: string;
  minExpYears: number;
  maxExpYears: number;
  englishRequired: 'A1' | 'B1' | 'B2' | 'C1' | 'C2';
  certificationsRequired: string[];
  keyResponsibilities: string[];
  softSkills: string[];
}

const GUIDANCE_LEVELS_CATALOG: Record<string, GuidanceLevelDef> = {
  "Guia Becario": {
    rank: 1,
    levelName: "Guia Becario",
    minExpYears: 0,
    maxExpYears: 1,
    englishRequired: "A1",
    certificationsRequired: ["Fundamentos de TI"],
    keyResponsibilities: ["Apoyo en tareas operativas básicas", "Documentación inicial de requerimientos"],
    softSkills: ["Proactividad", "Deseo de aprendizaje"]
  },
  "Jr. C": {
    rank: 2,
    levelName: "Jr. C",
    minExpYears: 0.5,
    maxExpYears: 1.5,
    englishRequired: "B1",
    certificationsRequired: ["Certificación Básica SAP"],
    keyResponsibilities: ["Ejecución de actividades de soporte técnico básico", "Redacción de informes simples"],
    softSkills: ["Trabajo en Equipo", "Comunicación Baremos"]
  },
  "Jr.B": {
    rank: 3,
    levelName: "Jr.B",
    minExpYears: 1,
    maxExpYears: 2,
    englishRequired: "B1",
    certificationsRequired: ["Certificación Media SAP Netweaver"],
    keyResponsibilities: ["Desarrollo de análisis simples", "Supervisión básica de tareas con acompañamiento"],
    softSkills: ["Responsabilidad", "Orientación a Resultados"]
  },
  "Jr. A": {
    rank: 4,
    levelName: "Jr. A",
    minExpYears: 1,
    maxExpYears: 2.5,
    englishRequired: "C1",
    certificationsRequired: ["Certificación TADM10", "TADM12", "SAP Netweaver"],
    keyResponsibilities: ["Análisis de negocio", "Construcción de soluciones técnicas", "Diagnósticos precisos"],
    softSkills: ["Autonomía", "Comunicación Clara", "Escucha Activa"]
  },
  "Sr B": {
    rank: 5,
    levelName: "Sr B",
    minExpYears: 2,
    maxExpYears: 4,
    englishRequired: "B2",
    certificationsRequired: ["Certificación SAP Netweaver AS", "Herramientas Admin"],
    keyResponsibilities: ["Ejecución técnica de complejidad alta", "Supervisión de consultores Jr"],
    softSkills: ["Liderazgo de Procesos", "Inteligencia Emocional", "Toma de Decisiones"]
  },
  "Sr A": {
    rank: 6,
    levelName: "Sr A",
    minExpYears: 3,
    maxExpYears: 5,
    englishRequired: "C1",
    certificationsRequired: ["Certificación SM100", "SM200/E2E100", "SAP Netweaver AS Consultant"],
    keyResponsibilities: ["Identificación y evaluación de necesidades complejas", "Diseño de soluciones avanzadas", "Supervisión de equipos Jr"],
    softSkills: ["Liderazgo Estratégico", "Visión de Negocio", "Compromiso Alto"]
  }
};

function determineVacancyGuidanceLevel(vacancy: any): { level: string; rank: number } {
  if (vacancy?.requiredGuidanceLevel && vacancy.requiredGuidanceLevel !== 'Guia PM' && vacancy.requiredGuidanceLevel !== 'Guía PM') {
    const gl = String(vacancy.requiredGuidanceLevel).trim();
    if (GUIDANCE_LEVELS_CATALOG[gl]) {
      return { level: gl, rank: GUIDANCE_LEVELS_CATALOG[gl].rank };
    }
  }
  const text = `${vacancy?.title || ''} ${vacancy?.description || ''}`.toLowerCase();
  
  if (text.includes("sr a") || text.includes("sr. a") || text.includes("senior a") || text.includes("lider tecnico") || text.includes("líder técnico") || text.includes("tech lead") || text.includes("arquitecto")) {
    return { level: "Sr A", rank: 6 };
  }
  if (text.includes("sr b") || text.includes("sr. b") || text.includes("senior b")) {
    return { level: "Sr B", rank: 5 };
  }
  if (text.includes("jr a") || text.includes("jr. a") || text.includes("junior a")) {
    return { level: "Jr. A", rank: 4 };
  }
  if (text.includes("jr b") || text.includes("jr. b") || text.includes("junior b")) {
    return { level: "Jr.B", rank: 3 };
  }
  if (text.includes("jr c") || text.includes("jr. c") || text.includes("junior c")) {
    return { level: "Jr. C", rank: 2 };
  }
  if (text.includes("becario") || text.includes("intern")) {
    return { level: "Becario", rank: 1 };
  }
  
  const yrs = vacancy?.experienceYears || 0;
  if (yrs >= 5) return { level: "Sr A", rank: 6 };
  if (yrs >= 3) return { level: "Sr B", rank: 5 };
  if (yrs >= 2) return { level: "Jr. A", rank: 4 };
  if (yrs >= 1) return { level: "Jr.B", rank: 3 };
  return { level: "Jr. C", rank: 2 };
}

function detectCandidateGuidanceLevel(candidateName: string, resumeText: string): { level: string; rank: number } {
  const text = (resumeText || '').toLowerCase();
  
  // Detección explícita de perfiles sin experiencia laboral
  const isNoExpProfile = /\b(sin experiencia|sin exp|reci[eé]n egresad[oa]|estudiante|pasante|becari[oa]|practicante|buscando primer empleo|sin antecedentes laboral|sin trayectoria previa)\b/i.test(text);
  const hasLeadershipTitle = /\b(director|directora|gerente|lider tecnico|líder técnico|tech lead|arquitecto)\b/i.test(text);

  if (isNoExpProfile && !hasLeadershipTitle) {
    return { level: "Becario", rank: 1 };
  }

  // Aislar únicamente el bloque de experiencia laboral para no contar años de estudio universitario o escolar
  let expSectionText = text;
  const expMatchSection = text.match(/(?:experiencia\s+(?:laboral|profesional)?|trayectoria|work\s+experience|historial\s+laboral)([\s\S]*?)(?:educaci[oó]n|formaci[oó]n|estudios|certificaci|habilidades|skills|$)/i);
  if (expMatchSection && expMatchSection[1] && expMatchSection[1].length > 30) {
    expSectionText = expMatchSection[1];
  }

  let expYears = 0;
  const expMatch = expSectionText.match(/(\d+)\s*(?:años|a\s*ñ\s*o\s*s|yrs|years)\s*(?:de\s*)?(?:experiencia|trayectoria)/i);
  if (expMatch) {
    expYears = parseInt(expMatch[1], 10);
  } else if (!isNoExpProfile) {
    const years = expSectionText.match(/\b(20\d{2}|19\d{2})\b/g);
    if (years && years.length >= 2) {
      const nums = years.map(Number).sort((a,b) => a - b);
      expYears = Math.max(0, Math.min(15, nums[nums.length - 1] - nums[0]));
    }
  }

  if (isNoExpProfile) expYears = 0;

  const hasLeadKeywords = /\b(lider tecnico|líder técnico|tech lead|arquitecto)\b/i.test(text);
  const hasSm100 = text.includes("sm100") || text.includes("sm200") || text.includes("netweaver as consultant");

  if (!isNoExpProfile && (expYears >= 5 || (expYears >= 3 && text.includes("sr") && hasSm100) || (expYears >= 4 && hasLeadKeywords))) {
    return { level: "Sr A", rank: 6 };
  }
  if (!isNoExpProfile && (expYears >= 3 || text.includes("senior"))) {
    return { level: "Sr B", rank: 5 };
  }
  if (!isNoExpProfile && (expYears >= 2 || text.includes("tadm10") || text.includes("tadm12") || text.includes("c1"))) {
    return { level: "Jr. A", rank: 4 };
  }
  if (!isNoExpProfile && (expYears >= 1 || text.includes("junior"))) {
    return { level: "Jr.B", rank: 3 };
  }
  if (!isNoExpProfile && expYears >= 0.5) {
    return { level: "Jr. C", rank: 2 };
  }
  return { level: "Becario", rank: 1 };
}

// Guidance Admin Endpoints
app.get("/api/admin/guidance-matrix", (req, res) => {
  try {
    const filePath = path.join(__dirname, "Perfil Puesto Guias.xlsx");
    let excelMatrix: any = null;
    if (fs.existsSync(filePath)) {
      const wb = XLSX.readFile(filePath);
      excelMatrix = wb.SheetNames.map((s: string) => ({
        sheetName: s,
        rowsCount: XLSX.utils.sheet_to_json(wb.Sheets[s]).length
      }));
    }
    return res.json({
      success: true,
      catalog: GUIDANCE_LEVELS_CATALOG,
      excelSheets: excelMatrix
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Error obteniendo la matriz guía.", details: err?.message });
  }
});

app.post("/api/admin/upload-guidance-excel", requireRole(['admin']), upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo Excel." });
    }
    const targetPath = path.join(__dirname, "Perfil Puesto Guias.xlsx");
    fs.writeFileSync(targetPath, req.file.buffer);
    console.log("[ADMIN] Archivo Perfil Puesto Guias.xlsx actualizado exitosamente.");
    
    const wb = XLSX.readFile(targetPath);
    return res.json({
      success: true,
      message: "¡Matriz de Perfiles y Guías de Puesto actualizada exitosamente!",
      sheets: wb.SheetNames
    });
  } catch (err: any) {
    console.error("Error al actualizar Perfil Puesto Guias.xlsx:", err);
    return res.status(500).json({ error: "Error al procesar el archivo Excel.", details: err?.message });
  }
});

export function cleanCandidateProfileSummary(rawSummary: string, name?: string, role?: string): string {
  let s = (rawSummary || '').trim();
  // Quitar bloques de evaluación psicométrica, tests o encabezados de porcentaje
  s = s.replace(/.*?(psicom[ée]tricos|porcentaje de afinidad|score test|competencias necesarias|aprendizaje al vuelo|control de procesos|en la siguiente gráfica).*/gi, '').trim();
  // Quitar viñetas, guiones, asteriscos, prefijos "Summary:" o enumeraciones iniciales
  s = s.replace(/^(summary|resumen|perfil(\s+profesional)?|profile)\s*[\:\-]\s*/gi, '').trim();
  s = s.replace(/^[•\-\*\d\.\)\s]+/, '').trim();
  s = s.replace(/\s*[•\*]\s*/g, '. ').trim();
  
  // Si comienza directamente con tareas o responsabilidades ("Responsable de...", "Lideró...", "Definición y..."),
  // convertirlo en un perfil profesional coherente y fluido en lugar de viñetas de tareas.
  if (/^(responsable de|lider[oó]|encargad[oa] de|dirigi[oó]|desarroll[oó]|coordinaci[oó]n de|coordin[oó]|ejecuci[oó]n de|definici[oó]n y)/i.test(s)) {
    const cleanRole = role || 'Profesional Especialista';
    const cleanSubject = name ? `${cleanCandidateName(name)} es un profesional enfocado en ${cleanRole}` : `Especialista en ${cleanRole}`;
    s = `${cleanSubject}, especializado en ${s.charAt(0).toLowerCase() + s.slice(1)}`;
  }

  // Quitar URLs de LinkedIn, links o correos al inicio del summary
  s = s.replace(/^(https?:\/\/)?(www\.)?(linkedin\.com\/[^\s]+|[\w.-]+@[\w.-]+\.\w+)\s*/gi, '').trim();

  // Asegurar que termine en punto final y no en coma o dos puntos incompletos
  s = s.replace(/[,;:\s]+$/, '').trim();
  if (s && !/[.!?]$/.test(s)) {
    s += '.';
  }

  return s;
}

export function extractStructuredCvDataFromText(resumeText: string, fallbackName: string, fallbackRole: string) {
  const txt = resumeText || '';
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Executive Summary Extraction
  let authenticSummary = '';
  const summaryLines: string[] = [];
  let recordingSummary = false;

  const summaryHeaderRegex = /^(perfil(\s+(profesional|laboral|ejecutivo|general|ocupacional))?|resumen(\s+(profesional|ejecutivo|general))?|objetivo(\s+profesional)?|extracto|acerca\s+de\s+m[ií]|sobre\s+m[ií]|profile|summary|executive\s+summary|professional\s+summary|about\s+me)[\:\-\s]*$/i;

  for (const line of lines) {
    const l = line.toLowerCase();

    // Detección inline: ej. "Summary: Certified SAFe 6..."
    const inlineMatch = line.match(/^(?:summary|resumen|perfil\s+profesional|perfil|profile)\s*[\:\-]\s*(.{25,})/i);
    if (inlineMatch && inlineMatch[1] && !recordingSummary) {
      summaryLines.push(inlineMatch[1].trim());
      recordingSummary = true;
      continue;
    }

    if (summaryHeaderRegex.test(l)) {
      recordingSummary = true;
      continue;
    }
    if (recordingSummary) {
      if (line.length < 45 && (
        l.includes('experiencia') || l.includes('educación') || l.includes('estudios') || 
        l.includes('certifica') || l.includes('habilidades') || l.includes('software') || 
        l.includes('contacto') || l.includes('idiomas') || l.includes('tecnolog') || 
        l.includes('herramientas') || l.includes('skills') || l.includes('core skills') ||
        l.includes('work experience') || l.includes('professional experience') || l.includes('main skills')
      )) {
        break;
      }
      if (line.length > 10 && !line.includes('@') && !line.includes('http') && !line.startsWith('linkedin.com') && !/^\d{2,}/.test(line)) {
        summaryLines.push(line);
        if (summaryLines.join(' ').length >= 650) break;
      }
    }
  }

  if (summaryLines.length > 0) {
    authenticSummary = cleanCandidateProfileSummary(summaryLines.join(' '), fallbackName, fallbackRole);
  } else {
    // Si no hay sección de perfil explícita en el CV, sintetizar un resumen ejecutivo personalizado
    // basado en las herramientas, roles y trayectoria reales del candidato (evitando plantillas genéricas idénticas).
    const candName = cleanCandidateName(fallbackName || 'El profesional');
    const lowerTxt = txt.toLowerCase();

    // Detección de vocación o disciplina real del candidato
    let actualDetectedProfession = '';
    let focusPhrase = 'el desarrollo profesional continuo y cumplimiento de objetivos laborales';

    if (/\b(contab|cuentas por pagar|cuentas por cobrar|contador[ao]|auditor[ií]a|fiscal|impuestos|finanzas|tesorer[ií]a|costos)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Licenciado en Contaduría / Analista Contable y Financiero';
      focusPhrase = lowerTxt.includes('academia sap') || lowerTxt.includes('academia')
        ? 'el análisis de procesos contables y fiscales, con alta motivación hacia su especialización como consultor funcional en Ecosistema SAP'
        : 'el control y registro contable, análisis financiero, determinación de impuestos y gestión de cuentas por pagar';
    } else if (/\b(odont[oó]log[oa]|cirujan[oa] dentista|estomat[oó]log[oa]|dental|m[eé]dic[oa]|enfermer[oóa]|odontolog[ií]a|consultorio dental|ortodoncia|endodoncia|periodoncia|salud bucal)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Especialista en Odontología / Salud';
      focusPhrase = 'la atención clínica especializada, procedimientos de salud bucal y servicio al paciente';
    } else if (/\b(desinfecci[oó]n|limpieza|mopas?|pulidoras?|aspiradoras?|residuos s[oó]lidos|lavado de vajilla|intendente|intendencia|conserje|servicios generales)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Servicios Generales e Intendencia Operativa';
      focusPhrase = 'el mantenimiento de instalaciones, aplicación de técnicas de higiene, desinfección y orden operativo';
    } else if (/\b(estudiante|reci[eé]n egresad[oa]|pasante|becari[oa]|primer empleo)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Perfil Inicial / En Formación';
      focusPhrase = 'el aprendizaje continuo, soporte en actividades del área y desarrollo progresivo de competencias';
    } else if (/\b(arquitect[oa] cloud|azure|aws|devops|docker|kubernetes)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Especialista en Infraestructura Cloud y DevOps';
      focusPhrase = 'el diseño, escalabilidad y despliegue continuo de plataformas en la nube';
    } else if (/\b(desarrollador|software engineer|programador|full stack|frontend|backend)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Ingeniero de Desarrollo de Software';
      focusPhrase = 'el diseño de arquitectura de software, codificación y entrega de soluciones digitales';
    } else if (/\b(sap fi|sap co|sap mm|sap sd|sap pp|consultor sap|implementaci[oó]n sap|abap|btp|cpi|basis)\b/i.test(lowerTxt)) {
      actualDetectedProfession = 'Consultor en Ecosistema SAP';
      focusPhrase = 'la configuración, soporte funcional y optimización de procesos empresariales en SAP';
    }

    const cleanRole = actualDetectedProfession || fallbackRole || 'Profesional Especialista';

    // Detección de herramientas y tecnologías clave presentes en el CV
    const techCatalog = [
      'SAP S/4HANA', 'SAP SD', 'SAP MM', 'SAP FI', 'SAP CO', 'SAP PP', 'SAP WM', 'SAP QM', 'ABAP', 'BTP', 'CPI', 'Basis',
      'Scrum', 'Agile', 'Product Backlog', 'Jira', 'Confluence', 'User Stories', 'Roadmapping',
      'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'PostgreSQL', 'Oracle',
      'Azure', 'AWS', 'GCP', 'DevOps', 'Docker', 'Kubernetes',
      'Ventas B2B', 'Prospección', 'CRM Salesforce', 'HubSpot', 'Pipeline Comercial', 'Negociación C-Level',
      'Nómina', 'Atracción de Talento', 'Reclutamiento TI', 'Relaciones Laborales'
    ];
    const detectedSkills = techCatalog.filter(tech => lowerTxt.includes(tech.toLowerCase()));
    const skillsPhrase = detectedSkills.length > 0 
      ? `dominio en ${detectedSkills.slice(0, 4).join(', ')}`
      : `competencias técnicas y operativas acreditadas en su trayectoria`;

    if (!actualDetectedProfession) {
      if (lowerTxt.includes('presupuesto') || lowerTxt.includes('usd') || lowerTxt.includes('mdp')) {
        focusPhrase = 'la gestión de presupuestos, rentabilidad operativa y metas estratégicas de negocio';
      } else if (lowerTxt.includes('cliente') || lowerTxt.includes('b2b') || lowerTxt.includes('cuentas')) {
        focusPhrase = 'el desarrollo comercial, retención de clientes y cumplimiento de objetivos de ventas';
      } else if (lowerTxt.includes('arquitect') || lowerTxt.includes('diseño') || lowerTxt.includes('soluciones')) {
        focusPhrase = 'el diseño e implementación integral de soluciones empresariales';
      } else if (lowerTxt.includes('equipo') || lowerTxt.includes('lider') || lowerTxt.includes('coordin')) {
        focusPhrase = 'el liderazgo de equipos de trabajo y alineación metodológica de proyectos';
      }
    }

    authenticSummary = `${candName} cuenta con perfil profesional enfocado como ${cleanRole}, respaldado por ${skillsPhrase} y trayectoria orientada hacia ${focusPhrase}.`;
  }

  // 2. Experience Extraction (Up to 3 jobs)
  const experience: string[] = [];
  let inExp = false;
  let currentCompany = '';
  let currentRole = '';
  let currentPeriod = '';
  let currentDetails: string[] = [];

  const dateRegex = /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|[0-9]{1,2}[\/\.]?)?\s*(?:19\d{2}|20\d{2})\s*(?:[-–—\sa-zÁÉÍÓÚáéíóú0-9\/\.]*)\s*(?:19\d{2}|20\d{2}|presente|actual|actualidad|present|to\s+actual)?))\b/i;
  const roleKeywordsRegex = /\b(analyst|analista|owner|manager|gerente|lead|lider|líder|consultant|consultor|consultora|developer|desarrollador|engineer|ingeniero|ingeniera|director|directora|specialist|especialista|architect|arquitecto|coordinador|coordinadora|subdirector|subdirectora|scrum master|head|administrator|administrador|ejecutivo|executive|account manager|kam)\b/i;
  const sectionBreakRegex = /^(educaci[oó]n|education|estudios|formaci[oó]n|certificac|certificados?|habilidades|skills|idiomas|languages|cursos|diplomados|reconocimientos)[\s\:\-]*$/i;

  const commitJob = () => {
    if (currentCompany || currentRole) {
      let comp = currentCompany.trim();
      comp = comp.replace(/^(en\s+|at\s+)/i, '').trim();
      comp = comp.replace(/\s*[\(].*contract.*[\)]/i, '').trim();
      comp = comp.replace(/[\,\.\-\–\|]+$/, '').trim();
      if (!comp || ['empresa', 'company', 'actualmente', 'presente', 'of 3', 'of 2'].includes(comp.toLowerCase()) || /eas\s+consulting|eas\s+group|talentpool/i.test(comp)) {
        comp = 'Empresa del Sector Privado';
      }

      let role = currentRole.trim();
      role = role.replace(/[\,\.\-\–\|]+$/, '').trim();
      if (!role) role = fallbackRole || 'Consultor / Especialista';

      const detailsStr = cleanExecutiveDetails(currentDetails.slice(0, 3).join('. '));
      const item = `${role} | ${comp} | ${currentPeriod || 'Periodo profesional'}${detailsStr ? ' | ' + detailsStr : ''}`;
      experience.push(item);
      currentCompany = '';
      currentRole = '';
      currentPeriod = '';
      currentDetails = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const l = line.toLowerCase();
    const cleanL = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
    const cleanLow = cleanL.toLowerCase();
    const collapsed = cleanLow.replace(/\s+/g, '');

    // Check split header: Work \n Experience
    if (l === 'work' && i + 1 < lines.length && lines[i + 1].toLowerCase().startsWith('experience')) {
      inExp = true;
      continue;
    }

    // Header trigger check (incluye cabeceras en dos columnas "QUIEN SOY\tEXPERIENCIA PROFESIONAL", espaciadas o extendidas)
    const headerSegments = line.split(/\t|\s{3,}/).map(seg => seg.replace(/^[•\-\*\d\.\)\s✓●:]+|[:\s]+$/g, '').trim()).filter(Boolean);
    const hasExpSegment = headerSegments.some(seg => {
      const segLow = seg.toLowerCase();
      const segCollapsed = segLow.replace(/\s+/g, '');
      return seg.length < 55 && (
        [
          'experiencialaboral', 'experienciaprofesional', 'experienciaprofesionalyaplicada',
          'trayectorialaboral', 'trayectoriaprofesional', 'workexperience', 'experiencia',
          'experience', 'professionalexperience', 'professionalworkexperience',
          'employmenthistory', 'workhistory', 'relevantexperience', 'experienciarelevante',
          'historiallaboral'
        ].includes(segCollapsed) ||
        segLow.startsWith('experiencia profesional') || segLow.startsWith('experiencia laboral') ||
        segLow.startsWith('professional experience') || segLow.startsWith('work experience') ||
        segLow.startsWith('professional work experience') || segLow.startsWith('experiencia relevante')
      );
    });
    if (hasExpSegment || (cleanL.length < 55 && (
      [
        'experiencialaboral', 'experienciaprofesional', 'experienciaprofesionalyaplicada',
        'trayectorialaboral', 'trayectoriaprofesional', 'workexperience', 'experiencia',
        'experience', 'professionalexperience', 'professionalworkexperience',
        'employmenthistory', 'workhistory', 'relevantexperience', 'experienciarelevante',
        'historiallaboral'
      ].includes(collapsed) ||
      cleanLow.startsWith('experiencia profesional') || cleanLow.startsWith('experiencia laboral') ||
      cleanLow.startsWith('professional experience') || cleanLow.startsWith('work experience') ||
      cleanLow.startsWith('professional work experience') || cleanLow.startsWith('experiencia relevante')
    ))) {
      inExp = true;
      continue;
    }

    if (inExp && experience.length > 0 && cleanL.length < 35 && (
      sectionBreakRegex.test(cleanLow) ||
      ['educacion', 'educación', 'formacionacademica', 'formaciónacadémica', 'estudios', 'certificaciones'].includes(collapsed)
    )) {
      break;
    }

    if (!inExp) continue;

    if (
      cleanLow.startsWith('nacimiento') || cleanLow.startsWith('nacionalidad') || cleanLow.startsWith('estado civil') || 
      cleanLow.startsWith('dirección') || cleanLow.startsWith('email') || cleanLow.startsWith('teléfono') || 
      cleanLow.startsWith('phone:') || cleanLow.startsWith('e-mail:') || cleanLow.includes('of 3') || cleanLow.includes('of 2')
    ) {
      continue;
    }

    // Formato etiquetado "Company Name: X ... Role: Y ... Working Period: Z"
    if (/^company\s+name\s*[\:\-]/i.test(cleanL)) {
      commitJob();
      currentCompany = cleanL.replace(/^company\s+name\s*[\:\-]\s*/i, '').trim();
      continue;
    }
    if (/^(role|puesto|cargo|cargo desempeñado)\s*[\:\-]/i.test(cleanL)) {
      currentRole = cleanL.replace(/^(role|puesto|cargo|cargo desempeñado)\s*[\:\-]\s*/i, '').trim();
      continue;
    }
    if (/^(working\s+period|periodo|fechas?)\s*[\:\-]/i.test(cleanL)) {
      currentPeriod = cleanL.replace(/^(working\s+period|periodo|fechas?)\s*[\:\-]\s*/i, '').trim();
      continue;
    }

    // Patrón: "De MM/YYYY a MM/YYYY", Empresa en i+1, Cargo en i+2
    if (/^(?:de\s+)?\d{2}\/\d{4}\s+a\s+\d{2}\/\d{4}/i.test(cleanLow) && i + 1 < lines.length) {
      commitJob();
      currentPeriod = cleanL;
      const nextL = lines[i + 1].trim();
      if (/sector[\:\-]/i.test(nextL)) {
        currentCompany = nextL.replace(/\,?\s*sector[\:\-].*$/i, '').trim();
      } else {
        currentCompany = nextL;
      }
      if (i + 2 < lines.length && (/cargo/i.test(lines[i + 2]) || roleKeywordsRegex.test(lines[i + 2]))) {
        currentRole = lines[i + 2].replace(/^(?:cargo|puesto)\s+desempeñado\s*[\:\-]\s*/i, '').trim();
      }
      continue;
    }

    // Patrón Corporativo Multilínea: Renglón i = Puesto, Renglón i+1 = Empresa | Ubicación | Periodo
    if (roleKeywordsRegex.test(cleanL) && cleanL.length < 75 && !cleanL.startsWith('●') && !cleanL.startsWith('') && !cleanL.startsWith('✔') && !cleanL.startsWith('-') && !cleanLow.startsWith('gestión')) {
      if (i + 1 < lines.length) {
        const next1 = lines[i + 1].trim();
        const next1DateMatch = next1.match(dateRegex);
        if (next1DateMatch && (next1.includes('|') || next1.includes('–') || next1.includes('-') || next1.includes(',')) && next1.length < 120) {
          commitJob();
          currentRole = cleanL;
          currentPeriod = next1DateMatch[0].trim();
          
          const noDate = next1.replace(currentPeriod, '').trim();
          const subParts = noDate.split(/[|,\–\-]/).map(p => p.trim()).filter(Boolean);
          const nonLocationParts = subParts.filter(p => !isLocationString(p));
          currentCompany = nonLocationParts[0] || subParts[0] || 'Empresa';
          
          i++; // Avanzar para no procesar el renglón de empresa/fechas como otro empleo
          continue;
        }
      }
    }

    // Patrón 3 renglones estándar: Renglón i = Puesto, Renglón i+1 = Empresa, Renglón i+2 = Periodo / Fecha
    if (roleKeywordsRegex.test(cleanL) && cleanL.length < 65 && !line.startsWith('●') && !line.startsWith('') && !line.startsWith('✔') && !line.startsWith('-') && !cleanLow.startsWith('gestión')) {
      if (i + 1 < lines.length) {
        const next1 = lines[i + 1].trim();
        if (next1.length > 2 && next1.length < 60 && !next1.startsWith('●') && !next1.startsWith('') && !next1.startsWith('✔') && !next1.startsWith('-') && !next1.startsWith('*') && !/^(soporte|desarrollo|liderar|gestión|responsable)/i.test(next1)) {
          if (i + 2 < lines.length && dateRegex.test(lines[i + 2]) && lines[i + 2].length < 40) {
            commitJob();
            currentRole = cleanL;
            currentCompany = next1;
            currentPeriod = lines[i + 2].trim();
            continue;
          } else if (!/^(educación|habilidades|contacto)/i.test(next1)) {
            if (!currentRole && !currentCompany) {
              commitJob();
              currentRole = cleanL;
              currentCompany = next1;
              continue;
            }
          }
        }
      }
    }

    // Patrón: Renglón i = "Puesto, Empresa", Renglón i+1 = Fecha
    if (roleKeywordsRegex.test(cleanL) && cleanL.includes(',') && cleanL.length < 85 && !line.startsWith('●') && !line.startsWith('') && !line.startsWith('✔')) {
      if (i + 1 < lines.length && dateRegex.test(lines[i + 1]) && lines[i + 1].length < 40) {
        const parts = cleanL.split(',').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentRole = parts[0];
        currentCompany = parts[1] || 'Empresa';
        currentPeriod = lines[i + 1].trim();
        continue;
      }
    }

    // Patrón en dos renglones: Renglón 1 = Puesto, Renglón 2 = Empresa | Periodo
    if (!currentRole && roleKeywordsRegex.test(cleanL) && cleanL.length < 60 && !line.startsWith('●') && !line.startsWith('')) {
      if (i + 1 < lines.length) {
        const nextL = lines[i + 1].trim();
        if ((nextL.includes('|') || nextL.includes('–') || nextL.includes('-')) && dateRegex.test(nextL) && nextL.length < 90) {
          commitJob();
          currentRole = cleanL;
          const pMatch = nextL.match(dateRegex);
          currentPeriod = pMatch ? pMatch[0].trim() : 'Periodo profesional';
          const cClean = nextL.replace(currentPeriod, '').replace(/\|/g, '').replace(/[–-]/g, '').trim();
          currentCompany = cClean || 'Empresa';
          continue;
        }
      }
    }

    // Renglón aislado con SOLO rango de fechas (ej: "Junio 2023–Actualidad"), seguido de "Puesto • Empresa" en i+1
    const standaloneDateRangeMatch = cleanL.match(/^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+)?)?(?:19\d{2}|20\d{2}|\d{1,2}\/\d{4})\s*[-–—a]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+)?)?(?:19\d{2}|20\d{2}|\d{1,2}\/\d{4}|actual|actualidad|present|presente|fecha)\s*$/i);
    if (standaloneDateRangeMatch && cleanL.length < 55 && !roleKeywordsRegex.test(cleanL)) {
      commitJob();
      currentPeriod = cleanL;
      if (i + 1 < lines.length) {
        const next1 = lines[i + 1].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        if (next1.length > 3 && next1.length < 130 && !/^(educaci[oó]n|certificac|habilidades)/i.test(next1)) {
          const splitByBulletOrPipe = next1.split(/[•|]/).map(p => p.trim()).filter(Boolean);
          const parts = splitByBulletOrPipe.length >= 2
            ? splitByBulletOrPipe
            : next1.split(/\s+[–—-]\s+/).map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            const validParts = parts.filter(p => !isLocationString(p));
            if (validParts.length >= 2) {
              if (roleKeywordsRegex.test(validParts[0])) {
                currentRole = validParts[0];
                currentCompany = validParts[1];
              } else {
                currentCompany = validParts[0];
                currentRole = validParts[1];
              }
            } else if (validParts.length === 1) {
              if (roleKeywordsRegex.test(validParts[0])) {
                currentRole = validParts[0];
              } else {
                currentCompany = validParts[0];
              }
            }
            i++;
          } else if (next1.length < 85 && !next1.endsWith('.')) {
            if (roleKeywordsRegex.test(next1)) {
              currentRole = next1;
              if (i + 2 < lines.length && lines[i + 2].trim().length < 80 && !dateRegex.test(lines[i + 2]) && !/^(●|•|\-)/.test(lines[i + 2].trim())) {
                currentCompany = lines[i + 2].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
                i += 2;
              } else {
                i++;
              }
            } else {
              currentCompany = next1;
              i++;
            }
          }
        }
      }
      continue;
    }

    // Formato con fecha al inicio: "Fecha \t Puesto, Empresa" o "Fecha \t Empresa | Puesto"
    const dateFirstMatch = cleanL.match(/^([a-záéíóú0-9\s–—\-\.\/]+(?:20\d{2}|19\d{2}|actual|presente))\s*[\t\|]\s*(.+)$/i)
      || cleanL.match(/^((?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\s+)?(?:19\d{2}|20\d{2})\s*[-–—]\s*(?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\s+)?(?:19\d{2}|20\d{2}|actual|actualidad|present|presente))\s+[-–—\|]?\s*(.+)$/i);
    if (dateFirstMatch && cleanL.length < 130 && !/^(?:actual|actualidad|present|presente|fecha)$/i.test(dateFirstMatch[2].trim())) {
      commitJob();
      currentPeriod = dateFirstMatch[1].trim();
      const rest = dateFirstMatch[2].trim();
      if (rest.includes('|')) {
        const parts = rest.split('|').map(p => p.trim()).filter(Boolean);
        if (roleKeywordsRegex.test(parts[0])) {
          currentRole = parts[0];
          currentCompany = parts[1] || 'Empresa';
        } else {
          currentCompany = parts[0];
          currentRole = parts[1] || fallbackRole || 'Consultor / Especialista';
        }
      } else if (rest.includes(',')) {
        const parts = rest.split(',').map(p => p.trim()).filter(Boolean);
        if (roleKeywordsRegex.test(parts[0])) {
          currentRole = parts[0];
          currentCompany = parts[1] || 'Empresa';
        } else {
          currentCompany = parts[0];
          currentRole = parts[1] || fallbackRole || 'Consultor / Especialista';
        }
      } else {
        currentRole = rest;
        currentCompany = 'Empresa';
      }
      continue;
    }

    // Formato "Puesto, Empresa (Cuenta), Fecha"
    if (roleKeywordsRegex.test(cleanL) && dateRegex.test(cleanL) && (cleanL.includes(',') || cleanL.includes('–') || cleanL.includes('-'))) {
      const pMatch = cleanL.match(dateRegex);
      const period = pMatch ? pMatch[0].trim() : 'Periodo profesional';
      const noDate = cleanL.replace(period, '').replace(/^[•*()\[\]\s\t–—,.\-]+/, '').replace(/[•*()\[\]\s\t–—,.\-]+$/, '').trim();
      if (noDate.includes(',')) {
        const parts = noDate.split(',').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentPeriod = period;
        currentRole = parts[0];
        currentCompany = parts[1] || 'Empresa';
        continue;
      }
    }

    // Formato estándar con separadores (| o – o -)
    const isHeaderCandidate = (
      (cleanL.includes('|') || cleanL.includes(' – ') || cleanL.includes(' - ') || cleanL.includes(' –') || dateRegex.test(cleanL)) &&
      cleanL.length > 5 && cleanL.length < 115 &&
      (roleKeywordsRegex.test(cleanL) || dateRegex.test(cleanL))
    );

    if (isHeaderCandidate) {
      const periodMatch = cleanL.match(dateRegex);
      const period = periodMatch ? periodMatch[0].trim() : 'Periodo profesional';
      const cleanHeader = cleanL.replace(period, '').replace(/to Actual/gi, '').replace(/to actual/gi, '').replace(/^[•*()\[\]\s\t–—,\-]+/, '').replace(/[•*()\[\]\s\t–—,\-]+$/, '').trim();

      if (cleanHeader.includes('|')) {
        const parts = cleanHeader.split('|').map(p => p.trim()).filter(Boolean);
        commitJob();
        currentPeriod = period;
        const validParts = parts.filter(p => !isLocationString(p));
        if (validParts.length >= 2) {
          if (roleKeywordsRegex.test(validParts[0])) {
            currentRole = validParts[0];
            currentCompany = validParts[1];
          } else {
            currentCompany = validParts[0];
            currentRole = validParts[1];
          }
        } else if (validParts.length === 1) {
          if (roleKeywordsRegex.test(validParts[0])) {
            currentRole = validParts[0];
            currentCompany = 'Empresa del Sector Privado';
          } else {
            currentCompany = validParts[0];
            currentRole = fallbackRole || 'Consultor / Especialista Senior';
          }
        }
        continue;
      } else if (cleanHeader.includes('–') || cleanHeader.includes('-') || cleanHeader.includes(',')) {
        const parts = cleanHeader.split(/[–\-,]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          commitJob();
          currentPeriod = period;
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
            currentCompany = parts[1];
          } else {
            currentCompany = parts[0];
            currentRole = parts[1];
          }
          continue;
        } else if (parts.length === 1) {
          commitJob();
          currentPeriod = period;
          if (roleKeywordsRegex.test(parts[0])) {
            currentRole = parts[0];
          } else {
            currentCompany = parts[0];
          }
          continue;
        }
      }
    } else if (cleanL.length > 10 && inExp) {
      if (cleanL.length > 8 && !cleanL.includes('@') && !cleanL.includes('http')) {
        currentDetails.push(cleanL);
      }
    }

    if (experience.length >= 3) {
      break;
    }
  }

  commitJob();

  // Rescate heurístico sin cabecera de sección si el texto tiene empleos con fecha y puesto/separador
  if (experience.length === 0) {
    for (let i = 0; i < lines.length && experience.length < 3; i++) {
      const rawLine = lines[i];
      const cleanL = rawLine.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
      if (cleanL.length < 10 || cleanL.length > 135) continue;
      if (/\b(universidad|instituto tecnol[oó]gico|facultad|licenciatura|ingenier[ií]a en|bachillerato)\b/i.test(cleanL) && !roleKeywordsRegex.test(cleanL)) continue;
      const pMatch = cleanL.match(dateRegex);
      if (!pMatch) continue;
      const period = pMatch[0].trim();
      const noDate = cleanL.replace(period, '').replace(/^[•*()\[\]\s\t–—,.\-|]+|[•*()\[\]\s\t–—,.\-|]+$/g, '').trim();
      if (noDate.length < 6) continue;
      const segs = noDate.split(/\t|\||•|\s+[–—-]\s+/).map(s => s.trim()).filter(Boolean).filter(s => !isLocationString(s));
      if (segs.length >= 2) {
        const r = roleKeywordsRegex.test(segs[0]) ? segs[0] : (roleKeywordsRegex.test(segs[1]) ? segs[1] : segs[0]);
        const c = r === segs[0] ? segs[1] : segs[0];
        experience.push(`${r} | ${c} | ${period}`);
      } else if (roleKeywordsRegex.test(noDate)) {
        experience.push(`${noDate} | Empresa del Sector Privado | ${period}`);
      }
    }
    // Pares consecutivos sin fecha en el mismo renglón: Empresa en i, Puesto en i+1 (típico en CVs a 2 columnas)
    if (experience.length === 0) {
      for (let i = 0; i < lines.length - 1 && experience.length < 3; i++) {
        const compCand = lines[i].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        const roleCand = lines[i + 1].replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
        if (
          compCand.length >= 3 && compCand.length <= 55 &&
          roleCand.length >= 5 && roleCand.length <= 65 &&
          !/^[●•\-*]/.test(lines[i].trim()) && !/^[●•\-*]/.test(lines[i + 1].trim()) &&
          !compCand.includes(':') && !isLocationString(compCand) &&
          !/^(quien soy|estudios|idiomas|referencias|programas|habilidades|experiencia|educaci[oó]n|t[ií]tulo)/i.test(compCand) &&
          roleKeywordsRegex.test(roleCand) &&
          !/\b(universidad|instituto|licenciatura|ingenier[ií]a|egresado|t[ií]tulo)\b/i.test(compCand + ' ' + roleCand)
        ) {
          const item = `${roleCand} | ${compCand} | Periodo profesional`;
          if (!experience.some(e => e.toLowerCase() === item.toLowerCase())) {
            experience.push(item);
          }
          i++;
        }
      }
    }
  }

  // 3. Education Extraction
  const education: string[] = [];
  let inEdu = false;
  let eduLines: string[] = [];

  for (const line of lines) {
    const l = line.toLowerCase();
    const cleanLine = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
    const eduHeaderSegs = line.split(/\t|\s{3,}/).map(s => s.replace(/^[•\-\*\d\.\)\s✓●:]+|[:\s]+$/g, '').trim()).filter(Boolean);
    const matchesEduHeader = eduHeaderSegs.some(seg => {
      const segLow = seg.toLowerCase();
      const segCol = segLow.replace(/\s+/g, '');
      return seg.length < 45 && (
        ['educacion', 'educación', 'estudios', 'formacionacademica', 'formaciónacadémica', 'formacion', 'formación', 'education', 'academicbackground', 'escolaridad', 'preparacionacademica', 'preparaciónacadémica'].includes(segCol) ||
        segLow.startsWith('formación académica') || segLow.startsWith('educación:')
      );
    });
    if (matchesEduHeader || (cleanLine.length < 40 && (l === 'educación' || l === 'educacion' || l === 'estudios' || l === 'formación académica' || l === 'formacion academica' || l === 'formacion' || l === 'formación' || l === 'education' || l === 'escolaridad'))) {
      inEdu = true;
      continue;
    }
    if (inEdu && cleanLine.length < 40 && /^(certificaciones|cursos|idiomas|habilidades|contacto|experiencia|referencias)\b/i.test(cleanLine)) {
      break;
    }
    if (!inEdu) continue;

    if (l.startsWith('nacimiento') || l.startsWith('nacionalidad') || l.startsWith('estado civil') || l.startsWith('dirección') || l.startsWith('email') || l.startsWith('teléfono') || l.includes('of 3') || l.includes('of 2')) {
      continue;
    }
    // Evitar fuga de empleos y listas de tareas en CVs de dos columnas dentro de educación
    const hasAcademicSignal = /\b(licenciatura|ingenier[ií]a|ingeniero|maestr[ií]a|master|mba|doctorado|t[eé]cnico|bachillerato|t[ií]tulo|certificado|universidad|instituto|tecnol[oó]gico|facultad|escuela|unam|ipn|uam|itesm|uvm|unitec|udg|uanl|buap|cecyte|conalep)\b/i.test(cleanLine);
    const hasWorkSignal = /\b(empresa|s\.?a\.?\s*de\s*c\.?v\.?|consultor|analista|desarrollador|gerente|actualidad|presente|tareas realizadas|monitoreo|administraci[oó]n de usuarios|solman|service\s*now)\b/i.test(cleanLine) || /\t/.test(line) || /^[•●▪]/.test(line.trim());
    if ((hasWorkSignal || eduLines.length === 0) && !hasAcademicSignal) {
      continue;
    }

    if (cleanLine.length > 3 && eduLines.length < 4) {
      // Unir continuación de carrera en renglón envuelto (ej: "Ingeniería en Sistemas" + "Computacionales")
      if (eduLines.length === 1 && !hasAcademicSignal && cleanLine.length < 32 && !/\d{4}/.test(cleanLine) && /^[a-záéíóúñ\s]+$/i.test(cleanLine)) {
        eduLines[0] = `${eduLines[0]} ${cleanLine}`.replace(/\s{2,}/g, ' ').trim();
      } else if (eduLines.length < 3) {
        eduLines.push(cleanLine);
      }
    }
  }

  // Rescate académico sin cabecera explícita si el bloque de educación quedó vacío
  if (eduLines.length === 0) {
    let foundDeg = '';
    let foundInst = '';
    let foundPeriod = '';
    for (const line of lines) {
      const cleanLine = line.replace(/^[•\-\*\d\.\)\s✓●]+/, '').trim();
      if (cleanLine.length < 6 || cleanLine.length > 140) continue;
      if (!foundDeg && /\b(licenciatura|ingenier[ií]a|maestr[ií]a|posgrado|bachelor|master|mba|doctorado|t[eé]cnico superior)\b/i.test(cleanLine)) {
        foundDeg = cleanLine;
        const pMatch = cleanLine.match(/\b(19\d{2}|20\d{2})(?:\s*[-–—]\s*(?:19\d{2}|20\d{2}|actual|actualidad))?\b/i);
        if (pMatch) foundPeriod = pMatch[0];
      }
      if (!foundInst && /\b(universidad|instituto tecnol[oó]gico|tecnol[oó]gico de|itesm|unam|ipn|uam|uvm|unitec|udg|uanl|buap|poli|facultad)\b/i.test(cleanLine)) {
        foundInst = cleanLine;
        const pMatch = cleanLine.match(/\b(19\d{2}|20\d{2})(?:\s*[-–—]\s*(?:19\d{2}|20\d{2}|actual|actualidad))?\b/i);
        if (pMatch && !foundPeriod) foundPeriod = pMatch[0];
      }
    }
    if (foundDeg) eduLines.push(foundDeg);
    if (foundInst && foundInst !== foundDeg) eduLines.push(foundInst);
    if (foundPeriod) eduLines.push(foundPeriod);
  }

  if (eduLines.length > 0) {
    let degree = eduLines[0];
    let inst = eduLines.length > 1 ? eduLines[1] : 'Universidad / Instituto de Educación Superior';
    let period = 'Periodo de estudios';

    // Desacoplar año de institución si viene incluido: "Monterrey Institute..., 1994"
    const instYearMatch = inst.match(/(?:,\s*|\s*[-–—]\s*|\s+)(19\d{2}|20\d{2})\b/);
    if (instYearMatch && instYearMatch[1]) {
      period = instYearMatch[1];
      inst = inst.replace(instYearMatch[0], '').trim();
    }

    if (eduLines.length >= 3 && dateRegex.test(eduLines[2])) {
      period = eduLines[2];
    }

    if (/universidad|instituto|unitec|unam|ipn|itesm|uvm|uam/i.test(degree) && !/universidad|instituto|unitec|unam|ipn|itesm|uvm|uam/i.test(inst)) {
      const tmp = degree;
      degree = inst;
      inst = tmp;
    }
    education.push(`${degree} | ${inst} | ${period}`);
  } else {
    education.push(`Formación Profesional / Superior | Institución Educativa (por validar en entrevista) | Periodo de estudios`);
  }

  // 4. Certifications Extraction
  const certifications: string[] = [];
  let inCert = false;

  for (const line of lines) {
    const l = line.toLowerCase();
    if (line.length < 35 && (l.includes('certifica') || l.includes('cursos') || l.includes('diplomados'))) {
      inCert = true;
      continue;
    }
    if (inCert && line.length < 35 && (l.includes('habilidades') || l.includes('contacto') || l.includes('idiomas'))) {
      break;
    }
    if (!inCert) continue;

    const cleanCert = stripBulletPoints(line);
    const lowCert = cleanCert.toLowerCase();
    if (cleanCert.length > 3 && !['professional development', 'desarrollo profesional', 'technical skills', 'idiomas', 'languages'].includes(lowCert) && !lowCert.startsWith('more courses on') && certifications.length < 4) {
      certifications.push(cleanCert);
    }
  }

  if (certifications.length === 0) {
    certifications.push("Certificación Profesional en Tecnologías de Información y Gestión Ágil | 2024");
  }

  const normalizedCv = validateAndNormalizeCanonicalCv({
    summary: authenticSummary,
    experience,
    education,
    certifications
  });

  // Sintetizar siempre una sinopsis ejecutiva analítica en tercera persona (nunca copy-paste literal ni plantilla clonada)
  const analyticalSummary = synthesizeAnalyticalCandidateSummary(
    {
      name: cleanCandidateName(fallbackName || 'El profesional'),
      resumeText: txt,
      summary: normalizedCv.summary,
      experience: normalizedCv.experience,
      education: normalizedCv.education,
      certifications: normalizedCv.certifications
    },
    fallbackRole ? { title: fallbackRole } : undefined
  );

  return {
    ...normalizedCv,
    summary: analyticalSummary
  };
}

/**
 * Pipeline unificado y autoritativo para resolver, rescatar y normalizar
 * experiencia, educación y certificaciones tanto en ingestión nueva como en migración histórica.
 */
function resolveAndNormalizeCandidateCvProfile(input: {
  name?: string;
  resumeText?: string;
  summary?: string;
  experience?: unknown;
  education?: unknown;
  certifications?: unknown;
  fallbackRole?: string;
}) {
  const resumeText = typeof input.resumeText === 'string' ? input.resumeText : '';
  const rawExp = toTextArray(input.experience) || [];
  const rawEdu = toTextArray(input.education) || [];
  const rawCert = toTextArray(input.certifications) || [];

  const health = detectDegradedCvFields({
    experience: rawExp,
    education: rawEdu,
    certifications: rawCert,
    resumeText
  });

  let extracted: { experience: string[]; education: string[]; certifications: string[]; summary: string } | null = null;
  const ensureExtracted = () => {
    if (!extracted && resumeText.trim().length >= 80) {
      extracted = extractStructuredCvDataFromText(resumeText, input.name || 'Candidato', input.fallbackRole || '');
    }
    return extracted;
  };

  let expSource = rawExp;
  if (health.needsExperienceReextract) {
    const ext = ensureExtracted();
    if (ext && Array.isArray(ext.experience) && ext.experience.length > 0) {
      const extClean = normalizeCanonicalExperience(ext.experience);
      if (extClean.length > 0 && !detectDegradedCvFields({ experience: extClean, resumeText }).needsExperienceReextract) {
        expSource = extClean;
      } else if (rawExp.length === 0) {
        expSource = extClean;
      }
    }
  }

  let eduSource = rawEdu;
  if (health.needsEducationReextract) {
    const ext = ensureExtracted();
    if (ext && Array.isArray(ext.education) && ext.education.length > 0) {
      const extClean = normalizeCanonicalEducation(ext.education);
      if (extClean.length > 0) {
        eduSource = extClean;
      }
    }
  }

  let certSource = rawCert;
  if (certSource.length === 0 && resumeText.trim().length >= 80) {
    const ext = ensureExtracted();
    if (ext && Array.isArray(ext.certifications) && ext.certifications.length > 0) {
      certSource = ext.certifications;
    }
  }

  const normalized = validateAndNormalizeCanonicalCv({
    summary: typeof input.summary === 'string' ? input.summary : '',
    experience: expSource,
    education: eduSource,
    certifications: certSource
  });

  if (resumeText.trim().length >= 80 && !/\b(unam|aut[oó]noma de m[eé]xico)\b/i.test(resumeText)) {
    normalized.education = normalized.education.map(ed =>
      /universidad nacional aut[oó]noma de m[eé]xico/i.test(ed)
        ? ed.replace(/Universidad Nacional Aut[oó]noma de M[eé]xico\s*(?:\(UNAM\))?/gi, 'Universidad / Instituto de Educación Superior')
        : ed
    );
  }

  return normalized;
}

function runLocalHeuristicAnalysis(name: string, resumeText: string, candidateRole: string, targetVacancy: any) {
  const lowercaseResume = (resumeText || '').toLowerCase();
  const cleanName = cleanCandidateName(name || '', resumeText);
  
  // Extract structured experience, education, certifications and executive summary
  const structuredData = extractStructuredCvDataFromText(resumeText, cleanName, targetVacancy?.title || candidateRole);

  const candObj = {
    name: cleanName,
    resumeText,
    summary: structuredData.summary,
    experience: structuredData.experience,
    education: structuredData.education,
    certifications: structuredData.certifications
  };

  // Calibración determinista estricta basada en el motor oficial de vacantes
  const strictResult = calculateStrictFitScore(candObj, targetVacancy);
  const dynamicCompetencies = calculateCandidateCompetencies(candObj, targetVacancy);
  const analyticalSummary = synthesizeAnalyticalCandidateSummary(candObj, targetVacancy);
  const guidanceEval = computeGuidanceForCandidate(candObj, targetVacancy);

  // Guidance Levels Matrix evaluation (Strict Preselection Check)
  const reqVacLevel = guidanceEval.required;
  const detCandLevel = guidanceEval.candidate;
  const seniorityRankGap = detCandLevel.rank - reqVacLevel.rank;
  const isSevereOverqualified = seniorityRankGap >= 2;
  const isSevereUnderqualified = seniorityRankGap <= -2;
  const hasGuidanceAlert = detCandLevel.rank < reqVacLevel.rank;

  let leadershipScore = dynamicCompetencies['Liderazgo'];
  let techScore = dynamicCompetencies['Habilidades Técnicas'];
  let communicationScore = dynamicCompetencies['Comunicación'];
  let teamworkScore = dynamicCompetencies['Trabajo en Equipo'];
  let problemSolvingScore = dynamicCompetencies['Resolución de Problemas'];

  // Apply specific vacancy adjustments
  let vacancyAdjustedMsg = "";
  if (targetVacancy && targetVacancy.requirements) {
    let matchesCount = 0;
    targetVacancy.requirements.forEach((req: string) => {
      if (lowercaseResume.includes(req.toLowerCase())) {
        matchesCount++;
      }
    });
    const matchRatio = matchesCount / targetVacancy.requirements.length;
    techScore = Math.min(100, Math.round(techScore * (0.85 + matchRatio * 0.25)));
    problemSolvingScore = Math.min(100, Math.round(problemSolvingScore * (0.9 + matchRatio * 0.15)));
    
    // Penalización de inglés de la vacante (SR)
    if (targetVacancy.englishLevel === 'Avanzado' && !lowercaseResume.includes('ingles avanzado') && !lowercaseResume.includes('inglés avanzado') && !lowercaseResume.includes('advanced')) {
      techScore = Math.max(30, techScore - 20);
      vacancyAdjustedMsg += " [Alerta: Nivel de inglés insuficiente para perfil SR].";
    }

    vacancyAdjustedMsg += ` Evaluado analíticamente contra la vacante de '${targetVacancy.title}' encontrando coincidencia de ${matchesCount} de ${targetVacancy.requirements.length} palabras clave.`;
  }

  let guidanceGapDetails = "";
  let guidancePenalty = 0;
  if (isSevereOverqualified) {
    guidancePenalty = 35;
    guidanceGapDetails = `⚠️ SOBRECALIFICACIÓN CRÍTICA: Candidato clasifica como Nivel "${detCandLevel.level}" (Rango ${detCandLevel.rank}), desfasado ${seniorityRankGap} niveles por encima de la vacante "${reqVacLevel.level}" (Rango ${reqVacLevel.rank}). No es recomendable para un puesto auxiliar u operativo.`;
  } else if (isSevereUnderqualified || hasGuidanceAlert) {
    guidancePenalty = (reqVacLevel.rank - detCandLevel.rank) * 12;
    guidanceGapDetails = `⚠️ ALERTA PRESELECCIÓN ESTRICTA: Candidato detectado como Nivel "${detCandLevel.level}" (Rango ${detCandLevel.rank}), pero la vacante exige Nivel "${reqVacLevel.level}" (Rango ${reqVacLevel.rank}). Existe una brecha de cualificación de ${reqVacLevel.rank - detCandLevel.rank} nivel(es).`;
  } else if (detCandLevel.rank > reqVacLevel.rank) {
    guidanceGapDetails = `Alineación de Seniority: Candidato clasifica como Nivel "${detCandLevel.level}" (Rango ${detCandLevel.rank}) para vacante "${reqVacLevel.level}" (Rango ${reqVacLevel.rank}).`;
  } else {
    guidanceGapDetails = `✅ ALINEACIÓN IDEAL: Candidato clasifica como Nivel "${detCandLevel.level}" cumpliendo exactamente con el Nivel Guía "${reqVacLevel.level}" exigido por la vacante.`;
  }

  const rawFit = Math.round((techScore + leadershipScore + communicationScore + teamworkScore + problemSolvingScore) / 5);
  const fitScore = targetVacancy && (targetVacancy.id || targetVacancy.title)
    ? strictResult.fitScore 
    : Math.max(15, Math.min(100, rawFit - guidancePenalty));

  const vacTitle = targetVacancy?.title || candidateRole || 'Consultor / Especialista';
  const vacDept = targetVacancy?.department || '';
  const vacReqs = targetVacancy?.requirements || [];
  const questions: string[] = generateExperienceQuestions({ title: vacTitle, department: vacDept, requirements: vacReqs }, { name, resumeText }, { seed: `${name}|${vacTitle}` });

  // Usar las fortalezas y áreas de oportunidad concretas obtenidas del cruce CV vs Requisitos de Vacante
  const strengths = strictResult.strengths && strictResult.strengths.length > 0
    ? strictResult.strengths
    : [
        `Perfil clasificado como Nivel Guía "${detCandLevel.level}".`,
        `Alineación técnica descrita en su perfil de ${candidateRole || 'talento'}.`,
        "Antecedentes laborales comprobables en su área de especialidad."
      ];

  const growths = strictResult.growths && strictResult.growths.length > 0
    ? strictResult.growths
    : [
        "Profundizar en casos de uso y entregables clave durante la entrevista técnica.",
        "Validar alineación con el tabulador salarial presupuestado de la posición."
      ];

  return {
    fitScore: strictResult.fitScore,
    competencies: {
      'Liderazgo': leadershipScore,
      'Comunicación': communicationScore,
      'Trabajo en Equipo': teamworkScore,
      'Habilidades Técnicas': techScore,
      'Resolución de Problemas': problemSolvingScore
    },
    summary: analyticalSummary,
    doubleCheckReport: `[EAS Engine Precalificación Local] El candidato ${cleanName || "Postulado"} demuestra un perfil clasificado en Nivel "${detCandLevel.level}". Su experiencia y desarrollo se evalúan contra la guía exigida de "${reqVacLevel.level}".${vacancyAdjustedMsg}`,
    strengths: strictResult.strengths.length > 0 ? strictResult.strengths : strengths,
    growths: strictResult.growths.length > 0 ? strictResult.growths : growths,
    recommendedQuestions: questions,
    suggestedTime: "", // Se elimina sugerencia de hora no real para evitar ruido
    experience: structuredData.experience,
    education: structuredData.education,
    certifications: structuredData.certifications,
    detectedGuidanceLevel: detCandLevel.level,
    guidanceAlert: hasGuidanceAlert || isSevereOverqualified || strictResult.hasDomainMismatch,
    guidanceGapDetails: strictResult.hasDomainMismatch ? (strictResult.mismatchReason || guidanceGapDetails) : guidanceGapDetails,
    hasDomainMismatch: strictResult.hasDomainMismatch,
    mismatchReason: strictResult.mismatchReason
  };
}

app.post("/api/analyze-candidate", aiQuotaRateLimiter, async (req, res) => {
  const { name, resumeText, candidateRole, targetVacancy, vacancyId } = req.body;

  if (!resumeText || !String(resumeText).trim()) {
    return res.status(400).json({ error: "El texto del currículum o perfil es requerido para el análisis" });
  }

  // Resolver vacante objetivo si sólo se pasó vacancyId
  let effectiveVacancy = targetVacancy;
  if (!effectiveVacancy && vacancyId) {
    if (!useDbFallback) {
      try {
        const vRes = await pool.query("SELECT * FROM vacancies WHERE id = $1", [vacancyId]);
        if (vRes.rows.length > 0) {
          const row = vRes.rows[0];
          effectiveVacancy = {
            id: row.id,
            title: row.title,
            department: row.department,
            location: row.location,
            description: row.description,
            requirements: row.requirements || [],
            experienceYears: row.experience_years,
            salaryRange: row.salary_range,
            status: row.status,
            minCompetenciesRequired: row.min_competencies,
            englishLevel: row.english_level,
            modalidad: row.modalidad
          };
        }
      } catch (e) {
        console.warn("[Analyze Candidate] No se pudo obtener vacante de DB:", e);
      }
    }
    if (!effectiveVacancy) {
      effectiveVacancy = mockVacancies.find(v => v.id === vacancyId);
    }
  }

  const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);

  if (!client) {
    console.log("Using simulated fallback for candidate evaluation with potential target vacancy...");
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = runLocalHeuristicAnalysis(name, resumeText, candidateRole || effectiveVacancy?.title, effectiveVacancy);
    return res.json(result);
  }

  // Llamada a la API oficial de Gemini
  try {
    let targetVacancySection = "";
    if (effectiveVacancy) {
      targetVacancySection = `
El candidato está aplicando a la siguiente VACANTE específica basada en la Requisición (SR) oficial de EAS:
- Título: ${effectiveVacancy.title}
- Departamento: ${effectiveVacancy.department}
- Descripción: ${effectiveVacancy.description}
- Habilidades Requeridas: ${effectiveVacancy.requirements?.join(", ")}
- Nivel de Inglés Requerido: ${effectiveVacancy.englishLevel || 'No especificado'}
- Modalidad de Trabajo: ${effectiveVacancy.modalidad || 'No especificado'}
- Presupuesto Salarial (Tope Máximo): ${effectiveVacancy.salaryRange || 'No especificado'}
- Umbrales Mínimos de Competencia Esperados: Liderazgo: ${effectiveVacancy.minCompetenciesRequired?.Liderazgo}%, Comunicación: ${effectiveVacancy.minCompetenciesRequired?.Comunicación}%, Trabajo en Equipo: ${effectiveVacancy.minCompetenciesRequired?.['Trabajo en Equipo']}%, Habilidades Técnicas: ${effectiveVacancy.minCompetenciesRequired?.['Habilidades Técnicas']}%, Resolución de Problemas: ${effectiveVacancy.minCompetenciesRequired?.['Resolución de Problemas']}%

Crucial: Evalúa e integra una precalificación comparando minuciosamente el perfil, el nivel de inglés detectado en su currículum y sus expectativas salariales contra las exigencias del puesto. Si el puesto exige nivel de inglés "Avanzado" o "Medio" y el candidato no lo cumple de forma clara en el texto, o si sus expectativas exceden el tope salarial, penaliza el fitScore significativamente (resta entre 15 y 25 puntos de compatibilidad).
`;
    }

    const prompt = `Analiza el siguiente perfil/CV de un candidato para EAS Consulting para el rol de "${candidateRole || effectiveVacancy?.title || 'Consultor / Especialista General'}". 
Nombre del candidato: ${name || "Postulante"}
Currículum/Perfil:
${resumeText}
${targetVacancySection}

Por favor, como experto en Atracción de Capital Humano, Comunicación Organizacional y Recursos Humanos de EAS Consulting, realiza un filtrado y análisis profundo de competencias clave e indicadores. Devuelve una evaluación detallada respetando la estructura exigida.`;

    const weights = await getLearningWeights();
    const systemInstruction = `Eres el mejor Socio Consultor en Capital Humano, Reclutamiento de Élite y Comunicación Organizacional de EAS Consulting. Tu objetivo es predecir el éxito laboral analizando conductas, compatibilidades de vacantes pedidas, competencias clave del 1 al 100, fortalezas y puntos de mejora.
CRUCIAL - EVALUACIÓN DE PROFESIÓN Y COMPATIBILIDAD CON LA VACANTE:
La profesión y experiencia del candidato deben ser acordes con la vacante. Si el candidato tiene una profesión o formación totalmente ajena (por ejemplo, odontólogo, médico, arquitecto cloud o abogado postulándose a Servicios Generales de limpieza o viceversa), debes calificar la compatibilidad como NO APTA: asigna un fitScore menor o igual a 25, en summary describe su perfil real sin alucinar tecnologías ajenas a la vacante, y en growths coloca como primera debilidad '⚠️ INCOMPATIBILIDAD CRÍTICA DE PROFESIÓN: La formación o profesión del candidato no es acorde con la vacante solicitada. Perfil sin cabida para postulación.'

IMPORTANTE: El sistema ha aprendido de las decisiones anteriores de contratación del reclutador y prioriza las competencias de acuerdo con los siguientes factores de importancia ponderados: Liderazgo: ${weights.Liderazgo.toFixed(2)}, Comunicación: ${weights.Comunicación.toFixed(2)}, Trabajo en Equipo: ${weights['Trabajo en Equipo'].toFixed(2)}, Habilidades Técnicas: ${weights['Habilidades Técnicas'].toFixed(2)}, Resolución de Problemas: ${weights['Resolución de Problemas'].toFixed(2)}. Si un factor de peso es mayor a 1.0, asigna mayor relevancia y rigurosidad a esa competencia en la calificación y en el fitScore final, y si es menor, ten menor rigor en ella, afinando el proceso de selección continuamente.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fitScore: { 
              type: Type.INTEGER, 
              description: "Compatibilidad del puesto estimada del 1 al 100 en base al rol solicitado (máx 25 si la profesión es ajena)." 
            },
            competencies: {
              type: Type.OBJECT,
              properties: {
                'Liderazgo': { type: Type.INTEGER, description: "Capacidad de dirección y toma de decisiones" },
                'Comunicación': { type: Type.INTEGER, description: "Asertividad y comunicación organizacional" },
                'Trabajo en Equipo': { type: Type.INTEGER, description: "Cohesión grupal y soporte colaborativo" },
                'Habilidades Técnicas': { type: Type.INTEGER, description: "Dominio de stacks o herramientas relativas al puesto" },
                'Resolución de Problemas': { type: Type.INTEGER, description: "Pensamiento crítico ante crisis" }
              },
              required: ['Liderazgo', 'Comunicación', 'Trabajo en Equipo', 'Habilidades Técnicas', 'Resolución de Problemas']
            },
            summary: { 
              type: Type.STRING, 
              description: "Resumen ejecutivo profesional analizando con veracidad el perfil y oficio real del aspirante." 
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de por lo menos 3 fortalezas profesionales notables identificadas."
            },
            growths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de por lo menos 2 áreas de oportunidad técnica o actitudinal."
            },
            recommendedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de exactamente 4 preguntas avanzadas, sumamente personalizadas e incisivas para el cuestionario de precalificación."
            },
            experience: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de los últimos 3 trabajos del candidato en formato: Puesto en Empresa (Periodo)."
            },
            education: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Detalles del nivel educativo, carrera e institución."
            },
            certifications: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de certificaciones o cursos relevantes."
            }
          },
          required: ["fitScore", "competencies", "summary", "strengths", "growths", "recommendedQuestions", "experience", "education", "certifications"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini API");
    }
    const cleanedText = cleanGeminiJson(response.text);
    const aiResult = JSON.parse(cleanedText);
    aiResult.suggestedTime = ""; // Se erradica horario simulado

    const resolvedCv = resolveAndNormalizeCandidateCvProfile({
      name: cleanCandidateName(name || '', resumeText),
      resumeText,
      summary: aiResult.summary,
      experience: aiResult.experience,
      education: aiResult.education,
      certifications: aiResult.certifications,
      fallbackRole: effectiveVacancy?.title || candidateRole
    });
    aiResult.experience = resolvedCv.experience;
    aiResult.education = resolvedCv.education;
    aiResult.certifications = resolvedCv.certifications;

    const candForCalibration = {
      name: cleanCandidateName(name || '', resumeText),
      resumeText,
      summary: aiResult.summary,
      experience: resolvedCv.experience,
      education: resolvedCv.education,
      certifications: resolvedCv.certifications,
      competencies: aiResult.competencies || {}
    };

    // Calibración determinista obligatoria para garantizar invarianza de score, competencias dinámicas y sinopsis analítica
    const strictCheck = calculateStrictFitScore(candForCalibration, effectiveVacancy);
    const dynamicComp = calculateCandidateCompetencies(candForCalibration, effectiveVacancy);
    const analyticalSum = synthesizeAnalyticalCandidateSummary(candForCalibration, effectiveVacancy);
    const guidanceCheck = computeGuidanceForCandidate(candForCalibration, effectiveVacancy);

    aiResult.fitScore = strictCheck.fitScore;
    aiResult.competencies = dynamicComp;
    aiResult.summary = analyticalSum;
    aiResult.strengths = strictCheck.strengths.length > 0 ? strictCheck.strengths : (aiResult.strengths || []);
    aiResult.growths = strictCheck.growths.length > 0 ? strictCheck.growths : (aiResult.growths || []);
    aiResult.detectedGuidanceLevel = guidanceCheck.candidate.level;
    aiResult.hasDomainMismatch = strictCheck.hasDomainMismatch;
    aiResult.mismatchReason = strictCheck.mismatchReason;

    // Solo se aceptan preguntas de la IA relacionadas con la vacante; el motor local completa las 3.
    aiResult.recommendedQuestions = pickExperienceQuestions(
      aiResult.recommendedQuestions, effectiveVacancy || { title: candidateRole },
      { name, resumeText, experience: aiResult.experience || [] }, `${name}|${effectiveVacancy?.title || candidateRole}`
    );
    res.json(aiResult);
  } catch (error) {
    console.warn("Error calling Gemini API for candidate analysis. Activating local heuristic fallback:", error);
    const fallbackResult = runLocalHeuristicAnalysis(name, resumeText, candidateRole || effectiveVacancy?.title, effectiveVacancy);
    res.json(fallbackResult);
  }
});

// NEW ATS ENDPOINT: Public Candidate Application & Dynamic Question Generation
app.post("/api/candidates/apply", aiQuotaRateLimiter, upload.single("cv"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo de CV" });
    }

    const { originalname, buffer, mimetype } = req.file;
    const vacancyTitle = req.body.vacancyTitle || "";
    const vacancyRequirements = req.body.vacancyRequirements ? JSON.parse(req.body.vacancyRequirements) : [];
    
    let extractedText = "";
    try {
      const extracted = await extractCvText(buffer, originalname);
      extractedText = extracted.text;
      assertIsCv(extracted.text, extracted.pages);
    } catch (e: any) {
      if (e instanceof CvRejectedError) return rejectCv(res, originalname, e);
      throw e;
    }

    const client = getGeminiClient(req.headers['x-gemini-api-key'] as string);

    if (!client) {
      console.log("Gemini offline. Extracting real candidate profile fields.");
      const guessed = parseFromFilename(originalname);
      const realEmail = extractEmailFromText(extractedText) || "";
      const realPhone = extractPhoneFromText(extractedText) || "";
      const candName = guessed.name || originalname.replace(/\.[^/.]+$/, "");
      return res.json({
        name: candName,
        email: realEmail,
        phone: realPhone,
        role: vacancyTitle || "Consultor Especialista",
        resumeText: extractedText,
        screeningQuestions: [
          { id: 1, question: `¿Cómo demuestras de forma práctica tu experiencia técnica y funcional para cubrir los requerimientos de la vacante "${vacancyTitle || 'Consultoría'}"?` },
          { id: 2, question: "Menciona un reto técnico complejo de tu perfil y cómo lo resolviste funcionalmente." },
          { id: 3, question: "¿Cuál es tu enfoque metodológico al colaborar en proyectos complejos del área?" },
          { id: 4, question: "¿Cuál es tu disponibilidad para integrarte a la vacante?" },
          { id: 5, question: "¿Cuál fue tu último sueldo mensual bruto (comprobable)?" },
          { id: 6, question: "¿Dónde te ubicas actualmente?" },
          { id: 7, question: "¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?" }
        ]
      });
    }

    const prompt = `Analiza el texto del CV provisto. Extrae el nombre completo real del candidato, email real de contacto, teléfono, y sugiere su rol ideal. 
    Además, considerando la vacante "${vacancyTitle}" y sus requisitos [${vacancyRequirements.join(", ")}], genera exactamente 3 preguntas avanzadas, analíticas y directas de Experiencia (para validar habilidades técnicas/funcionales del candidato).
    Agregaremos automáticamente las 4 preguntas fijas de Disponibilidad (disponibilidad, sueldo bruto, ubicación y modalidad). Tú solo debes generar las 3 preguntas iniciales de Experiencia basadas en el CV.

    Texto del Currículum:
    ${extractedText}

    Devuelve el JSON requerido según el esquema especificado.`;

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "Eres un reclutador experto de EAS Consulting. Extrae con la máxima precisión el NOMBRE REAL DEL CANDIDATO (persona física) y el CORREO ELECTRÓNICO REAL presentes en su CV. NUNCA inventes nombres ni correos falsos (fake). Genera exactamente 3 preguntas de filtrado de Experiencia (screeningQuestions) muy inteligentes y personalizadas basadas en el contraste directo con los requisitos de la vacante.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nombre completo del candidato extraído del CV." },
            email: { type: Type.STRING, description: "Email de contacto directo extraído del CV." },
            phone: { type: Type.STRING, description: "Teléfono de contacto directo." },
            role: { type: Type.STRING, description: "Rol o especialidad sugerida para el candidato." },
            screeningQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING, description: "Pregunta avanzada de Experiencia para este candidato." }
                },
                required: ["id", "question"]
              },
              description: "Arreglo de exactamente 3 preguntas de filtrado de Experiencia."
            }
          },
          required: ["name", "email", "phone", "role", "screeningQuestions"]
        }
      }
    });

    const resultText = response.text || "{}";
    const cleanedText = cleanGeminiJson(resultText);
    const parsedData = JSON.parse(cleanedText);

    const baseQs = (parsedData.screeningQuestions || []).slice(0, 3).map((q: any, idx: number) => ({
      id: idx + 1,
      question: q.question
    }));
    const fixed = [
      "¿Cuál es tu disponibilidad para integrarte a la vacante?",
      "¿Cuál fue tu último sueldo mensual bruto (comprobable)?",
      "¿Dónde te ubicas actualmente?",
      "¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?"
    ];
    const fullQuestions = [
      ...baseQs,
      ...fixed.map((q, idx) => ({
        id: baseQs.length + idx + 1,
        question: q
      }))
    ];

    let finalName = (parsedData.name || '').replace(/^(ventas\s*[\-\:\_\,]?\s*)+/i, '').trim();
    if (!finalName || finalName.toUpperCase().includes("DELL CERTIFICATE") || finalName.toUpperCase().includes("DELL CERTIFICATION") || finalName.toUpperCase().includes("DELL_CERTIFICATE") || finalName.toUpperCase().startsWith("DELL")) {
      const guessed = parseFromFilename(originalname);
      finalName = guessed.name || originalname.replace(/\.[^/.]+$/, "");
    }

    const realEmail = extractEmailFromText(extractedText) || (parsedData.email && !parsedData.email.includes("example.com") ? parsedData.email : "");
    finalName = cleanCandidateName(finalName, extractedText, realEmail);

    return res.json({
      ...parsedData,
      name: finalName,
      email: realEmail,
      screeningQuestions: fullQuestions,
      resumeText: extractedText
    });

  } catch (error) {
    console.error("Error in candidate apply endpoint:", error);
    res.status(500).json({ error: "Error procesando postulación", details: String(error) });
  }
});

// NEW ATS ENDPOINT: Double Check Validation & Interview Speech Generation
// (Eliminada la segunda definición de /api/candidates/submit-screening: era inalcanzable y usaba otro evaluador permisivo.)

// Se eliminó la definición duplicada de /api/submit-feedback (consolidada arriba en línea 2135 para actualizar candidato y pesos de IA simultáneamente).

// =============================================================================
// RUTAS DE AUTENTICACIÓN, SEGURIDAD, RBAC Y ADMINISTRACIÓN DE USUARIOS
// =============================================================================

// (Rutas /auth/* y /api/admin/users duplicadas eliminadas: se definen una sola vez al inicio, con rate limit y RBAC.)

// Global router error catcher inside Express to guarantee JSON output instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Error Handler Intercepted:", err);
  // No se envía el stack trace al cliente (antes: details: err.stack).
  res.status(err.status || err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' ? "Error interno de procesamiento del servidor" : (err.message || "Error interno")
  });
});

// Setup Vite Dev Server / Static files for production
async function startServer() {
  // Initialize Database schemas asynchronously in background
  initDb().catch(err => console.warn("EAS AI Recruiting: DB init background warning:", err));

  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

  if (!isProduction) {
    try {
      console.log("Starting server in development mode with Vite middleware...");
      const viteModule = await (eval('import("vite")') as Promise<any>);
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn("Vite middleware initialization failed, falling back to static build serving:", viteErr);
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        }
      }));
      app.get('*', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    let distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(path.join(distPath, 'public', 'index.html'))) {
      distPath = path.join(distPath, 'public');
    }
    console.log(`Starting server in production mode serving static dist from ${distPath}...`);
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`EAS Recruiting HTTP server running on port ${PORT} (0.0.0.0:${PORT})`);
  });

  const certKeyPath = path.join(process.cwd(), 'certs', 'server.key');
  const certCrtPath = path.join(process.cwd(), 'certs', 'server.crt');

  if (fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath) && process.env.ENABLE_HTTPS === 'true') {
    try {
      const httpsPort = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT, 10) : 3443;
      const options = {
        key: fs.readFileSync(certKeyPath),
        cert: fs.readFileSync(certCrtPath)
      };
      const httpsServer = https.createServer(options, app);
      httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`EAS Recruiting HTTPS server running on port ${httpsPort} (0.0.0.0:${httpsPort})`);
      });
    } catch (sslErr) {
      console.warn("EAS Recruiting: SSL cert load warning:", sslErr);
    }
  }
}

startServer().catch(err => {
  console.error("Fatal startup error in EAS Recruiting Server:", err);
  process.exit(1);
});
