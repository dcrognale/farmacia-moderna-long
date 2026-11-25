import { toNumber } from './format';
import type { Product, ProductImage, Variant } from './tiendanube/types';

/** Stock: `stock === null` o sin gestión de stock = ilimitado. */
export function hasStock(v: Variant): boolean {
  if (!v.stock_management || v.stock === null) return true;
  return v.stock > 0;
}

export const maxQuantity = (v: Variant): number => (!v.stock_management || v.stock === null ? 99 : Math.max(0, v.stock));

/** Precio vigente: el promocional si existe y es menor al precio de lista. */
export function effectivePrice(v: Variant): number | null {
  const list = toNumber(v.price);
  const promo = toNumber(v.promotional_price);
  if (promo !== null && promo > 0 && (list === null || promo < list)) return promo;
  return list;
}

export function discountPercent(v: Variant): number {
  const list = toNumber(v.compare_at_price) ?? toNumber(v.price);
  const now = effectivePrice(v);
  if (list === null || now === null || list <= 0 || now >= list) return 0;
  return Math.round((1 - now / list) * 100);
}

export const visibleVariants = (p: Product): Variant[] => (p.variants ?? []).filter((v) => v.visible !== false);

/** Variante a mostrar por defecto en listados: la primera con stock y precio, o la primera. */
export function pickDefaultVariant(variants: Variant[]): Variant | undefined {
  const ok = variants.filter((v) => v.visible !== false && effectivePrice(v) !== null);
  return ok.find(hasStock) ?? ok[0];
}

/** Opciones por atributo (talle, color…), en orden de aparición. */
export function attributeOptions(p: Product): Array<{ name: string; values: string[] }> {
  const attrs = p.attributes ?? [];
  const vs = visibleVariants(p);
  return attrs.map((name, i) => ({ name, values: [...new Set(vs.map((v) => v.values[i]).filter((x): x is string => !!x))] }));
}

/** Variante exacta que coincide con la selección completa (un valor por atributo). */
export function resolveVariant(p: Product, selection: string[]): Variant | undefined {
  return visibleVariants(p).find((v) => selection.length === v.values.length && selection.every((s, i) => v.values[i] === s));
}

/** ¿Existe alguna variante con stock si se fija `value` en el atributo `index` manteniendo el resto de la selección? */
export function optionAvailable(p: Product, selection: string[], index: number, value: string): boolean {
  return visibleVariants(p).some((v) => v.values[index] === value && selection.every((s, i) => i === index || !s || v.values[i] === s) && hasStock(v));
}

export function variantImage(p: Product, v: Variant | undefined): ProductImage | undefined {
  return p.images?.find((i) => i.id === v?.image_id) ?? p.images?.[0];
}
