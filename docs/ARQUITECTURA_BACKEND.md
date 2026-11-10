# Especificación de Arquitectura Técnica: Talent IA Backend

**Proyecto:** Talent IA (EAS AI Recruiting & Scheduling Platform)  
**Organización:** EAS Consulting Group  
**Repositorio Oficial:** `https://github.com/eaguilarh01/talent_ia_backend.git`  
**Autor de Entrega:** Enrique Aguilar (`e.aguilarhernandez2@dxc.com`)  
**Versión del Sistema:** 2.0.0 (Arquitectura Desacoplada)  
**Fecha:** Noviembre 2026  

---

## 1. Visión General de la Capa Backend

El repositorio `talent_ia_backend` encapsula el servidor de **API REST**, el **motor determinista de evaluación curricular (FitScore & Double-Check)**, los **conectores multimodales de Inteligencia Artificial (Google Gemini, OpenAI, Anthropic Claude)**, el **despachador de automatizaciones n8n** y la capa de **persistencia relacional en PostgreSQL**.

Está implementado en **Node.js 20 LTS** con **Express 4** y **TypeScript 5.8** bajo resolución `NodeNext`, compilándose en producción mediante **esbuild** (`build-server.js`) hacia un artefacto CommonJS único (`dist/server.cjs`) ejecutado dentro de un contenedor Docker `node:20-slim`.

---

## 2. Stack Tecnológico

| Componente | Tecnología | Versión | Propósito Operativo |
|---|---|---|---|
| **Runtime** | Node.js LTS | 20.x (`node:20-slim`) | Entorno asíncrono de servidor en producción |
| **Lenguaje** | TypeScript | ~5.8.2 | Tipado estricto con resolución modular `NodeNext` |
| **Framework HTTP** | Express | ^4.21.2 | Enrutamiento REST, middlewares y manejo de errores |
| **Empacado Producción** | esbuild | ^0.25.0 | Compilación de `server.ts` a `dist/server.cjs` vía `build-server.js` |
| **Base de Datos** | PostgreSQL (`pg`) | ^8.22.0 | Connection pooling (`pg.Pool`), consultas parametrizadas y SQL DDL |
| **Motores IA** | Gemini / OpenAI / Claude | `2.4` / `7.5` / `0.120` | Extracción semántica de CVs, redacción de vacantes y análisis |
| **Seguridad y Cifrado** | `bcryptjs` / `jsonwebtoken` | ^3.0.3 / ^9.0.3 | Hashing de contraseñas (costo 12) y firma JWT HS256 |
| **Parsing Documental** | `pdf-parse` / `mammoth` / `multer` | ^2.4 / ^1.12 / ^2.2 | Ingesta segura en memoria y extracción de texto PDF/DOCX |
| **Validación y Testing** | `zod` / `tsx` | ^3.25.76 / ^4.21.0 | Esquemas de validación y ejecución de suites unitarias `.test.ts` |

---

## 3. Estructura Jerárquica del Repositorio

```
talent_ia_backend/
|-- db/
|   \-- schema.sql                      # DDL de autenticación, RBAC y auditoría
|-- src/
|   |-- api.ts                          # Tipos de red y utilidades compartidas
|   |-- types.ts                        # Interfaces del dominio (Candidate, Vacancy)
|   |-- data/
|   |   \-- samples.ts                  # Catálogos y datos de arranque sanitizados
|   |-- server/
|   |   |-- auth.ts                     # Middleware JWT, login, lockout, PIN reset y RBAC
|   |   |-- cvValidation.ts             # Validación pre-flight de archivos CV (PDF/DOCX/TXT)
|   |   |-- auth.test.ts                # Pruebas de hashing bcrypt y firma JWT
|   |   |-- auth.lockout.test.ts        # Pruebas de bloqueo ante fuerza bruta
|   |   \-- cvValidation.test.ts        # Pruebas de rechazo de documentos no curriculares
|   \-- utils/
|       |-- areas.ts                    # Taxonomía y normalización de áreas
|       |-- auditLogger.ts              # Escritura inmutable en log_auditoria
|       |-- canonicalCvNormalizer.ts    # Limpieza de experiencia, educación y ruido
|       |-- doubleCheckEvaluator.ts     # Rúbrica determinista de 7 preguntas
|       |-- questionEngine.ts           # Generador de reactivos por brecha real
|       |-- securityUtils.ts            # Sanitización, hashes y reglas de sesión
|       |-- textRepair.ts               # Reparación algorítmica de mojibake UTF-8
|       |-- vacancyUtils.ts             # FitScore 4D y cálculo de nivel guía
|       \-- *.test.ts                   # Suites de pruebas unitarias de motores
|-- docs/                               # Documentación oficial PDF y Draw.io
|-- .env.example                        # Plantilla de variables sin secretos
|-- .env.template                       # Plantilla extendida para despliegue
|-- .gitignore                          # Exclusiones Git permitiendo !docs/** y schemas
|-- build-server.js                     # Script esbuild para dist/server.cjs
|-- database_schema.sql                 # Esquema relacional DDL de despliegue
|-- docker-compose.yml                  # Orquestación productiva de servicios y red atlas-net
|-- Dockerfile                          # Contenedor multi-etapa Node 20 Slim
|-- n8n_workflow_eas_recruiting_master.json # Flujo de webhooks n8n (Sync, Agenda, Recovery)
|-- package.json                        # Dependencias y scripts dev/build/start/lint/test
|-- server.ts                           # Entrypoint principal Express, rutas REST y pg.Pool
\-- tsconfig.json                       # Configuración TypeScript NodeNext
```

---

## 4. Arquitectura de Persistencia y Esquema Relacional PostgreSQL

El servidor inicializa un `pg.Pool` hacia `DATABASE_URL` con manejo de timeouts, soporte SSL opcional (`DATABASE_SSL`) y consultas 100% parametrizadas (`$1, $2, ...`) para erradicar inyección SQL:

1. **`auth_users`:** Almacena credenciales (`id UUID`, `email UNIQUE`, `password_hash` con bcrypt, `reset_code`, `reset_expires`, `raw_user_meta_data` JSONB).
2. **`app_users`:** Sincronizada mediante el trigger `on_auth_user_created` (`handle_new_auth_user()`), registra perfiles operativos (`rol` en `'admin' | 'leader' | 'user' | 'director'`, `activo`, `primer_login`).
3. **`vacancies`:** Perfiles de puesto, requisitos, años de experiencia, rango salarial, `min_competencies` JSONB, nivel de inglés y modalidad.
4. **`candidates`:** Expedientes curriculares sanitizados en UTF-8 (`sanitizeUtf8` / `sanitizeForPg`), competencias JSONB, `fit_score`, `initial_fit_score`, `double_check_report`, `interview_speech` y etapa en el pipeline.
5. **`log_auditoria`:** Registro forense inmutable de eventos (`usuario_id`, `usuario_email`, `ip_address`, `accion`, `modulo`, `nivel`, `detalles` JSONB, `fecha`).

---

## 5. Seguridad, RBAC y Despacho de Webhooks

### 5.1 Autenticación JWT Soberana y Protección Anti-Fuerza Bruta
- **Sin dependencias M365:** Las sesiones operan exclusivamente mediante JWT firmados con algoritmo `HS256` y secreto `JWT_SECRET` (mínimo 32 bytes).
- **Cuentas Bootstrap Seguras:** El arranque verifica cuentas heredadas inseguras y únicamente aprovisiona administradores cuando las variables de entorno (`ADMIN_BOOTSTRAP_*` o `*_PASSWORD` de al menos 12 caracteres) están configuradas explícitamente en `.env` (sin contraseñas de respaldo en código fuente).
- **Rutas Públicas Controladas:** Lista blanca `PUBLIC_API_ROUTES` en `server.ts` (`/api/health`, `/api/auth/*` públicos y `/api/careers/*`); toda ruta privada exige `Authorization: Bearer <token>`.

### 5.2 Catálogo Principal de Rutas REST
- `GET /api/health`: Diagnóstico de disponibilidad y conexión PostgreSQL.
- `POST /api/auth/login`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`: Ciclo de identidad y recuperación por PIN (vía `N8N_RECOVERY_EMAIL_WEBHOOK`).
- `GET/POST/PUT/DELETE /api/vacancies`: Gestión de vacantes y recálculo de afinidad.
- `GET/POST/PATCH/DELETE /api/candidates` y `/api/candidates/upload`: Carga múltiple PDF/DOCX, parsing IA (Gemini / OpenAI / Claude), normalización canónica y actualización de etapas.
- `POST /api/candidates/:id/double-check`: Evaluación determinista de respuestas y generación de veredicto.
- `GET /api/audit-logs`: Consulta de bitácora forense filtrable (exclusiva para administradores).

### 5.3 Integración Asíncrona con n8n (`n8n_workflow_eas_recruiting_master.json`)
- **`candidato-sync`:** Sincronización de eventos `SCREENING_COMPLETED` y cálculo de estabilidad laboral.
- **`vacancia-sync`:** Replicación de vacantes hacia flujos externos.
- **`candidato-entrevista`:** Notificación de agenda y actualización de enlace de reunión.
- **`recovery-email`:** Envío SMTP corporativo del PIN de 6 dígitos para recuperación de contraseña.

---

## 6. Compilación, Pruebas y Despliegue

```bash
# Instalación y verificación de tipos
npm install
npm run lint

# Ejecución de las 7 suites de pruebas unitarias
npm test

# Empacado productivo con esbuild (genera dist/server.cjs)
npm run build
npm start

# Orquestación productiva con Docker Compose
docker compose up -d --build
```
