import { getDb } from './db';
import { slugify } from './util';
import type { ProductImage, ProductVariant } from './db';

export interface ProductInput {
  name: string;
  brand: string;
  description: string;
  price: number;
  old_price: number | null;
  cost: number;
  image_url: string;
  category_id: number | null;
  cpu: string;
  ram: string;
  storage: string;
  screen: string;
  gpu: string;
  stock: number;
  min_stock: number;
  featured: number;
}

export function parseProductForm(form: FormData): { data?: ProductInput; error?: string } {
  const name = String(form.get('name') ?? '').trim();
  const price = Number(form.get('price'));

  if (!name) return { error: 'El nombre es obligatorio.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'El precio no es válido.' };

  const oldPriceRaw = String(form.get('old_price') ?? '').trim();
  const oldPrice = oldPriceRaw ? Number(oldPriceRaw) : null;
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    return { error: 'El precio anterior no es válido.' };
  }

  const costRaw = String(form.get('cost') ?? '').trim();
  const cost = costRaw ? Number(costRaw) : 0;
  if (!Number.isFinite(cost) || cost < 0) {
    return { error: 'El costo no es válido.' };
  }

  const categoryRaw = String(form.get('category_id') ?? '').trim();
  const categoryId = categoryRaw ? Number(categoryRaw) : null;

  const stock = Number(form.get('stock') ?? 0);
  const minStock = Number(form.get('min_stock') ?? 0);

  const text = (field: string, max: number) =>
    String(form.get(field) ?? '').trim().slice(0, max);

  return {
    data: {
      name: name.slice(0, 150),
      brand: text('brand', 60),
      description: text('description', 4000),
      price,
      old_price: oldPrice,
      cost,
      image_url: text('image_url', 500),
      category_id: categoryId !== null && Number.isInteger(categoryId) ? categoryId : null,
      cpu: text('cpu', 100),
      ram: text('ram', 100),
      storage: text('storage', 100),
      screen: text('screen', 100),
      gpu: text('gpu', 100),
      stock: Number.isFinite(stock) && stock > 0 ? Math.floor(stock) : 0,
      min_stock: Number.isFinite(minStock) && minStock > 0 ? Math.floor(minStock) : 0,
      featured: form.get('featured') ? 1 : 0,
    },
  };
}

export async function uniqueProductSlug(name: string, excludeId?: number): Promise<string> {
  const db = await getDb();
  const base = slugify(name) || 'producto';
  let slug = base;
  let n = 2;
  for (;;) {
    const res = await db.execute({
      sql: 'SELECT id FROM products WHERE slug = ? AND id != ?',
      args: [slug, excludeId ?? -1],
    });
    if (res.rows.length === 0) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function getProductImages(productId: number): Promise<ProductImage[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id',
    args: [productId],
  });
  return res.rows as unknown as ProductImage[];
}

/** Reemplaza todas las imágenes adicionales de un producto por la lista dada */
export async function saveProductImages(productId: number, urls: string[]): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM product_images WHERE product_id = ?', args: [productId] });
  let order = 0;
  for (const raw of urls) {
    const url = raw.trim().slice(0, 500);
    if (!url) continue;
    await db.execute({
      sql: 'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
      args: [productId, url, order++],
    });
  }
}

export async function getProductVariants(productId: number): Promise<ProductVariant[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id',
    args: [productId],
  });
  return res.rows as unknown as ProductVariant[];
}

export async function getVariant(id: number): Promise<ProductVariant | null> {
  const db = await getDb();
  const res = await db.execute({ sql: 'SELECT * FROM product_variants WHERE id = ?', args: [id] });
  return (res.rows[0] as unknown as ProductVariant) ?? null;
}

export interface VariantInput {
  name: string;
  value: string;
  price_delta: number;
  stock: number;
  sku: string;
}

/** Reemplaza todas las variantes de un producto por la lista dada */
export async function saveProductVariants(
  productId: number,
  variants: VariantInput[]
): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM product_variants WHERE product_id = ?', args: [productId] });
  for (const v of variants) {
    const name = v.name.trim().slice(0, 60);
    const value = v.value.trim().slice(0, 60);
    if (!name || !value) continue;
    const priceDelta = Number.isFinite(v.price_delta) ? v.price_delta : 0;
    const stock = Number.isFinite(v.stock) && v.stock > 0 ? Math.floor(v.stock) : 0;
    await db.execute({
      sql: `INSERT INTO product_variants (product_id, name, value, price_delta, stock, sku)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [productId, name, value, priceDelta, stock, v.sku.trim().slice(0, 60)],
    });
  }
}

/** Parsea filas de variantes enviadas desde un form de admin: name[]/value[]/price_delta[]/stock[]/sku[] */
export function parseVariantsForm(form: FormData): VariantInput[] {
  const names = form.getAll('variant_name');
  const values = form.getAll('variant_value');
  const deltas = form.getAll('variant_price_delta');
  const stocks = form.getAll('variant_stock');
  const skus = form.getAll('variant_sku');
  const out: VariantInput[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] ?? '').trim();
    const value = String(values[i] ?? '').trim();
    if (!name || !value) continue;
    out.push({
      name,
      value,
      price_delta: Number(deltas[i] ?? 0) || 0,
      stock: Number(stocks[i] ?? 0) || 0,
      sku: String(skus[i] ?? '').trim(),
    });
  }
  return out;
}
