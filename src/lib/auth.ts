import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
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

/**
 * Reglas de contraseña: 8-100 caracteres, con minúscula, mayúscula y número.
 * Devuelve el mensaje de error o null si es válida.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 100) return 'La contraseña no puede superar los 100 caracteres.';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  return null;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// En la base solo se guarda el hash del token: si la DB se filtra,
// los tokens robados no sirven para secuestrar sesiones.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Hash de relleno para igualar el tiempo de respuesta cuando el email no existe
// (evita enumerar usuarios midiendo la latencia del login).
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await bcrypt.hash(randomToken(), 10);
  return dummyHash;
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
  if (!row) {
    await bcrypt.compare(password, await getDummyHash());
    return null;
  }
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
    args: [hashToken(token), userId, expires.toISOString()],
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
  const hashed = hashToken(token);
  const res = await db.execute({
    sql: `SELECT u.id, u.email, u.name, u.role, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
    args: [hashed],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [hashed] });
    return null;
  }
  return makeSessionUser(row);
}

/** Crea un token de restablecimiento (1 hora de validez) y devuelve el token plano */
export async function createPasswordReset(userId: number): Promise<string> {
  const db = await getDb();
  const token = randomToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db.execute({ sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [userId] });
  await db.execute({
    sql: 'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [hashToken(token), userId, expires.toISOString()],
  });
  return token;
}

/** Valida el token y devuelve el user_id, o null si es inválido/vencido */
export async function verifyPasswordReset(token: string): Promise<number | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT user_id, expires_at FROM password_resets WHERE token = ?',
    args: [hashToken(token)],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute({
      sql: 'DELETE FROM password_resets WHERE token = ?',
      args: [hashToken(token)],
    });
    return null;
  }
  return Number(row.user_id);
}

/** Cambia la contraseña, consume los tokens y cierra todas las sesiones del usuario */
export async function resetPassword(userId: number, newPassword: string): Promise<void> {
  const db = await getDb();
  const hash = await bcrypt.hash(newPassword, 10);
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [hash, userId],
  });
  await db.execute({ sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
}

/** Genera una contraseña aleatoria que cumple las reglas de composición */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let pw = '';
  for (const b of bytes) pw += alphabet[b % alphabet.length];
  return `Ns${pw}7`;
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.execute({
      sql: 'DELETE FROM sessions WHERE token = ?',
      args: [hashToken(token)],
    });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
