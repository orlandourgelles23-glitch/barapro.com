'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
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
import { buildWorkingCapital } from '@/lib/barapro-financial';
import { getMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { BarChart3, Wallet, Info } from 'lucide-react';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

export function WorkingCapitalView() {
  const store = useBaraproStore();
  const workingCapitalData = useMemo(() => buildWorkingCapital(store), [store]);
  const params = store.parameters;

  const duration = workingCapitalData.length;

  const monthGroups = useMemo(() => groupMonthsByYear(duration, store.project.startDate), [duration, store.project.startDate]);

  const yearlyData = useMemo(() => {
    const uniqueYears = [...new Set(workingCapitalData.map(r => r.year))];
    return uniqueYears.map(yearNum => {
      const firstMonthOfYear = workingCapitalData.find(r => r.year === yearNum);
      if (!firstMonthOfYear) return null;
      const monthCount = workingCapitalData.filter(r => r.year === yearNum).length || 12;
      return {
        yearNum,
        year: `Año ${yearNum}`,
        efectivo: firstMonthOfYear.efectivo * monthCount,
        cuentasPorCobrar: firstMonthOfYear.cuentasPorCobrar * monthCount,
        inventarios: firstMonthOfYear.inventarios * monthCount,
        inventariosNacionales: firstMonthOfYear.inventariosNacionales * monthCount,
        inventariosImportados: firstMonthOfYear.inventariosImportados * monthCount,
        productosEnProceso: firstMonthOfYear.productosEnProceso * monthCount,
        produccionTerminada: firstMonthOfYear.produccionTerminada * monthCount,
        piezasRepuesto: firstMonthOfYear.piezasRepuesto * monthCount,
        mercanciasVenta: firstMonthOfYear.mercanciasVenta * monthCount,
        otrosActivosCorrientes: firstMonthOfYear.otrosActivosCorrientes * monthCount,
        totalActivosCorrientes: firstMonthOfYear.totalActivosCorrientes * monthCount,
        totalPasivosCorrientes: firstMonthOfYear.totalPasivosCorrientes * monthCount,
        cuentaPorPagar: firstMonthOfYear.cuentaPorPagar * monthCount,
        anticipos: firstMonthOfYear.anticipos * monthCount,
        otrosPasivosCorrientes: firstMonthOfYear.otrosPasivosCorrientes * monthCount,
        capitalTrabajoBruto: firstMonthOfYear.capitalTrabajoBruto * monthCount,
        capitalTrabajoNeto: firstMonthOfYear.capitalTrabajoNeto * monthCount,
        variacion: firstMonthOfYear.variacion * monthCount,
      };
    }).filter(Boolean) as Array<{ [key: string]: string | number; yearNum: number; year: string }>;
  }, [workingCapitalData]);

  const totals = useMemo(() => {
    const len = workingCapitalData.length;
    if (len === 0) return { avgBruto: 0, avgNeto: 0, variacionTotal: 0, avgEfectivo: 0, avgCxC: 0, avgInv: 0, avgPEP: 0, avgPT: 0, avgPR: 0, avgPasivos: 0, avgMercancias: 0, initialWC: 0 };
    const avgBruto = workingCapitalData.reduce((s, r) => s + r.capitalTrabajoBruto, 0) / len;
    const avgNeto = workingCapitalData.reduce((s, r) => s + r.capitalTrabajoNeto, 0) / len;
    const variacionTotal = workingCapitalData.reduce((s, r) => s + r.variacion, 0);
    const avgEfectivo = workingCapitalData.reduce((s, r) => s + r.efectivo, 0) / len;
    const avgCxC = workingCapitalData.reduce((s, r) => s + r.cuentasPorCobrar, 0) / len;
    const avgInv = workingCapitalData.reduce((s, r) => s + r.inventarios, 0) / len;
    const avgPEP = workingCapitalData.reduce((s, r) => s + r.productosEnProceso, 0) / len;
    const avgPT = workingCapitalData.reduce((s, r) => s + r.produccionTerminada, 0) / len;
    const avgPR = workingCapitalData.reduce((s, r) => s + r.piezasRepuesto, 0) / len;
    const avgMercancias = workingCapitalData.reduce((s, r) => s + r.mercanciasVenta, 0) / len;
    const avgPasivos = workingCapitalData.reduce((s, r) => s + r.totalPasivosCorrientes, 0) / len;
    const initialWC = workingCapitalData[0].capitalTrabajoNeto;
    return { avgBruto, avgNeto, variacionTotal, avgEfectivo, avgCxC, avgInv, avgPEP, avgPT, avgPR, avgMercancias, avgPasivos, initialWC };
  }, [workingCapitalData]);

  // ─── Resolución 1/2022 concepts definition ───
  type ConceptDef = {
    key: string;
    label: string;
    bold?: boolean;
    textClass?: string;
    bgClass?: string;
  };

  const conceptDefs: ConceptDef[] = useMemo(() => [
    { key: 'efectivo', label: 'Efectivo en Caja' },
    { key: 'cuentasPorCobrar', label: 'Cuentas por Cobrar a Clientes' },
    { key: 'inventarios', label: 'Inventario de Materias Primas' },
    { key: 'inventariosNacionales', label: '    Inventarios Nacionales' },
    { key: 'inventariosImportados', label: '    Inventarios Importados' },
    { key: 'productosEnProceso', label: 'Productos en Proceso' },
    { key: 'produccionTerminada', label: 'Producción Terminada' },
    { key: 'piezasRepuesto', label: 'Piezas de Repuesto y Herramientas' },
    { key: 'mercanciasVenta', label: 'Inventario de Mercancías para la Venta' },
    { key: 'otrosActivosCorrientes', label: 'Otros Activos Corrientes' },
    { key: 'totalActivosCorrientes', label: 'TOTAL ACTIVOS CORRIENTES', bold: true, bgClass: 'fin-table-total' },
    { key: 'cuentaPorPagar', label: 'Cuentas por Pagar a Proveedores' },
    { key: 'anticipos', label: 'Anticipos Recibidos' },
    { key: 'otrosPasivosCorrientes', label: 'Otros Pasivos Corrientes' },
    { key: 'totalPasivosCorrientes', label: 'TOTAL PASIVOS CORRIENTES', bold: true, textClass: 'text-warning', bgClass: 'fin-table-total' },
    { key: 'capitalTrabajoNeto', label: 'CAPITAL DE TRABAJO NETO', bold: true, textClass: 'text-info', bgClass: 'fin-table-total' },
    { key: 'variacion', label: 'Variación del Capital de Trabajo' },
  ], []);

  // ─── Export data for annual table ───
  const annualExportData = useMemo(() => {
    const headers = ['#', 'Concepto', ...yearlyData.map(yr => yr.year as string), 'Total'];
    const rows: TableExportRow[] = conceptDefs.map((concept, idx) => {
      const rowTotal = yearlyData.reduce((sum, yr) => sum + Number(yr[concept.key] ?? 0), 0);
      return {
        cells: [
          String(idx + 1),
          concept.label,
          ...yearlyData.map(yr => formatNum(Number(yr[concept.key] ?? 0))),
          formatNum(rowTotal),
        ],
        bold: concept.bold || false,
        highlight: concept.bold || false,
      };
    });
    return { headers, rows };
  }, [yearlyData, conceptDefs]);

  // ─── Export data for monthly table ───
  const monthlyExportData = useMemo(() => {
    const headers = ['#', 'Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        headers.push(getMonthLabel(m.monthIndex, store.project.startDate));
      }
      headers.push(`Subt. ${group.year}`);
    }
    headers.push('Total');
    const rows: TableExportRow[] = conceptDefs.map((concept, idx) => {
      const monthlyValues = workingCapitalData.map(m => (m as unknown as Record<string, number>)[concept.key]);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups);
      const rowTotal = workingCapitalData.reduce((sum, m) => sum + (m as unknown as Record<string, number>)[concept.key], 0);
      return {
        cells: [
          String(idx + 1),
          concept.label,
          ...cells.map(cell => formatNum(cell.value)),
          formatNum(rowTotal),
        ],
        bold: concept.bold || false,
        highlight: concept.bold || false,
      };
    });
    return { headers, rows };
  }, [monthGroups, workingCapitalData, conceptDefs, store.project.startDate]);

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Capital de Trabajo"
        description="Desglose de activos y pasivos corrientes por metodología PDL"
        icon={Wallet}
        variant="info"
        badge="PDL"
      />

      <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-3"><div className="flex items-center gap-2 mb-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-fin-xs font-medium text-muted-foreground">{'Días de cobertura configurados'}</span>
            <span className="text-fin-xs text-muted-foreground ml-auto">
              {'Base de cálculo'}: {params.workingDaysPerMonth} {'días/mes'} / {params.workingDaysPerYear} {'días/año'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-fin-xs">
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Efectivo'}</p>
              <p className="font-bold">{params.wcCashCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Cuentas por Cobrar'}</p>
              <p className="font-bold">{params.wcReceivableCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Inventarios'}</p>
              <p className="font-bold">{params.wcInventoryCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Cuentas por Pagar'}</p>
              <p className="font-bold">{params.wcPayableDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Prod. en Proceso'}</p>
              <p className="font-bold">{params.wcWipCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Prod. Terminada'}</p>
              <p className="font-bold">{params.wcFinishedGoodsCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Piezas de Repuesto'}</p>
              <p className="font-bold">{params.wcSparePartsCoverageDays} días</p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2 text-center">
              <p className="text-muted-foreground truncate">{'Mercancías para la Venta'}</p>
              <p className="font-bold">{params.wcMercanciasVentaCoverageDays} días</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'CT Inicial (mes 1)'}</p><p className="text-fin-base font-bold text-success">{formatNum(totals.initialWC)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'CT Bruto Promedio'}</p><p className="text-fin-base font-bold text-success">{formatNum(totals.avgBruto)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'CT Neto Promedio'}</p><p className="text-fin-base font-bold text-info">{formatNum(totals.avgNeto)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Variación Total'}</p><p className={`text-fin-base font-bold ${totals.variacionTotal >= 0 ? 'text-success' : 'text-danger'}`}>{formatNum(totals.variacionTotal)} CUP</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Efectivo en Caja'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgEfectivo)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Cuentas por Cobrar a Clientes'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgCxC)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Inventario de Materias Primas'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgInv)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Productos en Proceso'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgPEP)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Producción Terminada'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgPT)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Piezas de Repuesto y Herramientas'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgPR)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Inv. Mercancías para la Venta'}</p><p className="text-fin-base font-bold">{formatNum(totals.avgMercancias)} CUP</p></CardContent></Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0 min-w-0"><CardContent className="p-3"><p className="text-fin-xs text-muted-foreground">{'Pasivos Corrientes'}</p><p className="text-fin-base font-bold text-warning">{formatNum(totals.avgPasivos)} CUP</p></CardContent></Card>
      </div>

      <Tabs defaultValue="annual">
        <TabsList>
          <TabsTrigger value="annual" className="focus-ring transition-all duration-200">{'Vista Anual'}</TabsTrigger>
          <TabsTrigger value="monthly" className="focus-ring transition-all duration-200">{'Vista Mensual'}</TabsTrigger>        </TabsList>

        {/* ─── ANNUAL TABLE (transposed: concepts as rows, years as columns) ─── */}
        <TabsContent value="annual">
          <Card className="glass-card shadow-card-sm rounded-xl border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {'Capital de Trabajo — Anual'}
                </CardTitle>
                <TableExportButton
                  moduleName="Capital de Trabajo"
                  tableName="Resumen Anual"
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
                      <TableHead className="w-[40px] text-center fin-col-header">#</TableHead>
                      <TableHead className="min-w-[280px] fin-col-header">{'Concepto'}</TableHead>
                      {yearlyData.map((yr) => (
                        <TableHead key={yr.yearNum} className="text-right fin-col-header-year min-w-[100px]">{yr.year}</TableHead>
                      ))}
                      <TableHead className="text-right fin-col-header-total min-w-[100px] font-bold">{'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conceptDefs.map((concept, idx) => {
                      const rowTotal = yearlyData.reduce((sum, yr) => sum + Number(yr[concept.key] ?? 0), 0);
                      const isVariacion = concept.key === 'variacion';
                      return (
                        <TableRow key={concept.key} className={cn("fin-row-hover", concept.bgClass || undefined)}>
                          <TableCell className={`text-fin-sm text-center ${concept.bold ? 'font-bold' : ''} ${concept.bgClass || ''}`}>
                            {idx + 1}
                          </TableCell>
                          <TableCell className={`text-fin-sm ${concept.bold ? 'font-bold' : ''} ${concept.textClass || ''} ${concept.bgClass || ''}`}>
                            {concept.label}
                          </TableCell>
                          {yearlyData.map((yr) => {
                            const val = Number(yr[concept.key] ?? 0);
                            return (
                              <TableCell
                                key={yr.yearNum}
                                className={`text-fin-sm text-right ${concept.bold ? 'font-bold' : ''} ${concept.textClass || ''} ${
                                  isVariacion ? (val >= 0 ? 'text-success' : 'text-danger') : ''
                                }`}
                              >
                                {formatNum(val)}
                              </TableCell>
                            );
                          })}
                          <TableCell className={`text-fin-sm text-right tabular-nums fin-total-col font-bold ${concept.textClass || ''} ${
                            isVariacion ? (rowTotal >= 0 ? 'text-success' : 'text-danger') : ''
                          }`}>
                            {formatNum(rowTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── MONTHLY TABLE (transposed: concepts as rows, months in columns) ─── */}
        <TabsContent value="monthly">
          <Card className="glass-card shadow-card-sm rounded-xl border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {'Capital de Trabajo — Mensual'}
                </CardTitle>
                <TableExportButton
                  moduleName="Capital de Trabajo"
                  tableName="Resumen Mensual"
                  headers={monthlyExportData.headers}
                  rows={monthlyExportData.rows}
                  landscape={monthlyExportData.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="450px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <YearMonthHeader groups={monthGroups} stickyColumns={2} totalColumnMinWidth="100px" monthColumnMinWidth="80px" showYearSubtotals />
                  </TableHeader>
                  <TableBody>
                    {conceptDefs.map((concept, idx) => {
                      const rowTotal = workingCapitalData.reduce((sum, m) => sum + (m as unknown as Record<string, number>)[concept.key], 0);
                      const isVariacion = concept.key === 'variacion';
                      return (
                        <TableRow key={concept.key} className={cn("fin-row-hover", concept.bgClass || undefined)}>
                          <TableCell className={`text-fin-sm text-center ${concept.bold ? 'font-bold' : ''} ${concept.bgClass || ''}`}>
                            {idx + 1}
                          </TableCell>
                          <TableCell className={`text-fin-sm ${concept.bold ? 'font-bold' : ''} ${concept.textClass || ''} ${concept.bgClass || ''}`}>
                            {concept.label}
                          </TableCell>
                          {(() => {
                            const monthlyValues = workingCapitalData.map(m => (m as unknown as Record<string, number>)[concept.key]);
                            const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups);
                            let gi = 0;
                            return cells.map((cell, ci) => {
                              if (cell.isSubtotal) {
                                const year = monthGroups[gi].year;
                                gi++;
                                return (
                                  <TableCell
                                    key={`sub-${year}`}
                                    className={`text-fin-sm text-right font-semibold bg-info-muted/60 ${concept.bold ? 'font-bold' : ''} ${concept.textClass || ''} ${
                                      isVariacion ? (cell.value >= 0 ? 'text-success' : 'text-danger') : ''
                                    }`}
                                  >
                                    {formatNum(cell.value)}
                                  </TableCell>
                                );
                              }
                              return (
                                <TableCell
                                  key={ci}
                                  className={`text-fin-sm text-right ${concept.bold ? 'font-bold' : ''} ${concept.textClass || ''} ${
                                    isVariacion ? (cell.value >= 0 ? 'text-success' : 'text-danger') : ''
                                  }`}
                                >
                                  {formatNum(cell.value)}
                                </TableCell>
                              );
                            });
                          })()}
                          <TableCell className={`text-fin-sm text-right tabular-nums fin-total-col font-bold ${concept.textClass || ''} ${
                            isVariacion ? (rowTotal >= 0 ? 'text-success' : 'text-danger') : ''
                          }`}>
                            {formatNum(rowTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
