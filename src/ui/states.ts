import { el } from '../lib/dom';

/** Estados de carga / vacío / error reutilizables. */

export function skeletonCards(n: number): DocumentFragment {
  const f = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    f.append(el('div', { class: 'card card-skeleton', 'aria-hidden': 'true' },
      el('div', { class: 'card-media skeleton' }),
      el('div', { class: 'card-body' }, el('span', { class: 'skeleton sk-line sk-short' }), el('span', { class: 'skeleton sk-line' }), el('span', { class: 'skeleton sk-line sk-short' }), el('span', { class: 'skeleton sk-btn' })),
    ));
  }
  return f;
}

export function emptyState(title: string, text: string, action?: { label: string; href: string }): HTMLElement {
  return el('div', { class: 'state', role: 'status' },
    el('h3', { class: 'state-title' }, title),
    el('p', { class: 'state-text' }, text),
    action ? el('a', { class: 'btn', href: action.href }, action.label) : null,
  );
}

export function errorState(message: string, onRetry: () => void): HTMLElement {
  const btn = el('button', { type: 'button', class: 'btn' }, 'Reintentar');
  btn.addEventListener('click', onRetry);
  return el('div', { class: 'state state-error', role: 'alert' },
    el('h3', { class: 'state-title' }, 'No pudimos cargar esto'),
    el('p', { class: 'state-text' }, message),
    btn,
  );
}

let toastTimer: number | undefined;
/** Aviso breve y accesible (aria-live) para confirmaciones, p. ej. "Agregado al carrito". */
export function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  let host = document.getElementById('fm-toast');
  if (!host) {
    host = el('div', { id: 'fm-toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  host.className = `toast toast-${kind} is-visible`;
  host.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => host?.classList.remove('is-visible'), 3500);
}
