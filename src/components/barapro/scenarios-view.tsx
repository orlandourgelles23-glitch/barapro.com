'use client';

import { useMemo, useState } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  AlertTriangle,
  Target,
  TrendingUp,
  Settings2,
  ArrowRight,
  Building2,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils'
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';
import { ScrollableTable } from '@/components/barapro/scrollable-table';

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
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
  eav: number;
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

/**
 * Compute scenario metrics from ANNUAL cash flows with proper investment period handling.
 * Uses calcVANWithIP, calcBCWithIP, calcVAEWithIP for correct t=0 treatment.
 * Uses discountRateCUP for consistency with cash flow builder indicators.
 */
function computeScenarioFromAnnual(
  annualFlows: number[],
  params: ScenarioParams,
  discountRate: number,
  tma: number,
  investmentMonths: number,
): ScenarioMetrics {
  const investmentYears = Math.ceil(investmentMonths / 12);

  // Apply variations to annual flows
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
  const eav = calcVAEWithIP(exchangeAdjustedFlows, discountRate, investmentYears);

  return { van, tir, tirm, pr, bc, eav };
}

export function ScenariosView() {
  const store = useBaraproStore();
  const tma = store.parameters.minimumAcceptableRate / 100;
  const discountRate = store.parameters.discountRateCUP / 100;
  const duration = store.project.monthsDuration || 120;

  const [pesimistParams, setPesimistParams] = useState<ScenarioParams>(DEFAULT_PESSIMIST);
  const [optimistParams, setOptimistParams] = useState<ScenarioParams>(DEFAULT_OPTIMIST);

  // ─── Build annual cash flows from REAL CF models ───
  const { investmentAnnualFlows, equityAnnualFlows, investmentMonths, baseInvIndicators, baseEqIndicators } = useMemo(() => {
    // CF Inversión: sin financiamiento (proyecto puro)
    const invCF = buildCashFlowInvestment(store);
    const invMonthly = invCF.monthly.map((r) => r.saldoAnual);
    const invAnnual = monthlyToAnnual(invMonthly);

    // CF Capital Social: con financiamiento (perspectiva del inversionista)
    const eqCF = buildCashFlowEquity(store);
    const eqMonthly = eqCF.monthly.map((r) => r.saldoAnual);
    const eqAnnual = monthlyToAnnual(eqMonthly);

    // Determinar período de inversión real
    const opStartMonth = findOperationStartMonth(store);
    const invMonths = opStartMonth > duration ? 0 : opStartMonth - 1;

    return {
      investmentAnnualFlows: invAnnual,
      equityAnnualFlows: eqAnnual,
      investmentMonths: invMonths,
      baseInvIndicators: invCF.indicators,
      baseEqIndicators: eqCF.indicators,
    };
  }, [store, duration]);

  // ─── Compute scenarios for both perspectives ───
  // Base scenario: indicadores pre-calculados del Flujo de Caja (garantiza consistencia)
  const investmentScenarios = useMemo(() => {
    return {
      pesimista: computeScenarioFromAnnual(investmentAnnualFlows, pesimistParams, discountRate, tma, investmentMonths),
      base: {
        van: baseInvIndicators.van,
        tir: baseInvIndicators.tir,
        tirm: calcTIRM(investmentAnnualFlows, tma, tma),
        pr: baseInvIndicators.pr,
        bc: calcBCWithIP(investmentAnnualFlows, discountRate, Math.ceil(investmentMonths / 12)),
        eav: calcVAEWithIP(investmentAnnualFlows, discountRate, Math.ceil(investmentMonths / 12)),
      },
      optimista: computeScenarioFromAnnual(investmentAnnualFlows, optimistParams, discountRate, tma, investmentMonths),
    };
  }, [investmentAnnualFlows, pesimistParams, optimistParams, discountRate, tma, investmentMonths, baseInvIndicators]);

  const equityScenarios = useMemo(() => {
    return {
      pesimista: computeScenarioFromAnnual(equityAnnualFlows, pesimistParams, discountRate, tma, investmentMonths),
      base: {
        van: baseEqIndicators.van,
        tir: baseEqIndicators.tir,
        tirm: calcTIRM(equityAnnualFlows, tma, tma),
        pr: baseEqIndicators.pr,
        bc: calcBCWithIP(equityAnnualFlows, discountRate, Math.ceil(investmentMonths / 12)),
        eav: calcVAEWithIP(equityAnnualFlows, discountRate, Math.ceil(investmentMonths / 12)),
      },
      optimista: computeScenarioFromAnnual(equityAnnualFlows, optimistParams, discountRate, tma, investmentMonths),
    };
  }, [equityAnnualFlows, pesimistParams, optimistParams, discountRate, tma, investmentMonths, baseEqIndicators]);

  const updatePessimistParam = (key: keyof ScenarioParams, value: number) => {
    setPesimistParams((prev) => ({ ...prev, [key]: value }));
  };

  const updateOptimistParam = (key: keyof ScenarioParams, value: number) => {
    setOptimistParams((prev) => ({ ...prev, [key]: value }));
  };

  // ── Export data: Comparison tables ──
  const investmentComparisonExport = useMemo(() => {
    const headers = ['Indicador', 'Pesimista', 'Base', 'Optimista', 'Rango'];
    const rows: TableExportRow[] = [
      { cells: ['VAN', formatNum(investmentScenarios.pesimista.van), formatNum(investmentScenarios.base.van), formatNum(investmentScenarios.optimista.van), `${formatNum(investmentScenarios.pesimista.van)} → ${formatNum(investmentScenarios.optimista.van)}`] },
      { cells: ['TIR', investmentScenarios.pesimista.tir !== null ? `${(investmentScenarios.pesimista.tir * 100).toFixed(2)}%` : 'N/D', investmentScenarios.base.tir !== null ? `${(investmentScenarios.base.tir * 100).toFixed(2)}%` : 'N/D', investmentScenarios.optimista.tir !== null ? `${(investmentScenarios.optimista.tir * 100).toFixed(2)}%` : 'N/D', `${investmentScenarios.pesimista.tir !== null ? (investmentScenarios.pesimista.tir * 100).toFixed(2) + '%' : 'N/D'} → ${investmentScenarios.optimista.tir !== null ? (investmentScenarios.optimista.tir * 100).toFixed(2) + '%' : 'N/D'}`] },
      { cells: ['TIRM', investmentScenarios.pesimista.tirm !== null ? `${(investmentScenarios.pesimista.tirm * 100).toFixed(2)}%` : 'N/D', investmentScenarios.base.tirm !== null ? `${(investmentScenarios.base.tirm * 100).toFixed(2)}%` : 'N/D', investmentScenarios.optimista.tirm !== null ? `${(investmentScenarios.optimista.tirm * 100).toFixed(2)}%` : 'N/D', `${investmentScenarios.pesimista.tirm !== null ? (investmentScenarios.pesimista.tirm * 100).toFixed(2) + '%' : 'N/D'} → ${investmentScenarios.optimista.tirm !== null ? (investmentScenarios.optimista.tirm * 100).toFixed(2) + '%' : 'N/D'}`] },
      { cells: ['PR', investmentScenarios.pesimista.pr !== null ? `${investmentScenarios.pesimista.pr.toFixed(1)}a` : 'N/D', investmentScenarios.base.pr !== null ? `${investmentScenarios.base.pr.toFixed(1)}a` : 'N/D', investmentScenarios.optimista.pr !== null ? `${investmentScenarios.optimista.pr.toFixed(1)}a` : 'N/D', `${investmentScenarios.pesimista.pr !== null ? investmentScenarios.pesimista.pr.toFixed(1) + 'a' : 'N/D'} → ${investmentScenarios.optimista.pr !== null ? investmentScenarios.optimista.pr.toFixed(1) + 'a' : 'N/D'}`] },
      { cells: ['B/C', investmentScenarios.pesimista.bc === Infinity ? '\u221E' : investmentScenarios.pesimista.bc.toFixed(3), investmentScenarios.base.bc === Infinity ? '\u221E' : investmentScenarios.base.bc.toFixed(3), investmentScenarios.optimista.bc === Infinity ? '\u221E' : investmentScenarios.optimista.bc.toFixed(3), `${investmentScenarios.pesimista.bc === Infinity ? '\u221E' : investmentScenarios.pesimista.bc.toFixed(3)} → ${investmentScenarios.optimista.bc === Infinity ? '\u221E' : investmentScenarios.optimista.bc.toFixed(3)}`] },
      { cells: ['VAE', formatNum(investmentScenarios.pesimista.eav), formatNum(investmentScenarios.base.eav), formatNum(investmentScenarios.optimista.eav), `${formatNum(investmentScenarios.pesimista.eav)} → ${formatNum(investmentScenarios.optimista.eav)}`] },
    ];
    return { headers, rows };
  }, [investmentScenarios]);

  const equityComparisonExport = useMemo(() => {
    const headers = ['Indicador', 'Pesimista', 'Base', 'Optimista', 'Rango'];
    const rows: TableExportRow[] = [
      { cells: ['VAN', formatNum(equityScenarios.pesimista.van), formatNum(equityScenarios.base.van), formatNum(equityScenarios.optimista.van), `${formatNum(equityScenarios.pesimista.van)} → ${formatNum(equityScenarios.optimista.van)}`] },
      { cells: ['TIR', equityScenarios.pesimista.tir !== null ? `${(equityScenarios.pesimista.tir * 100).toFixed(2)}%` : 'N/D', equityScenarios.base.tir !== null ? `${(equityScenarios.base.tir * 100).toFixed(2)}%` : 'N/D', equityScenarios.optimista.tir !== null ? `${(equityScenarios.optimista.tir * 100).toFixed(2)}%` : 'N/D', `${equityScenarios.pesimista.tir !== null ? (equityScenarios.pesimista.tir * 100).toFixed(2) + '%' : 'N/D'} → ${equityScenarios.optimista.tir !== null ? (equityScenarios.optimista.tir * 100).toFixed(2) + '%' : 'N/D'}`] },
      { cells: ['TIRM', equityScenarios.pesimista.tirm !== null ? `${(equityScenarios.pesimista.tirm * 100).toFixed(2)}%` : 'N/D', equityScenarios.base.tirm !== null ? `${(equityScenarios.base.tirm * 100).toFixed(2)}%` : 'N/D', equityScenarios.optimista.tirm !== null ? `${(equityScenarios.optimista.tirm * 100).toFixed(2)}%` : 'N/D', `${equityScenarios.pesimista.tirm !== null ? (equityScenarios.pesimista.tirm * 100).toFixed(2) + '%' : 'N/D'} → ${equityScenarios.optimista.tirm !== null ? (equityScenarios.optimista.tirm * 100).toFixed(2) + '%' : 'N/D'}`] },
      { cells: ['PR', equityScenarios.pesimista.pr !== null ? `${equityScenarios.pesimista.pr.toFixed(1)}a` : 'N/D', equityScenarios.base.pr !== null ? `${equityScenarios.base.pr.toFixed(1)}a` : 'N/D', equityScenarios.optimista.pr !== null ? `${equityScenarios.optimista.pr.toFixed(1)}a` : 'N/D', `${equityScenarios.pesimista.pr !== null ? equityScenarios.pesimista.pr.toFixed(1) + 'a' : 'N/D'} → ${equityScenarios.optimista.pr !== null ? equityScenarios.optimista.pr.toFixed(1) + 'a' : 'N/D'}`] },
      { cells: ['B/C', equityScenarios.pesimista.bc === Infinity ? '\u221E' : equityScenarios.pesimista.bc.toFixed(3), equityScenarios.base.bc === Infinity ? '\u221E' : equityScenarios.base.bc.toFixed(3), equityScenarios.optimista.bc === Infinity ? '\u221E' : equityScenarios.optimista.bc.toFixed(3), `${equityScenarios.pesimista.bc === Infinity ? '\u221E' : equityScenarios.pesimista.bc.toFixed(3)} → ${equityScenarios.optimista.bc === Infinity ? '\u221E' : equityScenarios.optimista.bc.toFixed(3)}`] },
      { cells: ['VAE', formatNum(equityScenarios.pesimista.eav), formatNum(equityScenarios.base.eav), formatNum(equityScenarios.optimista.eav), `${formatNum(equityScenarios.pesimista.eav)} → ${formatNum(equityScenarios.optimista.eav)}`] },
    ];
    return { headers, rows };
  }, [equityScenarios]);

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Análisis de Escenarios"
        description="Escenarios basados en datos reales: CF Inversión (sin financiamiento) y CF Capital Social (con financiamiento)"
        icon={Settings2}
        variant="info"
        badge={`TD: ${store.parameters.discountRateCUP}%`}
      />

      <Tabs defaultValue="inversion">
        <TabsList>
          <TabsTrigger value="inversion" className="focus-ring transition-all duration-200">
            <Building2 className="h-3.5 w-3.5 mr-1" />
            {'Sin Financiamiento'}
          </TabsTrigger>
          <TabsTrigger value="capital" className="focus-ring transition-all duration-200">
            <Landmark className="h-3.5 w-3.5 mr-1" />
            {'Con Financiamiento'}
          </TabsTrigger>
          <TabsTrigger value="parametros" className="focus-ring transition-all duration-200">{'Parámetros'}</TabsTrigger>
          <TabsTrigger value="comparacion" className="focus-ring transition-all duration-200">{'Tabla'}</TabsTrigger>
        </TabsList>

        {/* ─── Tab: Sin Financiamiento (CF Inversión) ─── */}
        <TabsContent value="inversion">
          <ScenarioCards
            scenarios={investmentScenarios}
            pesimistParams={pesimistParams}
            optimistParams={optimistParams}
            tma={tma}
            duration={duration}
          />
        </TabsContent>

        {/* ─── Tab: Con Financiamiento (CF Capital Social) ─── */}
        <TabsContent value="capital">
          <ScenarioCards
            scenarios={equityScenarios}
            pesimistParams={pesimistParams}
            optimistParams={optimistParams}
            tma={tma}
            duration={duration}
            accentColor="violet"
          />
        </TabsContent>

        {/* ─── Tab: Parámetros ─── */}
        <TabsContent value="parametros">
          <div className="space-y-4 animate-slide-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass-card shadow-card-sm rounded-xl border-danger">
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm text-danger flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {'Parámetros Pesimista'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ParamSlider label={'Variación de Ingresos'} value={pesimistParams.revenueVariation} onChange={(v) => updatePessimistParam('revenueVariation', v)} color="red" />
                  <ParamSlider label={'Variación de Costos'} value={pesimistParams.costVariation} onChange={(v) => updatePessimistParam('costVariation', v)} color="red" />
                  <ParamSlider label={'Variación de Inversión'} value={pesimistParams.investmentVariation} onChange={(v) => updatePessimistParam('investmentVariation', v)} color="red" />
                  <ParamSlider label={'Variación Tasa de Cambio'} value={pesimistParams.exchangeRateVariation} onChange={(v) => updatePessimistParam('exchangeRateVariation', v)} color="red" />
                </CardContent>
              </Card>

              <Card className="glass-card shadow-card-sm rounded-xl border-success">
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm text-success flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {'Parámetros Optimista'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ParamSlider label={'Variación de Ingresos'} value={optimistParams.revenueVariation} onChange={(v) => updateOptimistParam('revenueVariation', v)} color="green" />
                  <ParamSlider label={'Variación de Costos'} value={optimistParams.costVariation} onChange={(v) => updateOptimistParam('costVariation', v)} color="green" />
                  <ParamSlider label={'Variación de Inversión'} value={optimistParams.investmentVariation} onChange={(v) => updateOptimistParam('investmentVariation', v)} color="green" />
                  <ParamSlider label={'Variación Tasa de Cambio'} value={optimistParams.exchangeRateVariation} onChange={(v) => updateOptimistParam('exchangeRateVariation', v)} color="green" />
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card shadow-card-sm rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-fin-sm text-muted-foreground">
                  {'Los valores base (0%) representan el escenario sin variaciones respecto al flujo de caja original.'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPesimistParams(DEFAULT_PESSIMIST)}
                    className="px-3 py-1.5 text-fin-xs rounded-md border border-danger/50 text-danger hover:bg-danger-muted focus-ring transition-all duration-200"
                  >
                    {'Restablecer Pesimista'}
                  </button>
                  <button
                    onClick={() => setOptimistParams(DEFAULT_OPTIMIST)}
                    className="px-3 py-1.5 text-fin-xs rounded-md border border-success/50 text-success hover:bg-success-muted focus-ring transition-all duration-200"
                  >
                    {'Restablecer Optimista'}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab: Tabla Comparativa ─── */}
        <TabsContent value="comparacion">
          <div className="space-y-4 animate-slide-up">
            <Card className="glass-card shadow-card-sm rounded-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-success" />
                    {'Sin Financiamiento (CF Inversión)'}
                  </CardTitle>
                  <TableExportButton
                    moduleName="Escenarios"
                    tableName="Sin Financiamiento"
                    headers={investmentComparisonExport.headers}
                    rows={investmentComparisonExport.rows}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ComparisonTable scenarios={investmentScenarios} tma={tma} />
              </CardContent>
            </Card>
            <Card className="glass-card shadow-card-sm rounded-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-panel-b" />
                    {'Con Financiamiento (CF Capital Social)'}
                  </CardTitle>
                  <TableExportButton
                    moduleName="Escenarios"
                    tableName="Con Financiamiento"
                    headers={equityComparisonExport.headers}
                    rows={equityComparisonExport.rows}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ComparisonTable scenarios={equityScenarios} tma={tma} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ViabilitySummaryCard title={'Pesimista'} icon={AlertTriangle} metrics={investmentScenarios.pesimista} tma={tma} borderColor="border-danger" bgClass="bg-danger-muted/30" titleColor="text-danger" />
              <ViabilitySummaryCard title={'Base'} icon={Target} metrics={investmentScenarios.base} tma={tma} borderColor="border-success" bgClass="bg-success-muted/50" titleColor="text-success" />
              <ViabilitySummaryCard title={'Optimista'} icon={TrendingUp} metrics={investmentScenarios.optimista} tma={tma} borderColor="border-success" bgClass="bg-success-muted/30" titleColor="text-success" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Scenario Cards (reusable for both tabs) ───────────────────

function ScenarioCards({
  scenarios,
  pesimistParams,
  optimistParams,
  tma,
  duration,
  accentColor = 'emerald',
}: {
  scenarios: { pesimista: ScenarioMetrics; base: ScenarioMetrics; optimista: ScenarioMetrics };
  pesimistParams: ScenarioParams;
  optimistParams: ScenarioParams;
  tma: number;
  duration: number;
  accentColor?: 'emerald' | 'violet';
}) {
  const isViolet = accentColor === 'violet';
  const successClass = isViolet ? 'text-panel-b' : 'text-success';
  const dangerClass = 'text-danger';
  const borderSuccess = isViolet ? 'border-panel-b bg-panel-b-muted/50' : 'border-success bg-success-muted/50';
  const borderPess = 'border-danger bg-danger-muted/30';
  const borderOpt = isViolet ? 'border-panel-b bg-panel-b-muted/30' : 'border-success bg-success-muted/30';

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(borderPess, 'glass-card shadow-card-sm rounded-xl')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-fin-sm text-danger flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {'Pesimista'}
            </CardTitle>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="text-fin-xs border-red-300 text-danger">
                {'Rev.'} {pesimistParams.revenueVariation > 0 ? '+' : ''}{pesimistParams.revenueVariation}%
              </Badge>
              <Badge variant="outline" className="text-fin-xs border-red-300 text-danger">
                {'Cost.'} {pesimistParams.costVariation > 0 ? '+' : ''}{pesimistParams.costVariation}%
              </Badge>
              <Badge variant="outline" className="text-fin-xs border-red-300 text-danger">
                {'Inv.'} {pesimistParams.investmentVariation > 0 ? '+' : ''}{pesimistParams.investmentVariation}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScenarioMetricRow label="VAN" value={formatNum(scenarios.pesimista.van)} favorable={scenarios.pesimista.van > 0} />
            <ScenarioMetricRow label="TIR" value={scenarios.pesimista.tir !== null ? `${(scenarios.pesimista.tir * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.pesimista.tir !== null && scenarios.pesimista.tir > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="TIRM" value={scenarios.pesimista.tirm !== null ? `${(scenarios.pesimista.tirm * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.pesimista.tirm !== null && scenarios.pesimista.tirm > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="PR" value={scenarios.pesimista.pr !== null ? `${scenarios.pesimista.pr.toFixed(1)} a` : 'N/D'} favorable={scenarios.pesimista.pr !== null && scenarios.pesimista.pr < Math.ceil(duration / 12)} />
            <ScenarioMetricRow label="B/C" value={scenarios.pesimista.bc === Infinity ? '\u221E' : scenarios.pesimista.bc.toFixed(3)} favorable={scenarios.pesimista.bc > 1} />
            <ScenarioMetricRow label="VAE" value={formatNum(scenarios.pesimista.eav)} favorable={scenarios.pesimista.eav > 0} />
          </CardContent>
        </Card>

        <Card className={cn(borderSuccess, 'glass-card shadow-card-sm rounded-xl')}>
          <CardHeader className="pb-2">
            <CardTitle className={cn('text-fin-sm flex items-center gap-2', successClass)}>
              <Target className="h-4 w-4" />
              {'Base (Sin variación)'}
            </CardTitle>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className={cn('text-fin-xs', isViolet ? 'border-panel-b text-panel-b' : 'border-success text-success')}>
                {'Todos 0%'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScenarioMetricRow label="VAN" value={formatNum(scenarios.base.van)} favorable={scenarios.base.van > 0} />
            <ScenarioMetricRow label="TIR" value={scenarios.base.tir !== null ? `${(scenarios.base.tir * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.base.tir !== null && scenarios.base.tir > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="TIRM" value={scenarios.base.tirm !== null ? `${(scenarios.base.tirm * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.base.tirm !== null && scenarios.base.tirm > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="PR" value={scenarios.base.pr !== null ? `${scenarios.base.pr.toFixed(1)} a` : 'N/D'} favorable={scenarios.base.pr !== null && scenarios.base.pr < Math.ceil(duration / 12)} />
            <ScenarioMetricRow label="B/C" value={scenarios.base.bc === Infinity ? '\u221E' : scenarios.base.bc.toFixed(3)} favorable={scenarios.base.bc > 1} />
            <ScenarioMetricRow label="VAE" value={formatNum(scenarios.base.eav)} favorable={scenarios.base.eav > 0} />
          </CardContent>
        </Card>

        <Card className={cn(borderOpt, 'glass-card shadow-card-sm rounded-xl')}>
          <CardHeader className="pb-2">
            <CardTitle className={cn('text-fin-sm flex items-center gap-2', successClass)}>
              <TrendingUp className="h-4 w-4" />
              {'Optimista'}
            </CardTitle>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className={cn('text-fin-xs', isViolet ? 'border-panel-b text-panel-b' : 'border-success text-success')}>
                {'Rev.'} {optimistParams.revenueVariation > 0 ? '+' : ''}{optimistParams.revenueVariation}%
              </Badge>
              <Badge variant="outline" className={cn('text-fin-xs', isViolet ? 'border-panel-b text-panel-b' : 'border-success text-success')}>
                {'Cost.'} {optimistParams.costVariation > 0 ? '+' : ''}{optimistParams.costVariation}%
              </Badge>
              <Badge variant="outline" className={cn('text-fin-xs', isViolet ? 'border-panel-b text-panel-b' : 'border-success text-success')}>
                {'Inv.'} {optimistParams.investmentVariation > 0 ? '+' : ''}{optimistParams.investmentVariation}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScenarioMetricRow label="VAN" value={formatNum(scenarios.optimista.van)} favorable={scenarios.optimista.van > 0} />
            <ScenarioMetricRow label="TIR" value={scenarios.optimista.tir !== null ? `${(scenarios.optimista.tir * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.optimista.tir !== null && scenarios.optimista.tir > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="TIRM" value={scenarios.optimista.tirm !== null ? `${(scenarios.optimista.tirm * 100).toFixed(2)}%` : 'N/D'} favorable={scenarios.optimista.tirm !== null && scenarios.optimista.tirm > tma} reference={`TMA: ${(tma * 100).toFixed(2)}%`} />
            <ScenarioMetricRow label="PR" value={scenarios.optimista.pr !== null ? `${scenarios.optimista.pr.toFixed(1)} a` : 'N/D'} favorable={scenarios.optimista.pr !== null && scenarios.optimista.pr < Math.ceil(duration / 12)} />
            <ScenarioMetricRow label="B/C" value={scenarios.optimista.bc === Infinity ? '\u221E' : scenarios.optimista.bc.toFixed(3)} favorable={scenarios.optimista.bc > 1} />
            <ScenarioMetricRow label="VAE" value={formatNum(scenarios.optimista.eav)} favorable={scenarios.optimista.eav > 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Comparison Table ──────────────────────────────────────────

function ComparisonTable({ scenarios, tma }: { scenarios: { pesimista: ScenarioMetrics; base: ScenarioMetrics; optimista: ScenarioMetrics }; tma: number }) {
  return (
    <ScrollableTable stickyColumns={1}>
      <Table>
        <TableHeader>
          <TableRow className="fin-row-hover">
            <TableHead className="fin-col-header">{'Indicador'}</TableHead>
            <TableHead className="fin-col-header text-center">
              <span className="text-danger">{'Pesimista'}</span>
            </TableHead>
            <TableHead className="text-center px-2">
              <ArrowRight className="h-3 w-3 inline-block" />
            </TableHead>
            <TableHead className="fin-col-header text-center">
              <span className="text-success">{'Base'}</span>
            </TableHead>
            <TableHead className="text-center px-2">
              <ArrowRight className="h-3 w-3 inline-block" />
            </TableHead>
            <TableHead className="fin-col-header text-center">
              <span className="text-success">{'Optimista'}</span>
            </TableHead>
            <TableHead className="fin-col-header text-center">{'Rango'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <CompRow label="VAN" p={scenarios.pesimista.van} b={scenarios.base.van} o={scenarios.optimista.van} fmt={(v) => formatNum(v ?? 0)} favorable={(v) => (v ?? 0) > 0} />
          <CompRow label="TIR" p={scenarios.pesimista.tir} b={scenarios.base.tir} o={scenarios.optimista.tir} fmt={(v) => v !== null ? `${(v * 100).toFixed(2)}%` : 'N/D'} favorable={(v) => v !== null && v > tma} />
          <CompRow label="TIRM" p={scenarios.pesimista.tirm} b={scenarios.base.tirm} o={scenarios.optimista.tirm} fmt={(v) => v !== null ? `${(v * 100).toFixed(2)}%` : 'N/D'} favorable={(v) => v !== null && v > tma} />
          <CompRow label="PR" p={scenarios.pesimista.pr} b={scenarios.base.pr} o={scenarios.optimista.pr} fmt={(v) => v !== null ? `${v.toFixed(1)}a` : 'N/D'} favorable={() => true} />
          <CompRow label="B/C" p={scenarios.pesimista.bc} b={scenarios.base.bc} o={scenarios.optimista.bc} fmt={(v) => (v ?? 0) === Infinity ? '\u221E' : (v ?? 0).toFixed(3)} favorable={(v) => (v ?? 0) > 1} />
          <CompRow label="VAE" p={scenarios.pesimista.eav} b={scenarios.base.eav} o={scenarios.optimista.eav} fmt={(v) => formatNum(v ?? 0)} favorable={(v) => (v ?? 0) > 0} />
        </TableBody>
      </Table>
    </ScrollableTable>
  );
}

function CompRow({ label, p, b, o, fmt, favorable }: { label: string; p: number | null; b: number | null; o: number | null; fmt: (v: number | null) => string; favorable: (v: number | null) => boolean }) {
  return (
    <TableRow className="fin-row-hover">
      <TableCell className="text-fin-sm font-medium">{label}</TableCell>
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(p) ? 'text-success' : 'text-danger')}>{fmt(p)}</TableCell>
      <TableCell />
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(b) ? 'text-success' : 'text-danger')}>{fmt(b)}</TableCell>
      <TableCell />
      <TableCell className={cn('text-fin-sm text-right font-mono tabular-nums', favorable(o) ? 'text-success' : 'text-danger')}>{fmt(o)}</TableCell>
      <TableCell className="text-fin-sm text-center text-muted-foreground font-mono tabular-nums">{fmt(p)} → {fmt(o)}</TableCell>
    </TableRow>
  );
}

// ─── Shared UI Components ──────────────────────────────────────

function ScenarioMetricRow({ label, value, favorable, reference }: { label: string; value: string; favorable: boolean; reference?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-fin-xs text-muted-foreground">{label}</span>
        {reference && (
          <p className="text-fin-xs text-muted-foreground/60">{reference}</p>
        )}
      </div>
      <span className={cn('text-fin-sm font-semibold font-mono', favorable ? 'text-success' : 'text-danger')}>
        {value}
      </span>
    </div>
  );
}

function ParamSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (value: number) => void; color: 'red' | 'green' }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-fin-sm">{label}</Label>
        <span className={cn('text-fin-xs font-mono font-semibold', color === 'red' ? 'text-danger' : 'text-success')}>
          {value > 0 ? '+' : ''}{value}%
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={-50}
        max={50}
        step={1}
        className={cn('[&_[data-slot=slider-range]]:bg-current', color === 'red' ? 'text-danger' : 'text-success')}
      />
      <div className="flex justify-between text-fin-xs text-muted-foreground/50">
        <span>-50%</span>
        <span>0%</span>
        <span>+50%</span>
      </div>
    </div>
  );
}

function ViabilitySummaryCard({ title, icon: Icon, metrics, tma, borderColor, bgClass, titleColor }: { title: string; icon: React.ElementType; metrics: ScenarioMetrics; tma: number; borderColor: string; bgClass: string; titleColor: string }) {
  const checks = [
    { label: 'VAN > 0', pass: metrics.van > 0 },
    { label: 'TIR > TMA', pass: metrics.tir !== null && metrics.tir > tma },
    { label: 'TIRM > TMA', pass: metrics.tirm !== null && metrics.tirm > tma },
    { label: 'B/C > 1', pass: metrics.bc > 1 },
    { label: 'VAE > 0', pass: metrics.eav > 0 },
  ];
  const allPass = checks.every((c) => c.pass);

  return (
    <Card className={cn(borderColor, bgClass, 'glass-card shadow-card-sm rounded-xl')}>
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-sm flex items-center gap-2', titleColor)}>
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              {check.pass ? (
                <div className="h-4 w-4 rounded-full bg-success flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full bg-danger flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <span className="text-fin-xs">{check.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t">
          <Badge className={cn('text-fin-xs w-full justify-center', allPass ? 'bg-success-muted text-success hover:bg-success-muted' : 'bg-danger-muted text-danger hover:bg-danger-muted')}>
            {allPass ? 'Proyecto Viable' : 'Proyecto No Viable'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
