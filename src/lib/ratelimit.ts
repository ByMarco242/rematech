import { getDb } from './db';

/**
 * Límite de intentos respaldado en la base (funciona entre instancias serverless).
 * key: identificador del recurso limitado, ej. "login:email@x.com" o "ip:1.2.3.4".
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM login_attempts
          WHERE key = ? AND created_at > datetime('now', ?)`,
    args: [key, `-${windowMinutes} minutes`],
  });
  return Number(res.rows[0].n) >= max;
}

export async function recordAttempt(key: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: 'INSERT INTO login_attempts (key) VALUES (?)',
    args: [key],
  });
  // Limpieza oportunista de registros viejos
  if (Math.random() < 0.1) {
    await db.execute("DELETE FROM login_attempts WHERE created_at < datetime('now', '-1 day')");
  }
}

export async function clearAttempts(key: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM login_attempts WHERE key = ?', args: [key] });
}

/** IP del cliente detrás del proxy de Vercel (o directa en dev). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
