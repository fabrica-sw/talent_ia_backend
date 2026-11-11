# Documentación de Operaciones y DevOps: Talent IA v2.0

**Proyecto:** Talent IA (EAS AI Recruiting & Scheduling Platform)  
**Organización:** EAS Consulting Group  
**Repositorios:** `https://github.com/eaguilarh01/talent_ia_frontend.git` | `https://github.com/eaguilarh01/talent_ia_backend.git`  
**Autor de Entrega:** Enrique Aguilar (`e.aguilarhernandez2@dxc.com`)  
**Versión:** 2.0.0  

---

## 1. Topología de Infraestructura y Servidores

| Nodo / Servicio | Dirección / Puerto | Rol Operativo |
|---|---|---|
| **Host Aplicación (Proxmox VE)** | `10.10.10.102` | Ejecución Docker de `eas-recruiting-frontend` (`:8080`) y `eas-recruiting-backend` (`:3000`) |
| **Servidor Datos y Automatización** | `10.10.10.103` | Instancia PostgreSQL (`n8n_db:5432`) y Orquestador n8n (`:5678`) |
| **Red Docker Puente** | `atlas-net` (`atlas-app_default`) | Red externa compartida entre Nginx Proxy, Backend Express y servicios corporativos |
| **Ingress / Reverse Proxy Externo** | `187.170.135.143:3000 / :8443` | Terminación SSL/TLS y publicación HTTPS externa |

---

## 2. Construcción de Contenedores Multi-Etapa

### 2.1 Frontend (`talent_ia_frontend/Dockerfile`)
- **Stage 1 (`node:20-slim`):** Instala dependencias, ejecuta `npm run build` generando los activos estáticos Vite en `/app/dist`.
- **Stage 2 (`nginx:alpine`):** Copia `/app/dist` a `/usr/share/nginx/html` y aplica `nginx.conf` (Gzip ON, cabeceras OWASP `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `client_max_body_size 50M` y proxy `/api/*` -> `eas-backend:3000`).

### 2.2 Backend (`talent_ia_backend/Dockerfile`)
- **Stage 1 (`node:20-slim`):** Compila `server.ts` mediante `build-server.js` (esbuild) generando `dist/server.cjs`.
- **Stage 2 (`node:20-slim`):** Instala únicamente dependencias de producción (`npm install --omit=dev`), copia `dist/` y `db/` y expone el puerto `3000` ejecutando `node dist/server.cjs`.

---

## 3. Gestión Segura de Secretos y Variables de Entorno (`.env`)

1. **Cero Secretos en Git:** `.env` y `certs/` están excluidos en `.gitignore`. En código fuente se prohíben llaves o contraseñas por defecto.
2. **Variables Críticas Obligatorias:**
   - `DATABASE_URL`: Cadena de conexión PostgreSQL (`postgresql://user:pass@10.10.10.103:5432/n8n_db`).
   - `JWT_SECRET`: Generado con `openssl rand -hex 48` (mínimo 32 bytes).
   - `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: Llaves de proveedores IA configuradas exclusivamente en el servidor.
   - `ADMIN_BOOTSTRAP_EMAIL` y `ADMIN_BOOTSTRAP_PASSWORD`: Definidas solo para aprovisionamiento inicial y removidas del `.env` tras el primer acceso.
3. **Prevención GitHub Push Protection (GH013):** Ejecutar siempre escaneo de patrones (`sk-`, `AIzaSy`, `ghp_`) antes de cada commit.

---

## 4. Despliegue, Healthchecks y Rollback

```bash
# 1. Validar tipos y suites de pruebas antes de empaquetar
npm run lint
npm test

# 2. Compilar sin caché y desplegar contenedores
docker compose build --no-cache
docker compose up -d

# 3. Verificación de salud (Smoke Tests)
curl -sI http://localhost:8080/
curl -s http://localhost:3000/api/health
docker logs --tail 100 -f eas-recruiting-backend

# 4. Rollback rápido ante falla de imagen
docker compose down
git checkout <commit_estable>
docker compose up -d --build
```

---

## 5. Respaldo y Recuperación de Base de Datos (PostgreSQL)

```bash
# Respaldo lógico comprimido antes de cualquier migración o despliegue
pg_dump -h 10.10.10.103 -U n8n_user -d n8n_db -F c -f "backup_talent_ia_$(date +%Y%m%d_%H%M).dump"

# Restauración controlada desde volcado
pg_restore -h 10.10.10.103 -U n8n_user -d n8n_db --clean --if-exists backup_talent_ia.dump

# Aplicación manual de esquema DDL en BD limpia
psql -h 10.10.10.103 -U n8n_user -d n8n_db -f database_schema.sql
```
