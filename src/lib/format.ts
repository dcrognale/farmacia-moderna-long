/** Utilidades de formato. Los precios de la API son strings decimales (ej. "12345.00"). */

let currency = 'ARS';
export const setCurrency = (c: string) => { currency = c; };

export function toNumber(price: string | null | undefined): number | null {
  if (price == null || price === '') return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : null;
}

export function formatPrice(price: string | number | null | undefined, cur: string = currency): string {
  const n = typeof price === 'number' ? price : toNumber(price);
  if (n === null) return '';
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
  } catch {
    return `$${n}`;
  }
}

/** Código postal argentino: 4 dígitos (o formato CPA, ej. B1854ABC). */
export function normalizeZip(raw: string): string | null {
  const v = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^\d{4}$/.test(v) || /^[A-Z]\d{4}[A-Z]{3}$/.test(v) ? v : null;
}
