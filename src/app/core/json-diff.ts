/**
 * Compares two JSON values (the record before and after a change in the audit log) and produces:
 *  - the list of changes (what was modified, added or removed), and
 *  - both values pretty-printed line by line, each line marked with its state, to highlight them.
 *
 * Array items are matched by meaning, not by position: invoice lines by their article
 * (articulo.id), other objects by id. So "Abono Grande 2 → 1" shows as a modified quantity, not as
 * a removed line plus an added one (sale lines get new ids every time the sale is edited).
 */

export type EstadoDiff = 'igual' | 'modificado' | 'agregado' | 'quitado';

export interface LineaDiff {
  texto: string;
  nivel: number;
  estado: EstadoDiff;
}

export interface CambioDiff {
  tipo: Exclude<EstadoDiff, 'igual'>;
  /** Readable location, e.g. "cliente.nombres" or "detallesVenta[Abono Grande].cantidad". */
  ruta: string;
  antes?: string;
  despues?: string;
}

export interface ResultadoDiff {
  cambios: CambioDiff[];
  antes: LineaDiff[];
  despues: LineaDiff[];
}

type Json = unknown;

interface Nodo {
  /** Primitive value as JSON text; undefined for objects and arrays. */
  valor?: string;
  /** Readable path, used in the list of changes. */
  ruta: string;
}

const esObjeto = (v: Json): v is Record<string, Json> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Key and label of an array item: by article, then by id, then by position. */
function claveElemento(item: Json, i: number): { clave: string; etiqueta: string } {
  if (esObjeto(item)) {
    const art = item['articulo'];
    if (esObjeto(art) && art['id'] !== undefined && art['id'] !== null) {
      const nombre = typeof art['nombre'] === 'string' ? (art['nombre'] as string).trim() : `artículo ${art['id']}`;
      return { clave: `articulo:${art['id']}`, etiqueta: nombre };
    }
    if (item['id'] !== undefined && item['id'] !== null) {
      return { clave: `id:${item['id']}`, etiqueta: `#${item['id']}` };
    }
  }
  return { clave: `i:${i}`, etiqueta: String(i + 1) };
}

/** Every node of the value, by internal path. */
function aplanar(v: Json, clave = '$', ruta = '', out = new Map<string, Nodo>()): Map<string, Nodo> {
  if (Array.isArray(v)) {
    out.set(clave, { ruta });
    const usadas = new Set<string>();
    v.forEach((item, i) => {
      let { clave: k, etiqueta } = claveElemento(item, i);
      if (usadas.has(k)) k = `${k}#${i}`; // same article twice: keep both
      usadas.add(k);
      aplanar(item, `${clave}[${k}]`, `${ruta}[${etiqueta}]`, out);
    });
  } else if (esObjeto(v)) {
    out.set(clave, { ruta });
    // Sale lines are re-created on every edit, so their own id always changes: not a real change.
    const porArticulo = /\[articulo:[^\]]+\]$/.test(clave);
    for (const [k, hijo] of Object.entries(v)) {
      if (porArticulo && k === 'id') {
        out.set(`${clave}.id`, { ruta: `${ruta}.id`, valor: '"(interno)"' });
        continue;
      }
      aplanar(hijo, `${clave}.${k}`, ruta ? `${ruta}.${k}` : k, out);
    }
  } else {
    out.set(clave, { ruta, valor: JSON.stringify(v ?? null) });
  }
  return out;
}

function estadoDe(clave: string, propio: Map<string, Nodo>, otro: Map<string, Nodo>, lado: 'antes' | 'despues'): EstadoDiff {
  const o = otro.get(clave);
  if (!o) return lado === 'antes' ? 'quitado' : 'agregado';
  const p = propio.get(clave)!;
  if (p.valor !== undefined || o.valor !== undefined) return p.valor === o.valor ? 'igual' : 'modificado';
  return 'igual';
}

/** Pretty-prints like JSON.stringify(v, null, 2), one entry per line, each with its state. */
function lineas(v: Json, propio: Map<string, Nodo>, otro: Map<string, Nodo>, lado: 'antes' | 'despues'): LineaDiff[] {
  const out: LineaDiff[] = [];
  const emitir = (val: Json, clave: string, nombre: string | null, nivel: number, coma: boolean): void => {
    const estado = estadoDe(clave, propio, otro, lado);
    const pre = nombre === null ? '' : `${JSON.stringify(nombre)}: `;
    const fin = coma ? ',' : '';
    if (Array.isArray(val) || esObjeto(val)) {
      const [abre, cierra] = Array.isArray(val) ? ['[', ']'] : ['{', '}'];
      const hijos: [string, string | null, Json][] = [];
      if (Array.isArray(val)) {
        const usadas = new Set<string>();
        val.forEach((item, i) => {
          let { clave: k } = claveElemento(item, i);
          if (usadas.has(k)) k = `${k}#${i}`;
          usadas.add(k);
          hijos.push([`${clave}[${k}]`, null, item]);
        });
      } else {
        for (const [k, h] of Object.entries(val)) hijos.push([`${clave}.${k}`, k, h]);
      }
      if (hijos.length === 0) {
        out.push({ texto: `${pre}${abre}${cierra}${fin}`, nivel, estado });
        return;
      }
      out.push({ texto: `${pre}${abre}`, nivel, estado });
      hijos.forEach(([c, n, h], i) => emitir(h, c, n, nivel + 1, i < hijos.length - 1));
      out.push({ texto: `${cierra}${fin}`, nivel, estado });
    } else {
      out.push({ texto: `${pre}${JSON.stringify(val ?? null)}${fin}`, nivel, estado });
    }
  };
  emitir(v, '$', null, 0, false);
  return out;
}

/** Topmost changed paths only: a whole added invoice line is one change, not one per field. */
function cambios(a: Map<string, Nodo>, d: Map<string, Nodo>): CambioDiff[] {
  const res: CambioDiff[] = [];
  const cubierta = (clave: string, raices: string[]) =>
    raices.some((r) => clave.startsWith(`${r}.`) || clave.startsWith(`${r}[`));
  const quitadas: string[] = [];
  const agregadasPorCambio: string[] = [];
  for (const [clave, nodo] of a) {
    const otro = d.get(clave);
    if (!otro) {
      if (cubierta(clave, quitadas)) continue;
      quitadas.push(clave);
      res.push({ tipo: 'quitado', ruta: nodo.ruta || '(todo)', antes: nodo.valor });
    } else if ((nodo.valor !== undefined || otro.valor !== undefined) && nodo.valor !== otro.valor) {
      res.push({ tipo: 'modificado', ruta: nodo.ruta || '(todo)', antes: nodo.valor ?? '{…}', despues: otro.valor ?? '{…}' });
      // A value that became an object (or the other way round): its fields are part of this change.
      quitadas.push(clave);
      agregadasPorCambio.push(clave);
    }
  }
  const agregadas: string[] = [...agregadasPorCambio];
  for (const [clave, nodo] of d) {
    if (a.has(clave) || cubierta(clave, agregadas)) continue;
    agregadas.push(clave);
    res.push({ tipo: 'agregado', ruta: nodo.ruta || '(todo)', despues: nodo.valor });
  }
  return res;
}

export function diffJson(antes: Json, despues: Json): ResultadoDiff {
  const a = aplanar(antes);
  const d = aplanar(despues);
  return { cambios: cambios(a, d), antes: lineas(antes, a, d, 'antes'), despues: lineas(despues, d, a, 'despues') };
}

/** Plain pretty-print, every line unmarked (when there is nothing to compare against). */
export function lineasJson(v: Json): LineaDiff[] {
  const m = aplanar(v);
  return lineas(v, m, m, 'antes');
}
