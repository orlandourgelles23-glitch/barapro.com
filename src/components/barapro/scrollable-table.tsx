'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScrollableTableProps {
  /** Maximum height for vertical scroll (e.g., "500px", "400px"). Default: "500px" */
  maxHeight?: string;
  /** Number of sticky columns from the left. 0 = none, 1 = first column, 2 = first two. Default: 0 */
  stickyColumns?: number;
  /** Width of first sticky column in px (for 2-column sticky offset). Default: 40 */
  firstColWidth?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * ScrollableTable: wrapper that provides proper horizontal/vertical scrolling
 * with optional sticky left columns. Uses bg-background for dark mode support.
 *
 * Usage:
 *   <ScrollableTable maxHeight="500px" stickyColumns={1}>
 *     <Table>...</Table>
 *   </ScrollableTable>
 */

// Generate the base CSS that's shared across all instances
function getBaseStyles(): string {
  return `
    /* Sticky first column — header keeps bg-background */
    .scrollable-table--sticky table thead th:first-child {
      position: sticky;
      left: 0;
      z-index: 10;
      background: var(--background);
    }
    /* Sticky first column — body cells inherit row background */
    .scrollable-table--sticky table tbody td:first-child {
      position: sticky;
      left: 0;
      z-index: 10;
      background: inherit;
    }
    /* Sticky first column shadow */
    .scrollable-table--sticky table thead th:first-child::after,
    .scrollable-table--sticky table tbody td:first-child::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(to right, transparent, var(--scrollable-table-shadow, rgba(0,0,0,0.06)));
      pointer-events: none;
    }
    /* Sticky header row */
    .scrollable-table--sticky table thead tr {
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .scrollable-table--sticky table thead th {
      background: var(--background);
    }
    /* When header AND first column are both sticky, use higher z-index */
    .scrollable-table--sticky table thead th:first-child,
    .scrollable-table--sticky table thead th:nth-child(2) {
      z-index: 30;
    }
    /* Row hover: sticky cells inherit row background */
    .scrollable-table--sticky table tbody tr:hover td:first-child,
    .scrollable-table--sticky table tbody tr:hover td:nth-child(2) {
      background: inherit;
    }
  `.replace(/\n\s*/g, '').trim();
}

// Generate per-instance CSS for 2-column sticky (depends on firstColWidth)
function getInstanceStyles(stickyColumns: number, firstColWidth: number): string {
  if (stickyColumns < 2) return '';
  return `
    .scrollable-table--sticky table thead th:nth-child(2),
    .scrollable-table--sticky table tbody td:nth-child(2) {
      position: sticky;
      left: ${firstColWidth}px;
      z-index: 10;
      background: var(--background);
    }
    .scrollable-table--sticky table thead th:nth-child(2)::after,
    .scrollable-table--sticky table tbody td:nth-child(2)::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(to right, transparent, var(--scrollable-table-shadow, rgba(0,0,0,0.06)));
      pointer-events: none;
    }
  `.replace(/\n\s*/g, '').trim();
}

// Track which instance styles have been injected (keyed by firstColWidth)
const injectedInstanceStyles = new Set<string>();

export function ScrollableTable({
  maxHeight = '500px',
  stickyColumns = 0,
  firstColWidth = 40,
  children,
  className,
}: ScrollableTableProps) {
  const hasSticky = stickyColumns > 0;
  const stickyClass = hasSticky ? 'scrollable-table--sticky' : '';

  // Inject base styles once into document head
  React.useEffect(() => {
    if (!hasSticky) return;
    const styleId = 'scrollable-table-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = getBaseStyles();
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [hasSticky]);

  // Inject instance-specific styles (for 2-column sticky) keyed by firstColWidth
  React.useEffect(() => {
    if (stickyColumns < 2) return;
    const instanceKey = `scrollable-table-inst-${firstColWidth}`;
    if (injectedInstanceStyles.has(instanceKey)) return;
    const css = getInstanceStyles(stickyColumns, firstColWidth);
    if (!css) return;
    const style = document.createElement('style');
    style.id = instanceKey;
    style.textContent = css;
    document.head.appendChild(style);
    injectedInstanceStyles.add(instanceKey);
    return () => {
      style.remove();
      injectedInstanceStyles.delete(instanceKey);
    };
  }, [stickyColumns, firstColWidth]);

  return (
    <div
      className={cn('overflow-auto rounded-md border max-w-full', className)}
      style={{ maxHeight }}
      data-sticky={hasSticky ? stickyColumns : undefined}
    >
      <div className={cn(stickyClass, 'min-w-fit')}>
        {children}
      </div>
    </div>
  );
}
