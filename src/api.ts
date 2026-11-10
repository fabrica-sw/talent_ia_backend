import type {
  AIModelWeights,
  AnalyzeCandidateRequest,
  Candidate,
  CandidateStage,
  M365UserProfile,
  Vacancy,
  WeightsState
} from './types.js';

const API_HOST = (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) || (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '';
const BASE = `${API_HOST}/api`;

export function getAuthToken(): string {
  return localStorage.getItem('auth_token') || localStorage.getItem('eas_auth_token') || '';
}

/**
 * fetch() para rutas propias (/api, /auth): agrega el Bearer JWT y la API key opcional de Gemini.
 * Soporta modo desacoplado con VITE_API_BASE_URL o modo proxy relativo estándar.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const customKey = localStorage.getItem('eas_gemini_key') || '';
  if (customKey && !headers.has('x-gemini-api-key')) headers.set('x-gemini-api-key', customKey);
  const targetUrl = (input.startsWith('/') && API_HOST) ? `${API_HOST}${input}` : input;
  const res = await fetch(targetUrl, { ...init, headers });
  if (res.status === 401 && !input.includes('/auth/login') && !input.includes('/audit-logs')) {
    window.dispatchEvent(new CustomEvent('eas:auth_expired', { detail: { status: res.status } }));
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {})
  };

  // Determinar URL de petición (/auth/... vs /api/...)
  const targetUrl = path.startsWith('/auth') || path.startsWith('/api/') ? path : `${BASE}${path}`;

  const res = await authFetch(targetUrl, {
    ...init,
    headers
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // 401 ya dispara 'eas:auth_expired' en authFetch (App cierra la sesión). 403 = sin permiso para esa acción.

    const message = (body as { error?: string; message?: string; detail?: string }).message ||
                    (body as { error?: string; message?: string; detail?: string }).error ||
                    `Error ${res.status}`;
    const detail = (body as { detail?: string }).detail;
    throw new Error(detail ? `${message} — ${detail}` : message);
  }
  return body as T;
}

export const api = {
  getVacancies: () => request<{ vacancies: Vacancy[] }>('/vacancies'),
  getCandidates: () => request<{ candidates: Candidate[] }>('/candidates'),
  createVacancy: (payload: Partial<Vacancy>) =>
    request<{ vacancy: Vacancy }>('/vacancies', { method: 'POST', body: JSON.stringify(payload) }),
  updateVacancy: (id: string, payload: Partial<Vacancy>) =>
    request<{ vacancy: Vacancy }>(`/vacancies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  parseCv: async (formData: FormData) => {
    const res = await authFetch('/api/parse-cv', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || errJson.message || `Error al procesar archivo CV (${res.status})`);
    }
    return res.json();
  },
  analyzeCandidate: (payload: AnalyzeCandidateRequest) =>
    request<{ candidate: Candidate }>('/analyze-candidate', { method: 'POST', body: JSON.stringify(payload) }),
  // Evaluación crítica del Double-Check en el servidor (rúbrica determinista; la IA solo puede endurecerla).
  submitScreening: (payload: {
    candidate?: any;
    name: string;
    email?: string;
    phone?: string;
    role: string;
    resumeText: string;
    vacancy?: any;
    questions?: string[];
    answers?: { question: string; answer: string }[];
    rawText?: string;
    comments?: string;
  }) =>
    request<{
      verdict: string;
      quality: number;
      fitScore: number;
      baseScore: number;
      competencies: Record<string, number>;
      summary: string;
      strengths: string[];
      growths: string[];
      doubleCheckReport: string;
      interviewSpeech: string;
      suggestedTime: string;
      screeningQuestions: { id: number; question: string; answer?: string }[];
      evaluation: { answers: any[]; availability: any[] };
    }>('/candidates/submit-screening', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  setCandidateStage: (id: string, stage: CandidateStage | 'Pool', vacancyId?: string) =>
    request<{ candidate: Candidate }>(`/candidates/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, vacancyId })
    }),
  scheduleCandidate: (id: string, suggestedTime: string) =>
    request<{ candidate: Candidate }>(`/candidates/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ suggestedTime })
    }),

  getWeights: () => request<WeightsState>('/ai-weights'),
  submitFeedback: (candidateId: string, outcome?: string, feedbackComments?: string, comments?: string, competencies?: any, dimension?: string) =>
    request<{ success: boolean; candidate?: Candidate; newScore?: number; boostApplied?: number; message?: string }>('/submit-feedback', {
      method: 'POST',
      body: JSON.stringify({ candidateId, outcome, feedbackComments: feedbackComments || comments, comments: comments || feedbackComments, competencies, dimension })
    }),

  createCandidate: (candidate: Candidate) =>
    request<{ candidate: Candidate }>('/candidates', {
      method: 'POST',
      body: JSON.stringify(candidate)
    }),
  updateCandidate: (id: string, payload: Partial<Candidate> & { forceRegenerate?: boolean }) =>
    request<{ candidate: Candidate; success?: boolean }>(`/candidates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteCandidate: (id: string) =>
    request<{ success: boolean }>(`/candidates/${id}`, {
      method: 'DELETE'
    }),
  deleteVacancy: (id: string) =>
    request<{ success: boolean }>(`/vacancies/${id}`, {
      method: 'DELETE'
    }),
  clearDatabase: () =>
    request<{ success: boolean }>('/admin/clear-database', {
      method: 'POST'
    }),
  authenticateM365: (profile: Partial<M365UserProfile>) =>
    request<{ success: boolean; user: M365UserProfile }>('/auth/m365', {
      method: 'POST',
      body: JSON.stringify(profile)
    }),

  // Sin "fallback": antes, si el servidor fallaba, el front fabricaba una sesión ADMIN local
  // para cualquier correo @easconsulting.com.mx.
  login: (email: string, password: string) =>
    request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  getPublicVacancies: () => request<{ vacancies: Vacancy[] }>('/public/vacancies'),
  submitPublicApplication: (payload: Record<string, unknown>) =>
    request<{ success: boolean; id: string }>('/public/applications', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ success: boolean; message: string; primer_login: boolean }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password })
    }),

  getProfile: () =>
    request<{ success: boolean; user: any }>('/auth/me'),

  adminUsers: (action: 'create' | 'update' | 'toggle_active' | 'reset_password' | 'list', payload?: Record<string, any>) =>
    request<{ success: boolean; users?: any[]; user?: any; message?: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ action, ...(payload || {}) })
    })
};

