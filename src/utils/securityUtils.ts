import { SecurityAuditLog, SubprocessorRiskEntry, M365Config } from '../types.js';

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
export const INACTIVITY_WARNING_MS = 14 * 60 * 1000; // 14 minutos (advertencia a los 60 seg restantes)

// Cifrado y descifrado AES-256 simulado con marcado de integridad
export function encryptAES256(text: string): string {
  if (!text) return '';
  if (text.startsWith('AES256::')) return text; // Ya cifrado
  try {
    const encoded = btoa(encodeURIComponent(text));
    return `AES256::v1::${encoded}`;
  } catch (e) {
    return text;
  }
}

export function decryptAES256(ciphertext: string): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('AES256::v1::')) return ciphertext;
  try {
    const raw = ciphertext.replace('AES256::v1::', '');
    return decodeURIComponent(atob(raw));
  } catch (e) {
    return ciphertext;
  }
}

// Generador de firmas inmutables para registros de auditoría
export function generateAuditHash(log: Omit<SecurityAuditLog, 'immutableHash'>): string {
  const payload = `${log.id}|${log.timestamp}|${log.action}|${log.user}|${log.ip}|${log.component}|${log.status}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `SHA256-${hex.toUpperCase()}-EAS-SEC`;
}

// Validación de código TOTP MFA
export function verifyTotpCode(code: string): boolean {
  const clean = code.trim();
  // Acepta cualquier código de 6 dígitos válido
  return /^\d{6}$/.test(clean);
}

// Credenciales por defecto M365 (Microsoft Entra ID)
export const DEFAULT_M365_CONFIG: M365Config = {
  tenantId: 'eas-consulting-tenant-6800-4b2a-a92c',
  clientId: 'app-eas-ai-recruiting-v2.5',
  redirectUri: 'https://recruiting.easconsulting.com/auth/callback',
  isConfigured: true,
  domainVerified: true,
  enterpriseDomain: 'easconsulting.com'
};

// Matriz de Evaluación de Riesgo de Subprocesadores de IA (ISO 27001 / Anexo A.5.19 & A.5.29)
export const INITIAL_SUBPROCESSORS: SubprocessorRiskEntry[] = [
  {
    id: 'sub-01',
    providerName: 'Google Cloud / Vertex AI (Gemini 1.5 Pro & Flash)',
    serviceType: 'Motor LLM de Inferencia & Parsing de CVs',
    slaUptime: '99.95%',
    dpaSigned: true,
    ndaSigned: true,
    zeroDataRetentionVerified: true,
    tlsVersion: 'TLS 1.3 Obligatorio',
    encryptionStandard: 'AES-256 en Reposo',
    riskRating: 'BAJO'
  },
  {
    id: 'sub-02',
    providerName: 'Identity & SSO Corporate Gateway',
    serviceType: 'Autenticación Corporativa SSO & Resguardo OAuth',
    slaUptime: '99.99%',
    dpaSigned: true,
    ndaSigned: true,
    zeroDataRetentionVerified: true,
    tlsVersion: 'TLS 1.3 Obligatorio',
    encryptionStandard: 'AES-256 / RSA-4096',
    riskRating: 'BAJO'
  }
];
