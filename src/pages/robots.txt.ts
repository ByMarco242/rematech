import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, site }) => {
  const origin = site?.origin ?? url.origin;
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /cuenta
Disallow: /carrito
Disallow: /login
Disallow: /registro
Disallow: /recuperar
Disallow: /restablecer

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
