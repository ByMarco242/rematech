import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';

// Rutas del panel reservadas solo para administradores
const ADMIN_ONLY = [
  '/admin/categorias',
  '/admin/usuarios',
  '/admin/metricas',
  '/admin/ventas',
  '/admin/gastos',
  '/admin/configuracion',
];

const CSP = [
  "default-src 'self'",
  // Los scripts propios son inline (Astro is:inline); no se permite cargar JS externo
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src https: data:',
  'frame-src https://www.google.com https://maps.google.com',
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (context, next) => {
  const method = context.request.method;

  // Protección CSRF: si el navegador manda Origin en una petición que muta estado,
  // el host debe coincidir con el nuestro. Se compara solo el host (no el protocolo)
  // para no romper detrás del proxy de Vercel. Las peticiones sin Origin (curl, apps)
  // no son vectores CSRF: el ataque requiere un navegador con la cookie de la víctima.
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = context.request.headers.get('origin');
    const host = context.request.headers.get('host');
    if (origin && origin !== 'null' && host) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        return new Response('Origen no permitido', { status: 403 });
      }
      if (originHost !== host) {
        return new Response('Origen no permitido', { status: 403 });
      }
    }
  }

  const token = context.cookies.get('session')?.value;
  context.locals.user = token ? await getSessionUser(token) : null;

  const path = context.url.pathname;
  if (path.startsWith('/admin')) {
    const user = context.locals.user;
    if (!user) {
      return context.redirect(`/login?next=${encodeURIComponent(path)}`);
    }
    if (!user.is_staff) {
      return context.redirect('/');
    }
    if (!user.is_admin && ADMIN_ONLY.some((p) => path.startsWith(p))) {
      return context.redirect('/admin');
    }
  }

  const response = await next();

  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (import.meta.env.PROD) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  return response;
});
