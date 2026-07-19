import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;
let ready: Promise<void> | null = null;

function rawClient(): Client {
  if (!client) {
    const url =
      process.env.TURSO_DATABASE_URL ||
      import.meta.env.TURSO_DATABASE_URL ||
      'file:local.db';
    const authToken =
      process.env.TURSO_AUTH_TOKEN || import.meta.env.TURSO_AUTH_TOKEN || undefined;
    client = createClient({ url, authToken });
  }
  return client;
}

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
    min_stock INTEGER NOT NULL DEFAULT 0,
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
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    customer_ruc TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendiente',
    source TEXT NOT NULL DEFAULT 'web',
    invoice_number INTEGER,
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL DEFAULT (date('now')),
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    user_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS stock_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL DEFAULT '',
    change INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    user_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
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

export async function getDb(): Promise<Client> {
  const c = rawClient();
  if (!ready) {
    ready = (async () => {
      for (const stmt of SCHEMA) await c.execute(stmt);
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
        'ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0',
      ];
      for (const m of migrations) {
        try {
          await c.execute(m);
        } catch {
          // la columna ya existe
        }
      }
      await c.execute(
        "UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role = 'cliente'"
      );
    })();
  }
  await ready;
  return c;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
}

export type OrderStatus =
  | 'pendiente'
  | 'aprobado'
  | 'enviado'
  | 'entregado'
  | 'cancelado'
  | 'rechazado';

/** Estados que cuentan como venta concretada en métricas y reportes */
export const SOLD_STATUSES = ['aprobado', 'enviado', 'entregado'] as const;
export const SOLD_SQL = "('aprobado','enviado','entregado')";

export interface Order {
  id: number;
  user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_ruc: string;
  status: OrderStatus;
  source: string;
  invoice_number: number | null;
  total: number;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  price: number;
  cost: number;
  qty: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  brand: string;
  description: string;
  price: number;
  old_price: number | null;
  cost: number;
  image_url: string;
  category_id: number | null;
  cpu: string;
  ram: string;
  storage: string;
  screen: string;
  stock: number;
  min_stock: number;
  featured: number;
  created_at: string;
  category_name?: string;
  category_slug?: string;
}
