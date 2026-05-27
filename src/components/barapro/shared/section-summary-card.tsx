'use client';

import { cn } from '@/lib/utils';
import { type ThemeVariant, theme } from '@/lib/barapro-theme';
import type { LucideIcon } from 'lucide-react';

/** Radial glow backgrounds for icon */
const summaryGlowBg: Record<ThemeVariant, string> = {
  success:
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.16) 0%, oklch(0.55 0.17 160 / 0.05) 70%, transparent 100%)',
  warning:
    'radial-gradient(circle, oklch(0.72 0.17 70 / 0.16) 0%, oklch(0.72 0.17 70 / 0.05) 70%, transparent 100%)',
  danger:
    'radial-gradient(circle, oklch(0.58 0.22 25 / 0.16) 0%, oklch(0.58 0.22 25 / 0.05) 70%, transparent 100%)',
  info:
    'radial-gradient(circle, oklch(0.55 0.15 250 / 0.16) 0%, oklch(0.55 0.15 250 / 0.05) 70%, transparent 100%)',
  'panel-a':
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.16) 0%, oklch(0.55 0.17 160 / 0.05) 70%, transparent 100%)',
  'panel-b':
    'radial-gradient(circle, oklch(0.55 0.15 295 / 0.16) 0%, oklch(0.55 0.15 295 / 0.05) 70%, transparent 100%)',
};

interface SectionSummaryCardProps {
  /** Theme color variant for the left accent */
  variant?: ThemeVariant;
  /** Optional icon */
  icon?: LucideIcon;
  /** Card title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional value shown prominently */
  value?: string;
  /** Card content */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card with a colored left border accent and optional icon.
 * Compact summary with colored accent, total value prominently displayed,
 * glass card styling, and financial typography.
 *
 * @example
 * <SectionSummaryCard variant="success" icon={TrendingUp} title="Ingresos" value="$500K" />
 */
export function SectionSummaryCard({
  variant = 'info',
  icon: Icon,
  title,
  subtitle,
  value,
  children,
  className,
}: SectionSummaryCardProps) {
  const t = theme[variant];

  return (
    <div
      className={cn(
        'glass-card rounded-xl shadow-card-md animate-fade-scale',
        'p-4 border-l-4',
        t.border,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className="flex items-center justify-center rounded-lg h-9 w-9 shrink-0"
            style={{ background: summaryGlowBg[variant] }}
          >
            <Icon className={cn('h-4 w-4', t.icon)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-fin-base font-semibold text-foreground">{title}</h3>
            {value && (
              <span className={cn('text-fin-lg font-bold', t.text)}>{value}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-fin-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children && <div className="mt-3 pt-3 border-t border-border/50">{children}</div>}
    </div>
  );
}
