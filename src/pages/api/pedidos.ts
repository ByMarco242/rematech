import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { formatPrice } from '../../lib/util';

function whatsappNumber(): string {
  return (
    process.env.WHATSAPP_NUMBER ||
    import.meta.env.WHATSAPP_NUMBER ||
    '595971000000'
  ).replace(/[^0-9]/g, '');
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Tenés que iniciar sesión.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null);
  const rawItems: unknown = body?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return new Response(JSON.stringify({ error: 'El carrito está vacío.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = await getDb();

  const items: { product_id: number; name: string; price: number; cost: number; qty: number }[] = [];
  for (const raw of rawItems.slice(0, 50)) {
    const id = Number((raw as { id?: unknown }).id);
    const qty = Math.min(Math.max(Math.floor(Number((raw as { qty?: unknown }).qty) || 1), 1), 99);
    if (!Number.isInteger(id)) continue;
    const res = await db.execute({
      sql: 'SELECT id, name, price, cost FROM products WHERE id = ?',
      args: [id],
    });
    const row = res.rows[0];
    if (!row) continue;
    items.push({
      product_id: Number(row.id),
      name: String(row.name),
      price: Number(row.price),
      cost: Number(row.cost ?? 0),
      qty,
    });
  }

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: 'Los productos del carrito ya no existen.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);

  const orderRes = await db.execute({
    sql: `INSERT INTO orders (user_id, customer_name, customer_email, status, total)
          VALUES (?, ?, ?, 'pendiente', ?)`,
    args: [user.id, user.name, user.email, total],
  });
  const orderId = Number(orderRes.lastInsertRowid);

  for (const item of items) {
    await db.execute({
      sql: `INSERT INTO order_items (order_id, product_id, product_name, price, cost, qty)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [orderId, item.product_id, item.name, item.price, item.cost, item.qty],
    });
  }

  const lines = [
    `¡Hola NoteStore! 👋 Quiero hacer este pedido (Pedido #${orderId}):`,
    '',
    ...items.map((i) => `• ${i.name} x${i.qty} — ${formatPrice(i.price * i.qty)}`),
    '',
    `Total: ${formatPrice(total)}`,
    `Mi nombre: ${user.name}`,
  ];
  const waUrl = `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(lines.join('\n'))}`;

  return new Response(JSON.stringify({ ok: true, orderId, waUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
