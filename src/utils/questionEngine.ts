/**
 * Motor de preguntas de "Experiencia" del Double-Check (3 preguntas), compartido por servidor y front.
 *
 * Antes: el tipo de vacante se detectaba con palabras clave mal priorizadas ("Consultor de Ventas"
 * caía en SAP SD por la palabra "ventas" y recibía preguntas de esquemas de precios/ATP), cada
 * categoría devolvía una lista FIJA (Regenerar siempre daba lo mismo) y el CV casi no se usaba.
 *
 * Ahora cada pregunta sale de cruzar la vacante con el CV del candidato:
 *   1. Brecha: un requisito de la vacante que NO aparece en el CV.
 *   2. Evidencia: un requisito que SÍ aparece en el CV (pide un caso concreto, citando su puesto/empresa).
 *   3. Dominio: una pregunta del banco del tipo de puesto (comercial, SAP funcional, desarrollo, etc.).
 * La selección es aleatoria entre las opciones relevantes, pero reproducible con una semilla
 * (misma semilla → mismas preguntas), y "Regenerar" usa una semilla nueva y excluye las anteriores.
 */

export interface QuestionVacancy {
  title?: string;
  department?: string;
  requirements?: string[];
  description?: string;
}

export interface QuestionCandidate {
  name?: string;
  resumeText?: string;
  summary?: string;
  experience?: string[];
  education?: string[];
  certifications?: string[];
}

export interface QuestionOptions {
  seed?: number | string;
  exclude?: string[];
  precomputedAudit?: {
    matched?: Array<{ req: string; source: 'experience' | 'certifications' | 'education' | 'resume' }>;
    missing?: string[];
    matchedRequirements?: Array<{ req: string; source: 'experience' | 'certifications' | 'education' | 'resume' }>;
    missingRequirements?: string[];
  };
}

export type VacancyDomain =
  | 'comercial_soporte' | 'comercial' | 'sap_tecnico' | 'sap_funcional' | 'desarrollo'
  | 'datos' | 'rh' | 'liderazgo' | 'producto' | 'general';

export const normalizeText = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'o', 'u', 'a', 'al', 'con', 'para', 'por', 'un', 'una',
  'anos', 'ano', 'experiencia', 'manejo', 'conocimiento', 'conocimientos', 'nivel', 'minimo', 'avanzado',
  'avanzada', 'intermedio', 'basico', 'solido', 'solida', 'deseable', 'habilidades', 'habilidad', 'capacidad',
  'profesional', 'equipo', 'the', 'and', 'of', 'in', 'with', 'years'
]);

// Palabras cortas y acrónimos técnicos relevantes en SAP, Cloud, DevOps y TI
const SHORT_TERMS = new Set([
  'sd', 'mm', 'fi', 'co', 'pp', 'tm', 'qm', 'pm', 'ps', 'hr', 'bi', 'bw', 'crm', 'erp', 'sap',
  'b2b', 'b2c', 'otc', 'sql', 'ci', 'cd', 'ux', 'ui', 'kpi', 'rfp', 'css', 'git', 'api', 'etl',
  'aws', 'gcp', 'pos', 'pmo', 's4', 'ecc', 'cpi', 'btp', 'rfc', 'rest'
]);

const INVALID_STANDALONE_REQUIREMENTS = new Set([
  'horas', 'hora', 'tiempo', 'fechas', 'fecha', 'lideres', 'lider', 'direccion', 'alcance',
  'objetivos', 'objetivo', 'entregables', 'entregable', 'riesgos', 'riesgo', 'issues', 'issue',
  'costos', 'costo', 'actividades', 'actividad', 'reportes', 'reporte', 'reuniones', 'reunion',
  'desviaciones', 'desviacion', 'seguimiento', 'avance', 'avances', 'estatus', 'calidad',
  'funciones', 'recursos', 'materiales', 'financieros', 'compromisos', 'entrega', 'sponsor',
  'stakeholders', 'cliente', 'clientes', 'proyectos', 'proyecto', 'puesto', 'area', 'internas',
  'negocio', 'planes', 'toma', 'decisiones', 'resultados', 'cifras', 'montos', 'indicadores'
]);

const VALID_TECHNICAL_SOLO_TERMS = new Set([
  'sap', 'abap', 'basis', 'fiori', 'btp', 'cpi', 'hana', 's4hana', 'ecc', 'sd', 'mm', 'fi', 'co',
  'pp', 'tm', 'qm', 'pm', 'ps', 'crm', 'erp', 'sql', 'python', 'java', 'react', 'node', 'typescript',
  'javascript', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'devops', 'git', 'pmo', 'scrum',
  'agile', 'linux', 'unix', 'itil', 'salesforce', 'hubspot', 'jira', 'confluence'
]);

export function cleanRequirementForQuestion(rawReq: string): string {
  if (!rawReq) return '';
  let r = rawReq
    .replace(/^[•\-\*\d\.\)\s✓●▪]+/, '')
    .replace(/^['"\(\[\{]+|['"\)\]\},;.:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  r = r.replace(/\)+$/, '').replace(/^(\(+)/, '').trim();
  return r;
}

/** Requisitos que en realidad son etiquetas de plantilla del Layout y no deben usarse como pregunta. */
export function isUsableRequirement(req: string): boolean {
  const r = normalizeText(cleanRequirementForQuestion(req)).trim();
  if (r.length < 4 || r.length > 95) return false;
  if (r === 'general' || r === 'ninguno' || r === 'ninguna' || r === 'sin requisitos') return false;
  if (/^(requisitos?|requerimientos?|perfil|competencias?|habilidades?|experiencia|descripcion|funciones)(\s*generales?)?$/i.test(r)) return false;
  if (/\bdescribe\b|\(maximo|necesarias del puesto|\bsoft skills\)|^n\/a$|^na$/.test(r)) return false;
  
  // Excluir partículas gramaticales o frases que son fragmentos de oraciones
  if (/^(para que|de modo que|con base en|a fin de|con el fin|de manera que|para evaluar|a fin de evaluar)\b/i.test(r)) return false;
  if (/^(para\s+|de\s+|con\s+|en\s+|a\s+|y\s+|o\s+|e\s+)\b/i.test(r)) return false;

  const terms = requirementTerms(r);
  if (terms.length === 0) return false;

  // Si el requisito es una sola palabra o término aislado
  if (terms.length === 1) {
    const singleTerm = terms[0];
    if (INVALID_STANDALONE_REQUIREMENTS.has(singleTerm)) return false;
    // Solo permitir términos técnicos o acrónimos reconocidos si vienen como palabra única
    if (!VALID_TECHNICAL_SOLO_TERMS.has(singleTerm) && !SHORT_TERMS.has(singleTerm)) {
      return false;
    }
  }

  // Si todas las palabras son sustantivos comunes genéricos de gestión
  const nonGenericTerms = terms.filter(t => !INVALID_STANDALONE_REQUIREMENTS.has(t));
  if (nonGenericTerms.length === 0) return false;

  return true;
}

export function requirementTerms(req: string): string[] {
  return normalizeText(req)
    .replace(/\d+\s*\+?\s*(anos|ano|years)?/g, ' ')
    .split(/[^a-z0-9/+#.-]+/)
    .map(t => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter(t => t && !STOPWORDS.has(t) && (t.length >= 4 || SHORT_TERMS.has(t)));
}

function containsTerm(cvNorm: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(cvNorm);
}

/** Limpia declaraciones aspiracionales/de interés ("me gustaría aprender X", "objetivo: ...") para evitar falsos positivos. */
export function stripAspirationalNoise(text: string): string {
  if (!text) return '';
  return text
    .replace(/\b(?:me\s+gustar[ií]a\s+aprender|deseo\s+aprender|inter[eé]s\s+en\s+aprender|buscando\s+aprender|sin\s+experiencia\s+en)\b[^.\n]*/gi, ' ');
}

/** Separa el CV en secciones ponderables para distinguir experiencia real de menciones académicas/periféricas. */
export function extractSectionAwareCvContexts(candidate: QuestionCandidate): {
  expContext: string;
  certContext: string;
  eduContext: string;
  fullContext: string;
} {
  const resumeClean = stripAspirationalNoise(candidate.resumeText || '');
  const expArr = Array.isArray(candidate.experience) ? candidate.experience.filter(Boolean).join('\n') : '';
  const certArr = Array.isArray(candidate.certifications) ? candidate.certifications.filter(Boolean).join('\n') : '';
  const eduArr = Array.isArray(candidate.education) ? candidate.education.filter(Boolean).join('\n') : '';

  let resumeExpBlock = '';
  if (resumeClean.length > 25) {
    const expMatch = resumeClean.match(/(?:experiencia\s+(?:laboral|profesional(?:\s+y\s+aplicada)?)|trayectoria(?:\s+laboral|\s+profesional)?|work\s+experience|employment\s+history|historial\s+laboral)([\s\S]*?)(?:educaci[oó]n|formaci[oó]n\s+acad[eé]mica|estudios|certificac|habilidades\s+blandas|referencias|$)/i);
    if (expMatch && expMatch[1] && expMatch[1].trim().length > 20) {
      resumeExpBlock = expMatch[1];
    }
  }

  const expContext = normalizeText([expArr, resumeExpBlock].filter(Boolean).join('\n'));
  const certContext = normalizeText(certArr);
  const eduContext = normalizeText(eduArr);
  const fullContext = normalizeText([expArr, certArr, resumeClean, eduArr].filter(Boolean).join('\n'));

  return { expContext, certContext, eduContext, fullContext };
}

function hasRequirementTermOrAlias(normText: string, term: string): boolean {
  if (containsTerm(normText, term)) return true;
  if (term === 'crm') return /\b(salesforce|hubspot|dynamics|zoho|pipedrive|crm)\b/.test(normText);
  if (term === 'agile' || term === 'agil' || term === 'agiles') return /\b(scrum|kanban|agil|backlog|sprint|lean)\b/.test(normText);
  if (term === 'scrum') return /\b(scrum|agile|agil|backlog|sprint)\b/.test(normText);
  if (term === 'backlog') return /\b(backlog|historias?\s+de\s+usuario|user\s+stories|product\s+owner|priorizacion)\b/.test(normText);
  if (term === 'stakeholders') return /\b(stakeholders|directivos|usuarios\s+clave|clientes\s+internos|c-level|direccion)\b/.test(normText);
  if (term === 'erp') return /\b(erp|sap|oracle|netsuite|odoo|dynamics|s\/?4\s?hana)\b/.test(normText);
  if (term === 'b2b') return /\b(b2b|corporativ|empresarial|empres|cuentas\s+clave|kam|c-level)\b/.test(normText);
  return false;
}

/**
 * Fuente única de verdad compartida entre Score y Double-Check para auditar requisitos vs CV.
 * Exige >= 60% de términos significativos del requisito (evitando falsos positivos por 1 palabra suelta).
 */
export function auditCandidateRequirements(requirements: string[], candidate: QuestionCandidate): {
  matched: Array<{ req: string; source: 'experience' | 'certifications' | 'education' | 'resume' }>;
  missing: string[];
} {
  const ctx = extractSectionAwareCvContexts(candidate);
  const matched: Array<{ req: string; source: 'experience' | 'certifications' | 'education' | 'resume' }> = [];
  const missing: string[] = [];

  for (const rawReq of (requirements || []).filter(isUsableRequirement)) {
    const req = rawReq.trim();
    const terms = requirementTerms(req);
    if (terms.length === 0) continue;
    const minNeeded = Math.max(1, Math.ceil(terms.length * 0.6));

    const expHits = ctx.expContext ? terms.filter(t => hasRequirementTermOrAlias(ctx.expContext, t)).length : 0;
    const certHits = ctx.certContext ? terms.filter(t => hasRequirementTermOrAlias(ctx.certContext, t)).length : 0;
    const eduHits = ctx.eduContext ? terms.filter(t => hasRequirementTermOrAlias(ctx.eduContext, t)).length : 0;
    const fullHits = terms.filter(t => hasRequirementTermOrAlias(ctx.fullContext, t)).length;

    if (expHits >= minNeeded) {
      matched.push({ req, source: 'experience' });
    } else if (certHits >= minNeeded) {
      matched.push({ req, source: 'certifications' });
    } else if (fullHits >= minNeeded) {
      matched.push({ req, source: eduHits >= minNeeded && fullHits === eduHits ? 'education' : 'resume' });
    } else {
      missing.push(req);
    }
  }

  return { matched, missing };
}

/** Un requisito se considera cubierto si al menos el 60% de sus términos significativos aparecen en el CV. */
export function matchRequirements(requirements: string[], cvText: string) {
  const cvNorm = normalizeText(stripAspirationalNoise(cvText));
  const matched: string[] = [];
  const gaps: string[] = [];
  for (const req of requirements.filter(isUsableRequirement)) {
    const terms = requirementTerms(req);
    if (terms.length === 0) continue;
    const minNeeded = Math.max(1, Math.ceil(terms.length * 0.6));
    const hits = terms.filter(t => hasRequirementTermOrAlias(cvNorm, t)).length;
    (hits >= minNeeded ? matched : gaps).push(req.trim());
  }
  return { matched, gaps };
}

/** Clasifica la vacante. El TÍTULO manda; requisitos y área solo desempatan. */
export function classifyVacancy(v: QuestionVacancy): VacancyDomain {
  const title = normalizeText(v.title || '');
  const context = normalizeText(`${v.department || ''} ${(v.requirements || []).join(' ')}`);

  // 1. Roles de Producto Digital y Agilidad (mandan siempre sobre menciones secundarias de SAP o tecnologías)
  if (/product owner|product manager|scrum master|agile|lider de producto|dueno de producto|delivery manager|gestion de producto/.test(title)) {
    return 'producto';
  }

  // 2. SAP Técnico
  if (/\babap\b|\bbasis\b|\bbtp\b|\bcpi\b|arquitect.*integracion.*sap/.test(title)) {
    return 'sap_tecnico';
  }

  // 3. SAP Funcional (el título debe ser explícitamente consultoría/especialista funcional SAP)
  const sapModuleInTitle = /\bsap\b|s\/?4\s?hana|\becc\b|\b(sd|mm|fi|co|pp|tm|ewm|qm|ps|sfsf|ariba)\b/.test(title);
  if (sapModuleInTitle) {
    return 'sap_funcional';
  }

  // 4. Comercial y Soporte Comercial
  if (/asistente|auxiliar|analista comercial|soporte comercial|backoffice/.test(title) && /comercial|venta/.test(title + ' ' + context)) {
    return 'comercial_soporte';
  }
  if (/venta|comercial|ejecutiv[oa] de cuenta|account|sales|business development|preventa|pre-venta|desarrollo de negocio/.test(title)) {
    return 'comercial';
  }

  // 5. Desarrollo de Software y Datos
  if (/desarroll|developer|frontend|backend|full ?stack|react|node|java|python|programador|software/.test(title)) {
    return 'desarrollo';
  }
  if (/datos|data|\bbi\b|analytics|power bi|\bsql\b/.test(title)) {
    return 'datos';
  }

  // 6. Capital Humano / RH
  if (/reclut|atraccion de talento|capital humano|recursos humanos|\brh\b|\bhr\b/.test(title)) {
    return 'rh';
  }

  // 7. Liderazgo y Gestión
  if (/gerente|lider|director|jefe|coordinador|manager|\bpmo?\b/.test(title)) {
    if (/\bsap\b/.test(title)) return 'sap_funcional';
    return 'liderazgo';
  }

  // 8. Desempate por contexto SOLO si el rol es expresamente consultoría funcional SAP (evita falsos positivos por "nociones de SAP")
  if (/\bconsultor.*sap\b|\bespecialista.*sap\b/.test(context) && !/no consultoria|nociones|deseable/.test(context)) {
    return 'sap_funcional';
  }
  if (/\b(sd|mm|fi|co|pp|tm|ewm|qm|ps|sfsf|ariba)\b/.test(context) && /configuracion|parametrizacion|customizing|bbp/.test(context)) {
    return 'sap_funcional';
  }
  if (/venta|comercial|crm|prospeccion/.test(context)) {
    return 'comercial';
  }

  return 'general';
}

const DOMAIN_BANK: Record<VacancyDomain, string[]> = {
  producto: [
    'En el rol de {cargo}, la priorización del backlog es crítica cuando compiten demandas de negocio y deuda técnica: ¿qué framework o criterio sueles aplicar para tomar y defender estas decisiones?',
    'Platícanos sobre la definición de un roadmap de producto digital que hayas liderado: ¿cómo alineaste las expectativas de los directivos/stakeholders con la capacidad real del equipo de desarrollo?',
    '¿Cómo llevas a cabo el refinamiento de requerimientos complejos para transformarlos en historias de usuario con criterios de aceptación claros y medibles?',
    'Cuéntanos sobre algún lanzamiento o evolución de producto donde hayas medido el éxito a través de KPIs o métricas de adopción: ¿cuáles fueron los resultados alcanzados?',
    'En iniciativas donde intervienen integraciones o dependencias con sistemas corporativos, ¿de qué manera aseguras la viabilidad funcional y técnica de la solución antes del desarrollo?',
    '¿Cómo manejas el descubrimiento continuo de producto (product discovery) para asegurar que el equipo esté construyendo la solución que verdaderamente genera mayor valor?',
  ],
  comercial_soporte: [
    'En el rol de {cargo}, el seguimiento ágil a clientes es fundamental: ¿cómo sueles organizar la atención a cotizaciones y pedidos para asegurarte de que ninguna oportunidad en {area} se quede sin respuesta?',
    'Platícanos cómo has colaborado previamente con equipos comerciales: desde la preparación de propuestas hasta el armado de reportes de avance. ¿Qué herramientas te han dado mejor resultado?',
    'En tu experiencia previa, ¿qué información clave consideras indispensable registrar en el CRM tras conversar con un cliente y de qué manera ayuda al desempeño de {cargo}?',
    'Recuerdas alguna ocasión en la que tuviste que atender a un cliente insatisfecho o molesto? Cuéntanos cómo abordaste la situación y qué solución acordaron.',
    'Cuando se acumulan solicitudes urgentes de distintos ejecutivos de {area}, ¿cuál es tu criterio para priorizar entregas sin descuidar la calidad?',
    '¿Qué tipo de reportes comerciales (pipeline, avance de ventas, cobranza) has elaborado previamente y qué indicadores solías presentar?',
  ],
  comercial: [
    'Platícanos sobre tu metodología de prospección B2B: ¿cómo sueles identificar y validar si una empresa es un cliente potencial ideal antes de buscar la primera reunión?',
    'De todas tus ventas o negociaciones cerradas, ¿cuál ha sido la más compleja? Cuéntanos el ciclo de venta, las personas clave que involucraste y el impacto que generó.',
    'Cuando en una negociación para {cargo} el cliente menciona que la competencia ofrece un costo menor, ¿cómo sueles abordar la conversación para resaltar el valor de la propuesta?',
    'Cuéntanos sobre las metas o cuotas comerciales que has manejado recientemente: ¿qué estrategias te permitieron cumplirlas o superarlas en tus puestos anteriores?',
    '¿Cómo aprovechas el CRM en tu día a día para gestionar tu embudo de ventas y hacer proyecciones de cierre confiables?',
    'En proyectos complejos, ¿de qué forma te coordinas con los equipos técnicos o de consultoría para asegurar que lo prometido al cliente sea totalmente entregable?',
    'Construir confianza con directivos y tomadores de decisión (C-Level) es vital: ¿qué hábito o enfoque te ha funcionado mejor para cultivar relaciones a largo plazo?',
  ],
  sap_funcional: [
    'Cuéntanos sobre tu proyecto SAP reciente más representativo para {cargo}: en qué fases participaste activamente (Explore, Realize, Deploy) y cuál fue tu aportación principal.',
    'En implementaciones SAP, la integración entre módulos suele traer retos técnicos. ¿Podrías compartir un escenario complejo que hayas resuelto durante las pruebas integrales?',
    '¿Cómo llevas a cabo el levantamiento y validación de requerimientos con los usuarios clave antes de realizar la configuración en SAP (BBP, especificaciones funcionales)?',
    'Compártenos una incidencia crítica en producción que hayas diagnosticado: qué transacciones utilizaste y cómo lograste restablecer la operación a tiempo.',
    'Desde tu experiencia práctica en el módulo, ¿cuáles han sido las diferencias o mejoras más marcadas que has notado al trabajar entre SAP ECC y S/4HANA?',
    'Cuando los usuarios clave muestran dudas o cierta resistencia al cambio durante una nueva implementación de SAP, ¿cómo manejas el acompañamiento para asegurar la adopción?',
  ],
  sap_tecnico: [
    'Platícanos sobre el desarrollo o ajuste técnico más desafiante que has implementado para {cargo}: cuál era el requerimiento, qué arquitectura aplicaste y cómo lo validaste.',
    'En ambientes de alta demanda, ¿qué buenas prácticas sigues para garantizar el rendimiento y la estabilidad de tus desarrollos en producción?',
    '¿Qué flujo o estándares de calidad aplicas en la documentación técnica y en el transporte de órdenes de cambio para evitar sorpresas en producción?',
    'Cuéntanos una falla técnica compleja que te haya tocado diagnosticar: qué herramientas de trace/debugging utilizaste y cómo diste con la causa raíz.',
    '¿De qué manera trabajas mano a mano con los consultores funcionales para convertir una especificación de negocio en una solución técnica limpia?',
  ],
  desarrollo: [
    'Cuéntanos sobre la arquitectura del proyecto del que te sientas más orgulloso relacionado con {cargo}: qué tecnologías eligieron, qué rol jugaste y qué decisiones clave tomaron.',
    'En aplicaciones con tráfico real, ¿qué enfoque sigues para monitorear el rendimiento, prevenir cuellos de botella y gestionar errores imprevistos?',
    '¿Qué prácticas de calidad de software (pruebas unitarias, code reviews, integración continua) aplicas regularmente en tu flujo de trabajo?',
    'Compártenos un problema o bug especialmente difícil que hayas resuelto: cómo lo identificaste, cuál era la causa de fondo y cómo lo corregiste.',
    '¿Cómo te coordinas habitualmente con los equipos de producto y diseño para estimar tiempos y cumplir los compromisos de entrega?',
  ],
  datos: [
    'Platícanos sobre un tablero o modelo de analítica de datos que hayas diseñado para {cargo}: qué fuentes conectaste, qué KPIs mostraste y qué decisiones facilitó.',
    '¿Qué controles o procesos aplican en tu equipo para garantizar la limpieza, coherencia y exactitud de los datos antes de presentarlos a dirección?',
    'Cuéntanos sobre alguna consulta o proceso de datos que hayas logrado optimizar: cuál era el problema original y cómo redujiste el tiempo de procesamiento.',
    '¿Recuerdas algún hallazgo o patrón en los datos que hayas descubierto y que haya cambiado la estrategia de una iniciativa del negocio?',
  ],
  rh: [
    'Cuando se abre una posición especializada como {cargo}, ¿cómo trabajas con el líder solicitante para alinear las expectativas del perfil antes de iniciar la atracción?',
    'Platícanos sobre tu metodología para evaluar postulaciones y realizar las entrevistas iniciales: ¿qué aspectos clave buscas identificar en el candidato?',
    '¿Cuál ha sido la vacante más retadora que te ha tocado cubrir y qué estrategia de búsqueda o sourcing te dio el mejor resultado?',
    'Cuando un candidato con un excelente perfil solicita una pretensión salarial por encima del tabulador, ¿cómo manejas la negociación para encontrar un punto de equilibrio?',
  ],
  liderazgo: [
    'En tu experiencia liderando equipos, ¿cómo sueles definir objetivos y dar seguimiento al desempeño? Compártenos el caso de algún colaborador cuyo desarrollo hayas impulsado.',
    'Cuéntanos sobre alguna decisión retadora de prioridades o presupuesto que hayas tenido que tomar y de qué forma la comunicaste con tu equipo y la dirección.',
    'Cuando un proyecto estratégico amenaza con retrasarse frente al compromiso con el cliente, ¿qué acciones inmediatas sueles emprender para reencausarlo?',
    '¿Qué indicadores o métricas principales solías presentar a la dirección en tu responsabilidad más reciente?',
  ],
  general: [
    'De tus logros más recientes, ¿cuál consideras que refleja mejor las fortalezas que aportarías a la posición de {cargo}?',
    'Platícanos sobre alguna situación en la que tuviste que aprender una nueva herramienta o concepto de forma acelerada para cumplir con una entrega importante.',
    '¿Qué método o herramientas utilizas en tu día a día para organizar tus actividades y dar seguimiento oportuno a todos tus compromisos?',
    'Cuéntanos sobre algún problema inesperado que hayas enfrentado en tu trabajo anterior, cómo lo abordaste y cuál fue el resultado final.',
  ],
};

const GAP_TEMPLATES = [
  'Para la posición de {cargo} es clave contar con experiencia en "{req}". Dado que no aparece detallado de forma explícita en tu CV, ¿qué proyectos o responsabilidades previas respaldan tu dominio en esta área? Incluye indicadores o resultados cuantificables alcanzados.',
  'En el rol de {cargo} se requiere dominio práctico de "{req}". Platícanos en qué proyecto o asignación previa lo has implementado, con qué grado de autonomía y cuál fue el impacto en tiempo, calidad o presupuesto.',
  'Uno de los pilares técnicos para {cargo} es "{req}". Cuéntanos qué retos técnicos o de gestión has enfrentado en este rubro y qué soluciones aportaste detallando cifras o volúmenes.'
];

const EVIDENCE_TEMPLATES = [
  'Observamos en tu trayectoria experiencia en "{req}"{enEmpresa}. Platícanos un proyecto representativo donde lo aplicaste e incluye indicadores concretos (métricas, volúmenes, porcentajes o entregables clave) del resultado obtenido.',
  'Sobre tu experiencia en "{req}"{enEmpresa}: ¿cuál fue el principal reto técnico o metodológico que resolviste y qué impacto cuantificable tuvo en los objetivos del proyecto?',
  '¿De qué forma tu experiencia previa en "{req}"{enEmpresa} te permitirá generar valor inmediato en la posición de {cargo}? Menciona logros verificables de tu historial laboral.'
];

// Requisitos de conducta / soft skills ("Apegada a políticas", "Facilidad de palabra"): se preguntan
// pidiendo un ejemplo de comportamiento, no "experiencia práctica con".
const SOFT_TEMPLATES = [
  'En la posición de {cargo} la cualidad de "{req}" es muy relevante para el día a día. Platícanos una experiencia laboral donde esta fortaleza se haya visto reflejada en tus resultados, aportando datos o indicadores medibles de su impacto.',
  'Para el desempeño como {cargo} valoramos mucho tener "{req}". Compártenos un ejemplo de tu experiencia reciente donde hayas demostrado esta habilidad e indica resultados o beneficios cuantificables.',
];

export function isSoftRequirement(req: string): boolean {
  return /apegad|politica|presentacion|facilidad de palabra|actitud|proactiv|responsab|puntual|honest|etica|organizad|comunicacion|trabajo en equipo|bajo presion|servicio al cliente|empatia|iniciativa|disciplina|ordenad/.test(normalizeText(req));
}

const LAST_ROLE_TEMPLATES = [
  'En tu responsabilidad reciente como {puesto}{enEmpresa}, ¿qué actividades se alinean más con {cargo} y qué logros cuantificables (cifras, %, presupuestos o métricas) obtuviste?',
  'Analizando tu experiencia como {puesto}{enEmpresa}, ¿qué proyecto o resultado medible consideras que fortalece más tu postulación para {cargo}?',
];

function hashSeed(seed: number | string): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Último empleo desde experience[] ("Puesto | Empresa | Periodo"). */
function latestRole(experience?: string[]): { puesto?: string; empresa?: string } {
  const first = (experience || []).find(e => typeof e === 'string' && e.includes('|'));
  if (!first) return {};
  const parts = first.split('|').map(s => s.trim());
  let puesto = parts[0] || '';
  let empresa = parts[1] || '';

  // Inversión si la primera parte era empresa y la segunda puesto
  if (/empresa|consulting|solutions|corporation|inc|s\.a\.|llc|tech|group|grupo/i.test(puesto) && !/empresa/i.test(empresa)) {
    const tmp = puesto; puesto = empresa; empresa = tmp;
  }

  // Si puesto quedó con un marcador temporal o mes
  if (/^(presente|actualidad|current|present|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(puesto)) {
    puesto = 'Consultor / Especialista Senior';
  }

  const isGenericCompany = (emp?: string) => {
    if (!emp) return true;
    const l = emp.toLowerCase();
    return l.includes('eas consulting') || l.includes('empresa consultora') || l.includes('empresa de servicios ti') || l.includes('empresa corporativa') || l.includes('empresa líder') || l.includes('empresa destacada') || l === 'empresa' || l.includes('sector privado');
  };
  const cleanEmpresa = empresa && !isGenericCompany(empresa) && empresa.length < 80 ? empresa : undefined;
  return { puesto: puesto || undefined, empresa: cleanEmpresa };
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function generateExperienceQuestions(
  vacancy: QuestionVacancy,
  candidate: QuestionCandidate,
  opts: QuestionOptions = {}
): string[] {
  const rnd = mulberry32(hashSeed(opts.seed ?? `${candidate.name || ''}|${vacancy.title || ''}`));
  const exclude = new Set((opts.exclude || []).map(q => normalizeText(q).trim()));
  const fallbackAudit = !opts.precomputedAudit ? auditCandidateRequirements(vacancy.requirements || [], candidate) : undefined;
  const rawMatched = opts.precomputedAudit?.matched || opts.precomputedAudit?.matchedRequirements || fallbackAudit?.matched || [];
  const rawMissing = opts.precomputedAudit?.missing || opts.precomputedAudit?.missingRequirements || fallbackAudit?.missing || [];
  const matched = rawMatched.map(m => m.req);
  const gaps = rawMissing;
  const domain = classifyVacancy(vacancy);
  const { puesto, empresa } = latestRole(candidate.experience);

  const cargo = (vacancy.title || 'la vacante').trim();
  const area = (vacancy.department || 'el área').trim();
  const enEmpresa = empresa ? ` (en ${empresa})` : '';
  const base = { cargo, area, enEmpresa, puesto: puesto || '', empresa: empresa || '' };

  const validGaps = gaps
    .map(cleanRequirementForQuestion)
    .filter(isUsableRequirement);
  const validMatched = matched
    .map(cleanRequirementForQuestion)
    .filter(isUsableRequirement);

  const picked: string[] = [];
  const take = (candidates: string[]): boolean => {
    for (const q of candidates) {
      const key = normalizeText(q).trim();
      if (!exclude.has(key) && !picked.some(p => normalizeText(p).trim() === key)) {
        picked.push(q);
        return true;
      }
    }
    return false;
  };
  const templatesFor = (req: string, technical: string[]) => (isSoftRequirement(req) ? SOFT_TEMPLATES : technical);
  const gapQs = () => shuffle(validGaps, rnd).flatMap(req => shuffle(templatesFor(req, GAP_TEMPLATES), rnd).map(t => fill(t, { ...base, req })));
  const evidenceQs = () => shuffle(validMatched, rnd).flatMap(req => shuffle(templatesFor(req, EVIDENCE_TEMPLATES), rnd).map(t => fill(t, { ...base, req })));
  const roleQs = () => (puesto ? shuffle(LAST_ROLE_TEMPLATES, rnd).map(t => fill(t, base)) : []);
  const domainQs = () => shuffle(DOMAIN_BANK[domain], rnd).map(t => fill(t, base));

  // 1) brecha → 2) evidencia → 3) dominio; si falta un tipo, se completa con los otros.
  take(gapQs()) || take(evidenceQs()) || take(roleQs()) || take(domainQs());
  take(evidenceQs()) || take(roleQs()) || take(gapQs()) || take(domainQs());
  take(domainQs()) || take(gapQs()) || take(evidenceQs());
  // Si "exclude" agotó las opciones relevantes, se permite repetir antes que devolver menos de 3.
  if (picked.length < 3) {
    for (const q of [...gapQs(), ...evidenceQs(), ...domainQs()]) {
      if (picked.length >= 3) break;
      if (!picked.includes(q)) picked.push(q);
    }
  }
  return picked.slice(0, 3);
}

/**
 * ¿La pregunta tiene relación con la vacante? Útil para validar preguntas generadas por IA:
 * debe mencionar el puesto, el área, un término de algún requisito o del dominio del puesto.
 */
export function isQuestionRelevant(question: string, vacancy: QuestionVacancy): boolean {
  const q = normalizeText(question);
  // Las preguntas del banco curado del mismo tipo de puesto son relevantes por construcción.
  const vars = { cargo: (vacancy.title || 'la vacante').trim(), area: (vacancy.department || 'el área').trim() };
  if (DOMAIN_BANK[classifyVacancy(vacancy)].some(t => normalizeText(fill(t, vars)) === q)) return true;
  const terms = new Set<string>([
    ...requirementTerms(vacancy.title || ''),
    ...requirementTerms(vacancy.department || ''),
    ...(vacancy.requirements || []).filter(isUsableRequirement).flatMap(requirementTerms),
  ]);
  for (const t of terms) if (containsTerm(q, t)) return true;
  const domainHints: Record<VacancyDomain, RegExp> = {
    comercial_soporte: /cliente|vent|vend|cotizacion|crm|pedido|comercial|reporte|ejecutiv|propuesta/,
    comercial: /cliente|vent|vend|prospecc|negociac|cierre|pipeline|cuota|propuesta|comercial|cuenta|oferta|objecion/,
    sap_funcional: /\bsap\b|modulo|configur|implementac|s\/?4/,
    sap_tecnico: /\bsap\b|abap|basis|desarroll|integrac/,
    desarrollo: /codigo|aplicacion|arquitectura|desarroll|pruebas|api/,
    datos: /datos|tablero|dashboard|consulta|modelo|kpi/,
    rh: /candidat|vacante|reclut|entrevista|talento/,
    liderazgo: /equipo|lider|presupuesto|direccion|desempeno/,
    producto: /producto|backlog|roadmap|historias? de usuario|scrum|agile|stakeholders?|discovery|priorizaci[oó]n|kpis?|adopci[oó]n|valor|mvp/,
    general: /.^/,
  };
  return domainHints[classifyVacancy(vacancy)].test(q);
}

export const FIXED_AVAILABILITY_QUESTIONS = [
  '¿Cuál es tu disponibilidad para integrarte a la vacante?',
  '¿Cuál fue tu último sueldo mensual bruto (comprobable)?',
  '¿Dónde te ubicas actualmente?',
  '¿En qué modalidad de trabajo podrías colaborar (presencial, híbrido o remoto)?',
];

/** Cuestionario completo: 3 de experiencia + 4 de disponibilidad (7). */
export function buildScreeningQuestions(experienceQuestions: string[]): { id: number; question: string }[] {
  return [...experienceQuestions.slice(0, 3), ...FIXED_AVAILABILITY_QUESTIONS].map((question, i) => ({ id: i + 1, question }));
}
