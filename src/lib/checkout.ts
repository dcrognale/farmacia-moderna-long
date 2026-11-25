import { config } from '../config';

/**
 * Valida la URL de checkout antes de redirigir (defensa contra open redirect / respuestas manipuladas).
 * Exige https, sin credenciales embebidas y, si está configurado, un host de la lista permitida.
 */
export function validateCheckoutUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('URL de checkout inválida.'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('URL de checkout insegura.');
  const allowed = config.checkoutAllowedHosts;
  if (allowed.length && !allowed.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) throw new Error('El checkout no pertenece a un dominio permitido.');
  return u.toString();
}
