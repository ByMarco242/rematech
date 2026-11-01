// Normaliza las specs (texto libre cargado en el admin) para filtros y comparación.
// Si un valor no se reconoce devuelve null: nunca se inventa un dato.

export function cpuFamily(cpu: string): string | null {
  const s = cpu.trim();
  let m = s.match(/core\s+ultra\s+(\d)/i);
  if (m) return `Intel Core Ultra ${m[1]}`;
  m = s.match(/\bi([3579])[\s-]?\d/i);
  if (m) return `Intel Core i${m[1]}`;
  m = s.match(/ryzen\s+(\d)/i);
  if (m) return `AMD Ryzen ${m[1]}`;
  m = s.match(/\b(M\d)(\s+(Pro|Max))?\b/i);
  if (m) return `Apple ${m[1].toUpperCase()}${m[3] ? ` ${m[3][0].toUpperCase()}${m[3].slice(1).toLowerCase()}` : ''}`;
  return null;
}

/** Modelo de GPU normalizado para filtrar ("NVIDIA RTX 4060", "Integrada"); null si está vacío */
export function gpuModel(gpu: string): string | null {
  const s = gpu.trim();
  if (!s) return null;
  let m = s.match(/\b(RTX|GTX)\s*(\d{3,4})\s*(Ti|Super)?\b/i);
  if (m) return `NVIDIA ${m[1].toUpperCase()} ${m[2]}${m[3] ? ` ${m[3].length === 2 ? 'Ti' : 'Super'}` : ''}`;
  m = s.match(/\bRX\s*(\d{3,4})\s*(XT|M|S)?\b/i);
  if (m) return `AMD RX ${m[1]}${m[2] ? m[2].toUpperCase() : ''}`;
  m = s.match(/\bArc\s*(A\d{3}M?)\b/i);
  if (m) return `Intel Arc ${m[1].toUpperCase()}`;
  if (/integrad|iris|uhd|radeon graphics|apple|gpu de \d+ n/i.test(s)) return 'Integrada';
  return s;
}

/** Memoria en GB ("16GB DDR5", "16 GB DDR4" → 16) */
export function ramGb(ram: string): number | null {
  const m = ram.match(/(\d+)\s*GB/i);
  return m ? Number(m[1]) : null;
}

/** Almacenamiento en GB ("1TB SSD" → 1024, "512GB SSD" → 512) */
export function storageGb(storage: string): number | null {
  const m = storage.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB)/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return m[2].toUpperCase() === 'TB' ? Math.round(n * 1024) : n;
}

export function formatStorage(gb: number): string {
  return gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`;
}

/** Pulgadas de pantalla ('16" QHD+' → 16) */
export function screenInches(screen: string): number | null {
  const m = screen.match(/(\d+(?:\.\d+)?)\s*("|”|pulg)/i);
  return m ? Number(m[1]) : null;
}

export type StockLevel = 'out' | 'low' | 'in';

export function stockLevel(stock: number, minStock = 0): StockLevel {
  if (stock <= 0) return 'out';
  if (stock <= Math.max(minStock, 3)) return 'low';
  return 'in';
}

export const stockLabel: Record<StockLevel, string> = {
  out: 'Sin stock',
  low: 'Últimas unidades',
  in: 'En stock',
};
