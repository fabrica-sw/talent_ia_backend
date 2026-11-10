import assert from 'node:assert/strict';
import { generateExperienceQuestions, classifyVacancy, matchRequirements, isQuestionRelevant, buildScreeningQuestions } from './questionEngine.js';
import { normalizeArea, areaOptionsFor } from './areas.js';

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`); }

const ventas = { title: 'Consultor de Ventas', department: 'COMERCIAL', requirements: ['3+ años en ventas B2B', 'Prospección C-Level', 'Habilidades de negociación comercial', 'Manejo de CRM'] };
const cvVentas = { name: 'Ana Ruiz', resumeText: 'Ejecutiva de ventas B2B 2018 - 2024 en Grupo Uno. Negociación comercial con directores.', experience: ['Ejecutiva de Ventas | Grupo Uno | 2018 - 2024'] };

test('"Consultor de Ventas" es comercial, no SAP SD (bug anterior)', () => {
  assert.equal(classifyVacancy(ventas), 'comercial');
  const qs = generateExperienceQuestions(ventas, cvVentas, { seed: 1 });
  assert.ok(qs.every(q => !/esquema|ATP|condici[oó]n de precio/i.test(q)), qs.join('\n'));
});

test('clasifica SAP funcional, técnico, desarrollo y soporte comercial por el título', () => {
  assert.equal(classifyVacancy({ title: 'Consultor Funcional SAP S/4HANA CO' }), 'sap_funcional');
  assert.equal(classifyVacancy({ title: 'Consultor ABAP Senior' }), 'sap_tecnico');
  assert.equal(classifyVacancy({ title: 'Senior Frontend Developer (React)' }), 'desarrollo');
  assert.equal(classifyVacancy({ title: 'Asistente Comercial', department: 'COMERCIAL' }), 'comercial_soporte');
  assert.equal(classifyVacancy({ title: 'Product Owner', department: 'Fabrica SW', requirements: ['Integraciones (SAP)', 'Scrum'] }), 'producto');
});

test('"Product Owner" con nociones de SAP es producto y no recibe preguntas de implementación de módulos SAP', () => {
  const poVac = {
    title: 'Product Owner',
    department: 'Fabrica SW',
    requirements: ['Product Ownership', 'Historias de Usuario', 'Integraciones (SAP)', 'Roadmaps']
  };
  const cvPo = {
    name: 'Carlos Fuentes',
    resumeText: 'Product Owner con 8 años en proyectos de software y plataformas digitales. Scrum y backlog.',
    experience: ['Product Owner | Grupo Digital | 2021 - 2025']
  };
  assert.equal(classifyVacancy(poVac), 'producto');
  for (let seed = 0; seed < 10; seed++) {
    const qs = generateExperienceQuestions(poVac, cvPo, { seed });
    assert.equal(qs.length, 3);
    assert.ok(qs.every(q => !/implementaciones sap|entre modulos suele traer retos|explore, realize, deploy|transacciones utilizaste/i.test(q)), qs.join('\n'));
    qs.forEach(q => assert.ok(isQuestionRelevant(q, poVac), `Pregunta relevante: ${q}`));
  }
});

test('cruza requisitos contra el CV: cubiertos vs brechas', () => {
  const { matched, gaps } = matchRequirements(ventas.requirements, cvVentas.resumeText);
  assert.ok(matched.includes('3+ años en ventas B2B'));
  assert.ok(gaps.includes('Manejo de CRM'));
});

test('siempre 3 preguntas, todas relacionadas con la vacante', () => {
  for (let seed = 0; seed < 20; seed++) {
    const qs = generateExperienceQuestions(ventas, cvVentas, { seed });
    assert.equal(qs.length, 3);
    assert.equal(new Set(qs).size, 3);
    qs.forEach(q => assert.ok(isQuestionRelevant(q, ventas), q));
  }
});

test('la primera pregunta ataca una brecha real y la segunda cita evidencia del CV', () => {
  const [q1, q2] = generateExperienceQuestions(ventas, cvVentas, { seed: 3 });
  assert.ok(/Prospección C-Level|Manejo de CRM/.test(q1), q1);
  assert.ok(/ventas B2B|negociación comercial/.test(q2), q2);
});

test('misma semilla = mismas preguntas; Regenerar (otra semilla + exclude) = preguntas nuevas', () => {
  const a = generateExperienceQuestions(ventas, cvVentas, { seed: 'cand-1' });
  assert.deepEqual(a, generateExperienceQuestions(ventas, cvVentas, { seed: 'cand-1' }));
  const b = generateExperienceQuestions(ventas, cvVentas, { seed: 'otra', exclude: a });
  assert.equal(b.filter(q => a.includes(q)).length, 0, `repetidas: ${b.filter(q => a.includes(q))}`);
});

test('ignora etiquetas de plantilla del Layout como requisitos', () => {
  const v = { title: 'Asistente Comercial', requirements: ['Describe (maximo 3) competencias humanas clave / Necesarias del puesto / (Soft Skills)'] };
  generateExperienceQuestions(v, cvVentas, { seed: 1 }).forEach(q => assert.ok(!/Describe \(maximo/.test(q), q));
});

test('detecta preguntas de IA sin relación con la vacante', () => {
  assert.equal(isQuestionRelevant('¿Cómo configuras el esquema de cálculo en SAP SD?', ventas), false);
  assert.equal(isQuestionRelevant('¿Cómo manejas tu pipeline de ventas en el CRM?', ventas), true);
});

test('cuestionario = 3 de experiencia + 4 de disponibilidad', () => {
  const s = buildScreeningQuestions(['a', 'b', 'c', 'd']);
  assert.equal(s.length, 7);
  assert.deepEqual(s.map(q => q.id), [1, 2, 3, 4, 5, 6, 7]);
});

test('áreas: alias → catálogo, desconocidas se respetan, el select incluye el valor actual', () => {
  assert.equal(normalizeArea('Comercial'), 'COMERCIAL');
  assert.equal(normalizeArea('DIRECCIÓN COMERCIAL'), 'COMERCIAL');
  assert.equal(normalizeArea('OTC Pro'), 'OTCPRO');
  assert.equal(normalizeArea('otcpro'), 'OTCPRO');
  assert.equal(normalizeArea('Consultoría'), 'Consultoría');
  assert.ok(areaOptionsFor('Consultoría').includes('Consultoría'));
  assert.equal(areaOptionsFor('OTCPRO').filter(o => o === 'OTCPRO').length, 1);
});

test('todas las preguntas del motor pasan el filtro de relevancia en cada tipo de vacante', () => {
  const vacs = [ventas, { title: 'Asistente Comercial', department: 'COMERCIAL' }, { title: 'Consultor Funcional SAP S/4HANA CO' },
    { title: 'Consultor ABAP Senior' }, { title: 'Senior Frontend Developer (React)' }, { title: 'Analista de Datos BI' },
    { title: 'Reclutador IT' }, { title: 'Gerente de Operaciones' }, { title: 'Product Owner', department: 'Fabrica SW' }];
  for (const v of vacs) for (let seed = 0; seed < 15; seed++) {
    generateExperienceQuestions(v, { name: 'X', resumeText: '' }, { seed }).forEach(q => assert.ok(isQuestionRelevant(q, v), `${v.title}: ${q}`));
  }
});

console.log(`\n${passed} pruebas de preguntas y áreas OK`);
