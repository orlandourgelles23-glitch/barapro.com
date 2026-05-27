'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { getMonthLabel } from '@/lib/format';

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface PurchaseOriginBreakdownProps {
  items: any[];
  monthsDuration: number;
  cupToMlc: number;
  startDate: string;
}

export function PurchaseOriginBreakdown({ items, monthsDuration, cupToMlc, startDate }: PurchaseOriginBreakdownProps) {
  const [view, setView] = useState<'annual' | 'monthly'>('annual');
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const numYears = Math.ceil(monthsDuration / 12);

  // Build monthly arrays
  const monthlyNacional = useMemo(() => {
    const arr = new Array(monthsDuration).fill(0) as number[];
    for (const item of items) {
      const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
      const isImportada = item.origin === 'Importada' ? true : (item.origin === 'Nacional' ? false : item.unitCostMLC > 0);
      if (isImportada) continue;

      for (let m = 0; m < monthsDuration; m++) {
        const monthNum = m + 1;
        const months = Array.isArray(item.months) ? item.months : [];
        if (!months.includes(monthNum)) continue;

        let cost = 0;
        if (quantities) {
          cost = (quantities[m] || 0) * (item.unitCostCUP || 0);
        } else {
          const total = (item.quantity || 0) * (item.unitCostCUP || 0);
          cost = months.length > 0 ? total / months.length : 0;
        }
        arr[m] += cost;
      }
    }
    return arr;
  }, [items, monthsDuration]);

  const monthlyImportada = useMemo(() => {
    const arr = new Array(monthsDuration).fill(0) as number[];
    for (const item of items) {
      const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
      const isImportada = item.origin === 'Importada' ? true : (item.origin === 'Nacional' ? false : item.unitCostMLC > 0);
      if (!isImportada) continue;

      for (let m = 0; m < monthsDuration; m++) {
        const monthNum = m + 1;
        const months = Array.isArray(item.months) ? item.months : [];
        if (!months.includes(monthNum)) continue;

        let cost = 0;
        if (quantities) {
          cost = (quantities[m] || 0) * ((item.unitCostCUP || 0) + (item.unitCostMLC || 0) * cupToMlc);
        } else {
          const total = (item.quantity || 0) * (item.unitCostCUP || 0) + (item.quantity || 0) * (item.unitCostMLC || 0) * cupToMlc;
          cost = months.length > 0 ? total / months.length : 0;
        }
        arr[m] += cost;
      }
    }
    return arr;
  }, [items, monthsDuration, cupToMlc]);

  // Aggregate by year
  const yearData = useMemo(() => {
    const data: { year: number; nacional: number; importada: number; total: number }[] = [];
    for (let y = 0; y < numYears; y++) {
      let nac = 0, imp = 0;
      for (let m = 0; m < 12; m++) {
        const idx = y * 12 + m;
        if (idx >= monthsDuration) break;
        nac += monthlyNacional[idx] || 0;
        imp += monthlyImportada[idx] || 0;
      }
      data.push({ year: y + 1, nacional: nac, importada: imp, total: nac + imp });
    }
    return data;
  }, [monthlyNacional, monthlyImportada, numYears, monthsDuration]);

  // Monthly data for the selected year
  const selectedYearMonthly = useMemo(() => {
    const yIdx = selectedYear - 1;
    const monthsInYear = Math.min(12, monthsDuration - yIdx * 12);
    const data: { label: string; nacional: number; importada: number; total: number }[] = [];
    let nac = 0, imp = 0;
    for (let m = 0; m < monthsInYear; m++) {
      const idx = yIdx * 12 + m;
      const n = monthlyNacional[idx] || 0;
      const i = monthlyImportada[idx] || 0;
      nac += n;
      imp += i;
      data.push({
        label: getMonthLabel(idx, startDate),
        nacional: n,
        importada: i,
        total: n + i,
      });
    }
    return { months: data, subtotal: { nacional: nac, importada: imp, total: nac + imp } };
  }, [selectedYear, monthlyNacional, monthlyImportada, monthsDuration, startDate]);

  const grandTotalNac = yearData.reduce((s, r) => s + r.nacional, 0);
  const grandTotalImp = yearData.reduce((s, r) => s + r.importada, 0);
  const grandTotal = yearData.reduce((s, r) => s + r.total, 0);

  const fmt = (n: number) => n.toLocaleString('es-CU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <Card className="glass-card rounded-xl shadow-card-sm animate-slide-up">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-fin-lg">Desglose por Origen: Nacional vs Importada</CardTitle>
            <p className="text-fin-xs text-muted-foreground mt-0.5">
              {view === 'annual' ? 'Distribución anual de compras según origen' : 'Distribución mensual de compras según origen'}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant={view === 'annual' ? 'default' : 'outline'}
              className={`h-7 text-fin-xs focus-ring transition-all duration-200 ${view === 'annual' ? 'bg-primary hover:bg-primary/90' : ''}`}
              onClick={() => setView('annual')}
            >
              Vista Anual
            </Button>
            <Button
              size="sm"
              variant={view === 'monthly' ? 'default' : 'outline'}
              className={`h-7 text-fin-xs focus-ring transition-all duration-200 ${view === 'monthly' ? 'bg-primary hover:bg-primary/90' : ''}`}
              onClick={() => setView('monthly')}
            >
              Vista Mensual
            </Button>
          </div>
        </div>
        <div className="flex gap-3 pt-1 flex-wrap">
          <Badge variant="outline" className="text-fin-xs border-info text-info">
            Nacional: {fmt(grandTotalNac)} CUP
          </Badge>
          <Badge variant="outline" className="text-fin-xs border-warning text-warning">
            Importada: {fmt(grandTotalImp)} CUP
          </Badge>
          <Badge variant="outline" className="text-fin-xs border-success text-success">
            Total: {fmt(grandTotal)} CUP
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {view === 'annual' ? (
          /* ═══════ ANNUAL VIEW ═══════ */
          <ScrollableTable maxHeight="300px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="fin-col-header min-w-[140px]">Concepto</TableHead>
                  {yearData.map((y) => (
                    <TableHead key={y.year} className="fin-col-header text-right min-w-[100px]">
                      Año {y.year}
                    </TableHead>
                  ))}
                  <TableHead className="fin-col-header-total text-right min-w-[120px] bg-muted/50">
                    Total General
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium text-info">Nacional (CUP)</TableCell>
                  {yearData.map((y) => (
                    <TableCell key={y.year} className="text-fin-sm text-right text-info">
                      {fmt(y.nacional)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right font-semibold text-info bg-muted/30">
                    {fmt(grandTotalNac)}
                  </TableCell>
                </TableRow>

                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium text-warning">Importada (CUP)</TableCell>
                  {yearData.map((y) => (
                    <TableCell key={y.year} className="text-fin-sm text-right text-warning">
                      {fmt(y.importada)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right font-semibold text-warning bg-muted/30">
                    {fmt(grandTotalImp)}
                  </TableCell>
                </TableRow>

                <TableRow className="fin-table-total">
                  <TableCell className="text-fin-sm font-bold">Total Compras (CUP)</TableCell>
                  {yearData.map((y) => (
                    <TableCell key={y.year} className="text-fin-sm text-right font-bold bg-muted/30">
                      {fmt(y.total)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right font-bold bg-muted/50">
                    {fmt(grandTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        ) : (
          /* ═══════ MONTHLY VIEW ═══════ */
          <>
            {/* Year selector */}
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <span className="text-fin-xs text-muted-foreground">Año:</span>
              <div className="flex flex-wrap gap-1">
                {yearData.map((y) => (
                  <Button
                    key={y.year}
                    size="sm"
                    variant={selectedYear === y.year ? 'default' : 'outline'}
                    className={`h-6 text-fin-xs px-2.5 focus-ring transition-all duration-200 ${selectedYear === y.year ? 'bg-primary hover:bg-primary/90 rounded-xl' : ''}`}
                    onClick={() => setSelectedYear(y.year)}
                  >
                    Año {y.year}
                  </Button>
                ))}
              </div>
            </div>

            {/* Monthly table */}
            <ScrollableTable maxHeight="350px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="fin-col-header min-w-[140px]">Concepto</TableHead>
                    {selectedYearMonthly.months.map((m, idx) => (
                      <TableHead key={idx} className="fin-col-header text-right min-w-[90px]">
                        {m.label}
                      </TableHead>
                    ))}
                    <TableHead className="fin-col-header-total text-right min-w-[110px] bg-muted/50">
                      Subtotal Año {selectedYear}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Nacional row */}
                  <TableRow className="fin-row-hover">
                    <TableCell className="text-fin-sm font-medium text-info">Nacional (CUP)</TableCell>
                    {selectedYearMonthly.months.map((m, idx) => (
                      <TableCell key={idx} className="text-fin-sm text-right text-info">
                        {fmt(m.nacional)}
                      </TableCell>
                    ))}
                    <TableCell className="text-fin-sm text-right font-semibold text-info bg-muted/30">
                      {fmt(selectedYearMonthly.subtotal.nacional)}
                    </TableCell>
                  </TableRow>

                  {/* Importada row */}
                  <TableRow className="fin-row-hover">
                    <TableCell className="text-fin-sm font-medium text-warning">Importada (CUP)</TableCell>
                    {selectedYearMonthly.months.map((m, idx) => (
                      <TableCell key={idx} className="text-fin-sm text-right text-warning">
                        {fmt(m.importada)}
                      </TableCell>
                    ))}
                    <TableCell className="text-fin-sm text-right font-semibold text-warning bg-muted/30">
                      {fmt(selectedYearMonthly.subtotal.importada)}
                    </TableCell>
                  </TableRow>

                  {/* Total row */}
                  <TableRow className="fin-table-total">
                    <TableCell className="text-fin-sm font-bold">Total Compras (CUP)</TableCell>
                    {selectedYearMonthly.months.map((m, idx) => (
                      <TableCell key={idx} className="text-fin-sm text-right font-bold bg-muted/30">
                        {fmt(m.total)}
                      </TableCell>
                    ))}
                    <TableCell className="text-fin-sm text-right font-bold bg-muted/50">
                      {fmt(selectedYearMonthly.subtotal.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollableTable>
          </>
        )}
      </CardContent>
    </Card>
  );
}
