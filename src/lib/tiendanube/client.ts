import { config } from '../../config';
import type { ApiErrorBody } from './types';

/** Error de red, timeout o respuesta ilegible (no hubo respuesta HTTP utilizable). */
export class NetworkError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Respuesta HTTP no-2xx de la API. `code` es el código estable del contrato (ej. `cart_not_found`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Reintentos ante fallos de red o 5xx. Solo para lecturas o escrituras idempotentes. */
  retries?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildUrl(path: string, query?: Query): string {
  const url = new URL(config.apiBaseUrl + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function once<T>(method: string, path: string, opts: RequestOptions): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), config.requestTimeoutMs);
  const onAbort = () => timeout.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    // Sin credenciales ni Authorization: la Storefront API pública es tokenless y rechaza tokens desde el navegador.
    const res = await fetch(buildUrl(path, opts.query), {
      method,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: timeout.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (res.status === 204) return undefined as T;
    let data: unknown;
    try {
      data = await res.json();
    } catch (e) {
      if (res.ok) throw new NetworkError('Respuesta inválida del servidor.', e);
    }
    if (!res.ok) {
      const err = (data as Partial<ApiErrorBody> | undefined)?.error;
      const retryAfter = Number(res.headers.get('Retry-After'));
      throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? res.statusText, err?.details, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError || e instanceof NetworkError) throw e;
    if (opts.signal?.aborted) throw e; // cancelación del llamador: se propaga tal cual
    if (timeout.signal.aborted) throw new NetworkError('La solicitud tardó demasiado. Revisá tu conexión e intentá de nuevo.', e);
    throw new NetworkError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', e);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> {
  const retries = opts.retries ?? 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await once<T>(method, path, opts);
    } catch (e) {
      const transient = e instanceof NetworkError || (e instanceof ApiError && (e.isServerError || e.status === 429));
      if (!transient || attempt >= retries || opts.signal?.aborted) throw e;
      const wait = e instanceof ApiError && e.retryAfterSec ? Math.min(e.retryAfterSec, 5) * 1000 : 400 * 2 ** attempt;
      await sleep(wait);
    }
  }
}

export const get = <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal, retries: 2 });
