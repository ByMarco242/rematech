// Carga datos de ejemplo: categorías, productos y el usuario administrador.
// Uso: npm run seed  (usa TURSO_DATABASE_URL/TURSO_AUTH_TOKEN si están definidos, si no file:local.db)
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    old_price REAL,
    cost REAL NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    cpu TEXT NOT NULL DEFAULT '',
    ram TEXT NOT NULL DEFAULT '',
    storage TEXT NOT NULL DEFAULT '',
    screen TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'cliente',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON login_attempts (key, created_at)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendiente',
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    qty INTEGER NOT NULL
  )`,
];

const img = (id) => `https://images.unsplash.com/${id}?q=80&w=1200&auto=format&fit=crop`;

const categories = [
  {
    name: 'Gaming',
    slug: 'gaming',
    description: 'Máximo rendimiento para jugar sin límites.',
    image_url: img('photo-1603302576837-37561b2e2302'),
  },
  {
    name: 'Ultrabooks',
    slug: 'ultrabooks',
    description: 'Livianas, potentes y con gran batería.',
    image_url: img('photo-1611186871348-b1ce696e52c9'),
  },
  {
    name: 'Empresarial',
    slug: 'empresarial',
    description: 'Seguridad y productividad para tu trabajo.',
    image_url: img('photo-1496181133206-80ce9b88a853'),
  },
  {
    name: 'Estudiantes',
    slug: 'estudiantes',
    description: 'La mejor relación precio-calidad para estudiar.',
    image_url: img('photo-1517336714731-489689fd1ca8'),
  },
  {
    name: 'Workstations',
    slug: 'workstations',
    description: 'Potencia profesional para creadores y desarrolladores.',
    image_url: img('photo-1593642632823-8f785ba67e45'),
  },
  {
    name: '2 en 1',
    slug: '2-en-1',
    description: 'Notebook y tablet en un solo equipo convertible.',
    image_url: img('photo-1544731612-de7f96afe55f'),
  },
];

const products = [
  {
    name: 'ASUS ROG Strix G16',
    slug: 'asus-rog-strix-g16',
    brand: 'ASUS',
    category: 'gaming',
    description:
      'Domina cada partida con el poder del Intel Core i9 y la RTX 4070. Pantalla de 165Hz para una fluidez extrema y sistema de refrigeración inteligente para sesiones intensas.',
    price: 14240000,
    old_price: 15740000,
    image_url: img('photo-1603302576837-37561b2e2302'),
    cpu: 'Intel Core i9-14900HX',
    ram: '32GB DDR5',
    storage: '1TB SSD NVMe',
    screen: '16" QHD+ 165Hz',
    stock: 8,
    featured: 1,
  },
  {
    name: 'Lenovo Legion 5 Pro',
    slug: 'lenovo-legion-5-pro',
    brand: 'Lenovo',
    category: 'gaming',
    description:
      'El equilibrio perfecto entre potencia y precio. Ryzen 7 y RTX 4060 en un chasis robusto con pantalla 2K de 165Hz certificada Dolby Vision.',
    price: 11240000,
    old_price: null,
    image_url: img('photo-1593642702821-c8da6771f0c6'),
    cpu: 'AMD Ryzen 7 7745HX',
    ram: '16GB DDR5',
    storage: '512GB SSD NVMe',
    screen: '16" 2K 165Hz',
    stock: 12,
    featured: 0,
  },
  {
    name: 'MSI Katana 15',
    slug: 'msi-katana-15',
    brand: 'MSI',
    category: 'gaming',
    description:
      'Entrá al gaming de alto nivel con RTX 4050 y panel de 144Hz. Teclado retroiluminado y diseño agresivo inspirado en el filo de una katana.',
    price: 8240000,
    old_price: 9370000,
    image_url: img('photo-1525547719571-a2d4ac8945e2'),
    cpu: 'Intel Core i7-13620H',
    ram: '16GB DDR5',
    storage: '512GB SSD NVMe',
    screen: '15.6" FHD 144Hz',
    stock: 15,
    featured: 0,
  },
  {
    name: 'MacBook Air 13 M3',
    slug: 'macbook-air-13-m3',
    brand: 'Apple',
    category: 'ultrabooks',
    description:
      'Increíblemente delgada y silenciosa. El chip M3 ofrece un rendimiento excepcional con hasta 18 horas de batería. Perfecta para llevar a todos lados.',
    price: 8990000,
    old_price: null,
    image_url: img('photo-1611186871348-b1ce696e52c9'),
    cpu: 'Apple M3 (8 núcleos)',
    ram: '16GB unificada',
    storage: '512GB SSD',
    screen: '13.6" Liquid Retina',
    stock: 20,
    featured: 1,
  },
  {
    name: 'Dell XPS 13',
    slug: 'dell-xps-13',
    brand: 'Dell',
    category: 'ultrabooks',
    description:
      'Diseño premium en aluminio mecanizado con pantalla InfinityEdge casi sin bordes. La ultrabook Windows de referencia.',
    price: 10490000,
    old_price: 11620000,
    image_url: img('photo-1588872657578-7efd1f1555ed'),
    cpu: 'Intel Core Ultra 7 155H',
    ram: '16GB LPDDR5x',
    storage: '512GB SSD NVMe',
    screen: '13.4" FHD+ InfinityEdge',
    stock: 10,
    featured: 0,
  },
  {
    name: 'ASUS Zenbook 14 OLED',
    slug: 'asus-zenbook-14-oled',
    brand: 'ASUS',
    category: 'ultrabooks',
    description:
      'Pantalla OLED 3K con colores espectaculares en un chasis de solo 1.2kg. Ideal para creadores que trabajan en movimiento.',
    price: 7870000,
    old_price: null,
    image_url: img('photo-1541807084-5c52b6b3adef'),
    cpu: 'Intel Core Ultra 5 125H',
    ram: '16GB LPDDR5x',
    storage: '512GB SSD NVMe',
    screen: '14" 3K OLED 120Hz',
    stock: 9,
    featured: 0,
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon',
    slug: 'lenovo-thinkpad-x1-carbon',
    brand: 'Lenovo',
    category: 'empresarial',
    description:
      'La leyenda empresarial: ultraliviana, resistente a nivel militar y con el mejor teclado del mercado. Seguridad de nivel corporativo integrada.',
    price: 12740000,
    old_price: null,
    image_url: img('photo-1496181133206-80ce9b88a853'),
    cpu: 'Intel Core Ultra 7 165U',
    ram: '32GB LPDDR5x',
    storage: '1TB SSD NVMe',
    screen: '14" 2.8K OLED',
    stock: 6,
    featured: 0,
  },
  {
    name: 'HP EliteBook 840 G11',
    slug: 'hp-elitebook-840-g11',
    brand: 'HP',
    category: 'empresarial',
    description:
      'Productividad empresarial con IA integrada, cámara con obturador físico y chasis de aluminio reciclado. Pensada para el trabajo híbrido.',
    price: 10120000,
    old_price: 11240000,
    image_url: img('photo-1531297484001-80022131f5a1'),
    cpu: 'Intel Core Ultra 5 135U',
    ram: '16GB DDR5',
    storage: '512GB SSD NVMe',
    screen: '14" WUXGA antirreflejo',
    stock: 11,
    featured: 0,
  },
  {
    name: 'Acer Aspire 5',
    slug: 'acer-aspire-5',
    brand: 'Acer',
    category: 'estudiantes',
    description:
      'Todo lo que necesitás para estudiar: rendimiento sólido, pantalla Full HD y excelente precio. La compañera ideal para la facultad.',
    price: 4490000,
    old_price: 5240000,
    image_url: img('photo-1484788984921-03950022c9ef'),
    cpu: 'AMD Ryzen 5 7530U',
    ram: '16GB DDR4',
    storage: '512GB SSD NVMe',
    screen: '15.6" FHD IPS',
    stock: 25,
    featured: 0,
  },
  {
    name: 'HP Pavilion 15',
    slug: 'hp-pavilion-15',
    brand: 'HP',
    category: 'estudiantes',
    description:
      'Diseño moderno con carga rápida y audio B&O. Perfecta para clases, streaming y proyectos, a un precio accesible.',
    price: 5090000,
    old_price: null,
    image_url: img('photo-1587614382346-4ec70e388b28'),
    cpu: 'Intel Core i5-1335U',
    ram: '8GB DDR4',
    storage: '512GB SSD NVMe',
    screen: '15.6" FHD IPS',
    stock: 18,
    featured: 0,
  },
  {
    name: 'MacBook Pro 16 M3 Pro',
    slug: 'macbook-pro-16-m3-pro',
    brand: 'Apple',
    category: 'workstations',
    description:
      'Potencia profesional extrema para edición de video 8K, desarrollo y 3D. Pantalla Liquid Retina XDR y hasta 22 horas de batería.',
    price: 21740000,
    old_price: null,
    image_url: img('photo-1517336714731-489689fd1ca8'),
    cpu: 'Apple M3 Pro (12 núcleos)',
    ram: '36GB unificada',
    storage: '1TB SSD',
    screen: '16.2" Liquid Retina XDR',
    stock: 5,
    featured: 1,
  },
  {
    name: 'Dell Precision 5690',
    slug: 'dell-precision-5690',
    brand: 'Dell',
    category: 'workstations',
    description:
      'Workstation certificada para CAD, simulación y render con GPU NVIDIA RTX profesional. Fiabilidad de clase empresarial.',
    price: 19490000,
    old_price: 21740000,
    image_url: img('photo-1593642632823-8f785ba67e45'),
    cpu: 'Intel Core Ultra 9 185H',
    ram: '32GB DDR5',
    storage: '1TB SSD NVMe',
    screen: '16" 4K+ táctil',
    stock: 4,
    featured: 0,
  },
  {
    name: 'Lenovo Yoga 7i 2-en-1',
    slug: 'lenovo-yoga-7i-2-en-1',
    brand: 'Lenovo',
    category: '2-en-1',
    description:
      'Girala 360° y convertila en tablet. Pantalla táctil OLED, lápiz incluido y bisagras premium para trabajar y crear como quieras.',
    price: 7120000,
    old_price: 8240000,
    image_url: img('photo-1544731612-de7f96afe55f'),
    cpu: 'Intel Core Ultra 5 125U',
    ram: '16GB LPDDR5',
    storage: '512GB SSD NVMe',
    screen: '14" WUXGA OLED táctil',
    stock: 13,
    featured: 0,
  },
  {
    name: 'HP Spectre x360 14',
    slug: 'hp-spectre-x360-14',
    brand: 'HP',
    category: '2-en-1',
    description:
      'El convertible premium por excelencia: diseño de joyería, pantalla OLED táctil de 2.8K y rendimiento con IA para creadores exigentes.',
    price: 10870000,
    old_price: null,
    image_url: img('photo-1618424181497-157f25b6ddd5'),
    cpu: 'Intel Core Ultra 7 155H',
    ram: '16GB LPDDR5x',
    storage: '1TB SSD NVMe',
    screen: '14" 2.8K OLED táctil',
    stock: 7,
    featured: 0,
  },
];

async function main() {
  for (const stmt of SCHEMA) await db.execute(stmt);

  // Migraciones para bases creadas con esquemas anteriores
  const migrations = [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'cliente'",
    'ALTER TABLE products ADD COLUMN cost REAL NOT NULL DEFAULT 0',
    'ALTER TABLE order_items ADD COLUMN cost REAL NOT NULL DEFAULT 0',
    "ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN customer_phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN customer_ruc TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'web'",
    'ALTER TABLE orders ADD COLUMN invoice_number INTEGER',
    "ALTER TABLE orders ADD COLUMN seller_name TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0',
  ];
  for (const m of migrations) {
    try {
      await db.execute(m);
    } catch {
      // la columna ya existe
    }
  }
  await db.execute("UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role = 'cliente'");

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@notestore.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existingAdmin = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [adminEmail],
  });
  if (existingAdmin.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db.execute({
      sql: "INSERT INTO users (email, name, password_hash, is_admin, role) VALUES (?, ?, ?, 1, 'admin')",
      args: [adminEmail, 'Administrador', hash],
    });
    console.log(`✔ Admin creado: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`• Admin ya existe: ${adminEmail}`);
  }

  // Categorías
  const catIds = {};
  for (const c of categories) {
    const existing = await db.execute({
      sql: 'SELECT id FROM categories WHERE slug = ?',
      args: [c.slug],
    });
    if (existing.rows.length > 0) {
      catIds[c.slug] = Number(existing.rows[0].id);
      continue;
    }
    const res = await db.execute({
      sql: 'INSERT INTO categories (name, slug, description, image_url) VALUES (?, ?, ?, ?)',
      args: [c.name, c.slug, c.description, c.image_url],
    });
    catIds[c.slug] = Number(res.lastInsertRowid);
    console.log(`✔ Categoría: ${c.name}`);
  }

  // Productos
  for (const p of products) {
    const existing = await db.execute({
      sql: 'SELECT id FROM products WHERE slug = ?',
      args: [p.slug],
    });
    if (existing.rows.length > 0) continue;
    // Costo de ejemplo: ~80% del precio de venta (margen 20%)
    const cost = Math.round((p.price * 0.8) / 10000) * 10000;
    await db.execute({
      sql: `INSERT INTO products
              (name, slug, brand, description, price, old_price, cost, image_url,
               category_id, cpu, ram, storage, screen, stock, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.name, p.slug, p.brand, p.description, p.price, p.old_price, cost, p.image_url,
        catIds[p.category] ?? null, p.cpu, p.ram, p.storage, p.screen, p.stock, p.featured,
      ],
    });
    console.log(`✔ Producto: ${p.name}`);
  }

  console.log('\n¡Listo! Base de datos poblada con datos de ejemplo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
