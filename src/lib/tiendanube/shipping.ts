import { request } from './client';
import type { ShippingOptionsResponse } from './types';

/** La API cotiza una variante por vez (`variant_id` + `quantity`), no una lista de ítems. */
export const getShippingOptions = (input: { zipCode: string; variantId: number; quantity: number }, signal?: AbortSignal) =>
  request<ShippingOptionsResponse>('POST', '/shipping-options', {
    body: { zip_code: input.zipCode, variant_id: input.variantId, quantity: input.quantity },
    signal,
    retries: 1, // cotizar no tiene efectos
  });
