'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { L } from '@/lib/labels';
import { buildCurrentCosts, type CurrentCostRow } from '@/lib/barapro-financial';
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
import { ScrollableTable } from '@/components/barapro/scrollable-table';import { Package, Users, ShoppingBag, Building2, Wrench, Layers, Calculator, Zap } from 'lucide-react';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

/* ------------------------------------------------------------------ */
/*  Concept definition – matches Resolución 1/2022 row order          */
/* ------------------------------------------------------------------ */
const CONCEPT_KEYS = [
  'materiasPrimas',
  'serviciosPublicos',
  'salariosOperativos',
  'gastosComerciales',
  'gastosAdmin',
  'gastosMantenimiento',
  'gastosIndirectos',
  'totalCostosDirectos',
  'totalCostosIndirectos',
  'totalCostosCorrientes',
] as const;

type ConceptKey = (typeof CONCEPT_KEYS)[number];

interface ConceptDef {
  key: ConceptKey;
  /** Concept label */
  label: string;
  isSubtotal: boolean;
  isTotal: boolean;
  rowClassName: string;
}

function buildConcepts(): ConceptDef[] {
  return [
    { key: 'materiasPrimas',        label: 'Materias Primas',           isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'serviciosPublicos',      label: 'Servicios Públicos',        isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'salariosOperativos',     label: 'Salarios',                  isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'gastosComerciales',      label: 'Distribución y Ventas',     isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'gastosAdmin',            label: 'Gral. y Administración',    isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'gastosMantenimiento',    label: 'Mantenimiento',             isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'gastosIndirectos',       label: 'Indirectos',                isSubtotal: false, isTotal: false, rowClassName: '' },
    { key: 'totalCostosDirectos',    label: 'Directos',                  isSubtotal: true,  isTotal: false, rowClassName: 'fin-table-subtotal' },
    { key: 'totalCostosIndirectos',  label: 'Indirectos',                isSubtotal: true,  isTotal: false, rowClassName: 'fin-table-subtotal' },
    { key: 'totalCostosCorrientes',  label: 'Total Corrientes',          isSubtotal: false, isTotal: true,  rowClassName: 'fin-table-total' },
  ];
}

/* ------------------------------------------------------------------ */
/*  Shared table‐cell helpers                                         */
/* ------------------------------------------------------------------ */
function PeriodCell({ value, className }: { value: number; className?: string }) {
  return (
    <TableCell className={`text-fin-sm text-right tabular-nums ${className ?? ''}`}>
      {formatNum(value)}
    </TableCell>
  );
}

function TotalCell({ value }: { value: number }) {
  return (
    <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-info-muted">
      {formatNum(value)}
    </TableCell>
  );
}

/* ------------------------------------------------------------------ */
/*  Annual data – concepts × years                                    */
/* ------------------------------------------------------------------ */
interface AnnualTransposed {
  years: number[];
  /** yearNum → conceptKey → summed value */
  yearMap: Record<number, Record<ConceptKey, number>>;
}

function useAnnualTransposed(currentCostData: CurrentCostRow[]): AnnualTransposed {
  return useMemo(() => {
    const yearMap: Record<number, Record<ConceptKey, number>> = {};
    for (const row of currentCostData) {
      if (!yearMap[row.year]) {
        yearMap[row.year] = { materiasPrimas: 0, serviciosPublicos: 0, salariosOperativos: 0, gastosComerciales: 0, gastosAdmin: 0, gastosMantenimiento: 0, gastosIndirectos: 0, totalCostosDirectos: 0, totalCostosIndirectos: 0, totalCostosCorrientes: 0 };
      }
      const y = yearMap[row.year];
      for (const k of CONCEPT_KEYS) {
        y[k] += row[k];
      }
    }
    const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
    return { years, yearMap };
  }, [currentCostData]);
}

/* ------------------------------------------------------------------ */
/*  Monthly data – concepts × months                                  */
/* ------------------------------------------------------------------ */
interface MonthlyTransposed {
  months: { month: number; year: number }[];
  data: CurrentCostRow[];
}

function useMonthlyTransposed(currentCostData: CurrentCostRow[]): MonthlyTransposed {
  return useMemo(() => {
    const months = currentCostData.map(r => ({ month: r.month, year: r.year }));
    return { months, data: currentCostData };
  }, [currentCostData]);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function CurrentCostsView() {
  const store = useBaraproStore();
  const currentCostData = useMemo(() => buildCurrentCosts(store), [store]);
  const concepts = useMemo(() => buildConcepts(), []);

  const duration = store.project.monthsDuration || 120;
  const monthGroups = useMemo(() =>
    groupMonthsByYear(duration, store.project.startDate),
    [duration, store.project.startDate]
  );

  const annual = useAnnualTransposed(currentCostData);
  const monthly = useMonthlyTransposed(currentCostData);

  const totals = useMemo(() => ({
    materiasPrimas: currentCostData.reduce((s, r) => s + r.materiasPrimas, 0),
    serviciosPublicos: currentCostData.reduce((s, r) => s + r.serviciosPublicos, 0),
    salariosOperativos: currentCostData.reduce((s, r) => s + r.salariosOperativos, 0),
    gastosComerciales: currentCostData.reduce((s, r) => s + r.gastosComerciales, 0),
    gastosAdmin: currentCostData.reduce((s, r) => s + r.gastosAdmin, 0),
    gastosMantenimiento: currentCostData.reduce((s, r) => s + r.gastosMantenimiento, 0),
    gastosIndirectos: currentCostData.reduce((s, r) => s + r.gastosIndirectos, 0),
    totalCostosDirectos: currentCostData.reduce((s, r) => s + r.totalCostosDirectos, 0),
    totalCostosIndirectos: currentCostData.reduce((s, r) => s + r.totalCostosIndirectos, 0),
    totalCostosCorrientes: currentCostData.reduce((s, r) => s + r.totalCostosCorrientes, 0),
  }), [currentCostData]);

  const summaryCards = [
    { label: 'Materias Primas', value: totals.materiasPrimas, icon: Package, color: 'text-warning' },
    { label: 'Servicios Públicos', value: totals.serviciosPublicos, icon: Zap, color: 'text-info' },
    { label: 'Salarios Operativos', value: totals.salariosOperativos, icon: Users, color: 'text-info' },
    { label: 'Gastos de Distribución y Ventas', value: totals.gastosComerciales, icon: ShoppingBag, color: 'text-panel-b' },
    { label: 'Gastos Generales y de Administración', value: totals.gastosAdmin, icon: Building2, color: 'text-danger' },
    { label: 'Mantenimiento', value: totals.gastosMantenimiento, icon: Wrench, color: 'text-warning' },
    { label: 'Otros Gastos', value: totals.gastosIndirectos, icon: Layers, color: 'text-info' },
    { label: 'Total Corrientes', value: totals.totalCostosCorrientes, icon: Calculator, color: 'text-success' },
  ];

  // ── Export data: Annual ──
  const annualCostsExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...annual.years.map((yr) => `Año ${yr}`), 'Total'];
    const rows: TableExportRow[] = concepts.map((c, idx) => {
      const rowTotal = annual.years.reduce((s, yr) => s + annual.yearMap[yr][c.key], 0);
      return {
        cells: [String(idx + 1), c.label, ...annual.years.map((yr) => formatNum(annual.yearMap[yr][c.key])), formatNum(rowTotal)],
        bold: c.isSubtotal || c.isTotal,
        highlight: c.isTotal,
      };
    });
    return { headers, rows };
  }, [annual, concepts]);

  // ── Export data: Monthly ──
  const monthlyCostsExport = useMemo(() => {
    const monthHeaders: string[] = ['#', 'Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        monthHeaders.push(m.label);
      }
      monthHeaders.push(`Subt. ${group.year}`);
    }
    monthHeaders.push('Total');

    const rows: TableExportRow[] = concepts.map((c, idx) => {
      const monthlyValues = monthly.data.map(r => r[c.key] as number);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups);
      const rowTotal = monthly.data.reduce((s, r) => s + r[c.key], 0);
      return {
        cells: [String(idx + 1), c.label, ...cells.map(cell => formatNum(cell.value)), formatNum(rowTotal)],
        bold: c.isSubtotal || c.isTotal,
        highlight: c.isTotal,
      };
    });
    return { headers: monthHeaders, rows };
  }, [monthly, monthGroups, concepts]);

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-4 animate-slide-up">
      {/* ---------- Header card ---------- */}
      <Card className="glass-card rounded-xl shadow-card-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-fin-lg">{'Costos Corrientes'}</CardTitle>
              <p className="text-fin-sm text-muted-foreground mt-0.5">
                {'Desglose mensual y anual de costos operativos del proyecto'}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ---------- Empty state ---------- */}
      {currentCostData.length === 0 && (
        <Card className="glass-card rounded-xl shadow-card-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-fin-sm">{'No hay datos de costos operativos. Ingrese gastos en los módulos de operaciones.'}</p>
          </CardContent>
        </Card>
      )}

      {/* ---------- Summary cards ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="glass-card rounded-xl shadow-card-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg ${
                card.color === 'text-warning' ? 'bg-warning/10' :
                card.color === 'text-info' ? 'bg-info/10' :
                card.color === 'text-panel-b' ? 'bg-panel-b/10' :
                card.color === 'text-danger' ? 'bg-danger/10' :
                card.color === 'text-success' ? 'bg-success/10' :
                'bg-muted'
              }`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-fin-xs text-muted-foreground truncate">{card.label}</p>
                <p className={`text-fin-base font-bold ${card.color}`}>{formatNum(card.value)} CUP</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- Badges ---------- */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-fin-xs">
          {'Directos'}: {formatNum(totals.totalCostosDirectos)} CUP
        </Badge>
        <Badge variant="outline" className="text-fin-xs">
          {'Indirectos'}: {formatNum(totals.totalCostosIndirectos)} CUP
        </Badge>
        <Badge variant="secondary" className="text-fin-xs font-semibold">
          {'Total'}: {formatNum(totals.totalCostosCorrientes)} CUP
        </Badge>
      </div>

      {/* ---------- Tabs ---------- */}
      <Tabs defaultValue="annual">
        <TabsList>
          <TabsTrigger value="annual" className="focus-ring transition-all duration-200">{'Vista Anual'}</TabsTrigger>
          <TabsTrigger value="monthly" className="focus-ring transition-all duration-200">{'Vista Mensual'}</TabsTrigger>        </TabsList>

        {/* ============ ANNUAL TABLE (transposed) ============ */}
        <TabsContent value="annual">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Anual'}</CardTitle>
                <TableExportButton
                  moduleName="Costos Corrientes"
                  tableName="Vista Anual"
                  headers={annualCostsExport.headers}
                  rows={annualCostsExport.rows}
                  landscape={annualCostsExport.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center fin-col-header text-fin-xs">#</TableHead>
                      <TableHead className="min-w-[160px] fin-col-header text-fin-xs">{L('common.concept')}</TableHead>
                      {annual.years.map((yr) => (
                        <TableHead key={yr} className="text-right fin-col-header-year text-fin-xs">
                          {`Año ${yr }}`}
                        </TableHead>
                      ))}
                      <TableHead className="text-right font-bold bg-info-muted fin-col-header-total text-fin-xs">
                        {'Total'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concepts.map((c, idx) => {
                      const rowTotal = annual.years.reduce((s, yr) => s + annual.yearMap[yr][c.key], 0);
                      const isBold = c.isSubtotal || c.isTotal;
                      return (
                        <TableRow key={c.key} className={`${c.rowClassName} fin-row-hover`}>
                          <TableCell className="text-fin-sm text-center">{idx + 1}</TableCell>
                          <TableCell className={`text-fin-sm ${isBold ? 'font-bold' : 'font-medium'}`}>
                            {c.label}
                          </TableCell>
                          {annual.years.map((yr) => (
                            <PeriodCell
                              key={yr}
                              value={annual.yearMap[yr][c.key]}
                              className={c.rowClassName ? c.rowClassName : undefined}
                            />
                          ))}
                          <TotalCell value={rowTotal} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MONTHLY TABLE (transposed) ============ */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm">{'Vista Mensual'}</CardTitle>
                <TableExportButton
                  moduleName="Costos Corrientes"
                  tableName="Vista Mensual"
                  headers={monthlyCostsExport.headers}
                  rows={monthlyCostsExport.rows}
                  landscape={monthlyCostsExport.headers.length > 6}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <YearMonthHeader groups={monthGroups} stickyColumns={2} showYearSubtotals />
                  </TableHeader>
                  <TableBody>
                    {concepts.map((c, idx) => {
                      const rowTotal = monthly.data.reduce((s, r) => s + r[c.key], 0);
                      const isBold = c.isSubtotal || c.isTotal;
                      return (
                        <TableRow key={c.key} className={`${c.rowClassName} fin-row-hover`}>
                          <TableCell className="text-fin-sm text-center">{idx + 1}</TableCell>
                          <TableCell className={`text-fin-sm ${isBold ? 'font-bold' : 'font-medium'}`}>
                            {c.label}
                          </TableCell>
                          {(() => {
                            const monthlyValues = monthly.data.map(r => r[c.key] as number);
                            const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups);
                            let gi = 0;
                            return cells.map((cell, ci) => {
                              if (cell.isSubtotal) {
                                const year = monthGroups[gi].year;
                                gi++;
                                return (
                                  <PeriodCell
                                    key={`sub-${year}`}
                                    value={cell.value}
                                    className={c.rowClassName ? `${c.rowClassName} font-semibold bg-info-muted/60` : 'font-semibold bg-info-muted/60'}
                                  />
                                );
                              }
                              return (
                                <PeriodCell
                                  key={ci}
                                  value={cell.value}
                                  className={c.rowClassName ? c.rowClassName : undefined}
                                />
                              );
                            });
                          })()}
                          <TotalCell value={rowTotal} />
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
