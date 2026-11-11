export interface FitBreakdown {
  technical: number;
  culture: number;
  salary: number;
  english: number;
  experience: number;
}

export interface EvaluationNote {
  id: string;
  timestamp: string;
  author: string;
  dimension: string;
  outcome: 'Hired' | 'Rejected' | 'Note';
  delta: number;
  comment: string;
  reverted?: boolean;
}

export interface FitScoreRequirementAudit {
  req: string;
  source: 'experience' | 'certifications' | 'education' | 'resume';
}

export interface FitScoreBreakdown {
  cvBaseScore: number;
  doubleCheckDelta: number;
  manualFeedbackDelta: number;
  finalScore: number;
  matchedRequirements: FitScoreRequirementAudit[];
  missingRequirements: string[];
  domainAffinityScore?: number;
  seniorityScore?: number;
  reqsScore?: number;
  englishScore?: number;
  hasDomainMismatch?: boolean;
  mismatchReason?: string;
  recalculatedAt?: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  resumeText?: string;
  stage: string; // e.g. 'application' | 'screening' | 'test' | 'interview' | 'manager_review' | 'hired' | 'rejected'
  competencies: Record<string, number>; // key: competency name, value: score 1-100
  fitScore: number; // scale 1-100
  fitBreakdown?: FitBreakdown;
  summary: string;
  strengths: string[];
  growths: string[];
  recommendedQuestions?: string[];
  suggestedTime?: string; // e.g. "Lunes por la tarde" or YYYY-MM-DD
  channel: 'LinkedIn' | 'OCC' | 'Redes Sociales' | 'Glassdoor' | 'Referido' | 'Referidos' | 'EAS Consulting DB' | 'EAS DB' | 'Otros';
  createdAt?: string;
  isEncrypted?: boolean;
  vacancyId?: string | null; // Assigned vacancy ID
  role?: string; // Target vacancy or role title
  department?: string; // Target department / area
  screeningQuestions?: { id: number; question: string; answer?: string }[];
  doubleCheckReport?: string | null;
  interviewSpeech?: string | null;
  initialFitScore?: number;
  englishLevel?: 'Básico' | 'Medio' | 'Intermedio' | 'Avanzado';
  expectedSalary?: number;
  experience?: string[];
  education?: string[];
  certifications?: string[];
  tags?: string[];
  isStarred?: boolean;
  lastContactedAt?: string;
  history?: {
    timestamp: string;
    stage: string;
    user: string;
  }[];
  comments?: string;
  detectedGuidanceLevel?: string;
  guidanceAlert?: boolean;
  guidanceGapDetails?: string;
  cvBaseScore?: number;
  doubleCheckDelta?: number;
  manualFeedbackDelta?: number;
  fitScoreBreakdown?: FitScoreBreakdown;
  evaluationNotes?: EvaluationNote[];
}


export interface VacancyProfileWeight {
  profileName: string;
  weightPercent: number;
  profile: string;
  weight: number;
  roleType: 'Principal' | 'Secundario' | 'Complementario';
  focusAreas: string[];
}

export interface Vacancy {
  id: string;
  title: string;
  department: string;
  area?: string;
  location: string;
  description: string;
  requirements: string[]; // key skills/experience keywords
  experienceYears: number;
  salaryRange?: string;
  status: 'Activa' | 'StandBy' | 'Baja' | 'Cubierta' | 'Open' | 'Closed';
  minCompetenciesRequired: Record<string, number>;
  englishLevel?: 'Básico' | 'Medio' | 'Intermedio' | 'Avanzado';
  modalidad?: 'Presencial' | 'Remoto' | 'Híbrido';
  targetDate?: string;
  requiredGuidanceLevel?: string;
  softSkills?: string[]; // Soft skills tropicalizadas por nivel de puesto
  interpretedProfiles?: VacancyProfileWeight[]; // Perfiles interpretados por IA y su peso porcentual
}

export interface InterviewSlot {
  id: string;
  candidateId: string;
  candidateName: string;
  interviewer: string;
  interviewerRole: string;
  interviewType?: 'Capital Humano' | 'Técnica/Líder' | 'Cliente' | 'Psicométrica';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // in minutes
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  meetingLink: string;
  notes?: string;
  scorecard: {
    rating: number; // 1 to 5
    recommendation: 'hired' | 'review' | 'rejected';
    feedback: string;
    evaluatedCompetencies: Record<string, number>;
  } | null;
}

export interface WorkflowStage {
  id: string;
  title: string;
  description: string;
  color: string; // Tailwind bg-color or border-color class
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  ip: string;
  component: string;
  status: 'SUCCESS' | 'WARNING' | 'ALERT';
  immutableHash?: string;
  details?: string;
}

export interface M365Config {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  isConfigured: boolean;
  domainVerified: boolean;
  enterpriseDomain: string;
}

export interface MfaState {
  isEnabled: boolean;
  isVerified: boolean;
  method: 'AUTHENTICATOR_TOTP' | 'M365_SSO_MFA';
  verifiedAt?: string;
  secretKey?: string;
}

export interface InactivitySessionState {
  lastActivityTimestamp: number;
  isWarningShown: boolean;
  timeoutMinutes: number;
  warningSecondsRemaining: number;
}

export interface SubprocessorRiskEntry {
  id: string;
  providerName: string;
  serviceType: string;
  slaUptime: string;
  dpaSigned: boolean;
  ndaSigned: boolean;
  zeroDataRetentionVerified: boolean;
  tlsVersion: string;
  encryptionStandard: string;
  riskRating: 'BAJO' | 'MEDIO' | 'ALTO';
}

export interface TalentInsightsSummary {
  totalTalentPool: number;
  activeCandidates: number;
  averageTimeToHire: number;
  topSourcingChannel: string;
  overallConversionRate: number;
  skillsDistribution: { name: string; candidateCount: number; avgScore: number }[];
  funnelStages: { stageName: string; count: number; percentage: number }[];
}

export interface RecruitmentMetric {
  date: string; // YYYY-MM
  timeToHire: number; // average days
  conversionRate: number; // percentage
  activeOpenings: number;
  hiredCount: number;
  sourceBreakdown: {
    linkedIn: number;
    glassdoor: number;
    referrals: number;
    easDb: number;
    others: number;
  };
}

export type UserRole = 'ADMIN' | 'RECRUITER' | 'MANAGER';

export interface AIModelWeights {
  Liderazgo: number;
  Comunicacion: number;
  TrabajoEnEquipo: number;
  HabilidadesTecnicas: number;
  ResolucionDeProblemas: number;
  totalFeedbackCount: number;
}

export type CandidateStage = 'CV\'s' | 'Candidatos' | 'Filtrado' | 'Entrevista Capital Humano' | 'Entrevista Líder' | 'Entrevista Cliente' | 'Pruebas Psicométricas' | 'Oferta' | 'Contratado' | 'Rechazado';

export type EnglishLevel = 'Básico' | 'Medio' | 'Intermedio' | 'Avanzado';

export type CompetencyMap = Record<string, number>;

export interface AnalyzeCandidateRequest {
  name: string;
  email: string;
  phone: string;
  channel: string;
  vacancyId: string;
  resumeText: string;
  expectedSalary: number;
  englishLevel: string;
}

export interface WeightsState {
  weights: AIModelWeights;
  entry: unknown;
}

export interface M365UserProfile {
  name: string;
  email: string;
  area: string;
  role: UserRole;
  domainVerified: boolean;
}

