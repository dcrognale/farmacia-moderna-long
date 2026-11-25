import { el, clear, $, debounce } from '../lib/dom';
import { listCategories, searchProducts, browseProducts, getCategoryByHandle } from '../lib/tiendanube/catalog';
import { productCard } from '../ui/productCard';
import { skeletonCards, emptyState, errorState } from '../ui/states';
import { describeError } from '../lib/errors';
import type { Category, ProductList } from '../lib/tiendanube/types';

const SORTS = [
  ['', 'Más relevantes'], ['best-selling', 'Más vendidos'], ['price-ascending', 'Menor precio'], ['price-descending', 'Mayor precio'], ['alpha-ascending', 'A – Z'], ['created-at-descending', 'Más nuevos'],
] as const;
type Sort = (typeof SORTS)[number][0];
const PER_PAGE = 12;

interface State { q: string; categoria: string; ofertas: boolean; sort: Sort; page: number }

function readUrl(): State {
  const u = new URLSearchParams(location.search);
  const sort = u.get('orden') ?? '';
  const page = Number(u.get('pagina'));
  return {
    q: (u.get('q') ?? '').slice(0, 100),
    categoria: /^[\w-]{1,100}$/.test(u.get('categoria') ?? '') ? (u.get('categoria') as string) : '',
    ofertas: u.get('ofertas') === '1',
    sort: SORTS.some(([v]) => v === sort) ? (sort as Sort) : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeUrl(s: State, mode: 'push' | 'replace'): void {
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q); if (s.categoria) u.set('categoria', s.categoria); if (s.ofertas) u.set('ofertas', '1');
  if (s.sort) u.set('orden', s.sort); if (s.page > 1) u.set('pagina', String(s.page));
  const qs = u.toString();
  history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', qs ? `?${qs}` : location.pathname);
}

export function initCatalog(): void {
  const host = $('[data-catalog]'); if (!host) return;
  let state = readUrl();
  let categories: Category[] = [];
  let ctrl: AbortController | undefined;

  const title = $('[data-catalog-title]')!;
  const count = $('[data-catalog-count]')!;
  const grid = $('[data-catalog-grid]')!;
  const pager = $('[data-catalog-pager]')!;
  const chips = $('[data-catalog-chips]')!;
  const search = $<HTMLInputElement>('#catalog-q')!;
  const sort = $<HTMLSelectElement>('#catalog-sort')!;

  sort.replaceChildren(...SORTS.map(([v, l]) => el('option', { value: v }, l)));
  search.value = state.q; sort.value = state.sort;

  const go = (patch: Partial<State>, mode: 'push' | 'replace' = 'push') => { state = { ...state, page: 1, ...patch }; writeUrl(state, mode); void load(); };

  function renderChips(): void {
    const all = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(!state.categoria && !state.ofertas) }, 'Todos');
    all.addEventListener('click', () => go({ categoria: '', ofertas: false }));
    const offers = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.ofertas) }, 'Ofertas');
    offers.addEventListener('click', () => go({ ofertas: true, categoria: '', q: '' }));
    const cats = categories.filter((c) => !c.parent).map((c) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.categoria === c.handle) }, c.name);
      b.addEventListener('click', () => go({ categoria: c.handle, ofertas: false }));
      return b;
    });
    clear(chips); chips.append(all, offers, ...cats);
  }

  function renderPager(r: ProductList): void {
    clear(pager);
    const { page, total_pages } = r.pagination;
    if (total_pages <= 1) return;
    const mk = (label: string, to: number, disabled: boolean) => {
      const b = el('button', { type: 'button', class: 'btn btn-sm btn-outline', disabled }, label);
      b.addEventListener('click', () => { state = { ...state, page: to }; writeUrl(state, 'push'); void load(); title.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      return b;
    };
    pager.append(mk('← Anterior', page - 1, page <= 1), el('span', { class: 'pager-info' }, `Página ${page} de ${total_pages}`), mk('Siguiente →', page + 1, page >= total_pages));
  }

  async function load(): Promise<void> {
    ctrl?.abort(); ctrl = new AbortController();
    const signal = ctrl.signal;
    renderChips();
    search.value = state.q; sort.value = state.sort;
    clear(grid); grid.append(skeletonCards(8)); clear(pager); grid.setAttribute('aria-busy', 'true');
    count.textContent = 'Cargando…';
    const current = categories.find((c) => c.handle === state.categoria);
    title.textContent = state.q ? `Resultados para “${state.q}”` : state.ofertas ? 'Ofertas' : current?.name ?? 'Todos los productos';
    document.title = `${title.textContent} — Farmacia Moderna`;
    try {
      let categoryId: number | undefined;
      if (state.categoria) {
        const cat = current ?? (await getCategoryByHandle(state.categoria, signal));
        if (!cat) { clear(grid); count.textContent = ''; grid.append(emptyState('No encontramos esa categoría', 'Probá con otra o mirá todo el catálogo.', { label: 'Ver todos los productos', href: 'catalogo.html' })); return; }
        categoryId = cat.id; title.textContent = cat.name;
      }
      const r = state.ofertas && !state.q
        ? await browseProducts({ page: state.page, perPage: PER_PAGE, hasPromotionalPrice: true }, signal)
        : await searchProducts({ q: state.q, categoryId, sortBy: state.sort || undefined, page: state.page, perPage: PER_PAGE }, signal);
      if (signal.aborted) return;
      clear(grid);
      const n = r.pagination.total;
      count.textContent = `${n} ${n === 1 ? 'producto' : 'productos'}`;
      if (!r.data.length) {
        grid.append(emptyState(state.q ? `No encontramos resultados para “${state.q}”` : 'Todavía no hay productos acá', 'Revisá la ortografía, probá con otra palabra o explorá las categorías.', { label: 'Ver todos los productos', href: 'catalogo.html' }));
        return;
      }
      grid.append(...r.data.map((p) => el('div', { class: 'card-wrap' }, productCard(p))));
      renderPager(r);
    } catch (e) {
      if (signal.aborted) return;
      clear(grid); count.textContent = '';
      grid.append(errorState(describeError(e), () => void load()));
    } finally { if (!signal.aborted) grid.removeAttribute('aria-busy'); }
  }

  // Buscador con debounce: actualiza resultados mientras se escribe sin recargar la página.
  const onType = debounce(() => go({ q: search.value.trim(), ofertas: false }, 'replace'), 350);
  search.addEventListener('input', onType);
  $<HTMLFormElement>('#catalog-search-form')?.addEventListener('submit', (e) => { e.preventDefault(); go({ q: search.value.trim(), ofertas: false }); });
  sort.addEventListener('change', () => go({ sort: sort.value as Sort }));
  window.addEventListener('popstate', () => { state = readUrl(); void load(); });

  void (async () => {
    try { categories = (await listCategories()).data; } catch { /* los filtros por categoría son opcionales */ }
    await load();
  })();
}
