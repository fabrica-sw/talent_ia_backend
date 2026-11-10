-- =============================================================================
-- SISTEMA DE CONTROL DE USUARIOS, AUTENTICACIÓN, RBAC Y AUDITORÍA EN POSTGRESQL
-- =============================================================================

-- 1. Habilitar extensión pgcrypto para gen_random_uuid() si no está activa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabla de Credenciales Principales (auth_users)
CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_code VARCHAR(20),
    reset_expires TIMESTAMPTZ,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Perfiles de Usuario (app_users)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'leader', 'user', 'director')),
    activo BOOLEAN DEFAULT true,
    primer_login BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Función Trigger para sincronizar auth_users -> app_users
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

-- 5. Registro del Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth_users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth_users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 6. Tabla de Logs de Auditoría de Seguridad (log_auditoria)
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

-- Índices de Rendimiento para Auditoría y Autenticación
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_reset_code ON auth_users(reset_code);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_rol ON app_users(rol);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_fecha ON log_auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_usuario_id ON log_auditoria(usuario_id);
