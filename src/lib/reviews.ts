import { getDb } from './db';
import type { Review } from './db';

export async function createReview(
  productId: number,
  userId: number,
  rating: number,
  comment: string
): Promise<{ error?: string }> {
  const r = Math.round(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return { error: 'La calificación debe ser de 1 a 5.' };
  const db = await getDb();
  await db.execute({
    sql: 'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
    args: [productId, userId, r, comment.trim().slice(0, 1000)],
  });
  return {};
}

export async function getApprovedReviews(productId: number): Promise<Review[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT r.*, u.name AS user_name FROM reviews r
          JOIN users u ON u.id = r.user_id
          WHERE r.product_id = ? AND r.approved = 1
          ORDER BY r.created_at DESC`,
    args: [productId],
  });
  return res.rows as unknown as Review[];
}

export async function getProductRatingSummary(
  productId: number
): Promise<{ avg: number; count: number }> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT AVG(rating) AS avg, COUNT(*) AS count FROM reviews WHERE product_id = ? AND approved = 1',
    args: [productId],
  });
  const row = res.rows[0];
  return { avg: Number(row?.avg ?? 0), count: Number(row?.count ?? 0) };
}

export async function getPendingReviews(): Promise<Review[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT r.*, u.name AS user_name, p.name AS product_name, p.slug AS product_slug
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     WHERE r.approved = 0
     ORDER BY r.created_at ASC`
  );
  return res.rows as unknown as (Review & { product_name: string; product_slug: string })[];
}

export async function approveReview(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE reviews SET approved = 1 WHERE id = ?', args: [id] });
}

export async function deleteReview(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM reviews WHERE id = ?', args: [id] });
}
