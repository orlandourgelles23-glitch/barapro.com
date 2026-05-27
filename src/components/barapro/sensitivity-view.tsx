'use client';

import { useMemo, useState } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  buildCashFlowInvestment,
  buildCashFlowEquity,
  findOperationStartMonth,
  calcTIR,
  calcTIRM,
  calcPR,
  calcVANWithIP,
  calcBCWithIP,
  calcVAEWithIP,
} from '@/lib/barapro-financial';
import {
  Target,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Building2,
  Landmark,
  Settings2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { cn } from '@/lib/utils'
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

// ─── Formatting helpers ────────────────────────────────────────

function formatNum(n: number): string {
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

// ─── Types ─────────────────────────────────────────────────────

type VaryParam = 'revenue' | 'costs' | 'investment' | 'exchangeRate';

// ─── Scenario multi-parameter model (same as scenarios-view.tsx) ──

interface ScenarioParams {
  revenueVariation: number;
  costVariation: number;
  investmentVariation: number;
  exchangeRateVariation: number;
}

interface ScenarioMetrics {
  van: number;
  tir: number | null;
  tirm: number | null;
  pr: number | null;
  bc: number;
  vae: number;
}

const DEFAULT_PESSIMIST: ScenarioParams = {
  revenueVariation: -20,
  costVariation: 20,
  investmentVariation: 15,
  exchangeRateVariation: 10,
};

const DEFAULT_OPTIMIST: ScenarioParams = {
  revenueVariation: 20,
  costVariation: -15,
  investmentVariation: -10,
  exchangeRateVariation: -10,
};

interface VariationResult {
  pct: number;
  van: number;
  tir: number | null;
  tirm: number | null;
  pr: number | null;
  bc: number;
  vae: number;
  viable: boolean;
  isBase?: boolean;  // true for 0% row — uses pre-calculated indicators
}

// ─── Helper: calculate indicators from annual cash flows ───────
// Uses calcVANWithIP, calcBCWithIP, calcVAEWithIP for proper
// investment period handling (t=0) per Resolución 1/2022

function calcVariationIndicators(
  annualFlows: number[],
  discountRate: number,
  tma: number,
  investmentYears: number
): Omit<VariationResult, 'pct' | 'isBase'> {
  const van = calcVANWithIP(annualFlows, discountRate, investmentYears);
  const tir = calcTIR(annualFlows);
  const tirm = calcTIRM(annualFlows, tma, tma);
  const pr = calcPR(annualFlows);
  const bc = calcBCWithIP(annualFlows, discountRate, investmentYears);
  const vae = calcVAEWithIP(annualFlows, discountRate, investmentYears);
  return {
    van,
    tir,
    tirm,
    pr,
    bc,
    vae,
    viable: van >= 0 && bc >= 1,
  };
}

// ─── Helper: apply variation to annual flows ──────────────────

function applyVariation(
  baseFlows: number[],
  varyParam: VaryParam,
  pct: number,
  investmentYears: number
): number[] {
  const factor = 1 + pct / 100;
  return baseFlows.map((flow, idx) => {
    if (varyParam === 'revenue') {
      // Revenue: affect positive flows (ingresos > 0)
      return flow > 0 ? flow * factor : flow;
    } else if (varyParam === 'costs') {
      // Costs: affect negative flows in operational period (not investment period)
      return flow < 0 && idx >= investmentYears ? flow * factor : flow;
    } else if (varyParam === 'investment') {
      // Investment: affect negative flows in investment period
      return flow < 0 && idx < investmentYears ? flow * factor : flow;
    } else {
      // exchangeRate: affect all positive flows (revenues are affected by exchange rate changes)
      return flow > 0 ? flow * factor : flow;
    }
  });
}

// ─── Helper: generate variation percentages ────────────────────

function generatePercentages(min: number, max: number, step: number): number[] {
  const pcts: number[] = [];
  for (let p = min; p <= max; p += step) {
    pcts.push(Math.round(p * 100) / 100);
  }
  // Always include 0
  if (!pcts.includes(0)) {
    pcts.push(0);
    pcts.sort((a, b) => a - b);
  }
  return pcts;
}

// ─── Multi-parameter scenario calculation (same model as scenarios-view.tsx) ──
// Applies separate variations to revenue, costs, investment, and exchange rate.
// - Revenue variation: affects positive flows (ingresos)
// - Cost variation: affects negative flows in operational period
// - Investment variation: affects negative flows in investment period
// - Exchange rate variation: affects all flows proportionally

function computeScenarioFromAnnual(
  annualFlows: number[],
  params: ScenarioParams,
  discountRate: number,
  tma: number,
  investmentYears: number
): ScenarioMetrics {
  const modifiedFlows = annualFlows.map((flow, idx) => {
    if (flow > 0) {
      return flow * (1 + params.revenueVariation / 100);
    }
    if (idx < investmentYears && flow < 0) {
      return flow * (1 + params.investmentVariation / 100);
    }
    if (flow < 0) {
      return flow * (1 + params.costVariation / 100);
    }
    return flow;
  });

  const exchangeAdjustedFlows = params.exchangeRateVariation !== 0
    ? modifiedFlows.map((f) => f * (1 + params.exchangeRateVariation / 100))
    : modifiedFlows;

  const van = calcVANWithIP(exchangeAdjustedFlows, discountRate, investmentYears);
  const tir = calcTIR(exchangeAdjustedFlows);
  const tirm = calcTIRM(exchangeAdjustedFlows, tma, tma);
  const pr = calcPR(exchangeAdjustedFlows);
  const bc = calcBCWithIP(exchangeAdjustedFlows, discountRate, investmentYears);
  const vae = calcVAEWithIP(exchangeAdjustedFlows, discountRate, investmentYears);

  return { van, tir, tirm, pr, bc, vae };
}

// ─── Main Component ────────────────────────────────────────────

export function SensitivityView() {
  const store = useBaraproStore();
  // ─── Configurable state (univariable sensitivity) ───
  const [varyParam, setVaryParam] = useState<VaryParam>('revenue');
  const [varMin, setVarMin] = useState(-30);
  const [varMax, setVarMax] = useState(30);
  const [varStep, setVarStep] = useState(10);
  const [perspectiveMode, setPerspectiveMode] = useState<'solo' | 'ambos'>('ambos');

  // ─── Configurable state (scenarios) ───
  const [pesimistParams, setPesimistParams] = useState<ScenarioParams>(DEFAULT_PESSIMIST);
  const [optimistParams, setOptimistParams] = useState<ScenarioParams>(DEFAULT_OPTIMIST);

  // ─── Parameters (whole numbers from store, divide by 100 for formulas) ───
  const tma = (store.parameters.minimumAcceptableRate || 10) / 100;
  const discountRate = (store.parameters.discountRateCUP || 14) / 100;
  const duration = store.project.monthsDuration || 120;
  const totalYears = Math.ceil(duration / 12);

  // ─── Build base cash flows from REAL CF models (same as cash flow module) ───
  const { investmentAnnualFlows, equityAnnualFlows, investmentYears, invIndicators, eqIndicators } = useMemo(() => {
    const invCF = buildCashFlowInvestment(store);
    const invMonthly = invCF.monthly.map((r) => r.saldoAnual);
    const invAnnual = monthlyToAnnual(invMonthly);

    const eqCF = buildCashFlowEquity(store);
    const eqMonthly = eqCF.monthly.map((r) => r.saldoAnual);
    const eqAnnual = monthlyToAnnual(eqMonthly);

    const opStartMonth = findOperationStartMonth(store);
    const invMonths = opStartMonth > duration ? 0 : opStartMonth - 1;
    const invYears = Math.ceil(invMonths / 12);

    return {
      investmentAnnualFlows: invAnnual,
      equityAnnualFlows: eqAnnual,
      investmentYears: invYears,
      invIndicators: invCF.indicators,
      eqIndicators: eqCF.indicators,
    };
  }, [store, duration]);

  // ─── Generate variation percentages ───
  const percentages = useMemo(
    () => generatePercentages(varMin, varMax, varStep),
    [varMin, varMax, varStep]
  );

  // ─── Compute variation rows for investment perspective (Sin Financiamiento) ───
  const investmentVariations = useMemo(() => {
    return percentages.map((pct) => {
      if (pct === 0) {
        // BASE CASE: use pre-calculated indicators from cash flow builder (fixed reference point)
        return {
          pct: 0,
          van: invIndicators.van,
          tir: invIndicators.tir,
          tirm: calcTIRM(investmentAnnualFlows, tma, tma),
          pr: invIndicators.pr,
          bc: calcBCWithIP(investmentAnnualFlows, discountRate, investmentYears),
          vae: calcVAEWithIP(investmentAnnualFlows, discountRate, investmentYears),
          viable: invIndicators.van >= 0,
          isBase: true,
        } as VariationResult;
      }
      const modified = applyVariation(investmentAnnualFlows, varyParam, pct, investmentYears);
      const result = calcVariationIndicators(modified, discountRate, tma, investmentYears);
      return { pct, ...result };
    });
  }, [investmentAnnualFlows, varyParam, percentages, discountRate, tma, investmentYears, invIndicators]);

  // ─── Compute variation rows for equity perspective (Con Financiamiento) ───
  const equityVariations = useMemo(() => {
    return percentages.map((pct) => {
      if (pct === 0) {
        // BASE CASE: use pre-calculated indicators from cash flow builder
        return {
          pct: 0,
          van: eqIndicators.van,
          tir: eqIndicators.tir,
          tirm: calcTIRM(equityAnnualFlows, tma, tma),
          pr: eqIndicators.pr,
          bc: calcBCWithIP(equityAnnualFlows, discountRate, investmentYears),
          vae: calcVAEWithIP(equityAnnualFlows, discountRate, investmentYears),
          viable: eqIndicators.van >= 0,
          isBase: true,
        } as VariationResult;
      }
      const modified = applyVariation(equityAnnualFlows, varyParam, pct, investmentYears);
      const result = calcVariationIndicators(modified, discountRate, tma, investmentYears);
      return { pct, ...result };
    });
  }, [equityAnnualFlows, varyParam, percentages, discountRate, tma, investmentYears, eqIndicators]);

  // ─── Param label ───
  const paramLabel = varyParam === 'revenue'
    ? 'Ingresos'
    : varyParam === 'costs'
      ? 'Costos'
      : varyParam === 'investment'
        ? 'Inversión'
        : 'Tipo de Cambio';

  // ─── Parameter buttons ───
  const paramButtons: { key: VaryParam; label: string }[] = [
    { key: 'revenue', label: 'Ingresos' },
    { key: 'costs', label: 'Costos' },
    { key: 'investment', label: 'Inversión' },
    { key: 'exchangeRate', label: 'Tipo de Cambio' },
  ];

  // ── Export data: Univariate sensitivity (investment) ──
  const investmentSensitivityExport = useMemo(() => {
    const headers = [`Variación ${paramLabel}`, 'VAN', 'TIR', 'TIRM', 'PR', 'B/C', 'VAE', 'Estado'];
    const rows: TableExportRow[] = investmentVariations.map((v) => ({
      cells: [
        `${v.pct > 0 ? '+' : ''}${v.pct}%${v.isBase ? ' (Base)' : ''}`,
        formatNum(v.van),
        v.tir !== null ? formatPct(v.tir) : 'N/D',
        v.tirm !== null ? formatPct(v.tirm) : 'N/D',
        v.pr !== null ? `${v.pr.toFixed(1)}a` : 'N/D',
        v.bc === Infinity ? '\u221E' : v.bc.toFixed(3),
        formatNum(v.vae),
        v.viable ? 'Viable' : 'No viable',
      ],
      bold: !!v.isBase,
    }));
    return { headers, rows };
  }, [investmentVariations, paramLabel]);

  // ── Export data: Univariate sensitivity (equity) ──
  const equitySensitivityExport = useMemo(() => {
    const headers = [`Variación ${paramLabel}`, 'VAN', 'TIR', 'TIRM', 'PR', 'B/C', 'VAE', 'Estado'];
    const rows: TableExportRow[] = equityVariations.map((v) => ({
      cells: [
        `${v.pct > 0 ? '+' : ''}${v.pct}%${v.isBase ? ' (Base)' : ''}`,
        formatNum(v.van),
        v.tir !== null ? formatPct(v.tir) : 'N/D',
        v.tirm !== null ? formatPct(v.tirm) : 'N/D',
        v.pr !== null ? `${v.pr.toFixed(1)}a` : 'N/D',
        v.bc === Infinity ? '\u221E' : v.bc.toFixed(3),
        formatNum(v.vae),
        v.viable ? 'Viable' : 'No viable',
      ],
      bold: !!v.isBase,
    }));
    return { headers, rows };
  }, [equityVariations, paramLabel]);

  // ─── Scenarios (multi-parameter model, base = pre-calculated from cash flow builders) ───
  // Base scenario: indicadores pre-calculados del Flujo de Caja (mismos que R7 y R13)
  // Pesimista/Optimista: computeScenarioFromAnnual con variaciones independientes
  const scenarios = useMemo(() => {
    const invScenBase: ScenarioMetrics = {
      van: invIndicators.van,
      tir: invIndicators.tir,
      tirm: calcTIRM(investmentAnnualFlows, tma, tma),
      pr: invIndicators.pr,
      bc: calcBCWithIP(investmentAnnualFlows, discountRate, investmentYears),
      vae: calcVAEWithIP(investmentAnnualFlows, discountRate, investmentYears),
    };
    const eqScenBase: ScenarioMetrics = {
      van: eqIndicators.van,
      tir: eqIndicators.tir,
      tirm: calcTIRM(equityAnnualFlows, tma, tma),
      pr: eqIndicators.pr,
      bc: calcBCWithIP(equityAnnualFlows, discountRate, investmentYears),
      vae: calcVAEWithIP(equityAnnualFlows, discountRate, investmentYears),
    };

    return {
      investment: {
        pesimista: computeScenarioFromAnnual(investmentAnnualFlows, pesimistParams, discountRate, tma, investmentYears),
        base: invScenBase,
        optimista: computeScenarioFromAnnual(investmentAnnualFlows, optimistParams, discountRate, tma, investmentYears),
      },
      equity: {
        pesimista: computeScenarioFromAnnual(equityAnnualFlows, pesimistParams, discountRate, tma, investmentYears),
        base: eqScenBase,
        optimista: computeScenarioFromAnnual(equityAnnualFlows, optimistParams, discountRate, tma, investmentYears),
      },
    };
  }, [investmentAnnualFlows, equityAnnualFlows, pesimistParams, optimistParams, discountRate, tma, investmentYears, invIndicators, eqIndicators]);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <ModuleHeader
        title="Análisis de Sensibilidad"
        description="Evaluación del impacto de variaciones univariables sobre los indicadores del proyecto. Base fija: Flujo de Caja (Resolución 1/2022)."
        icon={BarChart3}
        variant="info"
        actions={
          <div className="flex items-center gap-2 text-fin-xs">
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

      <Tabs defaultValue="univariate">
        <TabsList>
          <TabsTrigger value="univariate" className="focus-ring transition-all duration-200">{'Sensibilidad Univariable'}</TabsTrigger>
          <TabsTrigger value="scenarios" className="focus-ring transition-all duration-200">{'Escenarios'}</TabsTrigger>
        </TabsList>

        <TabsContent value="univariate">
          <div className="space-y-4 animate-slide-up">
      <Card className="glass-card shadow-card-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-info" />
            <span className="text-fin-sm font-semibold">{'Configuración'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Variable to analyze */}
            <div className="space-y-1.5">
              <Label className="text-fin-sm">{'Parámetro a variar'}</Label>
              <div className="flex flex-wrap gap-1.5">
                {paramButtons.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setVaryParam(p.key)}
                    className={cn(
                      'px-2.5 py-1 text-fin-xs rounded-md border transition-colors',
                      varyParam === p.key
                        ? 'bg-success text-primary-foreground border-success'
                        : 'bg-background border-border/50 hover:bg-muted focus-ring transition-all duration-200'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min variation */}
            <div className="space-y-1.5">
              <Label className="text-fin-sm">{'Variación mín'} (%)</Label>
              <Input
                type="number"
                value={varMin}
                onChange={(e) => setVarMin(Number(e.target.value))}
                className="h-8 text-fin-xs focus-ring transition-all duration-200"
              />
            </div>

            {/* Max variation */}
            <div className="space-y-1.5">
              <Label className="text-fin-sm">{'Variación máx'} (%)</Label>
              <Input
                type="number"
                value={varMax}
                onChange={(e) => setVarMax(Number(e.target.value))}
                className="h-8 text-fin-xs focus-ring transition-all duration-200"
              />
            </div>

            {/* Step */}
            <div className="space-y-1.5">
              <Label className="text-fin-sm">{'Paso'} (%)</Label>
              <Input
                type="number"
                value={varStep}
                onChange={(e) => setVarStep(Number(e.target.value))}
                className="h-8 text-fin-xs focus-ring transition-all duration-200"
                min={1}
              />
            </div>

            {/* Perspective toggle */}
            <div className="space-y-1.5">
              <Label className="text-fin-sm text-muted-foreground">{'Perspectiva'}</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPerspectiveMode('ambos')}
                  className={cn(
                    'px-3 py-1 text-fin-xs rounded-md border transition-colors whitespace-nowrap',
                    perspectiveMode === 'ambos'
                      ? 'bg-success text-primary-foreground border-success'
                      : 'bg-background border-border/50 hover:bg-muted focus-ring transition-all duration-200'
                  )}
                >
                  {'Ambos'}
                </button>
                <button
                  onClick={() => setPerspectiveMode('solo')}
                  className={cn(
                    'px-3 py-1 text-fin-xs rounded-md border transition-colors whitespace-nowrap',
                    perspectiveMode === 'solo'
                      ? 'bg-success text-primary-foreground border-success'
                      : 'bg-background border-border/50 hover:bg-muted focus-ring transition-all duration-200'
                  )}
                >
                  {'Solo Inversión'}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variation Results Tables */}
      {perspectiveMode === 'ambos' ? (
        /* Dual side-by-side tables */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: Sin Financiamiento */}
          <Card className="glass-card shadow-card-sm rounded-xl border-t-4 border-t-success">
            <CardHeader className="pb-2 bg-gradient-to-r from-success-muted to-transparent -mt-6 pt-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-success" />
                  {'Sin Financiamiento (CF Inversión)'}
                </CardTitle>
                <TableExportButton
                  moduleName="Sensibilidad Univariable"
                  tableName="Sin Financiamiento"
                  headers={investmentSensitivityExport.headers}
                  rows={investmentSensitivityExport.rows}
                  landscape
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="fin-col-header">{`Variación ${paramLabel}`}</TableHead>
                      <TableHead className="fin-col-header text-right">VAN</TableHead>
                      <TableHead className="fin-col-header text-right">TIR</TableHead>
                      <TableHead className="fin-col-header text-right">TIRM</TableHead>
                      <TableHead className="fin-col-header text-right">PR</TableHead>
                      <TableHead className="fin-col-header text-right">B/C</TableHead>
                      <TableHead className="fin-col-header text-right">VAE</TableHead>
                      <TableHead className="fin-col-header">{'Estado'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investmentVariations.map((v) => (
                      <TableRow key={v.pct} className={cn(v.isBase ? 'font-semibold bg-success-muted/30' : '', 'fin-row-hover')}>
                        <TableCell className="text-fin-sm font-semibold">
                          {v.pct > 0 ? '+' : ''}{v.pct}%
                          {v.isBase && <span className="ml-1.5 text-fin-xs text-success">(Base)</span>}
                        </TableCell>
                        <TableCell className={cn('text-fin-sm text-right font-mono', v.van >= 0 ? 'text-success' : 'text-danger')}>
                          {formatNum(v.van)}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.tir !== null ? formatPct(v.tir) : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.tirm !== null ? formatPct(v.tirm) : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.pr !== null ? `${v.pr.toFixed(1)}a` : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.bc === Infinity ? '\u221E' : v.bc.toFixed(3)}
                        </TableCell>
                        <TableCell className={cn('text-fin-sm text-right font-mono', v.vae >= 0 ? 'text-success' : 'text-danger')}>
                          {formatNum(v.vae)}
                        </TableCell>
                        <TableCell className="text-fin-sm">
                          {v.viable ? (
                            <Badge className="bg-success-muted text-success text-fin-xs hover:bg-success-muted">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                              {'Viable'}
                            </Badge>
                          ) : (
                            <Badge className="bg-danger-muted text-danger text-fin-xs hover:bg-danger-muted">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              {'No viable'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>

          {/* Right: Con Financiamiento */}
          <Card className="glass-card shadow-card-sm rounded-xl border-t-4 border-t-panel-b">
            <CardHeader className="pb-2 bg-gradient-to-r from-panel-b-muted to-transparent -mt-6 pt-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-panel-b" />
                  {'Con Financiamiento (CF Capital Social)'}
                </CardTitle>
                <TableExportButton
                  moduleName="Sensibilidad Univariable"
                  tableName="Con Financiamiento"
                  headers={equitySensitivityExport.headers}
                  rows={equitySensitivityExport.rows}
                  landscape
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="fin-col-header">{`Variación ${paramLabel}`}</TableHead>
                      <TableHead className="fin-col-header text-right">VAN</TableHead>
                      <TableHead className="fin-col-header text-right">TIR</TableHead>
                      <TableHead className="fin-col-header text-right">TIRM</TableHead>
                      <TableHead className="fin-col-header text-right">PR</TableHead>
                      <TableHead className="fin-col-header text-right">B/C</TableHead>
                      <TableHead className="fin-col-header text-right">VAE</TableHead>
                      <TableHead className="fin-col-header">{'Estado'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equityVariations.map((v) => (
                      <TableRow key={v.pct} className={cn(v.isBase ? 'font-semibold bg-panel-b-muted/30' : '', 'fin-row-hover')}>
                        <TableCell className="text-fin-sm font-semibold">
                          {v.pct > 0 ? '+' : ''}{v.pct}%
                          {v.isBase && <span className="ml-1.5 text-fin-xs text-panel-b">(Base)</span>}
                        </TableCell>
                        <TableCell className={cn('text-fin-sm text-right font-mono', v.van >= 0 ? 'text-panel-b' : 'text-danger')}>
                          {formatNum(v.van)}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.tir !== null ? formatPct(v.tir) : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.tirm !== null ? formatPct(v.tirm) : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.pr !== null ? `${v.pr.toFixed(1)}a` : 'N/D'}
                        </TableCell>
                        <TableCell className="text-fin-sm text-right font-mono">
                          {v.bc === Infinity ? '\u221E' : v.bc.toFixed(3)}
                        </TableCell>
                        <TableCell className={cn('text-fin-sm text-right font-mono', v.vae >= 0 ? 'text-panel-b' : 'text-danger')}>
                          {formatNum(v.vae)}
                        </TableCell>
                        <TableCell className="text-fin-sm">
                          {v.viable ? (
                            <Badge className="bg-panel-b-muted text-panel-b text-fin-xs hover:bg-panel-b-muted">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                              {'Viable'}
                            </Badge>
                          ) : (
                            <Badge className="bg-danger-muted text-danger text-fin-xs hover:bg-danger-muted">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              {'No viable'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Single table (Solo Inversión) */
        <Card className="glass-card shadow-card-sm rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-fin-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-success" />
                {'Sin Financiamiento (CF Inversión)'}
              </CardTitle>
              <TableExportButton
                moduleName="Sensibilidad Univariable"
                tableName="Sin Financiamiento"
                headers={investmentSensitivityExport.headers}
                rows={investmentSensitivityExport.rows}
                landscape
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollableTable maxHeight="400px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="fin-col-header">{`Variación ${paramLabel}`}</TableHead>
                    <TableHead className="fin-col-header text-right">VAN</TableHead>
                    <TableHead className="fin-col-header text-right">TIR</TableHead>
                    <TableHead className="fin-col-header text-right">TIRM</TableHead>
                    <TableHead className="fin-col-header text-right">PR</TableHead>
                    <TableHead className="fin-col-header text-right">B/C</TableHead>
                    <TableHead className="fin-col-header text-right">VAE</TableHead>
                    <TableHead className="fin-col-header">{'Estado'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investmentVariations.map((v) => (
                    <TableRow key={v.pct} className={cn(v.isBase ? 'font-semibold bg-success-muted/30' : '', 'fin-row-hover')}>
                      <TableCell className="text-fin-sm font-semibold">
                        {v.pct > 0 ? '+' : ''}{v.pct}%
                        {v.isBase && <span className="ml-1.5 text-fin-xs text-success">(Base)</span>}
                      </TableCell>
                      <TableCell className={cn('text-fin-sm text-right font-mono', v.van >= 0 ? 'text-success' : 'text-danger')}>
                        {formatNum(v.van)}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right font-mono">
                        {v.tir !== null ? formatPct(v.tir) : 'N/D'}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right font-mono">
                        {v.tirm !== null ? formatPct(v.tirm) : 'N/D'}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right font-mono">
                        {v.pr !== null ? `${v.pr.toFixed(1)}a` : 'N/D'}
                      </TableCell>
                      <TableCell className="text-fin-sm text-right font-mono">
                        {v.bc === Infinity ? '\u221E' : v.bc.toFixed(3)}
                      </TableCell>
                      <TableCell className={cn('text-fin-sm text-right font-mono', v.vae >= 0 ? 'text-success' : 'text-danger')}>
                        {formatNum(v.vae)}
                      </TableCell>
                      <TableCell className="text-fin-sm">
                        {v.viable ? (
                          <Badge className="bg-success-muted text-success text-fin-xs hover:bg-success-muted">
                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                            {'Viable'}
                          </Badge>
                        ) : (
                          <Badge className="bg-danger-muted text-danger text-fin-xs hover:bg-danger-muted">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            {'No viable'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          </CardContent>
        </Card>
      )}

          {/* Note about base reference */}
          <Card className="glass-card shadow-card-sm rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-start gap-2 text-fin-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
                <p>
                  <strong>Punto de partida fijo:</strong> La fila 0% (Base) utiliza los indicadores pre-calculados del módulo Flujo de Caja
                  ({'buildCashFlowInvestment / buildCashFlowEquity'}) conforme a la Resolución 1/2022. Las variaciones aplican factores
                  sobre los flujos anuales y recalculan indicadores con <strong>TD: {store.parameters.discountRateCUP}%</strong> y
                  período de inversión en t=0 ({investmentYears} {'año'}{investmentYears !== 1 ? 's' : ''}).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            ESCENARIOS TAB — Multi-parameter scenario analysis
            Base = pre-calculated indicators from cash flow builders
            (same as Flujo de Caja R7 and Indicadores R13)
            ═══════════════════════════════════════════════════════ */}
        <TabsContent value="scenarios">
          <div className="space-y-4 animate-slide-up">
            {/* Parameter configuration cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pesimista parameters */}
              <Card className="glass-card shadow-card-sm rounded-xl border-danger">
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm text-danger flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {'Parámetros Pesimista'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScenarioParamSlider
                    label={'Variación de Ingresos'}
                    value={pesimistParams.revenueVariation}
                    onChange={(v) => setPesimistParams((p) => ({ ...p, revenueVariation: v }))}
                    color="red"
                  />
                  <ScenarioParamSlider
                    label={'Variación de Costos'}
                    value={pesimistParams.costVariation}
                    onChange={(v) => setPesimistParams((p) => ({ ...p, costVariation: v }))}
                    color="red"
                  />
                  <ScenarioParamSlider
                    label={'Variación de Inversión'}
                    value={pesimistParams.investmentVariation}
                    onChange={(v) => setPesimistParams((p) => ({ ...p, investmentVariation: v }))}
                    color="red"
                  />
                  <ScenarioParamSlider
                    label={'Variación Tasa de Cambio'}
                    value={pesimistParams.exchangeRateVariation}
                    onChange={(v) => setPesimistParams((p) => ({ ...p, exchangeRateVariation: v }))}
                    color="red"
                  />
                  <button
                    onClick={() => setPesimistParams(DEFAULT_PESSIMIST)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-fin-xs rounded-md border border-danger/50 text-danger hover:bg-danger-muted focus-ring transition-all duration-200 w-fit"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {'Restablecer'}</button>
                </CardContent>
              </Card>

              {/* Optimista parameters */}
              <Card className="glass-card shadow-card-sm rounded-xl border-success">
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm text-success flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {'Parámetros Optimista'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScenarioParamSlider
                    label={'Variación de Ingresos'}
                    value={optimistParams.revenueVariation}
                    onChange={(v) => setOptimistParams((p) => ({ ...p, revenueVariation: v }))}
                    color="green"
                  />
                  <ScenarioParamSlider
                    label={'Variación de Costos'}
                    value={optimistParams.costVariation}
                    onChange={(v) => setOptimistParams((p) => ({ ...p, costVariation: v }))}
                    color="green"
                  />
                  <ScenarioParamSlider
                    label={'Variación de Inversión'}
                    value={optimistParams.investmentVariation}
                    onChange={(v) => setOptimistParams((p) => ({ ...p, investmentVariation: v }))}
                    color="green"
                  />
                  <ScenarioParamSlider
                    label={'Variación Tasa de Cambio'}
                    value={optimistParams.exchangeRateVariation}
                    onChange={(v) => setOptimistParams((p) => ({ ...p, exchangeRateVariation: v }))}
                    color="green"
                  />
                  <button
                    onClick={() => setOptimistParams(DEFAULT_OPTIMIST)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-fin-xs rounded-md border border-success/50 text-success hover:bg-success-muted focus-ring transition-all duration-200 w-fit"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {'Restablecer'}</button>
                </CardContent>
              </Card>
            </div>

            {/* Scenario result cards — Sin Financiamiento */}
            {perspectiveMode === 'ambos' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-success" />
                  <span className="text-fin-sm font-semibold text-success">{'Sin Financiamiento (CF Inversión)'}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScenarioResultCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    title={'Pesimista'}
                    badges={pesimistParams}
                    metrics={scenarios.investment.pesimista}
                    tma={tma}
                    borderClass="border-danger bg-danger-muted/20"
                    titleClass="text-danger"
                    accentColor="red"
                  />
                  <ScenarioResultCard
                    icon={<Target className="h-4 w-4" />}
                    title={'Base'}
                    badges={null}
                    metrics={scenarios.investment.base}
                    tma={tma}
                    borderClass="border-emerald-300 bg-success-muted/40"
                    titleClass="text-success"
                    accentColor="emerald"
                    isBase
                  />
                  <ScenarioResultCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    title={'Optimista'}
                    badges={optimistParams}
                    metrics={scenarios.investment.optimista}
                    tma={tma}
                    borderClass="border-emerald-400 bg-success-muted/20"
                    titleClass="text-success"
                    accentColor="emerald"
                  />
                </div>
              </div>
            )}

            {/* Scenario result cards — Con Financiamiento (or Solo Inversión) */}
            <div>
              {perspectiveMode === 'ambos' && (
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-4 w-4 text-panel-b" />
                  <span className="text-fin-sm font-semibold text-panel-b">{'Con Financiamiento (CF Capital Social)'}</span>
                </div>
              )}
              {perspectiveMode === 'solo' && (
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-success" />
                  <span className="text-fin-sm font-semibold text-success">{'Sin Financiamiento (CF Inversión)'}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScenarioResultCard
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title={'Pesimista'}
                  badges={pesimistParams}
                  metrics={(perspectiveMode === 'solo' ? scenarios.investment : scenarios.equity).pesimista}
                  tma={tma}
                  borderClass="border-danger bg-danger-muted/20"
                  titleClass="text-danger"
                  accentColor="red"
                />
                <ScenarioResultCard
                  icon={<Target className="h-4 w-4" />}
                  title={'Base'}
                  badges={null}
                  metrics={(perspectiveMode === 'solo' ? scenarios.investment : scenarios.equity).base}
                  tma={tma}
                  borderClass={perspectiveMode === 'solo' ? 'border-emerald-300 bg-success-muted/40' : 'border-panel-b bg-panel-b-muted/40'}
                  titleClass={perspectiveMode === 'solo' ? 'text-success' : 'text-panel-b'}
                  accentColor={perspectiveMode === 'solo' ? 'emerald' : 'violet'}
                  isBase
                />
                <ScenarioResultCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  title={'Optimista'}
                  badges={optimistParams}
                  metrics={(perspectiveMode === 'solo' ? scenarios.investment : scenarios.equity).optimista}
                  tma={tma}
                  borderClass={perspectiveMode === 'solo' ? 'border-emerald-400 bg-success-muted/20' : 'border-panel-b bg-panel-b-muted/20'}
                  titleClass={perspectiveMode === 'solo' ? 'text-success' : 'text-panel-b'}
                  accentColor={perspectiveMode === 'solo' ? 'emerald' : 'violet'}
                />
              </div>
            </div>

            {/* Comparison table — Sin Financiamiento */}
            {perspectiveMode === 'ambos' && (
              <Card className="glass-card shadow-card-sm rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-success" />
                    {'Tabla Comparativa — Sin Financiamiento'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScenarioComparisonTable scenarios={scenarios.investment} tma={tma} accentColor="emerald" />
                </CardContent>
              </Card>
            )}

            {/* Comparison table — Con Financiamiento or Solo Inversión */}
            <Card className="glass-card shadow-card-sm rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-fin-sm flex items-center gap-2">
                  {perspectiveMode === 'solo'
                    ? <Building2 className="h-4 w-4 text-success" />
                    : <Landmark className="h-4 w-4 text-panel-b" />}
                  {perspectiveMode === 'solo'
                    ? 'Tabla Comparativa — Sin Financiamiento'
                    : 'Tabla Comparativa — Con Financiamiento'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScenarioComparisonTable
                  scenarios={perspectiveMode === 'solo' ? scenarios.investment : scenarios.equity}
                  tma={tma}
                  accentColor={perspectiveMode === 'solo' ? 'emerald' : 'violet'}
                />
              </CardContent>
            </Card>

            {/* Note about base reference */}
            <Card className="glass-card shadow-card-sm rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-start gap-2 text-fin-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
                  <p>
                    <strong>Escenario Base fijo:</strong> Los indicadores del escenario Base (VAN, TIR, PR)
                    provienen directamente de {'buildCashFlowInvestment / buildCashFlowEquity'} — los mismos valores
                    que muestra el módulo Flujo de Caja (R7). Los escenarios Pesimista y Optimista aplican
                    variaciones independientes sobre ingresos, costos, inversión y tipo de cambio a los flujos anuales,
                    recalculando indicadores con <strong>TD: {store.parameters.discountRateCUP}%</strong> y
                    <strong>TMA: {store.parameters.minimumAcceptableRate}%</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Scenario Parameter Slider ─────────────────────────────────

function ScenarioParamSlider({ label, value, onChange, color }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color: 'red' | 'green';
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-fin-sm">{label}</Label>
        <span className={cn('text-fin-xs font-mono font-semibold', color === 'red' ? 'text-danger' : 'text-success')}>
          {value > 0 ? '+' : ''}{value}%
        </span>
      </div>
      <input
        type="range"
        min={-50}
        max={50}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'w-full h-1.5 cursor-pointer focus-ring transition-all duration-200',
          color === 'red' ? 'accent-red-600' : 'accent-green-700'
        )}
      />
      <div className="flex justify-between text-fin-xs text-muted-foreground/50">
        <span>-50%</span>
        <span>0%</span>
        <span>+50%</span>
      </div>
    </div>
  );
}

// ─── Scenario Result Card ───────────────────────────────────────

function ScenarioResultCard({
  icon, title, badges, metrics, tma, borderClass, titleClass, accentColor, isBase,
}: {
  icon: React.ReactNode;
  title: string;
  badges: ScenarioParams | null;
  metrics: ScenarioMetrics;
  tma: number;
  borderClass: string;
  titleClass: string;
  accentColor: 'red' | 'emerald' | 'violet';
  isBase?: boolean;
}) {
  const badgeColor = accentColor === 'violet' ? 'border-panel-b text-panel-b' : accentColor === 'red' ? 'border-red-300 text-danger' : 'border-green-300 text-success';

  return (
    <Card className={cn(borderClass, 'glass-card shadow-card-sm rounded-xl')}>
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-fin-sm flex items-center gap-2', titleClass)}>
          {icon}
          {title}
        </CardTitle>
        {badges && (
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className={cn('text-fin-xs', badgeColor)}>
              {'Rev.'} {badges.revenueVariation > 0 ? '+' : ''}{badges.revenueVariation}%
            </Badge>
            <Badge variant="outline" className={cn('text-fin-xs', badgeColor)}>
              {'Cost.'} {badges.costVariation > 0 ? '+' : ''}{badges.costVariation}%
            </Badge>
            <Badge variant="outline" className={cn('text-fin-xs', badgeColor)}>
              {'Inv.'} {badges.investmentVariation > 0 ? '+' : ''}{badges.investmentVariation}%
            </Badge>
            <Badge variant="outline" className={cn('text-fin-xs', badgeColor)}>
              {'TC.'} {badges.exchangeRateVariation > 0 ? '+' : ''}{badges.exchangeRateVariation}%
            </Badge>
          </div>
        )}
        {isBase && (
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-fin-xs border-muted-foreground text-muted-foreground">
              {'Todos 0% (sin variación)'}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <ScenarioMetricRow label="VAN" value={formatNum(metrics.van)} positive={metrics.van >= 0} accentColor={accentColor} />
        <ScenarioMetricRow label="TIR" value={metrics.tir !== null ? formatPct(metrics.tir) : 'N/D'} positive={metrics.tir !== null && metrics.tir > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} accentColor={accentColor} />
        <ScenarioMetricRow label="TIRM" value={metrics.tirm !== null ? formatPct(metrics.tirm) : 'N/D'} positive={metrics.tirm !== null && metrics.tirm > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} accentColor={accentColor} />
        <ScenarioMetricRow label="PR" value={metrics.pr !== null ? `${metrics.pr.toFixed(1)}a` : 'N/D'} positive={metrics.pr !== null} accentColor={accentColor} />
        <ScenarioMetricRow label="B/C" value={metrics.bc === Infinity ? '\u221E' : metrics.bc.toFixed(3)} positive={metrics.bc >= 1} accentColor={accentColor} />
        <ScenarioMetricRow label="VAE" value={formatNum(metrics.vae)} positive={metrics.vae >= 0} accentColor={accentColor} />
      </CardContent>
    </Card>
  );
}

function ScenarioMetricRow({ label, value, positive, reference, accentColor = 'emerald' }: {
  label: string;
  value: string;
  positive: boolean;
  reference?: string;
  accentColor?: 'red' | 'emerald' | 'violet';
}) {
  const valueClass = positive
    ? accentColor === 'violet' ? 'text-panel-b' : 'text-success'
    : 'text-danger';

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-fin-xs text-muted-foreground">{label}</span>
        {reference && (
          <p className="text-fin-xs text-muted-foreground/60">{reference}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('text-fin-sm font-semibold font-mono', valueClass)}>{value}</span>
        {positive ? (
          <CheckCircle className="h-3 w-3 text-success shrink-0" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-danger shrink-0" />
        )}
      </div>
    </div>
  );
}

// ─── Scenario Comparison Table ──────────────────────────────────

function ScenarioComparisonTable({
  scenarios, tma, accentColor,
}: {
  scenarios: { pesimista: ScenarioMetrics; base: ScenarioMetrics; optimista: ScenarioMetrics };
  tma: number;
  accentColor: 'emerald' | 'violet';
}) {
  const successClass = accentColor === 'violet' ? 'text-panel-b' : 'text-success';

  return (
    <ScrollableTable stickyColumns={1}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="fin-col-header">{'Indicador'}</TableHead>
            <TableHead className="fin-col-header text-center"><span className="text-danger">{'Pesimista'}</span></TableHead>
            <TableHead className="text-center px-2"><ArrowRight className="h-3 w-3 inline-block" /></TableHead>
            <TableHead className="fin-col-header text-center"><span className={successClass}>{'Base'}</span></TableHead>
            <TableHead className="text-center px-2"><ArrowRight className="h-3 w-3 inline-block" /></TableHead>
            <TableHead className="fin-col-header text-center"><span className={successClass}>{'Optimista'}</span></TableHead>
            <TableHead className="fin-col-header text-center">{'Rango'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <CompRow label="VAN" p={scenarios.pesimista.van} b={scenarios.base.van} o={scenarios.optimista.van} fmt={(v) => formatNum(v ?? 0)} favorable={(v) => (v ?? 0) > 0} />
          <CompRow label="TIR" p={scenarios.pesimista.tir} b={scenarios.base.tir} o={scenarios.optimista.tir} fmt={(v) => v !== null ? formatPct(v) : 'N/D'} favorable={(v) => v !== null && v > tma} />
          <CompRow label="TIRM" p={scenarios.pesimista.tirm} b={scenarios.base.tirm} o={scenarios.optimista.tirm} fmt={(v) => v !== null ? formatPct(v) : 'N/D'} favorable={(v) => v !== null && v > tma} />
          <CompRow label="PR" p={scenarios.pesimista.pr} b={scenarios.base.pr} o={scenarios.optimista.pr} fmt={(v) => v !== null ? `${v.toFixed(1)}a` : 'N/D'} favorable={() => true} />
          <CompRow label="B/C" p={scenarios.pesimista.bc} b={scenarios.base.bc} o={scenarios.optimista.bc} fmt={(v) => (v ?? 0) === Infinity ? '\u221E' : (v ?? 0).toFixed(3)} favorable={(v) => (v ?? 0) > 1} />
          <CompRow label="VAE" p={scenarios.pesimista.vae} b={scenarios.base.vae} o={scenarios.optimista.vae} fmt={(v) => formatNum(v ?? 0)} favorable={(v) => (v ?? 0) > 0} />
        </TableBody>
      </Table>
    </ScrollableTable>
  );
}

function CompRow({ label, p, b, o, fmt, favorable }: {
  label: string;
  p: number | null;
  b: number | null;
  o: number | null;
  fmt: (v: number | null) => string;
  favorable: (v: number | null) => boolean;
}) {
  return (
    <TableRow className="fin-row-hover">
      <TableCell className="text-fin-sm font-medium">{label}</TableCell>
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(p) ? 'text-success' : 'text-danger')}>{fmt(p)}</TableCell>
      <TableCell />
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(b) ? 'text-success' : 'text-danger')}>{fmt(b)}</TableCell>
      <TableCell />
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(o) ? 'text-success' : 'text-danger')}>{fmt(o)}</TableCell>
      <TableCell className="text-fin-sm text-center text-muted-foreground font-mono tabular-nums">{fmt(p)} {'→'} {fmt(o)}</TableCell>
    </TableRow>
  );
}
