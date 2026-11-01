import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { csvResponse } from '../../lib/csv';

export const GET: APIRoute = async () => {
  const db = await getDb();
  const res = await db.execute(
    `SELECT p.id, p.name, p.brand, c.name AS category, p.price, p.old_price, p.cost, p.stock, p.min_stock, p.gpu
     FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.name`
  );
  return csvResponse(
    'productos-notestore.csv',
    ['id', 'nombre', 'marca', 'categoria', 'precio', 'precio_anterior', 'costo', 'stock', 'stock_minimo', 'gpu'],
    res.rows.map((r) => [
      Number(r.id), r.name, r.brand, r.category ?? '', Number(r.price),
      r.old_price == null ? '' : Number(r.old_price), Number(r.cost), Number(r.stock), Number(r.min_stock), r.gpu,
    ])
  );
};
