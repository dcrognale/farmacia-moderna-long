import * as api from '../tiendanube/carts';
import { ApiError } from '../tiendanube/client';
import { describeError } from '../errors';
import { config } from '../../config';
import type { Cart, CartLineItem, Product, Variant } from '../tiendanube/types';

const ID_KEY = `fm-cart-id:${config.storeId}`;
const SNAPSHOT_KEY = `fm-cart-snapshot:${config.storeId}`;

export interface CartState {
  cart: Cart | null;
  /** Hay una operación en vuelo (deshabilitar controles, mostrar progreso). */
  busy: boolean;
  /** Mensaje de error legible de la última operación, o null. */
  error: string | null;
  /** El carrito quedó bloqueado por un pago en curso. */
  locked: boolean;
}

type Listener = (s: CartState) => void;

const storage = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* modo privado / cuota */ } },
  del(k: string): void { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/** Valida lo mínimo de lo guardado: nunca se confía en datos de localStorage (pueden estar corruptos o manipulados). */
function parseSnapshot(raw: string | null): Cart | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Cart>;
    if (typeof c.id !== 'string' || !Array.isArray(c.line_items) || typeof c.total_quantity !== 'number' || !c.cost) return null;
    return c as Cart;
  } catch {
    return null;
  }
}

class CartStore {
  private state: CartState = { cart: parseSnapshot(storage.get(SNAPSHOT_KEY)), busy: false, error: null, locked: false };
  private listeners = new Set<Listener>();
  /** Cola: la API exige una escritura por vez por carrito. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    // Mantener sincronizadas varias pestañas.
    window.addEventListener('storage', (e) => {
      if (e.key === SNAPSHOT_KEY) this.set({ cart: parseSnapshot(e.newValue) });
    });
  }

  get snapshot(): CartState { return this.state; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<CartState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private persist(cart: Cart | null): void {
    if (cart) { storage.set(ID_KEY, cart.id); storage.set(SNAPSHOT_KEY, JSON.stringify(cart)); }
    else { storage.del(ID_KEY); storage.del(SNAPSHOT_KEY); }
  }

  private run<T>(op: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      this.set({ busy: true, error: null });
      try { return await op(); }
      finally { this.set({ busy: false }); }
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private apply(cart: Cart): Cart {
    this.persist(cart);
    this.set({ cart, locked: false });
    return cart;
  }

  /** Mapea errores de una operación: carrito vencido => se descarta; bloqueado => se avisa. */
  private fail(e: unknown): never {
    if (e instanceof ApiError && e.code === 'cart_not_found') { this.persist(null); this.set({ cart: null }); }
    if (e instanceof ApiError && e.code === 'cart_locked') this.set({ locked: true });
    this.set({ error: describeError(e) });
    throw e;
  }

  private async ensureCart(): Promise<string> {
    const id = storage.get(ID_KEY);
    if (id) return id;
    return this.apply(await api.createCart()).id;
  }

  /** Refresca el carrito desde la API (precios, promociones y stock vigentes). */
  refresh(): Promise<void> {
    const id = storage.get(ID_KEY);
    if (!id) return Promise.resolve();
    return this.run(async () => { this.apply(await api.getCart(id)); }).catch((e) => { try { this.fail(e); } catch { /* ya reflejado en state.error */ } });
  }

  /** Suma `qty` unidades de la variante. La API fija cantidades: enviamos la actual + qty. */
  add(product: Pick<Product, 'id'>, variant: Pick<Variant, 'id'>, qty = 1): Promise<Cart> {
    return this.run(async () => {
      try {
        const id = await this.ensureCart();
        const current = this.state.cart?.line_items.find((l) => l.variant_id === variant.id)?.quantity ?? 0;
        return this.apply(await api.setLineItem(id, { productId: product.id, variantId: variant.id, quantity: current + qty }));
      } catch (e) { return this.fail(e); }
    });
  }

  setQuantity(item: CartLineItem, quantity: number): Promise<Cart> {
    if (quantity <= 0) return this.remove(item);
    return this.run(async () => {
      try { return this.apply(await api.updateLineItem(await this.ensureCart(), item.id, quantity)); }
      catch (e) { return this.fail(e); }
    });
  }

  remove(item: CartLineItem): Promise<Cart> {
    return this.run(async () => {
      try { return this.apply(await api.removeLineItem(await this.ensureCart(), item.id)); }
      catch (e) { return this.fail(e); }
    });
  }

  /** Vacía el carrito quitando cada ítem (la API no tiene un "vaciar"). */
  clear(): Promise<void> {
    return this.run(async () => {
      try {
        const id = await this.ensureCart();
        let cart = this.state.cart;
        for (const item of cart?.line_items ?? []) {
          if (item.instructions.can_remove) cart = await api.removeLineItem(id, item.id);
        }
        if (cart) this.apply(cart);
      } catch (e) { this.fail(e); }
    });
  }

  applyCoupon(code: string): Promise<Cart> {
    return this.run(async () => {
      try { return this.apply(await api.applyCoupon(await this.ensureCart(), code.trim())); }
      catch (e) { return this.fail(e); }
    });
  }

  removeCoupon(couponId: string): Promise<Cart> {
    return this.run(async () => {
      try { return this.apply(await api.removeCoupon(await this.ensureCart(), couponId)); }
      catch (e) { return this.fail(e); }
    });
  }

  /** Devuelve la URL del checkout alojado de Tiendanube (sin redirigir: valida el llamador). */
  checkoutUrl(): Promise<string> {
    return this.run(async () => {
      try { return await api.startCheckout(await this.ensureCart()); }
      catch (e) { return this.fail(e); }
    });
  }

  /** Abandona el carrito actual y empieza uno nuevo (p. ej. si quedó bloqueado). */
  reset(): void {
    this.persist(null);
    this.set({ cart: null, error: null, locked: false });
  }

  clearError(): void { this.set({ error: null }); }
}

export const cartStore = new CartStore();
