import type { APIRoute } from 'astro';
import { getDb, SOLD_SQL } from '../../lib/db';

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  // Neutraliza inyección de fórmulas en Excel/Sheets y escapa comillas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ url }) => {
  const db = await getDb();

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const desde = url.searchParams.get('desde') ?? '';
  const hasta = url.searchParams.get('hasta') ?? '';
  const hasRange = DATE_RE.test(desde) && DATE_RE.test(hasta);

  const res = hasRange
    ? await db.execute({
        sql: `SELECT o.id, o.invoice_number, o.created_at, o.status, o.customer_name, o.customer_email,
                     oi.product_name, oi.qty, oi.price, oi.cost
              FROM orders o JOIN order_items oi ON oi.order_id = o.id
              WHERE o.status IN ${SOLD_SQL} AND date(o.created_at) BETWEEN ? AND ?
              ORDER BY o.created_at DESC, o.id DESC`,
        args: [desde, hasta],
      })
    : await db.execute(
        `SELECT o.id, o.invoice_number, o.created_at, o.status, o.customer_name, o.customer_email,
                oi.product_name, oi.qty, oi.price, oi.cost
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status IN ${SOLD_SQL}
         ORDER BY o.created_at DESC, o.id DESC`
      );

  const header = [
    'pedido', 'comprobante', 'estado', 'fecha_utc', 'cliente', 'email', 'producto',
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
        csvCell(r.invoice_number ?? ''),
        csvCell(r.status),
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
