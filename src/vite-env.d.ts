/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIENDANUBE_STORE_ID?: string;
  readonly VITE_TIENDANUBE_API_VERSION?: string;
  readonly VITE_CHECKOUT_ALLOWED_HOSTS?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }

declare module '*.html?raw' {
  const html: string;
  export default html;
}
