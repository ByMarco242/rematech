import type { APIRoute } from 'astro';
import { toggleWishlist } from '../../lib/wishlist';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Tenés que iniciar sesión.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const body = await request.json().catch(() => null);
  const productId = Number(body?.productId);
  if (!Number.isInteger(productId)) {
    return new Response(JSON.stringify({ error: 'Producto inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const wishlisted = await toggleWishlist(user.id, productId);
  return new Response(JSON.stringify({ ok: true, wishlisted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
