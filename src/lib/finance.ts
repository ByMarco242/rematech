import { getDb, SOLD_SQL } from './db';
import { lastMonths } from './time';

export interface MonthFinance {
  ym: string;
  sales: number;
  orders: number;
  discounts: number;
  shipping: number;
  /** Costo de la mercadería vendida (solo ítems con costo cargado) */
  cogs: number;
  /** Unidades vendidas sin costo cargado: la ganancia de ese mes está sobreestimada */
  unitsNoCost: number;
  gross: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  net: number;
  purchases: number;
  purchasesWithInvoice: number;
  /** Flujo de caja: ventas cobradas − gastos − compras de mercadería */
  cashFlow: number;
  /** IVA 10 % incluido en precios (estimación) */
  ivaDebit: number;
  ivaCredit: number;
}

/**
 * Estado de resultados por mes (hora local de Paraguay).
 * Ventas = total cobrado de pedidos vendidos (incluye envío y descuentos aplicados).
 */
export async function monthlyFinance(count = 12): Promise<MonthFinance[]> {
  const db = await getDb();
  const months = lastMonths(count);
  const from = `${months[0]}-01`;
  const local = "strftime('%Y-%m', datetime(o.created_at, '-3 hours'))";

  const [salesRes, cogsRes, expensesRes, purchasesRes] = await Promise.all([
    db.execute({
      sql: `SELECT ${local} AS ym, COUNT(*) AS n, COALESCE(SUM(o.total), 0) AS sales,
                   COALESCE(SUM(o.discount), 0) AS discounts, COALESCE(SUM(o.shipping_cost), 0) AS shipping
            FROM orders o WHERE o.status IN ${SOLD_SQL} AND date(o.created_at, '-3 hours') >= ? GROUP BY ym`,
      args: [from],
    }),
    db.execute({
      sql: `SELECT ${local} AS ym,
                   COALESCE(SUM(CASE WHEN oi.cost > 0 THEN oi.cost * oi.qty END), 0) AS cogs,
                   COALESCE(SUM(CASE WHEN oi.cost <= 0 THEN oi.qty ELSE 0 END), 0) AS units_no_cost
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.status IN ${SOLD_SQL} AND date(o.created_at, '-3 hours') >= ? GROUP BY ym`,
      args: [from],
    }),
    db.execute({
      sql: `SELECT substr(expense_date, 1, 7) AS ym, category, COALESCE(SUM(amount), 0) AS total
            FROM expenses WHERE expense_date >= ? GROUP BY ym, category`,
      args: [from],
    }),
    db.execute({
      sql: `SELECT substr(purchase_date, 1, 7) AS ym, COALESCE(SUM(total), 0) AS total,
                   COALESCE(SUM(CASE WHEN with_invoice = 1 THEN total END), 0) AS with_invoice
            FROM purchases WHERE purchase_date >= ? GROUP BY ym`,
      args: [from],
    }),
  ]);

  const byYm = <T,>(rows: Record<string, unknown>[]) => new Map(rows.map((r) => [String(r.ym), r as T]));
  const sales = byYm<Record<string, number>>(salesRes.rows as never);
  const cogs = byYm<Record<string, number>>(cogsRes.rows as never);
  const purchases = byYm<Record<string, number>>(purchasesRes.rows as never);
  const expenses = new Map<string, Record<string, number>>();
  for (const r of expensesRes.rows) {
    const ym = String(r.ym);
    const cats = expenses.get(ym) ?? {};
    cats[String(r.category)] = Number(r.total);
    expenses.set(ym, cats);
  }

  return months.map((ym) => {
    const s = sales.get(ym);
    const c = cogs.get(ym);
    const p = purchases.get(ym);
    const cats = expenses.get(ym) ?? {};
    const salesTotal = Number(s?.sales ?? 0);
    const cogsTotal = Number(c?.cogs ?? 0);
    const expensesTotal = Object.values(cats).reduce((a, v) => a + v, 0);
    const purchasesTotal = Number(p?.total ?? 0);
    const purchasesInv = Number(p?.with_invoice ?? 0);
    const gross = salesTotal - cogsTotal;
    return {
      ym,
      sales: salesTotal,
      orders: Number(s?.n ?? 0),
      discounts: Number(s?.discounts ?? 0),
      shipping: Number(s?.shipping ?? 0),
      cogs: cogsTotal,
      unitsNoCost: Number(c?.units_no_cost ?? 0),
      gross,
      expenses: expensesTotal,
      expensesByCategory: cats,
      net: gross - expensesTotal,
      purchases: purchasesTotal,
      purchasesWithInvoice: purchasesInv,
      cashFlow: salesTotal - expensesTotal - purchasesTotal,
      ivaDebit: Math.round(salesTotal / 11),
      ivaCredit: Math.round(purchasesInv / 11),
    };
  });
}

/** Meta de ventas mensual guardada en configuración (0 = sin meta) */
export async function getSalesGoal(): Promise<number> {
  const db = await getDb();
  const res = await db.execute("SELECT value FROM settings WHERE key = 'sales_goal'");
  const n = Number(res.rows[0]?.value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Proyección lineal de ventas al cierre del mes local en curso */
export function projectMonth(salesToDate: number, today: string): { projection: number; day: number; days: number } {
  const [y, m, d] = today.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { projection: d > 0 ? Math.round((salesToDate / d) * days) : 0, day: d, days };
}
