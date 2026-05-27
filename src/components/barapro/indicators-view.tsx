'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { L } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import type { BaraproState } from '@/lib/barapro-store';
import {
  buildCashFlowInvestment,
  buildCashFlowEquity,
  findOperationStartMonth,
  calcTIR,
  calcTIRM,
  calcPR,
  calcPuntoEquilibrio,
  calcVANWithIP,
  calcPRAWithIP,
  calcRVANWithIP,
  calcBCWithIP,
  calcIRWithIP,
  calcVAEWithIP,
  calcCapitalRecuperado,
} from '@/lib/barapro-financial';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Percent,
  Shield,
  RotateCcw,
  Building2,
  Landmark,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

// ─── Formatting helpers ────────────────────────────────────────

function formatCurrency(n: number): string {
  return n.toLocaleString('es-CU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCompact(n: number): string {
  if (n === Infinity) return '∞';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatPct(n: number | null): string {
  if (n === null) return 'N/D';
  return `${(n * 100).toFixed(2)}%`;
}

// ─── Monthly → Annual aggregation ──────────────────────────────

function monthlyToAnnual(monthlyFlows: number[]): number[] {
  const years: number[] = [];
  for (let y = 0; y < monthlyFlows.length; y += 12) {
    const chunk = monthlyFlows.slice(y, y + 12);
    years.push(chunk.reduce((s, v) => s + v, 0));
  }
  return years;
}

// ─── Indicator data type ───────────────────────────────────────

interface IndicatorItem {
  id: string;
  name: string;
  fullName: string;
  value: string;
  favorable: boolean;
  icon: React.ElementType;
}

// ─── Calculate indicators from annual cash flows ──────────────

function calculateIndicators(
  annualFlows: number[],
  store: BaraproState,
  investmentYears: number,
  preCalcIndicators?: { van: number; tir: number | null; pr: number | null; pra: number | null; rvan: number },
): IndicatorItem[] {
  const tma = store.parameters.minimumAcceptableRate / 100;
  const discountRate = store.parameters.discountRateCUP / 100;
  const duration = store.project.monthsDuration || 120;
  const totalYears = Math.ceil(duration / 12);

  // Usar indicadores pre-calculados de buildCashFlow* (mismos que el Flujo de Caja)
  const van = preCalcIndicators?.van ?? calcVANWithIP(annualFlows, discountRate, investmentYears);
  const tir = preCalcIndicators?.tir ?? calcTIR(annualFlows);
  const tirm = calcTIRM(annualFlows, tma, tma);
  const pr = preCalcIndicators?.pr ?? calcPR(annualFlows);
  const pra = preCalcIndicators?.pra ?? calcPRAWithIP(annualFlows, discountRate, investmentYears);
  const rvan = preCalcIndicators?.rvan ?? calcRVANWithIP(annualFlows, discountRate, investmentYears);
  const bc = calcBCWithIP(annualFlows, discountRate, investmentYears);
  const eav = calcVAEWithIP(annualFlows, discountRate, investmentYears);
  const ir = calcIRWithIP(annualFlows, discountRate, investmentYears);
  const capital = calcCapitalRecuperado(annualFlows);

  // Break-Even Point (uses full store)
  const pe = calcPuntoEquilibrio(store);
  const cupToMlc = store.project.exchangeRates.cupToMlc;
  let totalRevenue = 0;
  for (const item of store.salesItems) {
    const qty = Array.isArray(item.quantity) ? item.quantity : [];
    for (let m = 0; m < Math.min(qty.length, duration); m++) {
      if (qty[m] > 0) {
        totalRevenue += qty[m] * item.priceCUP + qty[m] * item.priceMLC * cupToMlc;
      }
    }
  }

  const items: IndicatorItem[] = [
    {
      id: 'van',
      name: 'VAN',
      fullName: 'Valor Actual Neto',
      value: formatCurrency(van),
      favorable: van > 0,
      icon: DollarSign,
    },
    {
      id: 'tir',
      name: 'TIR',
      fullName: 'Tasa Interna de Retorno',
      value: formatPct(tir),
      favorable: tir !== null && tir > tma,
      icon: TrendingUp,
    },
    {
      id: 'tirm',
      name: 'TIRM',
      fullName: 'Tasa Interna de Retorno Modificada',
      value: formatPct(tirm),
      favorable: tirm !== null && tirm > tma,
      icon: BarChart3,
    },
    {
      id: 'pr',
      name: 'PR',
      fullName: 'Período de Recuperación',
      value: pr !== null ? `${pr.toFixed(2)} años` : 'N/D',
      favorable: pr !== null && pr <= totalYears,
      icon: Clock,
    },
    {
      id: 'pra',
      name: 'PRA',
      fullName: 'Período de Recuperación Actualizado',
      value: pra !== null ? `${pra.toFixed(2)} años` : 'N/D',
      favorable: pra !== null && pra <= totalYears,
      icon: Clock,
    },
    {
      id: 'rvan',
      name: 'RVAN',
      fullName: 'Rentabilidad del VAN',
      value: rvan === Infinity ? '∞' : rvan.toFixed(3),
      favorable: rvan > 0,
      icon: BarChart3,
    },
    {
      id: 'bc',
      name: 'B/C',
      fullName: 'Relación Beneficio-Costo',
      value: bc === Infinity ? '∞' : bc.toFixed(3),
      favorable: bc > 1,
      icon: Percent,
    },
    {
      id: 'eav',
      name: 'VAE',
      fullName: 'Valor Anual Equivalente',
      value: formatCurrency(eav),
      favorable: eav > 0,
      icon: RotateCcw,
    },
    {
      id: 'ir',
      name: 'PI',
      fullName: 'Índice de Rentabilidad',
      value: ir === Infinity ? '∞' : ir.toFixed(3),
      favorable: ir > 0,
      icon: Shield,
    },
    {
      id: 'capital',
      name: 'CR',
      fullName: 'Capital Recuperado',
      value: `${capital.percentage.toFixed(1)}%`,
      favorable: capital.percentage >= 100,
      icon: ArrowUpRight,
    },
    {
      id: 'breakEven',
      name: 'PE',
      fullName: 'Punto de Equilibrio',
      value: pe === Infinity ? '∞' : formatCurrency(pe),
      favorable: pe < totalRevenue,
      icon: Target,
    },
  ];

  return items;
}

// ─── Main Component ────────────────────────────────────────────

export function IndicatorsView() {
  const store = useBaraproStore();
  const tma = store.parameters.minimumAcceptableRate / 100;
  const discountRate = store.parameters.discountRateCUP / 100;
  const duration = store.project.monthsDuration || 120;
  const totalYears = Math.ceil(duration / 12);

  // ─── Build annual cash flows for each perspective ───

  const { investmentIndicators, equityIndicators } = useMemo(() => {
    // Panel 1: Investment (sin financiamiento)
    const investmentCF = buildCashFlowInvestment(store);
    const investmentMonthlyFlows = investmentCF.monthly.map((r) => r.flujoNeto);
    const investmentAnnualFlows = monthlyToAnnual(investmentMonthlyFlows);

    // Panel 2: Equity (con financiamiento) — use actual cash flows
    const equityCF = buildCashFlowEquity(store);
    const equityMonthlyFlows = equityCF.monthly.map((r) => r.saldoAnual);
    const equityAnnualFlows = monthlyToAnnual(equityMonthlyFlows);

    // Calcular investmentYears a partir de los datos reales del motor financiero
    const duration = store.project.monthsDuration || 120;
    const opStartMonth = findOperationStartMonth(store);
    const investmentMonths = opStartMonth > duration ? 0 : opStartMonth - 1;
    const investmentYears = Math.ceil(investmentMonths / 12);

    // Pasar indicadores pre-calculados por buildCashFlow* para consistencia
    // con los valores mostrados en la vista de Flujos de Caja
    return {
      investmentIndicators: calculateIndicators(
        investmentAnnualFlows, store, investmentYears, investmentCF.indicators
      ),
      equityIndicators: calculateIndicators(
        equityAnnualFlows, store, investmentYears, equityCF.indicators
      ),
    };
  }, [store]);

  // Summary stats
  const investmentFavorable = investmentIndicators.filter((i) => i.favorable).length;
  const equityFavorable = equityIndicators.filter((i) => i.favorable).length;

  // ── Export data: Comparison table ──
  const comparisonExportData = useMemo(() => {
    const headers = ['Indicador', 'Nombre Completo', 'Sin Financiamiento', 'Estado', 'Con Financiamiento', 'Estado'];
    const rows: TableExportRow[] = investmentIndicators.map((invInd, idx) => {
      const eqInd = equityIndicators[idx];
      return {
        cells: [invInd.name, invInd.fullName, invInd.value, invInd.favorable ? 'Favorable' : 'Desfavorable', eqInd.value, eqInd.favorable ? 'Favorable' : 'Desfavorable'],
        bold: false,
      };
    });
    return { headers, rows };
  }, [investmentIndicators, equityIndicators]);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <ModuleHeader
        title="Indicadores Financieros"
        description="Comparación de indicadores: Proyecto puro vs Capital social con financiamiento"
        icon={BarChart3}
        variant="info"
        actions={
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-info-muted text-info hover:bg-info-muted">
              TD: {store.parameters.discountRateCUP}%
            </Badge>
            <Badge className="bg-muted text-muted-foreground hover:bg-muted">
              TMA: {store.parameters.minimumAcceptableRate}%
            </Badge>
            <Badge className="bg-muted text-muted-foreground hover:bg-muted">
              {totalYears} {'años'}
            </Badge>
          </div>
        }
      />

      {/* Dual Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ─── Panel 1: Sin Financiamiento ─── */}
        <div className="glass-card shadow-card-sm rounded-xl border-t-4 border-t-success">
          <div className="p-4 pb-3 bg-gradient-to-r from-success-muted to-transparent rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success-muted">
                  <Building2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="text-fin-base font-semibold">{'Sin Financiamiento'}</h3>
                  <p className="text-fin-sm text-muted-foreground mt-0.5">
                    {'Viabilidad del proyecto puro, sin considerar fuentes de financiamiento externo'}
                  </p>
                </div>
              </div>
              <Badge className={cn(
                'text-xs',
                investmentFavorable >= 7
                  ? 'bg-success-muted text-success hover:bg-success-muted'
                  : investmentFavorable >= 5
                    ? 'bg-warning-muted text-warning hover:bg-warning-muted'
                    : 'bg-danger-muted text-danger hover:bg-danger-muted'
              )}>
                {`${investmentFavorable} favorable(s)`}
              </Badge>
            </div>
          </div>
          <div className="p-4 pt-2">
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {investmentIndicators.slice(0, 4).map((ind) => (
                <MiniKPICard key={ind.id} indicator={ind} />
              ))}
            </div>
            {/* Indicator list */}
            <div className="space-y-1.5">
              {investmentIndicators.map((ind) => (
                <IndicatorRow key={ind.id} indicator={ind} />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Panel 2: Con Financiamiento ─── */}
        <div className="glass-card shadow-card-sm rounded-xl border-t-4 border-t-panel-b">
          <div className="p-4 pb-3 bg-gradient-to-r from-panel-b-muted to-transparent rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-panel-b-muted">
                  <Landmark className="h-5 w-5 text-panel-b" />
                </div>
                <div>
                  <h3 className="text-fin-base font-semibold">{'Con Financiamiento'}</h3>
                  <p className="text-fin-sm text-muted-foreground mt-0.5">
                    {'Perspectiva del inversionista considerando capital social y financiamiento'}
                  </p>
                </div>
              </div>
              <Badge className={cn(
                'text-xs',
                equityFavorable >= 7
                  ? 'bg-panel-b-muted text-panel-b hover:bg-panel-b-muted'
                  : equityFavorable >= 5
                    ? 'bg-warning-muted text-warning hover:bg-warning-muted'
                    : 'bg-danger-muted text-danger hover:bg-danger-muted'
              )}>
                {`${equityFavorable} favorable(s)`}
              </Badge>
            </div>
          </div>
          <div className="p-4 pt-2">
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {equityIndicators.slice(0, 4).map((ind) => (
                <MiniKPICard key={ind.id} indicator={ind} accentColor="violet" />
              ))}
            </div>
            {/* Indicator list */}
            <div className="space-y-1.5">
              {equityIndicators.map((ind) => (
                <IndicatorRow key={ind.id} indicator={ind} accentColor="violet" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Comparison Table ─── */}
      <div className="glass-card shadow-card-sm rounded-xl">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-fin-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {'Resumen de Indicadores'}
            </h3>
            <TableExportButton
              moduleName="Indicadores Financieros"
              tableName="Resumen de Indicadores"
              headers={comparisonExportData.headers}
              rows={comparisonExportData.rows}
              landscape={comparisonExportData.headers.length > 6}
            />
          </div>
        </div>
        <ScrollableTable stickyColumns={0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px] fin-col-header">{'Indicador'}</TableHead>
                <TableHead className="min-w-[180px] fin-col-header">{'Nombre Completo'}</TableHead>
                <TableHead className="text-right min-w-[120px] bg-success-muted/70 fin-col-header">
                  <span className="flex items-center justify-end gap-1 min-w-0">
                    <Building2 className="h-3 w-3 text-success" />
                    {'Sin Financiamiento'}
                  </span>
                </TableHead>
                <TableHead className="text-center min-w-[80px] fin-col-header">{'Estado'}</TableHead>
                <TableHead className="text-right min-w-[120px] bg-panel-b-muted/70 fin-col-header">
                  <span className="flex items-center justify-end gap-1 min-w-0">
                    <Landmark className="h-3 w-3 text-panel-b" />
                    {'Con Financiamiento'}
                  </span>
                </TableHead>
                <TableHead className="text-center min-w-[80px] fin-col-header">{'Estado'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investmentIndicators.map((invInd, idx) => {
                const eqInd = equityIndicators[idx];
                return (
                  <TableRow key={invInd.id} className="fin-row-hover">
                    <TableCell className="text-fin-sm font-semibold">{invInd.name}</TableCell>
                    <TableCell className="text-fin-sm text-muted-foreground">{invInd.fullName}</TableCell>
                    <TableCell className={cn(
                      'text-fin-sm text-right font-mono font-semibold',
                      invInd.favorable ? 'text-success' : 'text-danger'
                    )}>
                      {invInd.value}
                    </TableCell>
                    <TableCell className="text-fin-sm text-center">
                      {invInd.favorable ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success mx-auto" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className={cn(
                      'text-fin-sm text-right font-mono font-semibold',
                      eqInd.favorable ? 'text-panel-b' : 'text-danger'
                    )}>
                      {eqInd.value}
                    </TableCell>
                    <TableCell className="text-fin-sm text-center">
                      {eqInd.favorable ? (
                        <CheckCircle className="h-3.5 w-3.5 text-panel-b mx-auto" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollableTable>
      </div>
    </div>
  );
}

// ─── Mini KPI Card (top 4 indicators) ─────────────────────────

function MiniKPICard({ indicator, accentColor = 'emerald' }: { indicator: IndicatorItem; accentColor?: 'emerald' | 'violet' }) {
  const Icon = indicator.icon;
  const isEmerald = accentColor === 'emerald';
  const colors = isEmerald
    ? {
        bg: indicator.favorable ? 'bg-success-muted' : 'bg-danger-muted',
        iconBg: indicator.favorable ? 'bg-success-muted' : 'bg-danger-muted',
        iconText: indicator.favorable ? 'text-success' : 'text-danger',
        valueText: indicator.favorable ? 'text-success' : 'text-danger',
        badgeBg: indicator.favorable ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger',
      }
    : {
        bg: indicator.favorable ? 'bg-panel-b-muted' : 'bg-danger-muted',
        iconBg: indicator.favorable ? 'bg-panel-b-muted' : 'bg-danger-muted',
        iconText: indicator.favorable ? 'text-panel-b' : 'text-danger',
        valueText: indicator.favorable ? 'text-panel-b' : 'text-danger',
        badgeBg: indicator.favorable ? 'bg-panel-b-muted text-panel-b' : 'bg-danger-muted text-danger',
      };

  return (
    <div className={cn('rounded-xl p-2.5 border glass-card shadow-card-sm', colors.bg)}>
      <div className="flex items-center justify-between mb-1">
        <div className={cn('p-1 rounded', colors.iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', colors.iconText)} />
        </div>
        {indicator.favorable ? (
          <ArrowUpRight className="h-3 w-3 text-success" />
        ) : (
          <ArrowDownRight className="h-3 w-3 text-danger" />
        )}
      </div>
      <p className={cn('text-fin-base font-bold font-mono', colors.valueText)}>
        {indicator.value}
      </p>
      <p className="text-fin-xs text-muted-foreground font-medium mt-0.5">{indicator.name}</p>
    </div>
  );
}

// ─── Indicator Row (compact card in each panel) ────────────────

function IndicatorRow({ indicator, accentColor = 'emerald' }: { indicator: IndicatorItem; accentColor?: 'emerald' | 'violet' }) {
  const Icon = indicator.icon;
  const isEmerald = accentColor === 'emerald';

  return (
    <div className={cn(
      'flex items-center justify-between p-2 rounded-xl border border-border/50 transition-all duration-200 fin-row-hover',
      indicator.favorable
        ? 'border-transparent hover:bg-success-muted/50'
        : 'border-transparent hover:bg-danger-muted/50'
    )}>
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'p-1.5 rounded-md shrink-0',
          indicator.favorable
            ? isEmerald ? 'bg-success-muted text-success' : 'bg-panel-b-muted text-panel-b'
            : 'bg-danger-muted text-danger'
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-fin-sm font-semibold">{indicator.name}</p>
          <p className="text-fin-xs text-muted-foreground truncate">{indicator.fullName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={cn(
          'text-fin-sm font-mono font-bold',
          indicator.favorable
            ? isEmerald ? 'text-success' : 'text-panel-b'
            : 'text-danger'
        )}>
          {indicator.value}
        </p>
        {indicator.favorable ? (
          <CheckCircle className={cn('h-3.5 w-3.5', isEmerald ? 'text-success' : 'text-panel-b')} />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-danger" />
        )}
      </div>
    </div>
  );
}
