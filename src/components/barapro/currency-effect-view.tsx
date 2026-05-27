'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { buildCurrencyEffect } from '@/lib/barapro-financial';
import { cn } from '@/lib/utils';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

export function CurrencyEffectView() {
  const store = useBaraproStore();
  const currencyData = useMemo(() => buildCurrencyEffect(store), [store]);

  const duration = currencyData.length;

  const monthGroups = useMemo(() => groupMonthsByYear(duration, store.project.startDate), [duration, store.project.startDate]);

  // ── Concept definitions (shared by render & export) ──
  const currencyConcepts = useMemo(() => [
    { num: 1, label: 'currencyEffect.entradasDivisas', key: 'ingresosMLC', isBold: true, isSectionHeader: true, isCumulative: false },
    { num: 2, label: 'currencyEffect.ingresosCUPeq', key: 'ingresosCUPequivalent', isBold: false, isSectionHeader: false, isCumulative: false },
    { num: 3, label: 'currencyEffect.salidasDivisas', key: 'egresosMLC', isBold: true, isSectionHeader: true, isCumulative: false },
    { num: 4, label: 'currencyEffect.egresosCUPEq', key: 'egresosCUPequivalent', isBold: false, isSectionHeader: false, isCumulative: false },
    { num: 5, label: 'EFECTO NETO SOBRE LAS DIVISAS', key: 'balanceMLC', isBold: true, isSectionHeader: true, isCumulative: false },
    { num: 6, label: 'currencyEffect.efectoNetoCUP', key: 'balanceCUP', isBold: false, isSectionHeader: false, isCumulative: false },
    { num: 7, label: 'currencyEffect.acumuladoMLC', key: 'acumuladoMLC', isBold: true, isSectionHeader: true, isCumulative: true },
    { num: 8, label: 'currencyEffect.acumuladoCUP', key: 'acumuladoCUP', isBold: false, isSectionHeader: false, isCumulative: true },
  ], []);

  const yearlyData = useMemo(() => {
    const years: Record<number, {
      ingresosMLC: number; ingresosCUPequivalent: number; egresosMLC: number; egresosCUPequivalent: number;
      balanceMLC: number; balanceCUP: number; acumuladoMLC: number; acumuladoCUP: number;
    }> = {};
    for (const row of currencyData) {
      const year = row.year;
      if (!years[year]) {
        years[year] = { ingresosMLC: 0, ingresosCUPequivalent: 0, egresosMLC: 0, egresosCUPequivalent: 0, balanceMLC: 0, balanceCUP: 0, acumuladoMLC: 0, acumuladoCUP: 0 };
      }
      years[year].ingresosMLC += row.ingresosMLC;
      years[year].ingresosCUPequivalent += row.ingresosCUPequivalent;
      years[year].egresosMLC += row.egresosMLC;
      years[year].egresosCUPequivalent += row.egresosCUPequivalent;
      years[year].balanceMLC += row.balanceMLC;
      years[year].balanceCUP += row.balanceCUP;
    }
    let accMLC = 0;
    let accCUP = 0;
    return Object.entries(years).map(([year, data]) => {
      accMLC += data.balanceMLC;
      accCUP += data.balanceCUP;
      return { year: `Año ${year }}`, ...data, acumuladoMLC: accMLC, acumuladoCUP: accCUP };
    });
  }, [currencyData]);
  const totals = useMemo(() => ({
    totalIngresosMLC: currencyData.reduce((s, r) => s + r.ingresosMLC, 0),
    totalEgresosMLC: currencyData.reduce((s, r) => s + r.egresosMLC, 0),
    balanceMLC: currencyData.reduce((s, r) => s + r.balanceMLC, 0),
    balanceAcumuladoMLC: currencyData.length > 0 ? currencyData[currencyData.length - 1].acumuladoMLC : 0,
  }), [currencyData]);

  // ── Export data: Annual ──
  const annualExportData = useMemo(() => {
    const numPeriods = yearlyData.length;
    const headers = ['#', 'Concepto', ...Array.from({ length: numPeriods }, (_, i) => `Año ${i + 1}`), 'Total'];
    const rows: TableExportRow[] = currencyConcepts.map(c => {
      const values = yearlyData.map((row: any) => (row[c.key] as number) ?? 0);
      const total = c.isCumulative ? values[values.length - 1] : values.reduce((s, v) => s + v, 0);
      return {
        cells: [String(c.num), c.label, ...values.map(v => formatNum(v)), formatNum(total)],
        bold: c.isBold,
        isSectionHeader: c.isSectionHeader,
      };
    });
    return { headers, rows };
  }, [yearlyData, currencyConcepts]);

  // ── Export data: Monthly ──
  const monthlyExportData = useMemo(() => {
    const monthHeaders: string[] = ['#', 'Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        monthHeaders.push(m.label);
      }
      monthHeaders.push(`Subt. ${group.year}`);
    }
    monthHeaders.push('Total');

    const rows: TableExportRow[] = currencyConcepts.map(c => {
      const monthlyValues = currencyData.map((row: any) => (row[c.key] as number) ?? 0);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, { useLastValue: c.isCumulative });
      const total = c.isCumulative
        ? (cells.length > 0 ? cells[cells.length - 1].value : 0)
        : cells.filter(cell => !cell.isSubtotal).reduce((s, cell) => s + cell.value, 0);
      return {
        cells: [String(c.num), c.label, ...cells.map(cell => formatNum(cell.value)), formatNum(total)],
        bold: c.isBold,
        isSectionHeader: c.isSectionHeader,
      };
    });
    return { headers: monthHeaders, rows };
  }, [currencyData, monthGroups, currencyConcepts]);

  // Transposed table renderer (Resolución 1/2022 format: concepts=rows, periods=columns)
  const renderCurrencyTable = (isAnnual: boolean) => {
    const periodData = isAnnual ? yearlyData : currencyData;
    const numPeriods = periodData.length;

    const conceptVisuals: Record<number, { color: string; bg?: string }> = {
      1: { color: 'text-success', bg: 'bg-success-muted' },
      2: { color: 'text-success' },
      3: { color: 'text-danger', bg: 'bg-danger-muted' },
      4: { color: 'text-danger' },
      5: { color: '', bg: 'bg-muted-foreground' },
      6: { color: '' },
      7: { color: '', bg: 'bg-info-muted' },
      8: { color: '' },
    };

    return (
      <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
        <Table>
          <TableHeader>
            {isAnnual ? (
              <TableRow>
                <TableHead className="fin-col-header font-bold min-w-[40px] text-center">#</TableHead>
                <TableHead className="fin-col-header font-bold min-w-[220px]">{'Concepto'}</TableHead>
                {Array.from({ length: numPeriods }, (_, i) => (
                  <TableHead key={i} className="fin-col-header-year text-right min-w-[100px]">
                    {`Año ${i + 1 }}`}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header-total text-right min-w-[120px] font-bold bg-info-muted">
                  {'Total'}
                </TableHead>
              </TableRow>
            ) : (
              <YearMonthHeader groups={monthGroups} stickyColumns={2} totalColumnMinWidth="120px" showYearSubtotals />
            )}
          </TableHeader>
          <TableBody>
            {currencyConcepts.map((c) => {
              const values = periodData.map((row: any) => (row[c.key] as number) ?? 0);
              const total = c.isCumulative
                ? values[values.length - 1]
                : values.reduce((s, v) => s + v, 0);

              const isHeader = c.isSectionHeader;
              const vis = conceptVisuals[c.num] || { color: '', bg: '' };
              return (
                <TableRow key={c.num} className={cn(
                  !isHeader && 'fin-row-hover',
                  isHeader && 'border-y-2 border-muted',
                )}>
                  <TableCell className={cn('text-fin-sm text-center', isHeader && 'font-bold text-white bg-muted-foreground')}>{c.num}</TableCell>
                  <TableCell className={cn('text-fin-sm', c.isBold && 'font-bold', isHeader && 'font-semibold text-white bg-muted-foreground', vis.bg)}>{c.label}</TableCell>
                  {!isAnnual ? (() => {
                    const cells = getMonthlyValuesWithSubtotals(values, monthGroups, {
                      useLastValue: c.isCumulative,
                    });
                    let gi = 0;
                    return cells.map((cell, ci) => {
                      const isBalanceLike = c.num >= 5;
                      const valColor = vis.color || (isBalanceLike ? (cell.value >= 0 ? 'text-success' : 'text-danger') : '');
                      if (cell.isSubtotal) {
                        const year = monthGroups[gi].year;
                        gi++;
                        return (
                          <TableCell key={`sub-${year}`} className={cn('text-fin-sm text-right tabular-nums font-semibold bg-info-muted/60', c.isBold && 'font-semibold', valColor)}>
                            {formatNum(cell.value)}
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={ci} className={cn('text-fin-sm text-right tabular-nums', c.isBold && 'font-semibold', valColor)}>
                          {formatNum(cell.value)}
                        </TableCell>
                      );
                    });
                  })() : values.map((val, vi) => {
                    const isBalanceLike = c.num >= 5;
                    const valColor = vis.color || (isBalanceLike ? (val >= 0 ? 'text-success' : 'text-danger') : '');
                    return (
                      <TableCell key={vi} className={cn('text-fin-sm text-right tabular-nums', c.isBold && 'font-semibold', valColor)}>
                        {formatNum(val)}
                      </TableCell>
                    );
                  })}
                  <TableCell className={cn(
                    'text-fin-sm text-right font-bold tabular-nums bg-info-muted/50',
                    total >= 0 ? 'text-success' : 'text-danger',
                  )}>
                    {formatNum(total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollableTable>
    );
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Balance Financiero Externo (Divisas)"
        description="Efecto sobre las divisas según Resolución 1/2022"
        icon={TrendingUp}
        variant="info"
      />

      {currencyData.length === 0 && (
        <Card className="glass-card shadow-card-sm rounded-xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-fin-sm">{'No hay datos de efecto sobre divisas.'}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5 text-success" /><p className="text-fin-xs text-muted-foreground">{'Total Entradas MLC'}</p></div>
            <p className="text-fin-xl font-bold text-success">{formatNum(totals.totalIngresosMLC)} MLC</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-danger">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5"><ArrowDownRight className="h-3.5 w-3.5 text-danger" /><p className="text-fin-xs text-muted-foreground">{'Total Salidas MLC'}</p></div>
            <p className="text-fin-xl font-bold text-danger">{formatNum(totals.totalEgresosMLC)} MLC</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-warning" /><p className="text-fin-xs text-muted-foreground">{'Balance MLC'}</p></div>
            <p className={`text-fin-xl font-bold ${totals.balanceMLC >= 0 ? 'text-success' : 'text-danger'}`}>{formatNum(totals.balanceMLC)} MLC</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-info" /><p className="text-fin-xs text-muted-foreground">{'Efecto Neto Acumulado MLC'}</p></div>
            <p className={`text-fin-xl font-bold ${totals.balanceAcumuladoMLC >= 0 ? 'text-success' : 'text-danger'}`}>{formatNum(totals.balanceAcumuladoMLC)} MLC</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="annual">
        <TabsList>
          <TabsTrigger value="annual" className="focus-ring transition-all duration-200">{'Vista Anual'}</TabsTrigger>
          <TabsTrigger value="monthly" className="focus-ring transition-all duration-200">{'Vista Mensual'}</TabsTrigger>        </TabsList>

        <TabsContent value="annual">
          <Card className="glass-card shadow-card-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Anual'}</CardTitle>
                <TableExportButton
                  moduleName="Efecto Cambiario"
                  tableName="Vista Anual"
                  headers={annualExportData.headers}
                  rows={annualExportData.rows}
                  landscape={annualExportData.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderCurrencyTable(true)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card className="glass-card shadow-card-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Mensual'}</CardTitle>
                <TableExportButton
                  moduleName="Efecto Cambiario"
                  tableName="Vista Mensual"
                  headers={monthlyExportData.headers}
                  rows={monthlyExportData.rows}
                  landscape={monthlyExportData.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderCurrencyTable(false)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
