/** Sanitizador por lista blanca para la descripción HTML de productos (nunca se inserta HTML crudo de la API). */
const ALLOWED = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'H2', 'H3', 'H4', 'A', 'SPAN', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH']);

function clean(node: Node, out: Node): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) { out.appendChild(document.createTextNode(child.textContent ?? '')); return; }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const src = child as Element;
    if (!ALLOWED.has(src.tagName)) {
      // Etiquetas no permitidas (script, style, img, iframe…): se descartan; el texto de las inofensivas se conserva.
      if (!['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'FORM'].includes(src.tagName.toUpperCase())) clean(src, out);
      return;
    }
    const copy = document.createElement(src.tagName.toLowerCase());
    if (src.tagName === 'A') {
      const h = src.getAttribute('href') ?? '';
      try { const u = new URL(h, location.href); if (u.protocol === 'https:' || u.protocol === 'http:') { copy.setAttribute('href', u.toString()); copy.setAttribute('rel', 'noopener noreferrer nofollow'); copy.setAttribute('target', '_blank'); } } catch { /* sin href */ }
    }
    clean(src, copy);
    out.appendChild(copy);
  });
}

export function sanitizeHtml(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(html, 'text/html'); // el parseo no ejecuta scripts ni carga recursos
  const frag = document.createDocumentFragment();
  clean(doc.body, frag);
  return frag;
}
