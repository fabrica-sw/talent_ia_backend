/**
 * Motor de Reparación y Corrección de Ortografía, Codificación UTF-8 (Mojibake) y Texto Truncado.
 * EAS Consulting - AI Recruiting & Scheduling Tool
 */

export function fixMojibakeEncoding(text: string): string {
  if (typeof text !== 'string' || !text) return '';
  let s: string = text.normalize('NFC');

  // Reemplazo de patrones Mojibake comunes de UTF-8 mal decodificado a ISO-8859-1 / Latin1
  s = s
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/ã¡/g, 'á')
    .replace(/ã©/g, 'é')
    .replace(/ã­/g, 'í')
    .replace(/ã³/g, 'ó')
    .replace(/ãº/g, 'ú')
    .replace(/ã±/g, 'ñ')
    .replace(/Ã£/g, 'á')
    .replace(/Ã¢/g, 'â')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã®/g, 'î')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã»/g, 'û')
    .replace(/Â/g, '')
    .replace(/Ã\u0081/g, 'Á')
    .replace(/Ã\u0089/g, 'É')
    .replace(/Ã\u008D/g, 'Í')
    .replace(/Ã\u0093/g, 'Ó')
    .replace(/Ã\u009A/g, 'Ú')
    .replace(/Ã\u0091/g, 'Ñ')
    .replace(/Â¿/g, '¿')
    .replace(/Â¡/g, '¡')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¢/g, '•')
    .replace(/â€/g, '"')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€¦/g, '...');

  // Limpieza de caracteres de acento grave descompuesto (decomposed NFD) como en "Jonni Meìrida"
  s = s
    .replace(/Me[i\u0300\u0301\u00ec\u00e8\`\']*\s*rida/gi, 'Mérida')
    .replace(/e[\u0300\u0060]/g, 'è')
    .replace(/e[\u0301\u00B4]/g, 'é')
    .replace(/a[\u0301\u00B4]/g, 'á')
    .replace(/i[\u0301\u00B4]/g, 'í')
    .replace(/o[\u0301\u00B4]/g, 'ó')
    .replace(/u[\u0301\u00B4]/g, 'ú')
    .replace(/n[\u0303\~]/g, 'ñ')
    .replace(/[\u0300-\u036f]/g, '');

  // Limpieza de caracteres inválidos o nulos
  s = s
    .replace(/\u0000/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  return s;
}

export function cleanAndRepairText(text: string): string {
  if (typeof text !== 'string' || !text) return '';
  let s: string = fixMojibakeEncoding(text);

  // 1. Corregir puntos ilegítimos incrustados a mitad de frase (ej: "de. demanda" -> "de demanda", "la. gestión" -> "la gestión")
  s = s.replace(/(\b[a-zA-ZáéíóúñÁÉÍÓÚÑ]{1,10})\.\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ]{1,10}\b)/g, '$1 $2');

  // 2. Corregir espacios múltiples y tabuladores desalineados
  s = s.replace(/[ \t]{2,}/g, ' ');

  // 3. Corregir frases truncadas que terminan en conectores o preposiciones (ej: "más grande de", "gestión de la", "con el")
  s = s.replace(/\s+(?:de|la|el|los|las|del|con|en|para|por|y|o|un|una|su|sus)\s*$/i, '');

  // 4. Normalizar puntuación final
  s = s.trim();
  if (s.length > 5 && !/[.\?!:]$/.test(s) && !s.includes('|')) {
    s += '.';
  }

  return s;
}

export function repairCandidateName(name: string): string {
  if (typeof name !== 'string' || !name) return '';
  let s: string = fixMojibakeEncoding(name);
  
  // Eliminar prefijos de roles, títulos y ruidos comunes en nombres
  s = s
    .replace(/\s+-\s+.*$/, '')
    .replace(/^\b(candidato|curriculum|cv|resume|perfil|pma|pm|po|sm|qa|dev|sap|abap|btp|cpi|ingenier[ao]|licenciad[ao]|arquitect[ao]|profesional)\b[\s\:\-\_]+/i, '')
    .trim();

  // Si el nombre quedó totalmente en mayúsculas o minúsculas, darle formato Title Case apropiado
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s.toLowerCase().replace(/\b[a-záéíóúñ]/g, char => char.toUpperCase());
  }

  return s;
}

export function repairExperienceItem(expStr: string): string {
  if (typeof expStr !== 'string' || !expStr) return '';
  let s: string = fixMojibakeEncoding(expStr);

  const parts = s.split('|').map(p => cleanAndRepairText(p));
  
  if (parts.length >= 4) {
    // Puesto | Empresa | Periodo | Responsabilidades y Logros
    let position = parts[0];
    let company = parts[1];
    let period = parts[2];
    let details = parts.slice(3).join(' | ');

    // Si la empresa quedó como "Empresa Líder" o vacía y en el puesto venía la empresa (ej: "PROJECT MANAGER - ALTAN REDES")
    if ((company.toLowerCase().includes('empresa líder') || company.toLowerCase().includes('empresa destacada')) && position.includes(' - ')) {
      const pSub = position.split(' - ');
      position = pSub[0].trim();
      company = pSub.slice(1).join(' - ').trim();
    }

    if (period.toLowerCase() === 'periodo profesional') {
      const yearMatch = details.match(/\b(20\d{2}\s*[-–\s]\s*(?:20\d{2}|presente|actual)?)\b/i) || position.match(/\b(20\d{2}\s*[-–\s]\s*(?:20\d{2}|presente|actual)?)\b/i);
      if (yearMatch) {
        period = yearMatch[0].trim();
      }
    }

    return `${position} | ${company} | ${period} | ${details}`;
  }

  return parts.join(' | ');
}
