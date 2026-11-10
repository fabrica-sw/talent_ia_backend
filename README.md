# Talent IA — Backend REST API & Heuristic Engine (`talent_ia_backend`)

**Repositorio Oficial:** `https://github.com/eaguilarh01/talent_ia_backend.git`  
**Organización:** EAS Consulting Group  
**Autor de Entrega:** Enrique Aguilar (`e.aguilarhernandez2@dxc.com`)  
**Versión:** 2.0.0 (Arquitectura Desacoplada)  

Servicio central RESTful en Node.js 20 LTS y Express 4 para la plataforma **Talent IA**, responsable de autenticación JWT/RBAC, ingesta documental, integración multimodal con LLMs (Google Gemini / OpenAI / Anthropic Claude), cálculo determinista de FitScore 4D, evaluación Double-Check, webhooks n8n y persistencia transaccional en PostgreSQL.

---

## 1. Documentación Técnica y Paquete de Entrega (`docs/`)

- **Especificación de Arquitectura Backend (PDF):** [`docs/ARQUITECTURA_BACKEND.pdf`](docs/ARQUITECTURA_BACKEND.pdf) ([Fuente Markdown](docs/ARQUITECTURA_BACKEND.md))
- **Memoria Técnica del Proyecto (PDF):** [`docs/MEMORIA_TECNICA_PROYECTO_TESIS.pdf`](docs/MEMORIA_TECNICA_PROYECTO_TESIS.pdf)
- **Temario de Entrega Técnica Frontend & Backend (PDF):** [`docs/TEMARIO_DE_ENTREGA_TECNICA_FRONTEND_BACKEND.pdf`](docs/TEMARIO_DE_ENTREGA_TECNICA_FRONTEND_BACKEND.pdf)
- **Manuales Operativos por Rol (PDF):**
  - [`docs/MANUAL_OPERATIVO_ADMINISTRADOR.pdf`](docs/MANUAL_OPERATIVO_ADMINISTRADOR.pdf) (Rol `ADMIN`)
  - [`docs/MANUAL_OPERATIVO_RECLUTADOR.pdf`](docs/MANUAL_OPERATIVO_RECLUTADOR.pdf) (Rol `RECRUITER`)
  - [`docs/MANUAL_OPERATIVO_MANAGER.pdf`](docs/MANUAL_OPERATIVO_MANAGER.pdf) (Rol `MANAGER`)
- **Diagrama de Arquitectura Editable (Draw.io):** [`docs/diagrama_arquitectura.drawio`](docs/diagrama_arquitectura.drawio)

---

## 2. Stack Tecnológico

- **Runtime & Web:** Node.js 20 LTS (`node:20-slim`) + Express `^4.21.2`
- **Lenguaje y Empacado:** TypeScript `~5.8.2` (`NodeNext`) + `esbuild` (`build-server.js` -> `dist/server.cjs`)
- **Base de Datos:** PostgreSQL (`pg ^8.22.0`, pooling nativo y esquema DDL en `database_schema.sql` / `db/schema.sql`)
- **Proveedores IA:** `@google/genai`, `openai`, `@anthropic-ai/sdk`
- **Seguridad y Documentos:** `bcryptjs`, `jsonwebtoken`, `zod`, `multer`, `pdf-parse`, `mammoth`, `xlsx`
- **Automatización:** Integración vía webhooks n8n (`n8n_workflow_eas_recruiting_master.json`)

---

## 3. Arranque Local, Compilación y Pruebas

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (NO versionar .env)
cp .env.example .env

# 3. Verificar tipos TypeScript y ejecutar las 7 suites de pruebas
npm run lint
npm test

# 4. Compilar artefacto productivo (dist/server.cjs) y arrancar
npm run build
npm start

# Modo desarrollo con recarga
npm run dev
```

---

## 4. Despliegue con Docker & Docker Compose

```bash
# Compilar y levantar servicio backend (y frontend hermano si aplica)
docker compose up -d --build

# Verificación de salud
curl -sI http://localhost:3000/api/health
```
