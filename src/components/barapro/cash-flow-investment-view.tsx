'use client';
import { L } from '@/lib/labels';

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
import {
  buildCashFlowInvestment,
  buildCashFlowEquity,
  type CashFlowInvestmentRow,
  type CashFlowInvestmentIndicators,
  type CashFlowEquityRow,
} from '@/lib/barapro-financial';
import { formatCurrency, formatPercent } from '@/lib/format';
import { TrendingUp, Landmark, Calculator, DollarSign } from 'lucide-react';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import { cn } from '@/lib/utils';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

// ── Helpers ────────────────────────────────────────────────────────────────────

type AggFn = (rows: CashFlowInvestmentRow[]) => number;

function sumKey(key: keyof CashFlowInvestmentRow): AggFn {
  return (rows) => rows.reduce((s, r) => s + (r[key] as number), 0);
}

function lastKey(key: keyof CashFlowInvestmentRow): AggFn {
  return (rows) => (rows.length > 0 ? (rows[rows.length - 1][key] as number) : 0);
}

// ── Row definition for investment table ────────────────────────────────────────

interface InvRowDef {
  key: keyof CashFlowInvestmentRow | '__section_entradas' | '__section_salidas' | '__section_saldos';
  labelKey: string;
  indent?: number;
  isBold?: boolean;
  isSection?: boolean;
  isSubtotal?: boolean;
  isInfo?: boolean; // Row is informational (shown but not included in totalSalidas)
  colorClass?: string;
  aggFn: AggFn;
}

const INVESTMENT_ROWS: InvRowDef[] = [
  // ── ENTRADAS ──
  { key: '__section_entradas', labelKey: 'cashFlowInvestment.entradas', isSection: true, aggFn: () => 0 },
  { key: 'ventasNetas', labelKey: 'cashFlowInvestment.ventasNetas', indent: 1, colorClass: 'text-success', aggFn: sumKey('ventasNetas') },
  { key: 'otrosIngresos', labelKey: 'otrosIngresos', indent: 1, colorClass: 'text-success', aggFn: sumKey('otrosIngresos') },
  { key: 'totalEntradas', labelKey: 'cashFlowInvestment.totalEntradas', indent: 1, isBold: true, colorClass: 'text-success', aggFn: sumKey('totalEntradas') },

  // ── SALIDAS ──
  { key: '__section_salidas', labelKey: 'cashFlowInvestment.salidas', isSection: true, aggFn: () => 0 },
  { key: 'inversionTotal', labelKey: 'cashFlowInvestment.inversionTotal', indent: 1, colorClass: 'text-danger', aggFn: sumKey('inversionTotal') },
  { key: 'capitalFijo', labelKey: 'cashFlowInvestment.capitalFijo', indent: 2, colorClass: 'text-danger', aggFn: sumKey('capitalFijo') },
  { key: 'activosIntangibles', labelKey: 'cashFlowInvestment.activosIntangibles', indent: 3, isInfo: true, colorClass: 'text-muted-foreground', aggFn: sumKey('activosIntangibles') },
  { key: 'gastosPrevios', labelKey: 'cashFlowInvestment.gastosPrevios', indent: 2, colorClass: 'text-danger', aggFn: sumKey('gastosPrevios') },
  { key: 'capitalTrabajoInicial', labelKey: 'cashFlowInvestment.capitalTrabajoInicial', indent: 2, colorClass: 'text-danger', aggFn: sumKey('capitalTrabajoInicial') },
  // Valor actual de los activos existentes (incluido en salidas)
  { key: 'valorActualActivos', labelKey: 'cashFlowInvestment.valorActualActivos', indent: 1, colorClass: 'text-danger', aggFn: sumKey('valorActualActivos') },
  { key: 'valorActualCapitalFijo', labelKey: 'cashFlowInvestment.valorActualCapitalFijo', indent: 2, colorClass: 'text-muted-foreground', aggFn: sumKey('valorActualCapitalFijo') },
  { key: 'valorActualIntangibles', labelKey: 'cashFlowInvestment.valorActualIntangibles', indent: 2, colorClass: 'text-muted-foreground', aggFn: sumKey('valorActualIntangibles') },
  { key: 'valorActualGastosPrevios', labelKey: 'cashFlowInvestment.valorActualGastosPrevios', indent: 2, colorClass: 'text-muted-foreground', aggFn: sumKey('valorActualGastosPrevios') },
  { key: 'variacionCapitalTrabajo', labelKey: 'cashFlowInvestment.variacionCapitalTrabajo', indent: 1, colorClass: 'text-danger', aggFn: sumKey('variacionCapitalTrabajo') },
  { key: 'costosOperacion', labelKey: 'cashFlowInvestment.costosOperacion', indent: 1, colorClass: 'text-danger', aggFn: sumKey('costosOperacion') },
  { key: 'honorariosAdmin', labelKey: 'cashFlowInvestment.honorariosAdmin', indent: 1, colorClass: 'text-danger', aggFn: sumKey('honorariosAdmin') },
  { key: 'reservasEstimulacion', labelKey: 'cashFlowInvestment.reservasEstimulacion', indent: 1, colorClass: 'text-danger', aggFn: sumKey('reservasEstimulacion') },
  { key: 'impuestoUtilidades', labelKey: 'cashFlowInvestment.impuestoUtilidades', indent: 1, colorClass: 'text-danger', aggFn: sumKey('impuestoUtilidades') },
  { key: 'otrosImpuestosTasas', labelKey: 'cashFlowInvestment.otrosImpuestosTasas', indent: 1, colorClass: 'text-danger', aggFn: sumKey('otrosImpuestosTasas') },
  { key: 'totalSalidas', labelKey: 'cashFlowInvestment.totalSalidas', indent: 1, isBold: true, colorClass: 'text-danger', aggFn: sumKey('totalSalidas') },

  // ── SALDOS ──
  { key: '__section_saldos', labelKey: 'cashFlowPlanning.saldosTitle', isSection: true, aggFn: () => 0 },
  { key: 'saldoAnual', labelKey: 'cashFlowInvestment.saldoAnual', indent: 1, isBold: false, aggFn: sumKey('saldoAnual') },
  { key: 'saldoAcumulado', labelKey: 'cashFlowInvestment.saldoAcumulado', indent: 1, isBold: true, aggFn: lastKey('saldoAcumulado') },
  { key: 'flujoCajaActualizado', labelKey: 'cashFlowInvestment.flujoCajaActualizado', indent: 1, isBold: false, colorClass: 'text-info', aggFn: lastKey('flujoCajaActualizadoAcumulado') },
  { key: 'flujoCajaActualizadoAcumulado', labelKey: 'cashFlowInvestment.flujoCajaActualizadoAcumulado', indent: 1, isBold: true, colorClass: 'text-info', aggFn: lastKey('flujoCajaActualizadoAcumulado') },
];

// ── Equity row definitions ─────────────────────────────────────────────────────

interface EqRowDef {
  key: keyof CashFlowEquityRow | '__section_entradas' | '__section_salidas' | '__section_saldos';
  labelKey: string;
  indent?: number;
  isBold?: boolean;
  isSection?: boolean;
  isInfo?: boolean;
  colorClass?: string;
  aggFn: (rows: CashFlowEquityRow[]) => number;
}

function eqSumKey(key: keyof CashFlowEquityRow): (rows: CashFlowEquityRow[]) => number {
  return (rows) => rows.reduce((s, r) => s + (r[key] as number), 0);
}

function eqLastKey(key: keyof CashFlowEquityRow): (rows: CashFlowEquityRow[]) => number {
  return (rows) => (rows.length > 0 ? (rows[rows.length - 1][key] as number) : 0);
}

const EQUITY_ROWS: EqRowDef[] = [
  // ── ENTRADAS ──
  { key: '__section_entradas', labelKey: 'cashFlowInvestment.entradas', isSection: true, aggFn: () => 0 },
  { key: 'ventasNetas', labelKey: 'cashFlowInvestment.ventasNetas', indent: 1, colorClass: 'text-success', aggFn: eqSumKey('ventasNetas') },
  { key: 'otrosIngresos', labelKey: 'otrosIngresos', indent: 1, colorClass: 'text-success', aggFn: eqSumKey('otrosIngresos') },
  { key: 'totalEntradas', labelKey: 'cashFlowInvestment.totalEntradas', indent: 1, isBold: true, colorClass: 'text-success', aggFn: eqSumKey('totalEntradas') },
  // Préstamos recibidos (informativo: Capital Social + (-)Inv Total + Préstamos = 0)
  { key: 'financiamiento', labelKey: 'cashFlowInvestment.prestamosRecibidos', indent: 1, isInfo: true, colorClass: 'text-success', aggFn: eqSumKey('financiamiento') },

  // ── SALIDAS ──
  { key: '__section_salidas', labelKey: 'cashFlowInvestment.salidas', isSection: true, aggFn: () => 0 },
  // Capital Social e Inversión Total negativa (informativos: cancelan con Préstamos)
  { key: 'capitalSocial', labelKey: 'cashFlowInvestment.capitalSocial', indent: 1, isInfo: true, colorClass: 'text-info', aggFn: eqSumKey('capitalSocial') },
  { key: 'inversionTotalNegativa', labelKey: 'cashFlowInvestment.inversionTotalNegativa', indent: 1, isInfo: true, colorClass: 'text-info', aggFn: eqSumKey('inversionTotalNegativa') },
  // Servicios de la Deuda
  { key: 'totalServiciosDeuda', labelKey: 'cashFlowInvestment.serviciosDeuda', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('totalServiciosDeuda') },
  { key: 'interesesDeuda', labelKey: 'cashFlowInvestment.interesesDeuda', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('interesesDeuda') },
  { key: 'reembolsoPrincipal', labelKey: 'cashFlowInvestment.reembolsoPrincipal', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('reembolsoPrincipal') },
  { key: 'gastosBancarios', labelKey: 'cashFlowInvestment.gastosBancarios', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('gastosBancarios') },
  // Inversión Total (real, incluido en totalSalidas)
  { key: 'inversionTotal', labelKey: 'cashFlowInvestment.inversionTotal', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('inversionTotal') },
  { key: 'capitalFijo', labelKey: 'cashFlowInvestment.capitalFijo', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('capitalFijo') },
  { key: 'activosIntangibles', labelKey: 'cashFlowInvestment.activosIntangibles', indent: 3, isInfo: true, colorClass: 'text-muted-foreground', aggFn: eqSumKey('activosIntangibles') },
  { key: 'gastosPrevios', labelKey: 'cashFlowInvestment.gastosPrevios', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('gastosPrevios') },
  { key: 'capitalTrabajoInicial', labelKey: 'cashFlowInvestment.capitalTrabajoInicial', indent: 2, colorClass: 'text-danger', aggFn: eqSumKey('capitalTrabajoInicial') },
  // Valor actual de los activos existentes (informativo: NO incluido en totalSalidas del Capital Social per Resolución 1/2022)
  { key: 'valorActualActivos', labelKey: 'cashFlowInvestment.valorActualActivos', indent: 1, isInfo: true, colorClass: 'text-info', aggFn: eqSumKey('valorActualActivos') },
  { key: 'valorActualCapitalFijo', labelKey: 'cashFlowInvestment.valorActualCapitalFijo', indent: 2, isInfo: true, colorClass: 'text-muted-foreground', aggFn: eqSumKey('valorActualCapitalFijo') },
  { key: 'valorActualIntangibles', labelKey: 'cashFlowInvestment.valorActualIntangibles', indent: 2, isInfo: true, colorClass: 'text-muted-foreground', aggFn: eqSumKey('valorActualIntangibles') },
  { key: 'valorActualGastosPrevios', labelKey: 'cashFlowInvestment.valorActualGastosPrevios', indent: 2, isInfo: true, colorClass: 'text-muted-foreground', aggFn: eqSumKey('valorActualGastosPrevios') },
  { key: 'variacionCapitalTrabajo', labelKey: 'cashFlowInvestment.variacionCapitalTrabajo', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('variacionCapitalTrabajo') },
  { key: 'costosOperacion', labelKey: 'cashFlowInvestment.costosOperacion', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('costosOperacion') },
  { key: 'honorariosAdmin', labelKey: 'cashFlowInvestment.honorariosAdmin', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('honorariosAdmin') },
  { key: 'reservasEstimulacion', labelKey: 'cashFlowInvestment.reservasEstimulacion', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('reservasEstimulacion') },
  { key: 'impuestoUtilidades', labelKey: 'cashFlowInvestment.impuestoUtilidades', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('impuestoUtilidades') },
  { key: 'otrosImpuestosTasas', labelKey: 'cashFlowInvestment.otrosImpuestosTasas', indent: 1, colorClass: 'text-danger', aggFn: eqSumKey('otrosImpuestosTasas') },
  { key: 'totalSalidas', labelKey: 'cashFlowInvestment.totalSalidas', indent: 1, isBold: true, colorClass: 'text-danger', aggFn: eqSumKey('totalSalidas') },

  // ── SALDOS ──
  { key: '__section_saldos', labelKey: 'cashFlowPlanning.saldosTitle', isSection: true, aggFn: () => 0 },
  { key: 'saldoAnual', labelKey: 'cashFlowInvestment.saldoAnual', indent: 1, isBold: false, aggFn: eqSumKey('saldoAnual') },
  { key: 'saldoAcumulado', labelKey: 'cashFlowInvestment.saldoAcumulado', indent: 1, isBold: true, aggFn: eqLastKey('saldoAcumulado') },
  { key: 'flujoCajaActualizado', labelKey: 'cashFlowInvestment.flujoCajaActualizado', indent: 1, isBold: false, colorClass: 'text-info', aggFn: eqLastKey('flujoCajaActualizadoAcumulado') },
  { key: 'flujoCajaActualizadoAcumulado', labelKey: 'cashFlowInvestment.flujoCajaActualizadoAcumulado', indent: 1, isBold: true, colorClass: 'text-info', aggFn: eqLastKey('flujoCajaActualizadoAcumulado') },
];

// ── Indicators card ────────────────────────────────────────────────────────────

function IndicatorGrid({
  indicators,
  isEquity,
}: {
  indicators: CashFlowInvestmentIndicators | { van: number; tir: number | null; pr: number | null; pra: number | null; rvan: number };
  isEquity: boolean;
}) {
  const items = [
    { key: 'tasaActualizacion' as const, label: L('cashFlowInvestment.tasaActualizacion'), value: 'tasaActualizacion' in indicators ? formatPercent(indicators.tasaActualizacion) : undefined, color: 'text-muted-foreground' },
    { key: 'van' as const, label: 'VAN', value: formatCurrency(indicators.van), color: indicators.van >= 0 ? 'text-success' : 'text-danger' },
    { key: 'tir' as const, label: 'TIR', value: indicators.tir !== null ? formatPercent(indicators.tir) : '—', color: indicators.tir !== null && indicators.tir >= 0 ? 'text-success' : 'text-danger' },
    { key: 'pr' as const, label: 'PR', value: indicators.pr !== null ? indicators.pr.toFixed(1) : '—', color: 'text-info' },
    { key: 'pra' as const, label: 'PRA', value: indicators.pra !== null ? indicators.pra.toFixed(1) : '—', color: 'text-info' },
    { key: 'rvan' as const, label: 'RVAN', value: indicators.rvan.toFixed(2), color: indicators.rvan >= 1 ? 'text-success' : 'text-danger' },
  ];

  if (!isEquity && 'valorRemanenteUltimoAnio' in indicators) {
    (items as Array<{ key: string; label: string; value: string; color: string }>).push({
      key: 'valorRemanenteUltimoAnio',
      label: L('cashFlowInvestment.valorRemanenteUltimoAnio'),
      value: formatCurrency((indicators as CashFlowInvestmentIndicators).valorRemanenteUltimoAnio),
      color: 'text-warning',
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        item.value !== undefined && (
          <Card key={item.key} className="border-0 glass-card shadow-card-sm rounded-xl">
            <CardContent className="p-3">
              <p className="text-fin-xs text-muted-foreground uppercase tracking-wide truncate">{item.label}</p>
              <p className={cn('text-fin-base font-bold truncate', item.color)}>{item.value}</p>
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}

// ── Main View ───────────────────────────────────────────────────────────────────

export function CashFlowInvestmentView() {
  const store = useBaraproStore();
  const investmentResult = useMemo(() => buildCashFlowInvestment(store), [store]);
  const investmentData = investmentResult.monthly;
  const indicators = investmentResult.indicators;

  const equityResult = useMemo(() => buildCashFlowEquity(store), [store]);
  const equityData = equityResult.monthly;
  const equityIndicators = equityResult.indicators;

  // ── Aggregate to yearly ──

  const duration = store.project.monthsDuration || 120;
  const monthGroups = useMemo(() =>
    groupMonthsByYear(duration, store.project.startDate),
    [duration, store.project.startDate]
  );

  const investmentYearly = useMemo(() => {
    const yearMap = new Map<number, CashFlowInvestmentRow[]>();
    for (const row of investmentData) {
      if (!yearMap.has(row.year)) yearMap.set(row.year, []);
      yearMap.get(row.year)!.push(row);
    }
    const years = [...yearMap.keys()].sort((a, b) => a - b);
    return years.map((year) => {
      const rows = yearMap.get(year)!;
      const aggregated: Record<string, number> = { year };
      for (const row of rows) {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'number' && k !== 'month' && k !== 'year') {
            aggregated[k] = (aggregated[k] || 0) + v;
          }
        }
      }
      // For accumulated fields, use the last row value (not sum)
      const lastRow = rows[rows.length - 1];
      aggregated.saldoAcumulado = lastRow.saldoAcumulado;
      aggregated.flujoAcumulado = lastRow.flujoAcumulado;
      aggregated.flujoDescontadoAcum = lastRow.flujoDescontadoAcum;
      aggregated.flujoCajaActualizadoAcumulado = lastRow.flujoCajaActualizadoAcumulado;
      return aggregated as unknown as CashFlowInvestmentRow & { yearLabel: string };
    });
  }, [investmentData]);

  const equityYearly = useMemo(() => {
    const yearMap = new Map<number, CashFlowEquityRow[]>();
    for (const row of equityData) {
      if (!yearMap.has(row.year)) yearMap.set(row.year, []);
      yearMap.get(row.year)!.push(row);
    }
    const years = [...yearMap.keys()].sort((a, b) => a - b);
    return years.map((year) => {
      const rows = yearMap.get(year)!;
      const aggregated: Record<string, number> = { year };
      for (const row of rows) {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'number' && k !== 'month' && k !== 'year') {
            aggregated[k] = (aggregated[k] || 0) + v;
          }
        }
      }
      const lastRow = rows[rows.length - 1];
      aggregated.saldoAcumulado = lastRow.saldoAcumulado;
      aggregated.flujoCajaActualizadoAcumulado = lastRow.flujoCajaActualizadoAcumulado;
      return aggregated as unknown as CashFlowEquityRow & { yearLabel: string };
    });
  }, [equityData]);

  // ── Chart data ──  // KPI values
  const lastInvRow = investmentData.length > 0 ? investmentData[investmentData.length - 1] : null;

  // ─── Export data ───
  const invAnnualExportData = useMemo(() => {
    const headers = ['Concepto', ...investmentYearly.map(y => `Año ${y.year}`), 'Total'];
    const rows: TableExportRow[] = INVESTMENT_ROWS.map((rowDef) => {
      if (rowDef.isSection) {
        return { cells: [L(rowDef.labelKey), ...Array(headers.length - 1).fill('')], isSectionHeader: true, bold: true };
      }
      const total = rowDef.aggFn(investmentData);
      const values = investmentYearly.map(y => {
        const val = (y as unknown as Record<string, number>)[rowDef.key as string] ?? 0;
        return formatCurrency(val);
      });
      return {
        cells: [L(rowDef.labelKey), ...values, formatCurrency(total)],
        bold: rowDef.isBold,
        highlight: rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado' || rowDef.key === 'flujoCajaActualizadoAcumulado',
      };
    });
    return { headers, rows };
  }, [investmentYearly, investmentData]);

  const invMonthlyExportData = useMemo(() => {
    const headers = ['Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        headers.push(`${m.label} ${group.year}`);
      }
      headers.push(`Subt. ${group.year}`);
    }
    headers.push('Total');
    const rows: TableExportRow[] = INVESTMENT_ROWS.map((rowDef) => {
      if (rowDef.isSection) {
        return { cells: [L(rowDef.labelKey), ...Array(headers.length - 1).fill('')], isSectionHeader: true, bold: true };
      }
      const isSaldo = rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado';
      const total = isSaldo
        ? (investmentData.length > 0 ? (investmentData[investmentData.length - 1] as unknown as Record<string, number>)[rowDef.key as string] || 0 : 0)
        : investmentData.reduce((s, r) => s + ((r as unknown as Record<string, number>)[rowDef.key as string] || 0), 0);
      const monthlyValues = investmentData.map(r => (r as unknown as Record<string, number>)[rowDef.key as string] ?? 0);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, { useLastValue: rowDef.key === 'saldoAcumulado' });
      const fmtCells = cells.map(cell => formatCurrency(cell.value));
      return {
        cells: [L(rowDef.labelKey), ...fmtCells, formatCurrency(total)],
        bold: rowDef.isBold,
        highlight: isSaldo,
      };
    });
    return { headers, rows };
  }, [investmentData, monthGroups]);

  const eqAnnualExportData = useMemo(() => {
    const headers = ['Concepto', ...equityYearly.map(y => `Año ${y.year}`), 'Total'];
    const rows: TableExportRow[] = EQUITY_ROWS.map((rowDef) => {
      if (rowDef.isSection) {
        return { cells: [L(rowDef.labelKey), ...Array(headers.length - 1).fill('')], isSectionHeader: true, bold: true };
      }
      const total = rowDef.aggFn(equityData);
      const values = equityYearly.map(y => {
        const val = (y as unknown as Record<string, number>)[rowDef.key as string] ?? 0;
        return formatCurrency(val);
      });
      return {
        cells: [L(rowDef.labelKey), ...values, formatCurrency(total)],
        bold: rowDef.isBold,
        highlight: rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado' || rowDef.key === 'flujoCajaActualizado',
      };
    });
    return { headers, rows };
  }, [equityYearly, equityData]);

  const eqMonthlyExportData = useMemo(() => {
    const headers = ['Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        headers.push(`${m.label} ${group.year}`);
      }
      headers.push(`Subt. ${group.year}`);
    }
    headers.push('Total');
    const rows: TableExportRow[] = EQUITY_ROWS.map((rowDef) => {
      if (rowDef.isSection) {
        return { cells: [L(rowDef.labelKey), ...Array(headers.length - 1).fill('')], isSectionHeader: true, bold: true };
      }
      const isSaldo = rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado';
      const total = isSaldo
        ? (equityData.length > 0 ? (equityData[equityData.length - 1] as unknown as Record<string, number>)[rowDef.key as string] || 0 : 0)
        : equityData.reduce((s, r) => s + ((r as unknown as Record<string, number>)[rowDef.key as string] || 0), 0);
      const monthlyValues = equityData.map(r => (r as unknown as Record<string, number>)[rowDef.key as string] ?? 0);
      const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, { useLastValue: rowDef.key === 'saldoAcumulado' });
      const fmtCells = cells.map(cell => formatCurrency(cell.value));
      return {
        cells: [L(rowDef.labelKey), ...fmtCells, formatCurrency(total)],
        bold: rowDef.isBold,
        highlight: isSaldo,
      };
    });
    return { headers, rows };
  }, [equityData, monthGroups]);

  const renderMonthlyTable = (dataType: 'investment' | 'equity') => {
    const data = dataType === 'investment' ? investmentData : equityData;
    const rowDefs = dataType === 'investment' ? INVESTMENT_ROWS : EQUITY_ROWS;
    const aggFn = dataType === 'investment'
      ? (key: string) => data.reduce((s, r) => s + ((r as unknown as Record<string, number>)[key] || 0), 0)
      : (key: string) => data.reduce((s, r) => s + ((r as unknown as Record<string, number>)[key] || 0), 0);
    const lastVal = dataType === 'investment'
      ? (key: string) => data.length > 0 ? (data[data.length - 1] as unknown as Record<string, number>)[key] || 0 : 0
      : (key: string) => data.length > 0 ? (data[data.length - 1] as unknown as Record<string, number>)[key] || 0 : 0;

    return (
      <ScrollableTable maxHeight="600px" stickyColumns={1} firstColWidth={240}>
        <Table>
          <TableHeader>
            <YearMonthHeader groups={monthGroups} stickyColumns={1} totalColumnMinWidth="110px" monthColumnMinWidth="70px" showYearSubtotals />
          </TableHeader>
          <TableBody>
            {rowDefs.map((rowDef) => {
              if (rowDef.isSection) {
                return (
                  <TableRow key={rowDef.key} className="fin-section-header">
                    <TableCell colSpan={duration + 2} className="text-fin-sm font-bold py-2">
                      {L(rowDef.labelKey)}
                    </TableCell>
                  </TableRow>
                );
              }
              const isSaldo = rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado';
              const total = (rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado')
                ? lastVal(rowDef.key as string)
                : aggFn(rowDef.key as string);
              const isInfo = (rowDef as any).isInfo === true;

              return (
                <TableRow key={rowDef.key} className={cn(rowDef.isBold && 'fin-table-total', isInfo && 'opacity-70', 'fin-row-hover')}>
                  <TableCell className={cn(
                    'text-fin-sm whitespace-nowrap',
                    rowDef.isBold && 'font-bold',
                    isInfo && 'italic',
                    (rowDef as any).indent === 2 && 'pl-8',
                    (rowDef as any).indent === 1 && 'pl-4',
                    (rowDef as any).colorClass,
                  )}>
                    {L(rowDef.labelKey)}
                  </TableCell>
                  {(() => {
                    const monthlyValues = data.map(r => (r as unknown as Record<string, number>)[rowDef.key as string] ?? 0);
                    const cells = getMonthlyValuesWithSubtotals(monthlyValues, monthGroups, {
                      useLastValue: rowDef.key === 'saldoAcumulado',
                    });
                    let gi = 0;
                    return cells.map((cell, ci) => {
                      const colorCls = isSaldo
                        ? (cell.value >= 0 ? 'text-success' : 'text-danger')
                        : (rowDef as any).colorClass;
                      if (cell.isSubtotal) {
                        const year = monthGroups[gi].year;
                        gi++;
                        return (
                          <TableCell key={`sub-${year}`} className={cn(
                            'text-fin-sm text-right tabular-nums font-semibold bg-info-muted/60',
                            colorCls,
                            rowDef.isBold && 'font-bold',
                          )}>
                            {formatCurrency(cell.value)}
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={ci} className={cn(
                          'text-fin-sm text-right tabular-nums',
                          colorCls,
                          rowDef.isBold && 'font-bold',
                        )}>
                          {formatCurrency(cell.value)}
                        </TableCell>
                      );
                    });
                  })()}
                  <TableCell className={cn(
                    'text-fin-sm text-right fin-total-col tabular-nums font-semibold',
                    isSaldo
                      ? (total >= 0 ? 'text-success' : 'text-danger')
                      : (rowDef as any).colorClass,
                  )}>
                    {formatCurrency(total)}
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
      {/* Header */}
      <ModuleHeader
        title="Rendimiento de Inversión y Capital Social"
        description="Análisis de flujo de caja descontado y rendimiento del capital social invertido"
        icon={Landmark}
        variant="success"
        badge="Resolución 1/2022"
      />

      <Tabs defaultValue="investment">
        <TabsList className="flex-wrap">
          <TabsTrigger value="investment">{'Rendimiento Inversión'}</TabsTrigger>
          <TabsTrigger value="equity">{'Rendimiento Capital Social'}</TabsTrigger>
        </TabsList>

        {/* ── Investment tab ── */}
        <TabsContent value="investment" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <p className="text-fin-xs text-muted-foreground">{'Flujo Neto Total'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  (lastInvRow?.flujoAcumulado ?? 0) >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {formatCurrency(lastInvRow?.flujoAcumulado ?? 0)}
                </p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-info" />
                  <p className="text-fin-xs text-muted-foreground">{'VAN'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  indicators.van >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {formatCurrency(indicators.van)}
                </p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-panel-b p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-panel-b" />
                  <p className="text-fin-xs text-muted-foreground">{'TIR'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  indicators.tir !== null && indicators.tir >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {indicators.tir !== null ? formatPercent(indicators.tir) : '—'}
                </p>
            </div>
          </div>

          {/* Investment indicators grid */}
          <div className="glass-card shadow-card-sm rounded-xl">
            <div className="pb-2 p-4">
              <h3 className="text-fin-base font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {'Indicadores de Inversión'}
              </h3>
            </div>
            <div className="px-4 pb-4">
              <IndicatorGrid indicators={indicators} isEquity={false} />
            </div>
          </div>

          {/* Investment table with Annual/Monthly sub-tabs */}
          <Tabs defaultValue="annual-inv" className="space-y-2">
            <TabsList>
              <TabsTrigger value="annual-inv">{'Anual'}</TabsTrigger>
              <TabsTrigger value="monthly-inv">{'Mensual'}</TabsTrigger>
            </TabsList>
            <TabsContent value="annual-inv">
              <Card className="border-0 glass-card shadow-card-sm rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm">{'Flujo de Caja - Rendimiento de la Inversión'}</CardTitle>
                    <TableExportButton
                      moduleName="Rendimiento Inversión"
                      tableName="Anual"
                      headers={invAnnualExportData.headers}
                      rows={invAnnualExportData.rows}
                      landscape={invAnnualExportData.headers.length > 6}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollableTable maxHeight="600px" stickyColumns={1} firstColWidth={240}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[240px] fin-col-header text-fin-xs">
                            {'Concepto'}
                          </TableHead>
                          {investmentYearly.map((y) => (
                            <TableHead key={y.year} className="text-right min-w-[100px] fin-col-header-year text-fin-xs">
                              Año {y.year}
                            </TableHead>
                          ))}
                          <TableHead className="text-right min-w-[110px] font-bold fin-col-header-total text-fin-xs">
                            {'Total'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {INVESTMENT_ROWS.map((rowDef) => {
                          if (rowDef.isSection) {
                            return (
                              <TableRow key={rowDef.key} className="fin-section-header">
                                <TableCell colSpan={investmentYearly.length + 2} className="text-fin-sm font-bold py-2">
                                  {L(rowDef.labelKey)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          const total = rowDef.aggFn(investmentData);
                          const isSaldo = rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado' || rowDef.key === 'flujoCajaActualizadoAcumulado';
                          const isInfo = (rowDef as any).isInfo === true;
                          return (
                            <TableRow key={rowDef.key} className={cn(rowDef.isBold && 'fin-table-total', isInfo && 'opacity-70', 'fin-row-hover')}>
                              <TableCell className={cn(
                                'text-fin-sm whitespace-nowrap',
                                rowDef.isBold && 'font-bold',
                                isInfo && 'italic',
                                rowDef.indent === 2 && 'pl-8',
                                rowDef.indent === 1 && 'pl-4',
                                rowDef.colorClass,
                              )}>
                                {L(rowDef.labelKey)}
                              </TableCell>
                              {investmentYearly.map((y) => {
                                const val = (y as unknown as Record<string, number>)[rowDef.key as string] ?? 0;
                                const colorCls = isSaldo ? (val >= 0 ? 'text-success' : 'text-danger') : rowDef.colorClass;
                                return (
                                  <TableCell key={y.year} className={cn('text-fin-sm text-right tabular-nums', colorCls, rowDef.isBold && 'font-bold')}>
                                    {formatCurrency(val)}
                                  </TableCell>
                                );
                              })}
                              <TableCell className={cn('text-fin-sm text-right fin-total-col tabular-nums font-semibold', isSaldo ? (total >= 0 ? 'text-success' : 'text-danger') : rowDef.colorClass)}>
                                {formatCurrency(total)}
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
            <TabsContent value="monthly-inv">
              <Card className="border-0 glass-card shadow-card-sm rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm">{'Flujo de Caja - Rendimiento de la Inversión'} — Mensual</CardTitle>
                    <TableExportButton
                      moduleName="Rendimiento Inversión"
                      tableName="Mensual"
                      headers={invMonthlyExportData.headers}
                      rows={invMonthlyExportData.rows}
                      landscape={invMonthlyExportData.headers.length > 6}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {renderMonthlyTable('investment')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Equity tab ── */}
        <TabsContent value="equity" className="space-y-4">
          {/* Equity KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-warning" />
                  <p className="text-fin-xs text-muted-foreground">{'VAN'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  equityIndicators.van >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {formatCurrency(equityIndicators.van)}
                </p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-panel-b p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-panel-b" />
                  <p className="text-fin-xs text-muted-foreground">{'TIR'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  equityIndicators.tir !== null && equityIndicators.tir >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {equityIndicators.tir !== null ? formatPercent(equityIndicators.tir) : '—'}
                </p>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-info" />
                  <p className="text-fin-xs text-muted-foreground">{'RVAN'}</p>
                </div>
                <p className={cn(
                  'text-fin-xl font-bold',
                  equityIndicators.rvan >= 1 ? 'text-success' : 'text-danger',
                )}>
                  {equityIndicators.rvan.toFixed(2)}
                </p>
            </div>
          </div>

          {/* Equity indicators grid */}
          <div className="glass-card shadow-card-sm rounded-xl">
            <div className="pb-2 p-4">
              <h3 className="text-fin-base font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {'Indicadores del Capital Social'}
              </h3>
            </div>
            <div className="px-4 pb-4">
              <IndicatorGrid indicators={equityIndicators} isEquity={true} />
            </div>
          </div>

          {/* Equity table with Annual/Monthly sub-tabs */}
          <Tabs defaultValue="annual-eq" className="space-y-2">
            <TabsList>
              <TabsTrigger value="annual-eq">{'Anual'}</TabsTrigger>
              <TabsTrigger value="monthly-eq">{'Mensual'}</TabsTrigger>
            </TabsList>
            <TabsContent value="annual-eq">
              <Card className="border-0 glass-card shadow-card-sm rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm">{'Flujo de Caja - Rendimiento del Capital Social'}</CardTitle>
                    <TableExportButton
                      moduleName="Rendimiento Capital Social"
                      tableName="Anual"
                      headers={eqAnnualExportData.headers}
                      rows={eqAnnualExportData.rows}
                      landscape={eqAnnualExportData.headers.length > 6}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollableTable maxHeight="450px" stickyColumns={1} firstColWidth={240}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[240px] fin-col-header text-fin-xs">{'Concepto'}</TableHead>
                          {equityYearly.map((y) => (
                            <TableHead key={y.year} className="text-right min-w-[100px] fin-col-header-year text-fin-xs">Año {y.year}</TableHead>
                          ))}
                          <TableHead className="text-right min-w-[110px] font-bold fin-col-header-total text-fin-xs">{'Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {EQUITY_ROWS.map((rowDef) => {
                          if (rowDef.isSection) {
                            return (
                              <TableRow key={rowDef.key} className="fin-section-header">
                                <TableCell colSpan={equityYearly.length + 2} className="text-fin-sm font-bold py-2">{L(rowDef.labelKey)}</TableCell>
                              </TableRow>
                            );
                          }
                          const total = rowDef.aggFn(equityData);
                          const isSaldo = rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado' || rowDef.key === 'flujoCajaActualizado';
                          const isInfo = (rowDef as any).isInfo === true;
                          return (
                            <TableRow key={rowDef.key} className={cn(rowDef.isBold && 'fin-table-total', isInfo && 'opacity-70', 'fin-row-hover')}>
                              <TableCell className={cn('text-fin-sm whitespace-nowrap', rowDef.isBold && 'font-bold', isInfo && 'italic', rowDef.indent === 2 && 'pl-8', rowDef.indent === 1 && 'pl-4', rowDef.colorClass)}>
                                {L(rowDef.labelKey)}
                              </TableCell>
                              {equityYearly.map((y) => {
                                const val = (y as unknown as Record<string, number>)[rowDef.key as string] ?? 0;
                                const colorCls = isSaldo ? (val >= 0 ? 'text-success' : 'text-danger') : rowDef.colorClass;
                                return (
                                  <TableCell key={y.year} className={cn('text-fin-sm text-right tabular-nums', colorCls, rowDef.isBold && 'font-bold')}>
                                    {formatCurrency(val)}
                                  </TableCell>
                                );
                              })}
                              <TableCell className={cn('text-fin-sm text-right fin-total-col tabular-nums font-semibold', isSaldo ? (total >= 0 ? 'text-success' : 'text-danger') : rowDef.colorClass)}>
                                {formatCurrency(total)}
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
            <TabsContent value="monthly-eq">
              <Card className="border-0 glass-card shadow-card-sm rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm">{'Flujo de Caja - Rendimiento del Capital Social'} — Mensual</CardTitle>
                    <TableExportButton
                      moduleName="Rendimiento Capital Social"
                      tableName="Mensual"
                      headers={eqMonthlyExportData.headers}
                      rows={eqMonthlyExportData.rows}
                      landscape={eqMonthlyExportData.headers.length > 6}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {renderMonthlyTable('equity')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
