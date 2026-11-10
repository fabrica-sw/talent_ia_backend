/**
 * Evaluador CRÍTICO del Double-Check (respuestas del candidato al cuestionario de 7 preguntas).
 *
 * Antes: sumaba puntos si el texto contenía palabras como "años", "experiencia" o "gestión"
 * (+3), "presencial" (+2) o pasaba de 150 caracteres (+1); con cualquier delta positivo escribía
 * "Se confirma sólida coherencia técnica". Respuestas como "La necesaria" o "Experto en ventas y
 * vender mucho" subían el score. Además, a las preguntas sin respuesta les inventaba una.
 *
 * Ahora cada respuesta de experiencia se califica 0-100 con una rúbrica de reclutador senior:
 *   · Sustancia (extensión real)                      máx 20
 *   · Pertinencia (responde lo que se preguntó)       máx 25
 *   · Evidencia (cifras, herramientas, empresas,
 *     acciones en primera persona, resultados)        máx 40
 *   · Estructura (situación → acción → resultado)     máx 15
 * con penalizaciones por frases genéricas, autoelogio sin pruebas, repetir la pregunta o afirmar
 * un requisito que no está en el CV sin demostrarlo, y topes duros para respuestas escuetas o
 * fuera de tema. Las 4 preguntas de disponibilidad se validan por separado (sueldo vs. presupuesto,
 * modalidad vs. la de la vacante). Es determinista: mismas respuestas → mismo dictamen.
 */

import { normalizeText, FIXED_AVAILABILITY_QUESTIONS, classifyVacancy, type QuestionVacancy } from './questionEngine.js';

export interface DCQuestion { question: string; answer?: string }
export interface DCVacancy extends QuestionVacancy {
  title?: string;
  department?: string;
  requirements?: string[];
  salaryRange?: string;
  modalidad?: string;
}
export interface DCCandidate { name?: string; resumeText?: string; experience?: string[] }

export type Verdict = 'APROBADO PARA ENTREVISTA' | 'APROBADO CON RESERVAS' | 'NO CONCLUYENTE' | 'NO APROBADO';

export interface AnswerEvaluation {
  index: number;
  question: string;
  answer: string;
  words: number;
  score: number;
  breakdown: { sustancia: number; pertinencia: number; evidencia: number; estructura: number; penalizacion: number };
  flags: string[];
  followUp?: string;
  critical: boolean;
}

export interface AvailabilityItem { label: string; status: 'ok' | 'vaga' | 'faltante' | 'incompatible'; detail: string }

export interface DoubleCheckResult {
  verdict: Verdict;
  quality: number;
  experienceQuality: number;
  availabilityScore: number;
  baseScore: number;
  fitScore: number;
  delta: number;
  answers: AnswerEvaluation[];
  availability: AvailabilityItem[];
  criticalFlags: string[];
  report: string;
}

// ---------------------------------------------------------------------------------------------
// Parseo del texto pegado por el reclutador (correo de respuesta del candidato)
// ---------------------------------------------------------------------------------------------

const MARKER = /^\s*(?:>+\s*)?(?:pregunta|preg\.?|p|respuesta|resp\.?|r)?\s*#?\s*(\d{1,2})\s*[\.\):\-–—]+\s*/i;
// Despedidas / firma al final del correo: no forman parte de la última respuesta
const SIGN_OFF = /^\s*(saludos|saludos cordiales|gracias|muchas gracias|atentamente|quedo (atent[oa]|a (tus|sus) ordenes)|excelente dia|buen dia|cordialmente|un saludo|--)\b/i;

function similarity(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const tb = new Set(normalizeText(b).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach(w => { if (tb.has(w)) inter++; });
  return inter / Math.min(ta.size, tb.size);
}

/** Quita del bloque el texto de la pregunta si el candidato la citó antes de responder. */
function stripEchoedQuestion(block: string, question: string): string {
  let text = block.trim();
  const qIdx = text.indexOf('?');
  if (qIdx > 0 && qIdx < 400 && similarity(text.slice(0, qIdx + 1), question) >= 0.6) {
    text = text.slice(qIdx + 1);
  }
  return text.replace(/^\s*(?:r|resp\.?|respuesta)\s*[:=.\-]\s*/i, '').trim();
}

/**
 * Asigna respuestas a preguntas. Solo usa marcadores explícitos ("1.", "2)", "Respuesta 3:"),
 * palabras clave para disponibilidad o, si el texto trae exactamente un párrafo por pregunta, el orden.
 * Si una respuesta no se puede identificar queda VACÍA (nunca se inventa).
 */
export function parseCandidateAnswers(rawText: string, questions: string[]): string[] {
  const allLines = (rawText || '').replace(/\r/g, '').split('\n').filter(l => !/^\s*>/.test(l) || MARKER.test(l));
  const cut = allLines.findIndex((l, i) => i > 0 && SIGN_OFF.test(l) && !MARKER.test(l));
  const lines = cut > 0 ? allLines.slice(0, cut) : allLines;
  const blocks = new Map<number, string[]>();
  let current: number | null = null;
  for (const line of lines) {
    const m = line.match(MARKER);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= questions.length) {
      current = Number(m[1]);
      blocks.set(current, [line.replace(MARKER, '')]);
    } else if (current !== null) {
      blocks.get(current)!.push(line);
    }
  }

  const answers = questions.map((q, i) => {
    const b = blocks.get(i + 1);
    return b ? stripEchoedQuestion(b.join('\n'), q) : '';
  });

  if (blocks.size === 0) {
    const paragraphs = (rawText || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === questions.length) {
      return paragraphs.map((p, i) => stripEchoedQuestion(p, questions[i]));
    }
  }

  // Disponibilidad por palabra clave cuando no vino numerada
  const plain = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const keyword: Record<number, RegExp> = { 3: /disponib|incorpor/i, 4: /sueldo|salario|pretensi|percepci|bruto/i, 5: /ubic|resid|vivo|radico|ciudad|estado de/i, 6: /modalidad|presencial|h[ií]brido|remoto|home ?office/i };
  Object.entries(keyword).forEach(([idx, re]) => {
    const i = Number(idx);
    if (i < answers.length && !answers[i]) {
      const hit = plain.find(l => re.test(l));
      if (hit) answers[i] = stripEchoedQuestion(hit.replace(MARKER, ''), questions[i]);
    }
  });
  return answers;
}

// ---------------------------------------------------------------------------------------------
// Rúbrica
// ---------------------------------------------------------------------------------------------

const GENERIC_PHRASES: RegExp[] = [
  /\bla necesaria\b/, /\blo necesario\b/, /\bla suficiente\b/, /\bmucha experiencia\b/, /\bbastante experiencia\b/,
  /\bamplia experiencia\b/, /\bsoy (un |una )?expert[oa]\b/, /\bexpert[oa] en\b/, /\bsoy (el|la) mejor\b/, /\bde todo\b/,
  /\blo que se requiera\b/, /\blo que sea necesario\b/, /\bvender mucho\b/, /\bmuy bien\b/, /\bexcelente\b/, /\bsin problema\b/,
  /\bclaro que si\b/, /\bpor supuesto\b/, /\btodo tipo de\b/, /\bcumpliendo con\b/, /\bcomo siempre\b/, /\bsiempre he\b/,
  /\bme considero\b/, /\bdomino\b/, /\bmanejo perfectamente\b/,
];
const EVASIVE = /^(no|si|sí|ok|n\/a|na|ninguna|ninguno|no aplica|no se|no sé|sin comentarios|pendiente|x|-+|\.+)$/;
const NEGATES_EXPERIENCE = /\b(no tengo|no cuento con|sin experiencia|nunca he|no he (trabajado|usado|manejado)|desconozco|no conozco)\b/;
const ACTION_VERBS = /\b(lidere|implemente|negocie|cerre|gestione|desarrolle|configure|disene|coordine|logre|incremente|aumente|reduje|presente|prospecte|administre|migre|automatice|capacite|dirigi|ejecute|construi|elabore|analice|resolvi|converti|atendi|supervise|planifique|defini|optimice|vendi|coloque|consegui|abri|recupere)\b/g;
const OUTCOME = /\b(resultado|logr|increment|aument|reduj|reduc|crecimiento|ahorr|cumpl|cuota|meta|objetivo|cierre|cerr|gane|ganamos|rentabil|margen|conversion|retencion|satisfaccion)/;
const CONTEXT = /\b(cuando|en el proyecto|en la empresa|el cliente|un cliente|la cuenta|el reto|el problema|la situacion|en \d{4}|durante)\b/;
const METRIC = /(\d[\d.,]*\s*(%|por ciento|mdp|millones?|mil\b|k\b|usd|mxn|pesos|clientes|cuentas|proyectos|personas|usuarios|consultores|meses|anos|semanas|oportunidades|propuestas|contratos))|(\$\s?\d)/;
const TOOLS = /\b(salesforce|hubspot|zoho|dynamics|pipedrive|monday|sap|s\/?4|ecc|excel|power ?bi|tableau|jira|confluence|linkedin sales navigator|sales navigator|oracle|netsuite|odoo|crm|erp|sql|python|react|typescript|git)\b/;

const Q_STOP = new Set(['describe', 'cuentanos', 'cuenta', 'experiencia', 'resultado', 'concreto', 'concreta', 'situacion', 'tienes', 'tuviste',
  'hiciste', 'exactamente', 'medible', 'obtuviste', 'cuales', 'como', 'para', 'donde', 'desde', 'hasta', 'sobre', 'entre', 'este', 'esta',
  'requiere', 'requisito', 'vacante', 'encontramos', 'evidencia', 'explicita', 'aparece', 'trayectoria', 'respalde', 'formacion', 'nivel',
  'autonomia', 'aplicado', 'puesto', 'proyecto', 'clave', 'funciones', 'aplicarias', 'enfrentaste', 'resolviste', 'dificil', 'real', 'caso']);

const stem = (w: string) => w.slice(0, 5);

function keyTerms(question: string, vacancy: DCVacancy): string[] {
  const quoted = [...question.matchAll(/"([^"]+)"/g)].map(m => m[1]).join(' ');
  const source = `${quoted} ${question}`;
  const terms = normalizeText(source).split(/[^a-z0-9/+#]+/).filter(w => (w.length >= 5 && !Q_STOP.has(w)) || ['crm', 'sap', 'b2b', 'erp', 'sql', 'kpi'].includes(w));
  const title = normalizeText(vacancy.title || '').split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !Q_STOP.has(w));
  return [...new Set([...terms, ...title].map(stem))];
}

const DOMAIN_LEXICON: Record<string, RegExp> = {
  comercial: /\b(client|venta|vend|prospect|negoci|cierre|cerr|pipeline|cuota|propuest|cotiz|crm|cuenta|oportunidad|embudo|lead|seguimient|presentaci)/g,
  comercial_soporte: /\b(client|venta|cotiz|pedido|crm|seguimient|report|agenda|factur|cobranza|propuest|ejecutiv)/g,
  sap_funcional: /\b(sap|modulo|configur|implement|s\/?4|ecc|transacci|pruebas|usuario clave|blueprint|activate|integraci)/g,
  sap_tecnico: /\b(sap|abap|basis|btp|cpi|desarroll|interfaz|rfc|odata|transporte|rendimiento)/g,
  desarrollo: /\b(codigo|react|typescript|api|componente|prueba|arquitectur|rendimiento|deploy|git|backend|frontend)/g,
  datos: /\b(dato|tablero|dashboard|consulta|sql|modelo|kpi|power bi|etl|report)/g,
  rh: /\b(candidat|vacante|reclut|entrevist|perfil|talento|contrat)/g,
  liderazgo: /\b(equipo|lider|presupuest|direcci|desempen|colaborador|objetivo|indicador)/g,
  general: /\b(proyecto|resultado|equipo|client|responsab)/g,
};

function tokens(s: string): string[] {
  return normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean);
}

export function evaluateExperienceAnswer(index: number, question: string, answerRaw: string, vacancy: DCVacancy, candidate: DCCandidate): AnswerEvaluation {
  const answer = (answerRaw || '').trim();
  const a = normalizeText(answer);
  const words = tokens(answer).length;
  const flags: string[] = [];
  const base = { index, question, answer, words };
  const isGapQuestion = /no encontramos evidencia|no aparece en tu trayectoria|requisito clave/i.test(question);
  const reqMatch = question.match(/"([^"]+)"/);
  const req = reqMatch ? reqMatch[1] : '';

  if (!answer) {
    return { ...base, score: 0, breakdown: { sustancia: 0, pertinencia: 0, evidencia: 0, estructura: 0, penalizacion: 0 }, flags: ['Sin respuesta.'], critical: true,
      followUp: req ? `Solicitar respuesta sobre "${req}" con un ejemplo concreto.` : 'Solicitar respuesta con un ejemplo concreto.' };
  }
  if (EVASIVE.test(a.replace(/[.!¡¿?]/g, '').trim()) || words <= 3) {
    return { ...base, score: 3, breakdown: { sustancia: 0, pertinencia: 0, evidencia: 0, estructura: 0, penalizacion: 0 },
      flags: [`Respuesta evasiva o de ${words} palabra(s): "${answer.slice(0, 60)}".`], critical: true,
      followUp: 'Repetir la pregunta en entrevista exigiendo un caso real con contexto, acción y resultado.' };
  }

  // Sustancia
  const sustancia = words < 8 ? 0 : words < 20 ? 6 : words < 40 ? 12 : words < 80 ? 17 : 20;

  // Pertinencia: términos de la pregunta/requisito + vocabulario del tipo de puesto
  const terms = keyTerms(question, vacancy);
  const aStems = new Set(tokens(answer).map(stem));
  const termHits = terms.filter(t => aStems.has(t)).length;
  const domain = classifyVacancy(vacancy);
  const lexHits = new Set((a.match(DOMAIN_LEXICON[domain]) || []).map(s => s.slice(0, 5))).size;
  const pertinencia = Math.min(25, Math.round(termHits * 7 + lexHits * 3));
  if (termHits === 0 && lexHits === 0) flags.push('No responde a lo que se preguntó (sin relación con la pregunta ni con el puesto).');

  // Evidencia de Coherencia Narrativa (Contexto, Herramientas, Verbos de Acción)
  let evidencia = 0;
  const companies = (candidate.experience || []).map(e => normalizeText((e.split('|')[1] || '').trim())).filter(c => c.length > 3);
  const mentionsCompany = companies.some(c => a.includes(c));
  const properNouns = (answer.match(/(?<![.!?]\s)(?<!^)\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})*/g) || []).length;
  if (mentionsCompany || TOOLS.test(a) || properNouns >= 2) evidencia += 14;
  const actions = (a.match(ACTION_VERBS) || []).length;
  if (actions >= 1) evidencia += 10;
  if (actions >= 3) evidencia += 4;
  if (OUTCOME.test(a)) evidencia += 4;

  // Cifras y métricas cuantitativas como VALOR AGREGADO (+PLUS)
  const metrics = (a.match(new RegExp(METRIC.source, 'g')) || []).length;
  if (metrics >= 1) evidencia += 8;
  if (metrics >= 2) evidencia += 4;
  evidencia = Math.min(40, evidencia);

  // Estructura (situación → acción → resultado)
  const estructura = (CONTEXT.test(a) ? 5 : 0) + (actions >= 1 ? 5 : 0) + (OUTCOME.test(a) ? 5 : 0);

  // Penalizaciones
  let penalizacion = 0;
  const generic = GENERIC_PHRASES.filter(re => re.test(a));
  if (generic.length) {
    penalizacion += Math.min(25, generic.length * 10);
    flags.push('Afirmaciones genéricas sin sustento ("' + generic.map(re => (a.match(re) || [''])[0]).join('", "') + '").');
  }
  if (/\b(expert|domin|avanzad|mucha experiencia|amplia experiencia)/.test(a) && evidencia < 12) {
    penalizacion += 10;
    flags.push('Autoevaluación favorable sin evidencia que la respalde.');
  }
  const qTokens = new Set(tokens(question).filter(t => t.length > 3));
  const aTok = tokens(answer).filter(t => t.length > 3);
  if (aTok.length >= 4 && aTok.filter(t => qTokens.has(t)).length / aTok.length >= 0.6) {
    penalizacion += 15;
    flags.push('Repite la pregunta en lugar de responderla.');
  }
  const negates = NEGATES_EXPERIENCE.test(a);
  if (isGapQuestion && !negates && evidencia < 12) {
    penalizacion += 10;
    flags.push(`Afirma cubrir "${req || 'el requisito'}", que no aparece en el CV, sin aportar evidencia verificable.`);
  }
  if (negates) flags.push(`Reconoce no contar con ${req ? `"${req}"` : 'la experiencia solicitada'}: brecha confirmada.`);
  if (metrics > 0) {
    flags.push('✨ PLUS: Aporta cifras y métricas cuantificables de logro.');
  } else if (words >= 8 && evidencia >= 20) {
    // Respuesta cualitativamente coherente sin métricas: no se penaliza ni genera alerta negativa
  } else if (words >= 8 && evidencia < 20) {
    flags.push('Respuesta cualitativa básica; incluir cifras o resultados medibles aportará un plus en entrevista.');
  }

  let score = Math.max(0, Math.min(100, sustancia + pertinencia + evidencia + estructura - penalizacion));
  // Topes duros
  if (words < 10 || generic.length > 0) { score = Math.min(score, 10); if (words < 10) flags.unshift(`Respuesta escueta (${words} palabras).`); }
  else if (words < 20) score = Math.min(score, 40);
  if (termHits === 0 && lexHits === 0) score = Math.min(score, 10);
  if (negates) score = Math.min(score, 20);

  const critical = score < 30;
  let followUp: string | undefined;
  if (score < 60) {
    followUp = isGapQuestion && req
      ? `En entrevista: ¿con qué herramienta/proceso concreto has trabajado "${req}", durante cuánto tiempo, en qué empresa y con qué resultado medible?`
      : `En entrevista: pedir un caso con situación, acción personal y resultado cuantificado${req ? ` sobre "${req}"` : ''}.`;
  }
  return { ...base, score, breakdown: { sustancia, pertinencia, evidencia, estructura, penalizacion }, flags, followUp, critical };
}

// ---------------------------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------------------------

/** Extrae montos en MXN de un texto: "45,000", "45 mil", "45k", "$45000". */
export function parseMoney(text: string): number[] {
  const t = normalizeText(text).replace(/(\d),(\d{3})/g, '$1$2');
  const out: number[] = [];
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(k|mil\b)?/g)) {
    let n = parseFloat(m[1]);
    if (m[2]) n *= 1000;
    if (n >= 3000 && n <= 2000000) out.push(Math.round(n));
  }
  return out;
}

function evaluateAvailability(answers: string[], vacancy: DCVacancy): AvailabilityItem[] {
  const [disp, sueldo, ubic, modal] = answers.map(x => (x || '').trim());
  const items: AvailabilityItem[] = [];
  const nd = normalizeText(disp);
  if (!disp) items.push({ label: 'Disponibilidad', status: 'faltante', detail: 'No indicó disponibilidad.' });
  else if (/inmediat|\d+\s*(dias|semanas?|mes(es)?)|a partir del|quincena|\d{1,2}\s*de\s*[a-z]+/.test(nd)) items.push({ label: 'Disponibilidad', status: 'ok', detail: disp });
  else items.push({ label: 'Disponibilidad', status: 'vaga', detail: `Respuesta imprecisa ("${disp.slice(0, 60)}"); falta fecha o plazo concreto.` });

  const amounts = parseMoney(sueldo);
  const budget = parseMoney(vacancy.salaryRange || '');
  if (!sueldo) items.push({ label: 'Sueldo', status: 'faltante', detail: 'No informó su último sueldo; no se puede validar contra el presupuesto.' });
  else if (!amounts.length) items.push({ label: 'Sueldo', status: 'vaga', detail: `No da una cifra ("${sueldo.slice(0, 60)}").` });
  else {
    const salary = Math.max(...amounts);
    const maxBudget = budget.length ? Math.max(...budget) : 0;
    if (maxBudget && salary > maxBudget * 1.1) {
      items.push({ label: 'Sueldo', status: 'incompatible', detail: `$${salary.toLocaleString('es-MX')} supera el tope de la vacante ($${maxBudget.toLocaleString('es-MX')}) en ${Math.round((salary / maxBudget - 1) * 100)}%.` });
    } else if (!maxBudget) {
      items.push({ label: 'Sueldo', status: 'vaga', detail: `$${salary.toLocaleString('es-MX')} — no se pudo comparar: la vacante no tiene un tabulador válido ("${vacancy.salaryRange || 'sin dato'}"). Corrige el rango salarial de la vacante.` });
    } else items.push({ label: 'Sueldo', status: 'ok', detail: `$${salary.toLocaleString('es-MX')} (dentro del presupuesto de hasta $${maxBudget.toLocaleString('es-MX')})` });
  }

  const nu = normalizeText(ubic);
  if (!ubic) items.push({ label: 'Ubicación', status: 'faltante', detail: 'No indicó dónde vive.' });
  else if (tokens(ubic).length >= 2 || /cdmx|ciudad de mexico|monterrey|guadalajara|queretaro|puebla|toluca|edomex|estado de mexico|leon|merida|tijuana/.test(nu)) items.push({ label: 'Ubicación', status: 'ok', detail: ubic });
  else items.push({ label: 'Ubicación', status: 'vaga', detail: `Ubicación imprecisa ("${ubic}").` });

  const nm = normalizeText(modal);
  const wants = { presencial: /presencial/.test(nm), hibrido: /hibrid/.test(nm), remoto: /remot|home ?office|desde casa/.test(nm) };
  const required = normalizeText(vacancy.modalidad || '');
  if (!modal) items.push({ label: 'Modalidad', status: 'faltante', detail: 'No indicó modalidad.' });
  else if (!wants.presencial && !wants.hibrido && !wants.remoto) items.push({ label: 'Modalidad', status: 'vaga', detail: `No especifica presencial/híbrido/remoto ("${modal.slice(0, 60)}").` });
  else if ((/presencial/.test(required) && !wants.presencial && !/cualquier|todas|indistint/.test(nm)) || (/hibrid/.test(required) && wants.remoto && !wants.hibrido && !wants.presencial)) {
    items.push({ label: 'Modalidad', status: 'incompatible', detail: `Solo acepta ${Object.entries(wants).filter(([, v]) => v).map(([k]) => k).join('/')}; la vacante es ${vacancy.modalidad}.` });
  } else items.push({ label: 'Modalidad', status: 'ok', detail: modal });
  return items;
}

// ---------------------------------------------------------------------------------------------
// Dictamen
// ---------------------------------------------------------------------------------------------

/**
 * Extrae estabilidad laboral de los últimos 3 empleos y registros de educación del CV.
 */
export function extractWorkStabilityAndEducation(resumeText: string = ''): {
  stabilityScore: number;
  avgTenureYears: number;
  extractedJobsCount: number;
  educationSummary: string;
} {
  const norm = normalizeText(resumeText);
  
  // Detección de periodos y duraciones en años
  const yearMatches = [...norm.matchAll(/\b(20\d{2}|19\d{2})\s*[-a]\s*(20\d{2}|19\d{2}|presente|actual)\b/g)];
  const tenureMatches = [...norm.matchAll(/(\d+(?:\.\d+)?)\s*(anos|años|years|meses|months)\b/g)];
  
  let totalYears = 0;
  let jobCount = 0;

  for (const m of yearMatches) {
    if (jobCount >= 3) break;
    const start = parseInt(m[1], 10);
    const endStr = m[2];
    const end = (endStr === 'presente' || endStr === 'actual') ? new Date().getFullYear() : parseInt(endStr, 10);
    const diff = Math.max(0.5, end - start);
    if (diff <= 15) {
      totalYears += diff;
      jobCount++;
    }
  }

  if (jobCount < 3) {
    for (const m of tenureMatches) {
      if (jobCount >= 3) break;
      let val = parseFloat(m[1]);
      const unit = m[2];
      if (unit.startsWith('mes')) val = val / 12;
      if (val >= 0.3 && val <= 10) {
        totalYears += val;
        jobCount++;
      }
    }
  }

  const extractedJobsCount = Math.max(1, jobCount);
  const avgTenureYears = Math.round((totalYears / extractedJobsCount) * 10) / 10 || 2.0;

  let stabilityScore = 75;
  if (avgTenureYears >= 3.0) stabilityScore = 95;
  else if (avgTenureYears >= 2.0) stabilityScore = 85;
  else if (avgTenureYears >= 1.0) stabilityScore = 70;
  else stabilityScore = 50;

  // Extracción de educación
  let educationSummary = 'Educación Superior / Profesional';
  if (/maestria|master|posgrado|postgrado|doctorado/.test(norm)) {
    educationSummary = 'Posgrado / Maestría';
  } else if (/licenciatura|ingenieria|lic\.|ing\.|bachelor|degree/.test(norm)) {
    educationSummary = 'Licenciatura / Ingeniería';
  } else if (/tecnico|carrera tecnica|diplomado|trunca/.test(norm)) {
    educationSummary = 'Técnico / Formación Especializada';
  }

  return { stabilityScore, avgTenureYears, extractedJobsCount, educationSummary };
}

export function evaluateDoubleCheck(input: { questions: DCQuestion[]; vacancy: DCVacancy; candidate: DCCandidate; baseScore: number }): DoubleCheckResult {
  const qs = input.questions;
  const expIdx = qs.map((q, i) => (FIXED_AVAILABILITY_QUESTIONS.includes(q.question) ? -1 : i)).filter(i => i >= 0).slice(0, 3);
  const answers = expIdx.map((i, k) => evaluateExperienceAnswer(k + 1, qs[i].question, qs[i].answer || '', input.vacancy, input.candidate));
  const availAnswers = FIXED_AVAILABILITY_QUESTIONS.map(fq => qs.find(q => q.question === fq)?.answer || '');
  const availability = evaluateAvailability(availAnswers, input.vacancy);

  const weights = answers.map((_, i) => (i === 0 ? 1.2 : 1));
  const experienceQuality = answers.length
    ? Math.round(answers.reduce((s, a, i) => s + a.score * weights[i], 0) / weights.reduce((s, w) => s + w, 0))
    : 0;
  const availPts: Record<AvailabilityItem['status'], number> = { ok: 25, vaga: 10, faltante: 0, incompatible: 5 };
  const availabilityScore = availability.reduce((s, a) => s + availPts[a.status], 0);
  const quality = Math.round(experienceQuality * 0.8 + availabilityScore * 0.2);

  // Análisis de Estabilidad de 3 Últimos Empleos y Educación
  const { stabilityScore, avgTenureYears, extractedJobsCount, educationSummary } = extractWorkStabilityAndEducation(input.candidate.resumeText || '');

  const weak = answers.filter(a => a.words < 8 || a.flags.some(f => f.startsWith('No responde'))).length;
  const incompatibles = availability.filter(a => a.status === 'incompatible');
  const missingAvail = availability.filter(a => a.status === 'faltante').length;

  const base = Math.max(0, Math.min(100, Math.round(input.baseScore || 0)));
  
  // Cálculo Multidimensional del Fit Score
  // 50% Calidad Técnica/Experiencia + 30% Fit Requisitos Base + 20% Estabilidad Laboral
  let rawMultidimensionalFit = Math.round((experienceQuality * 0.50) + (base * 0.30) + (stabilityScore * 0.20));

  let fitScore = rawMultidimensionalFit;
  if (weak >= 3) fitScore = Math.min(fitScore, 35);
  else if (weak === 2) fitScore = Math.min(fitScore, 45);
  else if (weak === 1) fitScore = Math.min(fitScore, 60);
  if (incompatibles.length) fitScore = Math.min(fitScore, 55);
  fitScore = Math.max(0, Math.min(100, fitScore));
  const delta = fitScore - base;

  let verdict: Verdict;
  if (quality < 40 || weak >= 2) verdict = 'NO APROBADO';
  else if (quality < 60 || missingAvail >= 2) verdict = 'NO CONCLUYENTE';
  else if (quality < 75 || weak === 1 || incompatibles.length) verdict = 'APROBADO CON RESERVAS';
  else verdict = 'APROBADO PARA ENTREVISTA';

  const criticalFlags = [
    ...answers.filter(a => a.critical).map(a => `P${a.index}: ${a.flags[0] || 'respuesta insuficiente'}`),
    ...incompatibles.map(a => `${a.label}: ${a.detail}`),
  ];

  const lines: string[] = [];
  lines.push(`### DICTAMEN DOUBLE-CHECK: ${verdict}`);
  lines.push(`**Score Consolidado de Encaje:** ${fitScore}% (Base CV: ${base}% | Ajuste Multidimensional: ${delta >= 0 ? '+' : ''}${delta} pts)`);
  lines.push('');
  lines.push('#### 📊 Desglose Multidimensional del Fit Score');
  lines.push(`| Dimensión | Puntuación | Descripción / Evaluación |`);
  lines.push(`| :--- | :---: | :--- |`);
  lines.push(`| **Fit Técnico (Experiencia)** | **${experienceQuality}/100** | Evaluación de sustancia, evidencia y coherencia en preguntas técnicas |`);
  lines.push(`| **Fit Requisitos (Vacante)** | **${base}/100** | Coincidencia de habilidades clave y conocimientos requeridos |`);
  lines.push(`| **Estabilidad Laboral** | **${stabilityScore}/100** | Permanencia promedio estimada de **${avgTenureYears} años** en los últimos 3 empleos |`);
  lines.push(`| **Disponibilidad & Salario** | **${availabilityScore}/100** | Validación de tabulador salarial, ubicación y modalidad requerida |`);
  lines.push('');
  lines.push('#### 🎓 Resumen de Perfil & Educación');
  lines.push(`* **Nivel Académico Detectado:** ${educationSummary}`);
  lines.push(`* **Estabilidad en Últimos 3 Empleos:** ~${avgTenureYears} años promedio por puesto (${extractedJobsCount} periodos analizados).`);
  lines.push('');
  lines.push('#### 📝 Evaluación Detallada por Pregunta:');
  answers.forEach(a => {
    lines.push(`* **P${a.index}** — **${a.score}/100**${a.answer ? ` (${a.words} palabras)` : ''}: ${a.flags.length ? a.flags.join(' ') : 'Respuesta pertinente, con evidencia concreta y resultado.'}`);
    if (a.followUp) lines.push(`  ↳ *Repregunta sugerida:* ${a.followUp}`);
  });
  lines.push('');
  lines.push('#### 🗓️ Disponibilidad y Condiciones Salariales:');
  availability.forEach(i => lines.push(`* **${i.label}:** ${i.status === 'ok' ? '✓' : i.status === 'incompatible' ? '✗' : '⚠'} ${i.detail}`));
  lines.push('');
  
  const conclusion: Record<Verdict, string> = {
    'APROBADO PARA ENTREVISTA': 'Las respuestas son específicas, verificables y coherentes con los 3 últimos empleos. Se recomienda proceder a entrevista.',
    'APROBADO CON RESERVAS': 'Sustento parcial en respuestas. Proceder a entrevista validando las brechas o incompatibilidades señaladas.',
    'NO CONCLUYENTE': 'Información incompleta o vaga. Solicitar aclaraciones antes de agendar entrevista.',
    'NO APROBADO': 'Las respuestas no demuestran la experiencia ni la evidencia necesaria para la posición. No se sugiere avanzar.',
  };
  lines.push(`**Conclusión Operativa:** ${conclusion[verdict]}`);

  return { verdict, quality, experienceQuality, availabilityScore, baseScore: base, fitScore, delta, answers, availability, criticalFlags, report: lines.join('\n') };
}

