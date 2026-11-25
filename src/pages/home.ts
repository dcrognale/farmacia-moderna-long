import { el, clear, $ } from '../lib/dom';
import { listCategories, browseProducts } from '../lib/tiendanube/catalog';
import { productCard } from '../ui/productCard';
import { skeletonCards, emptyState, errorState } from '../ui/states';
import { describeError } from '../lib/errors';
import type { Category } from '../lib/tiendanube/types';

const ICONS = [
  'M8.5 3.5l12 12a4 4 0 0 1-5.7 5.7l-12-12A4 4 0 0 1 8.5 3.5zM6 9.5L9.5 6',
  'M12 3c3 4 6 7 6 10.5a6 6 0 0 1-12 0C6 10 9 7 12 3z',
  'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2',
  'M9 3h6v4H9zM7 7h10v14H7zM10 12h4',
  'M4.5 12.5l8-8a4.2 4.2 0 0 1 6 6l-8 8a4.2 4.2 0 0 1-6-6zM8.5 8.5l6 6',
  'M9 3h6v3H9zM10 6v2M14 6v2M6 10h12v11H6zM9 14h6',
];

function categoryTile(c: Category, i: number): HTMLElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '44', height: '44', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[i % ICONS.length] ?? ''); svg.append(path);
  return el('a', { class: 'cat', href: `catalogo.html?categoria=${encodeURIComponent(c.handle)}` }, el('span', { class: 'cat-icon' }, svg), el('span', {}, c.name));
}

async function loadCategories(host: HTMLElement): Promise<void> {
  host.setAttribute('aria-busy', 'true');
  try {
    const { data } = await listCategories();
    const top = data.filter((c) => !c.parent).slice(0, 8);
    clear(host);
    if (!top.length) { host.closest('section')?.setAttribute('hidden', ''); return; }
    host.append(...top.map(categoryTile));
  } catch { host.closest('section')?.setAttribute('hidden', ''); }
  finally { host.removeAttribute('aria-busy'); }
}

async function loadFeatured(track: HTMLElement): Promise<void> {
  const load = async (): Promise<void> => {
    clear(track); track.append(skeletonCards(5)); track.setAttribute('aria-busy', 'true');
    try {
      // Productos con precio promocional; si no hay ninguno, los más vendidos.
      let { data } = await browseProducts({ perPage: 12, hasPromotionalPrice: true });
      if (!data.length) ({ data } = await browseProducts({ perPage: 12 }));
      clear(track);
      if (!data.length) { track.append(emptyState('Pronto vas a ver productos acá', 'Estamos cargando el catálogo.')); return; }
      track.append(...data.map((p) => el('div', { class: 'card-wrap' }, productCard(p))));
    } catch (e) { clear(track); track.append(errorState(describeError(e), () => void load())); }
    finally { track.removeAttribute('aria-busy'); }
  };
  await load();
}

export function initHome(): void {
  const cats = $('[data-categories]'); if (cats) void loadCategories(cats);
  const track = $('#ns-item-list'); if (track) void loadFeatured(track);
  document.querySelectorAll<HTMLButtonElement>('[data-carousel]').forEach((b) =>
    b.addEventListener('click', () => track?.scrollBy({ left: b.dataset.carousel === 'next' ? 292 : -292, behavior: 'smooth' })));
}
