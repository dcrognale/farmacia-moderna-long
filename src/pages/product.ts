import { el, clear, $, safeHttpsUrl } from '../lib/dom';
import { formatPrice, normalizeZip, toNumber } from '../lib/format';
import { getProduct } from '../lib/tiendanube/catalog';
import { getShippingOptions } from '../lib/tiendanube/shipping';
import { ApiError } from '../lib/tiendanube/client';
import { cartStore } from '../lib/cart/store';
import { describeError } from '../lib/errors';
import { sanitizeHtml } from '../lib/sanitize';
import { attributeOptions, discountPercent, effectivePrice, hasStock, maxQuantity, optionAvailable, pickDefaultVariant, resolveVariant, variantImage, visibleVariants } from '../lib/variants';
import { emptyState, errorState, toast } from '../ui/states';
import { openDrawer } from '../ui/drawer';
import type { Product, ShippingOption, Variant } from '../lib/tiendanube/types';

export function initProduct(): void {
  const found = $('[data-product]'); if (!found) return;
  const host: HTMLElement = found;
  const handle = new URLSearchParams(location.search).get('handle') ?? '';
  if (!/^[\w.-]{1,200}$/.test(handle)) { host.replaceChildren(emptyState('No encontramos ese producto', 'El enlace puede estar incompleto.', { label: 'Ver productos', href: 'catalogo.html' })); return; }

  let product: Product;
  let selection: string[] = [];
  let qty = 1;
  let imageId: number | null = null;
  let adding = false;
  let zip = '';
  let ship: { status: 'idle' | 'loading' | 'ok' | 'error'; options: ShippingOption[]; message: string } = { status: 'idle', options: [], message: '' };

  const skeleton = () => host.replaceChildren(el('div', { class: 'pdp pdp-skeleton', 'aria-busy': 'true', 'aria-label': 'Cargando producto' }, el('div', { class: 'skeleton pdp-sk-img' }), el('div', { class: 'pdp-sk-info' }, el('span', { class: 'skeleton sk-line sk-short' }), el('span', { class: 'skeleton sk-line' }), el('span', { class: 'skeleton sk-line sk-short' }), el('span', { class: 'skeleton sk-btn' }))));

  async function load(): Promise<void> {
    skeleton();
    try {
      product = await getProduct(handle);
      const first = pickDefaultVariant(visibleVariants(product));
      selection = first ? [...first.values] : [];
      document.title = `${product.name} — Farmacia Moderna`;
      render();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) host.replaceChildren(emptyState('No encontramos ese producto', 'Puede que ya no esté disponible.', { label: 'Ver productos', href: 'catalogo.html' }));
      else host.replaceChildren(errorState(describeError(e), () => void load()));
    }
  }

  const current = (): Variant | undefined => resolveVariant(product, selection);

  function choose(index: number, value: string): void {
    const next = [...selection]; next[index] = value;
    if (!resolveVariant(product, next)) {
      // Combinación inexistente: tomamos la primera variante (preferentemente con stock) que tenga ese valor.
      const vs = visibleVariants(product).filter((v) => v.values[index] === value);
      const match = vs.find(hasStock) ?? vs[0];
      if (match) { selection = [...match.values]; } else return;
    } else selection = next;
    const v = current();
    imageId = v?.image_id ?? imageId;
    qty = Math.min(qty, Math.max(1, v ? maxQuantity(v) : 1));
    ship = { status: 'idle', options: [], message: '' };
    render();
  }

  async function quote(v: Variant): Promise<void> {
    const z = normalizeZip(zip);
    if (!z) { ship = { status: 'error', options: [], message: 'Ingresá un código postal válido (ej. 1854).' }; render('fm-zip'); return; }
    ship = { status: 'loading', options: [], message: '' }; render();
    try {
      const r = await getShippingOptions({ zipCode: z, variantId: v.id, quantity: qty });
      ship = { status: 'ok', options: r.shipping_options, message: r.shipping_options.length ? '' : 'No hay envíos disponibles para ese código postal.' };
    } catch (e) { ship = { status: 'error', options: [], message: describeError(e) }; }
    render('fm-zip');
  }

  async function add(v: Variant): Promise<void> {
    adding = true; render();
    try { await cartStore.add(product, v, qty); toast('Agregado al carrito'); openDrawer(); }
    catch (e) { toast(describeError(e), 'error'); }
    finally { adding = false; render(); }
  }

  function render(focusId?: string): void {
    const v = current();
    const active = focusId ?? (document.activeElement instanceof HTMLElement ? document.activeElement.id : '');
    const images = product.images ?? [];
    const shown = images.find((i) => i.id === imageId) ?? variantImage(product, v);
    const mainSrc = safeHttpsUrl(shown?.src);

    const thumbs = images.length > 1 ? el('div', { class: 'pdp-thumbs', role: 'list' }, ...images.slice(0, 8).map((i) => {
      const src = safeHttpsUrl(i.src); if (!src) return null;
      const b = el('button', { type: 'button', class: 'pdp-thumb', 'aria-label': `Ver imagen ${images.indexOf(i) + 1}`, 'aria-pressed': String(i.id === shown?.id), role: 'listitem' }, el('img', { src, alt: '', width: 72, height: 72, loading: 'lazy' }));
      b.addEventListener('click', () => { imageId = i.id; render(); });
      return b;
    })) : null;

    const gallery = el('div', { class: 'pdp-gallery' },
      el('div', { class: 'pdp-main-img' }, mainSrc ? el('img', { src: mainSrc, alt: shown?.alt || product.name, width: 720, height: 720, decoding: 'async' }) : null),
      thumbs);

    const price = v ? effectivePrice(v) : null;
    const list = v ? toNumber(v.compare_at_price) ?? toNumber(v.price) : null;
    const off = v ? discountPercent(v) : 0;

    const groups = attributeOptions(product).map((attr, i) => {
      const gid = `fm-attr-${i}`;
      return el('div', { class: 'opt-group', role: 'radiogroup', 'aria-labelledby': gid },
        el('span', { id: gid, class: 'opt-label' }, attr.name, ': ', el('strong', {}, selection[i] ?? 'Elegí una opción')),
        el('div', { class: 'opt-values' }, ...attr.values.map((val) => {
          const ok = optionAvailable(product, selection, i, val);
          const b = el('button', { type: 'button', class: `opt${ok ? '' : ' is-unavailable'}`, role: 'radio', 'aria-checked': String(selection[i] === val), 'aria-label': ok ? val : `${val} (sin stock)` }, val);
          b.addEventListener('click', () => choose(i, val));
          return b;
        })));
    });

    const inStock = !!v && hasStock(v);
    const max = v ? maxQuantity(v) : 0;
    const dec = el('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Menos unidades', disabled: qty <= 1 }, '−');
    const inc = el('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Más unidades', disabled: qty >= max }, '+');
    dec.addEventListener('click', () => { qty = Math.max(1, qty - 1); ship = { status: 'idle', options: [], message: '' }; render(); });
    inc.addEventListener('click', () => { qty = Math.min(max, qty + 1); ship = { status: 'idle', options: [], message: '' }; render(); });

    const addBtn = el('button', { type: 'button', class: 'btn btn-block', disabled: !v || !inStock || adding }, !v ? 'Elegí una opción' : !inStock ? 'Sin stock' : adding ? 'Agregando…' : 'Agregar al carrito');
    if (v) addBtn.addEventListener('click', () => void add(v));

    const stockMsg = !v ? 'Esa combinación no está disponible.' : !inStock ? 'Sin stock por el momento.' : v.stock_management && v.stock !== null && v.stock <= 5 ? `¡Quedan solo ${v.stock}!` : 'Stock disponible';

    const zipInput = el('input', { id: 'fm-zip', type: 'text', maxlength: 8, autocomplete: 'postal-code', placeholder: 'Tu código postal', value: zip });
    zipInput.addEventListener('input', () => { zip = zipInput.value; });
    const zipBtn = el('button', { type: 'submit', class: 'btn btn-sm btn-outline', disabled: !v || !inStock || ship.status === 'loading' }, ship.status === 'loading' ? 'Calculando…' : 'Calcular');
    const zipForm = el('form', { class: 'inline-form' }, el('label', { for: 'fm-zip', class: 'visually-hidden' }, 'Código postal para calcular el envío'), zipInput, zipBtn);
    zipForm.addEventListener('submit', (e) => { e.preventDefault(); if (v) void quote(v); });

    const info = el('div', { class: 'pdp-info' },
      product.brand ? el('span', { class: 'card-brand' }, product.brand) : null,
      el('h1', { class: 'heading pdp-title' }, product.name),
      el('div', { class: 'pdp-price' },
        el('strong', { class: 'now' }, price !== null ? formatPrice(price) : 'Consultar precio'),
        off > 0 && list !== null ? el('s', {}, formatPrice(list)) : null,
        off > 0 ? el('span', { class: 'pdp-off' }, `${off}% OFF`) : null),
      product.free_shipping ? el('p', { class: 'pdp-free' }, 'Envío gratis en este producto') : null,
      ...groups,
      el('div', { class: 'opt-group' }, el('span', { class: 'opt-label' }, 'Cantidad'), el('div', { class: 'qty', role: 'group', 'aria-label': 'Cantidad' }, dec, el('span', { class: 'qty-n', 'aria-live': 'polite' }, String(qty)), inc)),
      el('p', { class: `pdp-stock${inStock ? '' : ' is-out'}`, role: 'status' }, stockMsg),
      addBtn,
      el('section', { class: 'drawer-sec', 'aria-labelledby': 'fm-pdp-ship' },
        el('h2', { id: 'fm-pdp-ship', class: 'sec-title' }, 'Calculá tu envío'), zipForm,
        ship.status === 'error' || (ship.status === 'ok' && ship.message) ? el('p', { class: 'hint hint-error', role: 'alert' }, ship.message) : null,
        ship.status === 'ok' && ship.options.length ? el('ul', { class: 'ship-list' }, ...ship.options.map((o) => el('li', {}, el('span', {}, o.name, o.detail ? el('small', {}, ` ${o.detail}`) : null), el('strong', {}, toNumber(o.price) === 0 ? 'Gratis' : formatPrice(o.price))))) : null),
    );

    const desc = product.description ? el('section', { class: 'pdp-desc prose', 'aria-labelledby': 'fm-pdp-desc' }, el('h2', { id: 'fm-pdp-desc', class: 'sec-title' }, 'Descripción'), el('div', {}, sanitizeHtml(product.description))) : null;

    clear(host);
    host.append(el('div', { class: 'pdp' }, gallery, info));
    if (desc) host.append(desc);
    if (active) host.querySelector<HTMLElement>(`#${CSS.escape(active)}`)?.focus();
  }

  void load();
}
