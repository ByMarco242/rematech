import type { APIRoute } from 'astro';
import { getDb } from '../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = await getDb();
  const origin = url.origin;

  const [productsRes, categoriesRes] = await Promise.all([
    db.execute('SELECT slug, created_at FROM products'),
    db.execute('SELECT slug FROM categories'),
  ]);

  const urls: { loc: string; priority: string }[] = [
    { loc: `${origin}/`, priority: '1.0' },
    { loc: `${origin}/productos`, priority: '0.9' },
    { loc: `${origin}/contacto`, priority: '0.5' },
    ...categoriesRes.rows.map((c) => ({
      loc: `${origin}/categorias/${c.slug}`,
      priority: '0.7',
    })),
    ...productsRes.rows.map((p) => ({
      loc: `${origin}/productos/${p.slug}`,
      priority: '0.8',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
