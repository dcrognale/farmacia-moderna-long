import { el, safeHttpsUrl } from '../lib/dom';
import { formatPrice, toNumber } from '../lib/format';
import { cartStore } from '../lib/cart/store';
import { describeError } from '../lib/errors';
import { toast } from './states';
import { pickDefaultVariant, hasStock, effectivePrice, discountPercent } from '../lib/variants';
import type { Product } from '../lib/tiendanube/types';

const productHref = (p: Product) => `producto.html?handle=${encodeURIComponent(p.handle)}`;

export function productCard(p: Product): HTMLElement {
  const variants = p.variants ?? [];
  const v = pickDefaultVariant(variants);
  const img = safeHttpsUrl(p.images?.find((i) => i.id === v?.image_id)?.src ?? p.images?.[0]?.src);
  const price = v ? effectivePrice(v) : null;
  const off = v ? discountPercent(v) : 0;
  const soldOut = !v || !hasStock(v);
  const needsChoice = variants.length > 1;

  const media = el('a', { class: 'card-media', href: productHref(p), tabindex: '-1', 'aria-hidden': 'true' },
    img ? el('img', { src: img, alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 480 }) : null,
    off > 0 ? el('span', { class: 'card-off' }, `${off}% OFF`) : null,
    soldOut ? el('span', { class: 'card-off card-soldout' }, 'Sin stock') : null,
  );

  const priceBox = el('div', { class: 'card-price' },
    price !== null ? el('span', { class: 'now' }, `${needsChoice ? 'Desde ' : ''}${formatPrice(price)}`) : el('span', { class: 'now' }, 'Consultar'),
    v && toNumber(v.promotional_price) !== null && toNumber(v.price) !== null ? el('s', {}, formatPrice(v.price)) : null,
  );

  const body = el('div', { class: 'card-body' },
    p.brand ? el('span', { class: 'card-brand' }, p.brand) : null,
    el('h3', { class: 'card-title' }, el('a', { href: productHref(p) }, p.name)),
    priceBox,
  );

  // Con una sola variante se agrega directo; con varias se lleva a elegir (UX: nunca agregar una variante al azar).
  if (needsChoice || !v) {
    body.append(el('a', { class: 'add add-link', href: productHref(p) }, 'Ver opciones'));
  } else {
    const btn = el('button', { type: 'button', class: 'add', disabled: soldOut }, soldOut ? 'Sin stock' : 'Agregar al carrito');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Agregando…';
      try { await cartStore.add(p, v, 1); toast(`Agregaste “${p.name}” al carrito`); }
      catch (e) { toast(describeError(e), 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Agregar al carrito'; }
    });
    body.append(btn);
  }
  return el('article', { class: 'card' }, media, body);
}
