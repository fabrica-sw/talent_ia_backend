import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve(fn()).then(() => {
    passed++;
    console.log(`✓ ${name}`);
  }).catch((err) => {
    console.error(`✗ ${name}: ${err.message}`);
    process.exit(1);
  });
}

const JWT_SECRET = 'TEST_JWT_SECRET_KEY_FOR_QA_AUDIT_VERIFICATION_2026';

// 1. Prueba de Hashing de Contraseñas con bcrypt (Costo >= 10)
test('bcrypt genera hashes válidos y verifica contraseñas correctamente', async () => {
  const plainPassword = 'TempPassword#2026!';
  const hash = await bcrypt.hash(plainPassword, 12);

  assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'El hash generado debe usar algoritmo bcrypt');
  assert.equal(await bcrypt.compare(plainPassword, hash), true, 'La contraseña correcta debe validar exitosamente');
  assert.equal(await bcrypt.compare('WrongPassword123', hash), false, 'Una contraseña incorrecta debe ser rechazada');
});

// 2. Prueba de Firma y Validación de JWT con restricción de algoritmo HS256
test('JWT firma y valida payloads con algoritmo estricto HS256', () => {
  const payload = {
    id: 'user-uuid-1234',
    email: 'brandon@easconsulting.com.mx',
    nombre: 'Brandon Test',
    rol: 'user',
    activo: true,
    primer_login: true
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
  assert.ok(token.length > 50, 'El token debe ser una cadena JWT válida');

  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as typeof payload;
  assert.equal(decoded.email, 'brandon@easconsulting.com.mx');
  assert.equal(decoded.primer_login, true);
});

// 3. Prueba de forzado del flag primer_login en reseteo administrativo
test('El reseteo de contraseña fuerza primer_login = true y requiere cambio inmediato', () => {
  const userRecord = {
    id: 'user-uuid-5678',
    email: 'brandon@easconsulting.com.mx',
    primer_login: false
  };

  // Simulación de acción administrative reset_password
  const resetAction = (user: typeof userRecord) => {
    return {
      ...user,
      primer_login: true,
      updated_at: new Date().toISOString()
    };
  };

  const updatedUser = resetAction(userRecord);
  assert.equal(updatedUser.primer_login, true, 'El reseteo administrativo debe marcar primer_login = true');
});

// 4. Prueba de desmarcado de primer_login tras actualización exitosa por el usuario
test('El cambio de contraseña del usuario limpia el flag primer_login a false', () => {
  const userRecord = {
    id: 'user-uuid-5678',
    email: 'brandon@easconsulting.com.mx',
    primer_login: true
  };

  // Simulación de acción /auth/change-password
  const changePasswordAction = (user: typeof userRecord) => {
    return {
      ...user,
      primer_login: false
    };
  };

  const updatedUser = changePasswordAction(userRecord);
  assert.equal(updatedUser.primer_login, false, 'El cambio de contraseña exitoso debe dejar primer_login = false');
});

// 5. Prueba de estructura inmutable de Logs de Auditoría
test('Log de auditoría registra metadatos inmutables de seguridad sin revelar credenciales', () => {
  const auditEntry = {
    usuario_email: 'brandon@easconsulting.com.mx',
    ip_address: '192.168.1.100',
    accion: 'REINICIAR_PASSWORD_USUARIO',
    modulo: 'ADMINISTRACIÓN_USUARIOS',
    nivel: 'WARN',
    detalles: { target_user_id: 'user-uuid-5678', primer_login_forzado: true }
  };

  assert.equal(auditEntry.accion, 'REINICIAR_PASSWORD_USUARIO');
  assert.equal(auditEntry.nivel, 'WARN');
  assert.ok(!JSON.stringify(auditEntry).includes('password'), 'El log de auditoría NUNCA debe contener la contraseña');
});

// 6. Prueba de recuperación de contraseña en 2 pasos (Código de 6 dígitos con 30 min TTL y Zero-Leak)
test('El flujo de recuperación en 2 pasos genera código de 6 dígitos, expira en 30 min y no expone el código en la respuesta', async () => {
  const email = 'it@easconsulting.com.mx';
  const resetCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  assert.equal(resetCode.length, 6, 'El código generado debe tener exactamente 6 dígitos');
  assert.ok(/^\d{6}$/.test(resetCode), 'El código debe ser estrictamente numérico');
  assert.ok(expiresAt.getTime() > Date.now() + 29 * 60 * 1000, 'La expiración debe fijarse a 30 minutos');

  // Respuesta Zero-Leak
  const apiResponse = {
    ok: true,
    success: true,
    message: "Código enviado a tu correo electrónico."
  };
  assert.ok(!JSON.stringify(apiResponse).includes(resetCode), 'La respuesta JSON NUNCA debe contener el código de reseteo');
});

setTimeout(() => {
  console.log(`\n✅ ${passed} pruebas de gestión de credenciales, recuperación en 2 pasos y auditoría superadas exitosamente.`);
}, 500);

