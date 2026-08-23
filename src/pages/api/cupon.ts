import type { APIRoute } from 'astro';
import { validateCoupon } from '../../lib/coupons';

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code') ?? '';
  const subtotal = Number(url.searchParams.get('subtotal') ?? 0);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return new Response(JSON.stringify({ error: 'Subtotal inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const result = await validateCoupon(code, subtotal);
  if (result.error || !result.coupon) {
    return new Response(JSON.stringify({ error: result.error ?? 'Cupón inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({ ok: true, code: result.coupon.code, discount: result.discount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
