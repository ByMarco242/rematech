# 💻 NoteStore — Tienda de Notebooks

E-commerce de notebooks construido con **Astro 5 (SSR)**, **Tailwind CSS 4** y **libSQL/Turso**, listo para desplegar en **Vercel**.

## Características

- 🏠 **Página principal** con hero, producto destacado, categorías y novedades
- 🔎 **Catálogo** con búsqueda, filtro por categoría y ordenamiento por precio
- 📄 **Página de detalle** con especificaciones y productos relacionados
- 🛒 **Carrito de compras** con pedido por **WhatsApp**: al finalizar, el pedido se registra y se abre WhatsApp con el detalle
- 📦 **Gestión de pedidos** en el panel: aprobar (descuenta stock automáticamente) o rechazar
- 🔐 **Autenticación** propia: registro, login y sesiones con cookies (bcrypt + tokens en DB)
- ⚙️ **Panel administrativo** (`/admin`) protegido por rol: dashboard con métricas, ABM de productos y categorías

## Desarrollo local

```bash
npm install
npm run seed   # crea las tablas y carga datos de ejemplo (usa file:local.db)
npm run dev    # http://localhost:4321
```

**Usuario admin de ejemplo** (creado por el seed):

- Email: `admin@notestore.com`
- Contraseña: `admin123`

> ⚠️ Cambiá esa contraseña antes de ir a producción. Podés definir `ADMIN_EMAIL` y `ADMIN_PASSWORD` como variables de entorno antes de ejecutar el seed.

Cualquier usuario que se registre desde la web es un **cliente** (sin acceso al panel). Para dar permisos de admin a otro usuario: `UPDATE users SET is_admin = 1 WHERE email = '...'`.

## Despliegue en Vercel

La base local (`file:local.db`) solo funciona en desarrollo. En Vercel necesitás una base **Turso** (tiene plan gratuito):

1. Creá una cuenta en [turso.tech](https://turso.tech) y una base de datos.
2. Obtené la URL (`libsql://...`) y un token de acceso.
3. Poblá la base de producción desde tu máquina:

   ```bash
   # PowerShell
   $env:TURSO_DATABASE_URL="libsql://tu-base.turso.io"
   $env:TURSO_AUTH_TOKEN="tu-token"
   npm run seed
   ```

4. Subí el proyecto a GitHub e importalo en [vercel.com](https://vercel.com) (detecta Astro automáticamente).
5. En **Settings → Environment Variables** agregá:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `WHATSAPP_NUMBER` (número de la tienda con código de país, ej: `595971123456`)
6. Deploy. 🚀

## Estructura

```
src/
├── components/     # Navbar, Footer, ProductCard, CategoryCard, ProductForm
├── layouts/        # BaseLayout (tienda) y AdminLayout (panel)
├── lib/            # db.ts (libSQL + schema), auth.ts (sesiones), products.ts, util.ts
├── middleware.ts   # carga el usuario de la sesión y protege /admin
└── pages/
    ├── index.astro             # portada
    ├── productos/              # catálogo y detalle
    ├── categorias/[slug].astro
    ├── carrito.astro
    ├── login.astro / registro.astro
    ├── api/logout.ts
    └── admin/                  # dashboard, productos (ABM), categorías
scripts/seed.mjs    # datos de ejemplo + usuario admin
```
