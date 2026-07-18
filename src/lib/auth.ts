import bcrypt from 'bcryptjs';
import type { AstroCookies } from 'astro';
import { getDb } from './db';

export type Role = 'admin' | 'empleado' | 'cliente';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  is_admin: boolean;
  is_staff: boolean;
}

function toRole(value: unknown): Role {
  const r = String(value ?? 'cliente');
  return r === 'admin' || r === 'empleado' ? r : 'cliente';
}

function makeSessionUser(row: Record<string, unknown>): SessionUser {
  const role = toRole(row.role);
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name),
    role,
    is_admin: role === 'admin',
    is_staff: role === 'admin' || role === 'empleado',
  };
}

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: Role = 'cliente'
): Promise<{ user?: SessionUser; error?: string }> {
  const db = await getDb();
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });
  if (existing.rows.length > 0) {
    return { error: 'Ya existe una cuenta con ese email.' };
  }
  const hash = await bcrypt.hash(password, 10);
  const res = await db.execute({
    sql: 'INSERT INTO users (email, name, password_hash, role, is_admin) VALUES (?, ?, ?, ?, ?)',
    args: [email, name, hash, role, role === 'admin' ? 1 : 0],
  });
  return {
    user: makeSessionUser({ id: res.lastInsertRowid, email, name, role }),
  };
}

export async function verifyLogin(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT id, email, name, password_hash, role FROM users WHERE email = ?',
    args: [email],
  });
  const row = res.rows[0];
  if (!row) return null;
  const ok = await bcrypt.compare(password, String(row.password_hash));
  if (!ok) return null;
  return makeSessionUser(row);
}

export async function createSession(userId: number, cookies: AstroCookies): Promise<void> {
  const db = await getDb();
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.execute({
    sql: 'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [token, userId, expires.toISOString()],
  });
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: import.meta.env.PROD,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT u.id, u.email, u.name, u.role, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
    args: [token],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
    return null;
  }
  return makeSessionUser(row);
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
