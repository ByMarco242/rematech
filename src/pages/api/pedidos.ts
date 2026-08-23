import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { formatPrice } from '../../lib/util';
import { notifyAdminsNewOrder } from '../../lib/notify';
import { validateCoupon, applyCouponUse } from '../../lib/coupons';

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

  const items: {
    product_id: number;
    name: string;
    price: number;
    cost: number;
    qty: number;
    variant_id: number | null;
    variant_label: string;
  }[] = [];
  for (const raw of rawItems.slice(0, 50)) {
    const id = Number((raw as { id?: unknown }).id);
    const qty = Math.min(Math.max(Math.floor(Number((raw as { qty?: unknown }).qty) || 1), 1), 99);
    const variantId = Number((raw as { variantId?: unknown }).variantId);
    if (!Number.isInteger(id)) continue;
    const res = await db.execute({
      sql: 'SELECT id, name, price, cost, stock FROM products WHERE id = ?',
      args: [id],
    });
    const row = res.rows[0];
    if (!row) continue;

    if (Number.isInteger(variantId)) {
      const vRes = await db.execute({
        sql: 'SELECT id, name, value, price_delta, stock FROM product_variants WHERE id = ? AND product_id = ?',
        args: [variantId, id],
      });
      const v = vRes.rows[0];
      if (!v || Number(v.stock) < qty) continue;
      items.push({
        product_id: Number(row.id),
        name: String(row.name),
        price: Number(row.price) + Number(v.price_delta),
        cost: Number(row.cost ?? 0),
        qty,
        variant_id: Number(v.id),
        variant_label: `${v.name}: ${v.value}`,
      });
    } else {
      items.push({
        product_id: Number(row.id),
        name: String(row.name),
        price: Number(row.price),
        cost: Number(row.cost ?? 0),
        qty,
        variant_id: null,
        variant_label: '',
      });
    }
  }

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: 'Los productos del carrito ya no existen.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subtotal = items.reduce((acc, i) => acc + i.price * i.qty, 0);

  let discount = 0;
  let couponCode = '';
  let couponId: number | null = null;
  const rawCoupon = String(body?.couponCode ?? '').trim();
  if (rawCoupon) {
    const result = await validateCoupon(rawCoupon, subtotal);
    if (result.coupon && result.discount) {
      discount = result.discount;
      couponCode = result.coupon.code;
      couponId = result.coupon.id;
    }
  }

  let shippingCost = 0;
  let shippingZoneName = '';
  const zoneId = Number(body?.shippingZoneId);
  if (Number.isInteger(zoneId)) {
    const zoneRes = await db.execute({
      sql: 'SELECT name, cost FROM shipping_zones WHERE id = ? AND active = 1',
      args: [zoneId],
    });
    const zone = zoneRes.rows[0];
    if (zone) {
      shippingCost = Number(zone.cost);
      shippingZoneName = String(zone.name);
    }
  }

  const total = Math.max(subtotal - discount, 0) + shippingCost;

  const profileRes = await db.execute({
    sql: 'SELECT phone, address FROM users WHERE id = ?',
    args: [user.id],
  });
  const phone = String(profileRes.rows[0]?.phone ?? '');
  const address = String(profileRes.rows[0]?.address ?? '');

  const orderRes = await db.execute({
    sql: `INSERT INTO orders
            (user_id, customer_name, customer_email, customer_phone, status, total,
             coupon_code, discount, shipping_zone, shipping_cost)
          VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?)`,
    args: [user.id, user.name, user.email, phone, total, couponCode, discount, shippingZoneName, shippingCost],
  });
  const orderId = Number(orderRes.lastInsertRowid);

  for (const item of items) {
    await db.execute({
      sql: `INSERT INTO order_items
              (order_id, product_id, product_name, price, cost, qty, variant_id, variant_label)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [orderId, item.product_id, item.name, item.price, item.cost, item.qty, item.variant_id, item.variant_label],
    });
  }

  if (couponId) await applyCouponUse(couponId);

  const lines = [
    `¡Hola NoteStore! 👋 Quiero hacer este pedido (Pedido #${orderId}):`,
    '',
    ...items.map(
      (i) => `• ${i.name}${i.variant_label ? ` (${i.variant_label})` : ''} x${i.qty} — ${formatPrice(i.price * i.qty)}`
    ),
    '',
    `Subtotal: ${formatPrice(subtotal)}`,
    ...(discount ? [`Descuento (${couponCode}): -${formatPrice(discount)}`] : []),
    ...(shippingCost ? [`Envío (${shippingZoneName}): ${formatPrice(shippingCost)}`] : []),
    `Total: ${formatPrice(total)}`,
    `Mi nombre: ${user.name}`,
    ...(phone ? [`Mi teléfono: ${phone}`] : []),
    ...(address ? [`Mi dirección: ${address}`] : []),
  ];
  const waUrl = `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(lines.join('\n'))}`;

  await notifyAdminsNewOrder(orderId, user.name, total);

  return new Response(JSON.stringify({ ok: true, orderId, waUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
