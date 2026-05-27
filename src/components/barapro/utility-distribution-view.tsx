'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { L } from '@/lib/labels';
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
import { buildUtilityDistribution } from '@/lib/barapro-financial';
import { Wallet, Building2, Landmark, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}
/* ── Concept row definitions for Resolución-format tables ── */
interface ConceptRow {
  key: string;
  num: number;
  label: string;
  rowClass?: string;
  valueClass: string;
  isAccumulated?: boolean;
}

export function UtilityDistributionView() {
  const store = useBaraproStore();
  const distributionData = useMemo(() => buildUtilityDistribution(store), [store]);

  const duration = distributionData.length;

  const monthGroups = useMemo(() => groupMonthsByYear(duration, store.project.startDate), [duration, store.project.startDate]);

  const yearlyData = useMemo(() => {
    const years: Record<number, {
      utilidadNeta: number; utilidadesDisponibles: number; cam: number; retenida: number;
      proyecto: number; totalDistribuido: number; acumuladoCAM: number; acumuladoRetenida: number; acumuladoProyecto: number;
    }> = {};
    for (const row of distributionData) {
      const year = row.year;
      if (!years[year]) {
        years[year] = { utilidadNeta: 0, utilidadesDisponibles: 0, cam: 0, retenida: 0, proyecto: 0, totalDistribuido: 0, acumuladoCAM: 0, acumuladoRetenida: 0, acumuladoProyecto: 0 };
      }
      years[year].utilidadNeta += row.utilidadNeta;
      years[year].utilidadesDisponibles += row.utilidadesDisponibles;
      years[year].cam += row.cam;
      years[year].retenida += row.retenida;
      years[year].proyecto += row.proyecto;
      years[year].totalDistribuido += row.totalDistribuido;
    }
    let accCAM = 0; let accRetenida = 0; let accProyecto = 0;
    return Object.entries(years).map(([year, data]) => {
      accCAM += data.cam; accRetenida += data.retenida; accProyecto += data.proyecto;
      return { year: `Año ${year }}`, ...data, acumuladoCAM: accCAM, acumuladoRetenida: accRetenida, acumuladoProyecto: accProyecto };
    });
  }, [distributionData]);

  // Concept rows definition (Resolución format)
  const conceptRows = useMemo((): ConceptRow[] => [
    { key: 'utilidadNeta', num: 1, label: 'Util. Neta', valueClass: '' },
    { key: 'utilidadesDisponibles', num: 2, label: 'Util. Disponibles', valueClass: '' },
    { key: 'cam', num: 3, label: 'CAM', rowClass: 'font-bold', valueClass: 'text-warning' },
    { key: 'retenida', num: 4, label: 'Retenida', rowClass: 'font-bold', valueClass: 'text-info' },
    { key: 'proyecto', num: 5, label: 'Proyecto', rowClass: 'font-bold', valueClass: 'text-success' },
    { key: 'totalDistribuido', num: 6, label: 'Total Dist.', rowClass: 'font-bold', valueClass: 'font-bold' },
    { key: 'acumuladoCAM', num: 7, label: 'Acum. CAM', valueClass: 'text-warning', isAccumulated: true },
    { key: 'acumuladoRetenida', num: 8, label: 'Acum. Ret.', valueClass: 'text-info', isAccumulated: true },
    { key: 'acumuladoProyecto', num: 9, label: 'Acum. Proy.', valueClass: 'text-success', isAccumulated: true },
  ], []);

  // Annual column totals
  const annualColTotals = useMemo(() => {
    if (yearlyData.length === 0) return {} as Record<string, number>;
    const last = yearlyData[yearlyData.length - 1];
    return {
      utilidadNeta: yearlyData.reduce((s, r) => s + r.utilidadNeta, 0),
      utilidadesDisponibles: yearlyData.reduce((s, r) => s + r.utilidadesDisponibles, 0),
      cam: yearlyData.reduce((s, r) => s + r.cam, 0),
      retenida: yearlyData.reduce((s, r) => s + r.retenida, 0),
      proyecto: yearlyData.reduce((s, r) => s + r.proyecto, 0),
      totalDistribuido: yearlyData.reduce((s, r) => s + r.totalDistribuido, 0),
      acumuladoCAM: last.acumuladoCAM,
      acumuladoRetenida: last.acumuladoRetenida,
      acumuladoProyecto: last.acumuladoProyecto,
    };
  }, [yearlyData]);

  // Monthly column totals
  const monthlyColTotals = useMemo(() => {
    if (distributionData.length === 0) return {} as Record<string, number>;
    const last = distributionData[distributionData.length - 1];
    return {
      utilidadNeta: distributionData.reduce((s, r) => s + r.utilidadNeta, 0),
      utilidadesDisponibles: distributionData.reduce((s, r) => s + r.utilidadesDisponibles, 0),
      cam: distributionData.reduce((s, r) => s + r.cam, 0),
      retenida: distributionData.reduce((s, r) => s + r.retenida, 0),
      proyecto: distributionData.reduce((s, r) => s + r.proyecto, 0),
      totalDistribuido: distributionData.reduce((s, r) => s + r.totalDistribuido, 0),
      acumuladoCAM: last.acumuladoCAM,
      acumuladoRetenida: last.acumuladoRetenida,
      acumuladoProyecto: last.acumuladoProyecto,
    };
  }, [distributionData]);

  // Move rates BEFORE pieData and totals since they depend on it
  const rates = useMemo(() => ({
    cam: Math.round(store.parameters.dividendCAMRate || 0),
    retenida: Math.round(store.parameters.retainedEarningsRate || 0),
    proyecto: Math.round(store.parameters.projectAccountRate || 0),
  }), [store.parameters.dividendCAMRate, store.parameters.retainedEarningsRate, store.parameters.projectAccountRate]);  const totals = useMemo(() => ({
    totalUtilidadNeta: distributionData.reduce((s, r) => s + r.utilidadNeta, 0),
    totalCAM: distributionData.reduce((s, r) => s + r.cam, 0),
    totalRetenida: distributionData.reduce((s, r) => s + r.retenida, 0),
    totalProyecto: distributionData.reduce((s, r) => s + r.proyecto, 0),
  }), [distributionData]);

  const totalDistributed = totals.totalCAM + totals.totalRetenida + totals.totalProyecto;

  // ── Export data: Annual ──
  const annualExportData = useMemo(() => {
    const headers = ['#', 'Concepto', ...yearlyData.map((y) => y.year), 'Total'];
    const rows: TableExportRow[] = conceptRows.map((concept) => {
      const values = yearlyData.map((y) => (y as unknown as Record<string, number>)[concept.key] ?? 0);
      const total = annualColTotals[concept.key] ?? 0;
      return {
        cells: [String(concept.num), concept.label, ...values.map(v => formatNum(v)), formatNum(total)],
        bold: concept.rowClass === 'font-bold',
        highlight: concept.key === 'totalDistribuido',
      };
    });
    return { headers, rows };
  }, [yearlyData, conceptRows, annualColTotals]);

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

    const rows: TableExportRow[] = conceptRows.map((concept) => {
      const monthlyValues = distributionData.map(row => (row as unknown as Record<string, number>)[concept.key] ?? 0);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, {
        useLastValue: !!concept.isAccumulated,
      });
      const total = monthlyColTotals[concept.key] ?? 0;
      return {
        cells: [String(concept.num), concept.label, ...cells.map(cell => formatNum(cell.value)), formatNum(total)],
        bold: concept.rowClass === 'font-bold',
        highlight: concept.key === 'totalDistribuido',
      };
    });
    return { headers: monthHeaders, rows };
  }, [distributionData, monthGroups, conceptRows, monthlyColTotals]);

  // Helper: get cell value class for utilidadNeta (green/red based on sign)
  const getNetIncomeValueClass = (v: number) => v >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Distribución de Utilidades"
        description={`Distribución de utilidades según porcentajes: CAM ${rates.cam}%, Retenida ${rates.retenida}%, Proyecto ${rates.proyecto}%`}
        icon={Wallet}
        variant="success"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-success" /><p className="text-fin-xs text-muted-foreground">{'Total Utilidad Neta'}</p></div>
            <p className={`text-fin-xl font-bold ${totals.totalUtilidadNeta >= 0 ? 'text-success' : 'text-danger'}`}>{formatNum(totals.totalUtilidadNeta)} CUP</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-warning" /><p className="text-fin-xs text-muted-foreground">{'Total CAM'}</p></div><Badge variant="secondary" className="text-fin-xs">{rates.cam}%</Badge></div>
            <p className="text-fin-xl font-bold text-warning">{formatNum(totals.totalCAM)} CUP</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info">
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-info" /><p className="text-fin-xs text-muted-foreground">{'Total Retenida'}</p></div><Badge variant="secondary" className="text-fin-xs">{rates.retenida}%</Badge></div>
            <p className="text-fin-xl font-bold text-info">{formatNum(totals.totalRetenida)} CUP</p>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><Hammer className="h-3.5 w-3.5 text-success" /><p className="text-fin-xs text-muted-foreground">{'Total Proyecto'}</p></div><Badge variant="secondary" className="text-fin-xs">{rates.proyecto}%</Badge></div>
            <p className="text-fin-xl font-bold text-success">{formatNum(totals.totalProyecto)} CUP</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="annual">
        <TabsList>
          <TabsTrigger value="annual" className="focus-ring transition-all duration-200">{'Vista Anual'}</TabsTrigger>
          <TabsTrigger value="monthly" className="focus-ring transition-all duration-200">{'Vista Mensual'}</TabsTrigger>        </TabsList>

        {/* ── ANNUAL TABLE (transposed: concepts in rows, years in columns) ── */}
        <TabsContent value="annual">
          <Card className="glass-card shadow-card-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Anual'}</CardTitle>
                <TableExportButton
                  moduleName="Distribución de Utilidades"
                  tableName="Vista Anual"
                  headers={annualExportData.headers}
                  rows={annualExportData.rows}
                  landscape={annualExportData.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="fin-col-header text-center w-10">#</TableHead>
                      <TableHead className="fin-col-header">{L('common.concept')}</TableHead>
                      {yearlyData.map((y, idx) => (
                        <TableHead key={idx} className="fin-col-header-year text-right min-w-[100px]">{y.year}</TableHead>
                      ))}
                      <TableHead className="fin-col-header-total text-right min-w-[110px] bg-info-muted">{'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conceptRows.map((concept) => (
                      <TableRow key={concept.key} className={cn(concept.rowClass, "fin-row-hover")}>
                        <TableCell className="text-fin-sm text-center">{concept.num}</TableCell>
                        <TableCell className="text-fin-sm">{concept.label}</TableCell>
                        {yearlyData.map((y, idx) => {
                          const val = (y as unknown as Record<string, number>)[concept.key] ?? 0;
                          const valueClass = concept.key === 'utilidadNeta'
                            ? getNetIncomeValueClass(val)
                            : concept.valueClass;
                          return (
                            <TableCell key={idx} className={`text-fin-sm text-right tabular-nums ${valueClass}`}>{formatNum(val)}</TableCell>
                          );
                        })}
                        <TableCell className={`text-fin-sm text-right tabular-nums fin-total-col ${concept.valueClass}`}>
                          {formatNum(annualColTotals[concept.key] ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MONTHLY TABLE (transposed: concepts in rows, months in columns) ── */}
        <TabsContent value="monthly">
          <Card className="glass-card shadow-card-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Mensual'}</CardTitle>
                <TableExportButton
                  moduleName="Distribución de Utilidades"
                  tableName="Vista Mensual"
                  headers={monthlyExportData.headers}
                  rows={monthlyExportData.rows}
                  landscape={monthlyExportData.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="500px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <YearMonthHeader groups={monthGroups} stickyColumns={2} totalColumnMinWidth="110px" monthColumnMinWidth="90px" showYearSubtotals />
                  </TableHeader>
                  <TableBody>
                    {conceptRows.map((concept) => (
                      <TableRow key={concept.key} className={cn(concept.rowClass, "fin-row-hover")}>
                        <TableCell className="text-fin-sm text-center">{concept.num}</TableCell>
                        <TableCell className="text-fin-sm">{concept.label}</TableCell>
                        {(() => {
                          const monthlyValues = distributionData.map(row => (row as unknown as Record<string, number>)[concept.key] ?? 0);
                          const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, {
                            useLastValue: !!concept.isAccumulated,
                          });
                          let gi = 0;
                          return cells.map((cell, ci) => {
                            const valueClass = concept.key === 'utilidadNeta'
                              ? getNetIncomeValueClass(cell.value)
                              : concept.valueClass;
                            if (cell.isSubtotal) {
                              const year = monthGroups[gi].year;
                              gi++;
                              return (
                                <TableCell key={`sub-${year}`} className={`text-fin-sm text-right tabular-nums font-semibold bg-info-muted/60 ${valueClass}`}>{formatNum(cell.value)}</TableCell>
                              );
                            }
                            return (
                              <TableCell key={ci} className={`text-fin-sm text-right tabular-nums ${valueClass}`}>{formatNum(cell.value)}</TableCell>
                            );
                          });
                        })()}
                        <TableCell className={`text-fin-sm text-right tabular-nums fin-total-col ${concept.valueClass}`}>
                          {formatNum(monthlyColTotals[concept.key] ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
