export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const fmt = new Intl.NumberFormat('es-PY', {
  style: 'currency',
  currency: 'PYG',
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return fmt.format(value);
}

/**
 * Sanitiza el parámetro ?next= para evitar open redirects:
 * solo permite rutas internas ("/algo"), nunca "//dominio" ni URLs absolutas.
 */
export function sanitizeNext(raw: unknown): string {
  const value = String(raw ?? '');
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    return value;
  }
  return '/';
}
