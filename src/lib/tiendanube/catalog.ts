import { get } from './client';
import type { CategoryList, Product, ProductList, Store, Category } from './types';

export const getStore = (signal?: AbortSignal) => get<Store>('', undefined, signal);

export const listCategories = (signal?: AbortSignal) =>
  get<CategoryList>('/categories', { per_page: 200, fields: 'id,name,handle,parent,subcategories' }, signal);

export const getCategoryByHandle = async (handle: string, signal?: AbortSignal): Promise<Category | null> => {
  const res = await get<CategoryList>('/categories', { handle, fields: 'id,name,handle,description,parent,subcategories' }, signal);
  return res.data[0] ?? null;
};

const LIST_FIELDS = 'id,name,handle,brand,images,variants,attributes,free_shipping';

export interface ProductQuery {
  q?: string;
  categoryId?: number;
  sortBy?: 'best-selling' | 'price-ascending' | 'price-descending' | 'created-at-descending' | 'alpha-ascending';
  page?: number;
  perPage?: number;
  hasPromotionalPrice?: boolean;
}

/** Listado/búsqueda: `/search/products` cubre texto, categoría y orden con un solo endpoint. */
export const searchProducts = (p: ProductQuery, signal?: AbortSignal) =>
  get<ProductList>(
    '/search/products',
    { q: p.q?.trim().slice(0, 100), category_id: p.categoryId, sort_by: p.sortBy, page: p.page ?? 1, per_page: p.perPage ?? 12, fields: LIST_FIELDS },
    signal,
  );

/** Grilla simple de `/products` (home: productos con precio promocional). */
export const browseProducts = (p: { page?: number; perPage?: number; hasPromotionalPrice?: boolean; categoryId?: number }, signal?: AbortSignal) =>
  get<ProductList>(
    '/products',
    { page: p.page ?? 1, per_page: p.perPage ?? 12, category_id: p.categoryId, has_promotional_price: p.hasPromotionalPrice ? 'true' : undefined, fields: LIST_FIELDS },
    signal,
  );

const DETAIL_FIELDS = 'id,name,handle,description,brand,images,variants,attributes,categories,free_shipping';

export const getProduct = (idOrHandle: string, signal?: AbortSignal) =>
  get<Product>(`/products/${encodeURIComponent(idOrHandle)}`, { fields: DETAIL_FIELDS }, signal);
