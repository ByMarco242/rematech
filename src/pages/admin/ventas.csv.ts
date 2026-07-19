import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  // Neutraliza inyección de fórmulas en Excel/Sheets y escapa comillas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async () => {
  const db = await getDb();
  const res = await db.execute(
    `SELECT o.id, o.created_at, o.customer_name, o.customer_email,
            oi.product_name, oi.qty, oi.price, oi.cost
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status = 'aprobado'
     ORDER BY o.created_at DESC, o.id DESC`
  );

  const header = [
    'pedido', 'fecha_utc', 'cliente', 'email', 'producto',
    'cantidad', 'precio_unitario_gs', 'costo_unitario_gs',
    'subtotal_gs', 'ganancia_bruta_gs',
  ];

  const lines = [header.join(';')];
  for (const r of res.rows) {
    const qty = Number(r.qty);
    const price = Number(r.price);
    const cost = Number(r.cost);
    lines.push(
      [
        csvCell(r.id),
        csvCell(r.created_at),
        csvCell(r.customer_name),
        csvCell(r.customer_email),
        csvCell(r.product_name),
        qty,
        price,
        cost,
        price * qty,
        cost > 0 ? (price - cost) * qty : '',
      ].join(';')
    );
  }

  // BOM para que Excel abra el UTF-8 con acentos correctos
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ventas-notestore.csv"',
    },
  });
};
