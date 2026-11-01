// El negocio opera en Paraguay: UTC−3 todo el año (sin horario de verano desde 2024).
// La base guarda fechas en UTC (datetime('now')); estos helpers convierten a hora local
// para que "hoy" y "este mes" coincidan con la caja del día.

export const TZ = 'America/Asuncion';

/** Fecha y hora local actual en SQL */
export const LOCAL_NOW = "datetime('now', '-3 hours')";

/** Convierte una columna UTC a hora local en SQL */
export function localSql(column: string): string {
  return `datetime(${column}, '-3 hours')`;
}

/** Inicio del mes local en SQL (con desplazamiento opcional de meses) */
export function localMonthStartSql(monthsOffset = 0): string {
  return monthsOffset
    ? `datetime(${LOCAL_NOW}, 'start of month', '${monthsOffset} months')`
    : `datetime(${LOCAL_NOW}, 'start of month')`;
}

/** Fecha local de hoy como YYYY-MM-DD */
export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Año y mes local actuales (mes 1–12) */
export function localYearMonth(): { year: number; month: number } {
  const [year, month] = localToday().split('-').map(Number);
  return { year, month };
}

/** Lista de los últimos `count` meses locales como YYYY-MM, del más viejo al actual */
export function lastMonths(count: number): string[] {
  const { year, month } = localYearMonth();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Etiqueta corta de un mes YYYY-MM ("jul", o "jul 25" si se pide el año) */
export function monthLabel(ym: string, withYear = false): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const label = new Intl.DateTimeFormat('es-PY', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
  return withYear ? `${label} ${String(y).slice(2)}` : label;
}

/** Formatea una fecha UTC de la base en hora local */
export function formatLocal(sqlDate: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }): string {
  return new Intl.DateTimeFormat('es-PY', { ...opts, timeZone: TZ }).format(new Date(`${sqlDate.replace(' ', 'T')}Z`));
}
