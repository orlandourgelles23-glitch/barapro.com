'use client';

import { useMemo } from 'react';
import { useBaraproStore, type BaraproState } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  buildCashFlowInvestment,
  buildCashFlowEquity,
  findOperationStartMonth,
  calcTIR,
  calcTIRM,
  calcPR,
  calcCapitalRecuperado,
  calcPuntoEquilibrio,
  calcVANWithIP,
  calcPRAWithIP,
  calcRVANWithIP,
  calcBCWithIP,
  calcIRWithIP,
  calcVAEWithIP,
} from '@/lib/barapro-financial';
import {
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Target,
  Percent,
  Shield,
  RotateCcw,
  Building2,
  Landmark,
  ArrowUpRight,
  Circle,
  FileText,
  HardHat,
  Banknote,
  Users,
  Wrench,
  ShoppingBag,
  ShoppingCart,
  Briefcase,
  ShieldCheck,
  Settings,
  Layers,
  HandCoins,
  Sliders,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact, formatSafe } from '@/lib/format';

// ─── Value-to-color variant mapper (4 base variants) ────────

function kpiVariant(value: number | null): 'success' | 'danger' | 'warning' | 'info' {
  if (value === null || value === undefined) return 'info';
  if (value > 0) return 'success';
  if (value < 0) return 'danger';
  return 'warning';
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

// ─── Indicator calculation from cash flows ─────────────────────

interface DashboardIndicators {
  van: number;
  tir: number | null;
  tirm: number | null;
  pr: number | null;
  pra: number | null;
  rvan: number;
  bc: number;
  ir: number;
  vae: number;
  cr: number;
  pe: number;
}

function calcFromFlows(
  monthlyFlows: number[],
  store: BaraproState,
  preCalcIndicators?: { van: number; tir: number | null; pr: number | null; pra: number | null; rvan: number },
): DashboardIndicators {
  const tma = store.parameters.minimumAcceptableRate / 100;
  const discountRate = store.parameters.discountRateCUP / 100;
  const opStart = findOperationStartMonth(store);
  const investmentMonths = Math.max(0, opStart - 1);
  const investmentYears = Math.ceil(investmentMonths / 12);

  const annualFlows = monthlyToAnnual(monthlyFlows);

  return {
    van: preCalcIndicators?.van ?? calcVANWithIP(annualFlows, discountRate, investmentYears),
    tir: preCalcIndicators?.tir ?? calcTIR(annualFlows),
    tirm: calcTIRM(annualFlows, tma, tma),
    pr: preCalcIndicators?.pr ?? calcPR(annualFlows),
    pra: preCalcIndicators?.pra ?? calcPRAWithIP(annualFlows, discountRate, investmentYears),
    rvan: preCalcIndicators?.rvan ?? calcRVANWithIP(annualFlows, discountRate, investmentYears),
    bc: calcBCWithIP(annualFlows, discountRate, investmentYears),
    ir: calcIRWithIP(annualFlows, discountRate, investmentYears),
    vae: calcVAEWithIP(annualFlows, discountRate, investmentYears),
    cr: calcCapitalRecuperado(annualFlows).percentage,
    pe: calcPuntoEquilibrio(store),
  };
}

// ─── KPI Card Definition ───────────────────────────────────

interface KPICardDef {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  format: (ind: DashboardIndicators, tma: number, dur: number) => string;
  variant: (ind: DashboardIndicators, tma: number, dur: number) => 'success' | 'danger' | 'warning' | 'info';
}

const kpiCards: KPICardDef[] = [
  {
    key: 'van', label: 'VAN', detail: 'Valor Actual Neto', icon: DollarSign,
    format: (ind) => formatSafe(ind.van, formatCompact),
    variant: (ind) => kpiVariant(ind.van),
  },
  {
    key: 'tir', label: 'TIR', detail: 'Tasa Interna de Retorno', icon: TrendingUp,
    format: (ind, tma) => ind.tir !== null ? `${(ind.tir * 100).toFixed(2)}%` : 'N/D',
    variant: (ind, tma) => ind.tir !== null ? kpiVariant(ind.tir - tma) : 'info',
  },
  {
    key: 'pra', label: 'PRA', detail: 'Período Recuperación Actualizado', icon: Clock,
    format: (ind, _, dur) => ind.pra !== null ? `${ind.pra.toFixed(1)} meses` : 'N/D',
    variant: (ind, _, dur) => ind.pra !== null ? kpiVariant(dur - ind.pra) : 'info',
  },
  {
    key: 'bc', label: 'B/C', detail: 'Relación Beneficio-Costo', icon: BarChart3,
    format: (ind) => ind.bc === Infinity ? '∞' : ind.bc.toFixed(3),
    variant: (ind) => kpiVariant(ind.bc - 1),
  },
  {
    key: 'roe', label: 'ROE', detail: 'Índice de Rentabilidad', icon: Percent,
    format: (ind) => `${(ind.ir * 100).toFixed(2)}%`,
    variant: (ind) => kpiVariant(ind.ir),
  },
  {
    key: 'vae', label: 'VAE', detail: 'Valor Anual Equivalente', icon: RotateCcw,
    format: (ind) => formatSafe(ind.vae, formatCompact),
    variant: (ind) => kpiVariant(ind.vae),
  },
];

// ─── Variant color mapping for icon glow backgrounds ────────

const variantGlowMap: Record<string, string> = {
  success: 'bg-success-muted text-success shadow-[0_0_12px_oklch(0.55_0.17_160/0.15)]',
  danger: 'bg-danger-muted text-danger shadow-[0_0_12px_oklch(0.58_0.22_25/0.15)]',
  warning: 'bg-warning-muted text-warning shadow-[0_0_12px_oklch(0.72_0.17_70/0.15)]',
  info: 'bg-info-muted text-info shadow-[0_0_12px_oklch(0.55_0.15_250/0.15)]',
};

const variantTextMap: Record<string, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

// ─── Module definition for status grid ─────────────────────

interface ModuleDef {
  label: string;
  icon: LucideIcon;
  filled?: boolean;
  count?: number;
}

// ─── Main View ─────────────────────────────────────────────

export function DashboardView() {
  const store = useBaraproStore();
  const data = useMemo(() => {
    try {
      const cfInvestment = buildCashFlowInvestment(store);
      const cfEquity = buildCashFlowEquity(store);

      const flowsInvestment = cfInvestment.monthly.map(r => r.flujoNeto);
      const flowsEquity = cfEquity.monthly.map(r => r.saldoAnual);

      const indInvestment = calcFromFlows(flowsInvestment, store, cfInvestment.indicators);
      const indEquity = calcFromFlows(flowsEquity, store, cfEquity.indicators);

      return { indInvestment, indEquity };
    } catch (err) {
      console.error('Error calculating dashboard metrics:', err);
      return null;
    }
  }, [store]);

  const tma = store.parameters.minimumAcceptableRate / 100;
  const duration = store.project.monthsDuration || 120;

  // Module status definitions
  const modules: ModuleDef[] = [
    { label: 'A. Proyecto', icon: FileText, filled: !!store.project.projectName },
    { label: 'Marco Lógico', icon: Target, filled: store.logicalFramework.rows.some((r) => r.narrative) },
    { label: 'B. Construcción', icon: HardHat, count: store.constructionItems.length },
    { label: 'C. Capital', icon: Banknote, count: store.capitalItems.length },
    { label: 'D. Subcontratos', icon: Briefcase, count: store.subcontractItems.length },
    { label: 'E. RR.HH.', icon: Users, count: store.resourceItems.length },
    { label: 'Piezas/Herram.', icon: Wrench, count: store.sparePartItems.length },
    { label: 'Otros Recursos', icon: Package, count: store.otherResourceItems.length },
    { label: 'F. Compras', icon: ShoppingCart, count: store.purchaseItems.length },
    { label: 'H. Ventas', icon: ShoppingBag, count: store.salesItems.length },
    { label: 'I. Comerciales', icon: HandCoins, count: store.commercialExpenses.length },
    { label: 'J. Admin', icon: ShieldCheck, count: store.adminExpenses.length },
    { label: 'K. Mantenimiento', icon: Settings, count: store.maintenanceItems.length },
    { label: 'L. Indirectos', icon: Layers, count: store.indirectExpenses.length },
    { label: 'M. Financiamiento', icon: Landmark, count: store.loans.length },
    { label: 'N. Parámetros', icon: Sliders, filled: store.parameters.minimumAcceptableRate > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════
          1. PROJECT INFO BANNER — Gradient with pattern overlay
          ═══════════════════════════════════════════════════════════ */}
      <div className="animate-fade-scale relative overflow-hidden rounded-xl gradient-primary shadow-card-lg">
        {/* Subtle dot pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(1 0 0 / 100%) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {/* Gradient shine sweep */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(135deg, oklch(1 0 0 / 0%) 0%, oklch(1 0 0 / 60%) 40%, oklch(1 0 0 / 0%) 70%)',
          }}
        />

        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                {store.project.projectName || 'Sin Proyecto'}
              </h2>
              <p className="text-sm text-white/70 mt-1 font-medium">
                {store.project.investorName && (
                  <span className="text-white/90">{store.project.investorName}</span>
                )}
                {store.project.investorName && (store.project.province || store.project.municipality) && (
                  <span className="mx-1.5 text-white/40">·</span>
                )}
                {store.project.province && <span>{store.project.province}</span>}
                {store.project.municipality && <span> / {store.project.municipality}</span>}
                {(store.project.province || store.project.municipality) && store.project.sector && (
                  <span className="mx-1.5 text-white/40">·</span>
                )}
                {store.project.sector && <span>{store.project.sector}</span>}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className="glass border-white/15 text-white hover:bg-white/20 font-medium text-xs px-3 py-1">
                {store.project.baseCurrency}
              </Badge>
              <Badge className="glass border-white/15 text-white hover:bg-white/20 font-medium text-xs px-3 py-1">
                {duration} Meses
              </Badge>
              <Badge className="glass border-white/15 text-white hover:bg-white/20 font-medium text-xs px-3 py-1">
                {store.project.calculationMode === 'monthly' ? 'Mensual' : 'Anual'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2. KPI DUAL PANEL — Sin Financiamiento / Con Financiamiento
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Sin Financiamiento Panel ── */}
        <Card className="animate-scale-in overflow-hidden shadow-card-md border-0">
          {/* Gradient accent line */}
          <div className="h-1 gradient-info" />
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-info-muted">
                  <Building2 className="h-4 w-4 text-info" />
                </div>
                <span>Sin Financiamiento</span>
              </CardTitle>
              <Badge className="bg-info-muted text-info hover:bg-info-muted text-[10px] font-semibold tracking-wide uppercase">
                FC Inversión
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data && kpiCards.map((kpi, i) => {
                const variant = kpi.variant(data.indInvestment, tma, duration);
                return (
                  <DashboardKPICard
                    key={`inv-${kpi.key}`}
                    icon={kpi.icon}
                    label={kpi.label}
                    value={kpi.format(data.indInvestment, tma, duration)}
                    detail={kpi.detail}
                    variant={variant}
                    delay={i * 50}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Con Financiamiento Panel ── */}
        <Card className="animate-scale-in overflow-hidden shadow-card-md border-0" style={{ animationDelay: '75ms' }}>
          {/* Gradient accent line */}
          <div className="h-1 gradient-success" />
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-success-muted">
                  <Landmark className="h-4 w-4 text-success" />
                </div>
                <span>Con Financiamiento</span>
              </CardTitle>
              <Badge className="bg-success-muted text-success hover:bg-success-muted text-[10px] font-semibold tracking-wide uppercase">
                FC Capital Social
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data && kpiCards.map((kpi, i) => {
                const variant = kpi.variant(data.indEquity, tma, duration);
                return (
                  <DashboardKPICard
                    key={`eq-${kpi.key}`}
                    icon={kpi.icon}
                    label={kpi.label}
                    value={kpi.format(data.indEquity, tma, duration)}
                    detail={kpi.detail}
                    variant={variant}
                    delay={i * 50}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. COMPARISON TABLE — Modern with fin-* styles
          ═══════════════════════════════════════════════════════════ */}
      {data && (
        <Card className="animate-slide-up shadow-card-md border-0">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-panel-b-muted">
                <Target className="h-4 w-4 text-panel-b" />
              </div>
              <span>Comparación: Inversión vs Capital Social</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="fin-col-header">
                    <th className="fin-col-header text-left py-2.5 px-4 rounded-tl-lg">Indicador</th>
                    <th className="fin-col-header text-right py-2.5 px-4 text-info">Inversión</th>
                    <th className="fin-col-header text-right py-2.5 px-4 text-success">Capital Social</th>
                    <th className="fin-col-header text-right py-2.5 px-4 rounded-tr-lg">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {renderComparisonRow('VAN', data.indInvestment.van, data.indEquity.van, formatCompact, 0)}
                  {renderComparisonPct('TIR', data.indInvestment.tir, data.indEquity.tir, 1)}
                  {renderComparisonPct('TIRM', data.indInvestment.tirm, data.indEquity.tirm, 2)}
                  {renderComparisonRow('PRA (meses)', data.indInvestment.pra, data.indEquity.pra, v => v?.toFixed(1) ?? 'N/D', 3)}
                  {renderComparisonRow('B/C', data.indInvestment.bc, data.indEquity.bc, v => v === Infinity ? '∞' : v?.toFixed(3) ?? 'N/D', 4)}
                  {renderComparisonPct('IR (ROE)', data.indInvestment.ir, data.indEquity.ir, 5)}
                  {renderComparisonRow('VAE', data.indInvestment.vae, data.indEquity.vae, formatCompact, 6)}
                  {renderComparisonPct('CR', data.indInvestment.cr, data.indEquity.cr, 7)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          4. MODULE STATUS GRID — Mini cards with progress indicators
          ═══════════════════════════════════════════════════════════ */}
      <Card className="animate-slide-up shadow-card-md border-0" style={{ animationDelay: '100ms' }}>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-warning-muted">
              <Layers className="h-4 w-4 text-warning" />
            </div>
            <span>Estado de Módulos</span>
            <Badge variant="secondary" className="text-[10px] font-semibold ml-1">
              {modules.filter(m => m.count !== undefined ? m.count > 0 : m.filled).length}/{modules.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2.5">
            {modules.map((mod, i) => (
              <ModuleStatusCard
                key={mod.label}
                label={mod.label}
                icon={mod.icon}
                filled={mod.filled}
                count={mod.count}
                delay={i * 40}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Dashboard KPI Card — Premium with icon glow ───────────

function DashboardKPICard({
  icon: Icon,
  label,
  value,
  detail,
  variant,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
  delay?: number;
}) {
  return (
    <div
      className="glass-card shadow-card-sm rounded-xl p-3.5 transition-all duration-200 hover:shadow-card-md hover:scale-[1.02] cursor-default"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-fin-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <p className={cn('text-fin-xl mt-1', variantTextMap[variant] ?? 'text-foreground')}>
            {value}
          </p>
          <p className="text-fin-xs text-muted-foreground mt-1.5 truncate">{detail}</p>
        </div>
        <div className={cn(
          'flex items-center justify-center rounded-xl h-9 w-9 shrink-0 transition-shadow duration-200',
          variantGlowMap[variant] ?? variantGlowMap.info,
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Comparison Table Helpers ──────────────────────────────

function renderComparisonRow(
  label: string,
  invVal: number | null | undefined,
  eqVal: number | null | undefined,
  fmt: (v: number) => string,
  index: number,
) {
  const iv = invVal ?? 0;
  const ev = eqVal ?? 0;
  const diff = iv - ev;
  const isDiffValid = isFinite(diff);
  const diffStr = isDiffValid ? fmt(Math.abs(diff)) : '—';
  const isEven = index % 2 === 0;
  return (
    <tr className={cn(
      'border-b border-border/40 fin-row-hover transition-colors duration-150',
      isEven ? 'bg-transparent' : 'bg-muted/[0.25]',
    )}>
      <td className="py-2.5 px-4 font-medium text-fin-sm">{label}</td>
      <td className="py-2.5 px-4 text-right text-fin-sm text-info">{fmt(iv)}</td>
      <td className="py-2.5 px-4 text-right text-fin-sm text-success">{fmt(ev)}</td>
      <td className={cn(
        'py-2.5 px-4 text-right text-fin-sm font-semibold',
        !isDiffValid ? 'text-muted-foreground' : diff > 0 ? 'text-info' : diff < 0 ? 'text-success' : 'text-muted-foreground',
      )}>
        {isDiffValid && diff > 0 ? '+' : ''}{diffStr}
      </td>
    </tr>
  );
}

function renderComparisonPct(
  label: string,
  invVal: number | null | undefined,
  eqVal: number | null | undefined,
  index: number,
) {
  const fmt = (v: number | null | undefined) =>
    v !== null && v !== undefined && isFinite(v) ? `${(v * 100).toFixed(2)}%` : 'N/D';
  const iv = invVal ?? 0;
  const ev = eqVal ?? 0;
  const diffPct = (iv - ev) * 100;
  const isDiffValid = isFinite(diffPct);
  const isEven = index % 2 === 0;
  return (
    <tr className={cn(
      'border-b border-border/40 fin-row-hover transition-colors duration-150',
      isEven ? 'bg-transparent' : 'bg-muted/[0.25]',
    )}>
      <td className="py-2.5 px-4 font-medium text-fin-sm">{label}</td>
      <td className="py-2.5 px-4 text-right text-fin-sm text-info">{fmt(invVal)}</td>
      <td className="py-2.5 px-4 text-right text-fin-sm text-success">{fmt(eqVal)}</td>
      <td className={cn(
        'py-2.5 px-4 text-right text-fin-sm font-semibold',
        !isDiffValid ? 'text-muted-foreground' : diffPct > 0 ? 'text-info' : diffPct < 0 ? 'text-success' : 'text-muted-foreground',
      )}>
        {isDiffValid && diffPct > 0 ? '+' : ''}{isDiffValid ? diffPct.toFixed(2) : '—'} pp
      </td>
    </tr>
  );
}

// ─── Module Status Card — Mini card with icon + status ────

function ModuleStatusCard({
  label,
  icon: Icon,
  filled,
  count,
  delay = 0,
}: {
  label: string;
  icon: LucideIcon;
  filled?: boolean;
  count?: number;
  delay?: number;
}) {
  const hasData = count !== undefined ? count > 0 : !!filled;

  return (
    <div
      className={cn(
        'animate-scale-in flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200',
        hasData
          ? 'glass-card shadow-card-sm border-success/20 hover:shadow-card-md'
          : 'border-2 border-dashed border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/35',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn(
        'flex items-center justify-center h-9 w-9 rounded-lg transition-colors duration-200',
        hasData
          ? 'bg-success-muted text-success'
          : 'bg-muted/50 text-muted-foreground/40',
      )}>
        {hasData ? (
          <CheckCircle className="h-4.5 w-4.5" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="text-center min-w-0 w-full">
        <p className={cn(
          'text-fin-xs font-medium truncate leading-tight',
          hasData ? 'text-foreground' : 'text-muted-foreground/60',
        )}>
          {label}
        </p>
        {count !== undefined && (
          <p className={cn(
            'text-[10px] mt-0.5',
            hasData ? 'text-success font-semibold' : 'text-muted-foreground/40',
          )}>
            {count} {count !== 1 ? 'elementos' : 'elemento'}
          </p>
        )}
      </div>
    </div>
  );
}
