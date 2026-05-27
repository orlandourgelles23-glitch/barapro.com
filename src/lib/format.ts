// ─── Utilidades de formato compartidas ────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function today(): string {
  return new Date().toLocaleDateString("es-CU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Formato corto para tablas */
export function fmt(value: number): string {
  return new Intl.NumberFormat("es-CU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Formato corto con sufijos K/M/B para gráficos y dashboards
 */
export function formatCompact(value: number, decimals = 1): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

/**
 * Formato con separadores de miles, sin decimales
 */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('es-CU');
}

/**
 * Formato con separadores de miles y decimales
 */
export function formatDecimal(value: number, decimals = 2): string {
  return value.toLocaleString('es-CU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Safe number formatting - returns '—' for NaN/Infinity
 */
export function formatSafe(value: number, formatter?: (v: number) => string): string {
  if (!isFinite(value) || isNaN(value)) return '—';
  return formatter ? formatter(value) : formatDecimal(value);
}

// ─── Utilidades de meses basadas en fecha de inicio ──────────────────────────

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Retorna la etiqueta del mes basándose en la fecha de inicio del proyecto.
 * monthIndex es 0-based (mes 0 = primer mes del proyecto).
 * startDate es formato "YYYY-MM" (ej: "2025-04").
 */
export function getMonthLabel(monthIndex: number, startDate: string): string {
  const [yearStr, monthStr] = startDate.split('-').map(Number);
  const names = MONTH_NAMES;
  const totalMonths = monthIndex + (monthStr - 1);
  const m = totalMonths % 12;
  const y = yearStr + Math.floor(totalMonths / 12);
  return `${names[m]} ${y}`;
}
