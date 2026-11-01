import type { APIRoute } from 'astro';
import { getDb, SOLD_SQL, PAYMENT_METHODS, isPaymentMethod } from '../../lib/db';
import { csvResponse } from '../../lib/csv';

export const GET: APIRoute = async ({ url }) => {
  const db = await getDb();

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const desde = url.searchParams.get('desde') ?? '';
  const hasta = url.searchParams.get('hasta') ?? '';
  const hasRange = DATE_RE.test(desde) && DATE_RE.test(hasta);

  const select = `SELECT o.id, o.invoice_number, datetime(o.created_at, '-3 hours') AS fecha, o.status, o.source,
                         o.payment_method, o.customer_name, o.customer_email, o.seller_name,
                         oi.product_name, oi.qty, oi.price, oi.cost
                  FROM orders o JOIN order_items oi ON oi.order_id = o.id
                  WHERE o.status IN ${SOLD_SQL}`;
  const res = hasRange
    ? await db.execute({
        sql: `${select} AND date(o.created_at, '-3 hours') BETWEEN ? AND ? ORDER BY o.created_at DESC, o.id DESC`,
        args: [desde, hasta],
      })
    : await db.execute(`${select} ORDER BY o.created_at DESC, o.id DESC`);

  const header = [
    'pedido', 'comprobante', 'estado', 'fecha_local', 'canal', 'medio_pago', 'cliente', 'email', 'vendedor',
    'producto', 'cantidad', 'precio_unitario_gs', 'costo_unitario_gs', 'subtotal_gs', 'ganancia_bruta_gs',
  ];

  const rows = res.rows.map((r) => {
    const qty = Number(r.qty);
    const price = Number(r.price);
    const cost = Number(r.cost);
    const method = String(r.payment_method);
    return [
      Number(r.id),
      r.invoice_number ?? '',
      r.status,
      r.fecha,
      r.source === 'manual' ? 'Mostrador' : 'Web',
      isPaymentMethod(method) ? PAYMENT_METHODS[method] : '',
      r.customer_name,
      r.customer_email,
      r.seller_name,
      r.product_name,
      qty,
      price,
      cost,
      price * qty,
      cost > 0 ? (price - cost) * qty : '',
    ];
  });

  return csvResponse('ventas-notestore.csv', header, rows);
};
