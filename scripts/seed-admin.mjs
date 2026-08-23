// Crea únicamente el usuario administrador, sin categorías ni productos de ejemplo.
// Uso: npm run seed:admin  (usa TURSO_DATABASE_URL/TURSO_AUTH_TOKEN si están definidos, si no file:local.db)
// Personalizable con ADMIN_EMAIL y ADMIN_PASSWORD.
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function main() {
  // El esquema completo lo crea la app sola en el primer request (getDb() en src/lib/db.ts).
  // Acá solo nos aseguramos de que exista la tabla users por si se corre este script
  // antes de levantar la app por primera vez.
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'cliente',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tienda.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [adminEmail],
  });
  if (existing.rows.length > 0) {
    console.log(`• Ya existe un usuario con ese email: ${adminEmail}`);
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10);
  await db.execute({
    sql: "INSERT INTO users (email, name, password_hash, is_admin, role) VALUES (?, ?, ?, 1, 'admin')",
    args: [adminEmail, 'Administrador', hash],
  });
  console.log(`✔ Admin creado: ${adminEmail} / ${adminPassword}`);
  console.log('La base queda vacía de ahí en más: sin categorías, productos ni pedidos de ejemplo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
