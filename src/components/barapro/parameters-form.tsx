'use client';
import { L } from '@/lib/labels';

import { useState, useEffect } from 'react';
import { useBaraproStore, type Parameters } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Percent, Clock, Shield, PieChart, TrendingUp, Wallet, RotateCcw, Settings2, BookOpen } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// Color map for section accents
const sectionAccents: Record<string, { border: string; iconBg: string; iconText: string }> = {
  'impuestos': { border: 'border-l-danger', iconBg: 'bg-danger/10', iconText: 'text-danger' },
  'descuento': { border: 'border-l-info', iconBg: 'bg-info/10', iconText: 'text-info' },
  'reservas': { border: 'border-l-warning', iconBg: 'bg-warning/10', iconText: 'text-warning' },
  'distribucion': { border: 'border-l-panel-b', iconBg: 'bg-panel-b/10', iconText: 'text-panel-b' },
  'financiero': { border: 'border-l-success', iconBg: 'bg-success/10', iconText: 'text-success' },
  'capital-trabajo': { border: 'border-l-primary', iconBg: 'bg-primary/10', iconText: 'text-primary' },
};

interface ParamGroup {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  fields: {
    key: keyof Parameters;
    labelKey: string;
    unit: string;
    type: 'number' | 'select';
    step?: number;
    options?: string[];
    optionLabels?: Record<string, string>;
  }[];
}

const paramGroupDefs: ParamGroup[] = [
  {
    id: 'impuestos',
    titleKey: 'parameters.taxes',
    descriptionKey: 'parameters.taxesDescription',
    icon: Shield,
    fields: [
      { key: 'incomeTaxRate', labelKey: 'parameters.incomeTax', unit: '%', type: 'number', step: 0.01 },
      { key: 'salesTaxRate', labelKey: 'parameters.salesTax', unit: '%', type: 'number', step: 0.01 },
      { key: 'specialSocialSecurityRate', labelKey: 'parameters.specialSocialSecurity', unit: '%', type: 'number', step: 0.01 },
      { key: 'taxOnWorkforceRate', labelKey: 'parameters.workforceTax', unit: '%', type: 'number', step: 0.01 },
      { key: 'personalIncomeTaxExemptMin', labelKey: 'parameters.personalIncomeTaxExemptMin', unit: 'CUP', type: 'number', step: 10 },
      { key: 'personalIncomeTaxRate', labelKey: 'parameters.personalIncomeTax', unit: '%', type: 'number', step: 0.01 },
      { key: 'workerSocialSecurityRate', labelKey: 'parameters.workerSocialSecurity', unit: '%', type: 'number', step: 0.01 },
      { key: 'territorialTaxRate', labelKey: 'parameters.territorialTax', unit: '%', type: 'number', step: 0.01 },
      { key: 'honorariosAdminRate', labelKey: 'parameters.honorariosAdmin', unit: '%', type: 'number', step: 0.01 },
    ],
  },
  {
    id: 'descuento',
    titleKey: 'parameters.discount',
    descriptionKey: 'parameters.discountDescription',
    icon: TrendingUp,
    fields: [
      { key: 'discountRateCUP', labelKey: 'parameters.cupDiscountRate', unit: '%', type: 'number', step: 0.01 },
      { key: 'discountRateMLC', labelKey: 'parameters.mlcDiscountRate', unit: '%', type: 'number', step: 0.01 },
      { key: 'minimumAcceptableRate', labelKey: 'parameters.minimumAcceptableRate', unit: '%', type: 'number', step: 0.01 },
      { key: 'inflationRate', labelKey: 'parameters.inflationRate', unit: '%', type: 'number', step: 0.01 },
    ],
  },
  {
    id: 'reservas',
    titleKey: 'parameters.reserves',
    descriptionKey: 'parameters.reservesDescription',
    icon: Clock,
    fields: [
      { key: 'contingencyReserveRate', labelKey: 'parameters.contingencyReserveInvestment', unit: '%', type: 'number', step: 0.01 },
      { key: 'operationsContingencyRate', labelKey: 'parameters.operationsContingency', unit: '%', type: 'number', step: 0.01 },
      { key: 'retainedEarningsRate', labelKey: 'parameters.retainedEarnings', unit: '%', type: 'number', step: 0.01 },
    ],
  },
  {
    id: 'distribucion',
    titleKey: 'parameters.distribution',
    descriptionKey: 'parameters.distributionDescription',
    icon: PieChart,
    fields: [
      { key: 'dividendCAMRate', labelKey: 'parameters.dividendCAM', unit: '%', type: 'number', step: 0.01 },
      { key: 'projectAccountRate', labelKey: 'parameters.projectAccount', unit: '%', type: 'number', step: 0.01 },
      { key: 'arieRate', labelKey: 'parameters.arie', unit: '%', type: 'number', step: 0.01 },
      { key: 'reservasEstimulacionRate', labelKey: 'parameters.reservasEstimulacion', unit: '%', type: 'number', step: 0.01 },
      { key: 'beneficioReinvertirRate', labelKey: 'parameters.beneficioReinvertir', unit: '%', type: 'number', step: 0.01 },
      { key: 'canonRoyaltiesRate', labelKey: 'parameters.canonRoyalties', unit: '%', type: 'number', step: 0.01 },
      { key: 'arrendamientoMensual', labelKey: 'parameters.arrendamiento', unit: 'CUP', type: 'number', step: 1 },
      { key: 'otrosGastosVariablesPct', labelKey: 'parameters.otrosGastosVariables', unit: '%', type: 'number', step: 0.01 },
      { key: 'otrasReservasVoluntariasRate', labelKey: 'parameters.otrasReservasVoluntarias', unit: '%', type: 'number', step: 0.01 },
      { key: 'pagoUtilidadesRetenidasAmt', labelKey: 'parameters.pagoUtilidadesRetenidas', unit: 'CUP', type: 'number', step: 1 },
      { key: 'dividendoEstatalPct', labelKey: 'parameters.dividendoEstatal', unit: '%', type: 'number', step: 0.01 },
      { key: 'dividendoSocioCubanoPct', labelKey: 'parameters.dividendoSocioCubano', unit: '%', type: 'number', step: 0.01 },
      { key: 'dividendoSocioExtranjeroPct', labelKey: 'parameters.dividendoSocioExtranjero', unit: '%', type: 'number', step: 0.01 },
    ],
  },
  {
    id: 'financiero',
    titleKey: 'parameters.financial',
    descriptionKey: 'parameters.financialDescription',
    icon: Percent,
    fields: [
      { key: 'bankFeeRate', labelKey: 'parameters.bankCommission', unit: '%', type: 'number', step: 0.001 },
      { key: 'vacationNormRate', labelKey: 'parameters.vacationNorm', unit: '%', type: 'number', step: 0.0001 },
    ],
  },
  {
    id: 'capital-trabajo',
    titleKey: 'parameters.workingCapital',
    descriptionKey: 'parameters.workingCapitalDescription',
    icon: Wallet,
    fields: [
      { key: 'workingDaysPerYear', labelKey: 'parameters.workingDaysPerYear', unit: 'días', type: 'number', step: 1 },
      { key: 'workingDaysPerMonth', labelKey: 'parameters.workingDaysPerMonth', unit: 'días', type: 'number', step: 1 },
      { key: 'wcCashCoverageDays', labelKey: 'parameters.cashCoverageDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcReceivableCoverageDays', labelKey: 'parameters.receivableCoverageDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcInventoryCoverageDays', labelKey: 'parameters.inventoryRotationDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcPayableDays', labelKey: 'parameters.supplierPaymentDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcWipCoverageDays', labelKey: 'parameters.wipDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcFinishedGoodsCoverageDays', labelKey: 'parameters.finishedGoodsCoverageDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcSparePartsCoverageDays', labelKey: 'parameters.sparePartsCoverageDays', unit: 'días', type: 'number', step: 1 },
      { key: 'wcMercanciasVentaCoverageDays', labelKey: 'parameters.mercanciasVentaCoverageDays', unit: 'días', type: 'number', step: 1 },
    ],
  },
];

export function ParametersForm() {
  const { parameters, updateParameters } = useBaraproStore();
  const [local, setLocal] = useState<Parameters>({ ...parameters });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Sync local state when store changes externally (e.g. import/reset)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing Zustand store to local form state
    setLocal({ ...parameters });
  }, [parameters]);

  const handleChange = (key: keyof Parameters, value: any) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  // Specialized handler for editing a single field in assetCategoryRates
  const handleCategoryRateChange = (catId: string, field: 'lifeYears' | 'residualPercent', value: number) => {
    setLocal((prev) => {
      const rates = [...(prev.assetCategoryRates || [])];
      const idx = rates.findIndex((r: { id: string }) => r.id === catId);
      if (idx >= 0) {
        rates[idx] = { ...rates[idx], [field]: value };
      } else {
        // Find default values from store
        const defaults = parameters.assetCategoryRates || [];
        const def = defaults.find((r: { id: string }) => r.id === catId);
        rates.push({
          id: catId,
          lifeYears: field === 'lifeYears' ? value : (def?.lifeYears || 10),
          residualPercent: field === 'residualPercent' ? value : (def?.residualPercent || 10),
        });
      }
      return { ...prev, assetCategoryRates: rates };
    });
  };

  const handleSave = () => {
    updateParameters(local);
    toast.success('Parámetros guardados correctamente');
  };

  const handleReset = () => {
    setResetDialogOpen(true);
  };

  const confirmReset = () => {
    setLocal({ ...parameters });
    toast.success('Parámetros restaurados');
    setResetDialogOpen(false);
  };

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Header Card — compact */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <CardContent className="px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-fin-lg font-bold">{'N. Parámetros Financieros'}</h2>
              <p className="text-fin-xs text-muted-foreground">{'Configuración de tasas y parámetros para el cálculo financiero'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {paramGroupDefs.map((group) => {
        const GroupIcon = group.icon;
        const accent = sectionAccents[group.id] || { border: 'border-l-primary', iconBg: 'bg-primary/10', iconText: 'text-primary' };
        return (
          <Card key={group.id} className={`glass-card rounded-xl shadow-card-sm overflow-hidden border-l-4 ${accent.border}`}>
            <CardHeader className="py-2 px-4 border-b border-border/30 bg-muted/10">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${accent.iconBg}`}>
                  <GroupIcon className={`h-3.5 w-3.5 ${accent.iconText}`} />
                </div>
                <CardTitle className="text-fin-base font-semibold">{L(group.titleKey)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5">
                {group.fields.map((field) => (
                  <div key={field.key} className="space-y-0.5">
                    <Label className="text-fin-xs font-medium text-muted-foreground">
                      {L(field.labelKey)}
                      {field.unit === '%' && <span className="ml-0.5 opacity-60">(%)</span>}
                      {field.unit === 'CUP' && <span className="ml-0.5 opacity-60">(CUP)</span>}
                      {field.unit === 'días' && <span className="ml-0.5 opacity-60">(días)</span>}
                    </Label>
                    {field.type === 'select' && field.options ? (
                      <Select
                        value={local[field.key] as string}
                        onValueChange={(v) => handleChange(field.key, v)}
                      >
                        <SelectTrigger className="w-full h-8 text-fin-sm focus-ring transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {field.optionLabels?.[opt] || opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="number"
                        value={local[field.key] as string | number}
                        onChange={(e) =>
                          handleChange(field.key, parseFloat(e.target.value) || 0)
                        }
                        step={field.step || 0.01}
                        min={0}
                        className="h-8 text-fin-sm focus-ring transition-all duration-200"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Depreciación y Amortización */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden border-l-4 border-l-success">
        <CardHeader className="py-2 px-4 border-b border-border/30 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-success/10">
              <Percent className="h-3.5 w-3.5 text-success" />
            </div>
            <CardTitle className="text-fin-base font-semibold">{'Depreciación y Amortización'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3 space-y-3">
          {/* Method and global residual — inline row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2.5">
            <div className="space-y-0.5">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Método de Depreciación'}</Label>
              <Select value={local.depreciationMethod} onValueChange={(v) => handleChange('depreciationMethod', v)}>
                <SelectTrigger className="w-full h-8 text-fin-sm focus-ring transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight-line">{'Línea Recta'}</SelectItem>
                  <SelectItem value="declining">{'Saldos Decrecientes'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Valor Residual Global (%)'}</Label>
              <Input type="number" value={local.residualValuePercent} onChange={(e) => handleChange('residualValuePercent', parseFloat(e.target.value) || 0)} step={0.01} min={0} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Vida Útil Global (años)'}</Label>
              <Input type="number" value={local.usefulLifeYears} onChange={(e) => handleChange('usefulLifeYears', parseInt(e.target.value) || 1)} step={1} min={1} max={100} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
          </div>

          {/* Gastos Previos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2.5">
            <div className="space-y-0.5">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Amort. Gastos Previos (años, máx 5)'}</Label>
              <Input type="number" value={local.gastosPreviosAmortYears || 5} onChange={(e) => handleChange('gastosPreviosAmortYears', Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))} step={1} min={1} max={5} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
          </div>

          {/* Asset categories table - EDITABLE */}
          <div className="space-y-1.5">
            <Label className="text-fin-xs font-semibold">{'Categorías de Activos Fijos'}</Label>
            <p className="text-[11px] text-muted-foreground/70">{'Resolución 3060/2013 MINFP — valores editables'}</p>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold">{'Categoría'}</th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold w-24">{'Vida (años)'}</th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold w-24">{'Residual (%)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'edificaciones', nameKey: 'parameters.buildings' },
                    { id: 'infraestructura', nameKey: 'parameters.infrastructure' },
                    { id: 'maquinaria', nameKey: 'parameters.machineryEquipment' },
                    { id: 'transporte', nameKey: 'parameters.transportEquipment' },
                    { id: 'computo', nameKey: 'parameters.computingEquipment' },
                    { id: 'mobiliario', nameKey: 'parameters.furnitureFixtures' },
                    { id: 'herramientas', nameKey: 'parameters.tools' },
                    { id: 'otros-activos', nameKey: 'parameters.otherAssets' },
                  ].map((cat) => {
                    const rate = (local.assetCategoryRates || []).find((r: { id: string }) => r.id === cat.id);
                    const life = rate ? rate.lifeYears : 10;
                    const residual = rate ? rate.residualPercent : 10;
                    return (
                      <tr key={cat.id} className="border-t border-border/40 fin-row-hover">
                        <td className="px-3 py-1 text-fin-xs">{L(cat.nameKey)}</td>
                        <td className="px-3 py-1 text-center">
                          <Input type="number" className="w-16 text-center text-fin-xs h-7 mx-auto focus-ring transition-all duration-200" value={life}
                            onChange={(e) => handleCategoryRateChange(cat.id, 'lifeYears', parseInt(e.target.value) || 1)}
                            min={1} />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <Input type="number" className="w-16 text-center text-fin-xs h-7 mx-auto focus-ring transition-all duration-200" value={residual}
                            onChange={(e) => handleCategoryRateChange(cat.id, 'residualPercent', parseInt(e.target.value) || 0)}
                            min={0} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intangible categories - EDITABLE */}
          <div className="space-y-1.5">
            <Label className="text-fin-xs font-semibold">{'Activos Intangibles (Amortización)'}</Label>
            <p className="text-[11px] text-muted-foreground/70">{'Residual 0%, línea recta'}</p>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold">{'Tipo'}</th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold w-24">{'Vida (años)'}</th>
                    <th className="px-3 py-1.5 text-center text-[11px] font-semibold w-24">{'Residual'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'software', nameKey: 'parameters.softwareLicenses' },
                    { id: 'patentes', nameKey: 'parameters.patents' },
                    { id: 'marcas', nameKey: 'parameters.trademarks' },
                    { id: 'licencias', nameKey: 'parameters.licensesConcessions' },
                    { id: 'gastos-org', nameKey: 'parameters.organizationExpenses' },
                    { id: 'capacitacion', nameKey: 'parameters.staffTraining' },
                    { id: 'know-how', nameKey: 'parameters.knowhowTransfer' },
                  ].map((cat) => {
                    const rate = (local.assetCategoryRates || []).find((r: { id: string }) => r.id === cat.id);
                    const life = rate ? rate.lifeYears : 5;
                    const residual = rate ? rate.residualPercent : 0;
                    return (
                      <tr key={cat.id} className="border-t border-border/40 fin-row-hover">
                        <td className="px-3 py-1 text-fin-xs">{L(cat.nameKey)}</td>
                        <td className="px-3 py-1 text-center">
                          <Input type="number" className="w-16 text-center text-fin-xs h-7 mx-auto focus-ring transition-all duration-200" value={life}
                            onChange={(e) => handleCategoryRateChange(cat.id, 'lifeYears', parseInt(e.target.value) || 1)}
                            min={1} />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <Input type="number" className="w-16 text-center text-fin-xs h-7 mx-auto focus-ring transition-all duration-200" value={residual}
                            onChange={(e) => handleCategoryRateChange(cat.id, 'residualPercent', parseInt(e.target.value) || 0)}
                            min={0} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60 italic">
            {'Los activos se categorizan individualmente en los módulos B, C y Piezas de Repuesto. Los valores de esta tabla se aplican como predeterminados.'}
          </p>
        </CardContent>
      </Card>

      {/* Quick Reference — compact grid */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden border-l-4 border-l-info">
        <CardHeader className="py-2 px-4 border-b border-border/30 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-info/10">
              <BookOpen className="h-3.5 w-3.5 text-info" />
            </div>
            <CardTitle className="text-fin-base font-semibold">{'Referencia Rápida'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 text-[11px]">
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-info">{'TMAR'}:</span>{' '}
              {(local.minimumAcceptableRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-info">{'Desc. CUP'}:</span>{' '}
              {(local.discountRateCUP).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-info">{'Desc. MLC'}:</span>{' '}
              {(local.discountRateMLC).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-warning">{'Inflación'}:</span>{' '}
              {(local.inflationRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-danger">{'Imp. Ingresos'}:</span>{' '}
              {(local.incomeTaxRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-warning">{'Cont. Inv.'}:</span>{' '}
              {(local.contingencyReserveRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-warning">{'Cont. Op.'}:</span>{' '}
              {(local.operationsContingencyRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold">{'Retenidas'}:</span>{' '}
              {(local.retainedEarningsRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold">{'Reinvertir'}:</span>{' '}
              {(local.beneficioReinvertirRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold">{'ARIE'}:</span>{' '}
              {(local.arieRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold">{'Res. Estim.'}:</span>{' '}
              {(local.reservasEstimulacionRate).toFixed(2)}%
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold">{'Deprec.'}:</span>{' '}
              {local.depreciationMethod === 'straight-line' ? L('parameters.qrLinear') : 'Decreciente'}
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-primary">{'CT Efect.'}:</span>{' '}
              {local.wcCashCoverageDays}d
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-primary">{'CT CxC'}:</span>{' '}
              {local.wcReceivableCoverageDays}d
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-primary">{'CT Inv.'}:</span>{' '}
              {local.wcInventoryCoverageDays}d
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40">
              <span className="font-semibold text-primary">{'CT CxP'}:</span>{' '}
              {local.wcPayableDays}d
            </div>
            <div className="px-2 py-1.5 rounded-md bg-muted/40 sm:col-span-2 lg:col-span-4">
              <span className="font-semibold text-primary">{'Base'}:</span>{' '}
              {local.workingDaysPerMonth}d/mes / {local.workingDaysPerYear}d/año
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons — sticky bottom */}
      <div className="flex justify-end gap-2 pb-2">
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 focus-ring transition-all duration-200">
          <RotateCcw className="h-3.5 w-3.5" />
          {'Restaurar'}
        </Button>
        <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 focus-ring transition-all duration-200 shadow-sm">
          <Save className="h-3.5 w-3.5" />
          {'Guardar Parámetros'}
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="glass-card shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'¿Restaurar parámetros?'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">
              {'Se perderán todos los cambios no guardados. ¿Desea restaurar los parámetros a su último estado guardado?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="focus-ring">
              {'Sí, restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
