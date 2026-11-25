import { el, clear, safeHttpsUrl } from '../lib/dom';
import { formatPrice, normalizeZip, toNumber } from '../lib/format';
import { cartStore, type CartState } from '../lib/cart/store';
import { describeError } from '../lib/errors';
import { validateCheckoutUrl } from '../lib/checkout';
import { getShippingOptions } from '../lib/tiendanube/shipping';
import type { CartLineItem, ShippingOption } from '../lib/tiendanube/types';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

let root: HTMLElement | null = null;
let lastFocus: HTMLElement | null = null;
let shippingZip = '';
let shipping: { status: 'idle' | 'loading' | 'ok' | 'error'; options: ShippingOption[]; message: string; key: string } = { status: 'idle', options: [], message: '', key: '' };
let checkingOut = false;
let localMessage = '';

export function initDrawer(): void {
  if (root) return;
  root = el('div', { class: 'drawer-root', hidden: true });
  document.body.append(root);
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-cart-open]')) openDrawer(e.target instanceof HTMLElement ? e.target : undefined);
  });
  cartStore.subscribe((s) => {
    document.querySelectorAll('[data-cart-count]').forEach((b) => { b.textContent = String(s.cart?.total_quantity ?? 0); });
    if (root && !root.hidden) render(s);
  });
  void cartStore.refresh(); // precios y stock vigentes
}

export function openDrawer(from?: HTMLElement): void {
  if (!root) return;
  lastFocus = (from?.closest('button,a') as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
  root.hidden = false;
  document.body.classList.add('no-scroll');
  render(cartStore.snapshot);
  root.querySelector<HTMLElement>('.drawer')?.focus();
  void cartStore.refresh();
}

export function closeDrawer(): void {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('no-scroll');
  localMessage = '';
  cartStore.clearError();
  lastFocus?.focus();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
  if (e.key !== 'Tab' || !root) return;
  const items = [...root.querySelectorAll<HTMLElement>('.drawer ' + FOCUSABLE)].filter((n) => n.offsetParent !== null);
  const first = items[0], last = items[items.length - 1];
  if (!first || !last) return;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function icon(path: string): SVGElement {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); s.append(p);
  return s;
}

function lineItem(item: CartLineItem, busy: boolean): HTMLElement {
  const src = safeHttpsUrl(item.image?.src);
  const options = item.variant_options.map((o) => o.value).filter(Boolean).join(' · ');
  const canQty = item.instructions.can_update_quantity && !busy;

  const dec = el('button', { type: 'button', class: 'qty-btn', 'aria-label': `Quitar una unidad de ${item.name}`, disabled: !canQty }, icon('M5 12h14'));
  const inc = el('button', { type: 'button', class: 'qty-btn', 'aria-label': `Agregar una unidad de ${item.name}`, disabled: !canQty }, icon('M12 5v14M5 12h14'));
  dec.addEventListener('click', () => act(() => cartStore.setQuantity(item, item.quantity - 1)));
  inc.addEventListener('click', () => act(() => cartStore.setQuantity(item, item.quantity + 1)));
  const rm = el('button', { type: 'button', class: 'link-btn', disabled: !item.instructions.can_remove || busy }, 'Quitar');
  rm.addEventListener('click', () => act(() => cartStore.remove(item)));

  const was = toNumber(item.cost.compare_at_unit_price);
  return el('li', { class: 'line' },
    el('div', { class: 'line-img' }, src ? el('img', { src, alt: '', width: 72, height: 72, loading: 'lazy' }) : null),
    el('div', { class: 'line-main' },
      el('p', { class: 'line-name' }, item.name),
      options ? el('p', { class: 'line-opts' }, options) : null,
      item.is_gift ? el('p', { class: 'line-opts' }, 'Regalo') : null,
      el('div', { class: 'line-row' },
        el('div', { class: 'qty', role: 'group', 'aria-label': `Cantidad de ${item.name}` }, dec, el('span', { class: 'qty-n', 'aria-live': 'polite' }, String(item.quantity)), inc),
        el('div', { class: 'line-price' },
          was !== null && was > (toNumber(item.cost.unit_price) ?? 0) ? el('s', {}, formatPrice(was)) : null,
          el('strong', {}, formatPrice(item.cost.total)),
        ),
      ),
      rm,
    ),
  );
}

async function act(fn: () => Promise<unknown>): Promise<void> {
  localMessage = '';
  try { await fn(); } catch { /* el store ya dejó el mensaje en state.error */ }
}

function couponBox(s: CartState): HTMLElement {
  const applied = s.cart?.coupons[0];
  if (applied) {
    const rm = el('button', { type: 'button', class: 'link-btn' }, 'Quitar');
    rm.addEventListener('click', () => act(() => cartStore.removeCoupon(applied.id)));
    return el('div', { class: 'coupon-applied' }, el('span', {}, 'Cupón ', el('strong', {}, applied.code), ' aplicado'), rm);
  }
  const input = el('input', { id: 'fm-coupon', type: 'text', maxlength: 40, autocomplete: 'off', autocapitalize: 'characters', placeholder: 'Código de cupón' });
  const btn = el('button', { type: 'submit', class: 'btn btn-sm btn-outline', disabled: s.busy }, 'Aplicar');
  const form = el('form', { class: 'inline-form' }, el('label', { for: 'fm-coupon', class: 'visually-hidden' }, 'Cupón de descuento'), input, btn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!/^[\w-]{2,40}$/.test(code)) { localMessage = 'Ingresá un código de cupón válido.'; render(cartStore.snapshot); return; }
    void act(() => cartStore.applyCoupon(code));
  });
  return form;
}

async function quote(variantId: number, quantity: number): Promise<void> {
  const zip = normalizeZip(shippingZip);
  if (!zip) { shipping = { status: 'error', options: [], message: 'Ingresá un código postal válido (ej. 1854).', key: '' }; render(cartStore.snapshot); return; }
  shipping = { status: 'loading', options: [], message: '', key: '' };
  render(cartStore.snapshot);
  try {
    const r = await getShippingOptions({ zipCode: zip, variantId, quantity });
    shipping = { status: 'ok', options: r.shipping_options, message: r.shipping_options.length ? '' : 'No hay envíos disponibles para ese código postal.', key: `${variantId}:${quantity}:${zip}` };
  } catch (e) {
    shipping = { status: 'error', options: [], message: describeError(e), key: '' };
  }
  render(cartStore.snapshot);
}

/** La API cotiza una variante por vez: la estimación es exacta solo con un único producto en el carrito. */
function shippingBox(s: CartState): HTMLElement {
  const items = s.cart?.line_items ?? [];
  const single = items.length === 1 ? items[0] : undefined;
  if (!single) return el('p', { class: 'hint' }, 'El costo de envío se calcula en el checkout, según tu dirección.');
  const input = el('input', { id: 'fm-zip', type: 'text', inputmode: 'text', maxlength: 8, autocomplete: 'postal-code', placeholder: 'Tu código postal', value: shippingZip });
  input.addEventListener('input', () => { shippingZip = input.value; });
  const btn = el('button', { type: 'submit', class: 'btn btn-sm btn-outline', disabled: shipping.status === 'loading' }, shipping.status === 'loading' ? 'Calculando…' : 'Calcular');
  const form = el('form', { class: 'inline-form' }, el('label', { for: 'fm-zip', class: 'visually-hidden' }, 'Código postal para calcular el envío'), input, btn);
  form.addEventListener('submit', (e) => { e.preventDefault(); void quote(single.variant_id, single.quantity); });
  const stale = shipping.status === 'ok' && shipping.key.split(':').slice(0, 2).join(':') !== `${single.variant_id}:${single.quantity}`;
  const list = shipping.status === 'ok' && !stale && shipping.options.length
    ? el('ul', { class: 'ship-list' }, ...shipping.options.map((o) => el('li', {}, el('span', {}, o.name, o.detail ? el('small', {}, ` ${o.detail}`) : null), el('strong', {}, toNumber(o.price) === 0 ? 'Gratis' : formatPrice(o.price)))))
    : null;
  return el('div', { class: 'ship' },
    form,
    shipping.status === 'error' || (shipping.status === 'ok' && shipping.message) ? el('p', { class: 'hint hint-error', role: 'alert' }, shipping.message) : null,
    stale ? el('p', { class: 'hint' }, 'Cambió tu carrito: volvé a calcular el envío.') : null,
    list,
    el('p', { class: 'hint' }, 'Estimación: el costo final se confirma en el checkout.'),
  );
}

async function goCheckout(): Promise<void> {
  checkingOut = true; localMessage = ''; render(cartStore.snapshot);
  try {
    const url = validateCheckoutUrl(await cartStore.checkoutUrl());
    window.location.assign(url);
  } catch (e) {
    checkingOut = false;
    if (!(e instanceof Error) || e.name === 'ApiError' || e.name === 'NetworkError') { /* mensaje ya en el store */ } else localMessage = 'No pudimos abrir el checkout de forma segura. Intentá de nuevo.';
    render(cartStore.snapshot);
  }
}

function render(s: CartState): void {
  if (!root) return;
  const cart = s.cart;
  const items = cart?.line_items ?? [];
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const hadFocusInside = !active || active === document.body || root.contains(active);
  const keepFocus = active && root.contains(active) ? active.id : '';

  const close = el('button', { type: 'button', class: 'drawer-close', 'aria-label': 'Cerrar carrito' }, icon('M6 6l12 12M18 6L6 18'));
  close.addEventListener('click', closeDrawer);

  const bodyContent: Array<HTMLElement | null> = [];
  const message = localMessage || s.error;
  if (message) bodyContent.push(el('div', { class: 'alert', role: 'alert' }, message,
    s.locked ? (() => { const b = el('button', { type: 'button', class: 'link-btn' }, 'Empezar un carrito nuevo'); b.addEventListener('click', () => cartStore.reset()); return b; })() : null));

  if (!items.length) {
    bodyContent.push(el('div', { class: 'state', role: 'status' },
      el('h3', { class: 'state-title' }, 'Tu carrito está vacío'),
      el('p', { class: 'state-text' }, 'Sumá productos para verlos acá.'),
      (() => { const a = el('a', { class: 'btn', href: 'catalogo.html' }, 'Ver productos'); return a; })()));
  } else {
    bodyContent.push(el('ul', { class: 'lines', 'aria-busy': s.busy ? 'true' : 'false' }, ...items.map((i) => lineItem(i, s.busy))));
    bodyContent.push(el('section', { class: 'drawer-sec', 'aria-labelledby': 'fm-sec-coupon' }, el('h3', { id: 'fm-sec-coupon' }, '¿Tenés un cupón?'), couponBox(s)));
    bodyContent.push(el('section', { class: 'drawer-sec', 'aria-labelledby': 'fm-sec-ship' }, el('h3', { id: 'fm-sec-ship' }, 'Calculá tu envío'), shippingBox(s)));
  }

  const clearBtn = el('button', { type: 'button', class: 'link-btn', disabled: s.busy }, 'Vaciar carrito');
  clearBtn.addEventListener('click', () => { if (window.confirm('¿Querés vaciar el carrito?')) void act(() => cartStore.clear()); });

  const footer = items.length && cart ? el('footer', { class: 'drawer-foot' },
    el('dl', { class: 'totals' },
      el('div', {}, el('dt', {}, 'Subtotal'), el('dd', {}, formatPrice(cart.cost.subtotal, cart.currency))),
      toNumber(cart.cost.discount) ? el('div', { class: 'disc' }, el('dt', {}, 'Descuentos'), el('dd', {}, `− ${formatPrice(cart.cost.discount, cart.currency)}`)) : null,
      cart.cost.shipping !== null ? el('div', {}, el('dt', {}, 'Envío'), el('dd', {}, formatPrice(cart.cost.shipping, cart.currency))) : null,
      el('div', { class: 'grand' }, el('dt', {}, 'Total'), el('dd', {}, formatPrice(cart.cost.total, cart.currency))),
    ),
    (() => {
      const b = el('button', { type: 'button', class: 'btn btn-block', disabled: s.busy || checkingOut || s.locked }, checkingOut ? 'Redirigiendo al pago seguro…' : 'Finalizar compra');
      b.addEventListener('click', () => void goCheckout());
      return b;
    })(),
    el('p', { class: 'hint center' }, 'Pagás de forma segura en el checkout de Tiendanube.'),
    clearBtn,
  ) : null;

  const drawer = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fm-drawer-title', tabindex: '-1' },
    el('header', { class: 'drawer-head' }, el('h2', { id: 'fm-drawer-title' }, `Tu carrito${cart?.total_quantity ? ` (${cart.total_quantity})` : ''}`), close),
    el('div', { class: 'drawer-body' }, ...bodyContent),
    footer,
  );
  const overlay = el('div', { class: 'drawer-overlay' });
  overlay.addEventListener('click', closeDrawer);
  drawer.addEventListener('keydown', onKeydown);

  clear(root);
  root.append(overlay, drawer);
  // Al re-renderizar se pierde el foco: lo devolvemos al mismo control, o al diálogo si no había uno.
  const again = keepFocus ? root.querySelector<HTMLElement>(`#${CSS.escape(keepFocus)}`) : null;
  (again ?? (hadFocusInside ? drawer : null))?.focus();
}
