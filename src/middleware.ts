import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';

// Rutas del panel reservadas solo para administradores
const ADMIN_ONLY = ['/admin/categorias', '/admin/usuarios'];

export const onRequest = defineMiddleware(async (context, next) => {
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
  return next();
});
