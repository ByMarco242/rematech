/**
 * Avisos automáticos por email (vía Resend, ver lib/mail.ts).
 * Si RESEND_API_KEY no está configurada, todo esto se omite en silencio:
 * la tienda funciona igual, solo que sin emails.
 */
import { getDb } from './db';
import { sendMail } from './mail';
import { getSettings } from './orders';
import { formatPrice } from './util';

const SITE =
  process.env.SITE_URL || import.meta.env.SITE_URL || 'https://norestore.vercel.app';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plantilla base: tarjeta simple con el nombre del negocio */
function template(businessName: string, title: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#171717;color:#ffffff;padding:16px 24px;font-weight:bold;font-size:18px">${escapeHtml(businessName)}</div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#171717">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:12px 24px;background:#fafafa;color:#8c8c8c;font-size:12px">Este es un mensaje automático, no respondas a este correo.</div>
  </div>
</div>`;
}

const STATUS_MESSAGES: Record<string, { subject: string; body: string }> = {
  aprobado: {
    subject: '¡Tu pedido fue aprobado! 🎉',
    body: 'Confirmamos tu pedido y ya lo estamos preparando. Te avisamos cuando salga en camino.',
  },
  enviado: {
    subject: 'Tu pedido está en camino 🚚',
    body: 'Tu pedido salió en camino. ¡Pronto lo vas a tener con vos!',
  },
  entregado: {
    subject: 'Tu pedido fue entregado ✅',
    body: '¡Gracias por tu compra! Esperamos que disfrutes tu producto.',
  },
  rechazado: {
    subject: 'Sobre tu pedido',
    body: 'Lamentablemente no pudimos procesar tu pedido. Escribinos por WhatsApp si tenés dudas.',
  },
  cancelado: {
    subject: 'Tu pedido fue cancelado',
    body: 'Tu pedido fue cancelado. Si no lo pediste vos o tenés dudas, escribinos.',
  },
};

/** Email al cliente cuando su pedido cambia de estado */
export async function notifyOrderStatus(orderId: number, status: string): Promise<void> {
  const msg = STATUS_MESSAGES[status];
  if (!msg) return;
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT customer_name, customer_email, total, invoice_number FROM orders WHERE id = ?',
    args: [orderId],
  });
  const row = res.rows[0];
  const email = String(row?.customer_email ?? '');
  if (!row || !email.includes('@')) return;

  const settings = await getSettings();
  const detail = `
    <p style="color:#595959;margin:0 0 16px">Hola ${escapeHtml(String(row.customer_name))}, ${msg.body}</p>
    <table style="width:100%;font-size:14px;color:#171717">
      <tr><td style="padding:4px 0;color:#8c8c8c">Pedido</td><td style="text-align:right">#${orderId}</td></tr>
      ${row.invoice_number ? `<tr><td style="padding:4px 0;color:#8c8c8c">Comprobante</td><td style="text-align:right">Nº ${row.invoice_number}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#8c8c8c">Total</td><td style="text-align:right;font-weight:bold">${formatPrice(Number(row.total))}</td></tr>
    </table>`;
  await sendMail(
    email,
    `${msg.subject} — Pedido #${orderId}`,
    template(settings.business_name, msg.subject, detail)
  );
}

async function adminEmails(): Promise<string[]> {
  const db = await getDb();
  const res = await db.execute("SELECT email FROM users WHERE role = 'admin'");
  return res.rows.map((r) => String(r.email)).filter((e) => e.includes('@'));
}

/** Aviso a los administradores cuando entra un pedido nuevo por la web */
export async function notifyAdminsNewOrder(
  orderId: number,
  customerName: string,
  total: number
): Promise<void> {
  const settings = await getSettings();
  const body = `
    <p style="color:#595959;margin:0 0 16px">Entró un pedido nuevo por la web y está esperando aprobación.</p>
    <table style="width:100%;font-size:14px;color:#171717">
      <tr><td style="padding:4px 0;color:#8c8c8c">Pedido</td><td style="text-align:right">#${orderId}</td></tr>
      <tr><td style="padding:4px 0;color:#8c8c8c">Cliente</td><td style="text-align:right">${escapeHtml(customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#8c8c8c">Total</td><td style="text-align:right;font-weight:bold">${formatPrice(total)}</td></tr>
    </table>
    <p style="margin:16px 0 0"><a href="${SITE}/admin/pedidos?estado=pendiente" style="color:#171717;font-weight:bold">Ver en el panel →</a></p>`;
  for (const email of await adminEmails()) {
    await sendMail(
      email,
      `🛒 Pedido nuevo #${orderId} — ${formatPrice(total)}`,
      template(settings.business_name, 'Pedido nuevo', body)
    );
  }
}

/**
 * Tras una venta, avisa a los administradores si alguno de los productos
 * vendidos quedó en stock crítico (agotado o por debajo del mínimo).
 */
export async function notifyAdminsLowStock(productIds: number[]): Promise<void> {
  const ids = productIds.filter((n) => Number.isInteger(n));
  if (ids.length === 0) return;
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT name, stock, min_stock FROM products
          WHERE id IN (${ids.map(() => '?').join(',')})
            AND (stock <= 0 OR (min_stock > 0 AND stock <= min_stock))`,
    args: ids,
  });
  if (res.rows.length === 0) return;

  const settings = await getSettings();
  const rows = res.rows
    .map(
      (p) =>
        `<tr><td style="padding:4px 0">${escapeHtml(String(p.name))}</td>
         <td style="text-align:right;font-weight:bold;color:${Number(p.stock) <= 0 ? '#e11d48' : '#d97706'}">${p.stock} u.</td></tr>`
    )
    .join('');
  const body = `
    <p style="color:#595959;margin:0 0 16px">Estos productos quedaron con poco o nada de stock después de la última venta:</p>
    <table style="width:100%;font-size:14px;color:#171717">${rows}</table>
    <p style="margin:16px 0 0"><a href="${SITE}/admin/inventario" style="color:#171717;font-weight:bold">Ir al inventario →</a></p>`;
  for (const email of await adminEmails()) {
    await sendMail(
      email,
      `⚠️ Stock crítico en ${res.rows.length} producto${res.rows.length === 1 ? '' : 's'}`,
      template(settings.business_name, 'Alerta de stock', body)
    );
  }
}
