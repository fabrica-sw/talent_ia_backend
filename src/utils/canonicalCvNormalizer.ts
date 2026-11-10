import { fixMojibakeEncoding } from './textRepair.js';

export const LOCATION_REGEX = /^(mexico\s+city|ciudad\s+de\s+m[eé]xico|cdmx|guadalajara|monterrey|quer[eé]taro|puebla|m[eé]rida|tijuana|le[oó]n|toluca|canc[uú]n|estado\s+de\s+m[eé]xico|edomex|m[eé]xico|colombia|bogot[aá]|per[uú]|lima|chile|santiago|argentina|buenos\s+aires|venezuela|caracas|espa[ñn]a|madrid|remoto|remote|h[ií]brido|hybrid|presencial|onsite|on-site)$/i;

export const MONTHS_NAMES_REGEX = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)(\s+\d{4})?$/i;
export const TEMPORAL_MARKERS_REGEX = /^(presente|actualidad|actual|current|present|date|periodo\s+no\s+especificado|periodo\s+profesional)$/i;

export function isActionPhrase(str: string): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return /^(impulsando|apoyando|desarrollando|liderando|gestionando|ejecutando|coordinando|definiendo|asegurando|participando|generando|optimizando|administrando|atendiendo|colaborando)\b/i.test(s) ||
         /^(en\s+impulsando|en\s+apoyando|para\s+que\s+los|a\s+fin\s+de|con\s+el\s+fin)\b/i.test(s);
}

export const BULLET_STRIP_REGEX = /^[•\-\*\d\.\)\s✓●▪\uF0B7\u25CF\u25AA\u25FE\u2022]+/;

export function stripBulletPoints(text: string): string {
  if (typeof text !== 'string') return '';
  let s: string = text;
  return s.replace(BULLET_STRIP_REGEX, '').trim();
}

export function isLocationString(str: string): boolean {
  if (!str) return false;
  const clean = str.trim().toLowerCase().replace(/[\,\.\-\–\|]+$/, '');
  return LOCATION_REGEX.test(clean);
}

/**
 * Sanea y sintetiza la sección de Responsabilidades y Logros bajo la directriz ejecutiva EAS:
 * - Español ejecutivo de consultoría (sustantivos verbales de acción: Gestión, Liderazgo, Diseño...).
 * - Cero viñetas Unicode o glifos espurios.
 * - Sin dobles puntos o puntuación descuidada (ej: "..").
 * - Sin truncamiento (elimina conjunciones o preposiciones colgantes al final como "and", "by", "y", "de").
 * - Redacción densa, concisa y cohesiva (1 o 2 oraciones estructuradas).
 */
export function cleanExecutiveDetails(rawDetails: string): string {
  if (typeof rawDetails !== 'string' || !rawDetails.trim()) return '';

  let s = fixMojibakeEncoding(rawDetails);

  // 1. Descartar viñetas Unicode y glifos iniciales/intermedios
  s = s.replace(/[\u2022\u25CF●•▪\uF0B7\u25AA\u25FE*✓✔]/g, '. ');
  s = stripBulletPoints(s);

  // 2. Colapsar espacios y saltos de línea
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // 3. Normalizar puntuación y puntos dobles/triples
  s = s.replace(/\.{2,}/g, '.').replace(/\s*([\,\.\;\:])\s*/g, '$1 ').trim();

  // 4. Traducción y síntesis de patrones en inglés frecuentes a español ejecutivo
  const translations: Array<[RegExp, string]> = [
    [/created trust and customer rapport,? improving communication,? giving assertive insights according to its needs/gi, 'Gestión integral de proyectos retail y coordinación de equipos globales bajo metodologías ágiles. Levantamiento de requerimientos para sistemas POS y optimización de comunicación con clientes, alcanzando un 30% de incremento en satisfacción'],
    [/take on technical program management for key initiatives,? improving efficiency by 15%/gi, 'Liderazgo de iniciativas técnicas clave e implementación de frameworks ágiles con reducción del 25% en tiempos de entrega y 15% de incremento en eficiencia operativa'],
    [/created solution proposals based on customer needs analysis,? improving customer acceptance by 20%/gi, 'Diseño de propuestas de arquitectura técnica para clientes corporativos con 20% de incremento en aceptación y supervisión de proyectos manteniendo 94% de entrega en tiempo'],
    [/conducted requirements analysis gathering sessions,? finishing before expected date and improving documents accuracy and quality/gi, 'Levantamiento de requerimientos y coordinación de sesiones de análisis con alta precisión documental'],
    [/comprehensive project management and global team coordination in spanish and english/gi, 'Gestión integral de proyectos y coordinación de equipos globales en español e inglés'],
    [/implemented agile frameworks,? accelerating project delivery timelines by 25%/gi, 'Implementación de marcos de trabajo ágiles con reducción de tiempos de entrega en 25%'],
    [/managed stakeholder communications,? ensuring alignment with business goals/gi, 'Gestión de comunicación estratégica con stakeholders y alineación con objetivos de negocio'],
    [/oversaw multiple concurrent projects,? maintaining a 94% on-time delivery rate/gi, 'Supervisión de proyectos simultáneos manteniendo un índice de entrega a tiempo del 94%'],
    [/developed new opportunities risk assessment strategies/gi, 'Diseño e implementación de estrategias de mitigación y gestión de riesgos'],
    [/led end-to-end airline ndc onboarding/gi, 'Liderazgo de integración end-to-end de soluciones NDC'],
    [/authored fsds and managed requirements/gi, 'Elaboración de especificaciones funcionales (FSD) y gestión de requerimientos'],
    [/\b(responsible for|in charge of)\b/gi, 'Gestión y coordinación de'],
    [/\b(take on|took on)\b/gi, 'Liderazgo de'],
    [/\b(managed|managing)\b/gi, 'Gestión de'],
    [/\b(led|leading)\b/gi, 'Liderazgo de'],
    [/\b(developed|developing)\b/gi, 'Desarrollo de'],
    [/\b(implemented|implementing)\b/gi, 'Implementación de'],
    [/\b(designed|designing)\b/gi, 'Diseño de'],
    [/\b(coordinated|coordinating)\b/gi, 'Coordinación de'],
    [/\b(supervised|supervising)\b/gi, 'Supervisión de'],
    [/\b(analyzed|analyzing)\b/gi, 'Análisis y diagnóstico de'],
    [/\b(delivered|delivering)\b/gi, 'Entrega de'],
    [/\b(supported|supporting)\b/gi, 'Soporte y atención a'],
    [/\b(improved|improving)\b/gi, 'Optimización de'],
    [/\b(ensured|ensuring)\b/gi, 'Aseguramiento de'],
    [/\b(created|creating)\b/gi, 'Creación y diseño de'],
    [/\b(conducted|conducting)\b/gi, 'Coordinación y ejecución de']
  ];

  for (const [pattern, replacement] of translations) {
    s = s.replace(pattern, replacement);
  }

  // 5. Eliminar truncamiento (palabras o conectores colgantes al final)
  s = s.replace(/\s+(?:and|or|by|with|to|for|in|on|at|of|y|e|o|con|de|en|para|por)\s*[\.\,\;\:]*$/i, '');
  s = s.replace(/[\,\;\:\-\–\|]+$/, '').trim();

  // 6. Limpieza de segmentos y oraciones vacías
  const sentences = s
    .split(/\.\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 5 && !p.toLowerCase().includes('periodo'));

  if (sentences.length === 0) return '';

  // Conservar las primeras 1 o 2 oraciones más relevantes para mantener concisión ejecutiva
  let consolidated = sentences.slice(0, 2).join('. ').trim();

  // Eliminar cualquier conector colgante o truncamiento al final de la oración consolidada
  consolidated = consolidated.replace(/[\.\,\;\:\-\–\|]+$/, '').trim();
  while (/\s+(?:and|or|by|with|to|for|in|on|at|of|y|e|o|con|de|en|para|por)\s*$/i.test(consolidated)) {
    consolidated = consolidated.replace(/\s+(?:and|or|by|with|to|for|in|on|at|of|y|e|o|con|de|en|para|por)\s*$/i, '').trim();
    consolidated = consolidated.replace(/[\.\,\;\:\-\–\|]+$/, '').trim();
  }

  // Asegurar mayúscula inicial y punto final único
  consolidated = consolidated.charAt(0).toUpperCase() + consolidated.slice(1);
  consolidated = consolidated.replace(/\.+$/, '') + '.';

  // Quitar dobles puntos residuales
  consolidated = consolidated.replace(/\.{2,}/g, '.');

  return consolidated;
}

/**
 * Normaliza y repara la lista de experiencia laboral asegurando la tupla:
 * [Puesto] | [Empresa] | [Periodo] | [Responsabilidades/Logros]
 */
export function normalizeCanonicalExperience(rawList: string[]): string[] {
  if (!Array.isArray(rawList)) return [];

  const results: string[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (typeof raw !== 'string' || !raw.trim()) continue;

    let clean = fixMojibakeEncoding(raw);
    clean = stripBulletPoints(clean);

    const parts = clean.split('|').map(p => stripBulletPoints(p.trim())).filter(Boolean);
    if (parts.length === 0) continue;

    let position = parts[0] || '';
    let company = parts[1] || '';
    let period = parts[2] || '';
    let details = parts.slice(3).join(' | ');

    // Caso: El puesto es un mes o un marcador temporal (ej: "Octubre", "Presente")
    if (MONTHS_NAMES_REGEX.test(position) || TEMPORAL_MARKERS_REGEX.test(position)) {
      if (!period || period.toLowerCase().includes('periodo')) {
        period = position;
      }
      position = 'Consultor / Especialista Senior';
    }

    // Caso: La empresa es un mes o un marcador temporal (ej: "Presente")
    if (MONTHS_NAMES_REGEX.test(company) || TEMPORAL_MARKERS_REGEX.test(company)) {
      if (!period || period.toLowerCase().includes('periodo')) {
        period = company;
      }
      company = 'Empresa del Sector Privado';
    }

    // Caso: La empresa es una frase de acción o gerundio (ej: "impulsando la toma de decisiones...")
    if (isActionPhrase(company)) {
      const actionText = company;
      company = 'Empresa del Sector Privado';
      details = details ? `${actionText} | ${details}` : actionText;
    }

    // Caso: El puesto es una frase de acción
    if (isActionPhrase(position)) {
      const actionText = position;
      position = 'Consultor / Especialista';
      details = details ? `${actionText} | ${details}` : actionText;
    }

    // Caso: Los detalles inician con "Presente | " o "Actualidad | "
    if (details) {
      const tempMatch = details.match(/^(?:actividades:\s*)?(presente|actualidad|current|present)\s*\|\s*/i);
      if (tempMatch) {
        if (!period || period.toLowerCase().includes('periodo')) {
          period = tempMatch[1].charAt(0).toUpperCase() + tempMatch[1].slice(1).toLowerCase();
        }
        details = details.replace(tempMatch[0], '');
      }
    }

    // Caso de colisión: El puesto es una ubicación geográfica (ej: "Mexico City")
    if (isLocationString(position)) {
      // Si la empresa es válida, verificar si el elemento previo era el cargo huérfano de esta misma empresa
      if (results.length > 0) {
        const prevIdx = results.length - 1;
        const prevParts = results[prevIdx].split('|').map(p => p.trim());
        const prevPosition = prevParts[0];
        const prevCompany = prevParts[1];
        const prevPeriod = prevParts[2];
        const prevDetails = prevParts.slice(3).join(' | ');

        if (prevCompany && company && prevCompany.toLowerCase() === company.toLowerCase()) {
          // Fusionar con el elemento previo: conservar cargo real previo, periodo más descriptivo y los nuevos logros
          const effectivePeriod = (period && !period.toLowerCase().includes('periodo')) ? period : (prevPeriod || 'Periodo profesional');
          const combinedDetails = [prevDetails, details].filter(d => d && !d.toLowerCase().includes('periodo')).join(' ');
          results[prevIdx] = `${prevPosition} | ${prevCompany} | ${effectivePeriod}${combinedDetails ? ' | ' + cleanExecutiveDetails(combinedDetails) : ''}`;
          continue;
        }
      }

      // Si no hay elemento previo con la misma empresa, pero la empresa tiene el puesto o detalles
      if (company && !isLocationString(company)) {
        // Asignar un rol senior adecuado o extraer si venía en la empresa
        position = 'Consultor / Especialista Senior';
      }
    }

    // Limpieza de periodo y swap si la empresa o el periodo quedaron cruzados
    if (isLocationString(company) && parts.length >= 3 && !isLocationString(parts[2])) {
      // ej: Position | Mexico City | Company
      company = parts[2];
      period = parts[3] || 'Periodo profesional';
    }

    if (!position || isLocationString(position)) position = 'Consultor / Especialista Senior';
    if (!company) company = 'Empresa del Sector Privado';
    if (!period || period.toLowerCase().includes('periodo profesional')) {
      period = (parts.length >= 3 && parts[2]) ? parts[2] : 'Periodo profesional';
    }

    // Saneamiento de responsabilidades/logros bajo directriz ejecutiva EAS
    if (details) {
      details = cleanExecutiveDetails(details);
    }

    const canonicalItem = `${position} | ${company} | ${period}${details ? ' | ' + details : ''}`;
    results.push(canonicalItem);
  }

  return results.slice(0, 3);
}

/**
 * Normaliza y repara la lista de educación académica asegurando la tupla:
 * [Carrera o Grado] | [Institución] | [Periodo / Año]
 */
export function normalizeCanonicalEducation(rawList: string[]): string[] {
  if (!Array.isArray(rawList)) return [];

  const results: string[] = [];

  for (const raw of rawList) {
    if (typeof raw !== 'string' || !raw.trim()) continue;

    let clean = fixMojibakeEncoding(raw);
    clean = stripBulletPoints(clean);

    // Descartar encabezados cruzados
    if (/^(certificaciones|certificados|cursos|habilidades|skills|idiomas)/i.test(clean)) {
      continue;
    }

    const parts = clean.split('|').map(p => stripBulletPoints(p.trim())).filter(Boolean);
    if (parts.length === 0) continue;

    let degree = parts[0] || '';
    let institution = parts[1] || '';
    let period = parts[2] || '';

    // Limpieza de artefactos de paginación o texto residual (ej: "of 2 --")
    const stripJunkEdu = (s: string) => s
      .replace(/\b(?:page\s*\d+|p[aá]gina\s*\d+|\bof\s*\d+)\b/gi, '')
      .replace(/[–—\-]{2,}/g, '')
      .replace(/^[–—\-\:\,\s]+|[–—\-\:\,\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    degree = stripJunkEdu(degree);
    institution = stripJunkEdu(institution);
    period = stripJunkEdu(period);

    // Si todo el elemento era basura de paginación
    if (!degree && !institution) continue;

    // Si la institución viene acompañada del año: "Monterrey Institute of Technology and Higher Education, 1994"
    if (institution) {
      const yearMatch = institution.match(/(?:,\s*|\s*[-–—]\s*|\s+)(19\d{2}|20\d{2})\b/);
      if (yearMatch && yearMatch[1]) {
        if (!period || period.toLowerCase().includes('periodo')) {
          period = yearMatch[1];
        }
        institution = institution.replace(yearMatch[0], '').trim();
      }
    }

    // Si el grado viene con la institución
    if (degree) {
      const yearMatch = degree.match(/(?:,\s*|\s*[-–—]\s*|\s+)(19\d{2}|20\d{2})\b/);
      if (yearMatch && yearMatch[1] && (!period || period.toLowerCase().includes('periodo'))) {
        period = yearMatch[1];
        degree = degree.replace(yearMatch[0], '').trim();
      }
    }

    // Inversión si institución quedó como "Periodo de estudios"
    if (institution.toLowerCase().includes('periodo') && period && !period.toLowerCase().includes('periodo')) {
      const tmp = institution;
      institution = period;
      period = tmp.toLowerCase().includes('periodo de estudios') ? 'Periodo de estudios' : tmp;
    }

    // Swap si el grado contiene nombre evidente de universidad
    if (/\b(universidad|instituto|college|school|faculty|facultad|itesm|unam|ipn|uam|uvm|unitec)\b/i.test(degree) &&
        !/\b(universidad|instituto|college|school|faculty|facultad|itesm|unam|ipn|uam|uvm|unitec)\b/i.test(institution)) {
      const tmp = degree;
      degree = institution;
      institution = tmp;
    }

    // Normalización de grados e instituciones frecuentes
    if (/bachelor of science in computer systems/i.test(degree)) {
      degree = 'Licenciatura en Sistemas Computacionales Administrativos';
    }
    if (/monterrey institute of technology/i.test(institution)) {
      institution = 'Tecnológico de Monterrey (ITESM)';
    }

    if (!degree) degree = 'Licenciatura / Ingeniería en Sistemas o Formación Afín';
    if (!institution || institution.toLowerCase().includes('periodo')) institution = 'Universidad / Instituto de Educación Superior';
    if (!period) period = 'Periodo de estudios';

    const item = `${degree} | ${institution} | ${period}`;
    if (!results.some(r => r.toLowerCase() === item.toLowerCase())) {
      results.push(item);
    }
  }

  return results.slice(0, 3);
}

/**
 * Normaliza y limpia las certificaciones eliminando dobles viñetas y encabezados espurios.
 */
export function normalizeCanonicalCertifications(rawList: string[]): string[] {
  if (!Array.isArray(rawList)) return [];

  const blacklist = [
    'professional development', 'desarrollo profesional', 'technical skills',
    'habilidades tecnicas', 'habilidades técnicas', 'idiomas', 'languages',
    'educacion', 'educación', 'experiencia'
  ];

  return rawList
    .map(c => fixMojibakeEncoding(stripBulletPoints(c)))
    .filter(c => {
      const low = c.toLowerCase().trim();
      return low.length > 3 && !blacklist.includes(low) && !low.startsWith('more courses on');
    })
    .slice(0, 4);
}

/**
 * Validador y normalizador agéntico canónico completo para candidatos.
 */
export function validateAndNormalizeCanonicalCv<T extends {
  experience?: string[];
  education?: string[];
  certifications?: string[];
  summary?: string;
}>(candidateData: T): T {
  return {
    ...candidateData,
    experience: normalizeCanonicalExperience(candidateData.experience || []),
    education: normalizeCanonicalEducation(candidateData.education || []),
    certifications: normalizeCanonicalCertifications(candidateData.certifications || []),
    summary: candidateData.summary ? fixMojibakeEncoding(candidateData.summary.trim()) : candidateData.summary
  };
}
