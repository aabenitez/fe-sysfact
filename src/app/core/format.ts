const guaranies = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0,
});

/** Formats an amount in guaraníes, e.g. 20000 → "Gs. 20.000". */
export function formatGs(value: number | null | undefined): string {
  return guaranies.format(value ?? 0);
}
