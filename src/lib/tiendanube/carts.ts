import { request } from './client';
import type { Cart, CartResponse, CheckoutResponse } from './types';

/**
 * API de carritos de la Storefront API. El `cartId` es una credencial opaca: no se loguea ni va en URLs.
 * Las escrituras fijan un valor (son idempotentes), por lo que se pueden reintentar ante 5xx.
 */
const p = (cartId: string) => `/carts/${encodeURIComponent(cartId)}`;

export const createCart = async (): Promise<Cart> => (await request<CartResponse>('POST', '/carts', { body: {}, retries: 1 })).cart;

export const getCart = async (cartId: string): Promise<Cart> => (await request<CartResponse>('GET', p(cartId), { retries: 1 })).cart;

/** Fija la cantidad de la variante en el carrito (la crea si no existe). */
export const setLineItem = async (cartId: string, item: { productId: number; variantId: number; quantity: number }): Promise<Cart> =>
  (
    await request<CartResponse>('POST', `${p(cartId)}/line-items`, {
      body: { product_id: item.productId, variant_id: item.variantId, quantity: item.quantity },
      retries: 2,
    })
  ).cart;

export const updateLineItem = async (cartId: string, lineItemId: string, quantity: number): Promise<Cart> =>
  (await request<CartResponse>('PATCH', `${p(cartId)}/line-items/${encodeURIComponent(lineItemId)}`, { body: { quantity }, retries: 2 })).cart;

export const removeLineItem = async (cartId: string, lineItemId: string): Promise<Cart> =>
  (await request<CartResponse>('DELETE', `${p(cartId)}/line-items/${encodeURIComponent(lineItemId)}`, { retries: 2 })).cart;

export const applyCoupon = async (cartId: string, code: string): Promise<Cart> =>
  (await request<CartResponse>('POST', `${p(cartId)}/coupons`, { body: { code }, retries: 0 })).cart;

export const removeCoupon = async (cartId: string, couponId: string): Promise<Cart> =>
  (await request<CartResponse>('DELETE', `${p(cartId)}/coupons/${encodeURIComponent(couponId)}`, { retries: 2 })).cart;

export const startCheckout = async (cartId: string): Promise<string> =>
  (await request<CheckoutResponse>('POST', `${p(cartId)}/checkout`, { body: {}, retries: 0 })).checkout_url;
