import headerHtml from '../../partials/header.html?raw';
import footerHtml from '../../partials/footer.html?raw';
import { el, $ } from '../lib/dom';
import { listCategories } from '../lib/tiendanube/catalog';
import type { Category } from '../lib/tiendanube/types';
import { initDrawer } from './drawer';

/** Inserta Header y Footer (parciales del diseño) de forma síncrona, sin parpadeo, y conecta sus datos. */
export function mountLayout(): void {
  document.querySelector('[data-include="partials/header.html"]')?.replaceWith(htmlToFragment(headerHtml));
  document.querySelector('[data-include="partials/footer.html"]')?.replaceWith(htmlToFragment(footerHtml));
  initDrawer();
  void loadNavigation();
}

function htmlToFragment(html: string): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = html; // HTML estático propio (parciales del repo), no contiene datos de la API
  return t.content;
}

const href = (c: Category) => `catalogo.html?categoria=${encodeURIComponent(c.handle)}`;

async function loadNavigation(): Promise<void> {
  const nav = $('[data-main-nav]');
  const foot = $('[data-footer-categories]');
  try {
    const { data } = await listCategories();
    const top = data.filter((c) => !c.parent);
    nav?.replaceChildren(
      ...top.slice(0, 9).map((c) => el('a', { href: href(c) }, c.name)),
      el('a', { class: 'is-accent', href: 'catalogo.html?ofertas=1' }, 'Ofertas'),
    );
    foot?.replaceChildren(...top.slice(0, 8).map((c) => el('a', { href: href(c) }, c.name)));
  } catch {
    // La navegación es secundaria: ante un fallo se ofrece el acceso mínimo, sin romper la página.
    nav?.replaceChildren(el('a', { href: 'catalogo.html' }, 'Todos los productos'));
  }
}
