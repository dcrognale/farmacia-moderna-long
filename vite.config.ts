import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';

// Content-Security-Policy solo en el build (en dev, Vite inyecta scripts inline para HMR).
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://*.mitiendanube.com https://*.tiendanube.com https://*.nuvemshop.com.br https://*.cloudfront.net",
  'connect-src https://storefront-api.tiendanube.com',
  "form-action 'self' https://wa.me",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html;
      return html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`);
    },
  };
}

export default defineConfig({
  plugins: [cspPlugin()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        catalogo: resolve(__dirname, 'catalogo.html'),
        producto: resolve(__dirname, 'producto.html'),
        quienes: resolve(__dirname, 'quienes-somos.html'),
        quejas: resolve(__dirname, 'libro-de-quejas.html'),
        wip: resolve(__dirname, 'en-construccion.html'),
      },
    },
  },
});
