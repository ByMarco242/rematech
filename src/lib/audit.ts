import { getDb } from './db';

export type AuditEntity = 'pedido' | 'producto' | 'gasto' | 'cupon' | 'compra' | 'caja' | 'usuario' | 'inventario' | 'precios';

/** Registra quién hizo qué. Nunca debe romper la acción principal si falla. */
export async function logAudit(
  userName: string,
  action: string,
  entity: AuditEntity,
  entityId: number | null,
  detail = ''
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute({
      sql: 'INSERT INTO audit_log (user_name, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)',
      args: [userName, action, entity, entityId, detail.slice(0, 1000)],
    });
  } catch (err) {
    console.error('No se pudo registrar la auditoría', err);
  }
}
