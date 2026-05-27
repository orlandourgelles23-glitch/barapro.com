'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildDepreciationByItem, calcGastosPreviosAmortization } from '@/lib/barapro-financial';
import { getMonthLabel } from '@/lib/format';
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
import { Building2, TrendingDown, CalendarClock, Sparkles } from 'lucide-react';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { cn } from '@/lib/utils'
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(0) + '%';
}

export function DepreciationView() {
  const store = useBaraproStore();
  const data = useMemo(() => buildDepreciationByItem(store), [store]);

  // Amortización de Gastos Previos (Resolución 1/2022)
  const gpAmort = useMemo(() => calcGastosPreviosAmortization(store), [store]);

  const duration = store.project.monthsDuration || 120;

  const avgMonthlyDepreciation = useMemo(() => {
    const nonZero = data.totalMonthlyDepreciation.filter((v) => v > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
  }, [data.totalMonthlyDepreciation]);

  const avgMonthlyAmortization = useMemo(() => {
    const nonZero = data.totalMonthlyAmortization.filter((v) => v > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
  }, [data.totalMonthlyAmortization]);

  const yearlyDepreciation = useMemo(() => {
    const numYears = Math.ceil(duration / 12);
    const years: number[] = new Array(numYears).fill(0);
    for (let i = 0; i < duration; i++) {
      const y = Math.floor(i / 12);
      years[y] += data.totalMonthlyDepreciation[i] || 0;
    }
    return years;
  }, [data.totalMonthlyDepreciation, duration]);

  const yearlyAmortization = useMemo(() => {
    const numYears = Math.ceil(duration / 12);
    const years: number[] = new Array(numYears).fill(0);
    for (let i = 0; i < duration; i++) {
      const y = Math.floor(i / 12);
      years[y] += data.totalMonthlyAmortization[i] || 0;
    }
    return years;
  }, [data.totalMonthlyAmortization, duration]);


  const maxYears = useMemo(() => {
    const assetMax = data.assets.reduce((max, a) => Math.max(max, a.schedule.length), 0);
    const intangibleMax = data.intangibleAssets.reduce((max, a) => Math.max(max, a.schedule.length), 0);
    return Math.max(assetMax, intangibleMax);
  }, [data.assets, data.intangibleAssets]);

  const yearlySummary = useMemo(() => {
    const rows: {
      year: number;
      depreciation: number;
      amortization: number;
      total: number;
      accumulated: number;
      bookValue: number;
    }[] = [];
    let accumulated = 0;

    for (let y = 0; y < maxYears; y++) {
      const depreciation = yearlyDepreciation[y] || 0;
      const amortization = yearlyAmortization[y] || 0;
      const total = depreciation + amortization;
      accumulated += total;
      const bookValue = (data.totalAssetCost + data.totalIntangibleCost) - accumulated;
      rows.push({
        year: y + 1,
        depreciation,
        amortization,
        total,
        accumulated,
        bookValue: Math.max(bookValue, 0),
      });
    }
    return rows;
  }, [yearlyDepreciation, yearlyAmortization, data.totalAssetCost, data.totalIntangibleCost, maxYears]);

  // Datos para la pestaña de Valor en Libros
  const bookValueRows = useMemo(() => {
    const maxYears = Math.max(
      data.assets.reduce((m, a) => Math.max(m, a.schedule.length), 0),
      data.intangibleAssets.reduce((m, a) => Math.max(m, a.schedule.length), 0)
    );
    const numYears = Math.max(maxYears, 1);
    const rows: { assetName: string; year: number; cost: number; dep: number; acc: number; book: number; isTotal: boolean }[] = [];

    for (const asset of data.assets) {
      for (let y = 0; y < asset.schedule.length; y++) {
        const s = asset.schedule[y];
        rows.push({ assetName: asset.name, year: s.year, cost: asset.totalCost, dep: s.depreciation, acc: s.accumulatedDepreciation, book: s.endingValue, isTotal: false });
      }
      const lastRow = asset.schedule[asset.schedule.length - 1];
      for (let y = asset.schedule.length + 1; y <= numYears; y++) {
        rows.push({ assetName: asset.name, year: y, cost: asset.totalCost, dep: 0, acc: lastRow.accumulatedDepreciation, book: lastRow.endingValue, isTotal: false });
      }
    }
    for (const asset of data.intangibleAssets) {
      for (let y = 0; y < asset.schedule.length; y++) {
        const s = asset.schedule[y];
        rows.push({ assetName: `⚡ ${asset.name}`, year: s.year, cost: asset.totalCost, dep: s.depreciation, acc: s.accumulatedDepreciation, book: s.endingValue, isTotal: false });
      }
      const lastRow = asset.schedule[asset.schedule.length - 1];
      for (let y = asset.schedule.length + 1; y <= numYears; y++) {
        rows.push({ assetName: `⚡ ${asset.name}`, year: y, cost: asset.totalCost, dep: 0, acc: lastRow.accumulatedDepreciation, book: lastRow.endingValue, isTotal: false });
      }
    }
    for (let y = 1; y <= numYears; y++) {
      const yearRows = rows.filter((r) => r.year === y && !r.isTotal);
      const totalRows = rows.filter((r) => r.year === y);
      rows.push({ assetName: '', year: y, cost: totalRows.reduce((s, r) => s + r.cost, 0), dep: totalRows.reduce((s, r) => s + r.dep, 0), acc: totalRows.reduce((s, r) => s + r.acc, 0), book: totalRows.reduce((s, r) => s + r.book, 0), isTotal: true });
    }
    return rows;
  }, [data.assets, data.intangibleAssets]);

  // Mes de inicio de operación (primer mes con depreciación > 0)
  const operationStartIdx = useMemo(() => {
    const combined = data.totalMonthlyDepreciation.map((d, i) => d + (data.totalMonthlyAmortization[i] || 0));
    return combined.findIndex(v => v > 0);
  }, [data.totalMonthlyDepreciation, data.totalMonthlyAmortization]);

  const firstMonthDep = operationStartIdx >= 0 ? (data.totalMonthlyDepreciation[operationStartIdx] || 0) : 0;
  const firstMonthAmort = operationStartIdx >= 0 ? (data.totalMonthlyAmortization[operationStartIdx] || 0) : 0;

  const methodName = store.parameters.depreciationMethod === 'straight-line'
    ? 'Línea Recta'
    : 'Saldo Decreciente';

  // ── Export data: Activos Fijos ──
  const activosExport = useMemo(() => {
    const headers = ['Nombre', 'Categoría', 'Costo Total', 'Vida Útil', 'Valor Residual', 'Método', 'Inicio', 'Dep. Mensual'];
    const rows: TableExportRow[] = data.assets.length === 0
      ? [{ cells: ['No hay activos depreciables definidos'], isSectionHeader: true }]
      : [
          ...data.assets.map(asset => ({
            cells: [asset.name, asset.category, formatNum(asset.totalCost), `${asset.usefulLifeYears} años`, formatPercent(asset.residualPercent), asset.method === 'straight-line' ? 'Línea Recta' : 'Saldo Decreciente', getMonthLabel(asset.startMonth - 1, store.project.startDate), formatNum(asset.monthlyDepreciationByMonth[asset.startMonth - 1] || 0)],
          })),
          { cells: [`TOTAL (${data.assets.length} activo${data.assets.length !== 1 ? 's' : ''})`, '', formatNum(data.totalAssetCost), '', '', '', '', formatNum(avgMonthlyDepreciation)], bold: true, highlight: true },
        ];
    return { headers, rows };
  }, [data.assets, data.totalAssetCost, avgMonthlyDepreciation, store.project.startDate]);

  // ── Export data: Intangibles ──
  const intangiblesExport = useMemo(() => {
    const headers = ['Nombre', 'Categoría', 'Costo Total', 'Vida Útil', 'Inicio', 'Amort. Mensual'];
    const rows: TableExportRow[] = data.intangibleAssets.length === 0
      ? [{ cells: ['No hay activos intangibles definidos'], isSectionHeader: true }]
      : [
          ...data.intangibleAssets.map(asset => ({
            cells: [asset.name, asset.category, formatNum(asset.totalCost), `${asset.usefulLifeYears} años`, getMonthLabel(asset.startMonth - 1, store.project.startDate), formatNum(asset.monthlyAmortizationByMonth[asset.startMonth - 1] || 0)],
          })),
          { cells: [`TOTAL (${data.intangibleAssets.length} intangible${data.intangibleAssets.length !== 1 ? 's' : ''})`, '', formatNum(data.totalIntangibleCost), '', '', formatNum(avgMonthlyAmortization)], bold: true, highlight: true },
        ];
    return { headers, rows };
  }, [data.intangibleAssets, data.totalIntangibleCost, avgMonthlyAmortization, store.project.startDate]);

  // ── Export data: Dep. Anual ──
  const anualExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...yearlySummary.map(r => `Año ${r.year}`), 'Total'];
    const rows: TableExportRow[] = [
      { cells: ['1', 'Depreciación', ...yearlySummary.map(r => formatNum(r.depreciation)), formatNum(yearlySummary.reduce((s, r) => s + r.depreciation, 0))] },
      { cells: ['2', 'Amortización', ...yearlySummary.map(r => formatNum(r.amortization)), formatNum(yearlySummary.reduce((s, r) => s + r.amortization, 0))] },
      { cells: ['3', 'Total Anual', ...yearlySummary.map(r => formatNum(r.total)), formatNum(yearlySummary.reduce((s, r) => s + r.total, 0))], bold: true, highlight: true },
      { cells: ['4', 'Acumulado', ...yearlySummary.map(r => formatNum(r.accumulated)), formatNum(yearlySummary[yearlySummary.length - 1]?.accumulated ?? 0)] },
      { cells: ['5', 'Valor en Libros', ...yearlySummary.map(r => { const totalCost = data.totalAssetCost + data.totalIntangibleCost; const pct = totalCost > 0 ? (r.accumulated / totalCost) * 100 : 0; return `${formatNum(r.bookValue)} (${pct.toFixed(1)}%)`; }), (() => { const lastRow = yearlySummary[yearlySummary.length - 1]; if (!lastRow) return ''; const totalCost = data.totalAssetCost + data.totalIntangibleCost; const pct = totalCost > 0 ? (lastRow.accumulated / totalCost) * 100 : 0; return `${formatNum(lastRow.bookValue)} (${pct.toFixed(1)}%)`; })()], bold: true, highlight: true },
    ];
    return { headers, rows };
  }, [yearlySummary, data.totalAssetCost, data.totalIntangibleCost]);

  // ── Export data: Mensual ──
  const mensualExport = useMemo(() => {
    const headers = ['#', 'Mes', 'Depreciación', 'Amortización', 'Total', 'Acumulado'];
    let acc = 0;
    const monthlyRows: { m: number; dep: number; amort: number; total: number; accumulated: number }[] = [];
    for (let i = 0; i < duration; i++) {
      const dep = data.totalMonthlyDepreciation[i] || 0;
      const amort = data.totalMonthlyAmortization[i] || 0;
      const total = dep + amort;
      acc += total;
      monthlyRows.push({ m: i + 1, dep, amort, total, accumulated: acc });
    }
    const rows: TableExportRow[] = [
      ...monthlyRows.map(row => ({
        cells: [String(row.m), getMonthLabel(row.m - 1, store.project.startDate), row.dep > 0 ? formatNum(row.dep) : '—', row.amort > 0 ? formatNum(row.amort) : '—', row.total > 0 ? formatNum(row.total) : '—', row.accumulated > 0 ? formatNum(row.accumulated) : '—'],
      })),
      { cells: ['', 'Total', formatNum(data.totalMonthlyDepreciation.reduce((s, v) => s + v, 0)), formatNum(data.totalMonthlyAmortization.reduce((s, v) => s + v, 0)), formatNum(data.totalMonthlyDepreciation.reduce((s, v) => s + v, 0) + data.totalMonthlyAmortization.reduce((s, v) => s + v, 0)), ''], bold: true, highlight: true },
    ];
    return { headers, rows };
  }, [duration, data.totalMonthlyDepreciation, data.totalMonthlyAmortization, store.project.startDate]);

  // ── Export data: Valor en Libros ──
  const valorLibroExport = useMemo(() => {
    const headers = ['Activo', 'Costo Original', 'Depreciación', 'Dep. Acumulada', 'Valor en Libros'];
    const rows: TableExportRow[] = bookValueRows.map(row => ({
      cells: [row.isTotal ? `Año ${row.year}` : row.assetName, formatNum(row.cost), formatNum(row.dep), formatNum(row.acc), formatNum(row.book)],
      bold: row.isTotal,
      highlight: row.isTotal,
    }));
    return { headers, rows };
  }, [bookValueRows]);

  // ── Export data: Gastos Previos Cronograma ──
  const gpCronogramaExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...gpAmort.yearlySchedule.map(r => `Año ${r.year}`), 'Total'];
    const rows: TableExportRow[] = [
      { cells: ['1', 'Cuota Anual', ...gpAmort.yearlySchedule.map(r => formatNum(r.annualAmount)), formatNum(gpAmort.yearlySchedule.reduce((s, r) => s + r.annualAmount, 0))] },
      { cells: ['2', 'Meses Activos', ...gpAmort.yearlySchedule.map(r => String(r.activeMonths)), String(gpAmort.yearlySchedule.reduce((s, r) => s + r.activeMonths, 0))] },
      { cells: ['3', 'Cuota Mensual', ...gpAmort.yearlySchedule.map(r => formatNum(r.monthlyRate)), '—'] },
      { cells: ['4', 'Período (Meses)', ...gpAmort.yearlySchedule.map(r => `${r.startMonthAbs}–${r.endMonthAbs}`), gpAmort.yearlySchedule.length > 0 ? `${gpAmort.yearlySchedule[0].startMonthAbs}–${gpAmort.yearlySchedule[gpAmort.yearlySchedule.length - 1].endMonthAbs}` : '—'] },
      ...(() => {
        let a = 0;
        return [{ cells: ['5', 'Amort. Acumulada', ...gpAmort.yearlySchedule.map(r => { a += r.annualAmount; return formatNum(a); }), formatNum(gpAmort.totalAmortized)], bold: true, highlight: true }];
      })(),
    ];
    return { headers, rows };
  }, [gpAmort]);

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Depreciación y Amortización"
        description={`Cálculo de depreciación de activos fijos y amortización de intangibles por el método ${methodName}`}
        icon={Building2}
        variant="info"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card shadow-card-sm rounded-xl p-4 flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Total Activos Fijos'}</p>
              <p className="text-fin-xl font-bold">{formatNum(data.totalAssetCost)} CUP</p>
              <p className="text-fin-xs text-muted-foreground">{data.assets.length} {'activo(s)'}</p>
            </div>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl p-4 flex items-center gap-3">
            <div className="rounded-md bg-warning-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <TrendingDown className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Depreciación Mensual'}</p>
              <p className="text-fin-xl font-bold text-warning">
                {formatNum(firstMonthDep)} CUP
              </p>
              <p className="text-fin-xs text-muted-foreground">{'prom:'} {formatNum(avgMonthlyDepreciation)}</p>
            </div>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl p-4 flex items-center gap-3">
            <div className="rounded-md bg-panel-b-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-panel-b" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Amortización Mensual'}</p>
              <p className="text-fin-xl font-bold text-panel-b">
                {formatNum(firstMonthAmort)} CUP
              </p>
              <p className="text-fin-xs text-muted-foreground">{data.intangibleAssets.length} {'intangible(s)'}</p>
            </div>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl p-4 flex items-center gap-3">
            <div className="rounded-md bg-success/10 p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Total Intangibles'}</p>
              <p className="text-fin-xl font-bold text-success">
                {formatNum(data.totalIntangibleCost)} CUP
              </p>
              <p className="text-fin-xs text-muted-foreground">{maxYears} {'años máx. vida útil'}</p>
            </div>
          </div>
      </div>

      <Tabs defaultValue="activos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="activos" className="focus-ring transition-all duration-200">{'Activos Fijos'}</TabsTrigger>
          <TabsTrigger value="intangibles" className="focus-ring transition-all duration-200">{'Intangibles'}</TabsTrigger>
          <TabsTrigger value="anual" className="focus-ring transition-all duration-200">{'Dep. Anual'}</TabsTrigger>
          <TabsTrigger value="mensual" className="focus-ring transition-all duration-200">{'Mensual'}</TabsTrigger>
          <TabsTrigger value="valor-libro" className="focus-ring transition-all duration-200">{'Valor en Libros'}</TabsTrigger>
          <TabsTrigger value="gastos-previos" className="focus-ring transition-all duration-200">Gastos Previos</TabsTrigger>
        </TabsList>

        <TabsContent value="activos">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm font-semibold">{'Activos Fijos'}</CardTitle>
              <TableExportButton
                moduleName="Depreciación y Amortización"
                tableName="Activos Fijos"
                headers={activosExport.headers}
                rows={activosExport.rows}
              />
            </div>
          </CardHeader><CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-fin-xs fin-col-header min-w-[160px]">{'Nombre'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Categoría'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-right min-w-[100px]">{'Costo Total'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[80px]">{'Vida Útil'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[80px]">{'Valor Residual'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[100px]">{'Método'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[60px]">{'Inicio'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-right min-w-[100px]">{'Dep. Mensual'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-fin-sm text-muted-foreground py-8">
                          {'No hay activos depreciables definidos'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {data.assets.map((asset) => (
                          <TableRow key={asset.id} className="fin-row-hover">
                            <TableCell className="text-fin-sm font-medium">{asset.name}</TableCell>
                            <TableCell className="text-fin-sm text-muted-foreground">
                              <Badge variant="outline" className="text-fin-xs px-1.5 py-0 font-normal">
                                {asset.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-fin-sm text-right font-medium">
                              {formatNum(asset.totalCost)}
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              {asset.usefulLifeYears} {'años'}
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              {formatPercent(asset.residualPercent)}
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              <Badge
                                variant="secondary"
                                className="text-fin-xs px-1.5 py-0 font-normal"
                              >
                                {asset.method === 'straight-line'
                                  ? 'Línea Recta'
                                  : 'Saldo Decreciente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              {getMonthLabel(asset.startMonth - 1, store.project.startDate)}
                            </TableCell>
                            <TableCell className="text-fin-sm text-right font-semibold text-warning">
                              {formatNum(asset.monthlyDepreciationByMonth[asset.startMonth - 1] || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="fin-table-total">
                          <TableCell colSpan={2} className="text-fin-sm">
                            {`TOTAL (${data.assets.length} activo${data.assets.length !== 1 ? 's' : '' }})`}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right">
                            {formatNum(data.totalAssetCost)}
                          </TableCell>
                          <TableCell colSpan={4} />
                          <TableCell className="text-fin-sm text-right text-warning">
                            {formatNum(avgMonthlyDepreciation)}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intangibles">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm font-semibold">{'Intangibles'}</CardTitle>
              <TableExportButton
                moduleName="Depreciación y Amortización"
                tableName="Intangibles"
                headers={intangiblesExport.headers}
                rows={intangiblesExport.rows}
              />
            </div>
          </CardHeader><CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-fin-xs fin-col-header min-w-[160px]">{'Nombre'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Categoría'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-right min-w-[100px]">{'Costo Total'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[80px]">{'Vida Útil'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-center min-w-[60px]">{'Inicio'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header text-right min-w-[100px]">{'Amort. Mensual'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.intangibleAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-fin-sm text-muted-foreground py-8">
                          {'No hay activos intangibles definidos'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {data.intangibleAssets.map((asset) => (
                          <TableRow key={asset.id} className="fin-row-hover">
                            <TableCell className="text-fin-sm font-medium">{asset.name}</TableCell>
                            <TableCell className="text-fin-sm text-muted-foreground">
                              <Badge variant="outline" className="text-fin-xs px-1.5 py-0 font-normal">
                                {asset.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-fin-sm text-right font-medium">
                              {formatNum(asset.totalCost)}
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              {asset.usefulLifeYears} {'años'}
                            </TableCell>
                            <TableCell className="text-fin-sm text-center">
                              {getMonthLabel(asset.startMonth - 1, store.project.startDate)}
                            </TableCell>
                            <TableCell className="text-fin-sm text-right font-semibold text-panel-b">
                              {formatNum(asset.monthlyAmortizationByMonth[asset.startMonth - 1] || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="fin-table-total">
                          <TableCell colSpan={2} className="text-fin-sm">
                            {`TOTAL (${data.intangibleAssets.length} intangible${data.intangibleAssets.length !== 1 ? 's' : '' }})`}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right">
                            {formatNum(data.totalIntangibleCost)}
                          </TableCell>
                          <TableCell colSpan={2} />
                          <TableCell className="text-fin-sm text-right text-panel-b">
                            {formatNum(avgMonthlyAmortization)}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anual">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm font-semibold">{'Depreciación Anual'}</CardTitle>
              <TableExportButton
                moduleName="Depreciación y Amortización"
                tableName="Dep. Anual"
                headers={anualExport.headers}
                rows={anualExport.rows}
                landscape
              />
            </div>
          </CardHeader><CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-fin-xs fin-col-header min-w-[40px] text-center">#</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[170px]">{'Concepto'}</TableHead>
                      {yearlySummary.map((row) => (
                        <TableHead key={row.year} className="text-fin-xs fin-col-header-year text-right min-w-[110px]">
                          {`Año ${row.year }}`}
                        </TableHead>
                      ))}
                      <TableHead className="text-fin-sm text-right min-w-[120px] fin-col-header-total font-semibold">{'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Row 1: Depreciación */}
                    <TableRow>
                      <TableCell className="text-fin-sm text-center">1</TableCell>
                      <TableCell className="text-fin-sm font-medium">{'Depreciación'}</TableCell>
                      {yearlySummary.map((row) => (
                        <TableCell key={row.year} className="text-fin-sm text-right text-warning">
                          {formatNum(row.depreciation)}
                        </TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right font-semibold text-warning fin-total-col">
                        {formatNum(yearlySummary.reduce((s, r) => s + r.depreciation, 0))}
                      </TableCell>
                    </TableRow>
                    {/* Row 2: Amortización */}
                    <TableRow>
                      <TableCell className="text-fin-sm text-center">2</TableCell>
                      <TableCell className="text-fin-sm font-medium text-panel-b">{'Amortización'}</TableCell>
                      {yearlySummary.map((row) => (
                        <TableCell key={row.year} className="text-fin-sm text-right text-panel-b">
                          {formatNum(row.amortization)}
                        </TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right font-semibold text-panel-b fin-total-col">
                        {formatNum(yearlySummary.reduce((s, r) => s + r.amortization, 0))}
                      </TableCell>
                    </TableRow>
                    {/* Row 3: Total Anual (bold subtotal) */}
                    <TableRow className="fin-table-total">
                      <TableCell className="text-fin-sm text-center">3</TableCell>
                      <TableCell className="text-fin-sm font-semibold">{'Total Anual'}</TableCell>
                      {yearlySummary.map((row) => (
                        <TableCell key={row.year} className="text-fin-sm text-right font-semibold">
                          {formatNum(row.total)}
                        </TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right font-semibold fin-total-col">
                        {formatNum(yearlySummary.reduce((s, r) => s + r.total, 0))}
                      </TableCell>
                    </TableRow>
                    {/* Row 4: Depreciación Acumulada */}
                    <TableRow>
                      <TableCell className="text-fin-sm text-center">4</TableCell>
                      <TableCell className="text-fin-sm font-medium">{'Acumulado'}</TableCell>
                      {yearlySummary.map((row) => (
                        <TableCell key={row.year} className="text-fin-sm text-right">
                          {formatNum(row.accumulated)}
                        </TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right fin-total-col">
                        {formatNum(yearlySummary[yearlySummary.length - 1]?.accumulated ?? 0)}
                      </TableCell>
                    </TableRow>
                    {/* Row 5: Valor en Libros (bold) */}
                    <TableRow className="fin-table-total">
                      <TableCell className="text-fin-sm text-center">5</TableCell>
                      <TableCell className="text-fin-sm font-bold">{'Valor en Libros'}</TableCell>
                      {yearlySummary.map((row) => {
                        const totalCost = data.totalAssetCost + data.totalIntangibleCost;
                        const pctDepreciated = totalCost > 0 ? (row.accumulated / totalCost) * 100 : 0;
                        return (
                          <TableCell key={row.year} className="text-fin-sm text-right font-bold">
                            {formatNum(row.bookValue)}
                            <Badge
                              variant={pctDepreciated >= 100 ? 'default' : 'outline'}
                              className="text-fin-xs px-1.5 py-0 font-normal ml-1"
                            >
                              {pctDepreciated.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-fin-sm text-right font-bold fin-total-col">
                        {formatNum(yearlySummary[yearlySummary.length - 1]?.bookValue ?? 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PESTAÑA: DESGLOSE MENSUAL ═══ */}
        <TabsContent value="mensual">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-warning" />
                {'Desglose Mensual de Depreciación y Amortización'}
              </CardTitle>
              <TableExportButton
                moduleName="Depreciación y Amortización"
                tableName="Mensual"
                headers={mensualExport.headers}
                rows={mensualExport.rows}
              />
            </div>
              <p className="text-fin-xs text-muted-foreground">
                {operationStartIdx >= 0
                  ? `La depreciación inicia en el mes ${operationStartIdx + 1} (${getMonthLabel(operationStartIdx, store.project.startDate)}) cuando el proyecto comienza a generar ingresos.`
                  : 'No se ha determinado el inicio de operación.'}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={3} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-fin-xs fin-col-header min-w-[40px] text-center">#</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[80px]">Mes</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Depreciación'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Amortización'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px] font-semibold">{'Total'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Acumulado'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let acc = 0;
                      const rows: { m: number; dep: number; amort: number; total: number; accumulated: number; isActive: boolean }[] = [];
                      for (let i = 0; i < duration; i++) {
                        const dep = data.totalMonthlyDepreciation[i] || 0;
                        const amort = data.totalMonthlyAmortization[i] || 0;
                        const total = dep + amort;
                        acc += total;
                        rows.push({ m: i + 1, dep, amort, total, accumulated: acc, isActive: total > 0 });
                      }
                      return rows.map((row) => {
                        const monthLabel = getMonthLabel(row.m - 1, store.project.startDate);
                        const isYearStart = (row.m - 1) % 12 === 0;
                        return (
                          <TableRow
                            key={row.m}
                            className={cn(
                              !row.isActive && 'opacity-40',
                              isYearStart && row.isActive && 'border-t border-muted',
                              row.m === operationStartIdx + 1 && 'bg-warning-muted/60'
                            )}
                          >
                            <TableCell className="text-fin-sm text-center text-muted-foreground">{row.m}</TableCell>
                            <TableCell className="text-fin-sm font-medium">{monthLabel}</TableCell>
                            <TableCell className="text-fin-sm text-right text-warning">{row.dep > 0 ? formatNum(row.dep) : '—'}</TableCell>
                            <TableCell className="text-fin-sm text-right text-panel-b">{row.amort > 0 ? formatNum(row.amort) : '—'}</TableCell>
                            <TableCell className="text-fin-sm text-right font-semibold">{row.total > 0 ? formatNum(row.total) : '—'}</TableCell>
                            <TableCell className="text-fin-sm text-right text-muted-foreground">{row.accumulated > 0 ? formatNum(row.accumulated) : '—'}</TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                    {/* Total final */}
                    <TableRow className="fin-table-total">
                      <TableCell className="text-fin-sm" />
                      <TableCell className="text-fin-sm font-bold">Total</TableCell>
                      <TableCell className="text-fin-sm text-right text-warning">
                        {formatNum(data.totalMonthlyDepreciation.reduce((s, v) => s + v, 0))}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right text-panel-b">
                        {formatNum(data.totalMonthlyAmortization.reduce((s, v) => s + v, 0))}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right font-bold">
                        {formatNum(data.totalMonthlyDepreciation.reduce((s, v) => s + v, 0) + data.totalMonthlyAmortization.reduce((s, v) => s + v, 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valor-libro">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-success" />
                {'Evolución del Valor en Libros por Activo'}
              </CardTitle>
              <TableExportButton
                moduleName="Depreciación y Amortización"
                tableName="Valor en Libros"
                headers={valorLibroExport.headers}
                rows={valorLibroExport.rows}
              />
            </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={2}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px]">{'Activo'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[100px] text-right">{'Costo Original'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[100px] text-right">{'Depreciación'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[120px] text-right">{'Dep. Acumulada'}</TableHead>
                      <TableHead className="text-fin-xs fin-col-header min-w-[100px] text-right">{'Valor en Libros'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookValueRows.map((row, idx) => (
                      <TableRow key={idx} className={row.isTotal ? 'fin-table-total' : 'fin-row-hover'}>
                        <TableCell className="text-fin-sm font-medium">{row.isTotal ? `Año ${row.year}` : row.assetName}</TableCell>
                        <TableCell className="text-fin-sm text-right">{formatNum(row.cost)}</TableCell>
                        <TableCell className={cn('text-fin-sm text-right', !row.isTotal && row.dep > 0 ? 'text-warning' : '')}>{formatNum(row.dep)}</TableCell>
                        <TableCell className="text-fin-sm text-right">{formatNum(row.acc)}</TableCell>
                        <TableCell className="text-fin-sm text-right font-semibold">{formatNum(row.book)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PESTAÑA: AMORTIZACIÓN DE GASTOS PREVIOS ═══ */}
        <TabsContent value="gastos-previos">
          <div className="space-y-4 animate-slide-up">
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-md bg-danger-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
                    <TrendingDown className="h-4 w-4 text-danger" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-fin-xs text-muted-foreground">Total Gastos Previos</p>
                    <p className="text-fin-xl font-bold text-danger">{formatNum(gpAmort.totalGastosPrevios)} CUP</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-md bg-success-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-fin-xs text-muted-foreground">Años de Amortización</p>
                    <p className="text-fin-xl font-bold text-success">{gpAmort.amortYears} {gpAmort.amortYears === 1 ? 'año' : 'años'} (máx. 5)</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-md bg-info-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-fin-xs text-muted-foreground">Inicio de Operación</p>
                    <p className="text-fin-xl font-bold">Mes {gpAmort.operationStartMonth}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-md bg-warning-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-fin-xs text-muted-foreground">Total Amortizado</p>
                    <p className="text-fin-xl font-bold text-warning">{formatNum(gpAmort.totalAmortized)} CUP</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Desglose por fuente */}
            <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><CardTitle className="text-fin-sm font-semibold">Composición de Gastos Previos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'D. Subcontrataciones', value: gpAmort.breakdown.subcontrataciones, color: 'text-info bg-info-muted' },
                    { label: 'E. RH Inversión', value: gpAmort.breakdown.recursosHumanosInv, color: 'text-panel-b bg-panel-b-muted' },
                    { label: 'Piezas y Herram.', value: gpAmort.breakdown.piezasHerramientas, color: 'text-warning bg-warning-muted' },
                    { label: 'Otros Recursos', value: gpAmort.breakdown.otrosRecursos, color: 'text-info bg-info-muted' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border p-2.5 text-center">
                      <p className="text-fin-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className={cn('text-fin-base font-bold', item.color.split(' ')[0])}>{formatNum(item.value)}</p>
                      {gpAmort.totalGastosPrevios > 0 && (
                        <p className="text-fin-xs text-muted-foreground">
                          {((item.value / gpAmort.totalGastosPrevios) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabla de cronograma de amortización */}
            <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
                  <CardTitle className="text-fin-sm font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-danger" />
                    Cronograma de Amortización
                  </CardTitle>
                  <TableExportButton
                    moduleName="Depreciación y Amortización"
                    tableName="Gastos Previos"
                    headers={gpCronogramaExport.headers}
                    rows={gpCronogramaExport.rows}
                    landscape
                  />
                </div>
                <p className="text-fin-xs text-muted-foreground">
                  Cuota anual = Total Gastos Previos ÷ {gpAmort.amortYears} años.
                  Los años parciales distribuyen la cuota equitativamente entre los meses activos.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollableTable maxHeight="350px" stickyColumns={1}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-fin-xs fin-col-header min-w-[40px] text-center">#</TableHead>
                        <TableHead className="text-fin-sm min-w-[170px]">Concepto</TableHead>
                        {gpAmort.yearlySchedule.map((row) => (
                          <TableHead key={row.year} className="text-fin-xs fin-col-header-year text-right min-w-[110px]">
                            <div className="flex flex-col items-end">
                              <span>Año {row.year}</span>
                              {row.isPartial && (
                                <Badge variant="outline" className="text-fin-xs px-1 py-0 text-warning border-warning">
                                  {row.activeMonths} meses
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-fin-sm text-right min-w-[120px] fin-col-header-total font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Cuota anual */}
                      <TableRow>
                        <TableCell className="text-fin-sm text-center">1</TableCell>
                        <TableCell className="text-fin-sm font-medium">Cuota Anual</TableCell>
                        {gpAmort.yearlySchedule.map((row) => (
                          <TableCell key={row.year} className="text-fin-sm text-right font-medium text-danger">
                            {formatNum(row.annualAmount)}
                          </TableCell>
                        ))}
                        <TableCell className="text-fin-sm text-right font-semibold text-danger fin-total-col">
                          {formatNum(gpAmort.yearlySchedule.reduce((s, r) => s + r.annualAmount, 0))}
                        </TableCell>
                      </TableRow>
                      {/* Meses activos */}
                      <TableRow>
                        <TableCell className="text-fin-sm text-center">2</TableCell>
                        <TableCell className="text-fin-sm font-medium">Meses Activos</TableCell>
                        {gpAmort.yearlySchedule.map((row) => (
                          <TableCell key={row.year} className="text-fin-sm text-right text-muted-foreground">
                            {row.activeMonths}
                          </TableCell>
                        ))}
                        <TableCell className="text-fin-sm text-right fin-total-col text-muted-foreground">
                          {gpAmort.yearlySchedule.reduce((s, r) => s + r.activeMonths, 0)}
                        </TableCell>
                      </TableRow>
                      {/* Cuota mensual */}
                      <TableRow>
                        <TableCell className="text-fin-sm text-center">3</TableCell>
                        <TableCell className="text-fin-sm font-medium">Cuota Mensual</TableCell>
                        {gpAmort.yearlySchedule.map((row) => (
                          <TableCell key={row.year} className="text-fin-sm text-right text-warning">
                            {formatNum(row.monthlyRate)}
                          </TableCell>
                        ))}
                        <TableCell className="text-fin-sm text-right fin-total-col text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                      {/* Período (mes inicio - mes fin) */}
                      <TableRow className="border-t-2 border-muted">
                        <TableCell className="text-fin-sm text-center">4</TableCell>
                        <TableCell className="text-fin-sm font-medium">Período (Meses)</TableCell>
                        {gpAmort.yearlySchedule.map((row) => (
                          <TableCell key={row.year} className="text-fin-sm text-right text-muted-foreground">
                            {row.startMonthAbs}–{row.endMonthAbs}
                          </TableCell>
                        ))}
                        <TableCell className="text-fin-sm text-right fin-total-col text-muted-foreground">
                          {gpAmort.yearlySchedule.length > 0
                            ? `${gpAmort.yearlySchedule[0].startMonthAbs}–${gpAmort.yearlySchedule[gpAmort.yearlySchedule.length - 1].endMonthAbs}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                      {/* Amortización acumulada */}
                      <TableRow className="font-semibold">
                        <TableCell className="text-fin-sm text-center">5</TableCell>
                        <TableCell className="text-fin-sm font-semibold">Amort. Acumulada</TableCell>
                        {(() => {
                          let acc = 0;
                          return gpAmort.yearlySchedule.map((row) => {
                            acc += row.annualAmount;
                            return (
                              <TableCell key={row.year} className="text-fin-sm text-right font-semibold text-success">
                                {formatNum(acc)}
                              </TableCell>
                            );
                          });
                        })()}
                        <TableCell className="text-fin-sm text-right font-bold text-success fin-total-col">
                          {formatNum(gpAmort.totalAmortized)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollableTable>
              </CardContent>
            </Card>



            {/* Nota aclaratoria */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-fin-xs text-muted-foreground space-y-1">
                <p><strong>Base normativa:</strong> Resolución Conjunta 1/2022 MINCEX-MEP, Art. V.h — Tabla Depreciación y Amortizaciones.</p>
                <p><strong>Regla:</strong> Los gastos previos a la explotación se amortizan en un plazo máximo de 5 años a partir de puesta en marcha. La cuota anual = Total Gastos Previos ÷ min(años de operación, 5). Si un año es parcial (ej. operación inicia en abril), la cuota se distribuye equitativamente entre los meses activos de ese año.</p>
                <p><strong>Fuentes:</strong> Módulo D (Subcontrataciones) + Módulo E (RH Inversión) + Piezas y Herramientas (no depreciables) + Otros Recursos y Gastos.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
