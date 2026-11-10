import assert from 'node:assert/strict';
import { evaluateDoubleCheck, parseCandidateAnswers, parseMoney } from './doubleCheckEvaluator.js';
import { FIXED_AVAILABILITY_QUESTIONS } from './questionEngine.js';

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`); }

const vac = { title: 'Consultor de Ventas', department: 'COMERCIAL', requirements: ['3+ años en ventas B2B', 'Prospección C-Level', 'Habilidades de negociación comercial', 'Manejo de CRM'], salaryRange: '$40,000 - $55,000 MXN', modalidad: 'Híbrido' };
const cand = { name: 'Alexis', resumeText: 'Ventas', experience: ['Ejecutivo de Ventas | Grupo Uno | 2019 - 2024'] };
const Q = [
  'Para Consultor de Ventas se necesita "Manejo de CRM", que no aparece en tu trayectoria. ¿Qué experiencia o formación tienes que lo respalde?',
  'Tu CV muestra experiencia en "Habilidades de negociación comercial". Cuéntanos un caso real: ¿cuál fue tu rol, qué hiciste exactamente y qué resultado medible obtuviste?',
  '¿Cómo usas el CRM para administrar tu pipeline y pronosticar cierres del trimestre?',
];
const evalWith = (exp: string[], avail: string[] = ['', '', '', ''], base = 84) =>
  evaluateDoubleCheck({
    questions: [...Q.map((q, i) => ({ question: q, answer: exp[i] })), ...FIXED_AVAILABILITY_QUESTIONS.map((q, i) => ({ question: q, answer: avail[i] }))],
    vacancy: vac, candidate: cand, baseScore: base,
  });

const STRONG = [
  'En Grupo Uno usé Salesforce durante 4 años: registraba cada oportunidad por etapa y configuré reportes de pronóstico semanales. Gracias a eso reduje el ciclo de venta de 90 a 65 días y mi tasa de conversión pasó de 18% a 27%.',
  'En 2022 negocié la renovación con un cliente del sector retail que quería bajar la tarifa 20%. Preparé un análisis de ahorro, presenté opciones de alcance al director de compras y cerré el contrato por $3.2 millones a 2 años, con solo 5% de descuento.',
  'Actualizo el CRM después de cada reunión, reviso el pipeline cada lunes con mi gerente y pondero cada oportunidad por etapa. En 2023 mi pronóstico trimestral tuvo una desviación menor al 10% y cumplí 112% de mi cuota.',
];
const GOOD_AVAIL = ['Inmediata, puedo iniciar en 2 semanas', '$48,000 brutos mensuales', 'Coyoacán, CDMX', 'Híbrido o presencial'];

test('respuestas escuetas/genéricas ("La necesaria", "Experto en ventas y vender mucho") → NO APROBADO y baja fuerte', () => {
  const r = evalWith(['La necesaria', 'Experto en ventas y vender mucho', 'Cumpliendo con toda la información de la venta']);
  assert.equal(r.verdict, 'NO APROBADO');
  assert.ok(r.fitScore <= 45, `fitScore ${r.fitScore}`);
  assert.ok(r.answers.every(a => a.score <= 10));
  assert.ok(!/sólida coherencia/i.test(r.report));
});

test('respuestas fuera de tema → NO APROBADO aunque sean largas', () => {
  const r = evalWith([
    'Me gusta mucho viajar con mi familia y conocer lugares nuevos los fines de semana, también practico futbol.',
    'Soy una persona responsable, puntual y con muchas ganas de aprender y crecer dentro de la empresa.',
    'Considero que tengo buena actitud y me adapto rápido a cualquier ambiente de trabajo.'], GOOD_AVAIL);
  assert.equal(r.verdict, 'NO APROBADO');
  assert.ok(r.fitScore <= 40);
});

test('respuestas con situación, acción, herramienta y cifras → APROBADO y sube poco (máx +6)', () => {
  const r = evalWith(STRONG, GOOD_AVAIL);
  assert.equal(r.verdict, 'APROBADO PARA ENTREVISTA');
  assert.ok(r.fitScore >= 80 && r.fitScore <= 90, `fitScore ${r.fitScore}`);
});

test('sin cifras ni resultados → no se aprueba de lleno', () => {
  const r = evalWith([
    'He usado HubSpot en mi último trabajo para registrar clientes y dar seguimiento a las oportunidades de venta que tenía asignadas.',
    'Negocié con clientes grandes varias veces, buscando que ambas partes ganaran y cuidando el margen de la empresa en cada propuesta.',
    'Registro las oportunidades y reviso el pipeline cada semana con mi jefe para ver qué cierres vienen en el mes.'], GOOD_AVAIL);
  assert.notEqual(r.verdict, 'APROBADO PARA ENTREVISTA');
  assert.ok(r.fitScore < 84);
});

test('sueldo fuera de presupuesto o modalidad incompatible → reservas y tope 55', () => {
  const r = evalWith(STRONG, ['Inmediata', '$85,000 mensuales', 'Monterrey, NL', 'Solo remoto']);
  assert.ok(r.availability.some(a => a.label === 'Sueldo' && a.status === 'incompatible'));
  assert.ok(r.availability.some(a => a.label === 'Modalidad' && a.status === 'incompatible'));
  assert.ok(r.fitScore <= 55);
  assert.notEqual(r.verdict, 'APROBADO PARA ENTREVISTA');
});

test('nunca inventa respuestas: preguntas sin respuesta = 0 y "Sin respuesta"', () => {
  const r = evalWith(['', STRONG[1], '']);
  assert.equal(r.answers[0].score, 0);
  assert.ok(r.answers[0].flags.includes('Sin respuesta.'));
});

test('determinista: mismas respuestas → mismo dictamen', () => {
  assert.deepEqual(evalWith(STRONG, GOOD_AVAIL), evalWith(STRONG, GOOD_AVAIL));
});

test('parsea el correo: numerado, con la pregunta citada y respuestas de varias líneas', () => {
  const questions = [...Q, ...FIXED_AVAILABILITY_QUESTIONS];
  const email = `Hola, van mis respuestas:
1. ${Q[0]}
Usé Salesforce 4 años en Grupo Uno.
Configuré reportes semanales.
2) En 2022 negocié una renovación por $3.2 millones.
Respuesta 3: Reviso el pipeline cada lunes.
4. Inmediata
5.- $48,000
6. Coyoacán, CDMX
7. Híbrido
Saludos`;
  const a = parseCandidateAnswers(email, questions);
  assert.equal(a[0], 'Usé Salesforce 4 años en Grupo Uno.\nConfiguré reportes semanales.');
  assert.equal(a[1], 'En 2022 negocié una renovación por $3.2 millones.');
  assert.equal(a[2], 'Reviso el pipeline cada lunes.');
  assert.equal(a[4], '$48,000');
  assert.equal(a[6], 'Híbrido');
});

test('parsea sin numeración cuando hay un párrafo por pregunta; si no, deja vacío', () => {
  const questions = [...Q, ...FIXED_AVAILABILITY_QUESTIONS];
  const seven = ['a1 texto', 'a2 texto', 'a3 texto', 'inmediata', '$40,000', 'CDMX', 'Remoto'].join('\n\n');
  assert.equal(parseCandidateAnswers(seven, questions)[2], 'a3 texto');
  const messy = 'Tengo mucha experiencia en todo';
  assert.equal(parseCandidateAnswers(messy, questions)[0], '');
});

test('lee montos en pesos', () => {
  assert.deepEqual(parseMoney('$45,000 brutos'), [45000]);
  assert.deepEqual(parseMoney('45 mil'), [45000]);
  assert.deepEqual(parseMoney('52k'), [52000]);
});

console.log(`\n${passed} pruebas del evaluador Double-Check OK`);
