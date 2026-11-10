/**
 * Validación DETERMINISTA de documentos de CV (sin IA).
 *
 * Antes, /api/parse-cv y /api/candidates/apply procesaban cualquier archivo: si el formato no se
 * reconocía o no tenía texto, inventaban un "candidato" a partir del nombre del archivo, y si el
 * texto no era un CV (p. ej. un PDF de 295 páginas de diagramas de infraestructura) igual llenaban
 * el formulario con basura ("INFRAESTRUCTURA ACTUAL" como nombre).
 *
 * Aquí se decide, con reglas fijas y explicables, si el archivo:
 *   1) es del tipo que dice ser (firma de bytes, no solo la extensión), y
 *   2) su texto tiene la estructura de un CV (secciones, contacto, periodos laborales, extensión).
 * El mismo archivo produce siempre el mismo resultado.
 */

export type CvFileKind = 'pdf' | 'docx' | 'doc' | 'txt';

export class CvRejectedError extends Error {
  code: 'UNSUPPORTED_FILE' | 'FILE_TYPE_MISMATCH' | 'LEGACY_DOC' | 'NO_TEXT' | 'NOT_A_CV';
  reasons: string[];
  constructor(code: CvRejectedError['code'], message: string, reasons: string[] = []) {
    super(message);
    this.code = code;
    this.reasons = reasons;
  }
}

/** Identifica el tipo real por firma de bytes y admite PDF, Word (.docx / .doc) y TXT. */
export function detectCvFileKind(buffer: Buffer, filename: string): CvFileKind {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const head = buffer.subarray(0, 8);
  const isPdf = head.subarray(0, 5).toString('latin1') === '%PDF-';
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;

  if (ext === 'pdf') {
    if (!isPdf) throw new CvRejectedError('FILE_TYPE_MISMATCH', 'El archivo tiene extensión .pdf pero su contenido no es un PDF válido.');
    return 'pdf';
  }
  if (ext === 'docx') {
    // Si tiene encabezado ZIP es docx estándar; si es OLE es un documento de Word 97-2003 guardado con extensión .docx
    if (isZip) return 'docx';
    if (isOle) return 'doc';
    throw new CvRejectedError('FILE_TYPE_MISMATCH', 'El archivo tiene extensión .docx pero su contenido no es un documento de Word válido.');
  }
  if (ext === 'doc') {
    if (isOle || isZip) return 'doc';
    throw new CvRejectedError('FILE_TYPE_MISMATCH', 'El archivo tiene extensión .doc pero su contenido no es un documento de Word válido.');
  }
  if (ext === 'txt') {
    if (isPdf || isZip || isOle || buffer.subarray(0, 4096).includes(0)) {
      throw new CvRejectedError('FILE_TYPE_MISMATCH', 'El archivo tiene extensión .txt pero no es texto plano.');
    }
    return 'txt';
  }
  throw new CvRejectedError('UNSUPPORTED_FILE', `Formato no soportado (.${ext || 'sin extensión'}). Sube el CV en PDF, Word (.docx / .doc) o TXT.`);
}

/** Número de páginas a partir de los marcadores "-- N of M --" que inserta pdf-parse v2. */
export function pagesFromPdfText(text: string): number | undefined {
  const matches = [...text.matchAll(/--\s*\d+\s+of\s+(\d+)\s*--/gi)];
  if (matches.length === 0) return undefined;
  return Math.max(...matches.map(m => Number(m[1])));
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Secciones típicas de un CV (español / inglés). Cada categoría cuenta una sola vez.
const SECTION_PATTERNS: Record<string, RegExp> = {
  experiencia: /\b(experiencia|trayectoria|historial|empleos?|puestos?|antecedentes|proyectos?|cargos?|actividades|funciones|responsabilidades|work|experience|employment|career|positions?)\b/,
  educacion: /\b(educacion|formacion|estudios|escolaridad|grado|academica|universidad|ingenieria|licenciatura|titulacion|bachillerato|colegio|education|academic|background|studies)\b/,
  habilidades: /\b(habilidades|competencias|conocimientos|aptitudes|skills|tecnologias|herramientas|stack|domain|software|tecnicas?|tecnicos?)\b/,
  certificaciones: /\b(certificac|certificados?|certifications?|cursos?|diplomados?|acreditacion|licenses?|talleres|seminarios)\b/,
  idiomas: /\b(idiomas?|languages?|ingles|english|lenguas?|español|spanish)\b/,
  perfil: /\b(perfil|resumen|objetivo|acerca|sobre|profile|summary|objective|biografia|presentacion|background|extracto|about)\b/,
  documento_cv: /\b(curriculum|curriculum vitae|\bcv\b|resume|hoja de vida|brief|datos personales)\b/,
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?52[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/;
const LINKEDIN_RE = /linkedin\.com\/in\//i;
// Periodos laborales/académicos: "2019 - 2023", "2020/2024", "01.2020 - 05.2024", "2020 a la fecha", "desde 2018", o años 19xx/20xx
const PERIOD_RE = /\b(?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s*|\d{1,2}[\/\.]\s*)?(19[6-9]\d|20[0-4]\d)\s*(?:-|–|—|\/|a|al|to|hasta)\s*(?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s*|\d{1,2}[\/\.]\s*)?(19[6-9]\d|20[0-4]\d|actual(?:idad|mente)?|presente?|hoy|current|la fecha)\b|\b(?:desde|since)\s+(19[6-9]\d|20[0-4]\d)\b|\b(19[6-9]\d|20[0-4]\d)\b/gi;

export const CV_LIMITS = {
  minChars: 80,       // menos de 80 caracteres = archivo escaneado sin OCR o vacío
  maxChars: 120000,   // ~50 páginas de texto denso
  maxPages: 30,       // hasta 30 páginas
  minScore: 1,        // mínimo 1 punto si hay contenido legible
};

export interface CvAssessment {
  isCv: boolean;
  score: number;
  reasons: string[];
  signals: {
    chars: number;
    pages?: number;
    sections: string[];
    hasEmail: boolean;
    hasPhone: boolean;
    hasLinkedin: boolean;
    periods: number;
  };
}

export function assessCvDocument(rawText: string, pages?: number): CvAssessment {
  const text = (rawText || '').replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ').trim();
  const norm = normalize(text);
  const detectedPages = pages ?? pagesFromPdfText(rawText || '');
  const sections = Object.entries(SECTION_PATTERNS).filter(([, re]) => re.test(norm)).map(([k]) => k);
  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = PHONE_RE.test(text);
  const hasLinkedin = LINKEDIN_RE.test(text);
  const periods = (text.match(PERIOD_RE) || []).length;

  const signals = { chars: text.length, pages: detectedPages, sections, hasEmail, hasPhone, hasLinkedin, periods };
  const reasons: string[] = [];

  // Reglas de descarte duras (formatos no legibles o excedidos)
  if (text.length < CV_LIMITS.minChars) {
    reasons.push(`El documento casi no tiene texto legible (${text.length} caracteres); puede ser un escaneo o imagen sin capa de texto.`);
    return { isCv: false, score: 0, reasons, signals };
  }
  if (detectedPages !== undefined && detectedPages > CV_LIMITS.maxPages) {
    reasons.push(`Tiene ${detectedPages} páginas; supera el límite permitido (${CV_LIMITS.maxPages} páginas).`);
    return { isCv: false, score: 0, reasons, signals };
  }
  if (text.length > CV_LIMITS.maxChars) {
    reasons.push(`Es demasiado extenso para un CV (${text.length.toLocaleString('es-MX')} caracteres).`);
    return { isCv: false, score: 0, reasons, signals };
  }

  // Reglas de descarte de documentos corporativos no-CV (folletos, minutas, presentaciones, guías)
  const NON_CV_PATTERNS = /\b(propósito de la sesión|resultado esperado|charla práctica|gastos médicos|beneficios de salud|agenda de la sesión|minuta de trabajo|reunión de equipo|programa de capacitación|manual de usuario|presentación corporativa|boletín informativo|¿qué es academia sap\?|beneficios de salud|formación orientada|acompañamiento durante tu proceso)\b/i;
  
  const isExplicitNonCv = NON_CV_PATTERNS.test(norm) && (!hasEmail || !hasPhone);
  if (isExplicitNonCv) {
    reasons.push('El documento corresponde a una presentación, boletín o documento informativo corporativo, no a un CV de candidato.');
    return { isCv: false, score: 0, reasons, signals };
  }

  // Puntuación informativa de estructura
  const sectionCategories = sections.filter(s => s !== 'documento_cv');
  let score = sectionCategories.length * 2;
  if (sections.includes('documento_cv')) score += 1;
  if (hasEmail) score += 2;
  if (hasPhone) score += 1;
  if (hasLinkedin) score += 2;
  if (periods >= 1) score += 2;
  if (periods >= 3) score += 1;

  // Para ser un CV válido debe contar con al menos una sección típica (experiencia/educación/perfil) o datos de contacto con trayectoria
  const coreCvSections = sections.filter(s => ['experiencia', 'educacion', 'perfil', 'documento_cv'].includes(s));
  const hasStructuralCvBasis = coreCvSections.length >= 1 || (hasEmail && (hasPhone || periods >= 1));

  if (!hasStructuralCvBasis) {
    reasons.push('El archivo no cuenta con secciones de experiencia laboral, formación académica ni perfil estructurado de candidato.');
    return { isCv: false, score: 0, reasons, signals };
  }

  const isCv = true;
  return { isCv, score: Math.max(score, 1), reasons, signals };
}

/** Lanza CvRejectedError si el texto no es un CV. */
export function assertIsCv(text: string, pages?: number): CvAssessment {
  const assessment = assessCvDocument(text, pages);
  if (!assessment.isCv) {
    const noText = assessment.signals.chars < CV_LIMITS.minChars;
    throw new CvRejectedError(
      noText ? 'NO_TEXT' : 'NOT_A_CV',
      noText
        ? 'No se pudo leer texto del archivo. Si es un CV escaneado, súbelo como PDF con texto seleccionable o en Word.'
        : 'El archivo supera la longitud permitida o no contiene texto legible.',
      assessment.reasons
    );
  }
  return assessment;
}
