import { getDb } from './db';
import type { Product } from './db';

export async function isWishlisted(userId: number, productId: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
    args: [userId, productId],
  });
  return res.rows.length > 0;
}

/** Agrega o quita el producto de favoritos; devuelve el estado resultante */
export async function toggleWishlist(userId: number, productId: number): Promise<boolean> {
  const db = await getDb();
  const already = await isWishlisted(userId, productId);
  if (already) {
    await db.execute({
      sql: 'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      args: [userId, productId],
    });
    return false;
  }
  await db.execute({
    sql: 'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
    args: [userId, productId],
  });
  return true;
}

export async function getWishlistedIds(userId: number): Promise<Set<number>> {
  const db = await getDb();
  const res = await db.execute({ sql: 'SELECT product_id FROM wishlist WHERE user_id = ?', args: [userId] });
  return new Set(res.rows.map((r) => Number(r.product_id)));
}

export async function getWishlist(userId: number): Promise<Product[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT p.*, c.name AS category_name, c.slug AS category_slug
          FROM wishlist w
          JOIN products p ON p.id = w.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE w.user_id = ?
          ORDER BY w.created_at DESC`,
    args: [userId],
  });
  return res.rows as unknown as Product[];
}
