'use client';

import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';

interface MonthSelectorProps {
  /** Array of month names (1-indexed, index 0 = placeholder) */
  months: string[];
  /** Set of selected month indices (1-based) */
  selected: Set<number>;
  /** Toggle a month */
  onToggle: (month: number) => void;
  /** Select or deselect all months */
  onToggleAll?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

/**
 * Standardized month selector grid with toggle buttons.
 * Modern chip-style month selector with selected months highlighted
 * with primary color and smooth toggle animation.
 *
 * @example
 * <MonthSelector
 *   months={['', 'Ene', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']}
 *   selected={selectedMonths}
 *   onToggle={(m) => setSelected(prev => ...)}
 *   onToggleAll={() => setSelected(allMonths ? new Set() : new Set([1..12]))}
 * />
 */
export function MonthSelector({
  months,
  selected,
  onToggle,
  onToggleAll,
  className,
  compact = false,
}: MonthSelectorProps) {
  const allSelected = months.length > 1 && selected.size === months.length - 1;

  return (
    <div className={cn('space-y-2', className)}>
      {onToggleAll && (
        <button
          type="button"
          onClick={onToggleAll}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-fin-xs font-medium rounded-lg border transition-all duration-200 cursor-pointer focus-ring',
            allSelected
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:border-border',
          )}
        >
          <span className="flex items-center justify-center h-3.5 w-3.5">
            {allSelected ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
          </span>
          Todos
        </button>
      )}
      <div className="flex flex-wrap gap-1.5">
        {months.slice(1).map((name, idx) => {
          const monthNum = idx + 1;
          const isSelected = selected.has(monthNum);
          return (
            <button
              key={monthNum}
              type="button"
              onClick={() => onToggle(monthNum)}
              className={cn(
                'inline-flex items-center justify-center rounded-lg border text-fin-xs font-medium cursor-pointer focus-ring',
                'transition-all duration-200',
                compact ? 'h-7 min-w-[40px] px-2' : 'h-8 min-w-[48px] px-2.5',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[0.97]'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground hover:border-border',
              )}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <p className="text-fin-xs text-muted-foreground">
          {selected.size} mes{selected.size !== 1 ? 'es' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
