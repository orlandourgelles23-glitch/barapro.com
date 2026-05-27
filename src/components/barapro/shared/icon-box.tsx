'use client';

import { cn } from '@/lib/utils';
import { type ThemeVariant, theme } from '@/lib/barapro-theme';
import type { LucideIcon } from 'lucide-react';

/** Soft gradient backgrounds per variant for the icon container */
const gradientBg: Record<ThemeVariant, string> = {
  success:
    'linear-gradient(135deg, oklch(0.55 0.17 160 / 0.14) 0%, oklch(0.55 0.17 160 / 0.06) 100%)',
  warning:
    'linear-gradient(135deg, oklch(0.72 0.17 70 / 0.14) 0%, oklch(0.72 0.17 70 / 0.06) 100%)',
  danger:
    'linear-gradient(135deg, oklch(0.58 0.22 25 / 0.14) 0%, oklch(0.58 0.22 25 / 0.06) 100%)',
  info:
    'linear-gradient(135deg, oklch(0.55 0.15 250 / 0.14) 0%, oklch(0.55 0.15 250 / 0.06) 100%)',
  'panel-a':
    'linear-gradient(135deg, oklch(0.55 0.17 160 / 0.14) 0%, oklch(0.55 0.17 160 / 0.06) 100%)',
  'panel-b':
    'linear-gradient(135deg, oklch(0.55 0.15 295 / 0.14) 0%, oklch(0.55 0.15 295 / 0.06) 100%)',
};

interface IconBoxProps {
  /** Theme color variant */
  variant?: ThemeVariant;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

const sizeMap = {
  sm: 'h-7 w-7 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
} as const;

const iconSizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
} as const;

/**
 * Standardized icon-in-colored-box component.
 * Refined icon container with soft gradient background,
 * size variants (sm, md, lg), and color variants matching
 * the app's semantic colors.
 *
 * @example
 * <IconBox variant="success" icon={TrendingUp} />
 * <IconBox variant="info" icon={BarChart3} size="lg" />
 */
export function IconBox({
  variant = 'info',
  icon: Icon,
  size = 'md',
  className,
}: IconBoxProps) {
  const t = theme[variant];

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        'transition-transform duration-200 hover:scale-105',
        sizeMap[size],
        className,
      )}
      style={{ background: gradientBg[variant] }}
    >
      <Icon className={cn(iconSizeMap[size], t.icon)} />
    </div>
  );
}
