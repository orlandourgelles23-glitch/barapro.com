'use client';

import React from 'react';
import { TableHead, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface YearMonthGroup {
  year: number;
  months: { monthIndex: number; label: string }[];
}

/**
 * Group months by year for the project timeline.
 * totalMonths: number of months to include
 * startDate: "YYYY-MM"
 */
export function groupMonthsByYear(
  totalMonths: number,
  startDate: string,
): YearMonthGroup[] {
  const [yearStr, monthStr] = startDate.split('-').map(Number);
  const names = MONTH_NAMES;
  const groups: YearMonthGroup[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const totalMonthsFromStart = i + (monthStr - 1);
    const m = totalMonthsFromStart % 12;
    const y = yearStr + Math.floor(totalMonthsFromStart / 12);
    const label = `${names[m]}`;

    if (groups.length === 0 || groups[groups.length - 1].year !== y) {
      groups.push({ year: y, months: [] });
    }
    groups[groups.length - 1].months.push({ monthIndex: i, label });
  }

  return groups;
}

interface YearMonthHeaderProps {
  groups: YearMonthGroup[];
  stickyColumns?: number;
  totalColumnMinWidth?: string;
  monthColumnMinWidth?: string;
  yearHeaderClassName?: string;
  monthHeaderClassName?: string;
  showYearSubtotals?: boolean;
}

/**
 * Reusable year/month grouped table header for financial views.
 * Renders two-row header: Year row (colspan=months) + Month sub-headers.
 * Professional design with left-border accent on year groups.
 * 
 * Usage:
 *   const groups = groupMonthsByYear(120, store.project.startDate);
 *   <YearMonthHeader groups={groups} />
 */
export function YearMonthHeader({
  groups,
  stickyColumns = 2,
  totalColumnMinWidth = '110px',
  monthColumnMinWidth = '70px',
  yearHeaderClassName,
  monthHeaderClassName,
  showYearSubtotals = false,
}: YearMonthHeaderProps) {
  return (
    <>
      {/* Year row */}
      <TableRow className="border-b-2 border-border/50">
        {stickyColumns > 0 && (
          <TableHead
            className="fin-col-header text-center bg-muted/80"
            rowSpan={2}
            style={{ minWidth: 40 }}
          >
            #
          </TableHead>
        )}
        {stickyColumns > 1 && (
          <TableHead
            className="fin-col-header bg-muted/80"
            rowSpan={2}
            style={{ minWidth: 180 }}
          >
            Concepto
          </TableHead>
        )}
        {groups.map((group, gi) => (
          <TableHead
            key={group.year}
            className={cn(
              'text-fin-xs font-bold text-center py-2 fin-col-header-year',
              gi % 2 === 0
                ? 'bg-info-muted/40 text-info'
                : 'bg-panel-b-muted/30 text-panel-b',
              yearHeaderClassName
            )}
            colSpan={showYearSubtotals ? group.months.length + 1 : group.months.length}
          >
            {group.year}
          </TableHead>
        ))}
        <TableHead
          className="fin-col-header-total text-center py-2"
          rowSpan={2}
          style={{ minWidth: totalColumnMinWidth }}
        >
          Total
        </TableHead>
      </TableRow>
      {/* Month row */}
      <TableRow className="border-b-2 border-border/50 bg-muted/40">
        {groups.map((group) => (
          <React.Fragment key={`month-row-${group.year}`}>
            {group.months.map((m) => (
              <TableHead
                key={`${group.year}-${m.monthIndex}`}
                className={cn('fin-col-header-month', monthHeaderClassName)}
                style={{ minWidth: monthColumnMinWidth }}
              >
                {m.label}
              </TableHead>
            ))}
            {showYearSubtotals && (
              <TableHead
                className="fin-subtotal-col text-fin-xs text-center font-semibold text-info"
                style={{ minWidth: '55px' }}
              >
                Subt.
              </TableHead>
            )}
          </React.Fragment>
        ))}
      </TableRow>
    </>
  );
}

/**
 * A simplified single-row year header for annual views.
 * Shows actual year numbers instead of "Año 1, Año 2...".
 */
export function AnnualHeader({
  years,
  stickyColumns = 2,
  yearColumnMinWidth = '100px',
  totalColumnMinWidth = '110px',
}: {
  years: number[];
  stickyColumns?: number;
  yearColumnMinWidth?: string;
  totalColumnMinWidth?: string;
}) {
  return (
    <TableRow className="border-b-2 border-border">
      {stickyColumns > 0 && (
        <TableHead className="fin-col-header text-center" style={{ minWidth: 40 }}>#</TableHead>
      )}
      {stickyColumns > 1 && (
        <TableHead className="fin-col-header" style={{ minWidth: 180 }}>
          Concepto
        </TableHead>
      )}
      {years.map((year, yi) => (
        <TableHead
          key={year}
          className={cn(
            'text-right',
            yi % 2 === 0
              ? 'bg-info-muted/30 text-fin-xs font-bold fin-col-header-year'
              : 'bg-panel-b-muted/20 text-fin-xs font-bold fin-col-header-year'
          )}
          style={{ minWidth: yearColumnMinWidth }}
        >
          {year}
        </TableHead>
      ))}
      <TableHead
        className="fin-col-header-total"
        style={{ minWidth: totalColumnMinWidth }}
      >
        Total
      </TableHead>
    </TableRow>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared utility: interleave year subtotal cells after each year
// ═══════════════════════════════════════════════════════════════

export interface SubtotalCell {
  value: number;
  isSubtotal: boolean;
}

/**
 * Takes a flat monthly values array and returns cells with year subtotals interleaved.
 * The returned array length = totalMonths + numberOfYears.
 *
 * @param monthlyValues - Flat array indexed by monthIndex (0-based)
 * @param groups - Output of groupMonthsByYear()
 * @param options.useLastValue - If true, subtotal = last month value in year (for accumulated fields)
 */
export function getMonthlyValuesWithSubtotals(
  monthlyValues: number[],
  groups: YearMonthGroup[],
  options?: { useLastValue?: boolean },
): SubtotalCell[] {
  const cells: SubtotalCell[] = [];
  for (const group of groups) {
    if (options?.useLastValue) {
      // Accumulated fields: subtotal = last month value of the year
      for (const m of group.months) {
        cells.push({ value: monthlyValues[m.monthIndex] ?? 0, isSubtotal: false });
      }
      const lastMonth = group.months[group.months.length - 1];
      cells.push({ value: monthlyValues[lastMonth.monthIndex] ?? 0, isSubtotal: true });
    } else {
      // Normal fields: subtotal = sum of all months in the year
      let yearSum = 0;
      for (const m of group.months) {
        const val = monthlyValues[m.monthIndex] ?? 0;
        cells.push({ value: val, isSubtotal: false });
        yearSum += val;
      }
      cells.push({ value: yearSum, isSubtotal: true });
    }
  }
  return cells;
}
