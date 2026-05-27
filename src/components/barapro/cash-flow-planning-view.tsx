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
import { buildCashFlowPlanning, type CashFlowPlanningRow } from '@/lib/barapro-financial';
import { formatCurrency } from '@/lib/format';
import { Wallet, TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle, Building2, Landmark, Factory } from 'lucide-react';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
import { cn } from '@/lib/utils';

// ── Row type definitions ─────────────────────────────────────────────────

type RowType = 'section-divider' | 'header' | 'subtotal' | 'detail' | 'total' | 'balance' | 'info';

interface RowDef {
  key: keyof CashFlowPlanningRow | '_section_inv' | '_section_fin' | '_section_op' | '_section_consolidated'
    | '_hdr_inv_entradas' | '_hdr_inv_salidas' | '_hdr_inv_saldos'
    | '_hdr_fin_entradas' | '_hdr_fin_salidas' | '_hdr_fin_saldos'
    | '_hdr_op_entradas' | '_hdr_op_salidas' | '_hdr_op_saldos';
  labelKey: string;
  type: RowType;
  indent?: number;
  sign?: '+' | '-';
}

// ── I. FLUJO DE CAJA EN INVERSIONES ──────────────────────────────────────

const INV_ROWS: RowDef[] = [
  { key: '_section_inv', labelKey: 'cashFlowPlanning.sectionInversiones', type: 'section-divider' },
  { key: '_hdr_inv_entradas', labelKey: 'cashFlowPlanning.entradasTitle', type: 'header' },
  { key: 'valorRemanente', labelKey: 'cashFlowPlanning.valorRemanente', type: 'detail', sign: '+' },
  { key: '_hdr_inv_salidas', labelKey: 'cashFlowPlanning.salidasTitle', type: 'header' },
  { key: 'inversionFija', labelKey: 'cashFlowPlanning.inversionFija', type: 'detail', indent: 1, sign: '-' },
  { key: 'activosIntangibles', labelKey: 'cashFlowPlanning.activosIntangibles', type: 'info', indent: 2, sign: '-' },
  { key: 'gastosPrevios', labelKey: 'cashFlowPlanning.gastosPrevios', type: 'detail', indent: 1, sign: '-' },
  { key: 'capitalFijo', labelKey: 'cashFlowPlanning.capitalFijo', type: 'subtotal' },
  { key: 'capitalTrabajoInicial', labelKey: 'cashFlowPlanning.capitalTrabajoInicial', type: 'detail', sign: '-' },
  { key: 'interesesCapitalizados', labelKey: 'cashFlowPlanning.interesesCapitalizados', type: 'info', sign: '-' },
  { key: '_hdr_inv_saldos', labelKey: 'cashFlowPlanning.saldosTitle', type: 'header' },
  { key: 'saldoInversiones', labelKey: 'cashFlowPlanning.saldoInversiones', type: 'balance' },
];

// ── II. FLUJO DE CAJA POR FINANCIAMIENTO ─────────────────────────────────
// Per Resolución 1/2022: Servicio de la Deuda = Intereses + Reembolso Principal (SIN gastos financieros)

const FIN_ROWS: RowDef[] = [
  { key: '_section_fin', labelKey: 'cashFlowPlanning.sectionFinanciamiento', type: 'section-divider' },
  { key: '_hdr_fin_entradas', labelKey: 'cashFlowPlanning.entradasTitle', type: 'header' },
  { key: 'capitalSocial', labelKey: 'cashFlowPlanning.capitalSocial', type: 'detail', indent: 1, sign: '+' },
  { key: 'financiamiento', labelKey: 'cashFlowPlanning.financiamiento', type: 'detail', indent: 1, sign: '+' },
  { key: 'recursosFinancieros', labelKey: 'cashFlowPlanning.recursosFinancieros', type: 'subtotal' },
  { key: '_hdr_fin_salidas', labelKey: 'cashFlowPlanning.salidasTitle', type: 'header' },
  { key: 'interesesDeuda', labelKey: 'cashFlowPlanning.interesesDeuda', type: 'detail', indent: 1, sign: '-' },
  { key: 'reembolsoPrincipal', labelKey: 'cashFlowPlanning.reembolsoPrincipal', type: 'detail', indent: 1, sign: '-' },
  { key: 'servicioDeuda', labelKey: 'cashFlowPlanning.servicioDeuda', type: 'subtotal' },
  { key: '_hdr_fin_saldos', labelKey: 'cashFlowPlanning.saldosTitle', type: 'header' },
  { key: 'saldoFinanciamiento', labelKey: 'cashFlowPlanning.saldoFinanciamiento', type: 'balance' },
];

// ── III. FLUJO DE CAJA EN OPERACIONES ───────────────────────────────────
// Per Resolución 1/2022: incluye Gastos Financieros, Variación CT,
// Honorarios Admin, Reservas de Estimulación, Capital de Trabajo Precedente

const OP_ROWS: RowDef[] = [
  { key: '_section_op', labelKey: 'cashFlowPlanning.sectionOperaciones', type: 'section-divider' },
  { key: '_hdr_op_entradas', labelKey: 'cashFlowPlanning.entradasTitle', type: 'header' },
  { key: 'ventasNetas', labelKey: 'cashFlowPlanning.ventasNetas', type: 'detail', sign: '+' },
  { key: 'otrosIngresos', labelKey: 'cashFlowPlanning.otrosIngresos', type: 'detail', sign: '+' },
  { key: 'capitalTrabajoPrecedente', labelKey: 'cashFlowPlanning.capitalTrabajoPrecedente', type: 'detail', sign: '+' },
  { key: 'totalEntradasOp', labelKey: 'cashFlowPlanning.totalEntradasOp', type: 'total' },
  { key: '_hdr_op_salidas', labelKey: 'cashFlowPlanning.salidasTitle', type: 'header' },
  { key: 'costosVariables', labelKey: 'cashFlowPlanning.costosVariables', type: 'detail', indent: 1, sign: '-' },
  { key: 'costosFijos', labelKey: 'cashFlowPlanning.costosFijos', type: 'detail', indent: 1, sign: '-' },
  { key: 'costosOperacion', labelKey: 'cashFlowPlanning.costosOperacion', type: 'subtotal' },
  { key: 'honorariosAdmin', labelKey: 'cashFlowPlanning.honorariosAdmin', type: 'detail', sign: '-' },
  { key: 'variacionCapitalTrabajo', labelKey: 'cashFlowPlanning.variacionCT', type: 'detail', sign: '-' },
  { key: 'gastosFinancieros', labelKey: 'cashFlowPlanning.gastosFinancieros', type: 'detail', sign: '-' },
  { key: 'impuestoUtilidades', labelKey: 'cashFlowPlanning.impuestoUtilidades', type: 'detail', sign: '-' },
  { key: 'otrosImpuestos', labelKey: 'cashFlowPlanning.otrosImpuestos', type: 'detail', sign: '-' },
  { key: 'reservasEstimulacion', labelKey: 'cashFlowPlanning.reservasEstimulacion', type: 'detail', sign: '-' },
  { key: 'totalSalidasOp', labelKey: 'cashFlowPlanning.totalSalidasOp', type: 'total' },
  { key: '_hdr_op_saldos', labelKey: 'cashFlowPlanning.saldosTitle', type: 'header' },
  { key: 'saldoOperaciones', labelKey: 'cashFlowPlanning.saldoOperaciones', type: 'balance' },
];

// ── CONSOLIDADO ──────────────────────────────────────────────────────────

const CONSOLIDATED_ROWS: RowDef[] = [
  { key: '_section_consolidated', labelKey: 'cashFlowPlanning.saldosConsolidados', type: 'section-divider' },
  { key: 'saldoAnual', labelKey: 'cashFlowPlanning.saldoAnual', type: 'balance' },
  { key: 'saldoAcumulado', labelKey: 'cashFlowPlanning.saldoAcumulado', type: 'balance' },
];

// ── All rows combined ────────────────────────────────────────────────────

const ALL_ROWS: RowDef[] = [
  ...INV_ROWS,
  ...FIN_ROWS,
  ...OP_ROWS,
  ...CONSOLIDATED_ROWS,
];

// ── Cell styling helper ──────────────────────────────────────────────────

function getCellStyle(type: RowType, value: number): string {
  switch (type) {
    case 'section-divider':
      return 'text-fin-xs font-bold uppercase tracking-wider text-foreground';
    case 'header':
      return 'text-fin-xs font-bold text-muted-foreground uppercase tracking-wider';
    case 'total':
      return 'font-bold text-foreground text-fin-sm';
    case 'subtotal':
      return 'text-fin-sm font-semibold text-muted-foreground italic';
    case 'balance':
      return cn(
        'text-fin-sm font-bold tabular-nums',
        value >= 0 ? 'text-success' : 'text-danger',
      );
    case 'info':
      return 'text-fin-sm text-muted-foreground italic';
    default:
      return 'text-fin-sm text-muted-foreground';
  }
}

function formatLabel(rowDef: RowDef): string {
  const label = L(rowDef.labelKey);
  if (rowDef.type === 'subtotal') return `= ${label}`;
  if (rowDef.type === 'detail' && rowDef.sign) return `  (${rowDef.sign}) ${label}`;
  if (rowDef.type === 'detail') return `  ${label}`;
  if (rowDef.type === 'info') return `  (${rowDef.sign}) ${label}`;
  return label;
}

// ── Main View ────────────────────────────────────────────────────────────

export function CashFlowPlanningView() {
  const store = useBaraproStore();
  const planningResult = useMemo(() => {
    try {
      return buildCashFlowPlanning(store);
    } catch (e) {
      console.error('[CashFlowPlanning] buildCashFlowPlanning error:', e);
      return null;
    }
  }, [store]);
  const annualRows = planningResult?.annualRows || [];
  const monthlyRows = planningResult?.monthlyRows || [];
  const info = planningResult?.info || { totalYears: 0, operationStartMonth: 0 };
  const duration = store.project?.monthsDuration || 120;
  const monthGroups = useMemo(() =>
    groupMonthsByYear(monthlyRows.length || duration, store.project?.startDate),
    [monthlyRows.length, duration, store.project?.startDate]
  );

  const hasData = annualRows.length > 0 || monthlyRows.length > 0;

  // KPI totals from annual rows
  const kpis = useMemo(() => {
    if (annualRows.length === 0) return {
      totalEntradas: 0, totalSalidas: 0, saldoFinal: 0,
      saldoInversiones: 0, saldoFinanciamiento: 0, saldoOperaciones: 0,
    };
    const last = annualRows[annualRows.length - 1];
    return {
      totalEntradas: annualRows.reduce((s, r) => s + r.totalEntradas, 0),
      totalSalidas: annualRows.reduce((s, r) => s + r.totalSalidas, 0),
      saldoFinal: last.saldoAcumulado,
      saldoInversiones: annualRows.reduce((s, r) => s + r.saldoInversiones, 0),
      saldoFinanciamiento: annualRows.reduce((s, r) => s + r.saldoFinanciamiento, 0),
      saldoOperaciones: annualRows.reduce((s, r) => s + r.saldoOperaciones, 0),
    };
  }, [annualRows]);

  // ── Viabilidad por Flujos Acumulados ──
  const viability = useMemo(() => {
    if (annualRows.length === 0) return null;

    let yearsNegative = 0;
    let worstAccumulated = Infinity;
    let recoveryYear: number | null = null;
    let hasGoneNegative = false;

    for (const row of annualRows) {
      if (row.saldoAcumulado < 0) {
        yearsNegative++;
        hasGoneNegative = true;
        if (row.saldoAcumulado < worstAccumulated) {
          worstAccumulated = row.saldoAcumulado;
        }
      } else if (hasGoneNegative && recoveryYear === null) {
        recoveryYear = row.year;
      }
    }

    const finalAccumulated = annualRows[annualRows.length - 1].saldoAcumulado;

    let status: 'viable' | 'riesgoso' | 'noViable';
    if (!hasGoneNegative) {
      status = 'viable';
    } else if (finalAccumulated >= 0) {
      status = 'riesgoso';
    } else {
      status = 'noViable';
    }

    return {
      yearsNegative,
      worstAccumulated: worstAccumulated === Infinity ? 0 : worstAccumulated,
      recoveryYear,
      finalAccumulated,
      status,
      hasGoneNegative,
    };
  }, [annualRows]);

  // ─── Export data for annual table ───
  const annualExportData = useMemo(() => {
    if (!hasData) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = ['Concepto', ...annualRows.map(r => `Año ${r.year}`), 'Total'];
    const rows: TableExportRow[] = ALL_ROWS.map((rowDef) => {
      const isHeader = rowDef.type === 'header';
      const isDivider = rowDef.type === 'section-divider';
      const isInfoRow = rowDef.type === 'info';
      const noValue = isHeader || isDivider;
      const dataKey = rowDef.key as keyof CashFlowPlanningRow;
      const label = noValue ? L(rowDef.labelKey) : formatLabel(rowDef);
      if (noValue) {
        return { cells: [label, ...Array(headers.length - 1).fill('')], isSectionHeader: isDivider, bold: isDivider || isHeader };
      }
      let rowTotal: number;
      if (dataKey === 'saldoAcumulado') {
        rowTotal = annualRows.length > 0 ? annualRows[annualRows.length - 1].saldoAcumulado : 0;
      } else {
        rowTotal = annualRows.reduce((s, r) => s + (r[dataKey] as number || 0), 0);
      }
      const values = annualRows.map(r => {
        const cellVal = r[dataKey] as number || 0;
        return isInfoRow ? `(${formatCurrency(cellVal)})` : formatCurrency(cellVal);
      });
      return {
        cells: [label, ...values, formatCurrency(rowTotal)],
        bold: rowDef.type === 'total' || rowDef.type === 'balance',
        highlight: rowDef.type === 'balance',
      };
    });
    return { headers, rows };
  }, [annualRows, hasData]);

  // ─── Export data for monthly table ───
  const monthlyExportData = useMemo(() => {
    if (!hasData) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = ['Concepto'];
    for (const group of monthGroups) {
      for (const m of group.months) {
        headers.push(`${m.label} ${group.year}`);
      }
      headers.push(`Subt. ${group.year}`);
    }
    headers.push('Total');
    const rows: TableExportRow[] = ALL_ROWS.map((rowDef) => {
      const isHeader = rowDef.type === 'header';
      const isDivider = rowDef.type === 'section-divider';
      const isInfoRow = rowDef.type === 'info';
      const noValue = isHeader || isDivider;
      const dataKey = rowDef.key as keyof CashFlowPlanningRow;
      const label = noValue ? L(rowDef.labelKey) : formatLabel(rowDef);
      if (noValue) {
        return { cells: [label, ...Array(headers.length - 1).fill('')], isSectionHeader: isDivider, bold: isDivider || isHeader };
      }
      let rowTotal: number;
      if (dataKey === 'saldoAcumulado') {
        rowTotal = monthlyRows.length > 0 ? monthlyRows[monthlyRows.length - 1].saldoAcumulado : 0;
      } else {
        rowTotal = monthlyRows.reduce((s, r) => s + (r[dataKey] as number || 0), 0);
      }
      const allValues = monthlyRows.map(r => (r[dataKey] as number || 0));
      const cells = getMonthlyValuesWithSubtotals(allValues, monthGroups, {
        useLastValue: dataKey === 'saldoAcumulado' || dataKey === 'saldoInversiones' || dataKey === 'saldoFinanciamiento' || dataKey === 'saldoOperaciones',
      });
      const fmtCells = cells.map(cell => (isInfoRow && !cell.isSubtotal) ? `(${formatCurrency(cell.value)})` : formatCurrency(cell.value));
      return {
        cells: [label, ...fmtCells, formatCurrency(rowTotal)],
        bold: rowDef.type === 'total' || rowDef.type === 'balance',
        highlight: rowDef.type === 'balance',
      };
    });
    return { headers, rows };
  }, [monthlyRows, monthGroups, hasData]);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <ModuleHeader
        title="Flujo de Caja - Planificación Financiera"
        description="Flujo de caja para DL según Resolución 1/2022 del MINCEX"
        icon={Wallet}
        variant="info"
        badge={`${info.totalYears} años`}
      />

      {!hasData && (
        <div className="glass-card shadow-card-sm rounded-xl py-12 text-center">
          <p className="text-muted-foreground text-fin-sm">{'No hay datos de flujo de caja planificado.'}</p>
        </div>
      )}

      {/* KPI Cards */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Building2 className="h-3.5 w-3.5 text-warning" />
                <p className="text-fin-xs text-muted-foreground">{L('cashFlowPlanning.kpiInversiones')}</p>
              </div>
              <p className={cn('text-fin-base font-bold', kpis.saldoInversiones >= 0 ? 'text-success' : 'text-danger')}>
                {formatCurrency(kpis.saldoInversiones)}
              </p>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-panel-b p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Landmark className="h-3.5 w-3.5 text-panel-b" />
                <p className="text-fin-xs text-muted-foreground">{L('cashFlowPlanning.kpiFinanciamiento')}</p>
              </div>
              <p className={cn('text-fin-base font-bold', kpis.saldoFinanciamiento >= 0 ? 'text-success' : 'text-danger')}>
                {formatCurrency(kpis.saldoFinanciamiento)}
              </p>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Factory className="h-3.5 w-3.5 text-success" />
                <p className="text-fin-xs text-muted-foreground">{L('cashFlowPlanning.kpiOperaciones')}</p>
              </div>
              <p className={cn('text-fin-base font-bold', kpis.saldoOperaciones >= 0 ? 'text-success' : 'text-danger')}>
                {formatCurrency(kpis.saldoOperaciones)}
              </p>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <p className="text-fin-xs text-muted-foreground">{L('cashFlowPlanning.kpiTotalEntradas')}</p>
              </div>
              <p className="text-fin-base font-bold text-success">{formatCurrency(kpis.totalEntradas)}</p>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-danger p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
                <p className="text-fin-xs text-muted-foreground">{L('cashFlowPlanning.kpiTotalSalidas')}</p>
              </div>
              <p className="text-fin-base font-bold text-danger">{formatCurrency(kpis.totalSalidas)}</p>
          </div>
        </div>
      )}

      {/* Viabilidad */}
      {hasData && viability && (
        <div className={cn(
          'glass-card shadow-card-sm rounded-xl border-l-4',
          viability.status === 'viable' ? 'border-l-success' :
          viability.status === 'riesgoso' ? 'border-l-warning' : 'border-l-danger',
        )}>
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className={cn(
                  'h-5 w-5',
                  viability.status === 'viable' ? 'text-success' :
                  viability.status === 'riesgoso' ? 'text-warning' : 'text-danger',
                )} />
                <h3 className="text-fin-base font-semibold">
                  {L('cashFlowPlanning.viabilityTitle')}
                </h3>
              </div>
              <Badge className={cn(
                'text-xs font-semibold',
                viability.status === 'viable' && 'bg-success-muted text-success hover:bg-success-muted',
                viability.status === 'riesgoso' && 'bg-warning-muted text-warning hover:bg-warning-muted',
                viability.status === 'noViable' && 'bg-danger-muted text-danger hover:bg-danger-muted',
              )}>
                {viability.status === 'viable' && <CheckCircle className="h-3 w-3 mr-1" />}
                {viability.status !== 'viable' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {L(`cashFlowPlanning.${viability.status === 'riesgoso' ? 'risky' : viability.status}`)}
              </Badge>
            </div>
            <p className="text-fin-xs text-muted-foreground mt-1">
              {L('cashFlowPlanning.viabilityDescription')}
            </p>
          </div>
          <div className="p-4 pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={cn('rounded-lg p-3', viability.yearsNegative > 0 ? 'bg-danger-muted/50' : 'bg-success-muted/50')}>
                <p className="text-fin-xs text-muted-foreground font-medium">{L('cashFlowPlanning.yearsNegativeFlow')}</p>
                <p className={cn('text-fin-lg font-bold mt-1', viability.yearsNegative > 0 ? 'text-danger' : 'text-success')}>
                  {viability.yearsNegative === 0 ? L('cashFlowPlanning.neverNegative') : `${viability.yearsNegative} de ${annualRows.length}`}
                </p>
              </div>
              <div className={cn('rounded-lg p-3', viability.worstAccumulated < 0 ? 'bg-danger-muted/50' : 'bg-success-muted/50')}>
                <p className="text-fin-xs text-muted-foreground font-medium">{L('cashFlowPlanning.worstAccumulated')}</p>
                <p className={cn('text-fin-lg font-bold mt-1', viability.worstAccumulated < 0 ? 'text-danger' : 'text-success')}>
                  {formatCurrency(viability.worstAccumulated)}
                </p>
              </div>
              <div className={cn('rounded-lg p-3', viability.recoveryYear ? 'bg-warning-muted/50' : 'bg-muted/50')}>
                <p className="text-fin-xs text-muted-foreground font-medium">{L('cashFlowPlanning.recoveryYear')}</p>
                <p className={cn('text-fin-lg font-bold mt-1', viability.recoveryYear ? 'text-warning' : 'text-muted-foreground')}>
                  {!viability.hasGoneNegative ? L('cashFlowPlanning.neverNegative') : viability.recoveryYear ? `Año ${viability.recoveryYear}` : L('cashFlowPlanning.noRecovery')}
                </p>
              </div>
              <div className={cn('rounded-lg p-3', viability.finalAccumulated >= 0 ? 'bg-success-muted/50' : 'bg-danger-muted/50')}>
                <p className="text-fin-xs text-muted-foreground font-medium">{L('cashFlowPlanning.finalAccumulated')}</p>
                <p className={cn('text-fin-lg font-bold mt-1', viability.finalAccumulated >= 0 ? 'text-success' : 'text-danger')}>
                  {formatCurrency(viability.finalAccumulated)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {hasData && (
        <Tabs defaultValue="annual">
          <TabsList>
            <TabsTrigger value="annual">{'Anual'}</TabsTrigger>
            <TabsTrigger value="monthly">{'Mensual'}</TabsTrigger>
          </TabsList>

          {/* ── Annual Table ── */}
          <TabsContent value="annual" className="space-y-4">
            <div className="glass-card shadow-card-sm rounded-xl">
              <div className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {'Flujo de Caja — Planificación Anual'}
                  </CardTitle>
                  <TableExportButton
                    moduleName="Flujo de Caja - Planificación"
                    tableName="Anual"
                    headers={annualExportData.headers}
                    rows={annualExportData.rows}
                    landscape={annualExportData.headers.length > 6}
                  />
                </div>
              </div>
              <div className="p-0">
                <ScrollableTable maxHeight="700px" stickyColumns={1} firstColWidth={260}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px] fin-col-header text-fin-xs">{'Concepto'}</TableHead>
                        {annualRows.map((r) => (
                          <TableHead
                            key={r.year}
                            className="text-right min-w-[100px] border-l border-border/50 fin-col-header-year text-fin-xs"
                          >
                            {`Año ${r.year}`}
                          </TableHead>
                        ))}
                        <TableHead className="text-right min-w-[110px] fin-col-header text-fin-xs">{'Total'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_ROWS.map((rowDef) => {
                        const isHeader = rowDef.type === 'header';
                        const isDivider = rowDef.type === 'section-divider';
                        const isInfo = rowDef.type === 'info';
                        const noValue = isHeader || isDivider;
                        const dataKey = rowDef.key as keyof CashFlowPlanningRow;

                        // Row total
                        let rowTotal: number;
                        if (noValue) {
                          rowTotal = 0;
                        } else if (dataKey === 'saldoAcumulado') {
                          rowTotal = annualRows.length > 0 ? annualRows[annualRows.length - 1].saldoAcumulado : 0;
                        } else {
                          rowTotal = annualRows.reduce((s, r) => s + (r[dataKey] as number || 0), 0);
                        }

                        return (
                          <TableRow
                            key={String(rowDef.key)}
                            className={cn(
                              isHeader && 'fin-section-header',
                              isDivider && 'border-t-2 border-border/50 bg-muted/30',
                              rowDef.type === 'total' && 'fin-table-total',
                              !isHeader && !isDivider && 'fin-row-hover',
                            )}
                          >
                            <TableCell className={cn(
                              'whitespace-nowrap',
                              getCellStyle(rowDef.type, rowTotal),
                              (rowDef.indent ?? 0) > 0 && 'pl-8',
                              isInfo && 'italic text-muted-foreground',
                            )}>
                              {noValue ? L(rowDef.labelKey) : formatLabel(rowDef)}
                            </TableCell>
                            {annualRows.map((r) => {
                              const cellVal = noValue ? 0 : (r[dataKey] as number || 0);
                              return (
                                <TableCell
                                  key={r.year}
                                  className={cn(
                                    'text-right text-fin-sm tabular-nums',
                                    getCellStyle(rowDef.type, cellVal),
                                    r.saldoAcumulado < 0 && (rowDef.key === 'saldoAnual' || rowDef.key === 'saldoAcumulado') && 'bg-danger-muted/20',
                                  )}
                                >
                                  {noValue ? '' : (isInfo ? `(${formatCurrency(cellVal)})` : formatCurrency(cellVal))}
                                </TableCell>
                              );
                            })}
                            <TableCell className={cn(
                              'text-right fin-total-col text-fin-sm tabular-nums',
                              getCellStyle(rowDef.type, rowTotal),
                            )}>
                              {noValue ? '' : formatCurrency(rowTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollableTable>
              </div>
            </div>
          </TabsContent>

          {/* ── Monthly Table ── */}
          <TabsContent value="monthly" className="space-y-4">
            <div className="glass-card shadow-card-sm rounded-xl">
              <div className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {'Flujo de Caja — Planificación Mensual'}
                  </CardTitle>
                  <TableExportButton
                    moduleName="Flujo de Caja - Planificación"
                    tableName="Mensual"
                    headers={monthlyExportData.headers}
                    rows={monthlyExportData.rows}
                    landscape={monthlyExportData.headers.length > 6}
                  />
                </div>
              </div>
              <div className="p-0">
                <ScrollableTable maxHeight="700px" stickyColumns={1} firstColWidth={260}>
                  <Table>
                    <TableHeader>
                      <YearMonthHeader
                        groups={monthGroups}
                        stickyColumns={1}
                        totalColumnMinWidth="110px"
                        monthColumnMinWidth="70px"
                        showYearSubtotals
                      />
                    </TableHeader>
                    <TableBody>
                      {ALL_ROWS.map((rowDef) => {
                        const isHeader = rowDef.type === 'header';
                        const isDivider = rowDef.type === 'section-divider';
                        const isInfo = rowDef.type === 'info';
                        const noValue = isHeader || isDivider;
                        const dataKey = rowDef.key as keyof CashFlowPlanningRow;

                        // Row total
                        let rowTotal: number;
                        if (noValue) {
                          rowTotal = 0;
                        } else if (dataKey === 'saldoAcumulado') {
                          rowTotal = monthlyRows.length > 0 ? monthlyRows[monthlyRows.length - 1].saldoAcumulado : 0;
                        } else {
                          rowTotal = monthlyRows.reduce((s, r) => s + (r[dataKey] as number || 0), 0);
                        }

                        return (
                          <TableRow
                            key={String(rowDef.key)}
                            className={cn(
                              isHeader && 'fin-section-header',
                              isDivider && 'border-t-2 border-border/50 bg-muted/30',
                              rowDef.type === 'total' && 'fin-table-total',
                              !isHeader && !isDivider && 'fin-row-hover',
                            )}
                          >
                            <TableCell className={cn(
                              'whitespace-nowrap',
                              getCellStyle(rowDef.type, rowTotal),
                              (rowDef.indent ?? 0) > 0 && 'pl-8',
                              isInfo && 'italic text-muted-foreground',
                            )}>
                              {noValue ? L(rowDef.labelKey) : formatLabel(rowDef)}
                            </TableCell>
                            {(() => {
                              const allValues = monthlyRows.map(r => noValue ? 0 : (r[dataKey] as number || 0));
                              const cells = getMonthlyValuesWithSubtotals(allValues, monthGroups, {
                                useLastValue: dataKey === 'saldoAcumulado' || dataKey === 'saldoInversiones' || dataKey === 'saldoFinanciamiento' || dataKey === 'saldoOperaciones',
                              });
                              let gi = 0;
                              return cells.map((cell, ci) => {
                                const cellVal = noValue ? 0 : cell.value;
                                if (cell.isSubtotal) {
                                  const year = monthGroups[gi].year;
                                  gi++;
                                  return (
                                    <TableCell
                                      key={`sub-${year}`}
                                      className={cn(
                                        'text-right text-fin-sm tabular-nums font-semibold bg-info-muted/60',
                                        getCellStyle(rowDef.type, cellVal),
                                      )}
                                    >
                                      {noValue ? '' : formatCurrency(cellVal)}
                                    </TableCell>
                                  );
                                }
                                return (
                                  <TableCell
                                    key={ci}
                                    className={cn(
                                      'text-right text-fin-sm tabular-nums',
                                      getCellStyle(rowDef.type, cellVal),
                                    )}
                                  >
                                    {noValue ? '' : (isInfo ? `(${formatCurrency(cellVal)})` : formatCurrency(cellVal))}
                                  </TableCell>
                                );
                              });
                            })()}
                            <TableCell className={cn(
                              'text-right fin-total-col text-fin-sm tabular-nums',
                              getCellStyle(rowDef.type, rowTotal),
                            )}>
                              {noValue ? '' : formatCurrency(rowTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollableTable>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
