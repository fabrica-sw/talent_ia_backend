import { 
  fixCorruptedAccents, 
  cleanCandidateName, 
  calculateStrictFitScore, 
  formatVacancyTitle,
  generatePersonalizedQuestionsForCandidate,
  interpretVacancyProfileWeights,
  synthesizeAnalyticalCandidateSummary,
  calculateCandidateCompetencies,
  computeGuidanceForCandidate,
  isStaticLegacyCompetencies
} from './vacancyUtils.js';
import { Candidate, Vacancy } from '../types.js';

/**
 * Harness de Pruebas Unitarias Automatizadas
 */
export function runVacancyUtilsTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      failed++;
    }
  }

  console.log("\n=== INICIANDO SUITE DE PRUEBAS UNITARIAS (vacancyUtils) ===");

  // 1. Prueba: fixCorruptedAccents
  assert(fixCorruptedAccents('m?dulo de gesti?n') === 'módulo de gestión', 'Fix corrupted accents on modulo and gestion');
  assert(fixCorruptedAccents('implementaci?n') === 'implementación', 'Fix corrupted accent on implementacion');

  // 2. Prueba: cleanCandidateName
  assert(cleanCandidateName('CURRICULUM VITAE', 'Juan Carlos Gutiérrez', 'juancarlos@eas.com') === 'Juan Carlos Gutiérrez', 'Clean generic title "CURRICULUM VITAE" using resumeText name');
  assert(cleanCandidateName('Información Personal', '', 'rodrigo.sanchez@eas.com') === 'Rodrigo Sanchez', 'Clean generic "Información Personal" using email fallback');
  assert(cleanCandidateName('María Elena Torres', '', 'maria@eas.com') === 'María Elena Torres', 'Preserve valid candidate name');
  assert(cleanCandidateName('LABORATORIOS LIOMONT', '', 'juan.perez@eas.com') === 'Juan Perez', 'Reject corporate name "LABORATORIOS LIOMONT"');
  assert(cleanCandidateName('WORK EXPERIENCE', '', 'maria.lopez@eas.com') === 'Maria Lopez', 'Reject section header "WORK EXPERIENCE"');
  assert(cleanCandidateName('CUSTOMER VIAKABLE', '', 'carlos.gomez@eas.com') === 'Carlos Gomez', 'Reject corporate header "CUSTOMER VIAKABLE"');
  assert(cleanCandidateName('Rosales PM', 'Rosales Pérez Marco Antonio\nConsultor SAP PM 5 años exp', 'rosales@eas.com') === 'Rosales Pérez Marco Antonio', 'Clean "Rosales PM" role acronym and extract proper full name from resumeText');
  assert(cleanCandidateName('Pma Jorge Limã³n', '', 'jorge.limon@eas.com') === 'Jorge Limón', 'Clean "Pma" prefix and repair mojibake in "Limã³n"');
  assert(cleanCandidateName('Jonni Meìrida A', '', 'jonni.merida@eas.com').includes('Mérida'), 'Repair decomposed accent in "Meìrida" to "Mérida"');
  assert(cleanCandidateName('INGENIERA INDUSTRIAL', '', 'sofia.ramirez@eas.com') === 'Sofia Ramirez', 'Reject degree title "INGENIERA INDUSTRIAL" and extract from email');
  assert(cleanCandidateName('ACOUSTIMATCH AI', '', 'carlos.herrera@eas.com') === 'Carlos Herrera', 'Reject brand name "ACOUSTIMATCH AI" and extract from email');
  assert(cleanCandidateName('Profesional En Producción', '', 'diego.soto@eas.com') === 'Diego Soto', 'Reject profession phrase "Profesional En Producción" and extract from email');

  // 3. Prueba: formatVacancyTitle
  assert(formatVacancyTitle('Consultor SAP Senior - Atracción de Talento') === 'Consultor SAP Senior', 'Strip department suffix from title');
  assert(formatVacancyTitle('Gerente de Proyectos TI') === 'Gerente de Proyectos TI', 'Preserve simple vacancy title');

  // 4. Prueba: calculateStrictFitScore - Penalización SAP
  const sapVacancy: Vacancy = {
    id: 'vac-sap-1',
    title: 'Consultor SAP FI/CO Senior',
    department: 'Consultoría SAP',
    location: 'CDMX',
    description: 'Vacante para consultor SAP con 5 años de experiencia',
    requirements: ['SAP FI', 'CO-PA', 'S4HANA'],
    experienceYears: 5,
    salaryRange: '$60,000 - $80,000 MXN',
    status: 'Activa',
    minCompetenciesRequired: {}
  };

  const nonSapCandidate: Candidate = {
    id: 'cand-1',
    name: 'Pedro Ramírez',
    email: 'pedro@gmail.com',
    phone: '5511223344',
    resumeText: 'Desarrollador Web Frontend React Node.js JavaScript HTML CSS',
    stage: 'Filtrado',
    competencies: { 'Habilidades Técnicas': 80 },
    fitScore: 80,
    summary: 'Desarrollador React con 4 años de experiencia en desarrollo web',
    strengths: ['React', 'JavaScript'],
    growths: ['Aprender backend'],
    recommendedQuestions: [],
    suggestedTime: 'Mañana',
    channel: 'LinkedIn'
  };

  const sapResult = calculateStrictFitScore(nonSapCandidate, sapVacancy);
  assert(sapResult.hasDomainMismatch === true, 'Detect SAP domain mismatch');
  assert(sapResult.fitScore <= 45, 'Apply severe penalty score (<= 45) for SAP vacancy without SAP exp');

  // 5. Prueba: calculateStrictFitScore - Candidato Talent Pool sin Vacante
  const poolResult = calculateStrictFitScore(nonSapCandidate, undefined);
  assert(poolResult.hasDomainMismatch === false, 'Talent Pool candidate has no domain mismatch');
  assert(poolResult.fitScore >= 65, 'Talent Pool candidate maintains normal base score');

  // 6. Prueba: generatePersonalizedQuestionsForCandidate - Correlación Vacante OTC Pro
  const questionsOtc = generatePersonalizedQuestionsForCandidate(
    'Luis Maldonado',
    'Experiencia en ventas B2B y prospección',
    'Gerente de Consultoría Funcional SAP S/4HANA - OTC Pro',
    'OTC Pro',
    ['SAP SD', 'Esquemas de cálculo', 'OTC Pro']
  );
  assert(questionsOtc.length >= 3, 'Generate at least 3 personalized questions for OTC Pro');
  assert(questionsOtc.some(q => q.toLowerCase().includes('otc') || q.toLowerCase().includes('sap')), 'Include OTC Pro / SAP specific correlation in questions');

  // 7. Prueba: calculateStrictFitScore - Separación analítica precisa de scores (Candidato sin exp vs Candidato con exp)
  const seniorVacancy: Partial<Vacancy> = {
    id: 'vac-sra-1',
    title: 'Consultor Funcional SAP SD',
    department: 'OTC Pro',
    requiredGuidanceLevel: 'Senior A',
    requirements: ['SAP SD', 'OTC Pro'],
    experienceYears: 5
  };
  const zeroExpCandidate: Partial<Candidate> = {
    id: 'cand-noexp-1',
    name: 'Rebeca Castro Galván',
    email: 'rebeca@example.com',
    resumeText: 'Recién egresada, buscando primer empleo sin experiencia laboral en SAP ni consultoría',
    fitScore: 40
  };
  const experiencedCandidate: Partial<Candidate> = {
    id: 'cand-exp-1',
    name: 'Javier Pelayo',
    email: 'javier@example.com',
    resumeText: 'Consultor Senior SAP SD S4HANA OTC Pro con 8 años de experiencia comprobable. Incrementé las ventas un 25% con transacciones $50,000 USD y 15 proyectos implementados',
    fitScore: 92
  };
  const zeroResult = calculateStrictFitScore(zeroExpCandidate, seniorVacancy);
  const expResult = calculateStrictFitScore(experiencedCandidate, seniorVacancy);

  assert(zeroResult.fitScore <= 45, 'Candidato sin experiencia debe recibir un score bajo (35%-45%) para vacantes Senior');
  assert(expResult.fitScore >= 85, 'Candidato experimentado con métricas debe recibir un score alto (85%-98%) para vacantes Senior');
  assert(expResult.fitScore - zeroResult.fitScore >= 40, 'Debe existir una clara separación analítica (>= 40 pts) entre candidatos sin experiencia y con experiencia');

  // Prueba de calibración de Seniority: Director postulado a Auxiliar debe ser penalizado por sobrecalificación severa
  const auxiliarVacancy: Partial<Vacancy> = {
    id: 'vac-aux-1',
    title: 'Auxiliar Administrativo y de Soporte',
    department: 'Operaciones',
    description: 'Apoyo en captura de datos, archivo y soporte general de oficina',
    requirements: ['Excel básico', 'Manejo de archivo'],
    experienceYears: 0,
    salaryRange: '$12,000 - $15,000'
  };
  const directorCandidate: Partial<Candidate> = {
    id: 'cand-dir-1',
    name: 'Roberto Gómez',
    role: 'Director de Operaciones y TI',
    resumeText: 'Director Ejecutivo con 15 años liderando transformación digital, presupuestos de $5M USD y equipos multidisciplinarios de 80 colaboradores',
    fitScore: 88
  };
  const directorOnAuxResult = calculateStrictFitScore(directorCandidate, auxiliarVacancy);
  assert(directorOnAuxResult.fitScore <= 50, 'Director postulado a Auxiliar NO debe ser recomendable (fitScore <= 50%)');
  assert(directorOnAuxResult.growths.some(g => g.includes('SOBRECALIFICACIÓN CRÍTICA')), 'Director postulado a Auxiliar debe incluir alerta de SOBRECALIFICACIÓN CRÍTICA');

  // 8. Prueba: Vacante Servicios Generales vs Candidato Odontólogo (Incompatibilidad Crítica de Profesión)
  const serviciosGeneralesVac: Partial<Vacancy> = {
    id: 'vac-serv-gen-1',
    title: 'Servicios Generales',
    department: 'GERADVA',
    description: 'Aplicación de técnicas de desinfección, lavado de vajilla y manejo/separación de residuos sólidos. Mantenimiento preventivo de herramientas de limpieza (aspiradoras, mopas, pulidoras).',
    requirements: ['Técnicas de desinfección', 'Lavado de vajilla', 'Manejo de residuos sólidos', 'Pulidoras basales'],
    experienceYears: 1
  };

  const odontologoCandidate: Partial<Candidate> = {
    id: 'cand-odont-1',
    name: 'Andrés López OD',
    role: 'Cirujano Dentista / Odontólogo',
    resumeText: 'Cirujano Dentista y Odontólogo con 6 años de experiencia en clínica dental particular, ortodoncia, endodoncia y salud bucal integral.',
    fitScore: 70
  };

  const odontologoResult = calculateStrictFitScore(odontologoCandidate, serviciosGeneralesVac);
  assert(odontologoResult.hasDomainMismatch === true, 'Odontólogo postulado a Servicios Generales DEBE activar domain mismatch');
  assert(odontologoResult.fitScore <= 25, 'Odontólogo postulado a Servicios Generales DEBE tener fitScore <= 25%');
  assert(odontologoResult.growths.some(g => g.includes('INCOMPATIBILIDAD CRÍTICA DE PROFESIÓN')), 'Odontólogo postulado a Servicios Generales debe incluir alerta de INCOMPATIBILIDAD CRÍTICA DE PROFESIÓN');

  // 9. Prueba: Vacante Servicios Generales vs Cloud Specialist
  const cloudCandidate: Partial<Candidate> = {
    id: 'cand-cloud-1',
    name: 'Especialista Cloud Azure AWS',
    role: 'Cloud Architect',
    resumeText: 'Arquitecto Cloud con 8 años de experiencia en infraestructura Azure, AWS, Kubernetes, Terraform y Docker.',
    fitScore: 68
  };

  const cloudResult = calculateStrictFitScore(cloudCandidate, serviciosGeneralesVac);
  assert(cloudResult.hasDomainMismatch === true, 'Cloud Architect postulado a Servicios Generales DEBE activar domain mismatch');
  assert(cloudResult.fitScore <= 25, 'Cloud Architect postulado a Servicios Generales DEBE tener fitScore <= 25%');

  // 10. Prueba: Recién egresado / Becario con fechas académicas 2018-2025 postulado a Senior A
  const becarioConEstudios: Partial<Candidate> = {
    id: 'cand-bec-1',
    name: 'Juan Becario',
    role: 'Estudiante',
    resumeText: 'Estudiante recién egresado buscando primer empleo. Preparatoria 2018 - 2021. Universidad Nacional 2021 - 2025. Sin experiencia laboral previa.',
    fitScore: 71
  };

  const becarioSeniorResult = calculateStrictFitScore(becarioConEstudios, seniorVacancy);
  assert(becarioSeniorResult.fitScore <= 30, 'Becario con años de estudio no debe heredar 7 años laborales ni tener fitScore > 30% en vacante Senior');
  assert(becarioSeniorResult.growths.some(g => g.includes('SUBCALIFICACIÓN CRÍTICA') || g.includes('Brecha de experiencia')), 'Becario en vacante Senior debe alertar subcalificación');

  // 11. Prueba: Limpieza de nombre de candidato con sufijo "Academia" o "Academia SAP"
  assert(cleanCandidateName('Hever Vásquez Rodríguez Academia', '', 'hevervr@outlook.com') === 'Hever Vásquez Rodríguez', 'Strip "Academia" suffix from candidate name');
  assert(cleanCandidateName('Hever Vásquez Rodríguez Academia SAP 86.33%', '', 'hevervr@outlook.com') === 'Hever Vásquez Rodríguez', 'Strip "Academia SAP" and percentage suffix from candidate name');

  // 12. Prueba: Candidato con perfil contable postulado a Academia SAP (Sin sobrecalificación ni domain mismatch)
  const academiaSapVac: Partial<Vacancy> = {
    id: 'vac-acad-1',
    title: 'Academia SAP',
    department: 'OTCOPE',
    requiredGuidanceLevel: 'Guía Becario',
    experienceYears: 0,
    requirements: ['iniciativa para aprender', 'capacidad de análisis', 'investigar y practicar de manera autónoma']
  };
  const accountingCandidate: Partial<Candidate> = {
    id: 'cand-hever-1',
    name: 'Hever Vásquez Rodríguez',
    role: 'Analista contable y en cuentas por pagar',
    resumeText: 'Licenciatura en Contaduría. Analista en cuentas por pagar 2023-2025. Accountant 2021-2023. Analista contable 2017-2021.',
    fitScore: 80
  };
  const acadResult = calculateStrictFitScore(accountingCandidate, academiaSapVac);
  assert(acadResult.hasDomainMismatch === false, 'Candidato contable en Academia SAP NO debe tener domain mismatch');
  assert(acadResult.fitScore >= 70, 'Candidato contable en Academia SAP debe tener un score competitivo (>= 70%)');
  assert(!acadResult.growths.some(g => g.includes('SOBRECALIFICACIÓN CRÍTICA')), 'Candidato contable en Academia SAP NO debe ser catalogado como SOBRECALIFICACIÓN CRÍTICA');

  // 13. Prueba: Candidato con perfil contable postulado a Líder Técnico BTP (Domain Mismatch obligatorio)
  const btpVacancy: Partial<Vacancy> = {
    id: 'vac-btp-1',
    title: 'Líder Técnico BTP',
    department: 'OTCOPE',
    requiredGuidanceLevel: 'Senior A',
    experienceYears: 5
  };
  const btpResult = calculateStrictFitScore(accountingCandidate, btpVacancy);
  assert(btpResult.hasDomainMismatch === true, 'Candidato contable postulado a Líder Técnico BTP DEBE activar domain mismatch');
  assert(btpResult.fitScore <= 25, 'Candidato contable postulado a Líder Técnico BTP DEBE tener score <= 25%');

  // 14. Prueba: Candidato con perfil contable postulado a Administrador BASIS (Domain Mismatch obligatorio)
  const basisVacancy: Partial<Vacancy> = {
    id: 'vac-basis-1',
    title: 'Consultor Administrador BASIS',
    department: 'BASIS',
    requiredGuidanceLevel: 'Consultor A',
    experienceYears: 3
  };
  const basisResult = calculateStrictFitScore(accountingCandidate, basisVacancy);
  assert(basisResult.hasDomainMismatch === true, 'Candidato contable postulado a BASIS DEBE activar domain mismatch');
  assert(basisResult.fitScore <= 25, 'Candidato contable postulado a BASIS DEBE tener score <= 25%');

  // 15. Prueba Punto 1: Interpretación IA de Perfiles y Peso Porcentual (Suma 100%)
  const poVacancy: Partial<Vacancy> = {
    id: 'vac-po-1',
    title: 'Product Owner',
    department: 'PROMAN',
    description: 'Gestión de backlog, historias de usuario, ceremonias Scrum, coordinación de stakeholders y entregas ágiles.',
    requirements: ['Scrum', 'Jira', 'Product Backlog', 'User Stories', 'Stakeholders'],
    experienceYears: 4
  };
  const poProfiles = interpretVacancyProfileWeights(poVacancy);
  const weightSum = poProfiles.reduce((acc, p) => acc + p.weight, 0);
  assert(poProfiles.length >= 2, 'interpretVacancyProfileWeights debe desglosar al menos 2 perfiles ponderados');
  assert(weightSum === 100, `interpretVacancyProfileWeights debe sumar exactamente 100% (obtenido: ${weightSum}%)`);
  assert(poProfiles[0].roleType === 'Principal' && poProfiles[0].weight >= 45, 'El primer perfil debe ser Principal y tener el mayor peso');

  // 16. Prueba Punto 2: Limpieza de "Ilovepdf Merged (17)" y Sinopsis Analítica (Cero Copy-Paste y Cero Plantilla Clonada)
  const cleanedIlovePdf = cleanCandidateName('Ilovepdf Merged (17)', 'Laura Patricia Méndez\nConsultora SAP FI', 'laura.mendez@eas.com');
  assert(cleanedIlovePdf === 'Laura Patricia Méndez', `cleanCandidateName debe eliminar "Ilovepdf Merged (17)" (obtenido: ${cleanedIlovePdf})`);

  const copyPasteCand = {
    name: 'Roberto Rolando Reséndiz Sánchez',
    resumeText: 'Líder senior de TI con 20 años de trayectoria especializándome en Transformación Digital. Cuento con una sólida experiencia en la creación, administración y modernización de áreas tecnológicas. Mi experiencia incluye la gestión estratégica de contratos de fábrica de software (Microsoft, Adobe, Google, RedHat y Oracle) y Product Backlog con Scrum.',
    summary: 'Líder senior de TI con 20 años de trayectoria especializándome en Transformación Digital. Cuento con una sólida experiencia en la creación, administración y modernización de áreas tecnológicas. Mi experiencia incluye la gestión estratégica de contratos de fábrica de software.'
  };
  const synthesizedRoberto = synthesizeAnalyticalCandidateSummary(copyPasteCand, poVacancy);
  assert(!synthesizedRoberto.includes('Cuento con') && !synthesizedRoberto.includes('Mi experiencia'), 'synthesizeAnalyticalCandidateSummary debe erradicar copy-paste en primera persona');
  assert(synthesizedRoberto.includes('Roberto Rolando Reséndiz Sánchez'), 'synthesizeAnalyticalCandidateSummary debe redactar en tercera persona analítica');

  const clonedTemplateCand = {
    name: 'Liliana Esquivel Ocadiz',
    resumeText: 'Consultora funcional SAP FI/CO con 4 años de experiencia en cuentas por pagar y localización mexicana.',
    summary: 'Liliana Esquivel Ocadiz Academia cuenta con perfil profesional enfocado como Consultor en Ecosistema SAP, respaldado por competencias técnicas y operativas acreditadas en su trayectoria y trayectoria orientada hacia la configuración, soporte funcional y optimización de procesos empresariales en SAP.'
  };
  const synthesizedLiliana = synthesizeAnalyticalCandidateSummary(clonedTemplateCand, sapVacancy);
  assert(!synthesizedLiliana.includes('trayectoria y trayectoria orientada'), 'synthesizeAnalyticalCandidateSummary debe erradicar la muletilla clonada "trayectoria y trayectoria orientada"');

  // 17. Prueba Punto 4: Invarianza Absoluta de Score al cruzar o mover de Vacante
  const candInVacA: Partial<Candidate> = {
    id: 'cand-inv-1',
    name: 'Daniela Soto',
    vacancyId: 'vac-sap-1',
    role: 'Consultor SAP FI',
    fitScore: 35,
    initialFitScore: 35,
    resumeText: 'Product Owner certificada con 5 años de experiencia gestionando Product Backlog, User Stories, Scrum, Jira y Stakeholders en proyectos ágiles.',
    summary: 'Product Owner con dominio en Scrum y Jira.'
  };
  const previewScoreForPo = calculateStrictFitScore(candInVacA, poVacancy).fitScore;
  const candMovedToPo: Partial<Candidate> = {
    ...candInVacA,
    vacancyId: poVacancy.id,
    role: poVacancy.title,
    fitScore: 99, // Incluso si hubiera otro número previo en memoria
    initialFitScore: 12
  };
  const movedScoreForPo = calculateStrictFitScore(candMovedToPo, poVacancy).fitScore;
  assert(previewScoreForPo === movedScoreForPo, `Invarianza absoluta: Score en vista previa (${previewScoreForPo}%) debe ser idéntico al mover a la vacante (${movedScoreForPo}%)`);

  // 18. Prueba Punto 6: Prohibido cualquier Mapa Estático de Competencias (70/72/75/75/74)
  const staticMap = { 'Liderazgo': 70, 'Habilidades Técnicas': 72, 'Trabajo en Equipo': 75, 'Comunicación': 75, 'Resolución de Problemas': 74 };
  assert(isStaticLegacyCompetencies(staticMap) === true, 'isStaticLegacyCompetencies debe detectar el mapa estático 70/72/75/75/74');

  const compManuel = calculateCandidateCompetencies({
    name: 'Manuel De Jesús Montoya Chanes',
    resumeText: 'Intendente de servicios generales con 4 años en desinfección, limpieza profunda, manejo de residuos sólidos y pulidoras.',
    competencies: staticMap
  }, serviciosGeneralesVac);
  const compCarlos = calculateCandidateCompetencies({
    name: 'CARLOS DE LOS SANTOS',
    resumeText: 'Recién egresado buscando oportunidad como becario, sin experiencia previa.',
    competencies: staticMap
  }, serviciosGeneralesVac);
  assert(!isStaticLegacyCompetencies(compManuel), 'calculateCandidateCompetencies nunca debe devolver un mapa estático');
  assert(
    compManuel['Habilidades Técnicas'] !== compCarlos['Habilidades Técnicas'] || compManuel['Liderazgo'] !== compCarlos['Liderazgo'],
    'Dos candidatos distintos nunca deben compartir el mismo mapa de competencias'
  );

  // 19. Prueba Punto 7: CARLOS DE LOS SANTOS con etiqueta corrupta "Consultor Sr (Sr. A)" en BD se corrige a Becario y se bloquea en vacantes Senior
  const carlosCorrupted: Partial<Candidate> = {
    id: 'cand-carlos-1',
    name: 'CARLOS DE LOS SANTOS',
    detectedGuidanceLevel: 'Consultor Sr (Sr. A)',
    resumeText: 'Recién egresado de ingeniería, buscando oportunidad como becario o trainee. Sin experiencia laboral previa.',
    fitScore: 71
  };
  const carlosGuidance = computeGuidanceForCandidate(carlosCorrupted, btpVacancy);
  const carlosBtpEval = calculateStrictFitScore(carlosCorrupted, btpVacancy);
  assert(carlosGuidance.candidate.rank === 1, `CARLOS DE LOS SANTOS debe inferirse por su CV como Rango 1 Becario, ignorando etiqueta corrupta Sr. A (obtenido: Rango ${carlosGuidance.candidate.rank})`);
  assert(carlosBtpEval.fitScore <= 28, `CARLOS DE LOS SANTOS en Líder Técnico BTP debe ser bloqueado por candado ±2 niveles y Hard-Skill Gate (<= 28%, obtenido: ${carlosBtpEval.fitScore}%)`);

  // 20. Prueba Punto 9: Daniel Martínez C (Ingeniero TI con Anexo 22 / Aduanas) NO es Ciencias de la Salud, mientras Odontólogo real queda descartado en todas las vacantes
  const danielMartinez: Partial<Candidate> = {
    id: 'cand-daniel-1',
    name: 'Daniel Martínez C',
    resumeText: 'Objetivo: Integrarme en una empresa con intereses en Tecnología de la Información. Experiencia: 2014 - Actual Integración GX Director de Proyectos. Análisis, diseño e implementación de los siguientes sistemas: Sistema de Recinto Fiscalizado para aduana de CDMX WEC, Sistema de Recursos Humanos, Sistema de IMMEX, Sistema de Expediente digital Anexo 22, Sistema de control de inventarios e integración de guías para clientes Telmex y DHL.',
    fitScore: 25
  };
  const danielPoEval = calculateStrictFitScore(danielMartinez, poVacancy);
  assert(danielPoEval.hasDomainMismatch === false, 'Daniel Martínez C (Ingeniero/Director TI con Anexo 22 e IMMEX) JAMÁS debe ser clasificado como Ciencias de la Salud');
  assert(danielPoEval.fitScore >= 60, `Daniel Martínez C en Product Owner debe obtener un score legítimo de TI (>= 60%, obtenido: ${danielPoEval.fitScore}%)`);

  const odontologoOnPo = calculateStrictFitScore(odontologoCandidate, poVacancy);
  const odontologoInPool = calculateStrictFitScore(odontologoCandidate, undefined);
  assert(odontologoOnPo.hasDomainMismatch === true && odontologoOnPo.fitScore <= 18, 'Odontólogo real debe ser descartado en vacante TI Product Owner (<= 18%)');
  assert(odontologoInPool.hasDomainMismatch === true && odontologoInPool.fitScore <= 18, 'Odontólogo real debe ser descartado incluso en Talent Pool general de empresa tecnológica (<= 18%)');

  console.log(`\n==================================================`);
  console.log(`RESULTADO SUITE DE PRUEBAS: ${passed} Pasadas | ${failed} Falladas`);
  console.log(`==================================================\n`);

  return { passed, failed };
}

// Ejecutar automáticamente si corre en entorno Node CLI
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('vacancyUtils.test')) {
  runVacancyUtilsTests();
}
