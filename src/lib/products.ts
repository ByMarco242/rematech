import { getDb } from './db';
import { slugify } from './util';

export interface ProductInput {
  name: string;
  brand: string;
  description: string;
  price: number;
  old_price: number | null;
  image_url: string;
  category_id: number | null;
  cpu: string;
  ram: string;
  storage: string;
  screen: string;
  stock: number;
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

  const categoryRaw = String(form.get('category_id') ?? '').trim();
  const categoryId = categoryRaw ? Number(categoryRaw) : null;

  const stock = Number(form.get('stock') ?? 0);

  return {
    data: {
      name,
      brand: String(form.get('brand') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      price,
      old_price: oldPrice,
      image_url: String(form.get('image_url') ?? '').trim(),
      category_id: categoryId !== null && Number.isInteger(categoryId) ? categoryId : null,
      cpu: String(form.get('cpu') ?? '').trim(),
      ram: String(form.get('ram') ?? '').trim(),
      storage: String(form.get('storage') ?? '').trim(),
      screen: String(form.get('screen') ?? '').trim(),
      stock: Number.isFinite(stock) && stock > 0 ? Math.floor(stock) : 0,
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
