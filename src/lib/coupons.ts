import { getDb } from './db';
import type { Coupon } from './db';
import { localToday } from './time';

export async function listCoupons(): Promise<Coupon[]> {
  const db = await getDb();
  const res = await db.execute('SELECT * FROM coupons ORDER BY created_at DESC');
  return res.rows as unknown as Coupon[];
}

export async function createCoupon(input: {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minTotal: number;
  maxUses: number | null;
  expiresAt: string | null;
}): Promise<{ error?: string }> {
  const code = input.code.trim().toUpperCase().slice(0, 40);
  if (!code) return { error: 'El código es obligatorio.' };
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { error: 'El valor del descuento no es válido.' };
  }
  const db = await getDb();
  const existing = await db.execute({ sql: 'SELECT id FROM coupons WHERE code = ?', args: [code] });
  if (existing.rows.length > 0) return { error: 'Ya existe un cupón con ese código.' };
  await db.execute({
    sql: `INSERT INTO coupons (code, type, value, min_total, max_uses, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [code, input.type, input.value, input.minTotal, input.maxUses, input.expiresAt],
  });
  return {};
}

export async function deleteCoupon(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM coupons WHERE id = ?', args: [id] });
}

export async function toggleCoupon(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE coupons SET active = 1 - active WHERE id = ?', args: [id] });
}

export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<{ coupon?: Coupon; discount?: number; error?: string }> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { error: 'Ingresá un código de cupón.' };
  const db = await getDb();
  const res = await db.execute({ sql: 'SELECT * FROM coupons WHERE code = ?', args: [clean] });
  const coupon = res.rows[0] as unknown as Coupon | undefined;
  if (!coupon) return { error: 'El cupón no existe.' };
  if (!coupon.active) return { error: 'El cupón no está activo.' };
  // expires_at es el último día válido (fecha local), inclusive
  if (coupon.expires_at && coupon.expires_at.slice(0, 10) < localToday()) {
    return { error: 'El cupón está vencido.' };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { error: 'El cupón alcanzó su límite de usos.' };
  }
  if (subtotal < coupon.min_total) {
    return { error: `El pedido mínimo para este cupón es ${coupon.min_total}.` };
  }
  const discount =
    coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  return { coupon, discount: Math.min(discount, subtotal) };
}

export async function applyCouponUse(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', args: [id] });
}

/**
 * Desactiva los cupones vencidos o sin usos disponibles.
 * Devuelve los códigos desactivados (para dejarlo registrado).
 */
export async function deactivateStaleCoupons(): Promise<string[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `UPDATE coupons SET active = 0
          WHERE active = 1 AND (
            (expires_at IS NOT NULL AND substr(expires_at, 1, 10) < ?)
            OR (max_uses IS NOT NULL AND used_count >= max_uses))
          RETURNING code`,
    args: [localToday()],
  });
  return res.rows.map((r) => String(r.code));
}

/** Estado legible de un cupón */
export function couponStatus(c: Coupon): 'activo' | 'vencido' | 'agotado' | 'pausado' {
  if (c.expires_at && c.expires_at.slice(0, 10) < localToday()) return 'vencido';
  if (c.max_uses !== null && c.used_count >= c.max_uses) return 'agotado';
  return c.active ? 'activo' : 'pausado';
}
