import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('session')?.value;
  context.locals.user = token ? await getSessionUser(token) : null;

  const path = context.url.pathname;
  if (path.startsWith('/admin')) {
    if (!context.locals.user) {
      return context.redirect(`/login?next=${encodeURIComponent(path)}`);
    }
    if (!context.locals.user.is_admin) {
      return context.redirect('/');
    }
  }
  return next();
});
