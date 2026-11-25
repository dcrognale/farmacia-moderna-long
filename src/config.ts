/** Configuración leída de variables de entorno públicas (prefijo VITE_). No contiene secretos. */

function required(name: string, value: string | undefined): string {
  const v = (value ?? '').trim();
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Copiá .env.example a .env.local y completala.`);
  return v;
}

const storeId = required('VITE_TIENDANUBE_STORE_ID', import.meta.env.VITE_TIENDANUBE_STORE_ID);
if (!/^\d+$/.test(storeId)) throw new Error('VITE_TIENDANUBE_STORE_ID debe ser numérico.');

const apiVersion = (import.meta.env.VITE_TIENDANUBE_API_VERSION ?? '').trim() || '2026-11';
if (!/^[\w.-]+$/.test(apiVersion)) throw new Error('VITE_TIENDANUBE_API_VERSION tiene un formato inválido.');

export const config = {
  storeId,
  apiVersion,
  apiBaseUrl: `https://storefront-api.tiendanube.com/${apiVersion}/stores/${storeId}`,
  checkoutAllowedHosts: (import.meta.env.VITE_CHECKOUT_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
  requestTimeoutMs: 10_000,
} as const;
