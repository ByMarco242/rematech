import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // URL pública: en Vercel Astro.url.origin resuelve a localhost, así que
  // el dominio real sale de acá (canonical, Open Graph, sitemap)
  site: 'https://norestore.vercel.app',
  // Detrás del proxy de Vercel la verificación de origen da falsos positivos.
  // El CSRF queda cubierto por las cookies de sesión SameSite=Lax.
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
