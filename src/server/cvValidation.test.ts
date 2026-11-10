import assert from 'node:assert/strict';
import { assessCvDocument, detectCvFileKind, assertIsCv, CvRejectedError } from './cvValidation.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const REAL_LIKE_CV = `
Juana Pérez Ramírez
Consultora SAP SD Senior · juana.perez@correo.com · +52 55 1234 5678 · linkedin.com/in/juanaperez
PERFIL PROFESIONAL
Consultora con 8 años de experiencia en implementaciones S/4HANA.
EXPERIENCIA LABORAL
Consultora SAP SD Senior | Empresa Uno | 2021 - Actual
Consultora SAP SD | Empresa Dos | 2017 - 2021
EDUCACIÓN
Ingeniería en Sistemas | Universidad Tres | 2012 - 2016
CERTIFICACIONES
SAP Certified Application Associate - SD
IDIOMAS
Inglés avanzado
`.repeat(1);

test('acepta un CV con secciones, contacto y periodos', () => {
  const a = assessCvDocument(REAL_LIKE_CV);
  assert.equal(a.isCv, true, a.reasons.join(' / '));
});

test('rechaza un documento técnico largo (diagramas de infraestructura, 295 págs)', () => {
  const text = Array.from({ length: 295 }, (_, i) =>
    `SAP LANDSCAPE @ KOF\nINFRAESTRUCTURA ACTUAL\nRESUMEN VISTA LÓGICA ${i}\nServidor kofsap${i} 10.20.30.${i % 255}\n-- ${i + 1} of 295 --`
  ).join('\n');
  const a = assessCvDocument(text);
  assert.equal(a.isCv, false);
  assert.ok(a.reasons.some(r => r.includes('295 páginas')));
});

test('procesa correctamente documentos con texto legible (evitando rechazos por formato)', () => {
  const resume = `Currículum Vitae. Resumen Profesional de Consultor TI. El candidato cuenta con amplia experiencia laboral, habilidades en gestión,
  certificaciones e idiomas (Inglés B2). Contacto: consultor@empresa.com · Teléfono: +52 55 1234 5678 · Periodo: 2020 - 2024. `.repeat(3);
  const a = assessCvDocument(resume);
  assert.equal(a.isCv, true);
});

test('rechaza texto vacío o escaneado con código NO_TEXT', () => {
  assert.throws(() => assertIsCv('   '), (e: any) => e instanceof CvRejectedError && e.code === 'NO_TEXT');
});

test('rechaza documento que supera el límite de páginas con código NOT_A_CV y motivos', () => {
  const text = Array.from({ length: 35 }, (_, i) => `Página ${i+1} del documento con texto largo...`).join('\n');
  assert.throws(() => assertIsCv(text, 35), (e: any) => e instanceof CvRejectedError && e.code === 'NOT_A_CV' && e.reasons.length > 0);
});

test('detecta extensión falsa (.pdf que no es PDF)', () => {
  assert.throws(() => detectCvFileKind(Buffer.from('hola, no soy un pdf'), 'cv.pdf'), (e: any) => e.code === 'FILE_TYPE_MISMATCH');
});

test('acepta .doc legado y .docx tanto en formato Zip como OLE, y rechaza formatos no soportados', () => {
  assert.equal(detectCvFileKind(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), 'cv.doc'), 'doc');
  assert.equal(detectCvFileKind(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), 'CV_David_Villa-Flores.docx'), 'doc');
  assert.throws(() => detectCvFileKind(Buffer.from('x'), 'foto.png'), (e: any) => e.code === 'UNSUPPORTED_FILE');
});

test('acepta firmas válidas de PDF y DOCX', () => {
  assert.equal(detectCvFileKind(Buffer.from('%PDF-1.7\n'), 'cv.pdf'), 'pdf');
  assert.equal(detectCvFileKind(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), 'cv.docx'), 'docx');
});

test('es determinista: mismo texto, mismo resultado', () => {
  const a = assessCvDocument(REAL_LIKE_CV);
  const b = assessCvDocument(REAL_LIKE_CV);
  assert.deepEqual(a, b);
});

console.log(`\n${passed} pruebas de validación de CV OK`);
