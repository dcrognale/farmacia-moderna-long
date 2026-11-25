import { ApiError, NetworkError } from './tiendanube/client';

/** Traduce errores del contrato de la API a mensajes claros para el comprador. */
export function describeError(e: unknown): string {
  if (e instanceof NetworkError) return e.message;
  if (e instanceof ApiError) {
    const reason = (e.details as { reason?: string } | undefined)?.reason;
    switch (e.code) {
      case 'line_item_rejected':
        if (reason === 'out_of_stock') return 'No hay stock suficiente de este producto.';
        if (reason === 'price_unavailable') return 'Este producto no está disponible para la compra online.';
        if (reason === 'kit_not_supported') return 'Este producto (kit) todavía no se puede comprar online.';
        return 'No pudimos agregar este producto. Probá con otra variante.';
      case 'coupon_rejected':
        return 'El cupón no es válido o no aplica a tu carrito.';
      case 'cart_empty':
        return 'Tu carrito está vacío.';
      case 'cart_locked':
        return 'Tenés un pago en curso con este carrito. Terminalo o empezá un carrito nuevo.';
      case 'cart_not_found':
        return 'Tu carrito venció. Armamos uno nuevo, volvé a agregar tus productos.';
      case 'cart_conflict':
      case 'rate_limit_exceeded':
        return 'Hay mucho movimiento. Esperá un momento e intentá de nuevo.';
      case 'invalid_postal_code':
        return 'No reconocemos ese código postal.';
      case 'product_not_found':
      case 'resource_not_found':
        return 'No encontramos lo que buscabas.';
      default:
        if (e.status === 422 && /zip|postal/i.test(e.message)) return 'No reconocemos ese código postal.';
        if (e.status === 429) return 'Hay mucho movimiento. Esperá un momento e intentá de nuevo.';
        if (e.status === 403) return 'La tienda no está disponible en este momento.';
        if (e.isServerError) return 'Tiendanube tuvo un problema. Intentá de nuevo en unos segundos.';
        return 'Algo salió mal. Intentá de nuevo.';
    }
  }
  return 'Algo salió mal. Intentá de nuevo.';
}
