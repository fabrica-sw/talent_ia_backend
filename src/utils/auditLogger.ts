import { authFetch } from '../api.js';
import { SecurityAuditLog } from '../types.js';
import { generateAuditHash } from './securityUtils.js';
import { INITIAL_AUDIT_LOGS } from '../data/samples.js';

export async function fetchAuditLogs(): Promise<SecurityAuditLog[]> {
  try {
    const res = await authFetch('/api/audit-logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        const enriched = data.logs.map((l: any) => ({
          ...l,
          immutableHash: l.immutableHash || generateAuditHash(l)
        }));
        localStorage.setItem('eas_audit_logs', JSON.stringify(enriched));
        return enriched;
      }
    }
  } catch (err) {
    console.warn('[AuditLogger] Could not fetch audit logs from backend, using local fallback:', err);
  }

  const saved = localStorage.getItem('eas_audit_logs');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (_) {}
  }

  const initial = INITIAL_AUDIT_LOGS.map(l => ({
    ...l,
    immutableHash: generateAuditHash(l)
  }));
  localStorage.setItem('eas_audit_logs', JSON.stringify(initial));
  return initial;
}

export async function recordAuditLog(
  action: string,
  component: 'Autenticación' | 'Vacantes' | 'Candidatos' | 'Usuarios' | 'Gobernanza' | 'Sistema',
  status: 'SUCCESS' | 'WARNING' | 'ALERT' = 'SUCCESS',
  details: string = '',
  customUser?: string
): Promise<SecurityAuditLog> {
  const user = customUser || localStorage.getItem('eas_user_email') || 'usuario.sistema@easconsulting.com.mx';
  
  const rawLog: Omit<SecurityAuditLog, 'immutableHash'> = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    action,
    user,
    ip: '192.168.10.101',
    component,
    status,
    details
  };

  const newLog: SecurityAuditLog = {
    ...rawLog,
    immutableHash: generateAuditHash(rawLog)
  };

  // Local storage save
  try {
    const saved = localStorage.getItem('eas_audit_logs');
    const logs: SecurityAuditLog[] = saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    const updated = [newLog, ...logs.slice(0, 299)];
    localStorage.setItem('eas_audit_logs', JSON.stringify(updated));
  } catch (e) {
    console.warn('[AuditLogger] Error writing to localStorage:', e);
  }

  // Backend DB API sync
  try {
    await authFetch('/api/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user
      },
      body: JSON.stringify(newLog)
    }).catch(() => null);
  } catch (_) {}

  return newLog;
}
