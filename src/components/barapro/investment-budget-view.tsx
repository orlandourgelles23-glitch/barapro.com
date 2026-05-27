'use client';

import React, { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildInvestmentBudget, buildInvestmentSchedule, type InvestmentScheduleRow } from '@/lib/barapro-financial';
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
import { Landmark, ShieldAlert, Wallet, ArrowRightLeft, CalendarDays, Layers, Building2 } from 'lucide-react';
import { groupMonthsByYear, YearMonthHeader } from '@/components/barapro/year-month-header';
import { cn } from '@/lib/utils'
import { getMonthLabel } from '@/lib/format';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

function formatInt(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 0 });
}

// ── Classification constants ──────────────────────────────────────────────────

const INVERSION_FIJA_PARTIDAS = ['B. Construcción y Montaje', 'C. Gastos de Capital', 'Activos Intangibles', 'Piezas y Herramientas (Inversión Fija)'];
const GASTOS_PREVIOS_PARTIDAS = [
  'D. Subcontrataciones',
  'E. Recursos Humanos (Inversión)',
  'Piezas y Herramientas',
  'Otros Recursos y Gastos',
];

// ── Schedule row definitions ──────────────────────────────────────────────────

interface ScheduleRowDef {
  keyCUP?: keyof InvestmentScheduleRow;
  keyMLC?: keyof InvestmentScheduleRow;
  label: string;
  isBold?: boolean;
  isSubtotal?: boolean;
  isSection?: boolean;
  isSectionHeader?: boolean;
  indent?: number;
  colorClass?: string;
  showMLC?: boolean;
  computeCUPKeys?: (keyof InvestmentScheduleRow)[];
  computeMLCKeys?: (keyof InvestmentScheduleRow)[];
  isZeroRow?: boolean;
}

const SCHEDULE_ROWS: ScheduleRowDef[] = [
  // Section: INVERSIÓN FIJA
  { isSectionHeader: true, label: 'INVERSIÓN FIJA' },
  { isZeroRow: true, keyCUP: 'subtotalInversionCUP', keyMLC: 'subtotalInversionMLC', label: 'A. Valor de los Derechos que se Aportan', indent: 1 },
  { keyCUP: 'construccionCUP', keyMLC: 'construccionMLC', label: 'B. Construcción y Montaje', indent: 1 },
  { keyCUP: 'capitalCUP', keyMLC: 'capitalMLC', label: 'C. Gastos de Capital', indent: 1 },
  { keyCUP: 'activosIntangiblesCUP', keyMLC: 'activosIntangiblesMLC', label: 'Activos Fijos Intangibles', indent: 1 },
  { keyCUP: 'piezasDepreciablesCUP', keyMLC: 'piezasDepreciablesMLC', label: 'Piezas y Herramientas (Depreciables)', indent: 1 },
  { computeCUPKeys: ['construccionCUP', 'capitalCUP', 'activosIntangiblesCUP', 'piezasDepreciablesCUP'], computeMLCKeys: ['construccionMLC', 'capitalMLC', 'activosIntangiblesMLC', 'piezasDepreciablesMLC'], label: 'Subtotal Inversión Fija', isBold: true, isSubtotal: true, indent: 1, colorClass: 'text-info dark:text-info' },

  // Section: GASTOS PREVIOS
  { isSectionHeader: true, label: 'GASTOS PREVIOS A LA OPERACIÓN' },
  { keyCUP: 'subcontratacionesCUP', keyMLC: 'subcontratacionesMLC', label: 'D. Subcontrataciones', indent: 1 },
  { keyCUP: 'recursosHumanosCUP', keyMLC: 'recursosHumanosMLC', label: 'E. Recursos Humanos', indent: 1 },
  { keyCUP: 'piezasNoDepreciablesCUP', keyMLC: 'piezasNoDepreciablesMLC', label: 'Piezas y Herramientas', indent: 1 },
  { keyCUP: 'otrosRecursosCUP', keyMLC: 'otrosRecursosMLC', label: 'Otros Recursos y Gastos', indent: 1 },
  { computeCUPKeys: ['subcontratacionesCUP', 'recursosHumanosCUP', 'piezasNoDepreciablesCUP', 'otrosRecursosCUP'], computeMLCKeys: ['subcontratacionesMLC', 'recursosHumanosMLC', 'piezasNoDepreciablesMLC', 'otrosRecursosMLC'], label: 'Subtotal Gastos Previos', isBold: true, isSubtotal: true, indent: 1, colorClass: 'text-warning dark:text-warning' },

  // CAPITAL FIJO
  { keyCUP: 'subtotalInversionCUP', keyMLC: 'subtotalInversionMLC', label: 'CAPITAL FIJO', isBold: true, isSubtotal: true, colorClass: 'text-muted-foreground dark:text-muted-foreground' },

  // Contingency and Working Capital
  { keyCUP: 'contingenciaCUP', keyMLC: 'contingenciaMLC', label: 'Contingencia', colorClass: 'text-warning' },
  { keyCUP: 'capitalTrabajoCUP', keyMLC: 'capitalTrabajoMLC', label: 'Capital de Trabajo', colorClass: 'text-success' },

  // COSTO TOTAL DE INVERSIÓN INICIAL
  { keyCUP: 'totalInversionCUP', keyMLC: 'totalInversionMLC', label: 'COSTO TOTAL DE INVERSIÓN INICIAL', isBold: true, isSubtotal: true, colorClass: 'text-panel-b dark:text-panel-b' },

  // Financing breakdown
  { keyCUP: 'prestamoCUP', keyMLC: 'totalInversionMLC', label: '(−) Préstamos Recibidos', colorClass: 'text-danger dark:text-danger', isSection: true, showMLC: false },
  { keyCUP: 'capitalSocialCUP', keyMLC: 'totalInversionMLC', label: '(=) Capital Social o Propio', isBold: true, isSubtotal: true, colorClass: 'text-info dark:text-info', showMLC: false },
];

export function InvestmentBudgetView() {
  const store = useBaraproStore();
  const rates = store.project.exchangeRates;
  const data = useMemo(() => buildInvestmentBudget(store), [store]);

  // Investment schedule data
  const schedule = useMemo(() => buildInvestmentSchedule(store), [store]);
  const scheduleData = schedule.monthly;

  // Year/month groups for schedule
  const monthGroups = useMemo(() =>
    groupMonthsByYear(schedule.maxMonth, store.project.startDate),
    [schedule.maxMonth, store.project.startDate]
  );

  // Aggregate schedule to yearly
  const scheduleYearly = useMemo(() => {
    const yearMap = new Map<number, InvestmentScheduleRow[]>();
    for (const row of scheduleData) {
      if (!yearMap.has(row.year)) yearMap.set(row.year, []);
      yearMap.get(row.year)!.push(row);
    }
    const years = [...yearMap.keys()].sort((a, b) => a - b);
    return years.map((year) => {
      const rows = yearMap.get(year)!;
      const aggregated: Record<string, number> = { month: 0, year };
      for (const row of rows) {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === 'number' && k !== 'month' && k !== 'year') {
            aggregated[k] = (aggregated[k] || 0) + v;
          }
        }
      }
      return aggregated as unknown as InvestmentScheduleRow;
    });
  }, [scheduleData]);

  // Group schedule monthly rows by year (non-aggregated, for subtotal columns)
  const scheduleByYear = useMemo(() => {
    const yearMap = new Map<number, InvestmentScheduleRow[]>();
    for (const row of scheduleData) {
      if (!yearMap.has(row.year)) yearMap.set(row.year, []);
      yearMap.get(row.year)!.push(row);
    }
    return yearMap;
  }, [scheduleData]);

  // Group items by partida
  const grouped = useMemo(() => {
    const groups: Record<string, typeof data.items> = {};
    for (const item of data.items) {
      if (!groups[item.partida]) groups[item.partida] = [];
      groups[item.partida].push(item);
    }
    return Object.entries(groups).map(([partida, items]) => ({
      partida,
      items,
      subtotalCUP: items.reduce((s, i) => s + i.totalCUP, 0),
      subtotalMLC: items.reduce((s, i) => s + i.totalMLC, 0),
      subtotalCUPConvertido: items.reduce((s, i) => s + i.totalCUPConvertido, 0),
      subtotalMLCConvertido: items.reduce((s, i) => s + i.totalMLCConvertido, 0),
      subtotalCLConvertido: items.reduce((s, i) => s + i.totalCLConvertido, 0),
    }));
  }, [data]);

  // ── Classification: Inversión Fija / Gastos Previos ──
  const {
    inversionFijaGroups,
    gastosPreviosGroups,
    inversionFijaCUP,
    inversionFijaMLC,
    gastosPreviosCUP,
    gastosPreviosMLC,
    inversionFijaCUPConvertido,
    inversionFijaMLCConvertido,
    inversionFijaCLConvertido,
    gastosPreviosCUPConvertido,
    gastosPreviosMLCConvertido,
    gastosPreviosCLConvertido,
  } = useMemo(() => {
    const ifGroups = grouped.filter(g => INVERSION_FIJA_PARTIDAS.includes(g.partida));
    const gpGroups = grouped.filter(g => GASTOS_PREVIOS_PARTIDAS.includes(g.partida));
    return {
      inversionFijaGroups: ifGroups,
      gastosPreviosGroups: gpGroups,
      inversionFijaCUP: ifGroups.reduce((s, g) => s + g.subtotalCUP, 0),
      inversionFijaMLC: ifGroups.reduce((s, g) => s + g.subtotalMLC, 0),
      gastosPreviosCUP: gpGroups.reduce((s, g) => s + g.subtotalCUP, 0),
      gastosPreviosMLC: gpGroups.reduce((s, g) => s + g.subtotalMLC, 0),
      inversionFijaCUPConvertido: ifGroups.reduce((s, g) => s + g.subtotalCUPConvertido, 0),
      inversionFijaMLCConvertido: ifGroups.reduce((s, g) => s + g.subtotalMLCConvertido, 0),
      inversionFijaCLConvertido: ifGroups.reduce((s, g) => s + g.subtotalCLConvertido, 0),
      gastosPreviosCUPConvertido: gpGroups.reduce((s, g) => s + g.subtotalCUPConvertido, 0),
      gastosPreviosMLCConvertido: gpGroups.reduce((s, g) => s + g.subtotalMLCConvertido, 0),
      gastosPreviosCLConvertido: gpGroups.reduce((s, g) => s + g.subtotalCLConvertido, 0),
    };
  }, [grouped]);

  // Capital Fijo converted values
  const capitalFijoCUPConvertido = inversionFijaCUPConvertido + gastosPreviosCUPConvertido;
  const capitalFijoMLCConvertido = inversionFijaMLCConvertido + gastosPreviosMLCConvertido;
  const capitalFijoCLConvertido = inversionFijaCLConvertido + gastosPreviosCLConvertido;

  // WC in all currencies
  const wcCUPConvertido = data.initialWCCUP;
  const wcMLCConvertido = rates.cupToMlc > 0 ? data.initialWCCUP / rates.cupToMlc : 0;
  const wcCLConvertido = rates.cupToCl > 0 ? data.initialWCCUP / rates.cupToCl : data.initialWCCUP;
  // Contingency in all currencies
  const contingencyCUPConvertido = data.contingencyCUP + data.contingencyMLC * rates.cupToMlc;
  const contingencyMLCConvertido = rates.cupToMlc > 0
    ? (data.contingencyCUP / rates.cupToMlc) + data.contingencyMLC
    : 0;
  const contingencyCLConvertido = (rates.cupToCl > 0 ? data.contingencyCUP / rates.cupToCl : 0)
    + (rates.mlcToCl > 0 ? data.contingencyMLC / rates.mlcToCl : data.contingencyMLC);

  const contingencyPct = (store.parameters.contingencyReserveRate || 0).toFixed(0);

  // ── Export data: Cronograma Anual ──
  const annualScheduleExport = useMemo(() => {
    const headers = ['Concepto', ...scheduleYearly.map(r => String(r.year)), 'Total'];
    const rows: TableExportRow[] = SCHEDULE_ROWS.map(rowDef => {
      if (rowDef.isSectionHeader) {
        return { cells: [rowDef.label, ...scheduleYearly.map(() => ''), ''], isSectionHeader: true };
      }
      const getValCUP = (r: InvestmentScheduleRow): number => {
        if (rowDef.isZeroRow) return 0;
        if (rowDef.computeCUPKeys) return rowDef.computeCUPKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
        return (r as unknown as Record<string, number>)[rowDef.keyCUP as string] ?? 0;
      };
      const getValMLC = (r: InvestmentScheduleRow): number => {
        if (rowDef.isZeroRow) return 0;
        if (rowDef.computeMLCKeys) return rowDef.computeMLCKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
        return (r as unknown as Record<string, number>)[rowDef.keyMLC as string] ?? 0;
      };
      const showMLC = rowDef.showMLC !== false;
      const totalCUP = scheduleYearly.reduce((s, r) => s + getValCUP(r), 0);
      const totalMLC = showMLC ? scheduleYearly.reduce((s, r) => s + getValMLC(r), 0) : 0;
      const cupStr = scheduleYearly.map(r => formatNum(getValCUP(r)));
      const mlcStr = showMLC ? scheduleYearly.map(r => { const v = getValMLC(r); return v > 0 ? `${formatNum(v)}$` : ''; }) : scheduleYearly.map(() => '');
      const cells = [rowDef.label, ...cupStr.map((c, i) => mlcStr[i] ? `${c} / ${mlcStr[i]}` : c), totalMLC > 0 ? `${formatNum(totalCUP)} / ${formatNum(totalMLC)}$` : formatNum(totalCUP)];
      return { cells, bold: rowDef.isBold, highlight: rowDef.isSubtotal };
    });
    return { headers, rows };
  }, [scheduleYearly]);

  // ── Export data: Cronograma Mensual ──
  const monthlyScheduleExport = useMemo(() => {
    const monthHeaders = monthGroups.flatMap(g => [...g.months.map(m => getMonthLabel(m.monthIndex, store.project.startDate)), `Subt. Año ${g.year}`]);
    const headers = ['Concepto', ...monthHeaders, 'Total'];
    const rows: TableExportRow[] = SCHEDULE_ROWS.map(rowDef => {
      if (rowDef.isSectionHeader) {
        return { cells: [rowDef.label, ...monthHeaders.map(() => ''), ''], isSectionHeader: true };
      }
      const getValCUP = (r: InvestmentScheduleRow): number => {
        if (rowDef.isZeroRow) return 0;
        if (rowDef.computeCUPKeys) return rowDef.computeCUPKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
        return (r as unknown as Record<string, number>)[rowDef.keyCUP as string] ?? 0;
      };
      const getValMLC = (r: InvestmentScheduleRow): number => {
        if (rowDef.isZeroRow) return 0;
        if (rowDef.computeMLCKeys) return rowDef.computeMLCKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
        return (r as unknown as Record<string, number>)[rowDef.keyMLC as string] ?? 0;
      };
      const showMLC = rowDef.showMLC !== false;
      const totalCUP = scheduleData.reduce((s, r) => s + getValCUP(r), 0);
      const totalMLC = showMLC ? scheduleData.reduce((s, r) => s + getValMLC(r), 0) : 0;
      const dataCells: string[] = [];
      for (const yearGroup of monthGroups) {
        const yearRows = scheduleByYear.get(yearGroup.year) || [];
        for (const r of yearRows) {
          const valCUP = getValCUP(r);
          const valMLC = showMLC ? getValMLC(r) : 0;
          dataCells.push(valMLC > 0 ? `${formatNum(valCUP)} / ${formatNum(valMLC)}$` : formatNum(valCUP));
        }
        const yearCUP = yearRows.reduce((s, r) => s + getValCUP(r), 0);
        const yearMLC = showMLC ? yearRows.reduce((s, r) => s + getValMLC(r), 0) : 0;
        dataCells.push(yearMLC > 0 ? `${formatNum(yearCUP)} / ${formatNum(yearMLC)}$` : formatNum(yearCUP));
      }
      const totalStr = totalMLC > 0 ? `${formatNum(totalCUP)} / ${formatNum(totalMLC)}$` : formatNum(totalCUP);
      return { cells: [rowDef.label, ...dataCells, totalStr], bold: rowDef.isBold, highlight: rowDef.isSubtotal };
    });
    return { headers, rows };
  }, [scheduleData, monthGroups, scheduleByYear, store.project.startDate]);

  // ── Export data: Tabla Detallada (multi-currency) ──
  const detailedTableExport = useMemo(() => {
    const headers = ['Partida / Subpartida', 'Nombre', 'CUP', 'MLC', 'Total CUP', 'CUP', 'MLC', 'Total MLC', 'CUP', 'MLC', 'Total CL', 'Meses'];
    const rows: TableExportRow[] = [];
    // Inversión Fija
    rows.push({ cells: ['INVERSIÓN FIJA', ...Array(11).fill('')], isSectionHeader: true });
    rows.push({ cells: ['A. Valor de los Derechos que se Aportan', ...Array(11).fill('')], isSectionHeader: true });
    for (const group of inversionFijaGroups) {
      rows.push({ cells: [group.partida, ...Array(11).fill('')], isSectionHeader: true });
      for (const item of group.items) {
        rows.push({ cells: [item.subpartida, item.nombre, formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalCUPConvertido), formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalMLCConvertido), formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalCLConvertido), String(item.months ? item.months.length : 0)] });
      }
      rows.push({ cells: [`Subtotal ${group.partida}`, '', formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalCUPConvertido), formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalMLCConvertido), formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalCLConvertido), ''], bold: true });
    }
    rows.push({ cells: ['Subtotal Inversión Fija', '', formatNum(inversionFijaCUP), formatNum(inversionFijaMLC), formatNum(inversionFijaCUPConvertido), formatNum(inversionFijaCUP), formatNum(inversionFijaMLC), formatNum(inversionFijaMLCConvertido), formatNum(inversionFijaCUP), formatNum(inversionFijaMLC), formatNum(inversionFijaCLConvertido), ''], bold: true, highlight: true });
    // Gastos Previos
    rows.push({ cells: ['GASTOS PREVIOS', ...Array(11).fill('')], isSectionHeader: true });
    for (const group of gastosPreviosGroups) {
      rows.push({ cells: [group.partida, ...Array(11).fill('')], isSectionHeader: true });
      for (const item of group.items) {
        rows.push({ cells: [item.subpartida, item.nombre, formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalCUPConvertido), formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalMLCConvertido), formatNum(item.totalCUP), formatNum(item.totalMLC), formatNum(item.totalCLConvertido), String(item.months ? item.months.length : 0)] });
      }
      rows.push({ cells: [`Subtotal ${group.partida}`, '', formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalCUPConvertido), formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalMLCConvertido), formatNum(group.subtotalCUP), formatNum(group.subtotalMLC), formatNum(group.subtotalCLConvertido), ''], bold: true });
    }
    rows.push({ cells: ['Subtotal Gastos Previos', '', formatNum(gastosPreviosCUP), formatNum(gastosPreviosMLC), formatNum(gastosPreviosCUPConvertido), formatNum(gastosPreviosCUP), formatNum(gastosPreviosMLC), formatNum(gastosPreviosMLCConvertido), formatNum(gastosPreviosCUP), formatNum(gastosPreviosMLC), formatNum(gastosPreviosCLConvertido), ''], bold: true, highlight: true });
    // Capital Fijo
    rows.push({ cells: ['CAPITAL FIJO', '', formatNum(data.subtotalCUP), formatNum(data.subtotalMLC), formatNum(capitalFijoCUPConvertido), formatNum(data.subtotalCUP), formatNum(data.subtotalMLC), formatNum(capitalFijoMLCConvertido), formatNum(data.subtotalCUP), formatNum(data.subtotalMLC), formatNum(capitalFijoCLConvertido), ''], bold: true });
    // Contingency
    rows.push({ cells: [`Reservas para Contingencias Inversión (${contingencyPct}%)`, '', formatNum(data.contingencyCUP), formatNum(data.contingencyMLC), formatNum(contingencyCUPConvertido), formatNum(data.contingencyCUP), formatNum(data.contingencyMLC), formatNum(contingencyMLCConvertido), formatNum(data.contingencyCUP), formatNum(data.contingencyMLC), formatNum(contingencyCLConvertido), ''] });
    // Working Capital
    rows.push({ cells: ['Capital de Trabajo Inicial', '', formatNum(data.initialWCCUP), formatNum(data.initialWCMLC), formatNum(wcCUPConvertido), formatNum(data.initialWCCUP), formatNum(data.initialWCMLC), formatNum(wcMLCConvertido), formatNum(data.initialWCCUP), formatNum(data.initialWCMLC), formatNum(wcCLConvertido), ''] });
    // Total
    rows.push({ cells: ['COSTO TOTAL DE INVERSIÓN INICIAL', '', formatNum(data.totalCUP), formatNum(data.totalMLC), formatNum(data.grandTotalCUP), formatNum(data.totalCUP), formatNum(data.totalMLC), formatNum(data.grandTotalMLC), formatNum(data.totalCUP), formatNum(data.totalMLC), formatNum(data.grandTotalCL), ''], bold: true, highlight: true });
    // Loans
    rows.push({ cells: ['(−) Préstamos Recibidos', '', formatNum(data.totalLoanCUP), '—', formatNum(data.totalLoanCUP), formatNum(data.totalLoanCUP), '—', formatNum(data.totalLoanCUP), formatNum(data.totalLoanCUP), '—', formatNum(data.totalLoanCUP), ''] });
    rows.push({ cells: ['(=) Capital Social o Propio', '', formatNum(data.totalCapitalSocialCUP), '—', formatNum(data.totalCapitalSocialCUP), formatNum(data.totalCapitalSocialCUP), '—', formatNum(data.totalCapitalSocialCUP), formatNum(data.totalCapitalSocialCUP), '—', formatNum(data.totalCapitalSocialCUP), ''], bold: true, highlight: true });
    return { headers, rows };
  }, [inversionFijaGroups, gastosPreviosGroups, inversionFijaCUP, inversionFijaMLC, inversionFijaCUPConvertido, inversionFijaMLCConvertido, inversionFijaCLConvertido, gastosPreviosCUP, gastosPreviosMLC, gastosPreviosCUPConvertido, gastosPreviosMLCConvertido, gastosPreviosCLConvertido, data, capitalFijoCUPConvertido, capitalFijoMLCConvertido, capitalFijoCLConvertido, contingencyCUPConvertido, contingencyMLCConvertido, contingencyCLConvertido, wcCUPConvertido, wcMLCConvertido, wcCLConvertido, contingencyPct]);

  // ── Export data: Resumen por Moneda ──
  const currencySummaryExport = useMemo(() => {
    const headers = ['Concepto', 'CUP (MN)', 'MLC (USD)', 'CL'];
    const rows: TableExportRow[] = [
      { cells: ['INVERSIÓN FIJA', formatNum(inversionFijaCUP), formatNum(inversionFijaMLC), formatNum(inversionFijaCLConvertido)] },
      { cells: ['GASTOS PREVIOS', formatNum(gastosPreviosCUP), formatNum(gastosPreviosMLC), formatNum(gastosPreviosCLConvertido)] },
      { cells: ['CAPITAL FIJO', formatNum(data.subtotalCUP), formatNum(data.subtotalMLC), formatNum(capitalFijoCLConvertido)], bold: true },
      { cells: [`Reservas para Contingencias Inversión (${contingencyPct}%)`, formatNum(data.contingencyCUP), formatNum(data.contingencyMLC), formatNum(contingencyCLConvertido)] },
      { cells: ['Capital de Trabajo Inicial', formatNum(data.initialWCCUP), formatNum(data.initialWCMLC), formatNum(wcCLConvertido)] },
      { cells: ['Total (CUP + MLC)', formatNum(data.totalCUP), formatNum(data.totalMLC), formatNum((rates.cupToCl > 0 ? data.totalCUP / rates.cupToCl : 0) + (rates.mlcToCl > 0 ? data.totalMLC / rates.mlcToCl : data.totalMLC))], bold: true },
      { cells: ['TOTAL GENERAL DE INVERSIÓN', formatNum(data.grandTotalCUP), formatNum(data.grandTotalMLC), formatNum(data.grandTotalCL)], bold: true, highlight: true },
      { cells: ['(−) Préstamos Recibidos', formatNum(data.totalLoanCUP), '—', '—'] },
      { cells: ['(=) Capital Social o Propio', formatNum(data.totalCapitalSocialCUP), '—', '—'], bold: true },
    ];
    return { headers, rows };
  }, [inversionFijaCUP, inversionFijaMLC, inversionFijaCLConvertido, gastosPreviosCUP, gastosPreviosMLC, gastosPreviosCLConvertido, data, capitalFijoCLConvertido, contingencyPct, contingencyCLConvertido, wcCLConvertido, rates]);

  // ── Render schedule table (annual or monthly) ──
  const renderScheduleTable = (rows: InvestmentScheduleRow[], isMonthly: boolean) => {
    // Compute total columns for section headers
    const totalCols = isMonthly
      ? 1 + monthGroups.reduce((s, g) => s + g.months.length + 1, 0) + 1
      : rows.length + 2;

    return (
      <ScrollableTable maxHeight={isMonthly ? "500px" : "400px"} stickyColumns={1} firstColWidth={220}>
        <Table>
          <TableHeader>
            {isMonthly ? (
              <YearMonthHeader groups={monthGroups} stickyColumns={1} totalColumnMinWidth="100px" monthColumnMinWidth="65px" showYearSubtotals />
            ) : (
              <TableRow>
                <TableHead className="fin-col-header font-bold min-w-[220px]">
                  {'Concepto'}
                </TableHead>
                {rows.map((r, i) => (
                  <TableHead key={i} className="fin-col-header-year text-right min-w-[100px]">
                    {r.year}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header-total text-right font-bold bg-muted min-w-[100px]">
                  {'Total'}
                </TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {SCHEDULE_ROWS.map((rowDef) => {
              // Section header: full-width label row
              if (rowDef.isSectionHeader) {
                return (
                  <TableRow key={`section-${rowDef.label}`} className="fin-section-header">
                    <TableCell
                      colSpan={totalCols}
                      className="text-fin-sm font-bold py-2"
                    >
                      {rowDef.label}
                    </TableCell>
                  </TableRow>
                );
              }

              // Value computation helpers
              const getValCUP = (r: InvestmentScheduleRow): number => {
                if (rowDef.isZeroRow) return 0;
                if (rowDef.computeCUPKeys) return rowDef.computeCUPKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
                return (r as unknown as Record<string, number>)[rowDef.keyCUP as string] ?? 0;
              };
              const getValMLC = (r: InvestmentScheduleRow): number => {
                if (rowDef.isZeroRow) return 0;
                if (rowDef.computeMLCKeys) return rowDef.computeMLCKeys.reduce((s, k) => s + ((r as unknown as Record<string, number>)[k as string] ?? 0), 0);
                return (r as unknown as Record<string, number>)[rowDef.keyMLC as string] ?? 0;
              };

              const showMLC = rowDef.showMLC !== false;
              const totalCUP = rows.reduce((s, r) => s + getValCUP(r), 0);
              const totalMLC = showMLC ? rows.reduce((s, r) => s + getValMLC(r), 0) : 0;

              return (
                <TableRow key={rowDef.label + (rowDef.keyCUP || '')} className={cn(
                  rowDef.isSection && 'border-t-2 border-slate-300',
                  rowDef.isSubtotal && 'border-t-2 border-muted',
                  rowDef.isBold && 'bg-muted/30',
                )}>
                  <TableCell className={cn(
                    'text-fin-sm whitespace-nowrap',
                    rowDef.isBold && 'font-bold',
                    rowDef.indent === 1 && 'pl-4',
                    rowDef.indent === 2 && 'pl-8',
                    rowDef.colorClass,
                  )}>
                    {rowDef.label}
                  </TableCell>
                  {/* Data columns */}
                  {isMonthly ? (
                    // Monthly view: render months grouped by year with subtotal after each year
                    monthGroups.map((yearGroup) => {
                      const yearRows = scheduleByYear.get(yearGroup.year) || [];
                      const yearCUP = yearRows.reduce((s, r) => s + getValCUP(r), 0);
                      const yearMLC = showMLC ? yearRows.reduce((s, r) => s + getValMLC(r), 0) : 0;
                      return (
                        <React.Fragment key={`yr-${yearGroup.year}-${rowDef.keyCUP}`}>
                          {yearRows.map((r) => {
                            const valCUP = getValCUP(r);
                            const valMLC = showMLC ? getValMLC(r) : 0;
                            return (
                              <TableCell key={`${rowDef.keyCUP}-${r.month}-${r.year}`} className={cn(
                                'text-fin-sm text-right tabular-nums',
                                rowDef.isBold && 'font-semibold',
                                rowDef.colorClass,
                              )}>
                                <div>{formatNum(valCUP)}</div>
                                {showMLC && valMLC > 0 && (
                                  <div className="text-fin-xs text-success dark:text-success">{formatNum(valMLC)}$</div>
                                )}
                              </TableCell>
                            );
                          })}
                          {/* Year subtotal cell */}
                          <TableCell className={cn(
                            'text-fin-sm text-right tabular-nums font-semibold bg-info-muted/50 dark:bg-info-muted',
                            rowDef.isBold && 'font-bold',
                            rowDef.colorClass,
                          )}>
                            <div>{formatNum(yearCUP)}</div>
                            {showMLC && yearMLC > 0 && (
                              <div className="text-fin-xs text-success dark:text-success">{formatNum(yearMLC)}$</div>
                            )}
                          </TableCell>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    // Annual view: one column per year (unchanged)
                    rows.map((r) => {
                      const valCUP = getValCUP(r);
                      const valMLC = showMLC ? getValMLC(r) : 0;
                      return (
                        <TableCell key={`${rowDef.keyCUP}-${r.month}-${r.year}`} className={cn(
                          'text-fin-sm text-right tabular-nums',
                          rowDef.isBold && 'font-semibold',
                          rowDef.colorClass,
                        )}>
                          <div>{formatNum(valCUP)}</div>
                          {showMLC && valMLC > 0 && (
                            <div className="text-fin-xs text-success dark:text-success">{formatNum(valMLC)}$</div>
                          )}
                        </TableCell>
                      );
                    })
                  )}
                  {/* Total column */}
                  <TableCell className={cn(
                    'text-fin-sm text-right bg-muted/50 tabular-nums',
                    rowDef.isBold && 'font-bold',
                    rowDef.colorClass,
                  )}>
                    <div>{formatNum(totalCUP)}</div>
                    {showMLC && totalMLC > 0 && (
                      <div className="text-fin-xs text-success dark:text-success">{formatNum(totalMLC)}$</div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollableTable>
    );
  };

  // ── Helper: render a subtotal row in the detailed table ──
  const renderDetailedSubtotalRow = (
    label: string,
    cup: number,
    mlc: number,
    cupConv: number,
    mlcConv: number,
    clConv: number,
    className?: string,
    labelClassName?: string,
  ) => (
    <TableRow className={cn('border-t-2 border-muted', className)}>
      <TableCell colSpan={2} className={cn('text-fin-sm font-semibold pl-4', labelClassName)}>
        {label}
      </TableCell>
      {/* CUP */}
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-info-muted/30 dark:bg-info-muted">{formatNum(cup)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-info-muted/30 dark:bg-info-muted">{formatNum(mlc)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-bold bg-info-muted/50 dark:bg-info-muted">{formatNum(cupConv)}</TableCell>
      {/* MLC */}
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-success-muted/30 dark:bg-success-muted">{formatNum(cup)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-success-muted/30 dark:bg-success-muted">{formatNum(mlc)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-bold bg-success-muted/50 dark:bg-success-muted">{formatNum(mlcConv)}</TableCell>
      {/* CL */}
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(cup)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-semibold bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(mlc)}</TableCell>
      <TableCell className="text-fin-sm text-right tabular-nums font-bold bg-panel-b-muted/50 dark:bg-panel-b-muted">{formatNum(clConv)}</TableCell>
      <TableCell />
    </TableRow>
  );

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Presupuesto de Inversión por Partidas"
        description="Distribución de la inversión inicial por partidas y subpartidas"
        icon={Landmark}
        variant="info"
      />

      {/* Exchange Rates Card */}
      <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-3"><ArrowRightLeft className="h-4 w-4 text-primary" />
            <span className="text-fin-sm font-semibold">{'Tasas de Cambio Aplicadas'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground text-fin-xs">{'CUP → MLC'}</p>
              <p className="font-bold">{formatInt(1 / (rates.cupToMlc || 1))}</p>
              <p className="text-fin-xs text-muted-foreground">{`1 MLC = ${formatInt(rates.cupToMlc) }} CUP`}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-fin-xs">{'CUP → CL'}</p>
              <p className="font-bold">{formatInt(1 / (rates.cupToCl || 1))}</p>
              <p className="text-fin-xs text-muted-foreground">{`1 CL = ${formatInt(rates.cupToCl) }} CUP`}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-fin-xs">{'MLC → CL'}</p>
              <p className="font-bold">{formatNum(rates.mlcToCl)}</p>
              <p className="text-fin-xs text-muted-foreground">{`1 MLC = ${formatNum(rates.mlcToCl) }} CL`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - 4 cards: Inversión Fija, Gastos Previos, Capital Fijo, Costo Total */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'INVERSIÓN FIJA'}</p>
              <p className="text-fin-xl font-bold">{formatNum(inversionFijaCUP)} CUP</p>
              <p className="text-fin-xs text-muted-foreground">{formatNum(inversionFijaMLC)} MLC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-warning-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'GASTOS PREVIOS'}</p>
              <p className="text-fin-xl font-bold text-warning">{formatNum(gastosPreviosCUP)} CUP</p>
              <p className="text-fin-xs text-muted-foreground">{formatNum(gastosPreviosMLC)} MLC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-muted/500/10 p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'CAPITAL FIJO'}</p>
              <p className="text-fin-xl font-bold text-muted-foreground dark:text-foreground">{formatNum(data.subtotalCUP)} CUP</p>
              <p className="text-fin-xs text-muted-foreground">{formatNum(data.subtotalMLC)} MLC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-success/10 p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'COSTO TOTAL DE INVERSIÓN INICIAL'}</p>
              <p className="text-fin-xl font-bold text-success">{formatNum(data.totalCUP)} CUP</p>
              <p className="text-fin-xs text-muted-foreground">{formatNum(data.totalMLC)} MLC</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grand Total in ALL currencies */}
      <Card className="glass-card shadow-card-md rounded-xl border-primary/30">
        <CardContent className="p-4">
          <p className="text-fin-sm font-semibold mb-3">{'Total General de Inversión en Todas las Monedas'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-info-muted dark:bg-info-muted">
              <p className="text-fin-xs text-muted-foreground mb-1">{'En CUP (MN)'}</p>
              <p className="text-fin-xl font-bold text-info dark:text-info">
                {formatNum(data.grandTotalCUP)}
              </p>
              <p className="text-fin-xs text-muted-foreground">{`CUP + MLC × ${rates.cupToMlc }}`}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-success-muted dark:bg-success-muted">
              <p className="text-fin-xs text-muted-foreground mb-1">{'En MLC (USD)'}</p>
              <p className="text-fin-xl font-bold text-success dark:text-success">
                {formatNum(data.grandTotalMLC)}
              </p>
              <p className="text-fin-xs text-muted-foreground">{`CUP / ${rates.cupToMlc }} + MLC`}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-panel-b-muted dark:bg-panel-b-muted">
              <p className="text-fin-xs text-muted-foreground mb-1">{'En CL'}</p>
              <p className="text-fin-xl font-bold text-panel-b dark:text-panel-b">
                {formatNum(data.grandTotalCL)}
              </p>
              <p className="text-fin-xs text-muted-foreground">{`CUP / ${rates.cupToCl} + MLC / ${rates.mlcToCl }}`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cronograma">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cronograma" className="focus-ring transition-all duration-200">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            {'Cronograma'}
          </TabsTrigger>
          <TabsTrigger value="tabla" className="focus-ring transition-all duration-200">{'Tabla Completa'}</TabsTrigger>
          <TabsTrigger value="resumen" className="focus-ring transition-all duration-200">{'Resumen por Moneda'}</TabsTrigger>        </TabsList>

        {/* ===== SCHEDULE TAB (Annual / Monthly) ===== */}
        <TabsContent value="cronograma" className="space-y-4">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><CardTitle className="text-fin-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" />
                {'Cronograma de Inversión por Meses'}
              </CardTitle>
              <p className="text-fin-xs text-muted-foreground">
                {'Desglose mensual de la inversión por partidas (CUP)'}
              </p>
            </CardHeader>
          </Card>

          <Tabs defaultValue="schedule-annual" className="space-y-2">
            <TabsList>
              <TabsTrigger value="schedule-annual" className="focus-ring transition-all duration-200">{'Anual'}</TabsTrigger>
              <TabsTrigger value="schedule-monthly" className="focus-ring transition-all duration-200">{'Mensual'}</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule-annual">
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm font-semibold">{'Cronograma Anual'}</CardTitle>
                    <TableExportButton
                      moduleName="Presupuesto de Inversión"
                      tableName="Cronograma Anual"
                      headers={annualScheduleExport.headers}
                      rows={annualScheduleExport.rows}
                      landscape
                    />
                  </div>
                </CardHeader><CardContent className="p-0">
                  {renderScheduleTable(scheduleYearly, false)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule-monthly">
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm font-semibold">{'Cronograma Mensual'}</CardTitle>
                    <TableExportButton
                      moduleName="Presupuesto de Inversión"
                      tableName="Cronograma Mensual"
                      headers={monthlyScheduleExport.headers}
                      rows={monthlyScheduleExport.rows}
                      landscape
                    />
                  </div>
                </CardHeader><CardContent className="p-0">
                  {renderScheduleTable(scheduleData, true)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== FULL TABLE (Detailed / Monthly Breakdown) ===== */}
        <TabsContent value="tabla" className="space-y-4">
          <Tabs defaultValue="tabla-detallado" className="space-y-2">
            <TabsList>
              <TabsTrigger value="tabla-detallado" className="focus-ring transition-all duration-200">{'Detallado'}</TabsTrigger>
              <TabsTrigger value="tabla-mensual" className="focus-ring transition-all duration-200">{'Desglose Mensual'}</TabsTrigger>
            </TabsList>

            {/* --- Detailed sub-tab (multi-currency table with new classification) --- */}
            <TabsContent value="tabla-detallado">
              <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
                    <CardTitle className="text-fin-sm font-semibold">{'Tabla Detallada'}</CardTitle>
                    <TableExportButton
                      moduleName="Presupuesto de Inversión"
                      tableName="Tabla Detallada"
                      headers={detailedTableExport.headers}
                      rows={detailedTableExport.rows}
                      landscape
                    />
                  </div>
                </CardHeader><CardContent className="p-0">
                  <ScrollableTable maxHeight="500px" stickyColumns={1}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]" rowSpan={2}>{'Partida / Subpartida'}</TableHead>
                          <TableHead className="min-w-[140px]" rowSpan={2}>{'Nombre'}</TableHead>
                          <TableHead className="text-center min-w-[80px] font-semibold bg-info-muted dark:bg-info-muted text-info dark:text-info" colSpan={3} style={{ borderBottom: '2px solid var(--info)' }}>
                            {'Moneda Nacional (CUP)'}
                          </TableHead>
                          <TableHead className="text-center min-w-[80px] font-semibold bg-success-muted dark:bg-success-muted text-success dark:text-success" colSpan={3} style={{ borderBottom: '2px solid var(--success)' }}>
                            MLC (USD)
                          </TableHead>
                          <TableHead className="text-center min-w-[80px] font-semibold bg-panel-b-muted dark:bg-panel-b-muted text-panel-b dark:text-panel-b" colSpan={3} style={{ borderBottom: '2px solid var(--panel-b)' }}>
                            CL
                          </TableHead>
                          <TableHead className="text-center min-w-[80px]" rowSpan={2}>{'Meses'}</TableHead>
                        </TableRow>
                        <TableRow>
                          <TableHead className="text-right bg-info-muted/50 dark:bg-info-muted text-info">{'CUP'}</TableHead>
                          <TableHead className="text-right bg-info-muted/50 dark:bg-info-muted text-info">{'MLC'}</TableHead>
                          <TableHead className="text-right bg-info-muted/50 dark:bg-info-muted text-info font-bold">{'Total'}</TableHead>
                          <TableHead className="text-right bg-success-muted/50 dark:bg-success-muted text-success">{'CUP'}</TableHead>
                          <TableHead className="text-right bg-success-muted/50 dark:bg-success-muted text-success">{'MLC'}</TableHead>
                          <TableHead className="text-right bg-success-muted/50 dark:bg-success-muted text-success font-bold">{'Total'}</TableHead>
                          <TableHead className="text-right bg-panel-b-muted/50 dark:bg-panel-b-muted text-panel-b">{'CUP'}</TableHead>
                          <TableHead className="text-right bg-panel-b-muted/50 dark:bg-panel-b-muted text-panel-b">{'MLC'}</TableHead>
                          <TableHead className="text-right bg-panel-b-muted/50 dark:bg-panel-b-muted text-panel-b font-bold">{'Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* ═══ 1. INVERSIÓN FIJA ═══ */}
                        <TableRow className="bg-primary/5 border-t-2 border-primary/20">
                          <TableCell colSpan={12} className="text-fin-sm font-bold py-2 text-primary">
                            {'INVERSIÓN FIJA'}
                          </TableCell>
                        </TableRow>

                        {/* A. Derechos — header only, no items */}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={12} className="text-fin-sm text-muted-foreground py-1.5 pl-4">
                            {'A. Valor de los Derechos que se Aportan'}
                            <span className="ml-2 text-fin-xs">(0.00 CUP / 0.00 MLC)</span>
                          </TableCell>
                        </TableRow>

                        {/* B & C groups */}
                        {inversionFijaGroups.map((group) => (
                          <React.Fragment key={group.partida}>
                            {/* Group header row */}
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={12} className="text-fin-sm font-semibold text-muted-foreground py-2">
                                <span className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-fin-xs px-1.5 py-0">
                                    {group.items.length}
                                  </Badge>
                                  <span className="min-w-0 truncate">{group.partida}</span>
                                </span>
                              </TableCell>
                            </TableRow>
                            {/* Individual items */}
                            {group.items.map((item, idx) => (
                              <TableRow key={`${group.partida}-${idx}`} className="fin-row-hover">
                                <TableCell className="text-fin-sm text-muted-foreground pl-8">
                                  {item.subpartida}
                                </TableCell>
                                <TableCell className="text-fin-sm">{item.nombre}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/30 dark:bg-info-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/30 dark:bg-info-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-info-muted/50 dark:bg-info-muted">{formatNum(item.totalCUPConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/30 dark:bg-success-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/30 dark:bg-success-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-success-muted/50 dark:bg-success-muted">{formatNum(item.totalMLCConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-panel-b-muted/50 dark:bg-panel-b-muted">{formatNum(item.totalCLConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-center">
                                  <Badge variant="outline" className="text-fin-xs px-1.5 py-0 font-normal">{item.months ? item.months.length : 0}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Subtotal per group */}
                            {renderDetailedSubtotalRow(
                              `Subtotal ${group.partida }}`,
                              group.subtotalCUP, group.subtotalMLC,
                              group.subtotalCUPConvertido, group.subtotalMLCConvertido, group.subtotalCLConvertido,
                            )}
                          </React.Fragment>
                        ))}

                        {/* Subtotal Inversión Fija */}
                        {renderDetailedSubtotalRow(
                          'Subtotal Inversión Fija',
                          inversionFijaCUP, inversionFijaMLC,
                          inversionFijaCUPConvertido, inversionFijaMLCConvertido, inversionFijaCLConvertido,
                          'bg-primary/5 font-bold',
                          'text-fin-xs font-bold text-primary pl-4',
                        )}

                        {/* ═══ 2. GASTOS PREVIOS ═══ */}
                        <TableRow className="bg-warning-muted/30 border-t-2 border-warning">
                          <TableCell colSpan={12} className="text-fin-sm font-bold py-2 text-warning dark:text-warning">
                            {'GASTOS PREVIOS'}
                          </TableCell>
                        </TableRow>

                        {/* D, E, Piezas, Otros, Intangibles groups */}
                        {gastosPreviosGroups.map((group) => (
                          <React.Fragment key={group.partida}>
                            {/* Group header row */}
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={12} className="text-fin-sm font-semibold text-muted-foreground py-2">
                                <span className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-fin-xs px-1.5 py-0">
                                    {group.items.length}
                                  </Badge>
                                  <span className="min-w-0 truncate">{group.partida}</span>
                                </span>
                              </TableCell>
                            </TableRow>
                            {/* Individual items */}
                            {group.items.map((item, idx) => (
                              <TableRow key={`${group.partida}-${idx}`} className="fin-row-hover">
                                <TableCell className="text-fin-sm text-muted-foreground pl-8">{item.subpartida}</TableCell>
                                <TableCell className="text-fin-sm">{item.nombre}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/30 dark:bg-info-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/30 dark:bg-info-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-info-muted/50 dark:bg-info-muted">{formatNum(item.totalCUPConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/30 dark:bg-success-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/30 dark:bg-success-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-success-muted/50 dark:bg-success-muted">{formatNum(item.totalMLCConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(item.totalCUP)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/30 dark:bg-panel-b-muted">{formatNum(item.totalMLC)}</TableCell>
                                <TableCell className="text-fin-sm text-right tabular-nums font-medium bg-panel-b-muted/50 dark:bg-panel-b-muted">{formatNum(item.totalCLConvertido)}</TableCell>
                                <TableCell className="text-fin-sm text-center">
                                  <Badge variant="outline" className="text-fin-xs px-1.5 py-0 font-normal">{item.months ? item.months.length : 0}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Subtotal per group */}
                            {renderDetailedSubtotalRow(
                              `Subtotal ${group.partida }}`,
                              group.subtotalCUP, group.subtotalMLC,
                              group.subtotalCUPConvertido, group.subtotalMLCConvertido, group.subtotalCLConvertido,
                            )}
                          </React.Fragment>
                        ))}

                        {/* Subtotal Gastos Previos */}
                        {renderDetailedSubtotalRow(
                          'Subtotal Gastos Previos',
                          gastosPreviosCUP, gastosPreviosMLC,
                          gastosPreviosCUPConvertido, gastosPreviosMLCConvertido, gastosPreviosCLConvertido,
                          'bg-warning-muted/30 font-bold',
                          'text-fin-xs font-bold text-warning dark:text-warning pl-4',
                        )}

                        {/* CAPITAL FIJO */}
                        {renderDetailedSubtotalRow(
                          'CAPITAL FIJO',
                          data.subtotalCUP, data.subtotalMLC,
                          capitalFijoCUPConvertido, capitalFijoMLCConvertido, capitalFijoCLConvertido,
                          'bg-muted/50 font-bold',
                          'text-fin-xs font-bold pl-4',
                        )}

                        {/* Contingency row */}
                        <TableRow className="bg-warning-muted/50">
                          <TableCell colSpan={2} className="text-fin-sm font-semibold text-warning">
                            {`Reservas para Contingencias Inversión (${contingencyPct }}%)`}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-info-muted/20">{formatNum(data.contingencyCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-info-muted/20">{formatNum(data.contingencyMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-warning bg-info-muted/40">{formatNum(contingencyCUPConvertido)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-success-muted/20">{formatNum(data.contingencyCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-success-muted/20">{formatNum(data.contingencyMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-warning bg-success-muted/40">{formatNum(contingencyMLCConvertido)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-panel-b-muted/20">{formatNum(data.contingencyCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-panel-b-muted/20">{formatNum(data.contingencyMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-warning bg-panel-b-muted/40">{formatNum(contingencyCLConvertido)}</TableCell>
                          <TableCell />
                        </TableRow>

                        {/* Working Capital row */}
                        <TableRow className="bg-success-muted/50">
                          <TableCell colSpan={2} className="text-fin-sm font-semibold text-success">
                            {'Capital de Trabajo Inicial'}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-info-muted/20">{formatNum(data.initialWCCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-info-muted/20">{formatNum(data.initialWCMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-info-muted/40">{formatNum(wcCUPConvertido)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-success-muted/20">{formatNum(data.initialWCCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-success-muted/20">{formatNum(data.initialWCMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-success-muted/40">{formatNum(wcMLCConvertido)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-panel-b-muted/20">{formatNum(data.initialWCCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-success bg-panel-b-muted/20">{formatNum(data.initialWCMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-panel-b-muted/40">{formatNum(wcCLConvertido)}</TableCell>
                          <TableCell />
                        </TableRow>

                        {/* COSTO TOTAL DE INVERSIÓN INICIAL */}
                        <TableRow className="fin-table-total">
                          <TableCell colSpan={2} className="text-sm">
                            {'COSTO TOTAL DE INVERSIÓN INICIAL'}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/40 dark:bg-info-muted">{formatNum(data.totalCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-info-muted/40 dark:bg-info-muted">{formatNum(data.totalMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right text-info dark:text-info bg-info-muted/60 dark:bg-info-muted">{formatNum(data.grandTotalCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/40 dark:bg-success-muted">{formatNum(data.totalCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-success-muted/40 dark:bg-success-muted">{formatNum(data.totalMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right text-success dark:text-success bg-success-muted/60 dark:bg-success-muted">{formatNum(data.grandTotalMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/40 dark:bg-panel-b-muted">{formatNum(data.totalCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums bg-panel-b-muted/40 dark:bg-panel-b-muted">{formatNum(data.totalMLC)}</TableCell>
                          <TableCell className="text-fin-sm text-right text-panel-b dark:text-panel-b bg-panel-b-muted/60 dark:bg-panel-b-muted">{formatNum(data.grandTotalCL)}</TableCell>
                          <TableCell />
                        </TableRow>

                        {/* (−) Préstamos Recibidos */}
                        <TableRow className="bg-danger-muted/50 border-t border-muted">
                          <TableCell colSpan={2} className="text-fin-sm font-semibold text-danger dark:text-danger pl-4">
                            (−) {'Préstamos Recibidos'}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-info-muted/40">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-info-muted/40">{'—'}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-danger dark:text-danger bg-info-muted/60">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-success-muted/40">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-success-muted/40">{'—'}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-danger dark:text-danger bg-success-muted/60">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-panel-b-muted/40">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger bg-panel-b-muted/40">{'—'}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-danger dark:text-danger bg-panel-b-muted/60">{formatNum(data.totalLoanCUP)}</TableCell>
                          <TableCell />
                        </TableRow>

                        {/* (=) Capital Social o Propio */}
                        <TableRow className="bg-info-muted/50 border-t-2 border-muted">
                          <TableCell colSpan={2} className="text-fin-sm font-bold text-info dark:text-info pl-4">
                            (=) {'Capital Social o Propio'}
                          </TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-info-muted/40">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-info-muted/40">{'—'}</TableCell>
                          <TableCell className="text-fin-sm text-right text-info dark:text-info bg-info-muted/60">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-success-muted/40">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-success-muted/40">{'—'}</TableCell>
                          <TableCell className="text-sm text-right text-info dark:text-info bg-success-muted/60">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-panel-b-muted/40">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-panel-b-muted/40">{'—'}</TableCell>
                          <TableCell className="text-sm text-right text-info dark:text-info bg-panel-b-muted/60">{formatNum(data.totalCapitalSocialCUP)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Monthly Breakdown sub-tab (items × months) with new classification --- */}
            <TabsContent value="tabla-mensual">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-fin-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {'Desglose Mensual por Ítem'}
                  </CardTitle>
                  <p className="text-fin-xs text-muted-foreground">
                    {'Distribución mensual de cada partida (CUP + MLC)'}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollableTable maxHeight="600px" stickyColumns={1} firstColWidth={280}>
                    <Table>
                      <TableHeader>
                        <YearMonthHeader
                          groups={monthGroups}
                          stickyColumns={1}
                          totalColumnMinWidth="100px"
                          monthColumnMinWidth="65px"
                          showYearSubtotals
                        />
                        <TableRow>
                          <TableHead rowSpan={2} style={{ minWidth: 280 }}>
                            {'Partida / Subpartida'}
                          </TableHead>
                          {monthGroups.map((group) => (
                            <React.Fragment key={`cupmlc-${group.year}`}>
                              <TableHead
                                className="text-fin-xs text-center bg-success-muted/50 text-success"
                                colSpan={group.months.length}
                              >
                                CUP / <span className="text-success">MLC$</span>
                              </TableHead>
                              <TableHead
                                className="text-fin-xs text-center bg-info-muted/50 font-semibold text-info"
                                style={{ minWidth: '55px' }}
                              >
                                Subt.
                              </TableHead>
                            </React.Fragment>
                          ))}
                          <TableHead className="text-fin-xs text-center bg-muted font-bold min-w-[100px]">
                            Total CUP
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* ═══ 1. INVERSIÓN FIJA ═══ */}
                        <TableRow className="bg-primary/5 border-t-2 border-primary/20">
                          <TableCell
                            colSpan={schedule.maxMonth + monthGroups.length + 2}
                            className="text-fin-sm font-bold py-2 text-primary"
                          >
                            {'INVERSIÓN FIJA'}
                          </TableCell>
                        </TableRow>

                        {/* A. Derechos — header only */}
                        <TableRow className="bg-muted/30">
                          <TableCell
                            colSpan={schedule.maxMonth + monthGroups.length + 2}
                            className="text-fin-xs text-muted-foreground py-1.5 pl-4"
                          >
                            {'A. Valor de los Derechos que se Aportan'}
                          </TableCell>
                        </TableRow>

                        {/* B & C groups */}
                        {inversionFijaGroups.map((group) => (
                          <React.Fragment key={`m-${group.partida}`}>
                            <TableRow className="bg-muted/50">
                              <TableCell
                                colSpan={schedule.maxMonth + monthGroups.length + 2}
                                className="text-fin-xs font-semibold text-muted-foreground py-2"
                              >
                                <span className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-fin-xs px-1.5 py-0">{group.items.length}</Badge>
                                  {group.partida}
                                </span>
                              </TableCell>
                            </TableRow>
                            {group.items.map((item, idx) => {
                              const cupPerMonth = item.months.length > 0 ? item.totalCUP / item.months.length : 0;
                              const mlcPerMonth = item.months.length > 0 ? item.totalMLC / item.months.length : 0;
                              return (
                                <TableRow key={`m-${group.partida}-${idx}`}>
                                  <TableCell className="text-fin-sm whitespace-nowrap pl-8">
                                    <span className="text-muted-foreground">{item.subpartida}</span>
                                    {' — '}
                                    {item.nombre}
                                  </TableCell>
                                  {monthGroups.map((yearGroup) => {
                                    const yearCUP = yearGroup.months.reduce((s, m) =>
                                      s + (item.months.includes(m.monthIndex + 1) ? cupPerMonth : 0), 0);
                                    const yearMLC = yearGroup.months.reduce((s, m) =>
                                      s + (item.months.includes(m.monthIndex + 1) ? mlcPerMonth : 0), 0);
                                    return (
                                      <React.Fragment key={`yr-${yearGroup.year}-${idx}`}>
                                        {yearGroup.months.map((m) => {
                                          const isActive = item.months.includes(m.monthIndex + 1);
                                          return (
                                            <TableCell
                                              key={`m-${group.partida}-${idx}-${m.monthIndex}`}
                                              className={cn(
                                                'text-fin-sm text-right tabular-nums',
                                                isActive ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                              )}
                                            >
                                              {isActive ? (
                                                <>
                                                  <div>{formatNum(cupPerMonth)}</div>
                                                  {mlcPerMonth > 0 && (
                                                    <div className="text-fin-xs text-success">{formatNum(mlcPerMonth)}$</div>
                                                  )}
                                                </>
                                              ) : '—'}
                                            </TableCell>
                                          );
                                        })}
                                        <TableCell className={cn(
                                          'text-fin-sm text-right tabular-nums font-semibold bg-info-muted/50 dark:bg-info-muted',
                                          yearCUP > 0 ? 'text-foreground' : 'text-muted-foreground/40',
                                        )}>
                                          {yearCUP > 0 ? (
                                            <>
                                              <div>{formatNum(yearCUP)}</div>
                                              {yearMLC > 0 && (
                                                <div className="text-fin-xs text-success">{formatNum(yearMLC)}$</div>
                                              )}
                                            </>
                                          ) : '—'}
                                        </TableCell>
                                      </React.Fragment>
                                    );
                                  })}
                                  <TableCell className="text-fin-sm text-right font-semibold bg-muted/50 tabular-nums">
                                    {formatNum(item.totalCUP)}
                                    {item.totalMLC > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(item.totalMLC)}$</div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Group subtotal */}
                            <TableRow className="border-t-2 border-muted font-semibold">
                              <TableCell className="text-fin-sm pl-8 text-muted-foreground">
                                {`Subtotal ${group.partida }}`}
                              </TableCell>
                              {monthGroups.map((yearGroup) => {
                                const yearTotalCUP = yearGroup.months.reduce((s, m) =>
                                  s + group.items.reduce((si, item) =>
                                    si + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                      ? item.totalCUP / item.months.length : 0), 0), 0);
                                const yearTotalMLC = yearGroup.months.reduce((s, m) =>
                                  s + group.items.reduce((si, item) =>
                                    si + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                      ? item.totalMLC / item.months.length : 0), 0), 0);
                                return (
                                  <React.Fragment key={`ms-${yearGroup.year}-${group.partida}`}>
                                    {yearGroup.months.map((m) => {
                                      const monthTotalCUP = group.items.reduce((s, item) =>
                                        s + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                          ? item.totalCUP / item.months.length : 0), 0);
                                      const monthTotalMLC = group.items.reduce((s, item) =>
                                        s + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                          ? item.totalMLC / item.months.length : 0), 0);
                                      return (
                                        <TableCell
                                          key={`ms-${group.partida}-${m.monthIndex}`}
                                          className={cn(
                                            'text-fin-sm text-right tabular-nums font-semibold',
                                            monthTotalCUP > 0 ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                          )}
                                        >
                                          {monthTotalCUP > 0 ? formatNum(monthTotalCUP) : '—'}
                                          {monthTotalMLC > 0 && (
                                            <div className="text-fin-xs text-success">{formatNum(monthTotalMLC)}$</div>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className={cn(
                                      'text-fin-sm text-right tabular-nums font-bold bg-info-muted/50 dark:bg-info-muted',
                                      yearTotalCUP > 0 ? 'text-foreground' : 'text-muted-foreground/40',
                                    )}>
                                      {yearTotalCUP > 0 ? (
                                        <>
                                          <div>{formatNum(yearTotalCUP)}</div>
                                          {yearTotalMLC > 0 && (
                                            <div className="text-fin-xs text-success">{formatNum(yearTotalMLC)}$</div>
                                          )}
                                        </>
                                      ) : '—'}
                                    </TableCell>
                                  </React.Fragment>
                                );
                              })}
                              <TableCell className="text-fin-sm text-right font-bold bg-muted/80 tabular-nums">
                                {formatNum(group.subtotalCUP)}
                                {group.subtotalMLC > 0 && (
                                  <div className="text-fin-xs text-success">{formatNum(group.subtotalMLC)}$</div>
                                )}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}

                        {/* Subtotal Inversión Fija (monthly) */}
                        <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                          <TableCell className="text-fin-sm pl-4 text-primary">{'Subtotal Inversión Fija'}</TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearCUP = yearRows.reduce((s, r) => s + r.construccionCUP + r.capitalCUP, 0);
                            const yearMLC = yearRows.reduce((s, r) => s + r.construccionMLC + r.capitalMLC, 0);
                            return (
                              <React.Fragment key={`if-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`if-${r.month}`}
                                    className="text-fin-sm text-right font-semibold tabular-nums bg-muted/50"
                                  >
                                    {formatNum(r.construccionCUP + r.capitalCUP)}
                                    {(r.construccionMLC + r.capitalMLC) > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(r.construccionMLC + r.capitalMLC)}$</div>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className={cn(
                                  'text-fin-sm text-right font-bold tabular-nums bg-info-muted/50 dark:bg-info-muted text-primary',
                                )}>
                                  {formatNum(yearCUP)}
                                  {yearMLC > 0 && <div className="text-fin-xs text-success">{formatNum(yearMLC)}$</div>}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right font-bold bg-muted/80 tabular-nums text-primary">
                            {formatNum(inversionFijaCUP)}
                            {inversionFijaMLC > 0 && <div className="text-fin-xs text-success">{formatNum(inversionFijaMLC)}$</div>}
                          </TableCell>
                        </TableRow>

                        {/* ═══ 2. GASTOS PREVIOS ═══ */}
                        <TableRow className="bg-warning-muted/30 border-t-2 border-warning">
                          <TableCell
                            colSpan={schedule.maxMonth + monthGroups.length + 2}
                            className="text-fin-sm font-bold py-2 text-warning dark:text-warning"
                          >
                            {'GASTOS PREVIOS'}
                          </TableCell>
                        </TableRow>

                        {/* D, E, Piezas, Otros, Intangibles groups */}
                        {gastosPreviosGroups.map((group) => (
                          <React.Fragment key={`m-${group.partida}`}>
                            <TableRow className="bg-muted/50">
                              <TableCell
                                colSpan={schedule.maxMonth + monthGroups.length + 2}
                                className="text-fin-xs font-semibold text-muted-foreground py-2"
                              >
                                <span className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-fin-xs px-1.5 py-0">{group.items.length}</Badge>
                                  {group.partida}
                                </span>
                              </TableCell>
                            </TableRow>
                            {group.items.map((item, idx) => {
                              const cupPerMonth = item.months.length > 0 ? item.totalCUP / item.months.length : 0;
                              const mlcPerMonth = item.months.length > 0 ? item.totalMLC / item.months.length : 0;
                              return (
                                <TableRow key={`m-${group.partida}-${idx}`}>
                                  <TableCell className="text-fin-sm whitespace-nowrap pl-8">
                                    <span className="text-muted-foreground">{item.subpartida}</span>
                                    {' — '}
                                    {item.nombre}
                                  </TableCell>
                                  {monthGroups.map((yearGroup) => {
                                    const yearCUP = yearGroup.months.reduce((s, m) =>
                                      s + (item.months.includes(m.monthIndex + 1) ? cupPerMonth : 0), 0);
                                    const yearMLC = yearGroup.months.reduce((s, m) =>
                                      s + (item.months.includes(m.monthIndex + 1) ? mlcPerMonth : 0), 0);
                                    return (
                                      <React.Fragment key={`yr-${yearGroup.year}-${idx}`}>
                                        {yearGroup.months.map((m) => {
                                          const isActive = item.months.includes(m.monthIndex + 1);
                                          return (
                                            <TableCell
                                              key={`m-${group.partida}-${idx}-${m.monthIndex}`}
                                              className={cn(
                                                'text-fin-sm text-right tabular-nums',
                                                isActive ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                              )}
                                            >
                                              {isActive ? (
                                                <>
                                                  <div>{formatNum(cupPerMonth)}</div>
                                                  {mlcPerMonth > 0 && (
                                                    <div className="text-fin-xs text-success">{formatNum(mlcPerMonth)}$</div>
                                                  )}
                                                </>
                                              ) : '—'}
                                            </TableCell>
                                          );
                                        })}
                                        <TableCell className={cn(
                                          'text-fin-sm text-right tabular-nums font-semibold bg-info-muted/50 dark:bg-info-muted',
                                          yearCUP > 0 ? 'text-foreground' : 'text-muted-foreground/40',
                                        )}>
                                          {yearCUP > 0 ? (
                                            <>
                                              <div>{formatNum(yearCUP)}</div>
                                              {yearMLC > 0 && (
                                                <div className="text-fin-xs text-success">{formatNum(yearMLC)}$</div>
                                              )}
                                            </>
                                          ) : '—'}
                                        </TableCell>
                                      </React.Fragment>
                                    );
                                  })}
                                  <TableCell className="text-fin-sm text-right font-semibold bg-muted/50 tabular-nums">
                                    {formatNum(item.totalCUP)}
                                    {item.totalMLC > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(item.totalMLC)}$</div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Group subtotal */}
                            <TableRow className="border-t-2 border-muted font-semibold">
                              <TableCell className="text-fin-sm pl-8 text-muted-foreground">
                                {`Subtotal ${group.partida }}`}
                              </TableCell>
                              {monthGroups.map((yearGroup) => {
                                const yearTotalCUP = yearGroup.months.reduce((s, m) =>
                                  s + group.items.reduce((si, item) =>
                                    si + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                      ? item.totalCUP / item.months.length : 0), 0), 0);
                                const yearTotalMLC = yearGroup.months.reduce((s, m) =>
                                  s + group.items.reduce((si, item) =>
                                    si + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                      ? item.totalMLC / item.months.length : 0), 0), 0);
                                return (
                                  <React.Fragment key={`ms-${yearGroup.year}-${group.partida}`}>
                                    {yearGroup.months.map((m) => {
                                      const monthTotalCUP = group.items.reduce((s, item) =>
                                        s + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                          ? item.totalCUP / item.months.length : 0), 0);
                                      const monthTotalMLC = group.items.reduce((s, item) =>
                                        s + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                          ? item.totalMLC / item.months.length : 0), 0);
                                      return (
                                        <TableCell
                                          key={`ms-${group.partida}-${m.monthIndex}`}
                                          className={cn(
                                            'text-fin-sm text-right tabular-nums font-semibold',
                                            monthTotalCUP > 0 ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                          )}
                                        >
                                          {monthTotalCUP > 0 ? formatNum(monthTotalCUP) : '—'}
                                          {monthTotalMLC > 0 && (
                                            <div className="text-fin-xs text-success">{formatNum(monthTotalMLC)}$</div>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className={cn(
                                      'text-fin-sm text-right tabular-nums font-bold bg-info-muted/50 dark:bg-info-muted',
                                      yearTotalCUP > 0 ? 'text-foreground' : 'text-muted-foreground/40',
                                    )}>
                                      {yearTotalCUP > 0 ? (
                                        <>
                                          <div>{formatNum(yearTotalCUP)}</div>
                                          {yearTotalMLC > 0 && (
                                            <div className="text-fin-xs text-success">{formatNum(yearTotalMLC)}$</div>
                                          )}
                                        </>
                                      ) : '—'}
                                    </TableCell>
                                  </React.Fragment>
                                );
                              })}
                              <TableCell className="text-fin-sm text-right font-bold bg-muted/80 tabular-nums">
                                {formatNum(group.subtotalCUP)}
                                {group.subtotalMLC > 0 && (
                                  <div className="text-fin-xs text-success">{formatNum(group.subtotalMLC)}$</div>
                                )}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}

                        {/* Subtotal Gastos Previos (monthly) */}
                        <TableRow className="border-t-2 border-warning bg-warning-muted/30 font-bold">
                          <TableCell className="text-fin-sm pl-4 text-warning dark:text-warning">{'Subtotal Gastos Previos'}</TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearCUP = yearRows.reduce((s, r) => s + r.subcontratacionesCUP + r.recursosHumanosCUP + r.piezasNoDepreciablesCUP + r.otrosRecursosCUP, 0);
                            const yearMLC = yearRows.reduce((s, r) => s + r.subcontratacionesMLC + r.recursosHumanosMLC + r.piezasNoDepreciablesMLC + r.otrosRecursosMLC, 0);
                            return (
                              <React.Fragment key={`gp-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`gp-${r.month}`}
                                    className="text-fin-sm text-right font-semibold tabular-nums bg-muted/50"
                                  >
                                    {formatNum(r.subcontratacionesCUP + r.recursosHumanosCUP + r.piezasNoDepreciablesCUP + r.otrosRecursosCUP)}
                                    {(r.subcontratacionesMLC + r.recursosHumanosMLC + r.piezasNoDepreciablesMLC + r.otrosRecursosMLC) > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(r.subcontratacionesMLC + r.recursosHumanosMLC + r.piezasNoDepreciablesMLC + r.otrosRecursosMLC)}$</div>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className={cn(
                                  'text-fin-sm text-right font-bold tabular-nums bg-info-muted/50 dark:bg-info-muted text-warning dark:text-warning',
                                )}>
                                  {formatNum(yearCUP)}
                                  {yearMLC > 0 && <div className="text-fin-xs text-success">{formatNum(yearMLC)}$</div>}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right font-bold bg-muted/80 tabular-nums text-warning dark:text-warning">
                            {formatNum(gastosPreviosCUP)}
                            {gastosPreviosMLC > 0 && <div className="text-fin-xs text-success">{formatNum(gastosPreviosMLC)}$</div>}
                          </TableCell>
                        </TableRow>

                        {/* CAPITAL FIJO (monthly) */}
 <TableRow className="border-t-2 border-muted fin-table-total">
                          <TableCell className="text-fin-sm pl-4">{'CAPITAL FIJO'}</TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearCUP = yearRows.reduce((s, r) => s + r.subtotalInversionCUP, 0);
                            const yearMLC = yearRows.reduce((s, r) => s + r.subtotalInversionMLC, 0);
                            return (
                              <React.Fragment key={`cf-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`cf-${r.month}`}
                                    className="text-fin-sm text-right font-bold tabular-nums bg-muted/50"
                                  >
                                    {formatNum(r.subtotalInversionCUP)}
                                    {r.subtotalInversionMLC > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(r.subtotalInversionMLC)}$</div>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="text-fin-sm text-right font-bold tabular-nums bg-info-muted/60 dark:bg-info-muted text-info dark:text-info">
                                  {formatNum(yearCUP)}
                                  {yearMLC > 0 && <div className="text-fin-xs text-success">{formatNum(yearMLC)}$</div>}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right font-bold bg-muted tabular-nums text-info dark:text-info">
                            {formatNum(data.subtotalCUP)}
                            {data.subtotalMLC > 0 && <div className="text-fin-xs text-success">{formatNum(data.subtotalMLC)}$</div>}
                          </TableCell>
                        </TableRow>

                        {/* Contingency row */}
                        <TableRow className="bg-warning-muted/50 font-semibold">
                          <TableCell className="text-fin-sm text-warning">
                            {`Reservas para Contingencias Inversión (${contingencyPct }}%)`}
                          </TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearContCUP = yearGroup.months.reduce((s, m) => {
                              const monthInvCUP = data.items.reduce((si, item) =>
                                si + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                  ? item.totalCUP / item.months.length : 0), 0);
                              return s + monthInvCUP * (store.parameters.contingencyReserveRate || 0);
                            }, 0);
                            return (
                              <React.Fragment key={`cont-yr-${yearGroup.year}`}>
                                {yearGroup.months.map((m) => {
                                  const monthInvCUP = data.items.reduce((s, item) =>
                                    s + (item.months.includes(m.monthIndex + 1) && item.months.length > 0
                                      ? item.totalCUP / item.months.length : 0), 0);
                                  const contCUP = monthInvCUP * (store.parameters.contingencyReserveRate || 0);
                                  return (
                                    <TableCell
                                      key={`cont-${m.monthIndex}`}
                                      className={cn(
                                        'text-fin-sm text-right tabular-nums text-warning',
                                        contCUP > 0 ? 'bg-white' : 'bg-muted/20 text-muted-foreground/40',
                                      )}
                                    >
                                      {contCUP > 0 ? formatNum(contCUP) : '—'}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className={cn(
                                  'text-fin-sm text-right tabular-nums font-bold text-warning bg-info-muted/50 dark:bg-info-muted',
                                  yearContCUP > 0 ? 'text-warning' : 'text-muted-foreground/40',
                                )}>
                                  {yearContCUP > 0 ? formatNum(yearContCUP) : '—'}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-warning bg-muted/80">
                            {formatNum(data.contingencyCUP)}
                          </TableCell>
                        </TableRow>

                        {/* Working Capital row */}
                        <TableRow className="bg-success-muted/50 font-semibold">
                          <TableCell className="text-fin-sm text-success">
                            {'Capital de Trabajo Inicial'}
                          </TableCell>
                          {monthGroups.map((yearGroup) => (
                            <React.Fragment key={`wc-yr-${yearGroup.year}`}>
                              {yearGroup.months.map((m) => (
                                <TableCell
                                  key={`wc-${m.monthIndex}`}
                                  className={cn(
                                    'text-fin-sm text-right tabular-nums text-success',
                                    m.monthIndex === 0 && data.initialWCCUP > 0 ? 'bg-white' : 'bg-muted/20 text-muted-foreground/40',
                                  )}
                                >
                                  {m.monthIndex === 0 && data.initialWCCUP > 0 ? formatNum(data.initialWCCUP) : '—'}
                                </TableCell>
                              ))}
                              <TableCell className={cn(
                                'text-fin-sm text-right tabular-nums font-bold text-success bg-info-muted/50 dark:bg-info-muted',
                                yearGroup.year === monthGroups[0].year && data.initialWCCUP > 0 ? 'text-success' : 'text-muted-foreground/40',
                              )}>
                                {yearGroup.year === monthGroups[0].year && data.initialWCCUP > 0 ? formatNum(data.initialWCCUP) : '—'}
                              </TableCell>
                            </React.Fragment>
                          ))}
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-muted/80">
                            {formatNum(data.initialWCCUP)}
                          </TableCell>
                        </TableRow>

                        {/* COSTO TOTAL DE INVERSIÓN INICIAL */}
                        <TableRow className="fin-table-total">
                          <TableCell className="text-sm">
                            {'COSTO TOTAL DE INVERSIÓN INICIAL'}
                          </TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearTotalCUP = yearRows.reduce((s, r) => s + r.totalInversionCUP, 0);
                            const yearTotalMLC = yearRows.reduce((s, r) => s + r.totalInversionMLC, 0);
                            return (
                              <React.Fragment key={`total-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`total-${r.month}`}
                                    className="text-fin-sm text-right font-bold tabular-nums bg-muted/50"
                                  >
                                    {formatNum(r.totalInversionCUP)}
                                    {r.totalInversionMLC > 0 && (
                                      <div className="text-fin-xs text-success">{formatNum(r.totalInversionMLC)}$</div>
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="text-fin-sm text-right font-bold tabular-nums bg-info-muted/60 dark:bg-info-muted text-info dark:text-info">
                                  {formatNum(yearTotalCUP)}
                                  {yearTotalMLC > 0 && (
                                    <div className="text-fin-xs text-success">{formatNum(yearTotalMLC)}$</div>
                                  )}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-sm text-right font-bold bg-muted tabular-nums text-info dark:text-info">
                            {formatNum(data.grandTotalCUP)}
                          </TableCell>
                        </TableRow>

                        {/* (−) Préstamos Recibidos — monthly breakdown */}
                        <TableRow className="bg-danger-muted/50 border-t-2 border-slate-300">
                          <TableCell className="text-fin-sm font-semibold text-danger dark:text-danger pl-4">
                            (−) {'Préstamos Recibidos'}
                          </TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearPrestamoCUP = yearRows.reduce((s, r) => s + r.prestamoCUP, 0);
                            return (
                              <React.Fragment key={`prest-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`prest-${r.month}`}
                                    className={cn(
                                      'text-fin-sm text-right tabular-nums text-danger dark:text-danger',
                                      r.prestamoCUP > 0 ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                    )}
                                  >
                                    {r.prestamoCUP > 0 ? formatNum(r.prestamoCUP) : '—'}
                                  </TableCell>
                                ))}
                                <TableCell className={cn(
                                  'text-fin-sm text-right font-bold tabular-nums bg-info-muted/50 dark:bg-info-muted text-danger dark:text-danger',
                                  yearPrestamoCUP > 0 ? 'text-danger' : 'text-muted-foreground/40',
                                )}>
                                  {yearPrestamoCUP > 0 ? formatNum(yearPrestamoCUP) : '—'}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-danger dark:text-danger bg-muted/80">
                            {formatNum(data.totalLoanCUP)}
                          </TableCell>
                        </TableRow>

                        {/* (=) Capital Social o Propio — monthly breakdown */}
                        <TableRow className="bg-info-muted/50 border-t-2 border-muted ">
                          <TableCell className="text-fin-sm font-bold text-info dark:text-info pl-4">
                            (=) {'Capital Social o Propio'}
                          </TableCell>
                          {monthGroups.map((yearGroup) => {
                            const yearRows = scheduleByYear.get(yearGroup.year) || [];
                            const yearCSCUP = yearRows.reduce((s, r) => s + r.capitalSocialCUP, 0);
                            return (
                              <React.Fragment key={`cs-yr-${yearGroup.year}`}>
                                {yearRows.map((r) => (
                                  <TableCell
                                    key={`cs-${r.month}`}
                                    className={cn(
                                      'text-fin-sm text-right font-bold tabular-nums text-info dark:text-info',
                                      r.capitalSocialCUP > 0 ? 'bg-white dark:bg-white/5' : 'bg-muted/20 text-muted-foreground/40',
                                    )}
                                  >
                                    {r.capitalSocialCUP > 0 ? formatNum(r.capitalSocialCUP) : '—'}
                                  </TableCell>
                                ))}
                                <TableCell className={cn(
                                  'text-fin-sm text-right font-bold tabular-nums bg-info-muted/60 dark:bg-info-muted text-info dark:text-info',
                                  yearCSCUP > 0 ? 'text-info' : 'text-muted-foreground/40',
                                )}>
                                  {yearCSCUP > 0 ? formatNum(yearCSCUP) : '—'}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                          <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info bg-muted">
                            {formatNum(data.totalCapitalSocialCUP)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== CURRENCY SUMMARY TAB ===== */}
        <TabsContent value="resumen">
          <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
                <CardTitle className="text-fin-sm font-semibold">{'Resumen por Moneda'}</CardTitle>
                <TableExportButton
                  moduleName="Presupuesto de Inversión"
                  tableName="Resumen por Moneda"
                  headers={currencySummaryExport.headers}
                  rows={currencySummaryExport.rows}
                />
              </div>
            </CardHeader><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="">{'Concepto'}</TableHead>
                    <TableHead className="text-right text-info dark:text-info">CUP (MN)</TableHead>
                    <TableHead className="text-right text-success dark:text-success">MLC (USD)</TableHead>
                    <TableHead className="text-right text-panel-b dark:text-panel-b">{'CL'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Inversión Fija */}
                  <TableRow className="bg-primary/5">
                    <TableCell className="text-fin-sm font-semibold text-primary">{'INVERSIÓN FIJA'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(inversionFijaCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(inversionFijaMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">
                      {formatNum(inversionFijaCLConvertido)}
                    </TableCell>
                  </TableRow>
                  {/* Gastos Previos */}
                  <TableRow className="bg-warning-muted/30">
                    <TableCell className="text-fin-sm font-semibold text-warning dark:text-warning">{'GASTOS PREVIOS'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(gastosPreviosCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(gastosPreviosMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">
                      {formatNum(gastosPreviosCLConvertido)}
                    </TableCell>
                  </TableRow>
                  {/* Capital Fijo */}
 <TableRow className="fin-table-total">
                    <TableCell className="text-fin-sm">{'CAPITAL FIJO'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.subtotalCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.subtotalMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">
                      {formatNum(capitalFijoCLConvertido)}
                    </TableCell>
                  </TableRow>
                  {/* Contingency */}
                  <TableRow className="bg-warning-muted/50">
                    <TableCell className="text-fin-sm text-warning font-semibold">
                      {`Reservas para Contingencias Inversión (${contingencyPct }}%)`}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.contingencyCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.contingencyMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(contingencyCLConvertido)}</TableCell>
                  </TableRow>
                  {/* Working Capital */}
                  <TableRow className="bg-success-muted/50">
                    <TableCell className="text-fin-sm text-success font-semibold">
                      {'Capital de Trabajo Inicial'}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.initialWCCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(data.initialWCMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(wcCLConvertido)}</TableCell>
                  </TableRow>
                  {/* Total (CUP+MLC) */}
                  <TableRow className="border-t-2 border-muted">
                    <TableCell className="text-fin-sm font-semibold">{'Total (CUP + MLC)'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(data.totalCUP)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(data.totalMLC)}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold">
                      {formatNum((rates.cupToCl > 0 ? data.totalCUP / rates.cupToCl : 0) + (rates.mlcToCl > 0 ? data.totalMLC / rates.mlcToCl : data.totalMLC))}
                    </TableCell>
                  </TableRow>
                  {/* Grand Total */}
                  <TableRow className="fin-table-total">
                    <TableCell className="text-sm">{'TOTAL GENERAL DE INVERSIÓN'}</TableCell>
                    <TableCell className="text-sm text-right text-info dark:text-info">
                      {formatNum(data.grandTotalCUP)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-success dark:text-success">
                      {formatNum(data.grandTotalMLC)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-panel-b dark:text-panel-b">
                      {formatNum(data.grandTotalCL)}
                    </TableCell>
                  </TableRow>
                  {/* (−) Préstamos Recibidos */}
                  <TableRow className="bg-danger-muted/50 border-t-2 border-slate-300">
                    <TableCell className="text-fin-sm font-semibold text-danger dark:text-danger pl-4">
                      (−) {'Préstamos Recibidos'}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger dark:text-danger">
                      {formatNum(data.totalLoanCUP)}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums text-muted-foreground">{'—'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums text-muted-foreground">{'—'}</TableCell>
                  </TableRow>
                  {/* (=) Capital Social o Propio */}
                  <TableRow className="bg-info-muted/50 border-t-2 border-muted ">
                    <TableCell className="text-fin-sm font-bold text-info dark:text-info pl-4">
                      (=) {'Capital Social o Propio'}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info dark:text-info">
                      {formatNum(data.totalCapitalSocialCUP)}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums text-muted-foreground">{'—'}</TableCell>
                    <TableCell className="text-fin-sm text-right tabular-nums text-muted-foreground">{'—'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CHART TAB ===== */}
      </Tabs>
    </div>
  );
}
