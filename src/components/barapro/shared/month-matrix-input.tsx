'use client';

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eraser, Copy, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ML = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface MonthMatrixInputProps {
  /** Total number of months in the project (proportional to project period) */
  duration: number;
  /** Current values for each month (0-based array, length = duration) */
  values: number[];
  /** Callback when a single month value changes */
  onChange: (index: number, value: string) => void;
  /** Callback to fill all months with a value */
  onFillAll: (value: number) => void;
  /** Show the "Clear Year 1" button (only in operations sections) */
  showClearYear1?: boolean;
  /** Callback to clear year 1 (indices 0..11) */
  onClearYear1?: () => void;
  /** Optional custom label for the matrix section */
  label?: string;
  /** Step for number inputs (default "1") */
  step?: string;
  /** Optional: make it read-only display mode */
  readOnly?: boolean;
  /** Whether to show the fill-all input */
  showFillAll?: boolean;
  /** Compact mode: further reduce sizes for tight dialogs */
  compact?: boolean;
}

/**
 * Modernized matrix of monthly inputs with:
 * - Per-year total column on the right
 * - Per-year fill/clear controls
 * - Grand total row at bottom
 * - Improved fill-all behavior (onBlur instead of per-keystroke)
 * - Copy-year functionality
 */
export function MonthMatrixInput({
  duration,
  values,
  onChange,
  onFillAll,
  showClearYear1 = false,
  onClearYear1,
  label = 'Cantidades mensuales',
  step = '1',
  readOnly = false,
  showFillAll = true,
  compact = false,
}: MonthMatrixInputProps) {
  const numYears = Math.ceil(duration / 12);
  const matrixMaxH = compact ? 'max-h-[26vh]' : 'max-h-[32vh]';
  const [fillValue, setFillValue] = useState('');

  const handleClearYear1 = () => {
    if (onClearYear1) {
      onClearYear1();
      toast.success('A\u00f1o 1 limpiado');
    }
  };

  const handleFillAll = useCallback(() => {
    const val = parseFloat(fillValue);
    if (!isNaN(val) && val >= 0) {
      onFillAll(val);
    }
  }, [fillValue, onFillAll]);

  const handleFillKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFillAll();
    }
  }, [handleFillAll]);

  // Compute per-year totals
  const yearTotals = React.useMemo(() => {
    const totals: number[] = [];
    for (let y = 0; y < numYears; y++) {
      const startM = y * 12;
      const endM = Math.min(startM + 12, duration);
      let sum = 0;
      for (let m = startM; m < endM; m++) {
        sum += values[m] || 0;
      }
      totals.push(sum);
    }
    return totals;
  }, [values, numYears, duration]);

  // Grand total
  const grandTotal = React.useMemo(() => {
    return values.reduce((s, v) => s + (v || 0), 0);
  }, [values]);

  const formatTotal = (n: number) => {
    if (n === 0) return '\u2014';
    if (Number.isInteger(n)) return n.toLocaleString('es-CU');
    return n.toLocaleString('es-CU', { maximumFractionDigits: 2 });
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-card-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20">
        <span className="text-fin-xs font-medium">
          {label}{' '}
          <span className="text-muted-foreground font-normal">
            ({duration}m, {numYears} a\u00f1o{numYears !== 1 ? 's' : ''})
          </span>
        </span>
        <div className="flex items-center gap-1.5">
          {showFillAll && !readOnly && (
            <div className="flex items-center gap-1">
              <span className="text-fin-xs text-muted-foreground">Llenar:</span>
              <Input
                type="number"
                placeholder="0"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                onBlur={handleFillAll}
                onKeyDown={handleFillKeyDown}
                className="w-14 h-6 text-fin-xs px-1.5 rounded-md border-border/60 focus-ring"
                step={step}
              />
            </div>
          )}
          {showClearYear1 && onClearYear1 && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-fin-xs gap-0.5 px-2 text-danger hover:text-danger hover:bg-danger-muted focus-ring-danger"
              onClick={handleClearYear1}
            >
              <Eraser className="h-3 w-3" />
              {'A\u00f1o 1'}
            </Button>
          )}
        </div>
      </div>

      {/* Matrix: scrollable if needed */}
      <div className={cn('overflow-x-auto overflow-y-auto custom-scrollbar', matrixMaxH)}>
        <table className="w-full border-collapse">
          {/* Month header row */}
          <thead>
            <tr className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              <th className="text-fin-xs font-semibold text-muted-foreground py-1 px-0.5 border-r border-b border-border/40 w-[32px] text-center">
                A\u00f1o
              </th>
              {ML.map((m) => (
                <th
                  key={m}
                  className="text-fin-xs font-semibold text-muted-foreground py-1 px-0 border-b border-border/30 w-[36px] text-center"
                >
                  {m}
                </th>
              ))}
              <th className="text-fin-xs font-semibold text-muted-foreground py-1 px-1 border-l border-b border-border/40 w-[48px] text-center bg-muted/30">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numYears }, (_, y) => {
              const startM = y * 12;
              const endM = Math.min(startM + 12, duration);
              const hasAnyValue = values
                .slice(startM, endM)
                .some((v) => v > 0);
              const yearTotal = yearTotals[y];

              return (
                <tr
                  key={y}
                  className={cn(
                    'fin-row-hover',
                    hasAnyValue ? 'bg-primary/[0.02]' : '',
                  )}
                >
                  {/* Year label */}
                  <td className="text-fin-xs font-medium text-muted-foreground py-0.5 px-0.5 border-r border-border/30 text-center whitespace-nowrap">
                    {y + 1}
                  </td>
                  {/* Month cells */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = startM + i;
                    if (m >= duration) {
                      return (
                        <td key={i} className="p-0 bg-muted/20" />
                      );
                    }
                    const val = values[m] || 0;
                    return (
                      <td key={i} className="p-0 border-l border-border/10">
                        {readOnly ? (
                          <div
                            className={cn(
                              'h-[22px] text-fin-xs flex items-center justify-center',
                              val > 0
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground/30',
                            )}
                          >
                            {val > 0 ? val : '\u2014'}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            value={val || ''}
                            onChange={(e) => onChange(m, e.target.value)}
                            placeholder="0"
                            className={cn(
                              'h-[22px] text-fin-xs px-0 border-0 rounded-none shadow-none',
                              'focus:z-20 focus:bg-primary/[0.04] focus-ring',
                              'hover:bg-muted/30 transition-colors duration-150',
                            )}
                            step={step}
                            min="0"
                          />
                        )}
                      </td>
                    );
                  })}
                  {/* Year total cell */}
                  <td className={cn(
                    'text-fin-xs text-center py-0.5 px-1 border-l border-border/40',
                    'bg-muted/20 font-medium',
                    yearTotal > 0 ? 'text-primary' : 'text-muted-foreground/40',
                  )}>
                    {formatTotal(yearTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Grand total footer */}
          {numYears > 1 && (
            <tfoot>
              <tr className="border-t border-border/40 bg-muted/30">
                <td className="text-fin-xs font-bold text-muted-foreground py-1 px-0.5 border-r border-border/30 text-center">
                  {'\u2211'}
                </td>
                {Array.from({ length: 12 }, (_, i) => {
                  // Per-column totals (month across years)
                  let colTotal = 0;
                  for (let y = 0; y < numYears; y++) {
                    const m = y * 12 + i;
                    if (m < duration) colTotal += values[m] || 0;
                  }
                  return (
                    <td key={i} className="text-fin-xs text-center py-0.5 border-l border-border/10 text-muted-foreground/60">
                      {colTotal > 0 ? formatTotal(colTotal) : ''}
                    </td>
                  );
                })}
                <td className="text-fin-xs font-bold text-center py-1 px-1 border-l border-border/40 text-primary">
                  {formatTotal(grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/**
 * Modernized Month TOGGLE matrix with:
 * - Per-year count column on the right
 * - Per-year select/clear toggle controls
 * - Better visual feedback with count badges
 * - Progress bar showing selection ratio
 */
interface MonthToggleMatrixProps {
  duration: number;
  selectedMonths: number[];
  onToggle: (month: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  label?: string;
  showClearYear1?: boolean;
  onClearYear1?: () => void;
  /** Compact mode: further reduce sizes for tight dialogs */
  compact?: boolean;
  /** Per-year fill/clear callbacks — enables per-year controls */
  onSelectYear?: (yearIndex: number) => void;
  onClearYear?: (yearIndex: number) => void;
}

export function MonthToggleMatrix({
  duration,
  selectedMonths,
  onToggle,
  onSelectAll,
  onClearAll,
  label = 'Meses de aplicaci\u00f3n',
  showClearYear1 = false,
  onClearYear1,
  compact = false,
  onSelectYear,
  onClearYear,
}: MonthToggleMatrixProps) {
  const numYears = Math.ceil(duration / 12);
  const selectedSet = new Set(selectedMonths);
  const matrixMaxH = compact ? 'max-h-[26vh]' : 'max-h-[32vh]';

  const handleClearYear1 = () => {
    if (onClearYear1) {
      onClearYear1();
      toast.success('A\u00f1o 1 limpiado');
    }
  };

  // Per-year selection counts
  const yearCounts = React.useMemo(() => {
    const counts: { selected: number; total: number }[] = [];
    for (let y = 0; y < numYears; y++) {
      const startM = y * 12;
      const endM = Math.min(startM + 12, duration);
      let selected = 0;
      for (let m = startM + 1; m <= endM; m++) {
        if (selectedSet.has(m)) selected++;
      }
      counts.push({ selected, total: endM - startM });
    }
    return counts;
  }, [selectedSet, numYears, duration]);

  const selectionRatio = duration > 0 ? selectedMonths.length / duration : 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-card-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-fin-xs font-medium">
            {label}
          </span>
          {/* Progress indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${selectionRatio * 100}%` }}
              />
            </div>
            <span className="text-fin-xs text-muted-foreground font-medium">
              {selectedMonths.length}/{duration}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-fin-xs gap-0.5 px-2 focus-ring"
            onClick={onSelectAll}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-fin-xs gap-0.5 px-2 focus-ring"
            onClick={onClearAll}
          >
            Ninguno
          </Button>
          {showClearYear1 && !onClearYear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-fin-xs gap-0.5 px-2 text-danger hover:text-danger hover:bg-danger-muted focus-ring-danger"
              onClick={handleClearYear1}
            >
              <Eraser className="h-3 w-3" />
              {'A\u00f1o 1'}
            </Button>
          )}
        </div>
      </div>

      {/* Toggle matrix */}
      <div className={cn('overflow-x-auto overflow-y-auto custom-scrollbar', matrixMaxH)}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              <th className="text-fin-xs font-semibold text-muted-foreground py-1 px-0.5 border-r border-b border-border/40 w-[32px] text-center">
                A\u00f1o
              </th>
              {ML.map((m) => (
                <th
                  key={m}
                  className="text-fin-xs font-semibold text-muted-foreground py-1 px-0 border-b border-border/30 w-[28px] text-center"
                >
                  {m}
                </th>
              ))}
              <th className="text-fin-xs font-semibold text-muted-foreground py-1 px-1 border-l border-b border-border/40 w-[42px] text-center bg-muted/30">
                Sel.
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numYears }, (_, y) => {
              const startM = y * 12;
              const { selected, total } = yearCounts[y];
              const allSelected = selected === total;
              const noneSelected = selected === 0;

              return (
                <tr key={y} className="fin-row-hover">
                  {/* Year label with per-year control */}
                  <td className="py-0.5 px-0.5 border-r border-border/30 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (allSelected && onClearYear) onClearYear(y);
                        else if (onSelectYear) onSelectYear(y);
                        else if (allSelected) {
                          // Fallback: clear this year's months
                          for (let i = 0; i < 12; i++) {
                            const m = startM + i + 1;
                            if (m <= duration && selectedSet.has(m)) onToggle(m);
                          }
                        } else {
                          for (let i = 0; i < 12; i++) {
                            const m = startM + i + 1;
                            if (m <= duration && !selectedSet.has(m)) onToggle(m);
                          }
                        }
                      }}
                      className={cn(
                        'w-full text-fin-xs font-medium rounded-sm px-1 py-0.5 cursor-pointer transition-colors duration-150',
                        allSelected
                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                          : noneSelected
                            ? 'text-muted-foreground hover:bg-muted'
                            : 'bg-primary/5 text-primary hover:bg-primary/10',
                      )}
                      title={allSelected ? 'Deseleccionar a\u00f1o' : 'Seleccionar a\u00f1o'}
                    >
                      {y + 1}
                    </button>
                  </td>
                  {/* Month toggle cells */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = startM + i + 1; // 1-based month number
                    if (m > duration) {
                      return (
                        <td key={i} className="p-0 bg-muted/20" />
                      );
                    }
                    const isSelected = selectedSet.has(m);
                    return (
                      <td key={i} className="p-px">
                        <button
                          type="button"
                          onClick={() => onToggle(m)}
                          className={cn(
                            'w-full h-[22px] text-fin-xs rounded-sm cursor-pointer focus-ring',
                            'transition-all duration-150',
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm scale-[0.97]'
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                          aria-label={`${ML[i]} ${isSelected ? 'seleccionado' : 'no seleccionado'}`}
                        >
                          {isSelected ? '\u2713' : m}
                        </button>
                      </td>
                    );
                  })}
                  {/* Per-year count cell */}
                  <td className={cn(
                    'text-fin-xs text-center py-0.5 px-1 border-l border-border/40',
                    'bg-muted/20',
                    allSelected ? 'text-primary font-bold' : selected > 0 ? 'text-primary font-medium' : 'text-muted-foreground/40',
                  )}>
                    {selected}/{total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
