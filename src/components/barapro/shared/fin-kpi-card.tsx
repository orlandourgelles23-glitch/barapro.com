'use client';

import { cn } from '@/lib/utils';
import { type ThemeVariant, theme } from '@/lib/barapro-theme';
import type { LucideIcon } from 'lucide-react';

/** Radial gradient backgrounds for icon glow effect per variant */
const iconGlowBg: Record<ThemeVariant, string> = {
  success:
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.18) 0%, oklch(0.55 0.17 160 / 0.06) 70%, transparent 100%)',
  warning:
    'radial-gradient(circle, oklch(0.72 0.17 70 / 0.18) 0%, oklch(0.72 0.17 70 / 0.06) 70%, transparent 100%)',
  danger:
    'radial-gradient(circle, oklch(0.58 0.22 25 / 0.18) 0%, oklch(0.58 0.22 25 / 0.06) 70%, transparent 100%)',
  info:
    'radial-gradient(circle, oklch(0.55 0.15 250 / 0.18) 0%, oklch(0.55 0.15 250 / 0.06) 70%, transparent 100%)',
  'panel-a':
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.18) 0%, oklch(0.55 0.17 160 / 0.06) 70%, transparent 100%)',
  'panel-b':
    'radial-gradient(circle, oklch(0.55 0.15 295 / 0.18) 0%, oklch(0.55 0.15 295 / 0.06) 70%, transparent 100%)',
};

interface FinKPICardProps {
  /** Theme color variant */
  variant?: ThemeVariant;
  /** Lucide icon component */
  icon?: LucideIcon;
  /** Card title/label */
  label: string;
  /** Primary value (formatted string) */
  value: string;
  /** Optional secondary detail below the value */
  detail?: string;
  /** Optional trend indicator */
  trend?: 'up' | 'down' | 'neutral';
  /** Stagger delay for entrance animation (in ms) */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized KPI card for financial metrics.
 * Premium glass card with subtle shadow, colored icon with soft glow,
 * entrance animation with stagger support, and hover elevation.
 *
 * @example
 * <FinKPICard variant="success" icon={TrendingUp} label="VAN" value="$1.2M" delay={0} />
 * <FinKPICard variant="danger" icon={TrendingDown} label="TIR" value="-5.3%" delay={100} />
 */
export function FinKPICard({
  variant = 'info',
  icon: Icon,
  label,
  value,
  detail,
  delay = 0,
  className,
}: FinKPICardProps) {
  const t = theme[variant];

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 animate-scale-in card-hover group',
        'transition-transform duration-200 ease-out',
        'hover:scale-[1.02] hover:shadow-card-lg',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-fin-xs text-muted-foreground truncate">{label}</p>
          <p className={cn('text-fin-xl', t.text)}>{value}</p>
          {detail && (
            <p className="text-fin-xs text-muted-foreground/80 truncate">{detail}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-lg h-10 w-10 shrink-0',
              'transition-transform duration-200 group-hover:scale-110',
            )}
            style={{ background: iconGlowBg[variant] }}
          >
            <Icon className={cn('h-[18px] w-[18px]', t.icon)} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact KPI strip item (inline, for narrow spaces).
 * Premium glass strip with soft icon glow and financial typography.
 */
export function FinKPIStrip({
  variant = 'info',
  icon: Icon,
  label,
  value,
  delay = 0,
  className,
}: Omit<FinKPICardProps, 'detail' | 'trend'>) {
  const t = theme[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 p-2.5 rounded-lg glass-card animate-fade-scale',
        'transition-shadow duration-200 hover:shadow-card-md',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {Icon && (
        <div
          className="flex items-center justify-center rounded h-8 w-8 shrink-0"
          style={{ background: iconGlowBg[variant] }}
        >
          <Icon className={cn('h-3.5 w-3.5', t.icon)} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-fin-xs text-muted-foreground leading-tight">{label}</p>
        <p className={cn('text-fin-sm font-semibold', t.text)}>{value}</p>
      </div>
    </div>
  );
}
