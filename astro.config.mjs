import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // Detrás del proxy de Vercel la verificación de origen da falsos positivos.
  // El CSRF queda cubierto por las cookies de sesión SameSite=Lax.
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
