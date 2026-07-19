import { getDb, SOLD_SQL } from './db';
import type { SessionUser } from './auth';
import { notifyOrderStatus, notifyAdminsLowStock } from './notify';

export async function recordStockMove(
  productId: number | null,
  productName: string,
  change: number,
  reason: string,
  userName: string,
  note = ''
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO stock_moves (product_id, product_name, change, reason, note, user_name)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [productId, productName, change, reason, note, userName],
  });
}

async function nextInvoiceNumber(): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    'SELECT COALESCE(MAX(invoice_number), 0) + 1 AS n FROM orders'
  );
  return Number(res.rows[0].n);
}

/** pendiente → aprobado: descuenta stock, registra movimientos y asigna nº de factura */
export async function approveOrder(orderId: number, user: SessionUser): Promise<boolean> {
  const db = await getDb();
  const orderRes = await db.execute({
    sql: 'SELECT id, status FROM orders WHERE id = ?',
    args: [orderId],
  });
  if (!orderRes.rows[0] || String(orderRes.rows[0].status) !== 'pendiente') return false;

  const itemsRes = await db.execute({
    sql: 'SELECT product_id, product_name, qty FROM order_items WHERE order_id = ?',
    args: [orderId],
  });
  const touchedIds: number[] = [];
  for (const item of itemsRes.rows) {
    if (item.product_id === null) continue;
    touchedIds.push(Number(item.product_id));
    await db.execute({
      sql: 'UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?',
      args: [Number(item.qty), Number(item.product_id)],
    });
    await recordStockMove(
      Number(item.product_id),
      String(item.product_name),
      -Number(item.qty),
      `Venta — pedido #${orderId}`,
      user.name
    );
  }
  const invoice = await nextInvoiceNumber();
  await db.execute({
    sql: "UPDATE orders SET status = 'aprobado', invoice_number = ?, seller_name = ? WHERE id = ?",
    args: [invoice, user.name, orderId],
  });
  await notifyOrderStatus(orderId, 'aprobado');
  await notifyAdminsLowStock(touchedIds);
  return true;
}

/** aprobado → enviado → entregado */
export async function advanceOrder(
  orderId: number,
  to: 'enviado' | 'entregado'
): Promise<boolean> {
  const db = await getDb();
  const from = to === 'enviado' ? "('aprobado')" : "('aprobado','enviado')";
  const res = await db.execute({
    sql: `UPDATE orders SET status = ? WHERE id = ? AND status IN ${from}`,
    args: [to, orderId],
  });
  if (res.rowsAffected > 0) await notifyOrderStatus(orderId, to);
  return res.rowsAffected > 0;
}

/** pendiente → rechazado (no toca stock) */
export async function rejectOrder(orderId: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: "UPDATE orders SET status = 'rechazado' WHERE id = ? AND status = 'pendiente'",
    args: [orderId],
  });
  if (res.rowsAffected > 0) await notifyOrderStatus(orderId, 'rechazado');
  return res.rowsAffected > 0;
}

/**
 * Cancela un pedido. Si ya estaba vendido (aprobado/enviado/entregado),
 * repone el stock y registra los movimientos.
 */
export async function cancelOrder(orderId: number, user: SessionUser): Promise<boolean> {
  const db = await getDb();
  const orderRes = await db.execute({
    sql: 'SELECT id, status FROM orders WHERE id = ?',
    args: [orderId],
  });
  const row = orderRes.rows[0];
  if (!row) return false;
  const status = String(row.status);
  const wasSold = ['aprobado', 'enviado', 'entregado'].includes(status);
  if (!wasSold && status !== 'pendiente') return false;

  if (wasSold) {
    const itemsRes = await db.execute({
      sql: 'SELECT product_id, product_name, qty FROM order_items WHERE order_id = ?',
      args: [orderId],
    });
    for (const item of itemsRes.rows) {
      if (item.product_id === null) continue;
      await db.execute({
        sql: 'UPDATE products SET stock = stock + ? WHERE id = ?',
        args: [Number(item.qty), Number(item.product_id)],
      });
      await recordStockMove(
        Number(item.product_id),
        String(item.product_name),
        Number(item.qty),
        `Cancelación — pedido #${orderId}`,
        user.name
      );
    }
  }
  await db.execute({
    sql: "UPDATE orders SET status = 'cancelado' WHERE id = ?",
    args: [orderId],
  });
  await notifyOrderStatus(orderId, 'cancelado');
  return true;
}

export interface ManualSaleInput {
  customerName: string;
  customerPhone: string;
  customerRuc: string;
  items: { productId: number; qty: number }[];
}

/** Venta de mostrador: crea el pedido ya aprobado, descuenta stock y factura */
export async function createManualSale(
  input: ManualSaleInput,
  user: SessionUser
): Promise<{ orderId?: number; error?: string }> {
  const db = await getDb();

  const items: { id: number; name: string; price: number; cost: number; qty: number }[] = [];
  for (const raw of input.items.slice(0, 50)) {
    const qty = Math.min(Math.max(Math.floor(raw.qty) || 1, 1), 99);
    if (!Number.isInteger(raw.productId)) continue;
    const res = await db.execute({
      sql: 'SELECT id, name, price, cost, stock FROM products WHERE id = ?',
      args: [raw.productId],
    });
    const row = res.rows[0];
    if (!row) continue;
    if (Number(row.stock) < qty) {
      return { error: `Stock insuficiente de «${row.name}» (quedan ${row.stock}).` };
    }
    items.push({
      id: Number(row.id),
      name: String(row.name),
      price: Number(row.price),
      cost: Number(row.cost ?? 0),
      qty,
    });
  }
  if (items.length === 0) return { error: 'Agregá al menos un producto.' };

  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);
  const invoice = await nextInvoiceNumber();

  const orderRes = await db.execute({
    sql: `INSERT INTO orders
            (user_id, customer_name, customer_email, customer_phone, customer_ruc,
             status, source, seller_name, invoice_number, total)
          VALUES (NULL, ?, '', ?, ?, 'aprobado', 'manual', ?, ?, ?)`,
    args: [
      input.customerName || 'Consumidor final',
      input.customerPhone,
      input.customerRuc,
      user.name,
      invoice,
      total,
    ],
  });
  const orderId = Number(orderRes.lastInsertRowid);

  for (const item of items) {
    await db.execute({
      sql: `INSERT INTO order_items (order_id, product_id, product_name, price, cost, qty)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [orderId, item.id, item.name, item.price, item.cost, item.qty],
    });
    await db.execute({
      sql: 'UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?',
      args: [item.qty, item.id],
    });
    await recordStockMove(
      item.id,
      item.name,
      -item.qty,
      `Venta manual — pedido #${orderId}`,
      user.name
    );
  }
  await notifyAdminsLowStock(items.map((i) => i.id));
  return { orderId };
}

/** Configuración del negocio (clave/valor) con valores por defecto */
export const SETTING_KEYS = [
  'business_name',
  'business_ruc',
  'business_timbrado',
  'business_address',
  'business_phone',
] as const;

export async function getSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const res = await db.execute('SELECT key, value FROM settings');
  const out: Record<string, string> = {
    business_name: 'NoteStore',
    business_ruc: '',
    business_timbrado: '',
    business_address: '',
    business_phone: '',
  };
  for (const row of res.rows) out[String(row.key)] = String(row.value);
  return out;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

export { SOLD_SQL };
