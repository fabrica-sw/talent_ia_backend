/**
 * Catálogo de Áreas / Departamentos de vacantes (fuente única para servidor y front).
 *
 * Antes, el formulario tenía un <select> con estas opciones fijas, pero las vacantes se guardaban con
 * textos libres ("Comercial", "OTC Pro", "DIRECCIÓN COMERCIAL" desde el Layout). Si el valor guardado
 * no estaba entre las opciones, el navegador mostraba la primera ("COMERCIAL") en el detalle mientras
 * el mosaico mostraba el valor real: dos áreas distintas para la misma vacante.
 */
export const AREA_CATALOG = [
  'COMERCIAL',
  'Fabrica SW',
  'GERADVA',
  'HPITOR',
  'HPKOFO',
  'HPKOFP',
  'HPKOFS',
  'HPROMAN',
  'OTCOPE',
  'OTCPRO',
] as const;

const key = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

// Alias conocidos → código del catálogo (comparación sin acentos, espacios ni signos)
const ALIASES: Record<string, string> = {
  comercial: 'COMERCIAL',
  direccioncomercial: 'COMERCIAL',
  areacomercial: 'COMERCIAL',
  ventas: 'COMERCIAL',
  otcpro: 'OTCPRO',
  otcprofesional: 'OTCPRO',
  otcope: 'OTCOPE',
  otcoperaciones: 'OTCOPE',
  fabricasw: 'Fabrica SW',
  fabricadesoftware: 'Fabrica SW',
  fabricasoftware: 'Fabrica SW',
};

/**
 * Devuelve el código del catálogo si el texto corresponde a un área conocida (o a un alias).
 * Si no la reconoce, devuelve el texto original recortado: nunca inventa un área.
 */
export function normalizeArea(raw?: string | null): string {
  const original = (raw || '').trim();
  if (!original) return original;
  const k = key(original);
  const exact = AREA_CATALOG.find(a => key(a) === k);
  if (exact) return exact;
  return ALIASES[k] || original;
}

/** Opciones para el <select>: el catálogo más el valor actual si no está en él (para no ocultarlo). */
export function areaOptionsFor(current?: string | null): string[] {
  const value = (current || '').trim();
  const options: string[] = [...AREA_CATALOG];
  if (value && !options.includes(value)) options.push(value);
  return options;
}
