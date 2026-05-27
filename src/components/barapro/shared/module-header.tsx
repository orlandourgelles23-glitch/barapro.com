'use client';

import { cn } from '@/lib/utils';
import { type ThemeVariant, theme } from '@/lib/barapro-theme';
import type { LucideIcon } from 'lucide-react';

/** Radial gradient backgrounds for icon glow per variant */
const headerGlowBg: Record<ThemeVariant, string> = {
  success:
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.15) 0%, oklch(0.55 0.17 160 / 0.04) 70%, transparent 100%)',
  warning:
    'radial-gradient(circle, oklch(0.72 0.17 70 / 0.15) 0%, oklch(0.72 0.17 70 / 0.04) 70%, transparent 100%)',
  danger:
    'radial-gradient(circle, oklch(0.58 0.22 25 / 0.15) 0%, oklch(0.58 0.22 25 / 0.04) 70%, transparent 100%)',
  info:
    'radial-gradient(circle, oklch(0.55 0.15 250 / 0.15) 0%, oklch(0.55 0.15 250 / 0.04) 70%, transparent 100%)',
  'panel-a':
    'radial-gradient(circle, oklch(0.55 0.17 160 / 0.15) 0%, oklch(0.55 0.17 160 / 0.04) 70%, transparent 100%)',
  'panel-b':
    'radial-gradient(circle, oklch(0.55 0.15 295 / 0.15) 0%, oklch(0.55 0.15 295 / 0.04) 70%, transparent 100%)',
};

interface ModuleHeaderProps {
  /** Module title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional badge count or status text */
  badge?: string | number;
  /** Optional icon to display beside the title */
  icon?: LucideIcon;
  /** Color variant for the icon and accent (default: info) */
  variant?: ThemeVariant;
  /** Right-side action area (e.g., Add button) */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standardized module header card.
 * Clean header with gradient accent, icon with glow background,
 * title + description layout, and optional action buttons.
 *
 * @example
 * <ModuleHeader
 *   title="B. Construcción y Montaje"
 *   description="Costos de construcción, montaje e instalación"
 *   icon={HardHat}
 *   variant="info"
 *   badge={items.length}
 *   actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Agregar</Button>}
 * />
 */
export function ModuleHeader({
  title,
  description,
  badge,
  icon: Icon,
  variant = 'info',
  actions,
  className,
}: ModuleHeaderProps) {
  const t = theme[variant];

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 shadow-card-md animate-slide-up',
        'flex items-start justify-between gap-4',
        className,
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {Icon && (
          <div
            className="flex items-center justify-center rounded-lg h-10 w-10 shrink-0 mt-0.5"
            style={{ background: headerGlowBg[variant] }}
          >
            <Icon className={cn('h-[18px] w-[18px]', t.icon)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-fin-xl text-foreground">{title}</h2>
            {badge != null && (
              <span
                className={cn(
                  'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-fin-xs font-semibold',
                  t.solid,
                )}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-fin-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
