# Farmacia Moderna — frontend headless (Tiendanube)

Sitio estático en HTML/CSS + TypeScript estricto (Vite). Catálogo, carrito y cotización de envío viven acá; el pago final ocurre en el checkout alojado de Tiendanube.

## Puesta en marcha

```bash
cp .env.example .env.local   # completá VITE_TIENDANUBE_STORE_ID
npm install
npm run dev                  # desarrollo
npm run build                # typecheck + build a dist/
```

## Integración con la Storefront API

Contrato: <https://storefront-api.tiendanube.com/docs> (OpenAPI en `/openapi.json`). Acceso público (sin token): **el navegador no puede enviar tokens**.

| Módulo | Endpoint |
| --- | --- |
| Categorías | `GET /categories` |
| Listado / búsqueda | `GET /products`, `GET /search/products` |
| Detalle (PDP) | `GET /products/{id_or_handle}` |
| Envío | `POST /shipping-options` (una variante por vez) |
| Carrito | `POST /carts`, `POST/PATCH/DELETE /carts/{id}/line-items`, `POST/DELETE /carts/{id}/coupons` |
| Checkout | `POST /carts/{id}/checkout` → `checkout_url` |

La API **sí** ofrece carritos del lado de Tiendanube (recalcula precios y promociones); el `cart.id` se guarda en `localStorage` junto con una copia para pintar rápido. La API habilitada por tienda: pedirla a Tiendanube.
