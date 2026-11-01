import type { APIRoute } from 'astro';
import { csvResponse } from '../../lib/csv';
import { monthlyFinance } from '../../lib/finance';

export const GET: APIRoute = async () => {
  const months = await monthlyFinance(12);
  const categories = [...new Set(months.flatMap((m) => Object.keys(m.expensesByCategory)))].sort();
  return csvResponse(
    'estado-de-resultados-notestore.csv',
    [
      'mes', 'pedidos', 'ventas_gs', 'descuentos_gs', 'envios_cobrados_gs', 'costo_mercaderia_gs', 'ganancia_bruta_gs',
      ...categories.map((c) => `gasto_${c.toLowerCase().replace(/\s+/g, '_')}_gs`),
      'gastos_totales_gs', 'resultado_neto_gs', 'compras_mercaderia_gs', 'flujo_caja_gs', 'iva_debito_gs', 'iva_credito_gs',
    ],
    months.map((m) => [
      m.ym, m.orders, m.sales, m.discounts, m.shipping, m.cogs, m.gross,
      ...categories.map((c) => m.expensesByCategory[c] ?? 0),
      m.expenses, m.net, m.purchases, m.cashFlow, m.ivaDebit, m.ivaCredit,
    ])
  );
};
