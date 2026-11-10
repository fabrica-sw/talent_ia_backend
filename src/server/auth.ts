import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'crypto';

// JWT_SECRET es obligatorio en producción (sin default en el código: cualquier default
// versionado permite a quien lea el repo firmar tokens de admin).
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET || '';
  if (fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    console.error("EAS AI Recruiting: FATAL — JWT_SECRET no definido o con menos de 32 caracteres. Genera uno con: openssl rand -hex 48");
    process.exit(1);
  }
  console.warn("[AUTH] JWT_SECRET no definido: usando un secreto aleatorio efímero (solo desarrollo; las sesiones se invalidan al reiniciar).");
  return crypto.randomBytes(48).toString('hex');
}
const JWT_SECRET = resolveJwtSecret();
const JWT_ALGORITHM = 'HS256' as const;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];
const VALID_ROLES = ['admin', 'leader', 'user', 'director'] as const;
// Hash fijo para comparar cuando el usuario no existe (tiempo de respuesta constante, evita enumerar correos).
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

// Configuración de bloqueo de cuenta
const LOCKOUT_MAX_ATTEMPTS = 5; // Número de intentos fallidos antes de bloquear
const LOCKOUT_DURATION_MINUTES = 30; // Duración del bloqueo en minutos

export interface UserPayload {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'leader' | 'user' | 'director';
  area?: string;
  activo: boolean;
  primer_login: boolean;
}

export function issueJwtToken(userPayload: UserPayload): string {
  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM });
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

/**
 * Obtiene la dirección IP real del cliente considerando proxies.
 */
export function getClientIp(req: Request): string {
  // req.ip ya aplica 'trust proxy' (server.ts). Leer X-Forwarded-For directo permitía falsificar la IP en auditoría.
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Función auxiliar para registrar eventos en la tabla log_auditoria
 */
export async function registrarAuditoria(
  pool: pg.Pool | null,
  params: {
    usuario_id?: string | null;
    usuario_email?: string | null;
    ip_address: string;
    accion: string;
    modulo: string;
    nivel: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    detalles?: Record<string, any>;
  }
): Promise<void> {
  const { usuario_id, usuario_email, ip_address, accion, modulo, nivel, detalles } = params;
  
  // Generar hash inmune a alteraciones para integridad de auditoría
  const hashInput = `${usuario_id || ''}|${usuario_email || ''}|${ip_address}|${accion}|${modulo}|${nivel}|${JSON.stringify(detalles || {})}|${Date.now()}`;
  const immutableHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  
  const detallesConHash = { ...detalles, immutableHash };
  
  // Registro en consola para trazabilidad local
  console.log(`[AUDIT - ${nivel}] [${modulo}] ${accion} - Usuario: ${usuario_email || usuario_id || 'ANÓNIMO'} (IP: ${ip_address})`);
  
  if (!pool) return;
  
  try {
    await pool.query(
      `INSERT INTO log_auditoria (usuario_id, usuario_email, ip_address, accion, modulo, nivel, detalles)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        usuario_id || null,
        usuario_email || null,
        ip_address,
        accion,
        modulo,
        nivel,
        JSON.stringify(detallesConHash || {})
      ]
    );
  } catch (err: any) {
    console.error("Error al registrar auditoría en PostgreSQL:", err.message);
  }
}

/**
 * Middleware authenticateToken:
 * Verifica el Bearer Token JWT en headers de petición y valida estado activo.
 */
export function authenticateToken(pool: pg.Pool | null) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Acceso Denegado',
        message: 'No se proporcionó un token de autenticación (Bearer token requerido)'
      });
    }

    let decoded: UserPayload;
    try {
      // Algoritmo fijo: impide tokens con alg "none" o confusión de algoritmos.
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as UserPayload;
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: 'Token Inválido o Expirado',
        message: 'El token proporcionado ha caducado o no es válido'
      });
    }

    try {
      // Si la base de datos está disponible, validar que el usuario siga estando activo
      if (pool) {
        let userRes = await pool.query(
          `SELECT id, email, nombre, rol, activo, primer_login FROM app_users WHERE id = $1`,
          [decoded.id]
        );

        // Auto-reparación: Si el usuario existe en auth_users pero falta la fila en app_users
        if (userRes.rows.length === 0) {
          const authCheck = await pool.query(
            `SELECT id, email, raw_user_meta_data FROM auth_users WHERE id = $1`,
            [decoded.id]
          );

          if (authCheck.rows.length > 0) {
            const aRow = authCheck.rows[0];
            const meta = aRow.raw_user_meta_data || {};
            await pool.query(
              `INSERT INTO app_users (id, email, nombre, rol, activo, primer_login)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, activo = true`,
              [
                aRow.id,
                aRow.email,
                meta.nombre || aRow.email.split('@')[0],
                meta.rol || 'user',
                true,
                meta.primer_login !== undefined ? meta.primer_login : false
              ]
            );

            userRes = await pool.query(
              `SELECT id, email, nombre, rol, activo, primer_login FROM app_users WHERE id = $1`,
              [decoded.id]
            );
          }
        }

        if (userRes.rows.length === 0) {
          // Si por alguna razón el ID no está en app_users ni auth_users pero el JWT es válido y no caducado
          req.user = decoded;
        } else {
          const userRow = userRes.rows[0];

          if (userRow.activo === false) {
            return res.status(403).json({
              success: false,
              error: 'Cuenta Desactivada',
              message: 'Su cuenta ha sido desactivada por un administrador'
            });
          }

          req.user = {
            id: userRow.id,
            email: userRow.email,
            nombre: userRow.nombre,
            rol: userRow.rol,
            activo: userRow.activo,
            primer_login: userRow.primer_login
          };
        }
      } else {
        req.user = decoded;
      }

      next();
    } catch (err: any) {
      // Un fallo de BD NO es un token inválido: antes devolvía 401 y el front cerraba la sesión.
      console.error(`[AUTH] Error de base de datos validando sesión [${err.code || 'ERR'}]: ${err.message}`);
      return res.status(503).json({
        success: false,
        error: 'Base de datos no disponible',
        message: 'No se pudo validar la sesión porque la base de datos no responde. Intenta de nuevo en unos momentos.'
      });
    }
  };
}

/**
 * Middleware requireRole (RBAC):
 * Comprueba que el usuario autenticado posea uno de los roles permitidos.
 */
export function requireRole(allowedRoles: ('admin' | 'leader' | 'user' | 'director')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No Autenticado',
        message: 'Se requiere iniciar sesión'
      });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso Denegado',
        message: `Acceso restringido. Su rol actual ('${req.user.rol}') no tiene permisos para esta acción`
      });
    }

    next();
  };
}

/**
 * Endpoint Controller: POST /auth/login
 */
export async function handleLogin(pool: pg.Pool | null, req: Request, res: Response) {
  const { email, password } = req.body || {};
  const ipAddress = getClientIp(req);

  if (!email || !password) {
    await registrarAuditoria(pool, {
      ip_address: ipAddress,
      accion: 'LOGIN_FALLIDO',
      modulo: 'AUTENTICACIÓN',
      nivel: 'WARN',
      detalles: { motivo: 'Parámetros incompletos (email o contraseña faltantes)' }
    });
    return res.status(400).json({
      success: false,
      message: 'Email y contraseña son obligatorios'
    });
  }

  try {
    let userRecord: any = null;

    if (pool) {
      const cleanEmail = String(email).trim().toLowerCase();
      let altEmail = cleanEmail;
      if (cleanEmail.endsWith('@easconsulting.com.mx')) {
        altEmail = cleanEmail.replace('@easconsulting.com.mx', '@eas-consulting.com');
      } else if (cleanEmail.endsWith('@eas-consulting.com')) {
        altEmail = cleanEmail.replace('@eas-consulting.com', '@easconsulting.com.mx');
      }

      const result = await pool.query(
        `SELECT u.id, u.email, u.password_hash,
                COALESCE(p.nombre, u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1)) as nombre,
                COALESCE(p.rol, u.raw_user_meta_data->>'rol', 'user') as rol,
                COALESCE(p.activo, true) as activo,
                COALESCE(p.primer_login, false) as primer_login
         FROM auth_users u
         LEFT JOIN app_users p ON u.id = p.id
         WHERE LOWER(TRIM(u.email)) = $1 OR LOWER(TRIM(u.email)) = $2
         ORDER BY CASE WHEN LOWER(TRIM(u.email)) = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [cleanEmail, altEmail]
      );
      if (result.rows.length > 0) {
        userRecord = result.rows[0];
      }
    } else if (!pool) {
      // Modo demo (STORAGE_MODE=memory, sin BD): permitir acceso con credenciales de prueba corporativas
      const cleanEmail = String(email).toLowerCase().trim();
      if (cleanEmail.endsWith('@easconsulting.com.mx') || cleanEmail.endsWith('@eas-consulting.com') || cleanEmail === 'admin') {
        const bootstrapPass = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123!';
        const inputPass = String(password);
        const matchesPass = inputPass === bootstrapPass || inputPass === 'admin123' || inputPass === 'admin123!' || inputPass === 'admin';
        if (matchesPass) {
          const isAdmin = cleanEmail.includes('admin') || cleanEmail.includes('enrique.aguilar');
          userRecord = {
            id: '00000000-0000-0000-0000-00000000demo',
            email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@easconsulting.com.mx`,
            password_hash: bcrypt.hashSync(inputPass, 10),
            nombre: cleanEmail.includes('enrique') ? 'Enrique Aguilar' : 'Consultor EAS',
            rol: isAdmin ? 'admin' : 'leader',
            area: 'Dirección General & Gobernanza',
            activo: true,
            primer_login: false
          };
        }
      }
    }

    // Eliminado: auto-aprovisionamiento. Antes, cualquier correo @easconsulting.com.mx (o
    // @eas-consulting.com) inexistente se creaba como ADMIN con la contraseña que se tecleara,
    // y si la BD fallaba se emitía un token de admin en memoria sin verificar nada.
    // Los usuarios ahora solo los crea un admin desde /api/admin/users.
    const validPassword = await bcrypt.compare(String(password), userRecord ? userRecord.password_hash : DUMMY_BCRYPT_HASH);

if (!userRecord || !validPassword) {
      // Incrementar intentos fallidos y verificar bloqueo de cuenta
      const now = Date.now();
      const lockedUntil = userRecord?.locked_until ? new Date(userRecord.locked_until) : null;
      const attempts = userRecord?.failed_attempts ? userRecord.failed_attempts : 0;

      // Si la cuenta está bloqueada y el bloqueo aún no expira, rechazar
      if (lockedUntil && now < lockedUntil.getTime()) {
        const tiempoRestante = Math.ceil((lockedUntil.getTime() - now) / 60000);
        return res.status(423).json({
          success: false,
          message: `Cuenta bloqueada por ${tiempoRestante} minutos. Intente nuevamente después.`
        });
      }

      // Incrementar intentos fallidos
      const nuevoIntentos = attempts + 1;
      const nuevoLockedUntil = nuevoIntentos >= LOCKOUT_MAX_ATTEMPTS
        ? new Date(now + LOCKOUT_DURATION_MINUTES * 60000)
        : null;

      // Actualizar la cuenta con nuevos intentos y posible bloqueo
      if (pool) {
        await pool.query(
          `UPDATE auth_users SET failed_attempts = $1, locked_until = $2, updated_at = CURRENT_TIMESTAMP WHERE email = $3`,
          [nuevoIntentos, nuevoLockedUntil?.toISOString().slice(0, 19).replace('T', ' '), String(email).trim().toLowerCase()]
        );
      }

      // Registrar auditoría
      await registrarAuditoria(pool, {
        usuario_email: email,
        ip_address: ipAddress,
        accion: 'LOGIN_FALLIDO',
        modulo: 'AUTENTICACIÓN',
        nivel: 'WARN',
        detalles: { motivo: 'Credenciales inválidas', intentos: nuevoIntentos }
      });

      // Si no se alcanzó el límite de bloqueo, mensaje genérico; si se bloqueó, informar tiempo
      const mensaje = nuevoIntentos >= LOCKOUT_MAX_ATTEMPTS
        ? `Cuenta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos por exceso de intentos fallidos`
        : 'Credenciales inválidas (email o contraseña incorrecta)';

      return res.status(401).json({
        success: false,
        message: mensaje
      });
    }

    // Verificar si el usuario está activo
    if (userRecord.activo === false) {
      await registrarAuditoria(pool, {
        usuario_id: userRecord.id,
        usuario_email: userRecord.email,
        ip_address: ipAddress,
        accion: 'LOGIN_BLOQUEADO',
        modulo: 'AUTENTICACIÓN',
        nivel: 'WARN',
        detalles: { motivo: 'Cuenta de usuario inactiva' }
      });
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada. Contacte al administrador del sistema.'
      });
    }

    // Generar JWT token (vigencia JWT_EXPIRES_IN, default 8h)
    const userPayload: UserPayload = {
      id: userRecord.id,
      email: userRecord.email,
      nombre: userRecord.nombre,
      rol: userRecord.rol,
      area: userRecord.area || 'Dirección General & Gobernanza',
      activo: userRecord.activo,
      primer_login: userRecord.primer_login
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM });

    // Registrar auditoría de éxito
    await registrarAuditoria(pool, {
      usuario_id: userRecord.id,
      usuario_email: userRecord.email,
      ip_address: ipAddress,
      accion: 'LOGIN_EXITOSO',
      modulo: 'AUTENTICACIÓN',
      nivel: 'INFO',
      detalles: { rol: userRecord.rol, primer_login: userRecord.primer_login }
    });

    return res.status(200).json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err: any) {
    console.error("Error en /auth/login:", err);
    await registrarAuditoria(pool, {
      usuario_email: email,
      ip_address: ipAddress,
      accion: 'LOGIN_ERROR',
      modulo: 'AUTENTICACIÓN',
      nivel: 'ERROR',
      detalles: { error: err.message }
    });
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor durante el inicio de sesión'
    });
  }
}

/**
 * Endpoint Controller: PUT /auth/change-password
 */
export async function handleChangePassword(pool: pg.Pool | null, req: AuthenticatedRequest, res: Response) {
  const { current_password, new_password } = req.body || {};
  const user = req.user!;
  const ipAddress = getClientIp(req);

  if (!current_password || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'Debe ingresar la contraseña actual y la nueva contraseña'
    });
  }

  if (String(new_password).length < 10) {
    return res.status(400).json({
      success: false,
      message: 'La nueva contraseña debe tener al menos 10 caracteres'
    });
  }

  try {
    if (pool) {
      // Obtener el hash actual del usuario desde auth_users
      const authRes = await pool.query(`SELECT password_hash FROM auth_users WHERE id = $1`, [user.id]);
      if (authRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Registro de usuario no encontrado' });
      }

      const validCurrent = await bcrypt.compare(current_password, authRes.rows[0].password_hash);
      if (!validCurrent) {
        await registrarAuditoria(pool, {
          usuario_id: user.id,
          usuario_email: user.email,
          ip_address: ipAddress,
          accion: 'CAMBIO_PASSWORD_FALLIDO',
          modulo: 'AUTENTICACIÓN',
          nivel: 'WARN',
          detalles: { motivo: 'Contraseña actual incorrecta' }
        });
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual ingresada es incorrecta'
        });
      }

      // Hash de la nueva contraseña
      const newHash = await bcrypt.hash(new_password, 12);

      const cleanUserEmail = (user.email || '').toLowerCase().trim();
      let altUserEmail = cleanUserEmail;
      if (cleanUserEmail.endsWith('@easconsulting.com.mx')) {
        altUserEmail = cleanUserEmail.replace('@easconsulting.com.mx', '@eas-consulting.com');
      } else if (cleanUserEmail.endsWith('@eas-consulting.com')) {
        altUserEmail = cleanUserEmail.replace('@eas-consulting.com', '@easconsulting.com.mx');
      }

      // Actualizar auth_users y desmarcar primer_login en app_users para el usuario y sus alias
      await pool.query(
        `UPDATE auth_users SET password_hash = $1 
         WHERE id = $2 
            OR LOWER(TRIM(email)) = $3 
            OR LOWER(TRIM(email)) = $4
            OR id IN (
              SELECT u2.id FROM auth_users u2
              JOIN app_users a1 ON a1.id = $2
              JOIN app_users a2 ON a2.id = u2.id
              WHERE LOWER(a1.nombre) = LOWER(a2.nombre)
            )`,
        [newHash, user.id, cleanUserEmail, altUserEmail]
      );
      await pool.query(
        `UPDATE app_users SET primer_login = false 
         WHERE id = $1 OR id IN (
           SELECT u2.id FROM auth_users u2
           JOIN app_users a1 ON a1.id = $1
           JOIN app_users a2 ON a2.id = u2.id
           WHERE LOWER(a1.nombre) = LOWER(a2.nombre)
         )`,
        [user.id]
      );
    }

    await registrarAuditoria(pool, {
      usuario_id: user.id,
      usuario_email: user.email,
      ip_address: ipAddress,
      accion: 'CAMBIO_PASSWORD_EXITOSO',
      modulo: 'AUTENTICACIÓN',
      nivel: 'INFO',
      detalles: { primer_login_actualizado: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
      primer_login: false
    });
  } catch (err: any) {
    console.error("Error en /auth/change-password:", err);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar la contraseña'
    });
  }
}

/**
 * Endpoint Administrative Controller: POST /api/admin/users
 * Actions: 'create', 'update', 'toggle_active', 'reset_password', 'list'
 */
export async function handleAdminUsers(pool: pg.Pool | null, req: AuthenticatedRequest, res: Response) {
  const { action, id, email, password, nombre, rol, activo, new_password } = req.body || {};
  const adminUser = req.user!;
  const ipAddress = getClientIp(req);

  if (!action) {
    return res.status(400).json({
      success: false,
      message: "Se requiere especificar el parámetro 'action' ('create', 'update', 'toggle_active', 'reset_password', 'list')"
    });
  }

  try {
    switch (action) {
      case 'create': {
        if (!email || !password || !nombre || !rol) {
          return res.status(400).json({
            success: false,
            message: "Parámetros obligatorios faltantes para crear usuario: email, password, nombre, rol"
          });
        }

        if (!(VALID_ROLES as readonly string[]).includes(rol)) {
          return res.status(400).json({
            success: false,
            message: `Rol inválido. Roles permitidos: ${VALID_ROLES.join(', ')}`
          });
        }
        if (String(password).length < 10) {
          return res.status(400).json({ success: false, message: 'La contraseña inicial debe tener al menos 10 caracteres' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const metaData = { nombre, rol, activo: true, primer_login: true };

        let createdUser: any = null;

        if (pool) {
          // Inserción en auth_users activa automáticamente el Trigger PostgreSQL on_auth_user_created -> app_users
          const insertRes = await pool.query(
            `INSERT INTO auth_users (email, password_hash, raw_user_meta_data)
             VALUES ($1, $2, $3::jsonb)
             RETURNING id, email, created_at`,
            [email.toLowerCase().trim(), password_hash, JSON.stringify(metaData)]
          );

          const userId = insertRes.rows[0].id;

          // Consultar el usuario en app_users para confirmar el disparo correcto del trigger
          const appRes = await pool.query(`SELECT id, email, nombre, rol, activo, primer_login, created_at FROM app_users WHERE id = $1`, [userId]);
          createdUser = appRes.rows[0];
        } else {
          createdUser = {
            id: 'mock-' + Date.now(),
            email,
            nombre,
            rol,
            activo: true,
            primer_login: true,
            created_at: new Date().toISOString()
          };
        }

        await registrarAuditoria(pool, {
          usuario_id: adminUser.id,
          usuario_email: adminUser.email,
          ip_address: ipAddress,
          accion: 'CREAR_USUARIO',
          modulo: 'ADMINISTRACIÓN_USUARIOS',
          nivel: 'INFO',
          detalles: { usuario_creado_id: createdUser.id, usuario_creado_email: email, rol }
        });

        return res.status(201).json({
          success: true,
          message: 'Usuario creado exitosamente con Trigger de Perfil',
          user: createdUser
        });
      }

      case 'update': {
        if (!id || !nombre || !rol) {
          return res.status(400).json({
            success: false,
            message: "Parámetros obligatorios faltantes para actualizar: id, nombre, rol"
          });
        }
        if (!(VALID_ROLES as readonly string[]).includes(rol)) {
          return res.status(400).json({ success: false, message: `Rol inválido. Roles permitidos: ${VALID_ROLES.join(', ')}` });
        }

        if (pool) {
          await pool.query(
            `UPDATE app_users SET nombre = $1, rol = $2 WHERE id = $3`,
            [nombre, rol, id]
          );
        }

        await registrarAuditoria(pool, {
          usuario_id: adminUser.id,
          usuario_email: adminUser.email,
          ip_address: ipAddress,
          accion: 'ACTUALIZAR_USUARIO',
          modulo: 'ADMINISTRACIÓN_USUARIOS',
          nivel: 'INFO',
          detalles: { target_user_id: id, nuevo_nombre: nombre, nuevo_rol: rol }
        });

        return res.status(200).json({
          success: true,
          message: 'Usuario actualizado exitosamente'
        });
      }

      case 'toggle_active': {
        if (!id || typeof activo !== 'boolean') {
          return res.status(400).json({
            success: false,
            message: "Parámetros obligatorios faltantes: id, activo (boolean)"
          });
        }

        if (pool) {
          await pool.query(
            `UPDATE app_users SET activo = $1 WHERE id = $2`,
            [activo, id]
          );
        }

        await registrarAuditoria(pool, {
          usuario_id: adminUser.id,
          usuario_email: adminUser.email,
          ip_address: ipAddress,
          accion: 'CAMBIAR_ESTADO_USUARIO',
          modulo: 'ADMINISTRACIÓN_USUARIOS',
          nivel: 'WARN',
          detalles: { target_user_id: id, nuevo_estado_activo: activo }
        });

        return res.status(200).json({
          success: true,
          message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`
        });
      }

      case 'reset_password': {
        if (!id || !new_password) {
          return res.status(400).json({
            success: false,
            message: "Parámetros obligatorios faltantes: id, new_password"
          });
        }

        if (String(new_password).length < 10) {
          return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 10 caracteres' });
        }
        const newHash = await bcrypt.hash(new_password, 12);

        if (pool) {
          await pool.query(`UPDATE auth_users SET password_hash = $1 WHERE id = $2`, [newHash, id]);
          await pool.query(`UPDATE app_users SET primer_login = true WHERE id = $1`, [id]);
        }

        await registrarAuditoria(pool, {
          usuario_id: adminUser.id,
          usuario_email: adminUser.email,
          ip_address: ipAddress,
          accion: 'REINICIAR_PASSWORD_USUARIO',
          modulo: 'ADMINISTRACIÓN_USUARIOS',
          nivel: 'WARN',
          detalles: { target_user_id: id, primer_login_forzado: true }
        });

        return res.status(200).json({
          success: true,
          message: 'Contraseña reiniciada exitosamente. Se ha activado el flag de primer_login.'
        });
      }

      case 'list': {
        let users: any[] = [];
        if (pool) {
          const listRes = await pool.query(
            `SELECT id, email, nombre, rol, activo, primer_login, created_at
             FROM app_users
             ORDER BY created_at DESC`
          );
          users = listRes.rows;
        }

        return res.status(200).json({
          success: true,
          users
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Acción desconocida: '${action}'. Acciones válidas: 'create', 'update', 'toggle_active', 'reset_password', 'list'`
        });
    }
  } catch (err: any) {
    console.error("Error en handleAdminUsers:", err);
    await registrarAuditoria(pool, {
      usuario_id: adminUser.id,
      usuario_email: adminUser.email,
      ip_address: ipAddress,
      accion: 'ERROR_ADMIN_USUARIOS',
      modulo: 'ADMINISTRACIÓN_USUARIOS',
      nivel: 'ERROR',
      detalles: { action, error: err.message }
    });
    return res.status(500).json({
      success: false,
      message: err.code === '23505' ? 'Ya existe un usuario con ese correo' : `Error al procesar la acción '${action}'`
    });
  }
}

/**
 * Endpoint Controller: POST /auth/v1/recover (o /api/auth/request-recovery-pin)
 * Genera un código de reseteo de 6 dígitos con expiración de 30 minutos,
 * lo guarda en auth_users y despacha el correo vía n8n webhook.
 * Responde un 200 OK genérico sin revelar si el usuario existe (Zero Leak).
 */
export async function handleRecoverPasswordRequest(pool: pg.Pool | null, req: Request, res: Response) {
  const { email } = req.body || {};
  const ipAddress = getClientIp(req);
  const genericResponse = {
    ok: true,
    success: true,
    message: "Código enviado a tu correo electrónico."
  };

  if (!email || !String(email).includes('@')) {
    return res.status(400).json({
      ok: false,
      success: false,
      message: "Debe proporcionar un correo electrónico válido."
    });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    let userFound = false;
    if (pool) {
      const userRes = await pool.query(
        `SELECT u.id, u.email FROM auth_users u
         LEFT JOIN app_users p ON p.id = u.id
         WHERE LOWER(TRIM(u.email)) = $1 AND COALESCE(p.activo, true) = true`,
        [cleanEmail]
      );
      userFound = userRes.rows.length > 0;
    } else {
      userFound = true;
    }

    if (!userFound) {
      // Zero leak: responder éxito idéntico sin revelar existencia
      return res.status(200).json(genericResponse);
    }

    // Generar código numérico aleatorio de 6 dígitos (ej: 849201)
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos TTL

    if (pool) {
      await pool.query(
        `UPDATE auth_users SET reset_code = $1, reset_expires = $2 WHERE LOWER(TRIM(email)) = $3`,
        [resetCode, expiresAt, cleanEmail]
      );

      await registrarAuditoria(pool, {
        usuario_email: cleanEmail,
        ip_address: ipAddress,
        accion: 'SOLICITUD_RECUPERACION_PASSWORD',
        modulo: 'AUTENTICACIÓN',
        nivel: 'INFO',
        detalles: { motivo: 'Generación de reset_code de 6 dígitos (30 min TTL)' }
      });
    }

    // Persistir el código de recuperación en la BD de inmediato
    if (pool) {
      await pool.query(
        `UPDATE auth_users SET reset_code = $1, reset_expires = $2 WHERE LOWER(TRIM(email)) = $3`,
        [resetCode, expiresAt, cleanEmail]
      );
    }

    // Despacho controlado del webhook a n8n con timeout de 3.5s
    const webhookUrls = [
      process.env.N8N_RECOVERY_EMAIL_WEBHOOK,
      'http://10.10.10.103:5678/webhook/recovery-email',
      'http://10.10.10.103:5678/webhook/71UfFgKyQSgdpbwZ/webhook/recovery-email'
    ].filter(Boolean) as string[];

    // Eliminar duplicados
    const uniqueWebhookUrls = Array.from(new Set(webhookUrls));

    const payload = {
      email: cleanEmail,
      code: resetCode,
      reset_code: resetCode,
      pin: resetCode,
      from_email: "it@easconsulting.com.mx",
      sender: "it@easconsulting.com.mx",
      expires_in_minutes: 30,
      timestamp: new Date().toISOString()
    };

    let sentToN8n = false;
    for (const webhookUrl of uniqueWebhookUrls) {
      try {
        const n8nRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3500)
        });
        if (n8nRes.ok || n8nRes.status === 200) {
          console.log(`[AUTH RECOVER] Correo con código enviado exitosamente a n8n (${webhookUrl}) para ${cleanEmail}`);
          sentToN8n = true;
          break;
        }
      } catch (err: any) {
        console.warn(`[AUTH RECOVER] Intento hacia n8n (${webhookUrl}) falló o timeout: ${err?.message}`);
      }
    }

    if (!sentToN8n) {
      console.warn(`[AUTH RECOVER] Advertencia: n8n no respondió a tiempo para ${cleanEmail}. Código persistido en DB.`);
    }

    // Siempre retornar 200 con respuesta genérica segura (evita enumeración de usuarios y múltiples clics)
    return res.status(200).json(genericResponse);
  } catch (err: any) {
    console.error("Error en handleRecoverPasswordRequest:", err);
    return res.status(500).json({
      ok: false,
      success: false,
      message: "Error al procesar la solicitud de recuperación de contraseña."
    });
  }
}

/**
 * Endpoint Controller: POST /auth/v1/reset-password (o /api/auth/verify-recovery-pin)
 * Valida reset_code en DB y expiración > NOW(), valida la nueva contraseña (>= 8 caracteres),
 * genera hash bcrypt (rounds 12), actualiza auth_users y limpia el código.
 */
export async function handleResetPasswordExecute(pool: pg.Pool | null, req: Request, res: Response) {
  const { email, reset_code, pinCode, new_password, newPassword } = req.body || {};
  const codeToVerify = String(reset_code || pinCode || '').trim();
  const passwordToSet = String(new_password || newPassword || '');
  const ipAddress = getClientIp(req);

  if (!email || !codeToVerify || !passwordToSet) {
    return res.status(400).json({
      ok: false,
      success: false,
      message: "Email, código de reseteo y nueva contraseña son obligatorios."
    });
  }

  if (passwordToSet.length < 8) {
    return res.status(400).json({
      ok: false,
      success: false,
      message: "La nueva contraseña debe tener al menos 8 caracteres."
    });
  }

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    if (pool) {
      const userRes = await pool.query(
        `SELECT id, reset_code, reset_expires FROM auth_users WHERE LOWER(TRIM(email)) = $1`,
        [cleanEmail]
      );

      if (userRes.rows.length === 0) {
        return res.status(400).json({
          ok: false,
          success: false,
          message: "Código de reseteo inválido o expirado."
        });
      }

      const userRow = userRes.rows[0];
      const dbCode = userRow.reset_code;
      const dbExpires = userRow.reset_expires ? new Date(userRow.reset_expires).getTime() : 0;

      if (!dbCode || dbCode !== codeToVerify || Date.now() > dbExpires) {
        await registrarAuditoria(pool, {
          usuario_id: userRow.id,
          usuario_email: cleanEmail,
          ip_address: ipAddress,
          accion: 'RESET_PASSWORD_FALLIDO',
          modulo: 'AUTENTICACIÓN',
          nivel: 'WARN',
          detalles: { motivo: 'Código inválido o expirado' }
        });
        return res.status(400).json({
          ok: false,
          success: false,
          message: "Código de reseteo inválido o expirado. Solicita uno nuevo."
        });
      }

      // Hash Bcrypt rounds 12
      const newHash = await bcrypt.hash(passwordToSet, 12);

      let altEmail = cleanEmail;
      if (cleanEmail.endsWith('@easconsulting.com.mx')) {
        altEmail = cleanEmail.replace('@easconsulting.com.mx', '@eas-consulting.com');
      } else if (cleanEmail.endsWith('@eas-consulting.com')) {
        altEmail = cleanEmail.replace('@eas-consulting.com', '@easconsulting.com.mx');
      }

      // Actualizar contraseña y limpiar código de reseteo para todas las variantes del usuario
      await pool.query(
        `UPDATE auth_users 
         SET password_hash = $1, reset_code = NULL, reset_expires = NULL 
         WHERE LOWER(TRIM(email)) = $2 
            OR LOWER(TRIM(email)) = $3 
            OR id IN (
              SELECT u2.id FROM auth_users u2
              JOIN app_users a1 ON a1.id = $4
              JOIN app_users a2 ON a2.id = u2.id
              WHERE LOWER(a1.nombre) = LOWER(a2.nombre)
            )`,
        [newHash, cleanEmail, altEmail, userRow.id]
      );
      await pool.query(
        `UPDATE app_users SET primer_login = false 
         WHERE id = $1 OR id IN (
           SELECT u2.id FROM auth_users u2
           JOIN app_users a1 ON a1.id = $1
           JOIN app_users a2 ON a2.id = u2.id
           WHERE LOWER(a1.nombre) = LOWER(a2.nombre)
         )`,
        [userRow.id]
      );

      await registrarAuditoria(pool, {
        usuario_id: userRow.id,
        usuario_email: cleanEmail,
        ip_address: ipAddress,
        accion: 'RESET_PASSWORD_EXITOSO',
        modulo: 'AUTENTICACIÓN',
        nivel: 'INFO',
        detalles: { resultado: 'Contraseña restablecida exitosamente en 2 pasos' }
      });
    }

    return res.status(200).json({
      ok: true,
      success: true,
      message: "Contraseña actualizada exitosamente."
    });
  } catch (err: any) {
    console.error("Error en handleResetPasswordExecute:", err);
    return res.status(500).json({
      ok: false,
      success: false,
      message: "Error al actualizar la contraseña."
    });
  }
}

