import { getDb } from './db';
import { slugify } from './util';

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

  const costRaw = String(form.get('cost') ?? '').trim();
  const cost = costRaw ? Number(costRaw) : 0;
  if (!Number.isFinite(cost) || cost < 0) {
    return { error: 'El costo no es válido.' };
  }

  const categoryRaw = String(form.get('category_id') ?? '').trim();
  const categoryId = categoryRaw ? Number(categoryRaw) : null;

  const stock = Number(form.get('stock') ?? 0);

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
