/** Tipos de la Storefront API de Tiendanube (OpenAPI 0.16.0, versión 2026-11). Los precios son strings decimales. */

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Store {
  id: number;
  name: string | null;
  country: string;
  currency: string;
  language: string;
  url: string;
}

export interface ProductImage {
  id: number;
  src: string;
  alt: string;
  height: number;
  width: number;
}

export interface Category {
  id: number;
  name: string;
  handle: string;
  description?: string;
  parent?: number | null;
  subcategories?: number[];
}

export interface Variant {
  id: number;
  product_id: number;
  image_id: number | null;
  position: number;
  /** Valores de los atributos, en el mismo orden que `Product.attributes`. */
  values: string[];
  visible: boolean;
  sku: string | null;
  price: string | null;
  promotional_price: string | null;
  compare_at_price: string | null;
  /** `null` = sin límite. */
  stock: number | null;
  stock_management: boolean;
}

export interface Product {
  id: number;
  name: string;
  handle: string;
  description?: string;
  brand?: string | null;
  attributes?: string[];
  variants?: Variant[];
  images?: ProductImage[];
  categories?: Array<{ id: number; name: string; handle: string; parent: number | null }>;
  free_shipping?: boolean;
  published?: boolean;
}

export interface ProductList {
  data: Product[];
  pagination: Pagination;
}

export interface CategoryList {
  data: Category[];
  pagination: Pagination;
}

export interface ShippingOption {
  code: string;
  name: string;
  detail?: string;
  price: string;
  min_date?: string;
  max_date?: string;
  days_until?: { start: number; end: number; working_start: number; working_end: number };
}

export interface ShippingOptionsResponse {
  shipping_options: ShippingOption[];
}

export interface CartDiscount {
  type: string;
  amount: string;
  line_item_ids: string[];
  coupon?: { code: string };
}

export interface CartLineItem {
  id: string;
  product_id: number;
  variant_id: number;
  name: string;
  variant_options: Array<{ value: string }>;
  sku: string | null;
  image: ProductImage | null;
  quantity: number;
  is_gift: boolean;
  instructions: { can_remove: boolean; can_update_quantity: boolean };
  cost: { unit_price: string; compare_at_unit_price: string | null; subtotal: string; discount: string; total: string };
  discounts: CartDiscount[];
}

export interface Cart {
  id: string;
  currency: string;
  total_quantity: number;
  line_items: CartLineItem[];
  coupons: Array<{ id: string; code: string }>;
  discounts: CartDiscount[];
  cost: { subtotal: string; discount: string; shipping: string | null; total: string };
}

export interface CartResponse {
  cart: Cart;
}

export interface CheckoutResponse {
  checkout_url: string;
}
