/**
 * BARAPRO Design System — Theme Tokens
 *
 * Semantic color variants for use in components that need
 * programmatic class switching (e.g., KPI cards, status badges).
 * These map to CSS custom properties defined in globals.css.
 *
 * USAGE:
 *   import { theme } from '@/lib/barapro-theme';
 *   <div className={theme.success.bg}>...</div>
 */

export type ThemeVariant = 'success' | 'warning' | 'danger' | 'info' | 'panel-a' | 'panel-b';

interface VariantTokens {
  /** Solid background for badges, active states */
  solid: string;
  /** Text color when on top of `solid` background */
  'solid-text': string;
  /** Subtle background for cards, rows, muted areas */
  bg: string;
  /** Text color for labels, headings */
  text: string;
  /** Subtle icon container background */
  iconBg: string;
  /** Icon color */
  icon: string;
  /** Left border accent */
  border: string;
}

const variants: Record<ThemeVariant, VariantTokens> = {
  success: {
    solid: 'bg-success text-success-foreground',
    'solid-text': 'text-success-foreground',
    bg: 'bg-success-muted',
    text: 'text-success',
    iconBg: 'bg-success-muted',
    icon: 'text-success',
    border: 'border-l-success',
  },
  warning: {
    solid: 'bg-warning text-warning-foreground',
    'solid-text': 'text-warning-foreground',
    bg: 'bg-warning-muted',
    text: 'text-warning',
    iconBg: 'bg-warning-muted',
    icon: 'text-warning',
    border: 'border-l-warning',
  },
  danger: {
    solid: 'bg-danger text-danger-foreground',
    'solid-text': 'text-danger-foreground',
    bg: 'bg-danger-muted',
    text: 'text-danger',
    iconBg: 'bg-danger-muted',
    icon: 'text-danger',
    border: 'border-l-danger',
  },
  info: {
    solid: 'bg-info text-info-foreground',
    'solid-text': 'text-info-foreground',
    bg: 'bg-info-muted',
    text: 'text-info',
    iconBg: 'bg-info-muted',
    icon: 'text-info',
    border: 'border-l-info',
  },
  'panel-a': {
    solid: 'bg-panel-a text-success-foreground',
    'solid-text': 'text-success-foreground',
    bg: 'bg-panel-a-muted',
    text: 'text-panel-a',
    iconBg: 'bg-panel-a-muted',
    icon: 'text-panel-a',
    border: 'border-l-panel-a',
  },
  'panel-b': {
    solid: 'bg-panel-b text-info-foreground',
    'solid-text': 'text-info-foreground',
    bg: 'bg-panel-b-muted',
    text: 'text-panel-b',
    iconBg: 'bg-panel-b-muted',
    icon: 'text-panel-b',
    border: 'border-l-panel-b',
  },
};

export const theme = variants;

/**
 * Quick helper: get a variant's token set
 * @deprecated Use `theme.variantName.token` directly
 */
export function getVariant(v: ThemeVariant): VariantTokens {
  return variants[v];
}

/**
 * Resolve a "positive/negative/neutral" value to a theme variant.
 * Useful for KPI cards, financial indicators, etc.
 */
export function valueToVariant(value: number | null | undefined, invert = false): ThemeVariant {
  if (value == null) return 'info';
  if (value > 0) return invert ? 'danger' : 'success';
  if (value < 0) return invert ? 'success' : 'danger';
  return 'warning';
}
