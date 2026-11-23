/** Whole numbers in Spanish words, for receipts: 15000 → "quince mil", 1250000 → "un millón doscientos cincuenta mil". */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DIEZ_A_VEINTINUEVE = [
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos',
];

/**
 * 1–999. With apocope, a trailing "uno" becomes "un" (veintiún mil, un millón), as it is said
 * before "mil" and "millones".
 */
function menorQueMil(n: number, apocope: boolean): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    let t: string;
    if (resto < 10) t = UNIDADES[resto];
    else if (resto < 30) t = DIEZ_A_VEINTINUEVE[resto - 10];
    else {
      const u = resto % 10;
      t = DECENAS[Math.floor(resto / 10)] + (u ? ' y ' + UNIDADES[u] : '');
    }
    if (apocope) t = t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    partes.push(t);
  }
  return partes.join(' ');
}

/** 1–999.999. */
function menorQueMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles) partes.push(miles === 1 ? 'mil' : menorQueMil(miles, true) + ' mil');
  if (resto) partes.push(menorQueMil(resto, apocope));
  return partes.join(' ');
}

/** 0 to 999.999.999.999, in lower case. Negative numbers and decimals are not expected (guaraníes). */
export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : menorQueMillon(millones, true) + ' millones');
  if (resto) partes.push(menorQueMillon(resto, false));
  return partes.join(' ');
}
