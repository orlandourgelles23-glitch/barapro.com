// ============================================================
// BARAPRO v10.1 — DOCX EXPORT MODULE (Professional Edition)
// Evaluación Financiera de Proyectos (Cuba PDL Methodology)
// ============================================================
// Architecture: CalcCache (DRY), Main Body = Portrait/Annual,
// Monthly Detail = Annexes (Landscape), Executive Summary,
// Professional Cover, Smart Interpretations, Merged Sections.
// ============================================================

import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, ImageRun, HeadingLevel, AlignmentType, WidthType,
  BorderStyle, PageBreak, Header, Footer, PageNumber,
  ShadingType, convertInchesToTwip, PageOrientation,
  TableLayoutType, SectionType,
} from 'docx';
import { BARAPRO_LOGO_BASE64, BARAPRO_LOGO_MEDIA_TYPE } from './barapro-logo';

// ============================================================
// ENVIRONMENT-AWARE BASE64 DECODER
// Browser: uses atob() — Buffer.from does NOT exist in browser.
// Server (Node.js): uses Buffer.from — atob does NOT exist in Node.
// ============================================================
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Browser
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ============================================================
// ROBUST BLOB DOWNLOAD (replaces file-saver's saveAs)
// - appendChild before click (Firefox/Safari compatibility)
// - Delayed revokeObjectURL (prevents corrupt downloads)
// - Proper DOM cleanup
// ============================================================
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Wait 1 second before revoking so browser can finish reading the blob
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import type { BaraproState } from './barapro-store';
import {
  buildInvestmentBudget, buildDepreciationByItem,
  buildCurrentCosts, buildFinancialCosts,
  buildCostTimeline,
  buildCurrencyEffect,
  buildCashFlowPlanning, buildCashFlowInvestment, buildCashFlowEquity,
  buildRevenueTimeline,
  buildEstadoResultados, buildEstadoCostosProduccion,
  buildERFComercial, buildEnhancedERF,
  buildBalanceSheet, buildUtilityDistribution,
  buildIncomeStatement,
  buildWorkingCapital,
  calcVAN, calcTIR, calcPR, calcRelacionBeneficioCosto,
  calcCapitalRecuperado, calcTasaRendimiento, calcIndiceRentabilidad,
  calcValorAnualEquivalente,
  calcTIRM, calcPRA, calcRVAN, calcPuntoEquilibrio, calcMargenSeguridad,
  calcVPN_Beta,
  calcBCWithIP, calcIRWithIP, calcVAEWithIP, calcPRAWithIP,
  calcAmortizacion, buildAnnualLoanSummary, buildExternalFinancialBalance,
  buildAllSalaryContribsMonthly, buildOtherTaxesTimeline,
  buildInvestmentSchedule,
  findOperationStartMonth,
} from './barapro-financial';

// ============================================================
// COLOR PALETTE
// ============================================================
const COLORS = {
  primary: '1565C0',        // Blue 800
  darkPrimary: '0D47A1',    // Blue 900
  accent: '1976D2',         // Blue 700
  ltBlue: 'E3F2FD',         // Blue 50
  midBlue: 'BBDEFB',        // Blue 100
  white: 'FFFFFF',
  dark: '1A237E',           // Indigo 900 (darker text for better readability)
  gray: '546E7A',           // Blue-grey 600
  ltGray: 'F5F5F5',
  border: '90CAF9',         // Blue 200 (softer blue borders)
  altRow: 'E8EAF6',         // Indigo 50
  yearSep: 'C5CAE9',        // Indigo 100
  red: 'C62828',
  orange: 'E65100',
  gold: 'F9A825',
  headerBg: '0D47A1',      // Dark blue for header
  totalBg: 'E3F2FD',       // Light blue for totals
  subtotalBg: 'BBDEFB',    // Medium blue for subtotals
};

// ============================================================
// NUMBER FORMATTING
// MUST match UI format.ts: formatCurrency() uses 1 decimal,
// formatDecimal() uses 2 decimals by default.
// The DOCX must show IDENTICAL numbers to what the UI displays.
// NEVER recalculate — format raw numeric values with same precision.
// ============================================================
function fmt(n: number, decimals = 1): string {
  if (n === undefined || n === null || !isFinite(n) || isNaN(n)) return '0';
  return n.toLocaleString('es-CU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Safe string conversion — never outputs 'undefined' or 'null' */
function safeStr(val: any, fallback = '—'): string {
  if (val === undefined || val === null || val === '') return fallback;
  return String(val);
}

/** Format a percentage value that is already in % units (e.g. 15 → "15,00%")
 *  Matches UI formatPercent() which does value.toFixed(2) + '%' */
function fmtPct(n: number, decimals = 2): string {
  if (n === undefined || n === null || !isFinite(n) || isNaN(n)) return '0%';
  return n.toLocaleString('es-CU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}

/** Format a ratio as percentage (e.g. 0.15 → "15,00%")
 *  Values coming from barapro-financial.ts are in decimal form (0.15 = 15%),
 *  so we multiply by 100 for display, matching the UI's presentation. */
function fmtCalcPct(n: number, decimals = 2): string {
  if (n === undefined || n === null || !isFinite(n) || isNaN(n)) return '0%';
  return (n * 100).toLocaleString('es-CU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}

/** Format a ratio/financial index with 2 decimals — matches UI formatDecimal(n, 2)
 *  Used for B/C ratio, RVAN, IR, etc. */
function fmtRatio(n: number, decimals = 2): string {
  if (n === undefined || n === null) return '—';
  return isFinite(n) ? n.toLocaleString('es-CU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) : '—';
}

// ============================================================
// BORDERS
// ============================================================
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const accentBottomBorder = { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent };
const totalLeftBorder = { style: BorderStyle.SINGLE, size: 2, color: COLORS.darkPrimary };

function totalHeaderCell(widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: COLORS.darkPrimary, fill: COLORS.darkPrimary },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.headerBg },
      bottom: accentBottomBorder,
      left: totalLeftBorder,
      right: { style: BorderStyle.SINGLE, size: 1, color: '1565C0' },
    },
    verticalAlign: 'center',
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30, line: 240 },
      children: [new TextRun({ text: 'Total', bold: true, color: COLORS.white, size: 15, font: 'Calibri' })],
    })],
  });
}
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
};

// ============================================================
// PAGE CONSTANTS (DXA)
// ============================================================
const A4_PORTRAIT_W = 11906;
const A4_LANDSCAPE_W = 16838;
const MARGIN_LANDSCAPE = {
  top: convertInchesToTwip(0.5), bottom: convertInchesToTwip(0.5),
  left: convertInchesToTwip(0.4), right: convertInchesToTwip(0.4),
};
const MARGIN_PORTRAIT_NARROW = {
  top: convertInchesToTwip(0.6), bottom: convertInchesToTwip(0.6),
  left: convertInchesToTwip(0.6), right: convertInchesToTwip(0.6),
};

function availableWidth(pageW: number, margins: { left: number; right: number }) {
  return pageW - margins.left - margins.right;
}

function calcDxaWidths(pageW: number, margins: { left: number; right: number }, weights: number[]): number[] {
  const aw = availableWidth(pageW, margins);
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map(w => Math.round((w / total) * aw));
}

const CELL_MARGINS_TIGHT = { top: 30, bottom: 30, left: 40, right: 40 };
const CELL_MARGINS_NORMAL = { top: 40, bottom: 40, left: 60, right: 60 };

// ============================================================
// CALC CACHE — All computations run ONCE
// ============================================================
interface CalcCache {
  budget: any;
  dep: any;
  depMonthlyData: any[];
  wcData: any[] | null;
  finCosts: any[] | null;
  loanSummary: any;
  erf: any[] | null;
  erfComercial: any[] | null;
  costos: any[] | null;
  cfPlanning: any;
  invCF: any;
  eqCF: any;
  extFin: any[] | null;
  bs: any[] | null;
  dist: any[] | null;
  currEffect: any[] | null;
  otherTaxes: any[] | null;
  schedResult: any;
  salaryContribs: any[] | null;
  // Indicators — Inversión
  van: number;
  tir: number | null;
  pr: number | null;
  pra: number | null;
  rvan: number;
  tirm: number | null;
  relacionBC: number;
  indiceRent: number;
  vae: number;
  vpnBeta: number;
  capitalRec: any;
  tasaRendimiento: number | null;
  puntoEquilibrio: number;
  margenSeguridad: number;
  // Indicators — Capital
  vanCapital: number;
  tirCapital: number | null;
  // Revenue/Cost totals
  revTotal: number;
  costTotal: number;
  totalInvestment: number;
  // Cash flows for indicators
  invCashFlows: number[];
  eqCashFlows: number[];
}

function buildCalcCache(state: BaraproState): CalcCache {
  const duration = state.project.monthsDuration || 120;
  const discountRate = (state.parameters.discountRateCUP || 0) / 100;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;

  // Run all calculations ONCE
  const budget = safeCall(() => buildInvestmentBudget(state));
  const dep = safeCall(() => buildDepreciationByItem(state));
  const wcData = safeCall(() => buildWorkingCapital(state), []);
  const finCosts = safeCall(() => buildFinancialCosts(state), []);
  const loanSummary = safeCall(() => buildAnnualLoanSummary(state));
  const erf: any[] | null = safeCall(() => buildEnhancedERF(state));
  const erfComercial: any[] = safeCall(() => buildERFComercial(state)) ?? [];
  const costos = safeCall(() => buildEstadoCostosProduccion(state), []);
  const cfPlanning = safeCall(() => buildCashFlowPlanning(state));
  const invCF = safeCall(() => buildCashFlowInvestment(state));
  const eqCF = safeCall(() => buildCashFlowEquity(state));
  const extFin = safeCall(() => buildExternalFinancialBalance(state), []);
  const bs = safeCall(() => buildBalanceSheet(state), []);
  const dist = safeCall(() => buildUtilityDistribution(state), []);
  const currEffect = safeCall(() => buildCurrencyEffect(state), []);
  const otherTaxes = safeCall(() => buildOtherTaxesTimeline(state), []);
  const schedResult = safeCall(() => buildInvestmentSchedule(state));
  const salaryContribs = safeCall(() => buildAllSalaryContribsMonthly(state), []);

  // Depreciation monthly data
  const depMonthlyData: any[] = [];
  if (dep) {
    for (let m = 0; m < duration; m++) {
      depMonthlyData.push({
        month: m + 1,
        depreciation: (dep as any).totalMonthlyDepreciation?.[m] || 0,
        amortization: (dep as any).totalMonthlyAmortization?.[m] || 0,
        total: ((dep as any).totalMonthlyDepreciation?.[m] || 0) + ((dep as any).totalMonthlyAmortization?.[m] || 0),
      });
    }
  }

  // ── Primary indicators from buildCashFlowInvestment (authoritative source) ──
  const van = (invCF as any)?.indicators?.van ?? 0;
  const tir = (invCF as any)?.indicators?.tir ?? null;
  const pr = (invCF as any)?.indicators?.pr ?? null;
  const pra = (invCF as any)?.indicators?.pra ?? null;
  const rvan = (invCF as any)?.indicators?.rvan ?? 0;

  // ── Capital indicators from buildCashFlowEquity ──
  const vanCapital = (eqCF as any)?.indicators?.van ?? 0;
  const tirCapital = (eqCF as any)?.indicators?.tir ?? null;

  // ── Additional indicators from investment cash flow (same source as UI) ──
  let tirm: number | null = null;
  let relacionBC = 0;
  let indiceRent = 0;
  let vae = 0;
  let vpnBeta = 0;
  let capitalRec = { recovered: 0, unrecovered: 0, percentage: 0, period: null as number | null };
  let tasaRendimiento: number | null = null;
  const invCashFlows: number[] = [];
  const eqCashFlows: number[] = [];

  try {
    // Use investment cash flow annual data (same source as indicators-view.tsx)
    if (invCF && (invCF as any).monthly && (invCF as any).monthly.length > 0) {
      const invMonthly = (invCF as any).monthly;
      // Build annual flows from monthly data (same as UI's monthlyToAnnual)
      const numYears = Math.ceil(duration / 12);
      const investmentAnnualFlows: number[] = [];
      for (let yr = 0; yr < numYears; yr++) {
        let yearTotal = 0;
        for (let m = yr * 12; m < Math.min((yr + 1) * 12, duration); m++) {
          if (invMonthly[m]) {
            yearTotal += (invMonthly[m] as any).saldoAnual || (invMonthly[m] as any).flujoNeto || 0;
          }
        }
        investmentAnnualFlows.push(yearTotal);
      }
      // Build per-month flows for invCashFlows
      for (const row of invMonthly) {
        invCashFlows.push((row as any).saldoAnual || (row as any).flujoNeto || 0);
      }
      // Calculate investmentYears for *WithIP variants
      const opStartMonth = (invCF as any).info?.operationStartMonth
        || (safeCall(() => findOperationStartMonth(state)) || 1);
      const investmentMonths = opStartMonth > duration ? 0 : opStartMonth - 1;
      const investmentYears = Math.ceil(investmentMonths / 12);

      // Use *WithIP variants that handle investment period correctly (matching UI)
      const tma = (state.parameters.minimumAcceptableRate || 0) / 100;
      tirm = safeCalcNull(() => calcTIRM(investmentAnnualFlows, tma, tma));
      relacionBC = safeCalc(() => calcBCWithIP(investmentAnnualFlows, discountRate, investmentYears));
      capitalRec = safeCalc(() => calcCapitalRecuperado(investmentAnnualFlows), { recovered: 0, unrecovered: 0, percentage: 0, period: null });
      tasaRendimiento = safeCalcNull(() => calcTasaRendimiento(investmentAnnualFlows));
      indiceRent = safeCalc(() => calcIRWithIP(investmentAnnualFlows, discountRate, investmentYears));
      vae = safeCalc(() => calcVAEWithIP(investmentAnnualFlows, discountRate, investmentYears));
      vpnBeta = safeCalc(() => calcVPN_Beta(investmentAnnualFlows, discountRate, discountRate));
    }
  } catch { /* use defaults */ }

  try {
    if (eqCF?.monthly) {
      for (const m of eqCF.monthly) eqCashFlows.push((m as any).saldoAnual || (m as any).flujoNeto || 0);
    }
  } catch { /* empty */ }

  const puntoEquilibrio = safeCalc(() => calcPuntoEquilibrio(state));
  const margenSeguridad = safeCalc(() => calcMargenSeguridad(state));

  // ── Revenue/Cost totals ──
  let revTotal = 0;
  let costTotal = 0;
  try {
    const revenue = buildRevenueTimeline(state);
    for (const r of revenue) { revTotal += (r.cup || 0) + (r.mlc || 0) * cupToMlc; }
  } catch { /* empty */ }
  try {
    const currentCosts = buildCurrentCosts(state);
    for (const c of currentCosts) { costTotal += (c as any).totalCostosCorrientes || 0; }
  } catch { /* empty */ }

  // Total investment from budget
  const totalInvestment = (budget as any)?.grandTotalCUP || (budget as any)?.totalInversionCUP || 0;

  return {
    budget, dep, depMonthlyData, wcData, finCosts, loanSummary,
    erf, erfComercial, costos, cfPlanning, invCF, eqCF, extFin,
    bs, dist, currEffect, otherTaxes, schedResult, salaryContribs,
    van, tir, pr, pra, rvan, tirm, relacionBC, indiceRent, vae,
    vpnBeta, capitalRec, tasaRendimiento, puntoEquilibrio, margenSeguridad,
    vanCapital, tirCapital, revTotal, costTotal, totalInvestment,
    invCashFlows, eqCashFlows,
  };
}

function safeCall<T>(fn: () => T, fallback: T | null = null): T | null {
  try { return fn(); } catch { return fallback as T; }
}

function safeCalc<T>(fn: () => T, fallback: T = 0 as T): T {
  try { return fn(); } catch { return fallback; }
}

function safeCalcNull(fn: () => number | null): number | null {
  try { return fn(); } catch { return null; }
}

function hasSignificantData(data: any[], getValue: (item: any) => number, threshold = 0.001): boolean {
  if (!data || data.length === 0) return false;
  return data.some(d => Math.abs(getValue(d)) > threshold);
}

// ============================================================
// TABLE CELL FACTORIES
// ============================================================
function headerCell(
  text: string, widthDxa: number,
  alignment: typeof AlignmentType.LEFT | typeof AlignmentType.CENTER | typeof AlignmentType.RIGHT = AlignmentType.CENTER,
  fontSize = 18,
): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: COLORS.headerBg, fill: COLORS.headerBg },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.headerBg },
      bottom: accentBottomBorder,
      left: { style: BorderStyle.SINGLE, size: 1, color: '1565C0' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '1565C0' },
    },
    verticalAlign: 'center',
    
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    children: [new Paragraph({
      alignment,
      spacing: { before: 30, after: 30, line: 240 },
      children: [new TextRun({ text, bold: true, color: COLORS.white, size: fontSize, font: 'Calibri' })],
    })],
  });
}

function dataCell(
  text: string, widthDxa: number,
  options?: { bold?: boolean; align?: any; bgColor?: string; color?: string; fontSize?: number; compact?: boolean; conceptBorder?: boolean; totalCol?: boolean },
): TableCell {
  const opts = options || {};
  const lightBorder = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
  let borders: any = { top: lightBorder, bottom: lightBorder, left: lightBorder, right: lightBorder };
  if (opts.conceptBorder) {
    borders.left = { style: BorderStyle.SINGLE, size: 3, color: COLORS.accent };
  }
  if (opts.totalCol) {
    borders.left = totalLeftBorder;
    borders.top = { style: BorderStyle.SINGLE, size: 2, color: COLORS.darkPrimary };
  }
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders,
    verticalAlign: 'center',
    margins: opts.compact ? { top: 30, bottom: 30, left: 50, right: 50 } : { top: 50, bottom: 50, left: 80, right: 80 },
    shading: opts.bgColor ? { type: ShadingType.SOLID, color: opts.bgColor, fill: opts.bgColor } : undefined,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: opts.compact ? 10 : 20, after: opts.compact ? 10 : 20, line: 260 },
      children: [new TextRun({
        text: text || '', size: opts.fontSize || 18, font: 'Calibri',
        bold: opts.bold, color: opts.color || COLORS.dark,
      })],
    })],
  });
}

// ============================================================
// PARAGRAPH FACTORIES
// ============================================================
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 420, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.primary, space: 6 },
      left: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent, space: 8 },
    },
    indent: { left: 120 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Calibri', color: COLORS.primary })],
  });
}

function partHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 600, after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.darkPrimary, space: 10 } },
    children: [new TextRun({ text, bold: true, size: 36, font: 'Calibri', color: COLORS.darkPrimary })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    border: { left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.midBlue, space: 6 } },
    indent: { left: 80 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri', color: COLORS.accent })],
  });
}

function bodyText(text: string, bold = false, color?: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 20, font: 'Calibri', bold, color: color || COLORS.dark })],
  });
}

function interpretationText(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: 'Interpretación: ', bold: true, size: 20, font: 'Calibri', color: COLORS.accent }),
      new TextRun({ text, italics: true, size: 20, font: 'Calibri', color: COLORS.gray }),
    ],
  });
}

function emptyPara(size = 200): Paragraph {
  return new Paragraph({ spacing: { before: size, after: 0 }, children: [] });
}

function pageBreakPara(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

// ============================================================
// TABLE BUILDERS (FIXED layout + cantSplit)
// ============================================================
function buildTable(
  headers: { text: string; widthPct: number; align?: any }[],
  rows: { cells: string[]; bold?: boolean; highlight?: boolean }[],
  forceLandscape?: boolean,
): Table {
  const numCols = headers.length;
  const useLandscape = forceLandscape === true || numCols > 5;
  const pw = useLandscape ? A4_LANDSCAPE_W : A4_PORTRAIT_W;
  const mg = useLandscape ? MARGIN_LANDSCAPE : MARGIN_PORTRAIT_NARROW;
  const widths = calcDxaWidths(pw, mg, headers.map(h => h.widthPct));

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [
      new TableRow({
        
        children: headers.map((h, i) => headerCell(h.text, widths[i], h.align, 16)),
      }),
      ...rows.map((row, idx) =>
        new TableRow({
          cantSplit: true,
          children: row.cells.map((cell, ci) => {
            const isTotal = row.bold && row.highlight;
            const bg = isTotal ? COLORS.totalBg : row.highlight ? COLORS.subtotalBg : idx % 2 === 1 ? COLORS.altRow : undefined;
            return dataCell(cell, widths[ci], {
              bold: row.bold || (ci === 0 && !row.highlight),
              align: ci === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
              bgColor: bg,
              color: isTotal ? COLORS.darkPrimary : undefined,
              conceptBorder: ci === 0,
            });
          }),
        }),
      ),
    ],
  });
}

// ============================================================
// ANNUAL SUMMARY TABLE BUILDER
// ============================================================
interface AnnualConceptDef {
  label: string;
  bold?: boolean;
  highlight?: boolean;
  decimals?: number;  // Override default fmt() decimal places (e.g. 2 for ratios)
  isRatio?: boolean;  // If true, uses fmtRatio() instead of fmt() for display; Total column shows '—'
  isCumulative?: boolean; // If true, values are cumulative — year col = last month of year, Total = last value (NOT sum)
  getValue: (monthData: any, monthIdx: number) => number;
}

function buildAnnualSummaryTable(
  conceptos: AnnualConceptDef[],
  monthlyData: any[],
  duration: number,
): Table {
  const numYears = Math.ceil(duration / 12);
  const conceptWeight = 3;
  const yearWeight = 1.2;
  const totalWeight = 1.4;
  const weights = [conceptWeight, ...Array(numYears).fill(yearWeight), totalWeight];
  const widths = calcDxaWidths(A4_PORTRAIT_W, MARGIN_PORTRAIT_NARROW, weights);

  const headerRow = new TableRow({
    
    children: [
      headerCell('Concepto', widths[0], AlignmentType.LEFT, 15),
      ...Array.from({ length: numYears }, (_, i) =>
        headerCell(`Año ${i + 1}`, widths[i + 1], AlignmentType.CENTER, 14),
      ),
      totalHeaderCell(widths[widths.length - 1]),
    ],
  });

  const dataRows = conceptos.map((concepto, conceptIdx) => {
    const cells: TableCell[] = [];
    cells.push(dataCell(concepto.label, widths[0], {
      bold: concepto.bold, align: AlignmentType.LEFT, fontSize: 14, compact: true,
      bgColor: conceptIdx % 2 === 1 ? COLORS.altRow : undefined,
      conceptBorder: true,
    }));

    let grandTotal = 0;
    let lastCumulativeValue = 0;
    for (let yr = 0; yr < numYears; yr++) {
      const startM = yr * 12;
      const endM = Math.min(startM + 12, duration);
      let yearTotal = 0;
      if (concepto.isCumulative) {
        // For cumulative values: take the LAST month of the year's value
        const lastM = endM - 1;
        yearTotal = monthlyData[lastM] ? concepto.getValue(monthlyData[lastM], lastM) : 0;
        lastCumulativeValue = yearTotal;
      } else {
        for (let m = startM; m < endM; m++) {
          yearTotal += monthlyData[m] ? concepto.getValue(monthlyData[m], m) : 0;
        }
        grandTotal += yearTotal;
      }
      // Use custom decimals/ratio formatting if specified
      const displayVal = concepto.isRatio ? fmtRatio(yearTotal) : fmt(yearTotal, concepto.decimals ?? 1);
      cells.push(dataCell(displayVal, widths[yr + 1], {
        bold: concepto.bold, align: AlignmentType.RIGHT, fontSize: 14, compact: true,
        bgColor: concepto.highlight ? COLORS.subtotalBg : conceptIdx % 2 === 1 ? COLORS.altRow : undefined,
      }));
    }

    // Ratios don't sum meaningfully — show '—' in Total column
    if (concepto.isRatio) {
      cells.push(dataCell('—', widths[widths.length - 1], {
        bold: true, align: AlignmentType.CENTER,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    } else if (concepto.isCumulative) {
      // For cumulative values: Total = last value of the entire period
      cells.push(dataCell(fmt(lastCumulativeValue, concepto.decimals ?? 1), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    } else {
      cells.push(dataCell(fmt(grandTotal, concepto.decimals ?? 1), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    }

    return new TableRow({ cantSplit: true, children: cells });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================
// PER-YEAR DATA TABLE BUILDER (for Balance Sheet etc.)
// Data is one row per year (not monthly), indexed by year.
// ============================================================
interface YearConceptDef {
  label: string;
  bold?: boolean;
  highlight?: boolean;
  sectionHeader?: boolean;
  decimals?: number;  // Override default fmt() decimal places (e.g. 2 for ratios)
  isRatio?: boolean;  // If true, uses fmtRatio() instead of fmt() for display
  isCumulative?: boolean; // If true, Total column shows last year's value (NOT sum)
  getValue: (yearData: any) => number;
}

function buildPerYearTable(
  conceptos: YearConceptDef[],
  yearlyData: any[],
): Table {
  const numYears = yearlyData.length;
  const conceptWeight = 3;
  const yearWeight = 1.2;
  const totalWeight = 1.4;
  const weights = [conceptWeight, ...Array(numYears).fill(yearWeight), totalWeight];
  const widths = calcDxaWidths(A4_PORTRAIT_W, MARGIN_PORTRAIT_NARROW, weights);

  const headerRow = new TableRow({
    
    children: [
      headerCell('Concepto', widths[0], AlignmentType.LEFT, 15),
      ...yearlyData.map((_, i) =>
        headerCell(`Año ${i + 1}`, widths[i + 1], AlignmentType.CENTER, 14),
      ),
      totalHeaderCell(widths[widths.length - 1]),
    ],
  });

  let rowIdx = 0;
  const dataRows = conceptos.map((concepto) => {
    if (concepto.sectionHeader) {
      rowIdx++;
      return new TableRow({
        cantSplit: true,
        children: [
          dataCell(concepto.label, widths[0], {
            bold: true, align: AlignmentType.LEFT, fontSize: 14, compact: true,
            bgColor: COLORS.subtotalBg, conceptBorder: true, color: COLORS.darkPrimary,
          }),
          ...yearlyData.map((_, i) =>
            dataCell('', widths[i + 1], { fontSize: 14, compact: true, bgColor: COLORS.subtotalBg }),
          ),
          dataCell('', widths[widths.length - 1], { fontSize: 14, compact: true, bgColor: COLORS.subtotalBg, totalCol: true }),
        ],
      });
    }

    const isAlt = rowIdx % 2 === 1;
    const cells: TableCell[] = [];
    cells.push(dataCell(concepto.label, widths[0], {
      bold: concepto.bold, align: AlignmentType.LEFT, fontSize: 14, compact: true,
      bgColor: isAlt ? COLORS.altRow : undefined,
      conceptBorder: true,
    }));

    let grandTotal = 0;
    let lastValue = 0;
    for (let yr = 0; yr < numYears; yr++) {
      const val = yearlyData[yr] ? concepto.getValue(yearlyData[yr]) : 0;
      grandTotal += val;
      lastValue = val;
      // Use custom decimals if specified, otherwise default 1
      const displayVal = concepto.isRatio ? fmtRatio(val) : fmt(val, concepto.decimals ?? 1);
      cells.push(dataCell(displayVal, widths[yr + 1], {
        bold: concepto.bold, align: AlignmentType.RIGHT, fontSize: 14, compact: true,
        bgColor: concepto.highlight ? COLORS.subtotalBg : isAlt ? COLORS.altRow : undefined,
      }));
    }

    // Ratios don't sum meaningfully — show '—' in Total column
    if (concepto.isRatio) {
      cells.push(dataCell('—', widths[widths.length - 1], {
        bold: true, align: AlignmentType.CENTER,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    } else if (concepto.isCumulative) {
      // Cumulative values: Total = last year's value
      cells.push(dataCell(fmt(lastValue, concepto.decimals ?? 1), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    } else {
      cells.push(dataCell(fmt(grandTotal, concepto.decimals ?? 1), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    }

    rowIdx++;
    return new TableRow({ cantSplit: true, children: cells });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================
// ERF LINE-BASED TABLE BUILDER (for EnhancedERFRow[] / EstadoFinancieroRow[])
// Data is one row per financial statement line, with monthly[] arrays.
// ============================================================
function buildERFLineTable(
  lines: { linea: number; concepto: string; monthly: number[]; tipo?: string; seccion?: string }[],
  duration: number,
): Table {
  const numYears = Math.ceil(duration / 12);
  const conceptWeight = 3;
  const yearWeight = 1.2;
  const totalWeight = 1.4;
  const weights = [conceptWeight, ...Array(numYears).fill(yearWeight), totalWeight];
  const widths = calcDxaWidths(A4_PORTRAIT_W, MARGIN_PORTRAIT_NARROW, weights);

  const headerRow = new TableRow({
    
    children: [
      headerCell('Concepto', widths[0], AlignmentType.LEFT, 15),
      ...Array.from({ length: numYears }, (_, i) =>
        headerCell(`Año ${i + 1}`, widths[i + 1], AlignmentType.CENTER, 14),
      ),
      totalHeaderCell(widths[widths.length - 1]),
    ],
  });

  const dataRows = lines.map((line, lineIdx) => {
    const isTotal = line.tipo === 'total' || line.tipo === 'resultado';
    const isSubtotal = line.tipo === 'subtotal';
    const isInfo = line.tipo === 'info' || line.tipo === 'porciento';
    const isBold = isTotal || isSubtotal;
    const isHighlight = isTotal;
    const isAlt = lineIdx % 2 === 1 && !isTotal && !isSubtotal;

    const cells: TableCell[] = [];
    cells.push(dataCell(line.concepto, widths[0], {
      bold: isBold, align: AlignmentType.LEFT, fontSize: isInfo ? 12 : 14, compact: true,
      bgColor: isHighlight ? COLORS.totalBg : isSubtotal ? COLORS.subtotalBg : isAlt ? COLORS.altRow : undefined,
      color: isHighlight ? COLORS.darkPrimary : undefined,
      conceptBorder: true,
    }));

    let grandTotal = 0;
    for (let yr = 0; yr < numYears; yr++) {
      const startM = yr * 12;
      const endM = Math.min(startM + 12, duration);
      let yearTotal = 0;
      for (let m = startM; m < endM; m++) {
        yearTotal += line.monthly[m] || 0;
      }
      grandTotal += yearTotal;

      // For percentage-type lines, show the average or last value, not the sum
      if (line.tipo === 'porciento') {
        let count = 0;
        let yearSum = 0;
        for (let m = startM; m < endM; m++) {
          if (line.monthly[m] !== 0) { yearSum += line.monthly[m]; count++; }
        }
        const avgVal = count > 0 ? yearSum / count : 0;
        cells.push(dataCell(fmtRatio(avgVal), widths[yr + 1], {
          bold: isBold, align: AlignmentType.RIGHT, fontSize: 12, compact: true,
          bgColor: isHighlight ? COLORS.subtotalBg : isAlt ? COLORS.altRow : undefined,
        }));
      } else {
        cells.push(dataCell(fmt(yearTotal), widths[yr + 1], {
          bold: isBold, align: AlignmentType.RIGHT, fontSize: 14, compact: true,
          bgColor: isHighlight ? COLORS.subtotalBg : isAlt ? COLORS.altRow : undefined,
        }));
      }
    }

    if (line.tipo === 'porciento') {
      cells.push(dataCell('—', widths[widths.length - 1], {
        bold: true, align: AlignmentType.CENTER, fontSize: 14, compact: true, totalCol: true,
      }));
    } else {
      cells.push(dataCell(fmt(grandTotal), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: isHighlight ? COLORS.totalBg : undefined,
        color: isHighlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));
    }

    return new TableRow({ cantSplit: true, children: cells });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================
// AGGREGATE FINANCIAL COSTS BY MONTH (merge multiple loans)
// ============================================================
function aggregateFinCostsByMonth(finCosts: any[], duration: number): any[] {
  const byMonth: Record<number, { interest: number; capitalizedInterest: number; graceAccumulatedInterest: number; totalInterest: number; principal: number; bankFee: number; totalPayment: number }> = {};
  for (const fc of finCosts) {
    const m = fc.month || 0;
    if (!byMonth[m]) byMonth[m] = { interest: 0, capitalizedInterest: 0, graceAccumulatedInterest: 0, totalInterest: 0, principal: 0, bankFee: 0, totalPayment: 0 };
    byMonth[m].interest += fc.interest || 0;
    byMonth[m].capitalizedInterest += fc.capitalizedInterest || 0;
    byMonth[m].graceAccumulatedInterest += fc.graceAccumulatedInterest || 0;
    byMonth[m].totalInterest += fc.totalInterest || 0;
    byMonth[m].principal += fc.principal || 0;
    byMonth[m].bankFee += fc.bankFee || 0;
    byMonth[m].totalPayment += fc.totalPayment || 0;
  }
  return Array.from({ length: duration }, (_, i) => byMonth[i + 1] || { interest: 0, capitalizedInterest: 0, graceAccumulatedInterest: 0, totalInterest: 0, principal: 0, bankFee: 0, totalPayment: 0 });
}

// ============================================================
// MONTHLY MATRIX TABLES (for Annexes only)
// ============================================================
interface MonthlyConceptDef {
  label: string;
  bold?: boolean;
  highlight?: boolean;
  getValue: (monthData: any, monthIdx: number) => number;
}

function buildMonthlyMatrixTables(
  conceptos: MonthlyConceptDef[],
  monthlyData: any[],
  duration: number,
): Table[] {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const numYears = Math.ceil(duration / 12);
  const tables: Table[] = [];

  for (let yr = 0; yr < numYears; yr++) {
    const startM = yr * 12;
    const endM = Math.min(startM + 12, duration);
    const monthsInYear = endM - startM;

    const weights = [3, ...Array(monthsInYear).fill(1), 1.2];
    const widths = calcDxaWidths(A4_LANDSCAPE_W, MARGIN_LANDSCAPE, weights);

    const headerRow = new TableRow({
      
      children: [
        headerCell('Concepto', widths[0], AlignmentType.LEFT, 15),
        ...months.slice(0, monthsInYear).map((t, i) => headerCell(t, widths[i + 1], AlignmentType.CENTER, 14)),
        totalHeaderCell(widths[widths.length - 1]),
      ],
    });

    const dataRows = conceptos.map((concepto) => {
      const cells: TableCell[] = [];
      cells.push(dataCell(concepto.label, widths[0], {
        bold: concepto.bold, align: AlignmentType.LEFT, fontSize: 14, compact: true,
        conceptBorder: true,
      }));

      let yearTotal = 0;
      for (let m = startM; m < endM; m++) {
        const val = monthlyData[m] ? concepto.getValue(monthlyData[m], m) : 0;
        yearTotal += val;
        cells.push(dataCell(fmt(val), widths[m - startM + 1], {
          bold: concepto.bold, align: AlignmentType.RIGHT, fontSize: 14, compact: true,
        }));
      }

      cells.push(dataCell(fmt(yearTotal), widths[widths.length - 1], {
        bold: true, align: AlignmentType.RIGHT,
        bgColor: concepto.highlight ? COLORS.totalBg : undefined,
        color: concepto.highlight ? COLORS.darkPrimary : undefined,
        fontSize: 14, compact: true, totalCol: true,
      }));

      return new TableRow({ cantSplit: true, children: cells });
    });

    tables.push(new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: widths,
      rows: [headerRow, ...dataRows],
    }));
  }

  return tables;
}

// ============================================================
// HEADER / FOOTER
// ============================================================
function buildHeader(projectName: string): Header {
  return new Header({
    children: [new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [1800, 7000],
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new ImageRun({
                  data: base64ToUint8Array(BARAPRO_LOGO_BASE64),
                  transformation: { width: 30, height: 30 },
                  type: 'jpg',
                }),
              ],
            })],
          }),
          new TableCell({
            width: { size: 7000, type: WidthType.DXA },
            borders: noBorders,
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border, space: 4 } },
              children: [new TextRun({
                text: 'BARAPRO — Evaluación Financiera de Proyectos',
                size: 16, font: 'Calibri', color: COLORS.accent, italics: true,
              })],
            })],
          }),
        ],
      })],
    })],
  });
}

function buildFooter(projectName: string): Footer {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border, space: 4 } },
      children: [
        new TextRun({ text: 'Página ', size: 16, font: 'Calibri', color: COLORS.gray }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Calibri', color: COLORS.gray }),
        new TextRun({ text: ' — ', size: 16, font: 'Calibri', color: COLORS.gray }),
        new TextRun({ text: projectName || 'Proyecto', size: 16, font: 'Calibri', color: COLORS.gray }),
      ],
    })],
  });
}

// ============================================================
// SECTION CONFIG HELPERS
// ============================================================
function portraitSection(children: any[], projectName: string) {
  return {
    properties: {
      page: {
        size: { width: A4_PORTRAIT_W, height: 16838, orientation: PageOrientation.PORTRAIT },
        margin: MARGIN_PORTRAIT_NARROW,
      },
    },
    headers: { default: buildHeader(projectName) },
    footers: { default: buildFooter(projectName) },
    children,
  };
}

function landscapeSection(children: any[], projectName: string) {
  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: A4_LANDSCAPE_W, height: A4_PORTRAIT_W, orientation: PageOrientation.LANDSCAPE },
        margin: MARGIN_LANDSCAPE,
      },
    },
    headers: { default: buildHeader(projectName) },
    footers: { default: buildFooter(projectName) },
    children,
  };
}

// ============================================================
// ITEM SECTION HELPER
// ============================================================
function addItemSection(
  target: any[],
  title: string,
  items: any[],
  headers: { text: string; widthPct: number }[],
  rowMapper: (item: any) => string[],
  interpretation?: string,
) {
  target.push(subHeading(title));
  if (items.length === 0) {
    target.push(bodyText('No se han registrado ítems en esta sección.', false, COLORS.gray));
    return;
  }
  target.push(buildTable(headers, items.map((item: any) => ({ cells: rowMapper(item) }))));
  target.push(emptyPara(80));
  if (interpretation) target.push(interpretationText(interpretation));
}

// ============================================================
// SMART INTERPRETATIONS
// ============================================================
function indicatorInterpretation(label: string, value: number | null, type: 'van' | 'tir' | 'pr' | 'bc' | 'rvan' | 'pe' | 'ms'): string {
  const v = value ?? NaN; // Normalize null to NaN for type-safe comparisons
  switch (type) {
    case 'van':
      if (!isFinite(v)) return `No fue posible calcular el ${label}.`;
      if (v > 0) return `El ${label} positivo de ${fmt(v)} CUP indica que el proyecto genera valor por encima de la tasa de descuento, lo que confirma su viabilidad financiera desde la perspectiva de la inversión.`;
      if (v < 0) return `El ${label} negativo de ${fmt(v)} CUP indica que el proyecto no genera suficiente retorno para cubrir la tasa de descuento, lo que sugiere inviabilidad financiera.`;
      return `El ${label} es cero, indicando que el proyecto apenas cubre la tasa de descuento.`;
    case 'tir':
      if (value === null) return `No fue posible calcular la ${label}. Verifique que existan flujos positivos y negativos.`;
      return `La ${label} de ${fmtCalcPct(v)} representa la rentabilidad intrínseca del proyecto. ${v > 0 ? 'Al ser positiva, el proyecto genera retorno.' : 'Al ser negativa, el proyecto destruye valor.'}`;
    case 'pr':
      if (value === null) return `El proyecto no recupera la inversión dentro del horizonte de evaluación.`;
      return `El período de recuperación de ${fmt(v, 2)} años indica el tiempo necesario para recuperar la inversión inicial. Un período menor sugiere menor riesgo y mayor liquidez.`;
    case 'bc':
      if (!isFinite(v)) return `La relación B/C no puede calcularse (costos o beneficios cero).`;
      if (v > 1) return `La relación B/C de ${fmtRatio(v, 3)} indica que los beneficios superan los costos, confirmando la viabilidad del proyecto.`;
      if (v < 1) return `La relación B/C de ${fmtRatio(v, 3)} indica que los costos superan los beneficios, sugiriendo inviabilidad del proyecto.`;
      return `La relación B/C de 1.000 indica un punto de equilibrio exacto.`;
    case 'rvan':
      if (!isFinite(v)) return `No fue posible calcular la rentabilidad del VAN.`;
      return `La rentabilidad del VAN de ${fmtRatio(v, 3)} indica el rendimiento por cada unidad de inversión actualizada. ${v > 0 ? 'Valor positivo confirma viabilidad.' : 'Valor negativo sugiere inviabilidad.'}`;
    case 'pe':
      if (!isFinite(v)) return `El punto de equilibrio no pudo determinarse.`;
      return `El punto de equilibrio es ${fmt(v)} CUP, lo que representa el nivel mínimo de ingresos necesario para cubrir todos los costos fijos y variables.`;
    case 'ms':
      if (!isFinite(v)) return `El margen de seguridad no pudo calcularse.`;
      if (v > 0.2) return `El margen de seguridad de ${fmtCalcPct(v)} es saludable, indicando que los ingresos pueden caer un ${fmtCalcPct(v)} antes de alcanzar el punto de equilibrio.`;
      if (v > 0) return `El margen de seguridad de ${fmtCalcPct(v)} es bajo, lo que indica sensibilidad ante caídas en los ingresos.`;
      return `El margen de seguridad negativo indica que el proyecto opera por debajo del punto de equilibrio.`;
    default:
      return '';
  }
}

function balanceInterpretation(bs: any[]): string {
  if (!bs || bs.length === 0) return 'No hay datos de balance general disponibles.';
  const lastYear = bs[bs.length - 1];
  if (!lastYear) return '';
  const currentAssets = lastYear.activoCirculante || 0;
  const currentLiab = lastYear.pasivoCirculante || 0;
  const ratio = currentLiab > 0 ? currentAssets / currentLiab : 0;
  if (ratio >= 2) return `La razón circulante de ${fmtRatio(ratio)} indica una sólida capacidad para cubrir obligaciones a corto plazo.`;
  if (ratio >= 1) return `La razón circulante de ${fmtRatio(ratio)} indica capacidad para cubrir obligaciones a corto plazo, aunque con margen limitado.`;
  return `La razón circulante de ${fmtRatio(ratio)} indica posible insuficiencia para cubrir obligaciones a corto plazo, lo que requiere atención.`;
}

// ============================================================
// SHARED DOCUMENT BUILDER
// Builds the full DOCX Document object without packing.
// Used by both client-side (Packer.toBlob) and server-side (Packer.toBuffer).
// ============================================================
export function buildDocxDocument(state: BaraproState): Document {
  const s = state;
  const p = s.parameters;
  const proj = s.project;
  const duration = proj.monthsDuration || 120;
  const errors: string[] = [];

  // ── Build ALL calculations ONCE ──
  const cache = buildCalcCache(state);

  const portraitChildren: any[] = [];
  const landscapeChildren: any[] = [];

  function push(element: any) { portraitChildren.push(element); }
  function pushLandscape(element: any) { landscapeChildren.push(element); }

  // ═══════════════════════════════════════════════════════════════
  // PARTE I — IDENTIFICACIÓN
  // ═══════════════════════════════════════════════════════════════

  // ── 1. PORTADA PROFESIONAL ──

  // Top colored bar
  push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.SOLID, color: COLORS.darkPrimary, fill: COLORS.darkPrimary },
    children: [new TextRun({ text: ' ', size: 60 })],
  }));

  // Thin accent bar below dark bar
  push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.SOLID, color: COLORS.accent, fill: COLORS.accent },
    children: [new TextRun({ text: ' ', size: 6 })],
  }));

  push(emptyPara(500));

  // BARAPRO Logo Image
  push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 30 },
    children: [
      new ImageRun({
        data: base64ToUint8Array(BARAPRO_LOGO_BASE64),
        transformation: { width: 180, height: 180 },
        type: 'jpg',
      }),
    ],
  }));

  // BARAPRO text below logo — more prominent
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 20 },
    children: [new TextRun({ text: 'BARAPRO', bold: true, size: 56, font: 'Calibri', color: COLORS.darkPrimary })],
  }));

  // Version tag
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: 'v10.1', size: 22, font: 'Calibri', color: COLORS.accent, bold: true })],
  }));

  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Evaluación Financiera de Proyectos', size: 28, font: 'Calibri', color: COLORS.gray })],
  }));

  // Decorative blue gradient line (dual bar)
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 4 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.primary, space: 4 } },
    children: [new TextRun({ text: '', size: 2 })],
  }));
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.midBlue, space: 4 } },
    children: [new TextRun({ text: '', size: 2 })],
  }));

  // ESTUDIO DE FACTIBILIDAD
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'ESTUDIO DE FACTIBILIDAD', bold: true, size: 36, font: 'Calibri', color: COLORS.darkPrimary })],
  }));

  // Project name
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: proj.projectName || 'Proyecto sin Nombre', bold: true, size: 32, font: 'Calibri', color: COLORS.accent })],
  }));

  // Methodology badge
  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({
      text: 'Metodología PDL Cuba — Resolución 1/2022',
      size: 22, font: 'Calibri', color: COLORS.midBlue, italics: true,
    })],
  }));

  // Cover info table
  const coverRows = [
    ['Inversionista', proj.investorName || '—'],
    ['Ubicación', [proj.province, proj.municipality].filter(Boolean).join(', ') || '—'],
    ['Sector', proj.sector || '—'],
    ['Tipo de Proyecto', proj.projectType === 'nuevo' ? 'Nuevo' : proj.projectType === 'ampliacion' ? 'Ampliación' : 'Reposición'],
    ['Actividad', proj.activityType === 'comercial' ? 'Comercial' : 'Producción / Servicios'],
    ['Duración', `${safeStr(proj.monthsDuration)} meses (${safeStr((proj.monthsDuration || 0) / 12, '0')} años)`],
    ['Moneda Base', proj.baseCurrency || 'CUP'],
  ];

  push(new Table({
    width: { size: 70, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: coverRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3500, type: WidthType.DXA }, borders: noBorders,
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 50 },
              children: [new TextRun({ text: label + ':', bold: true, size: 20, font: 'Calibri', color: COLORS.accent })],
            })],
          }),
          new TableCell({
            width: { size: 5500, type: WidthType.DXA }, borders: noBorders,
            children: [new Paragraph({
              spacing: { before: 50, after: 50 },
              children: [new TextRun({ text: value, size: 20, font: 'Calibri', color: COLORS.darkPrimary, bold: true })],
            })],
          }),
        ],
      }),
    ),
  }));

  push(emptyPara(400));

  // Bottom bar with date and version
  push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.SOLID, color: COLORS.accent, fill: COLORS.accent },
    children: [new TextRun({ text: ' ', size: 4 })],
  }));
  push(new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.SOLID, color: COLORS.darkPrimary, fill: COLORS.darkPrimary },
    children: [new TextRun({ text: ' ', size: 24 })],
  }));

  push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 },
    shading: { type: ShadingType.SOLID, color: COLORS.ltBlue, fill: COLORS.ltBlue },
    children: [
      new TextRun({ text: `Fecha de Emisión: ${new Date().toLocaleDateString('es-CU', { day: '2-digit', month: 'long', year: 'numeric' })}`, size: 18, font: 'Calibri', color: COLORS.darkPrimary }),
      new TextRun({ text: '    |    ', size: 18, font: 'Calibri', color: COLORS.gray }),
      new TextRun({ text: `Tasas: CUP/MLC ${safeStr(proj.exchangeRates?.cupToMlc)}  CUP/CL ${safeStr(proj.exchangeRates?.cupToCl)}  MLC/CL ${safeStr(proj.exchangeRates?.mlcToCl)}`, size: 16, font: 'Calibri', color: COLORS.gray }),
    ],
  }));

  push(pageBreakPara());

  // ── 2. RESUMEN EJECUTIVO ──
  try {
    push(sectionHeading('2. Resumen Ejecutivo'));

    const isViable = cache.van > 0;
    const viabilityColor = isViable ? COLORS.accent : COLORS.red;

    // Viability badge
    push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
      shading: { type: ShadingType.SOLID, color: isViable ? COLORS.ltBlue : COLORS.ltGray, fill: isViable ? COLORS.ltBlue : COLORS.ltGray },
      children: [new TextRun({
        text: isViable ? 'PROYECTO VIABLE' : 'PROYECTO NO VIABLE',
        bold: true, size: 28, font: 'Calibri', color: viabilityColor,
      })],
    }));

    // Key Indicators card
    push(subHeading('Indicadores Clave'));
    push(buildTable(
      [
        { text: 'Indicador', widthPct: 30 },
        { text: 'Inversión', widthPct: 35 },
        { text: 'Capital', widthPct: 35 },
      ],
      [
        { cells: ['VAN', fmt(cache.van) + ' CUP', fmt(cache.vanCapital) + ' CUP'], bold: true, highlight: cache.van > 0 },
        { cells: ['TIR', cache.tir !== null ? fmtCalcPct(cache.tir) : '—', cache.tirCapital !== null ? fmtCalcPct(cache.tirCapital) : '—'] },
        { cells: ['Período de Recuperación', cache.pr !== null ? fmt(cache.pr, 2) + ' años' : '—', '—'] },
        { cells: ['Relación B/C', fmtRatio(cache.relacionBC, 3), '—'] },
        { cells: ['RVAN', fmtRatio(cache.rvan, 3), '—'] },
      ],
    ));

    push(emptyPara(60));

    // Summary figures
    push(subHeading('Cifras Principales'));
    push(buildTable(
      [
        { text: 'Concepto', widthPct: 50 },
        { text: 'Monto (CUP)', widthPct: 50 },
      ],
      [
        { cells: ['Inversión Total', fmt(cache.totalInvestment)], bold: true, highlight: true },
        { cells: ['Ingresos Totales Proyectados', fmt(cache.revTotal)] },
        { cells: ['Costos Totales Proyectados', fmt(cache.costTotal)] },
        { cells: ['Punto de Equilibrio', isFinite(cache.puntoEquilibrio) ? fmt(cache.puntoEquilibrio) : '—'] },
        { cells: ['Margen de Seguridad', isFinite(cache.margenSeguridad) ? fmtCalcPct(cache.margenSeguridad) : '—'] },
      ],
    ));

    push(emptyPara(60));

    // Key findings
    push(subHeading('Hallazgos Principales'));
    const findings: string[] = [];
    if (cache.van > 0) {
      findings.push(`El proyecto genera un VAN positivo de ${fmt(cache.van)} CUP, confirmando que la inversión se justifica financieramente.`);
    } else if (cache.van < 0) {
      findings.push(`El proyecto presenta un VAN negativo de ${fmt(cache.van)} CUP, indicando que no alcanza la tasa de descuento requerida.`);
    }
    if (cache.tir !== null) {
      const tmar = p.minimumAcceptableRate || 0;
      findings.push(`La TIR de ${fmtCalcPct(cache.tir)} ${cache.tir * 100 > tmar ? 'supera' : 'no alcanza'} la TMAR de ${fmtPct(tmar)}.`);
    }
    if (cache.pr !== null) {
      findings.push(`La inversión se recupera en ${fmt(cache.pr, 2)} años del horizonte del proyecto.`);
    }
    if (cache.relacionBC > 1) {
      findings.push(`La relación beneficio/costo de ${fmtRatio(cache.relacionBC, 3)} muestra que los beneficios superan los costos.`);
    }
    if (findings.length === 0) {
      findings.push('No se pudieron calcular indicadores financieros. Verifique los datos de entrada.');
    }
    for (const f of findings) {
      push(bodyText(`• ${f}`));
    }

    push(interpretationText(indicatorInterpretation('VAN', cache.van, 'van')));
  } catch (e: any) {
    errors.push(`2. Resumen Ejecutivo: ${e.message || e}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PARTE II — PARÁMETROS E INSUMOS
  // ═══════════════════════════════════════════════════════════════
  push(pageBreakPara());
  push(partHeading('PARTE II — Parámetros e Insumos'));

  // ── 3. PARÁMETROS FINANCIEROS (Consolidated) ──
  try {
    push(sectionHeading('3. Parámetros Financieros'));

    // Consolidated table — all parameters in one table with groups
    push(buildTable(
      [
        { text: 'Grupo', widthPct: 20 },
        { text: 'Parámetro', widthPct: 40 },
        { text: 'Valor', widthPct: 25 },
        { text: 'Unidad', widthPct: 15 },
      ],
      [
        // Impuestos
        { cells: ['Impuestos', 'Impuesto sobre Utilidades', fmtPct(p.incomeTaxRate), '%'] },
        { cells: ['Impuestos', 'ISV/ITBIS', fmtPct(p.salesTaxRate), '%'] },
        { cells: ['Impuestos', 'Contribución SS Empleador', fmtPct(p.specialSocialSecurityRate), '%'] },
        { cells: ['Impuestos', 'Impuesto Fuerza de Trabajo', fmtPct(p.taxOnWorkforceRate), '%'] },
        { cells: ['Impuestos', 'Impuesto Territorial', fmtPct(p.territorialTaxRate), '%'] },
        { cells: ['Impuestos', 'IIP (Trabajadores)', fmtPct(p.personalIncomeTaxRate), '%'] },
        { cells: ['Impuestos', 'Mínimo Exento IIP', String(Math.round(p.personalIncomeTaxExemptMin || 0)), 'CUP'] },
        { cells: ['Impuestos', 'Contribución Trabajadores SS', fmtPct(p.workerSocialSecurityRate), '%'] },
        // Descuento
        { cells: ['Descuento', 'Tasa de Descuento CUP', fmtPct(p.discountRateCUP), '%'] },
        { cells: ['Descuento', 'Tasa de Descuento MLC', fmtPct(p.discountRateMLC), '%'] },
        { cells: ['Descuento', 'TMAR', fmtPct(p.minimumAcceptableRate), '%'] },
        { cells: ['Descuento', 'Tasa de Inflación', fmtPct(p.inflationRate), '%'] },
        // Reservas
        { cells: ['Reservas', 'Contingencia Inversión', fmtPct(p.contingencyReserveRate), '%'] },
        { cells: ['Reservas', 'Contingencia Operaciones', fmtPct(p.operationsContingencyRate), '%'] },
        { cells: ['Reservas', 'Utilidades Retenidas', fmtPct(p.retainedEarningsRate), '%'] },
        { cells: ['Reservas', 'ARIE', fmtPct(p.arieRate), '%'] },
        { cells: ['Reservas', 'Reservas Estimulación', fmtPct(p.reservasEstimulacionRate), '%'] },
        { cells: ['Reservas', 'Beneficio a Reinvertir', fmtPct(p.beneficioReinvertirRate), '%'] },
        { cells: ['Reservas', 'Otras Reservas Voluntarias', fmtPct(p.otrasReservasVoluntariasRate), '%'] },
        // Distribución
        { cells: ['Distribución', 'Dividendo CAM', fmtPct(p.dividendCAMRate), '%'] },
        { cells: ['Distribución', 'Cuenta de Proyecto', fmtPct(p.projectAccountRate), '%'] },
        { cells: ['Distribución', 'Dividendo Estatal', fmtPct(p.dividendoEstatalPct), '%'] },
        { cells: ['Distribución', 'Dividendo Socio Cubano', fmtPct(p.dividendoSocioCubanoPct), '%'] },
        { cells: ['Distribución', 'Dividendo Socio Extranjero', fmtPct(p.dividendoSocioExtranjeroPct), '%'] },
        { cells: ['Distribución', 'Pago Utilidades Retenidas', fmt(p.pagoUtilidadesRetenidasAmt), 'CUP/mes'] },
        // Comercial
        { cells: ['Comercial', 'Canon y Royalties', fmtPct(p.canonRoyaltiesRate), '%'] },
        { cells: ['Comercial', 'Arrendamiento Mensual', fmt(p.arrendamientoMensual), 'CUP'] },
        { cells: ['Comercial', 'Otros Gastos Variables', fmtPct(p.otrosGastosVariablesPct), '%'] },
        // Laboral
        { cells: ['Laboral', 'Comisión Bancaria', fmtPct(p.bankFeeRate, 3), '%'] },
        { cells: ['Laboral', 'Norma de Vacaciones', fmtPct(p.vacationNormRate, 4), '%'] },
        { cells: ['Laboral', 'Honorarios Administrativos', fmtPct(p.honorariosAdminRate), '%'] },
        // Depreciación
        { cells: ['Depreciación', 'Método', p.depreciationMethod === 'straight-line' ? 'Línea Recta' : 'Saldos Decrecientes', '—'] },
        { cells: ['Depreciación', 'Vida Útil Predeterminada', safeStr(p.usefulLifeYears) + ' años', 'años'] },
        { cells: ['Depreciación', 'Valor Residual Global', fmtPct(p.residualValuePercent), '%'] },
        { cells: ['Depreciación', 'Gastos Previos Amort.', safeStr(p.gastosPreviosAmortYears) + ' años', 'años'] },
        // Capital de Trabajo
        { cells: ['Capital de Trabajo', 'Días Laborables/Año', safeStr(p.workingDaysPerYear), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Efectivo', safeStr(p.wcCashCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días CxC', safeStr(p.wcReceivableCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Inventarios', safeStr(p.wcInventoryCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Pago Proveedores', safeStr(p.wcPayableDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Prod. en Proceso', safeStr(p.wcWipCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Prod. Terminados', safeStr(p.wcFinishedGoodsCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Piezas Repuesto', safeStr(p.wcSparePartsCoverageDays), 'días'] },
        { cells: ['Capital de Trabajo', 'Días Mercancías Venta', safeStr(p.wcMercanciasVentaCoverageDays), 'días'] },
      ],
    ));

    push(interpretationText(
      `Carga impositiva: utilidades ${fmtPct(p.incomeTaxRate)}, ISV ${fmtPct(p.salesTaxRate)}, ` +
      `SS empleador ${fmtPct(p.specialSocialSecurityRate)}, ITF ${fmtPct(p.taxOnWorkforceRate)}. ` +
      `TMAR: ${fmtPct(p.minimumAcceptableRate)}, tasa descuento CUP: ${fmtPct(p.discountRateCUP)}.`
    ));
  } catch (e: any) {
    errors.push(`3. Parámetros: ${e.message || e}`);
  }

  // ── 4. MARCO LÓGICO (Conditional) ──
  try {
    if (s.logicalFramework?.rows && s.logicalFramework.rows.length > 0) {
      push(pageBreakPara());
      push(sectionHeading('4. Marco Lógico del Proyecto'));

      const levelMap: Record<string, string> = {
        fin: 'Fin', proposito: 'Propósito', componente: 'Componente', actividad: 'Actividad',
      };

      push(buildTable(
        [
          { text: 'Nivel', widthPct: 12 },
          { text: 'Narrativa', widthPct: 33 },
          { text: 'Indicadores', widthPct: 25 },
          { text: 'Medios de Verificación', widthPct: 15 },
          { text: 'Supuestos', widthPct: 15 },
        ],
        s.logicalFramework.rows.map((row: any) => ({
          cells: [levelMap[row.level] || row.level, row.narrative, row.indicators, row.verificationMeans, row.assumptions],
        })),
      ));

      push(interpretationText(
        `Marco lógico con ${s.logicalFramework.rows.length} niveles definidos, ` +
        `alineado con la metodología de Marco Lógico para proyectos de inversión.`
      ));
    }
  } catch (e: any) {
    errors.push(`4. Marco Lógico: ${e.message || e}`);
  }

  // ── 5. INVERSIÓN INICIAL ──
  try {
    push(pageBreakPara());
    push(sectionHeading('5. Inversión Inicial'));

    // ── 5.1 Resumen por Categoria (from cache.budget — same engine as UI) ──
    const budgetAny = cache.budget as any;
    const budgetCategories: Array<{ key: string; label: string; totalCUP: number; totalMLC: number }> =
      budgetAny?.categories || [];

    // Fallback: derive categories from budget.items by grouping on partida
    const categoryRows: { cells: string[]; bold?: boolean; highlight?: boolean }[] = [];
    if (budgetCategories.length > 0) {
      for (const cat of budgetCategories) {
        const pct = cat.totalCUP > 0 && cache.totalInvestment > 0
          ? fmtCalcPct(cat.totalCUP / cache.totalInvestment) : '—';
        categoryRows.push({ cells: [cat.label || cat.key, fmt(cat.totalCUP), fmt(cat.totalMLC), pct] });
      }
    } else if (budgetAny?.items?.length > 0) {
      // Group budget items by partida
      const catMap = new Map<string, { totalCUP: number; totalMLC: number }>();
      for (const item of budgetAny.items) {
        const key = item.partida || 'Otro';
        if (!catMap.has(key)) catMap.set(key, { totalCUP: 0, totalMLC: 0 });
        const entry = catMap.get(key)!;
        entry.totalCUP += item.totalCUP || 0;
        entry.totalMLC += item.totalMLC || 0;
      }
      for (const [label, totals] of catMap) {
        const pct = totals.totalCUP > 0 && cache.totalInvestment > 0
          ? fmtCalcPct(totals.totalCUP / cache.totalInvestment) : '—';
        categoryRows.push({ cells: [label, fmt(totals.totalCUP), fmt(totals.totalMLC), pct] });
      }
    }

    push(subHeading('5.1 Resumen por Categoría'));
    push(buildTable(
      [
        { text: 'Categoría', widthPct: 35 },
        { text: 'Total CUP', widthPct: 22 },
        { text: 'Total MLC', widthPct: 22 },
        { text: '% del Total', widthPct: 21 },
      ],
      [
        ...categoryRows,
        { cells: ['TOTAL INVERSIÓN', fmt(cache.totalInvestment), fmt(budgetAny?.grandTotalMLC || 0), '100%'], bold: true, highlight: true },
      ],
    ));

    // Individual items — only once each
    addItemSection(portraitChildren, '5.2 Construcción y Montaje', s.constructionItems,
      [
        { text: 'Nombre', widthPct: 22 }, { text: 'Unidad', widthPct: 8 },
        { text: 'Cantidad', widthPct: 10 }, { text: 'Costo Unit. CUP', widthPct: 18 },
        { text: 'Costo Unit. MLC', widthPct: 18 }, { text: 'Total CUP', widthPct: 24 },
      ],
      (i: any) => [i.name, i.unit, String(i.quantity), fmt(i.unitCostCUP), fmt(i.unitCostMLC), fmt(i.quantity * i.unitCostCUP)],
    );

    addItemSection(portraitChildren, '5.3 Gastos de Capital', s.capitalItems,
      [
        { text: 'Nombre', widthPct: 24 }, { text: 'Unidad', widthPct: 8 },
        { text: 'Cantidad', widthPct: 10 }, { text: 'Costo Unit. CUP', widthPct: 28 },
        { text: 'Costo Unit. MLC', widthPct: 30 },
      ],
      (i: any) => [i.name, i.unit, String(i.quantity), fmt(i.unitCostCUP), fmt(i.unitCostMLC)],
    );

    addItemSection(portraitChildren, '5.4 Subcontrataciones', s.subcontractItems,
      [
        { text: 'Nombre', widthPct: 25 }, { text: 'Descripción', widthPct: 30 },
        { text: 'Costo CUP', widthPct: 22 }, { text: 'Costo MLC', widthPct: 23 },
      ],
      (i: any) => [i.name, i.description, fmt(i.totalCostCUP), fmt(i.totalCostMLC)],
    );

    addItemSection(portraitChildren, '5.5 Recursos Humanos (Inversión)', s.resourceItems,
      [
        { text: 'Nombre', widthPct: 22 }, { text: 'Posición', widthPct: 28 },
        { text: 'Salario CUP', widthPct: 18 }, { text: 'Salario MLC', widthPct: 18 },
        { text: 'Cantidad', widthPct: 14 },
      ],
      (i: any) => [i.name, i.position, fmt(i.monthlySalaryCUP), fmt(i.monthlySalaryMLC), String(i.quantity)],
    );

    addItemSection(portraitChildren, '5.6 Piezas y Herramientas', s.sparePartItems,
      [
        { text: 'Nombre', widthPct: 28 }, { text: 'Unidad', widthPct: 12 },
        { text: 'Cantidad', widthPct: 12 }, { text: 'Costo CUP', widthPct: 24 },
        { text: 'Depreciable', widthPct: 24 },
      ],
      (i: any) => [i.name, i.unit, String(i.quantity), fmt(i.unitCostCUP), i.depreciable ? 'Sí' : 'No'],
    );

    addItemSection(portraitChildren, '5.7 Activos Intangibles', s.intangibleAssets,
      [
        { text: 'Nombre', widthPct: 25 }, { text: 'Descripción', widthPct: 30 },
        { text: 'Costo CUP', widthPct: 25 }, { text: 'Vida Útil', widthPct: 20 },
      ],
      (i: any) => [i.name, i.description, fmt(i.amountCUP), i.usefulLifeYears + ' años'],
    );

    addItemSection(portraitChildren, '5.8 Financiamiento (Préstamos)', s.loans,
      [
        { text: 'Nombre', widthPct: 22 }, { text: 'Monto CUP', widthPct: 20 },
        { text: 'Tasa Anual', widthPct: 16 }, { text: 'Plazo (meses)', widthPct: 14 },
        { text: 'Per. Gracia', widthPct: 14 }, { text: 'Inicio', widthPct: 14 },
      ],
      (i: any) => [i.name, fmt(i.amountCUP), fmtCalcPct(i.annualRate), String(i.termMonths), String(i.gracePeriodMonths), String(i.startMonth || 1)],
      `${s.loans.length} préstamos configurados con un monto total de ${fmt(budgetAny?.totalLoanCUP || 0)} CUP.`
    );
  } catch (e: any) {
    errors.push(`5. Inversión: ${e.message || e}`);
  }

  // ── 6. OPERACIONES ──
  try {
    push(pageBreakPara());
    push(sectionHeading('6. Operaciones'));

    addItemSection(portraitChildren, '6.1 Compras / Materias Primas', s.purchaseItems,
      [
        { text: 'Nombre', widthPct: 20 }, { text: 'Unidad', widthPct: 8 },
        { text: 'Cantidad', widthPct: 10 }, { text: 'Costo Unit. CUP', widthPct: 18 },
        { text: 'Costo Unit. MLC', widthPct: 18 }, { text: 'Origen', widthPct: 12 },
        { text: 'Frecuencia', widthPct: 14 },
      ],
      (i: any) => [i.name, i.unit, String(i.quantity), fmt(i.unitCostCUP), fmt(i.unitCostMLC), i.origin || 'Nacional', i.frequency || '—'],
    );

    addItemSection(portraitChildren, '6.2 Ventas', s.salesItems,
      [
        { text: 'Producto', widthPct: 22 }, { text: 'Unidad', widthPct: 10 },
        { text: 'Precio CUP', widthPct: 18 }, { text: 'Precio MLC', widthPct: 18 },
        { text: 'Mercado', widthPct: 16 }, { text: 'Costo MP CUP', widthPct: 16 },
      ],
      (i: any) => [i.product, i.unit, fmt(i.priceCUP), fmt(i.priceMLC), i.marketType === 'exportación' ? 'Exportación' : 'Nacional', fmt(i.unitCostMPCUP)],
    );

    addItemSection(portraitChildren, '6.3 Costos Directos', s.directCostItems,
      [
        { text: 'Nombre', widthPct: 25 }, { text: 'Descripción', widthPct: 25 },
        { text: 'Monto CUP', widthPct: 25 }, { text: 'Monto MLC', widthPct: 25 },
      ],
      (i: any) => [i.name, i.description, fmt(i.amountCUP), fmt(i.amountMLC)],
    );

    addItemSection(portraitChildren, '6.4 Nómina Operativa', [
      ...(s.commercialSalaries || []),
      ...(s.adminSalaries || []),
      ...(s.maintenanceSalaries || []),
      ...(s.indirectSalaries || []),
      ...(s.directCostSalaries || []),
    ],
      [
        { text: 'Nombre', widthPct: 22 }, { text: 'Posición', widthPct: 28 },
        { text: 'Salario CUP', widthPct: 18 }, { text: 'Salario MLC', widthPct: 18 },
        { text: 'Cantidad', widthPct: 14 },
      ],
      (i: any) => [i.name, i.position, fmt(i.monthlySalaryCUP), fmt(i.monthlySalaryMLC), String(i.quantity)],
    );

    addItemSection(portraitChildren, '6.5 Gastos de Distribución y Ventas', s.commercialExpenses,
      [
        { text: 'Nombre', widthPct: 40 }, { text: 'Monto CUP', widthPct: 30 },
        { text: 'Monto MLC', widthPct: 30 },
      ],
      (i: any) => [i.name, fmt(i.amountCUP), fmt(i.amountMLC)],
    );

    addItemSection(portraitChildren, '6.6 Gastos Generales y de Administración', s.adminExpenses,
      [
        { text: 'Nombre', widthPct: 40 }, { text: 'Monto CUP', widthPct: 30 },
        { text: 'Monto MLC', widthPct: 30 },
      ],
      (i: any) => [i.name, fmt(i.amountCUP), fmt(i.amountMLC)],
    );

    addItemSection(portraitChildren, '6.7 Mantenimiento', s.maintenanceItems,
      [
        { text: 'Nombre', widthPct: 30 }, { text: 'Monto CUP', widthPct: 23 },
        { text: 'Monto MLC', widthPct: 23 }, { text: 'Frecuencia', widthPct: 24 },
      ],
      (i: any) => [i.name, fmt(i.amountCUP), fmt(i.amountMLC), i.frequency || '—'],
    );

    addItemSection(portraitChildren, '6.8 Otros Gastos', s.indirectExpenses,
      [
        { text: 'Nombre', widthPct: 40 }, { text: 'Monto CUP', widthPct: 30 },
        { text: 'Monto MLC', widthPct: 30 },
      ],
      (i: any) => [i.name, fmt(i.amountCUP), fmt(i.amountMLC)],
    );
  } catch (e: any) {
    errors.push(`6. Operaciones: ${e.message || e}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PARTE III — RESULTADOS FINANCIEROS
  // ═══════════════════════════════════════════════════════════════
  push(pageBreakPara());
  push(partHeading('PARTE III — Resultados Financieros'));

  // ── 7. PRESUPUESTO DE INVERSIÓN ──
  try {
    push(sectionHeading('7. Presupuesto de Inversión'));
    if (cache.budget) {
      const budgetCats = (cache.budget as any).categories || [];
      if (budgetCats.length > 0) {
        const bConcepts: AnnualConceptDef[] = budgetCats.map((cat: any) => ({
          label: cat.label || cat.key,
          bold: cat.key === 'totalInversionCUP',
          highlight: cat.key === 'totalInversionCUP',
          getValue: (md: any) => md[cat.key] || 0,
        }));
        const budgetMonthly = (cache.budget as any).monthly || [];
        if (budgetMonthly.length > 0) {
          push(buildAnnualSummaryTable(bConcepts, budgetMonthly, duration));
        }
      }
      push(interpretationText(
        `El presupuesto total de inversión asciende a ${fmt(cache.totalInvestment)} CUP, ` +
        `distribuido a lo largo del período de inversión del proyecto.`
      ));
    }
  } catch (e: any) {
    errors.push(`7. Presupuesto: ${e.message || e}`);
  }

  // ── 8. DEPRECIACIÓN Y AMORTIZACIÓN ──
  try {
    push(pageBreakPara());
    push(sectionHeading('8. Depreciación y Amortización'));
    if (cache.depMonthlyData.length > 0) {
      const depConcepts: AnnualConceptDef[] = [
        { label: 'Depreciación', getValue: (md: any) => md.depreciation || 0 },
        { label: 'Amortización', getValue: (md: any) => md.amortization || 0 },
        { label: 'Total Dep. y Amort.', bold: true, highlight: true, getValue: (md: any) => md.total || 0 },
      ];
      push(buildAnnualSummaryTable(depConcepts, cache.depMonthlyData, duration));
      push(interpretationText(
        `La depreciación y amortización se calculan por el método de ` +
        `${p.depreciationMethod === 'straight-line' ? 'línea recta' : 'saldos decrecientes'} ` +
        `con una vida útil predeterminada de ${safeStr(p.usefulLifeYears)} años y valor residual del ${fmtPct(p.residualValuePercent)}.`
      ));
    }
  } catch (e: any) {
    errors.push(`8. Depreciación: ${e.message || e}`);
  }

  // ── 9. CAPITAL DE TRABAJO ──
  try {
    push(pageBreakPara());
    push(sectionHeading('9. Capital de Trabajo'));
    if (cache.wcData && Array.isArray(cache.wcData) && cache.wcData.length > 0) {
      const wcConcepts: AnnualConceptDef[] = [
        { label: 'Efectivo en Caja', getValue: (md: any) => md.efectivo || 0 },
        { label: 'Cuentas por Cobrar a Clientes', getValue: (md: any) => md.cuentasPorCobrar || 0 },
        { label: 'Inventario de Materias Primas', getValue: (md: any) => md.inventarios || 0 },
        { label: '  Inventarios Nacionales', getValue: (md: any) => md.inventariosNacionales || 0 },
        { label: '  Inventarios Importados', getValue: (md: any) => md.inventariosImportados || 0 },
        { label: 'Productos en Proceso', getValue: (md: any) => md.productosEnProceso || 0 },
        { label: 'Producción Terminada', getValue: (md: any) => md.produccionTerminada || 0 },
        { label: 'Piezas de Repuesto y Herramientas', getValue: (md: any) => md.piezasRepuesto || 0 },
        { label: 'Inventario Mercancías para la Venta', getValue: (md: any) => md.mercanciasVenta || 0 },
        { label: 'Otros Activos Corrientes', getValue: (md: any) => md.otrosActivosCorrientes || 0 },
        { label: 'TOTAL ACTIVOS CORRIENTES', bold: true, getValue: (md: any) => md.totalActivosCorrientes || 0 },
        { label: 'Cuentas por Pagar a Proveedores', getValue: (md: any) => md.cuentaPorPagar || 0 },
        { label: 'Anticipos Recibidos', getValue: (md: any) => md.anticipos || 0 },
        { label: 'Otros Pasivos Corrientes', getValue: (md: any) => md.otrosPasivosCorrientes || 0 },
        { label: 'TOTAL PASIVOS CORRIENTES', bold: true, getValue: (md: any) => md.totalPasivosCorrientes || 0 },
        { label: 'Capital de Trabajo Bruto', getValue: (md: any) => md.capitalTrabajoBruto || 0 },
        { label: 'CAPITAL DE TRABAJO NETO', bold: true, highlight: true, getValue: (md: any) => md.capitalTrabajoNeto || 0 },
        { label: 'Variación CT', getValue: (md: any) => md.variacion || 0 },
      ];
      push(buildAnnualSummaryTable(wcConcepts, cache.wcData, duration));
      push(interpretationText(
        `El capital de trabajo se determina con base en días de cobertura: ` +
        `efectivo ${safeStr(p.wcCashCoverageDays)} días, CxC ${safeStr(p.wcReceivableCoverageDays)} días, inventarios ${safeStr(p.wcInventoryCoverageDays)} días.`
      ));
    }
  } catch (e: any) {
    errors.push(`9. CT: ${e.message || e}`);
  }

  // ── 10. COSTOS FINANCIEROS (Merged with loan summary) ──
  try {
    push(pageBreakPara());
    push(sectionHeading('10. Costos Financieros y Préstamos'));
    if (cache.finCosts && cache.finCosts.length > 0) {
      // Aggregate financial costs by month (multiple loans per month need merging)
      const finMonthly = aggregateFinCostsByMonth(cache.finCosts, duration);
      const finConcepts: AnnualConceptDef[] = [
        { label: 'Int. Pagados (efectivo)', getValue: (md: any) => md.interest || 0 },
        { label: 'Int. Capitalizados', getValue: (md: any) => md.capitalizedInterest || 0 },
        { label: 'Int. Gracia Acumulada', getValue: (md: any) => md.graceAccumulatedInterest || 0 },
        { label: 'Total Intereses', bold: true, getValue: (md: any) => md.totalInterest || 0 },
        { label: 'Comisiones Bancarias', getValue: (md: any) => md.bankFee || 0 },
        { label: 'Principal', getValue: (md: any) => md.principal || 0 },
        { label: 'Total Pagado (efectivo)', bold: true, highlight: true, getValue: (md: any) => md.totalPayment || 0 },
      ];
      push(buildAnnualSummaryTable(finConcepts, finMonthly, duration));
    }
    if (cache.loanSummary && Array.isArray(cache.loanSummary) && cache.loanSummary.length > 0) {
      push(subHeading('Resumen de Préstamos por Año'));
      push(buildTable(
        [
          { text: 'Préstamo', widthPct: 20 },
          { text: 'Año', widthPct: 10 },
          { text: 'Saldo Inicial', widthPct: 18 },
          { text: 'Capital', widthPct: 17 },
          { text: 'Intereses', widthPct: 17 },
          { text: 'Cuota Total', widthPct: 18 },
        ],
        cache.loanSummary.map((r: any) => ({
          cells: [r.loanName || '—', String(r.year || '—'), fmt(r.beginningBalance || 0), fmt(r.principal || 0), fmt(r.interest || 0), fmt(r.payment || 0)],
        })),
      ));
    }
    push(interpretationText(
      `Los costos financieros incluyen intereses y gastos bancarios de los ${s.loans.length} préstamos configurados.`
    ));
  } catch (e: any) {
    errors.push(`10. Costos Financieros: ${e.message || e}`);
  }

  // ── 11. ESTADO DE RENDIMIENTO FINANCIERO (UNIFIED) ──
  try {
    push(pageBreakPara());
    push(sectionHeading('11. Estado de Rendimiento Financiero'));
    if (cache.erf && cache.erf.length > 0) {
      // ERF data is EnhancedERFRow[] (per-line, not per-month). Use line-based rendering.
      push(buildERFLineTable(cache.erf, duration));

      // ERF Comercial — only if activityType === 'comercial'
      if (proj.activityType === 'comercial' && cache.erfComercial && cache.erfComercial.length > 0) {
        push(subHeading('ERF — Actividad Comercial (Resolución 1/2022)'));
        push(buildERFLineTable(cache.erfComercial, duration));
        push(interpretationText(
          `Se presenta el ERF bajo la modalidad de Actividad Comercial conforme a la Resolución 1/2022, ` +
          `que incluye canon/royalties del ${fmtPct(p.canonRoyaltiesRate)} y arrendamiento mensual de ${fmt(p.arrendamientoMensual)} CUP.`
        ));
      }

      // Smart interpretation for ERF — find Utilidad Neta line (linea 40)
      const utilNetaLine = (cache.erf as any[]).find((r: any) => r.linea === 40 || r.concepto?.includes('Utilidad Neta'));
      if (utilNetaLine) {
        const lastYearVal = utilNetaLine.monthly ? utilNetaLine.monthly[utilNetaLine.monthly.length - 1] : 0;
        if (lastYearVal > 0) {
          push(interpretationText(
            `El proyecto genera utilidad neta positiva en el último año evaluado, ` +
            `lo que indica sostenibilidad operativa a largo plazo.`
          ));
        }
      }
    }
  } catch (e: any) {
    errors.push(`11. ERF: ${e.message || e}`);
  }

  // ── 12. ESTADO DE COSTOS DE PRODUCCIÓN ──
  try {
    if (cache.costos && cache.costos.length > 0 && proj.activityType !== 'comercial') {
      push(pageBreakPara());
      push(sectionHeading('12. Estado de Costos de Producción'));
      // Costos data is EstadoFinancieroRow[] (per-line, not per-month). Use line-based rendering.
      push(buildERFLineTable(cache.costos, duration));
      push(interpretationText(`Estado de costos de producción conforme a la Resolución 1/2022.`));
    }
  } catch (e: any) {
    errors.push(`12. Costos: ${e.message || e}`);
  }

  // ── 13. FLUJOS DE CAJA (MERGED) ──
  try {
    push(pageBreakPara());
    push(sectionHeading('13. Flujos de Caja'));

    // 13.1 Flujo de Caja — Planificación
    // Use annualRows (pre-calculated by the system) instead of recalculating from monthly data.
    // The system's annualRows are the EXACT values shown in the UI — NEVER recalculate.
    if (cache.cfPlanning) {
      push(subHeading('13.1 Flujo de Caja — Planificación'));
      const planAnnual = (cache.cfPlanning as any).annualRows || [];
      if (planAnnual.length > 0) {
        const planConcepts: YearConceptDef[] = [
          // I. INVERSIONES
          { label: 'I. FLUJO DE CAJA EN INVERSIONES', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Valor Remanente', getValue: (yd: any) => yd.valorRemanente || 0 },
          { label: '  Inversión Fija', getValue: (yd: any) => yd.inversionFija || 0 },
          { label: '  Activos Intangibles', getValue: (yd: any) => yd.activosIntangibles || 0 },
          { label: '  Gastos Previos', getValue: (yd: any) => yd.gastosPrevios || 0 },
          { label: '  Capital Fijo', getValue: (yd: any) => yd.capitalFijo || 0 },
          { label: '  Capital de Trabajo Inicial', getValue: (yd: any) => yd.capitalTrabajoInicial || 0 },
          { label: '  Intereses Capitalizados', getValue: (yd: any) => yd.interesesCapitalizados || 0 },
          { label: '  Saldo Inversiones', bold: true, getValue: (yd: any) => yd.saldoInversiones || 0 },
          // II. FINANCIAMIENTO
          { label: 'II. FLUJO DE CAJA POR FINANCIAMIENTO', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Capital Social', getValue: (yd: any) => yd.capitalSocial || 0 },
          { label: '  Financiamiento', getValue: (yd: any) => yd.financiamiento || 0 },
          { label: '  Recursos Financieros', getValue: (yd: any) => yd.recursosFinancieros || 0 },
          { label: '  Intereses Deuda', getValue: (yd: any) => yd.interesesDeuda || 0 },
          { label: '  Reembolso Principal', getValue: (yd: any) => yd.reembolsoPrincipal || 0 },
          { label: '  Servicio Deuda', getValue: (yd: any) => yd.servicioDeuda || 0 },
          { label: '  Saldo Financiamiento', bold: true, getValue: (yd: any) => yd.saldoFinanciamiento || 0 },
          // III. OPERACIONES
          { label: 'III. FLUJO DE CAJA EN OPERACIONES', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Ventas Netas', getValue: (yd: any) => yd.ventasNetas || 0 },
          { label: '  Otros Ingresos', getValue: (yd: any) => yd.otrosIngresos || 0 },
          { label: '  CT Precedente', getValue: (yd: any) => yd.capitalTrabajoPrecedente || 0 },
          { label: '  Total Entradas Op.', getValue: (yd: any) => yd.totalEntradasOp || 0 },
          { label: '  Costos Variables', getValue: (yd: any) => yd.costosVariables || 0 },
          { label: '  Costos Fijos', getValue: (yd: any) => yd.costosFijos || 0 },
          { label: '  Costos Operación', getValue: (yd: any) => yd.costosOperacion || 0 },
          { label: '  Honorarios Administrativos', getValue: (yd: any) => yd.honorariosAdmin || 0 },
          { label: '  Variación CT', getValue: (yd: any) => yd.variacionCapitalTrabajo || 0 },
          { label: '  Gastos Financieros', getValue: (yd: any) => yd.gastosFinancieros || 0 },
          { label: '  Impuesto Utilidades', getValue: (yd: any) => yd.impuestoUtilidades || 0 },
          { label: '  Otros Impuestos', getValue: (yd: any) => yd.otrosImpuestos || 0 },
          { label: '  Reservas Estimulación', getValue: (yd: any) => yd.reservasEstimulacion || 0 },
          { label: '  Total Salidas Op.', getValue: (yd: any) => yd.totalSalidasOp || 0 },
          { label: '  Saldo Operaciones', bold: true, getValue: (yd: any) => yd.saldoOperaciones || 0 },
          // TOTALES
          { label: 'CONSOLIDADO', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Total Entradas', getValue: (yd: any) => yd.totalEntradas || 0 },
          { label: '  Total Salidas', getValue: (yd: any) => yd.totalSalidas || 0 },
          { label: '  Saldo Anual', bold: true, getValue: (yd: any) => yd.saldoAnual || 0 },
          { label: '  Saldo Acumulado', bold: true, highlight: true, isCumulative: true, getValue: (yd: any) => yd.saldoAcumulado || 0 },
        ];
        push(buildPerYearTable(planConcepts, planAnnual));

        // Find when cumulative turns positive (search monthly for precision)
        const planMonthly = (cache.cfPlanning as any).monthlyRows || [];
        let positiveMonth = -1;
        for (let m = 0; m < planMonthly.length; m++) {
          if ((planMonthly[m].saldoAcumulado || 0) > 0) { positiveMonth = m; break; }
        }
        if (positiveMonth >= 0) {
          push(interpretationText(
            `El flujo acumulado se torna positivo en el mes ${positiveMonth + 1} (año ${Math.floor(positiveMonth / 12) + 1}), ` +
            `lo que significa que a partir de ese momento el proyecto genera excedente de caja.`
          ));
        } else {
          push(interpretationText(`El flujo de caja acumulado no alcanza valores positivos dentro del horizonte evaluado.`));
        }
      }
    }

    // 13.2 Flujo de Caja — Inversión
    if (cache.invCF) {
      push(subHeading('13.2 Flujo de Caja — Inversión'));
      const invMonthly = (cache.invCF as any).monthly || [];
      if (invMonthly.length > 0) {
        const invConcepts: AnnualConceptDef[] = [
          { label: 'ENTRADAS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Ventas Netas', getValue: (md: any) => md.ventasNetas || 0 },
          { label: '  Otros Ingresos', getValue: (md: any) => md.otrosIngresos || 0 },
          { label: '  Total Entradas', bold: true, getValue: (md: any) => md.totalEntradas || 0 },
          { label: 'SALIDAS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Inversión Total', getValue: (md: any) => md.inversionTotal || 0 },
          { label: '  Capital Fijo', getValue: (md: any) => md.capitalFijo || 0 },
          { label: '  Activos Intangibles', getValue: (md: any) => md.activosIntangibles || 0 },
          { label: '  Gastos Previos', getValue: (md: any) => md.gastosPrevios || 0 },
          { label: '  Capital de Trabajo Inicial', getValue: (md: any) => md.capitalTrabajoInicial || 0 },
          { label: '  Variación CT', getValue: (md: any) => md.variacionCapitalTrabajo || 0 },
          { label: '  Costos Operación', getValue: (md: any) => md.costosOperacion || 0 },
          { label: '  Honorarios Administrativos', getValue: (md: any) => md.honorariosAdmin || 0 },
          { label: '  Reservas Estimulación', getValue: (md: any) => md.reservasEstimulacion || 0 },
          { label: '  Impuesto Utilidades', getValue: (md: any) => md.impuestoUtilidades || 0 },
          { label: '  Otros Impuestos', getValue: (md: any) => md.otrosImpuestosTasas || 0 },
          { label: '  Total Impuestos', getValue: (md: any) => md.totalImpuestosTasas || 0 },
          { label: '  Valor Actual Activos', getValue: (md: any) => md.valorActualActivos || 0 },
          { label: '  Total Salidas', bold: true, getValue: (md: any) => md.totalSalidas || 0 },
          { label: 'SALDOS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Saldo Anual', bold: true, getValue: (md: any) => md.saldoAnual || 0 },
          { label: '  Saldo Acumulado', bold: true, highlight: true, isCumulative: true, getValue: (md: any) => md.saldoAcumulado || 0 },
          { label: '  Flujo Actualizado', getValue: (md: any) => md.flujoCajaActualizado || 0 },
          { label: '  Flujo Act. Acumulado', isCumulative: true, getValue: (md: any) => md.flujoCajaActualizadoAcumulado || 0 },
        ];
        push(buildAnnualSummaryTable(invConcepts, invMonthly, duration));
      }
    }

    // 13.3 Flujo de Caja — Capital
    if (cache.eqCF) {
      push(subHeading('13.3 Flujo de Caja — Capital'));
      const eqMonthly = (cache.eqCF as any).monthly || [];
      if (eqMonthly.length > 0) {
        const eqConcepts: AnnualConceptDef[] = [
          { label: 'ENTRADAS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Ventas Netas', getValue: (md: any) => md.ventasNetas || 0 },
          { label: '  Otros Ingresos', getValue: (md: any) => md.otrosIngresos || 0 },
          { label: '  Financiamiento', getValue: (md: any) => md.financiamiento || 0 },
          { label: '  Total Entradas', bold: true, getValue: (md: any) => md.totalEntradas || 0 },
          { label: 'SALIDAS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Inversión Total', getValue: (md: any) => md.inversionTotal || 0 },
          { label: '  Capital Fijo', getValue: (md: any) => md.capitalFijo || 0 },
          { label: '  Activos Intangibles', getValue: (md: any) => md.activosIntangibles || 0 },
          { label: '  Gastos Previos', getValue: (md: any) => md.gastosPrevios || 0 },
          { label: '  Capital de Trabajo Inicial', getValue: (md: any) => md.capitalTrabajoInicial || 0 },
          { label: '  Variación CT', getValue: (md: any) => md.variacionCapitalTrabajo || 0 },
          { label: '  Total Servicio Deuda', getValue: (md: any) => md.totalServiciosDeuda || 0 },
          { label: '    Intereses Deuda', getValue: (md: any) => md.interesesDeuda || 0 },
          { label: '    Reembolso Principal', getValue: (md: any) => md.reembolsoPrincipal || 0 },
          { label: '    Gastos Bancarios', getValue: (md: any) => md.gastosBancarios || 0 },
          { label: '  Costos Operación', getValue: (md: any) => md.costosOperacion || 0 },
          { label: '  Honorarios Administrativos', getValue: (md: any) => md.honorariosAdmin || 0 },
          { label: '  Reservas Estimulación', getValue: (md: any) => md.reservasEstimulacion || 0 },
          { label: '  Impuesto Utilidades', getValue: (md: any) => md.impuestoUtilidades || 0 },
          { label: '  Otros Impuestos', getValue: (md: any) => md.otrosImpuestosTasas || 0 },
          { label: '  Total Impuestos', getValue: (md: any) => md.totalImpuestosTasas || 0 },
          { label: '  Valor Actual Activos', getValue: (md: any) => md.valorActualActivos || 0 },
          { label: '  Total Salidas', bold: true, getValue: (md: any) => md.totalSalidas || 0 },
          { label: 'SALDOS', bold: true, highlight: true, getValue: () => 0 },
          { label: '  Saldo Anual', bold: true, getValue: (md: any) => md.saldoAnual || 0 },
          { label: '  Saldo Acumulado', bold: true, highlight: true, isCumulative: true, getValue: (md: any) => md.saldoAcumulado || 0 },
          { label: '  Flujo Actualizado', getValue: (md: any) => md.flujoCajaActualizado || 0 },
          { label: '  Flujo Act. Acumulado', isCumulative: true, getValue: (md: any) => md.flujoCajaActualizadoAcumulado || 0 },
        ];
        push(buildAnnualSummaryTable(eqConcepts, eqMonthly, duration));
      }
    }
  } catch (e: any) {
    errors.push(`13. Flujos: ${e.message || e}`);
  }

  // ── 14. BALANCE GENERAL ──
  try {
    push(pageBreakPara());
    push(sectionHeading('14. Balance General'));
    if (cache.bs && cache.bs.length > 0) {
      // Balance Sheet is per-year data (BalanceSheetRow[]), use buildPerYearTable with correct property names
      const bsConcepts: YearConceptDef[] = [
        // ACTIVOS
        { label: 'ACTIVOS', sectionHeader: true, getValue: () => 0 },
        { label: 'I. Activo Circulante', sectionHeader: true, getValue: () => 0 },
        { label: '  Efectivo en Caja', getValue: (yd: any) => yd.efectivoEnCaja || 0 },
        { label: '  Efectivo en Banco', getValue: (yd: any) => yd.efectivoEnBanco || 0 },
        { label: '  Cuentas por Cobrar', getValue: (yd: any) => yd.cuentasPorCobrar || 0 },
        { label: '  Inventarios', getValue: (yd: any) => yd.inventarios || 0 },
        { label: '  Mercancías para Venta', getValue: (yd: any) => yd.mercanciasVenta || 0 },
        { label: '  Otros Activos Circulantes', getValue: (yd: any) => yd.otrosActivosCirculantes || 0 },
        { label: '  Total Activo Circulante', bold: true, getValue: (yd: any) => yd.activoCirculante || 0 },
        { label: 'II. Activos Fijos Tangibles', sectionHeader: true, getValue: () => 0 },
        { label: '  AFT Bruto', getValue: (yd: any) => yd.activosFijosTangiblesBruto || 0 },
        { label: '  (-) Depreciación Acumulada', getValue: (yd: any) => yd.depreciacionAcumuladaAFT || 0 },
        { label: '  AFT Neto', bold: true, getValue: (yd: any) => yd.activosFijosTangiblesNeto || 0 },
        { label: 'III. Activos Fijos Intangibles', sectionHeader: true, getValue: () => 0 },
        { label: '  AFI Bruto', getValue: (yd: any) => yd.activosFijosIntangiblesBruto || 0 },
        { label: '  (-) Amortización Acumulada', getValue: (yd: any) => yd.amortizacionAcumuladaAFI || 0 },
        { label: '  AFI Neto', bold: true, getValue: (yd: any) => yd.activosFijosIntangiblesNeto || 0 },
        { label: 'IV. Intereses Capitalizados', getValue: (yd: any) => yd.interesesCapitalizadosActivos || 0 },
        { label: 'V. Gastos Previos', sectionHeader: true, getValue: () => 0 },
        { label: '  Gastos Previos Bruto', getValue: (yd: any) => yd.gastosPreviosBruto || 0 },
        { label: '  (-) Amortización Acumulada GP', getValue: (yd: any) => yd.amortizacionAcumuladaGP || 0 },
        { label: '  Gastos Previos Neto', bold: true, getValue: (yd: any) => yd.gastosPreviosNeto || 0 },
        { label: 'TOTAL ACTIVOS', bold: true, highlight: true, getValue: (yd: any) => yd.totalActivos || 0 },
        // PASIVOS
        { label: 'PASIVOS', sectionHeader: true, getValue: () => 0 },
        { label: 'I. Pasivos Circulantes', sectionHeader: true, getValue: () => 0 },
        { label: '  Cuenta por Pagar', getValue: (yd: any) => yd.cuentaPorPagar || 0 },
        { label: '  Anticipos', getValue: (yd: any) => yd.anticipos || 0 },
        { label: '  Otros Pasivos Corrientes', getValue: (yd: any) => yd.otrosPasivosCorrientes || 0 },
        { label: '  Deuda Corto Plazo', getValue: (yd: any) => yd.deudaCortoPlazo || 0 },
        { label: '  Total Pasivos Circulantes', bold: true, getValue: (yd: any) => yd.pasivoCirculante || 0 },
        { label: 'II. Pasivo a Largo Plazo', sectionHeader: true, getValue: () => 0 },
        { label: '  Pasivo LP Financiamiento', getValue: (yd: any) => yd.pasivoLargoPlazoFinanciamiento || 0 },
        { label: 'TOTAL PASIVOS', bold: true, highlight: true, getValue: (yd: any) => yd.totalPasivos || 0 },
        // CAPITAL CONTABLE
        { label: 'CAPITAL CONTABLE', sectionHeader: true, getValue: () => 0 },
        { label: '  Capital Social Pagado', getValue: (yd: any) => yd.capitalSocialPagado || 0 },
        { label: '  Capital Social Calculado', getValue: (yd: any) => yd.capitalSocialCalculado || 0 },
        { label: '  Capital Autorizado', getValue: (yd: any) => yd.capitalAutorizado || 0 },
        { label: '  Capital por Pagar', getValue: (yd: any) => yd.capitalPorPagar || 0 },
        { label: '  Reservas', getValue: (yd: any) => yd.reservas || 0 },
        { label: '  Utilidades Retenidas', getValue: (yd: any) => yd.utilidadesRetenidas || 0 },
        { label: '  Saldo no Distribuido', getValue: (yd: any) => yd.saldoNoDistribuido || 0 },
        { label: '  Dividendos', getValue: (yd: any) => yd.dividendos || 0 },
        { label: '  Resultado del Ejercicio', getValue: (yd: any) => yd.resultadoDelEjercicio || 0 },
        { label: 'TOTAL CAPITAL CONTABLE', bold: true, highlight: true, getValue: (yd: any) => yd.capitalContable || 0 },
        { label: 'TOTAL PASIVO + CAPITAL', bold: true, getValue: (yd: any) => yd.totalPasivoCapital || 0 },
        { label: 'Ecuación Contable A-(P+C)', getValue: (yd: any) => yd.ecuacionContable || 0 },
        // RATIOS — isRatio: true → uses fmtRatio() (2 decimals), Total column shows '—'
        { label: 'RAZONES FINANCIERAS', sectionHeader: true, getValue: () => 0 },
        { label: '  Razón Circulante', isRatio: true, getValue: (yd: any) => yd.razonCirculante || 0 },
        { label: '  Razón Rápida', isRatio: true, getValue: (yd: any) => yd.razonRapida || 0 },
        { label: '  Razón Endeudamiento', isRatio: true, getValue: (yd: any) => yd.razonEndeudamiento || 0 },
        { label: '  Razón CS/Pasivo', isRatio: true, getValue: (yd: any) => yd.razonCapitalSocialPasivo || 0 },
        { label: '  Razón Deuda LP/Capital', isRatio: true, getValue: (yd: any) => yd.razonDeudaLPCapitalContable || 0 },
        { label: '  Razón Apalancamiento', isRatio: true, getValue: (yd: any) => yd.razonApalancamiento || 0 },
        { label: '  Cobertura Intereses', isRatio: true, getValue: (yd: any) => yd.coberturaIntereses || 0 },
        { label: '  Capacidad Generar Util.', isRatio: true, getValue: (yd: any) => yd.capacidadGenerarUtilidades || 0 },
        { label: '  ROA', isRatio: true, getValue: (yd: any) => yd.rentabilidadActivosROA || 0 },
        { label: '  ROE', isRatio: true, getValue: (yd: any) => yd.rentabilidadCapitalROE || 0 },
        { label: '  Margen Bruto', isRatio: true, getValue: (yd: any) => yd.margenBruto || 0 },
        { label: '  Margen Neto', isRatio: true, getValue: (yd: any) => yd.margenNeto || 0 },
        { label: '  CT Neto', decimals: 2, getValue: (yd: any) => yd.capitalTrabajoNeto || 0 },
        { label: '  Rotación Activos', isRatio: true, getValue: (yd: any) => yd.rotacionActivos || 0 },
        { label: '  Rotación Inventarios', isRatio: true, getValue: (yd: any) => yd.rotacionInventarios || 0 },
      ];
      push(buildPerYearTable(bsConcepts, cache.bs));
      push(interpretationText(balanceInterpretation(cache.bs)));
    }
  } catch (e: any) {
    errors.push(`14. Balance: ${e.message || e}`);
  }

  // ── 15. DISTRIBUCIÓN DE UTILIDADES ──
  try {
    push(pageBreakPara());
    push(sectionHeading('15. Distribución de Utilidades'));
    if (cache.dist && cache.dist.length > 0) {
      const distConcepts: AnnualConceptDef[] = [
        { label: 'Utilidad Neta', bold: true, getValue: (md: any) => md.utilidadNeta || 0 },
        { label: 'Util. Disponibles', getValue: (md: any) => md.utilidadesDisponibles || 0 },
        { label: 'CAM', getValue: (md: any) => md.cam || 0 },
        { label: 'Retenidas', getValue: (md: any) => md.retenida || 0 },
        { label: 'Proyecto', getValue: (md: any) => md.proyecto || 0 },
        { label: 'Total Distribuido', bold: true, highlight: true, getValue: (md: any) => md.totalDistribuido || 0 },
        { label: 'Acum. CAM', isCumulative: true, getValue: (md: any) => md.acumuladoCAM || 0 },
        { label: 'Acum. Retenidas', isCumulative: true, getValue: (md: any) => md.acumuladoRetenida || 0 },
        { label: 'Acum. Proyecto', isCumulative: true, getValue: (md: any) => md.acumuladoProyecto || 0 },
      ];
      push(buildAnnualSummaryTable(distConcepts, cache.dist, duration));
      push(interpretationText(
        `La distribución de utilidades sigue las tasas establecidas: retenidas ${fmtPct(p.retainedEarningsRate)}, ` +
        `CAM ${fmtPct(p.dividendCAMRate)}, cuenta de proyecto ${fmtPct(p.projectAccountRate)}.`
      ));
    }
  } catch (e: any) {
    errors.push(`15. Distribución: ${e.message || e}`);
  }

  // ── 16. EFECTO SOBRE LAS DIVISAS ──
  try {
    push(pageBreakPara());
    push(sectionHeading('16. Efecto sobre las Divisas'));
    if (cache.currEffect && cache.currEffect.length > 0) {
      const currConcepts: AnnualConceptDef[] = [
        { label: 'Entradas Divisas (MLC)', getValue: (md: any) => md.ingresosMLC || 0 },
        { label: 'Ingresos CUP Equivalente', getValue: (md: any) => md.ingresosCUPequivalent || 0 },
        { label: 'Salidas Divisas (MLC)', getValue: (md: any) => md.egresosMLC || 0 },
        { label: 'Egresos CUP Equivalente', getValue: (md: any) => md.egresosCUPequivalent || 0 },
        { label: 'Efecto Neto sobre Divisas (MLC)', bold: true, getValue: (md: any) => md.balanceMLC || 0 },
        { label: 'Efecto Neto CUP', bold: true, getValue: (md: any) => md.balanceCUP || 0 },
        { label: 'Acumulado MLC', isCumulative: true, getValue: (md: any) => md.acumuladoMLC || 0 },
        { label: 'Acumulado CUP', bold: true, highlight: true, isCumulative: true, getValue: (md: any) => md.acumuladoCUP || 0 },
      ];
      push(buildAnnualSummaryTable(currConcepts, cache.currEffect, duration));

      const lastYear = cache.currEffect[cache.currEffect.length - 1];
      if (lastYear && lastYear.balanceMLC > 0) {
        push(interpretationText(
          `El proyecto genera un efecto neto positivo sobre las divisas, contribuyendo con ${fmt(lastYear.balanceMLC)} MLC al balance cambiario.`
        ));
      } else if (lastYear) {
        push(interpretationText(
          `El proyecto presenta un efecto neto negativo sobre las divisas, lo que implica demanda neta de moneda extranjera.`
        ));
      }
    }
  } catch (e: any) {
    errors.push(`16. Divisas: ${e.message || e}`);
  }

  // ── 17. INDICADORES FINANCIEROS (UNIFIED) ──
  try {
    push(pageBreakPara());
    push(sectionHeading('17. Indicadores Financieros'));

    push(buildTable(
      [
        { text: 'Indicador', widthPct: 35 },
        { text: 'Inversión', widthPct: 25 },
        { text: 'Capital', widthPct: 25 },
        { text: 'Criterio', widthPct: 15 },
      ],
      [
        { cells: ['VAN (CUP)', fmt(cache.van), fmt(cache.vanCapital), cache.van > 0 ? 'Viabilidad' : 'No viable'], bold: true, highlight: true },
        { cells: ['TIR', cache.tir !== null ? fmtCalcPct(cache.tir) : '—', cache.tirCapital !== null ? fmtCalcPct(cache.tirCapital) : '—', '> TMAR'] },
        // PR/PRA: UI uses .toFixed(2) → 2 decimals
        { cells: ['Período de Recuperación', cache.pr !== null ? fmt(cache.pr, 2) + ' años' : '—', '—', 'Menor mejor'] },
        { cells: ['PRA (Actualizado)', cache.pra !== null ? fmt(cache.pra, 2) + ' años' : '—', '—', 'Menor mejor'] },
        // B/C, RVAN, IR: UI uses .toFixed(3) → 3 decimals
        { cells: ['Relación B/C', fmtRatio(cache.relacionBC, 3), '—', '> 1.00'] },
        { cells: ['RVAN', fmtRatio(cache.rvan, 3), '—', '> 0'] },
        { cells: ['Índice de Rentabilidad', fmtRatio(cache.indiceRent, 3), '—', '> 0'] },
        { cells: ['VAE', fmt(cache.vae) + ' CUP', '—', '> 0'] },
        { cells: ['VPN-Beta', fmt(cache.vpnBeta) + ' CUP', '—', '> 0'] },
        { cells: ['TIRM', cache.tirm !== null ? fmtCalcPct(cache.tirm) : '—', '—', '> TD'] },
        { cells: ['Tasa de Rendimiento', cache.tasaRendimiento !== null ? fmtCalcPct(cache.tasaRendimiento) : '—', '—', 'Mayor mejor'] },
        { cells: ['Punto de Equilibrio', isFinite(cache.puntoEquilibrio) ? fmt(cache.puntoEquilibrio) + ' CUP' : '—', '—', 'Menor mejor'] },
        { cells: ['Margen de Seguridad', isFinite(cache.margenSeguridad) ? fmtCalcPct(cache.margenSeguridad) : '—', '—', '> 20%'] },
      ],
    ));

    // Smart interpretations for each key indicator
    push(emptyPara(60));
    push(subHeading('Análisis de Indicadores'));
    push(interpretationText(indicatorInterpretation('VAN', cache.van, 'van')));
    push(interpretationText(indicatorInterpretation('TIR', cache.tir, 'tir')));
    push(interpretationText(indicatorInterpretation('Período de Recuperación', cache.pr, 'pr')));
    push(interpretationText(indicatorInterpretation('Relación B/C', cache.relacionBC, 'bc')));
    push(interpretationText(indicatorInterpretation('Punto de Equilibrio', cache.puntoEquilibrio, 'pe')));
    push(interpretationText(indicatorInterpretation('Margen de Seguridad', cache.margenSeguridad, 'ms')));
  } catch (e: any) {
    errors.push(`17. Indicadores: ${e.message || e}`);
  }

  // ── 18. ANÁLISIS DE RIESGO (MERGED: Sensibilidad + Escenarios) ──
  try {
    push(pageBreakPara());
    push(sectionHeading('18. Análisis de Riesgo'));

    // Sensitivity analysis
    push(subHeading('18.1 Análisis de Sensibilidad'));
    const sensRates = [-20, -10, -5, 5, 10, 20];
    const sensRows: { cells: string[]; bold?: boolean; highlight?: boolean }[] = [];
    const baseVan = cache.van;
    sensRows.push({ cells: ['Base (0%)', fmt(baseVan), fmtCalcPct(cache.tir || 0), baseVan > 0 ? 'Viable' : 'No viable'], bold: true });

    for (const rate of sensRates) {
      try {
        const adjFlows = cache.invCashFlows.map((cf: number) => cf * (1 + rate / 100));
        const sensVan = calcVAN(adjFlows, (p.discountRateCUP || 0) / 100);
        const sensTir = calcTIR(adjFlows);
        sensRows.push({
          cells: [
            `Ingresos ${rate > 0 ? '+' : ''}${rate}%`,
            fmt(sensVan),
            sensTir !== null ? fmtCalcPct(sensTir) : '—',
            sensVan > 0 ? 'Viable' : 'No viable',
          ],
        });
      } catch { /* skip */ }
    }
    push(buildTable(
      [
        { text: 'Escenario', widthPct: 25 },
        { text: 'VAN (CUP)', widthPct: 25 },
        { text: 'TIR', widthPct: 25 },
        { text: 'Viabilidad', widthPct: 25 },
      ],
      sensRows,
    ));
    push(interpretationText(
      `El análisis de sensibilidad evalúa cómo varía la viabilidad del proyecto ante cambios en los ingresos. ` +
      `El VAN base es ${fmt(baseVan)} CUP con una TIR de ${cache.tir !== null ? fmtCalcPct(cache.tir) : '—'}.`
    ));

    // Scenarios
    push(subHeading('18.2 Escenarios'));
    try {
      const optimisticFlows = cache.invCashFlows.map((cf: number) => cf * 1.15);
      const pessimisticFlows = cache.invCashFlows.map((cf: number) => cf * 0.85);
      const optVan = calcVAN(optimisticFlows, (p.discountRateCUP || 0) / 100);
      const pesVan = calcVAN(pessimisticFlows, (p.discountRateCUP || 0) / 100);
      const optTir = calcTIR(optimisticFlows);
      const pesTir = calcTIR(pessimisticFlows);

      push(buildTable(
        [
          { text: 'Escenario', widthPct: 25 },
          { text: 'VAN (CUP)', widthPct: 25 },
          { text: 'TIR', widthPct: 25 },
          { text: 'Viabilidad', widthPct: 25 },
        ],
        [
          { cells: ['Pesimista (-15%)', fmt(pesVan), pesTir !== null ? fmtCalcPct(pesTir) : '—', pesVan > 0 ? 'Viable' : 'No viable'] },
          { cells: ['Base', fmt(baseVan), cache.tir !== null ? fmtCalcPct(cache.tir) : '—', baseVan > 0 ? 'Viable' : 'No viable'], bold: true, highlight: true },
          { cells: ['Optimista (+15%)', fmt(optVan), optTir !== null ? fmtCalcPct(optTir) : '—', optVan > 0 ? 'Viable' : 'No viable'] },
        ],
      ));
      push(interpretationText(
        `Bajo el escenario pesimista, el VAN es ${fmt(pesVan)} CUP ${pesVan > 0 ? '(se mantiene viable)' : '(pierde viabilidad)'}. ` +
        `Bajo el optimista, el VAN asciende a ${fmt(optVan)} CUP.`
      ));
    } catch { /* skip scenarios */ }
  } catch (e: any) {
    errors.push(`18. Riesgo: ${e.message || e}`);
  }

  // ── 19. OTROS IMPUESTOS ──
  try {
    push(pageBreakPara());
    push(sectionHeading('19. Otros Impuestos'));
    if (cache.otherTaxes && cache.otherTaxes.length > 0) {
      const taxConcepts: AnnualConceptDef[] = [
        { label: 'Contribución Territorial', getValue: (md: any) => md.operations?.territorialContribution || 0 },
        { label: 'SS Empleador (Operaciones)', getValue: (md: any) => md.operations?.employerSS || 0 },
        { label: 'ITF (Operaciones)', getValue: (md: any) => md.operations?.employerITF || 0 },
        { label: 'IIP (Trabajadores)', getValue: (md: any) => md.operations?.workerIIP || 0 },
        { label: 'SS Trabajadores', getValue: (md: any) => md.operations?.workerSS || 0 },
        { label: 'Total Otros Impuestos', bold: true, highlight: true, getValue: (md: any) => (md.operations?.territorialContribution || 0) + (md.operations?.employerSS || 0) + (md.operations?.employerITF || 0) + (md.operations?.workerIIP || 0) + (md.operations?.workerSS || 0) },
      ];
      push(buildAnnualSummaryTable(taxConcepts, cache.otherTaxes, duration));
      push(interpretationText(`Resumen anual de impuestos y contribuciones distintos al impuesto sobre utilidades.`));
    }
  } catch (e: any) {
    errors.push(`19. Otros Impuestos: ${e.message || e}`);
  }

  // ── 20. CONCLUSIÓN Y RECOMENDACIONES ──
  try {
    push(pageBreakPara());
    push(sectionHeading('20. Conclusión y Recomendaciones'));

    const isViable = cache.van > 0;
    const conclusion = isViable
      ? `Con base en los resultados del estudio de factibilidad financiera, el proyecto "${proj.projectName || 'Sin nombre'}" ` +
        `se considera FINANCIERAMENTE VIABLE. El VAN positivo de ${fmt(cache.van)} CUP demuestra que la inversión genera ` +
        `valor por encima de la tasa de descuento del ${fmtPct(p.discountRateCUP)}.` +
        (cache.tir !== null && cache.tir * 100 > (p.minimumAcceptableRate || 0)
          ? ` La TIR de ${fmtCalcPct(cache.tir)} supera la TMAR de ${fmtPct(p.minimumAcceptableRate)}, confirmando la rentabilidad.`
          : '') +
        (cache.pr !== null ? ` La inversión se recupera en ${fmt(cache.pr, 2)} años.` : '')
      : `Con base en los resultados del estudio de factibilidad financiera, el proyecto "${proj.projectName || 'Sin nombre'}" ` +
        `NO ALCANZA los criterios de viabilidad financiera. El VAN negativo de ${fmt(cache.van)} CUP indica que ` +
        `la inversión no genera retorno suficiente para cubrir la tasa de descuento.` +
        (cache.tir !== null ? ` La TIR de ${fmtCalcPct(cache.tir)} no supera la TMAR requerida.` : '');

    push(bodyText(conclusion));
    push(emptyPara(80));

    // Recommendations
    push(subHeading('Recomendaciones'));
    const recommendations: string[] = [];
    if (isViable) {
      recommendations.push('Proceder con la implementación del proyecto según lo planificado.');
      if (cache.margenSeguridad > 0 && cache.margenSeguridad < 0.2) {
        recommendations.push('Monitorear de cerca los ingresos, ya que el margen de seguridad es limitado.');
      }
      if (cache.pr !== null && cache.pr > duration / 12 * 0.7) {
        recommendations.push('Considerar estrategias para acelerar la recuperación de la inversión.');
      }
    } else {
      recommendations.push('Revisar la estructura de costos para identificar oportunidades de reducción.');
      recommendations.push('Evaluar alternativas para incrementar los ingresos proyectados.');
      recommendations.push('Considerar la renegociación de las condiciones de financiamiento.');
    }
    recommendations.push('Realizar seguimiento periódico de los indicadores financieros durante la ejecución.');
    for (const rec of recommendations) {
      push(bodyText(`• ${rec}`));
    }

    push(emptyPara(200));

    // Signature section
    push(subHeading('Firmas de Aprobación'));
    push(emptyPara(200));

    const sigWidths = calcDxaWidths(A4_PORTRAIT_W, MARGIN_PORTRAIT_NARROW, [1, 1, 1]);
    push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: sigWidths,
      rows: [
        new TableRow({
          children: sigWidths.map(w => new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: noBorders,
            children: [
              new Paragraph({ spacing: { before: 400, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.dark, space: 4 } }, children: [] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 0 }, children: [new TextRun({ text: 'Nombre y Firma', size: 16, font: 'Calibri', color: COLORS.gray })] }),
            ],
          })),
        }),
      ],
    }));
  } catch (e: any) {
    errors.push(`20. Conclusión: ${e.message || e}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // ANEXOS — RESUMEN ANUAL (landscape)
  // ═══════════════════════════════════════════════════════════════

  const annexes: { title: string; concepts: MonthlyConceptDef[]; data: any[] }[] = [];

  // Anexo A: Cronograma de Inversión Mensual
  if (cache.schedResult?.monthly?.length > 0) {
    const cats = cache.schedResult.categories || [];
    annexes.push({
      title: 'Anexo A: Cronograma de Inversión Mensual',
      concepts: cats.map((cat: any) => ({
        label: cat.label || cat.key,
        bold: cat.key === 'totalInversionCUP',
        highlight: cat.key === 'totalInversionCUP',
        getValue: (md: any) => md[cat.key] || 0,
      })),
      data: cache.schedResult.monthly,
    });
  }

  // Anexo B: Depreciación Mensual
  if (cache.depMonthlyData.length > 0) {
    annexes.push({
      title: 'Anexo B: Depreciación y Amortización Mensual',
      concepts: [
        { label: 'Depreciación', getValue: (md: any) => md.depreciation || 0 },
        { label: 'Amortización', getValue: (md: any) => md.amortization || 0 },
        { label: 'Total', bold: true, highlight: true, getValue: (md: any) => md.total || 0 },
      ],
      data: cache.depMonthlyData,
    });
  }

  // Anexo C: Capital de Trabajo Mensual
  if (cache.wcData && cache.wcData.length > 0) {
    annexes.push({
      title: 'Anexo C: Capital de Trabajo Mensual',
      concepts: [
        { label: 'Efectivo en Caja', getValue: (md: any) => md.efectivo || 0 },
        { label: 'CxC a Clientes', getValue: (md: any) => md.cuentasPorCobrar || 0 },
        { label: 'Inventarios', getValue: (md: any) => md.inventarios || 0 },
        { label: 'Prod. en Proceso', getValue: (md: any) => md.productosEnProceso || 0 },
        { label: 'Prod. Terminada', getValue: (md: any) => md.produccionTerminada || 0 },
        { label: 'Piezas Repuesto', getValue: (md: any) => md.piezasRepuesto || 0 },
        { label: 'Mercancías Venta', getValue: (md: any) => md.mercanciasVenta || 0 },
        { label: 'Otros Activos Corr.', getValue: (md: any) => md.otrosActivosCorrientes || 0 },
        { label: 'Total Act. Circulante', bold: true, getValue: (md: any) => md.totalActivosCorrientes || 0 },
        { label: 'CxP Proveedores', getValue: (md: any) => md.cuentaPorPagar || 0 },
        { label: 'Anticipos', getValue: (md: any) => md.anticipos || 0 },
        { label: 'Otros Pasivos Corr.', getValue: (md: any) => md.otrosPasivosCorrientes || 0 },
        { label: 'Total Pas. Corriente', bold: true, getValue: (md: any) => md.totalPasivosCorrientes || 0 },
        { label: 'CT Neto', bold: true, highlight: true, getValue: (md: any) => md.capitalTrabajoNeto || 0 },
      ],
      data: cache.wcData,
    });
  }

  // Anexo D: Costos Financieros Mensuales
  if (cache.finCosts && cache.finCosts.length > 0) {
    const finMonthly = aggregateFinCostsByMonth(cache.finCosts, duration);
    annexes.push({
      title: 'Anexo D: Costos Financieros Mensuales',
      concepts: [
        { label: 'Int. Pagados', getValue: (md: any) => md.interest || 0 },
        { label: 'Int. Capitalizados', getValue: (md: any) => md.capitalizedInterest || 0 },
        { label: 'Total Intereses', bold: true, getValue: (md: any) => md.totalInterest || 0 },
        { label: 'Comisiones Banc.', getValue: (md: any) => md.bankFee || 0 },
        { label: 'Principal', getValue: (md: any) => md.principal || 0 },
        { label: 'Total Pagado', bold: true, highlight: true, getValue: (md: any) => md.totalPayment || 0 },
      ],
      data: finMonthly,
    });
  }

  // Anexo E: Flujos de Caja Mensuales
  if (cache.cfPlanning) {
    const planMonthly = (cache.cfPlanning as any).monthlyRows || [];
    if (planMonthly.length > 0) {
      annexes.push({
        title: 'Anexo E: Flujo de Caja — Planificación Mensual',
        concepts: [
          { label: 'Entradas', getValue: (md: any) => md.totalEntradas || 0 },
          { label: 'Salidas', getValue: (md: any) => md.totalSalidas || 0 },
          { label: 'Saldo Anual', bold: true, getValue: (md: any) => md.saldoAnual || 0 },
          { label: 'Saldo Acumulado', bold: true, highlight: true, getValue: (md: any) => md.saldoAcumulado || 0 },
          { label: '  Inversiones', getValue: (md: any) => md.saldoInversiones || 0 },
          { label: '  Financiamiento', getValue: (md: any) => md.saldoFinanciamiento || 0 },
          { label: '  Operaciones', getValue: (md: any) => md.saldoOperaciones || 0 },
        ],
        data: planMonthly,
      });
    }
  }

  // Anexo F: Balance General Mensual
  if (cache.bs && cache.bs.length > 0) {
    annexes.push({
      title: 'Anexo F: Balance General Mensual',
      concepts: [
        { label: 'Act. Circulante', getValue: (md: any) => md.activoCirculante || 0 },
        { label: 'AFT Neto', getValue: (md: any) => md.activosFijosTangiblesNeto || 0 },
        { label: 'AFI Neto', getValue: (md: any) => md.activosFijosIntangiblesNeto || 0 },
        { label: 'GP Neto', getValue: (md: any) => md.gastosPreviosNeto || 0 },
        { label: 'Total Activos', bold: true, getValue: (md: any) => md.totalActivos || 0 },
        { label: 'Pas. Circulante', getValue: (md: any) => md.pasivoCirculante || 0 },
        { label: 'Pas. LP', getValue: (md: any) => md.pasivoLargoPlazoFinanciamiento || 0 },
        { label: 'Total Pasivos', getValue: (md: any) => md.totalPasivos || 0 },
        { label: 'Capital Contable', bold: true, highlight: true, getValue: (md: any) => md.capitalContable || 0 },
      ],
      data: cache.bs,
    });
  }

  // Anexo G: Distribución de Utilidades Mensual
  if (cache.dist && cache.dist.length > 0) {
    annexes.push({
      title: 'Anexo G: Distribución de Utilidades Mensual',
      concepts: [
        { label: 'Utilidad Neta', bold: true, getValue: (md: any) => md.utilidadNeta || 0 },
        { label: 'Util. Disponibles', getValue: (md: any) => md.utilidadesDisponibles || 0 },
        { label: 'CAM', getValue: (md: any) => md.cam || 0 },
        { label: 'Retenidas', getValue: (md: any) => md.retenida || 0 },
        { label: 'Proyecto', getValue: (md: any) => md.proyecto || 0 },
        { label: 'Total Distribuido', bold: true, highlight: true, getValue: (md: any) => md.totalDistribuido || 0 },
      ],
      data: cache.dist,
    });
  }

  // Anexo H: Efecto Divisas Mensual
  if (cache.currEffect && cache.currEffect.length > 0) {
    annexes.push({
      title: 'Anexo H: Efecto sobre las Divisas Mensual',
      concepts: [
        { label: 'Entradas MLC', getValue: (md: any) => md.ingresosMLC || 0 },
        { label: 'Ingresos CUP', getValue: (md: any) => md.ingresosCUPequivalent || 0 },
        { label: 'Salidas MLC', getValue: (md: any) => md.egresosMLC || 0 },
        { label: 'Egresos CUP', getValue: (md: any) => md.egresosCUPequivalent || 0 },
        { label: 'Balance MLC', bold: true, getValue: (md: any) => md.balanceMLC || 0 },
        { label: 'Balance CUP', bold: true, highlight: true, getValue: (md: any) => md.balanceCUP || 0 },
        { label: 'Acum. MLC', getValue: (md: any) => md.acumuladoMLC || 0 },
        { label: 'Acum. CUP', getValue: (md: any) => md.acumuladoCUP || 0 },
      ],
      data: cache.currEffect,
    });
  }

  // Anexo I: Otros Impuestos Mensual
  if (cache.otherTaxes && cache.otherTaxes.length > 0) {
    annexes.push({
      title: 'Anexo I: Otros Impuestos Mensual',
      concepts: [
        { label: 'Territorial', getValue: (md: any) => md.operations?.territorialContribution || 0 },
        { label: 'SS Empleador', getValue: (md: any) => md.operations?.employerSS || 0 },
        { label: 'ITF', getValue: (md: any) => md.operations?.employerITF || 0 },
        { label: 'Total', bold: true, highlight: true, getValue: (md: any) => (md.operations?.territorialContribution || 0) + (md.operations?.employerSS || 0) + (md.operations?.employerITF || 0) },
      ],
      data: cache.otherTaxes,
    });
  }

  // Build annex sections — only annual summary tables, skip empty annexes
  for (let ai = 0; ai < annexes.length; ai++) {
    const annex = annexes[ai];

    // Skip annexes with no significant data
    const hasData = annex.concepts.some((concept: MonthlyConceptDef) =>
      hasSignificantData(annex.data, (d: any) => concept.getValue(d, 0))
    );
    if (!hasData) continue;

    pushLandscape(sectionHeading(annex.title));
    if (ai > 0) pushLandscape(emptyPara(120));

    // Only generate annual summary table (not monthly matrix)
    const annualTable = buildAnnualSummaryTable(annex.concepts, annex.data, duration);
    pushLandscape(annualTable);
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD DOCUMENT — exactly 2 sections: portrait + landscape
  // ═══════════════════════════════════════════════════════════════
  const projectName = proj.projectName || 'Proyecto';
  const sections: any[] = [];

  if (portraitChildren.length > 0) {
    sections.push(portraitSection(portraitChildren, projectName));
  }
  if (landscapeChildren.length > 0) {
    sections.push(landscapeSection(landscapeChildren, projectName));
  }

  const doc = new Document({
    sections,
    creator: 'BARAPRO v10.1',
    title: `Estudio de Factibilidad — ${projectName}`,
    description: 'Evaluación Financiera de Proyectos — Metodología PDL Cuba',
  });

  return doc;
}

// ============================================================
// CLIENT-SIDE EXPORT (returns Blob for browser download)
// ============================================================
export async function exportToDocx(state: BaraproState): Promise<Blob> {
  const doc = buildDocxDocument(state);
  const blob = await Packer.toBlob(doc);
  return blob;
}

// ============================================================
// SERVER-SIDE BUFFER GENERATION
// Used by API route — returns a Node.js Buffer (not a Blob).
// Packer.toBuffer() is the native Node.js method.
// ============================================================
export async function exportToDocxBuffer(state: BaraproState): Promise<Buffer> {
  const doc = buildDocxDocument(state);
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ============================================================
// DOWNLOAD HELPER (Client-side)
// ============================================================
export function downloadDocx(state: BaraproState, filename: string): void {
  exportToDocx(state).then(blob => {
    const finalName = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    downloadBlob(blob, finalName);
  }).catch(err => {
    console.error('Error generating DOCX:', err);
  });
}
