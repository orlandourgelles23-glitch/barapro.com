import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import {
  buildCashFlowInvestment,
  buildCashFlowEquity,
  calcPuntoEquilibrio,
  calcMargenSeguridad,
  buildDepreciationByItem,
  calcTIRM,
  calcBCWithIP,
  calcVAEWithIP,
  calcIRWithIP,
  calcRVANWithIP,
  findOperationStartMonth,
} from './barapro-financial';

// ============================================================
// Sheet name constants (Spanish)
// ============================================================
const SHEETS = {
  metadatos: 'Metadatos',
  project: 'Proyecto',
  construction: 'Construcción',
  capital: 'Capital',
  subcontract: 'Subcontrataciones',
  resources: 'Recursos Humanos',
  purchases: 'Compras',
  sales: 'Ventas',
  otherIncome: 'Otros Ingresos',
  subventions: 'Subvenciones',
  salesReturns: 'Devoluciones',
  commercial: 'Comerciales',
  admin: 'Administración',
  maintenance: 'Mantenimiento',
  indirect: 'Indirectos',
  loans: 'Financiamiento',
  parameters: 'Parámetros',
  spareParts: 'Piezas',
  otherResources: 'Otros Recursos',
  intangibles: 'Intangibles',
  directCosts: 'Costos Directos',
  publicServices: 'Servicios Públicos',
  logicalFramework: 'Marco Lógico',
  indicators: 'Indicadores',
  depreciation: 'Depreciación',
  balanceSheet: 'Balance General',
  currencyEffect: 'Efecto Monetario',
} as const;

// Spanish labels for project fields
const PROJECT_LABELS: Record<string, string> = {
  projectName: 'Nombre del Proyecto',
  investorName: 'Inversionista',
  province: 'Provincia',
  municipality: 'Municipio',
  sector: 'Sector',
  startDate: 'Fecha de Inicio',
  monthsDuration: 'Duración (meses)',
  baseCurrency: 'Moneda Base',
  calculationMode: 'Modo de Cálculo',
  projectType: 'Tipo de Proyecto',
  activityType: 'Tipo de Actividad',
  exchangeRates: 'Tasas de Cambio',
};

// Spanish labels for parameter fields
const PARAMETER_LABELS: Record<string, string> = {
  incomeTaxRate: 'Impuesto sobre Ingresos (%)',
  salesTaxRate: 'Impuesto sobre Ventas (%)',
  specialSocialSecurityRate: 'Contribución Especial a la Seguridad Social (%)',
  taxOnWorkforceRate: 'Impuesto sobre Fuerza de Trabajo (%)',
  territorialTaxRate: 'Impuesto Territorial (%)',
  personalIncomeTaxExemptMin: 'Mínimo Exento de IIP (CUP)',
  personalIncomeTaxRate: 'Impuesto sobre Ingresos Personales (%)',
  workerSocialSecurityRate: 'Contribución Especial Trabajadores a la SS (%)',
  honorariosAdminRate: 'Honorarios de Administración (%)',
  discountRateCUP: 'Tasa de Descuento CUP (%)',
  discountRateMLC: 'Tasa de Descuento MLC (%)',
  minimumAcceptableRate: 'Tasa Mínima Aceptable (%)',
  inflationRate: 'Tasa de Inflación (%)',
  contingencyReserveRate: 'Reserva de Contingencia Inversion (%)',
  operationsContingencyRate: 'Reserva de Contingencia Operaciones (%)',
  retainedEarningsRate: 'Retención de Utilidades (%)',
  dividendCAMRate: 'Dividendo CAM (%)',
  projectAccountRate: 'Cuenta Proyecto (%)',
  bankFeeRate: 'Comisión Bancaria (%)',
  salaryComplementRate: 'Complemento Salarial (%)',
  vacationNormRate: 'Norma de Vacaciones (%)',
  depreciationMethod: 'Método de Depreciación',
  usefulLifeYears: 'Vida Útil (años)',
  residualValuePercent: 'Valor Residual Global (%)',
  gastosPreviosAmortYears: 'Amortización Gastos Previos (años)',
  workingDaysPerYear: 'Días Laborales por Año',
  workingDaysPerMonth: 'Días Laborales por Mes',
  wcCashCoverageDays: 'CT - Cobertura Efectivo (días)',
  wcReceivableCoverageDays: 'CT - Cobertura Cuentas por Cobrar (días)',
  wcInventoryCoverageDays: 'CT - Cobertura Inventarios (días)',
  wcPayableDays: 'CT - Cuentas por Pagar (días)',
  wcWipCoverageDays: 'CT - Producción en Proceso (días)',
  wcFinishedGoodsCoverageDays: 'CT - Productos Terminados (días)',
  wcSparePartsCoverageDays: 'CT - Piezas de Repuesto (días)',
  wcMercanciasVentaCoverageDays: 'CT - Mercancías para la Venta (días)',
  assetCategoryRates: 'Tasas por Categoría de Activos',
  // Resolución 1/2022 — Distribución de Utilidades
  arieRate: 'ARIE (%)',
  reservasEstimulacionRate: 'Reservas de Estimulación (%)',
  beneficioReinvertirRate: 'Beneficio a Reinvertir (%)',
  // Actividad Comercial
  canonRoyaltiesRate: 'Canon y Royalties (%)',
  arrendamientoMensual: 'Arrendamiento Mensual (CUP)',
  // Desgloses adicionales
  otrosGastosVariablesPct: 'Otros Gastos Variables (%)',
  otrasReservasVoluntariasRate: 'Otras Reservas Voluntarias (%)',
  pagoUtilidadesRetenidasAmt: 'Pago Utilidades Retenidas (CUP/mes)',
  dividendoEstatalPct: 'Dividendo Estatal (%)',
  dividendoSocioCubanoPct: 'Dividendo Socio Cubano (%)',
  dividendoSocioExtranjeroPct: 'Dividendo Socio Extranjero (%)',
};

// ============================================================
// Accent-normalization helper for backward compatibility
// Pre-V10 files (V8.x, V9.x) may lack Spanish accents in sheet
// names and parameter labels. This function strips accents so
// that 'Construccion' matches 'Construcción', etc.
// ============================================================
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Build an accent-insensitive reverse lookup: normalizedLabel → key
// This allows V8.9 labels like 'Contribucion' to match V10 'Contribución'.
function buildAccentInsensitiveLookup(
  labels: Record<string, string>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, label] of Object.entries(labels)) {
    // Store the canonical (accented) label
    map.set(stripAccents(label).toLowerCase(), key);
    // Also store the raw key in case the Excel used raw English keys
    map.set(key.toLowerCase(), key);
  }
  return map;
}

// ============================================================
// 1. Export full store state to Excel workbook
// ============================================================
export function exportToExcel(state: any): WorkBook {
  const wb = XLSX.utils.book_new();

  // --- Metadatos sheet (V10 — FIRST sheet in workbook) ---
  const projectName = state.project?.projectName || '';
  const sliceCount = 27; // V10_DATA_SLICES.length
  const metaRows: (string | number)[][] = [
    ['BARAPRO V10 — Metadatos del Proyecto'],
    [],
    ['Versión del Formato', '10.0'],
    ['Versión de la Aplicación', '10.0'],
    ['Fecha de Exportación', new Date().toISOString()],
    ['Nombre del Proyecto', projectName],
    ['Rebanas de Datos', sliceCount],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), SHEETS.metadatos);

  // --- Proyecto sheet (key-value pairs via aoa) ---
  const projectRows: (string | number)[][] = [['Campo', 'Valor']];
  if (state.project) {
    const proj = state.project as Record<string, any>;
    for (const [key, label] of Object.entries(PROJECT_LABELS)) {
      let value = proj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      if (value !== undefined && value !== null && value !== '') {
        projectRows.push([label, value as string | number]);
      }
    }
    // Include any extra keys not in the label map
    for (const [key, value] of Object.entries(proj)) {
      if (!(key in PROJECT_LABELS)) {
        if (typeof value !== 'object') {
          projectRows.push([key, value as string | number]);
        }
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectRows), SHEETS.project);

  // --- Item array sheets (json_to_sheet) ---
  const itemSheets: [string, string][] = [
    ['constructionItems', SHEETS.construction],
    ['capitalItems', SHEETS.capital],
    ['subcontractItems', SHEETS.subcontract],
    ['resourceItems', SHEETS.resources],
    ['purchaseItems', SHEETS.purchases],
    ['salesItems', SHEETS.sales],
    ['otherIncomeItems', SHEETS.otherIncome],
    ['subventionItems', SHEETS.subventions],
    ['salesReturnItems', SHEETS.salesReturns],
    ['commercialExpenses', SHEETS.commercial],
    ['adminExpenses', SHEETS.admin],
    ['maintenanceItems', SHEETS.maintenance],
    ['indirectExpenses', SHEETS.indirect],
    ['loans', SHEETS.loans],
    ['sparePartItems', SHEETS.spareParts],
    ['otherResourceItems', SHEETS.otherResources],
    ['intangibleAssets', SHEETS.intangibles],
    ['directCostItems', SHEETS.directCosts],
    ['publicServiceItems', SHEETS.publicServices],
    ['commercialSalaries', SHEETS.commercial + ' Salarios'],
    ['adminSalaries', SHEETS.admin + ' Salarios'],
    ['maintenanceSalaries', SHEETS.maintenance + ' Salarios'],
    ['indirectSalaries', SHEETS.indirect + ' Salarios'],
    ['directCostSalaries', SHEETS.directCosts + ' Salarios'],
  ];

  // Array/object fields per state key that MUST be JSON-stringified before json_to_sheet.
  // SheetJS silently drops array cells (raw JS arrays have no .v property → XML writer skips them).
  const ARRAY_FIELDS: Record<string, string[]> = {
    constructionItems: ['months'],
    capitalItems: ['months'],
    subcontractItems: ['months'],
    resourceItems: ['months'],
    purchaseItems: ['months'],
    salesItems: ['months', 'quantity'],
    otherIncomeItems: ['months'],
    subventionItems: ['months', 'quantities'],
    salesReturnItems: ['months', 'quantities'],
    commercialExpenses: ['months'],
    adminExpenses: ['months'],
    maintenanceItems: ['months'],
    indirectExpenses: ['months'],
    loans: ['disbursementSchedule', 'interestRateTable', 'exchangeRateTable', 'bankFees'],
    sparePartItems: ['months'],
    otherResourceItems: ['months'],
    intangibleAssets: ['months'],
    directCostItems: ['months'],
    publicServiceItems: ['months'],
    commercialSalaries: ['months'],
    adminSalaries: ['months'],
    maintenanceSalaries: ['months'],
    indirectSalaries: ['months'],
    directCostSalaries: ['months'],
  };

  // Pre-serialize array/object fields so SheetJS writes them as JSON strings (not raw objects)
  function prepareRowForExport(row: any, stateKey: string): any {
    const copy = { ...row };
    delete copy.id;
    const arrFields = ARRAY_FIELDS[stateKey] || [];
    for (const field of arrFields) {
      if (Array.isArray(copy[field]) || (copy[field] && typeof copy[field] === 'object')) {
        copy[field] = JSON.stringify(copy[field]);
      }
    }
    return copy;
  }

  for (const [stateKey, sheetName] of itemSheets) {
    const data = state[stateKey];
    if (Array.isArray(data) && data.length > 0) {
      // Pre-serialize arrays and strip internal id fields
      const cleaned = data.map((row: any) => prepareRowForExport(row, stateKey));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleaned), sheetName);
    } else {
      // Empty placeholder sheet with a header
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['(sin datos)']]), sheetName);
    }
  }

  // --- Parámetros sheet (key-value pairs via aoa) ---
  const paramRows: (string | number)[][] = [['Parámetro', 'Valor']];
  if (state.parameters) {
    const params = state.parameters as Record<string, any>;
    for (const [key, label] of Object.entries(PARAMETER_LABELS)) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        paramRows.push([label, value as string | number]);
      }
    }
    // Export assetCategoryRates as a JSON row
    if (params.assetCategoryRates && Array.isArray(params.assetCategoryRates)) {
      paramRows.push(['Tasas por Categoría de Activos', JSON.stringify(params.assetCategoryRates)]);
    }
    // Include extra scalar keys
    for (const [key, value] of Object.entries(params)) {
      if (!(key in PARAMETER_LABELS) && key !== 'assetCategoryRates' && typeof value !== 'object') {
        paramRows.push([key, value as string | number]);
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramRows), SHEETS.parameters);

  // --- Marco Lógico sheet ---
  if (state.logicalFramework) {
    const lf = state.logicalFramework;
    const lfRows: (string | number)[][] = [
      ['Nivel', 'Narrativa', 'Indicadores', 'Medios de Verificación', 'Supuestos', 'Padre ID', '_id_original'],
    ];
    const rows = lf.rows;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        lfRows.push([
          row.level || '',
          row.narrative || '',
          row.indicators || '',
          row.verificationMeans || '',
          row.assumptions || '',
          row.parentId || '',
          row.id || '', // _id_original for round-trip hierarchy
        ]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lfRows), SHEETS.logicalFramework);
  } else {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Nivel', 'Narrativa', 'Indicadores', 'Medios de Verificación', 'Supuestos', 'Padre ID']]),
      SHEETS.logicalFramework
    );
  }

  // --- Indicadores sheet ---
  try {
    const duration = state.project?.monthsDuration || 120;
    const startDate = state.project?.startDate || new Date().toISOString().slice(0, 7);
    const annualRate = (state.parameters?.discountRateCUP || 0) / 100;
    const investmentMonths = findOperationStartMonth(state as any) - 1;
    const investmentYears = Math.ceil(investmentMonths / 12);

    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Helper: compute annual flows from monthly rows
    const buildAnnualFlows = (monthlyRows: any[]): number[] => {
      const totalYears = Math.ceil(duration / 12);
      const flows: number[] = [];
      for (let y = 0; y < totalYears; y++) {
        const start = y * 12;
        const end = Math.min(start + 12, duration);
        const yearSum = monthlyRows.slice(start, end).reduce((s: number, r: any) => s + (r.saldoAnual || 0), 0);
        flows.push(yearSum);
      }
      return flows;
    };

    // Helper: format a percentage value (0.15 → '15.00') or null → 'N/D'
    const fmtPct = (v: number | null | undefined): string | number => {
      if (v === null || v === undefined) return 'N/D';
      if (!isFinite(v)) return 'N/D';
      return Math.round(v * 10000) / 100; // 2 decimal places as percentage
    };

    // Helper: format monetary value
    const fmtMoney = (v: number | null | undefined): string | number => {
      if (v === null || v === undefined) return 'N/D';
      return Math.round(v);
    };

    // Helper: format years
    const fmtYears = (v: number | null | undefined): string | number => {
      if (v === null || v === undefined) return 'N/D';
      if (!isFinite(v)) return 'N/D';
      return Math.round(v * 100) / 100; // 2 decimal places
    };

    const invResult = buildCashFlowInvestment(state as any);
    const eqResult = buildCashFlowEquity(state as any);
    const invAnnualFlows = buildAnnualFlows(invResult.monthly);
    const eqAnnualFlows = buildAnnualFlows(eqResult.monthly);

    const puntoEquilibrio = calcPuntoEquilibrio(state as any);
    const margenSeguridad = calcMargenSeguridad(state as any);

    const indicadoresRows: (string | number)[][] = [
      ['Indicadores Financieros — Resolución 1/2022'],
      ['Perspectiva', 'Inversión', 'Capital Social'],
      ['VAN', fmtMoney(invResult.indicators.van), fmtMoney(eqResult.indicators.van)],
      ['TIR (%)', fmtPct(invResult.indicators.tir), fmtPct(eqResult.indicators.tir)],
      ['TIRM (%)', fmtPct(calcTIRM(invAnnualFlows, annualRate, annualRate)), fmtPct(calcTIRM(eqAnnualFlows, annualRate, annualRate))],
      ['PR (años)', fmtYears(invResult.indicators.pr), fmtYears(eqResult.indicators.pr)],
      ['B/C', fmtMoney(calcBCWithIP(invAnnualFlows, annualRate, investmentYears)), fmtMoney(calcBCWithIP(eqAnnualFlows, annualRate, investmentYears))],
      ['VAE', fmtMoney(calcVAEWithIP(invAnnualFlows, annualRate, investmentYears)), fmtMoney(calcVAEWithIP(eqAnnualFlows, annualRate, investmentYears))],
      ['PRA (años)', fmtYears(invResult.indicators.pra), fmtYears(eqResult.indicators.pra)],
      ['RVAN', fmtMoney(calcRVANWithIP(invAnnualFlows, annualRate, investmentYears)), fmtMoney(calcRVANWithIP(eqAnnualFlows, annualRate, investmentYears))],
      ['IR', fmtMoney(calcIRWithIP(invAnnualFlows, annualRate, investmentYears)), fmtMoney(calcIRWithIP(eqAnnualFlows, annualRate, investmentYears))],
      ['Punto de Equilibrio', fmtMoney(puntoEquilibrio), ''],
      ['Margen de Seguridad (%)', fmtPct(margenSeguridad), ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(indicadoresRows), SHEETS.indicators);
  } catch {
    // If indicators computation fails (e.g., missing data), create placeholder
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Indicadores Financieros'], ['(error al calcular)']]),
      SHEETS.indicators
    );
  }

  // --- Depreciación sheet ---
  try {
    const duration = state.project?.monthsDuration || 120;
    const depSummary = buildDepreciationByItem(state as any);

    const depRows: (string | number)[][] = [
      ['Tabla de Depreciación y Amortización'],
      ['Mes', 'Depreciación', 'Amortización', 'Total'],
    ];
    for (let m = 0; m < duration; m++) {
      const dep = Math.round(depSummary.totalMonthlyDepreciation[m] || 0);
      const amort = Math.round(depSummary.totalMonthlyAmortization[m] || 0);
      depRows.push([m + 1, dep, amort, dep + amort]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(depRows), SHEETS.depreciation);
  } catch {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Tabla de Depreciación y Amortización'], ['(error al calcular)']]),
      SHEETS.depreciation
    );
  }

  // --- Balance General sheet (placeholder) ---
  try {
    const duration = state.project?.monthsDuration || 120;
    const startDate = state.project?.startDate || new Date().toISOString().slice(0, 7);
    const [startYear, startMonth] = startDate.split('-').map(Number);
    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthLabels: string[] = [];
    for (let m = 0; m < duration; m++) {
      const monthIndex = ((startMonth || 1) - 1 + m) % 12;
      const year = (startYear || 2025) + Math.floor(((startMonth || 1) - 1 + m) / 12);
      monthLabels.push(`${MONTH_NAMES[monthIndex]} ${year}`);
    }
    const bgRows: (string | number)[][] = [
      ['Balance General'],
      ['Concepto', ...monthLabels],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bgRows), SHEETS.balanceSheet);
  } catch {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Balance General'], ['Concepto']]),
      SHEETS.balanceSheet
    );
  }

  // --- Efecto Monetario sheet (placeholder) ---
  try {
    const duration = state.project?.monthsDuration || 120;
    const startDate = state.project?.startDate || new Date().toISOString().slice(0, 7);
    const [startYear, startMonth] = startDate.split('-').map(Number);
    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthLabels: string[] = [];
    for (let m = 0; m < duration; m++) {
      const monthIndex = ((startMonth || 1) - 1 + m) % 12;
      const year = (startYear || 2025) + Math.floor(((startMonth || 1) - 1 + m) / 12);
      monthLabels.push(`${MONTH_NAMES[monthIndex]} ${year}`);
    }
    const emRows: (string | number)[][] = [
      ['Efecto Monetario'],
      ['Concepto', ...monthLabels],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emRows), SHEETS.currencyEffect);
  } catch {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Efecto Monetario'], ['Concepto']]),
      SHEETS.currencyEffect
    );
  }

  return wb;
}

// ============================================================
// 2. Import from Excel buffer into store-compatible shape
// ============================================================
// Generate a unique ID (browser-safe, no external dependency)
function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Fields known to contain JSON-encoded arrays/objects (not arbitrary text).
// Only these fields will be JSON-parsed on import to avoid corrupting text values
// that happen to start with '[' or '{'.
const JSON_PARSE_FIELDS: Set<string> = new Set([
  // Array fields (per ARRAY_FIELD_MAP in store)
  'months', 'quantity', 'quantities',
  'disbursementSchedule', 'interestRateTable', 'exchangeRateTable', 'bankFees',
]);

// Parse JSON strings back to objects/arrays — ONLY for known JSON fields.
function parseJsonFields(row: any, stateKey?: string): any {
  const r = { ...row };
  for (const key of Object.keys(r)) {
    // Only JSON-parse fields that are known to contain serialized arrays/objects
    if (JSON_PARSE_FIELDS.has(key) && typeof r[key] === 'string' &&
        (r[key].startsWith('[') || r[key].startsWith('{'))) {
      try { r[key] = JSON.parse(r[key]); } catch { /* keep as string */ }
    }
    // Coerce numeric strings to numbers for known number fields
    if (typeof r[key] === 'string' && r[key] !== '' && !isNaN(Number(r[key])) &&
        ['monthsDuration', 'quantity', 'unitCostCUP', 'unitCostMLC', 'totalCostCUP', 'totalCostMLC',
         'monthlySalaryCUP', 'monthlySalaryMLC', 'priceCUP', 'priceMLC', 'amountCUP', 'amountMLC',
         'annualRate', 'termMonths', 'gracePeriodMonths', 'startMonth', 'usefulLifeYears',
         'residualPercent', 'monthlyPayment', 'unitCostMPCUP', 'unitCostMPMLC',
         'authorizedAmount', 'numInstallments', 'commissionRate', 'insuranceRate',
         'otherRate'].includes(key)) {
      r[key] = Number(r[key]);
    }
    // Coerce known boolean fields (handles manual Excel edits: "true"/"false"/1/0)
    if (['isAutoGenerated', 'includesSocialSecurity', 'includesWorkforceTax',
         'depreciable', 'capitalizableInterest'].includes(key)) {
      if (typeof r[key] === 'string') {
        r[key] = r[key] === 'true' || r[key] === '1';
      } else if (typeof r[key] === 'number') {
        r[key] = r[key] === 1;
      }
    }
  }
  return r;
}

// Add missing IDs and apply defaults to imported items
function ensureItemIds(items: any[], defaults?: Record<string, any>): any[] {
  return items.map((item: any) => ({
    id: item.id || genId(),
    ...defaults,
    ...item,
  }));
}

export function importFromExcel(buffer: ArrayBuffer): any {
  const wb = XLSX.read(buffer, { type: 'array' });
  const result: any = {};

  // Helper: find sheet by name (case-insensitive AND accent-insensitive)
  // Pre-V10 files (V8.x, V9.x) may lack Spanish accents in sheet names
  // (e.g., 'Construccion' vs 'Construcción', 'Parametros' vs 'Parámetros')
  const getSheet = (name: string) => {
    const normalizedTarget = stripAccents(name).toLowerCase();
    return wb.SheetNames.find((n) => stripAccents(n).toLowerCase() === normalizedTarget);
  };

  // --- Detect format version from Metadatos sheet (V10+) ---
  // If no Metadatos sheet exists, this is a pre-V10 file (V8.x/V9.x).
  // Pre-V10 files store rate parameters as 0-1 decimals instead of 0-100 integers.
  let isPreV10 = true;
  const metaName = getSheet('Metadatos');
  if (metaName) {
    isPreV10 = false; // V10+ format detected
    const ws = wb.Sheets[metaName];
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    for (const row of aoa) {
      if (!row || row.length < 2) continue;
      const label = String(row[0]);
      if (label === 'Versión del Formato') {
        const version = String(row[1]);
        result._metaFormatVersion = version;
        const majorVersion = Number(version.split('.')[0]);
        if (majorVersion > 10) {
          console.warn(
            `BARAPRO: El archivo fue exportado con formato v${version}, más reciente que v10.1. Algunos datos pueden no ser compatibles.`
          );
        }
      }
      if (label === 'Versión de la Aplicación') {
        result._metaAppVersion = String(row[1]);
      }
      if (label === 'Fecha de Exportación') {
        result._metaExportDate = String(row[1]);
      }
      if (label === 'Nombre del Proyecto') {
        result._metaProjectName = String(row[1]);
      }
    }
  }

  // --- Proyecto sheet ---
  const projName = getSheet('Proyecto');
  if (projName) {
    const ws = wb.Sheets[projName];
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    const proj: Record<string, any> = {};
    // Accent-insensitive reverse label lookup
    const projLabelLookup = buildAccentInsensitiveLookup(PROJECT_LABELS);
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.length < 2) continue;
      const label = String(row[0]);
      const value = row[1];
      // Try accent-insensitive match first, then fall back to raw label as key
      const normalizedLabel = stripAccents(label).toLowerCase();
      const key = projLabelLookup.get(normalizedLabel) || label;
      // Try to parse JSON strings back to objects
      if (typeof value === 'string' && value.startsWith('{')) {
        try { proj[key] = JSON.parse(value); } catch { proj[key] = value; }
      } else {
        proj[key] = value;
      }
    }
    result.project = proj;
  }

  // --- Item array sheets ---
  const itemSheetMapping: [string, string][] = [
    ['Construcción', 'constructionItems'],
    ['Capital', 'capitalItems'],
    ['Subcontrataciones', 'subcontractItems'],
    ['Recursos Humanos', 'resourceItems'],
    ['Compras', 'purchaseItems'],
    ['Ventas', 'salesItems'],
    ['Otros Ingresos', 'otherIncomeItems'],
    ['Subvenciones', 'subventionItems'],
    ['Devoluciones', 'salesReturnItems'],
    ['Comerciales', 'commercialExpenses'],
    ['Administración', 'adminExpenses'],
    ['Mantenimiento', 'maintenanceItems'],
    ['Indirectos', 'indirectExpenses'],
    ['Financiamiento', 'loans'],
    ['Piezas', 'sparePartItems'],
    ['Otros Recursos', 'otherResourceItems'],
    ['Intangibles', 'intangibleAssets'],
    ['Costos Directos', 'directCostItems'],
    ['Servicios Públicos', 'publicServiceItems'],
  ];

  // Default values for optional fields per item type
  const itemDefaults: Record<string, Record<string, any>> = {
    constructionItems: { depreciable: true },
    capitalItems: { depreciable: true },
    purchaseItems: { origin: 'Nacional' },
  };

  for (const [sheetLabel, stateKey] of itemSheetMapping) {
    const sheetName = getSheet(sheetLabel);
    if (sheetName) {
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(ws);
      if (Array.isArray(json) && json.length > 0) {
        // Parse JSON strings, coerce numbers, regenerate IDs
        let parsed = ensureItemIds(
          json.map((row: any) => parseJsonFields(row)),
          itemDefaults[stateKey]
        );
        // Filter out auto-generated items (e.g., investment financial expenses)
        if (stateKey === 'otherResourceItems') {
          parsed = parsed.filter((item: any) => !item.isAutoGenerated);
        }
        result[stateKey] = parsed;
      }
    }
  }

  // --- Salary sub-sheets (matched by accent-insensitive regex) ---
  const salarySheetMap: [RegExp, string][] = [
    [/^comerciales salarios$/i, 'commercialSalaries'],
    [/^administraci[oó]n salarios$/i, 'adminSalaries'],
    [/^mantenimiento salarios$/i, 'maintenanceSalaries'],
    [/^indirectos salarios$/i, 'indirectSalaries'],
    [/^costos directos salarios$/i, 'directCostSalaries'],
  ];

  for (const [pattern, stateKey] of salarySheetMap) {
    // Accent-insensitive match: strip accents from sheet names before testing
    const found = wb.SheetNames.find((n) => pattern.test(stripAccents(n).toLowerCase()));
    if (found) {
      const ws = wb.Sheets[found];
      const json = XLSX.utils.sheet_to_json(ws);
      if (Array.isArray(json) && json.length > 0) {
        // Parse JSON strings and regenerate IDs (same as main item sheets)
        result[stateKey] = ensureItemIds(
          json.map((row: any) => parseJsonFields(row))
        );
      }
    }
  }

  // --- Parámetros sheet ---
  const paramName = getSheet('Parámetros');
  if (paramName) {
    const ws = wb.Sheets[paramName];
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    const params: Record<string, any> = {};
    // Accent-insensitive parameter label lookup
    const paramLabelLookup = buildAccentInsensitiveLookup(PARAMETER_LABELS);
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.length < 2) continue;
      const label = String(row[0]);
      const value = row[1];
      // Try accent-insensitive match
      const normalizedLabel = stripAccents(label).toLowerCase();
      const key = paramLabelLookup.get(normalizedLabel) || label;
      // Special: assetCategoryRates JSON array (label was matched via accent-insensitive lookup)
      if (key === 'assetCategoryRates' && typeof value === 'string' && value.startsWith('[')) {
        try { params.assetCategoryRates = JSON.parse(value); } catch { params[key] = value; }
      } else {
        params[key] = value;
      }
    }
    // Coerce numeric parameter values from strings to numbers
    // (handles manually-edited Excel files where numbers were typed as text)
    const NUMERIC_PARAMS = new Set(Object.keys(PARAMETER_LABELS));
    for (const key of Object.keys(params)) {
      if (NUMERIC_PARAMS.has(key) && typeof params[key] === 'string' && params[key] !== '') {
        const num = Number(params[key]);
        if (!isNaN(num)) {
          params[key] = num;
        }
      }
    }

    // --- V8.9/V9.x backward compatibility: convert decimal rates to integer percentages ---
    // Pre-V10 files stored rates as 0-1 decimals (e.g., 0.15 for 15%).
    // V10 stores rates as 0-100 integers (e.g., 15 for 15%).
    // Detection: if no Metadatos sheet (isPreV10) OR any rate is 0 < value < 1.
    const RATE_KEYS = [
      'incomeTaxRate', 'salesTaxRate', 'specialSocialSecurityRate',
      'taxOnWorkforceRate', 'personalIncomeTaxRate', 'workerSocialSecurityRate',
      'territorialTaxRate', 'honorariosAdminRate',
      'discountRateCUP', 'discountRateMLC', 'minimumAcceptableRate', 'inflationRate',
      'contingencyReserveRate', 'operationsContingencyRate', 'retainedEarningsRate',
      'dividendCAMRate', 'projectAccountRate', 'arieRate', 'reservasEstimulacionRate',
      'beneficioReinvertirRate', 'canonRoyaltiesRate', 'otrosGastosVariablesPct',
      'otrasReservasVoluntariasRate', 'dividendoEstatalPct',
      'dividendoSocioCubanoPct', 'dividendoSocioExtranjeroPct',
      'bankFeeRate', 'vacationNormRate', 'salaryComplementRate',
      'residualValuePercent', // Also stored as decimal in V8.9 (0.1 = 10%)
    ];
    // Check if any rate is in decimal format (0 < value < 1)
    let needsDecimalConversion = isPreV10; // Pre-V10 files always need conversion
    if (!needsDecimalConversion) {
      for (const rk of RATE_KEYS) {
        const v = params[rk];
        if (typeof v === 'number' && v > 0 && v < 1) {
          needsDecimalConversion = true;
          break;
        }
      }
    }
    if (needsDecimalConversion) {
      for (const rk of RATE_KEYS) {
        const v = params[rk];
        if (typeof v === 'number' && v > 0 && v < 1) {
          params[rk] = Math.round(v * 10000) / 100; // Convert 0.15 → 15, 0.0909 → 9.09
        }
      }
      // Also convert residualPercent inside assetCategoryRates from decimal to integer
      if (Array.isArray(params.assetCategoryRates)) {
        for (const cat of params.assetCategoryRates) {
          if (cat && typeof cat.residualPercent === 'number' && cat.residualPercent > 0 && cat.residualPercent < 1) {
            cat.residualPercent = Math.round(cat.residualPercent * 100);
          }
        }
      }
    }

    result.parameters = params;
  }

  // --- Marco Lógico sheet ---
  const lfName = getSheet('Marco Lógico');
  if (lfName) {
    const ws = wb.Sheets[lfName];
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    const rows: any[] = [];
    // Track old id → new id mapping for hierarchy preservation
    const oldToNewIdMap: Record<string, string> = {};
    for (let i = 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r || (r.length <= 1 && !r[0])) continue;
      const newId = genId();
      const oldId = r[6] !== undefined && r[6] !== null ? String(r[6]) : ''; // _id_original from column 7 (allow "0")
      const oldParentId = r[5] !== undefined && r[5] !== null ? String(r[5]) : ''; // parentId from column 6
      rows.push({
        id: newId,
        level: String(r[0] || ''),
        narrative: String(r[1] || ''),
        indicators: String(r[2] || ''),
        verificationMeans: String(r[3] || ''),
        assumptions: String(r[4] || ''),
        parentId: oldParentId, // temporarily keep old parentId, will remap below
        _oldParentId: oldParentId, // temp field for remapping
      });
      // Map original id to new id for parentId resolution
      if (oldId) {
        oldToNewIdMap[oldId] = newId;
      }
    }
    // Rebuild parentId references using original id mapping
    for (const row of rows) {
      const oldPid = row._oldParentId;
      if (oldPid && oldToNewIdMap[oldPid]) {
        row.parentId = oldToNewIdMap[oldPid];
      } else if (oldPid) {
        // parentId references an id that doesn't exist — clear it
        row.parentId = '';
      } else {
        row.parentId = '';
      }
      delete row._oldParentId;
    }
    if (rows.length > 0) {
      result.logicalFramework = { rows };
    }
  }

  return result;
}

// ============================================================
// 3. Create a blank template workbook
// ============================================================
export function createTemplate(): WorkBook {
  const wb = XLSX.utils.book_new();

  // Metadatos (V10 — first sheet)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['BARAPRO V10 — Metadatos del Proyecto'],
      [],
      ['Versión del Formato', '10.0'],
      ['Versión de la Aplicación', '10.0'],
      ['Fecha de Exportación', new Date().toISOString()],
      ['Nombre del Proyecto', ''],
      ['Rebanas de Datos', 27],
    ]),
    SHEETS.metadatos
  );

  // Proyecto
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Campo', 'Valor']]),
    SHEETS.project
  );

  // Item sheets with generic headers
  const itemHeaders: Record<string, string[]> = {
    [SHEETS.construction]: ['Item', 'Cantidad', 'Unidad', 'Precio Unitario', 'Total'],
    [SHEETS.capital]: ['Equipo', 'Cantidad', 'Precio Unitario', 'Total', 'Vida Útil'],
    [SHEETS.subcontract]: ['Subcontratacion', 'Monto', 'Plazo'],
    [SHEETS.resources]: ['Cargo', 'Cantidad', 'Salario Mensual'],
    [SHEETS.purchases]: ['Insumo', 'Cantidad', 'Unidad', 'Precio Unitario', 'Origen (Nacional/Importada)'],
    [SHEETS.sales]: ['Producto/Servicio', 'Precio Unitario'],
    [SHEETS.otherIncome]: ['Concepto', 'Monto Mensual'],
    [SHEETS.commercial]: ['Concepto', 'Monto Mensual'],
    [SHEETS.admin]: ['Concepto', 'Monto Mensual'],
    [SHEETS.maintenance]: ['Concepto', 'Monto Mensual'],
    [SHEETS.indirect]: ['Concepto', 'Monto Mensual'],
    [SHEETS.loans]: ['Entidad', 'Monto', 'Plazo (meses)', 'Tasa Interes (%)'],
    [SHEETS.spareParts]: ['Pieza', 'Cantidad', 'Precio Unitario'],
    [SHEETS.otherResources]: ['Recurso', 'Cantidad', 'Precio Unitario'],
    [SHEETS.intangibles]: ['Intangible', 'Monto'],
    [SHEETS.directCosts]: ['Costo Directo', 'Monto'],
  };

  for (const [name, headers] of Object.entries(itemHeaders)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers]), name);
  }

  // Parámetros
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Parámetro', 'Valor']]),
    SHEETS.parameters
  );

  // Marco Lógico
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Nivel', 'Narrativa', 'Indicadores', 'Medios de Verificación', 'Supuestos', 'Padre ID', '_id_original'],
    ]),
    SHEETS.logicalFramework
  );

  // Indicadores
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Indicadores Financieros'],
      ['Perspectiva', 'Inversión', 'Capital Social'],
      ['VAN', '', ''],
      ['TIR (%)', '', ''],
      ['TIRM (%)', '', ''],
      ['PR (años)', '', ''],
      ['B/C', '', ''],
      ['VAE', '', ''],
      ['PRA (años)', '', ''],
      ['RVAN', '', ''],
      ['IR', '', ''],
      ['Punto de Equilibrio', '', ''],
      ['Margen de Seguridad (%)', '', ''],
    ]),
    SHEETS.indicators
  );

  // Depreciación
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Tabla de Depreciación y Amortización'],
      ['Mes', 'Depreciación', 'Amortización', 'Total'],
    ]),
    SHEETS.depreciation
  );

  // Balance General
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Balance General'],
      ['Concepto'],
    ]),
    SHEETS.balanceSheet
  );

  // Efecto Monetario
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Efecto Monetario'],
      ['Concepto'],
    ]),
    SHEETS.currencyEffect
  );

  // Subvenciones
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Concepto', 'Monto Mensual']]),
    SHEETS.subventions
  );

  // Devoluciones
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Concepto', 'Monto Mensual']]),
    SHEETS.salesReturns
  );

  // Servicios Públicos
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Concepto', 'Monto Mensual']]),
    SHEETS.publicServices
  );

  return wb;
}

// ============================================================
// 4. Download workbook to file
// ============================================================
export function downloadExcel(wb: WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
}

// ============================================================
// 5. Export Tabla C (Annual Loan Summary) to Excel
//    Formato según Resolución 1/2022 del Ministerio de Finanzas y Precios
// ============================================================
interface AnnualLoanSummaryRowForExport {
  year: number;
  annualInterestPaid: number;
  annualInterestCapitalized: number;
  annualGraceLumpSum: number;
  annualBankFees: number;
  annualPrincipalPaid: number;
  annualTotalPayment: number;
  endingBalance: number;
  annualDisbursements: number;
  // Phase 6: Multi-currency fields
  hasForeignCurrency?: boolean;
  annualInterestOriginal?: number;
  annualPrincipalOriginal?: number;
}

export function exportTablaCToExcel(
  rows: AnnualLoanSummaryRowForExport[],
  projectName: string,
  filename?: string
): WorkBook {
  const wb = XLSX.utils.book_new();

  // Header
  const header: (string | number)[][] = [
    [`Tabla C — Resumen Anual de Financiamiento`],
    [`Proyecto: ${projectName}`],
    [],
    [
      'Año',
      'Int. Pagados',
      'Int. Capitalizados',
      'Int. Gracia (pago único)',
      'Comisiones Bancarias',
      'Capital Amortizado',
      'Total Pagado',
      'Saldo Insoluto',
      'Desembolsos',
      'Moneda Extranjera',
      'Int. Originales (MLC)',
      'Capital Original (MLC)',
    ],
  ];

  // Check if any row has foreign currency data
  const hasForeign = rows.some(r => r.hasForeignCurrency);

  // Data rows
  for (const row of rows) {
    const dataRow: (string | number)[] = [
      row.year,
      Math.round(row.annualInterestPaid),
      Math.round(row.annualInterestCapitalized),
      Math.round(row.annualGraceLumpSum),
      Math.round(row.annualBankFees),
      Math.round(row.annualPrincipalPaid),
      Math.round(row.annualTotalPayment),
      Math.round(row.endingBalance),
      Math.round(row.annualDisbursements),
    ];
    if (hasForeign) {
      dataRow.push(row.hasForeignCurrency ? 'Sí' : 'No');
      dataRow.push(Math.round(row.annualInterestOriginal || 0));
      dataRow.push(Math.round(row.annualPrincipalOriginal || 0));
    }
    header.push(dataRow);
  }

  // Totals row
  const totals = rows.reduce(
    (acc, r) => ({
      intPaid: acc.intPaid + r.annualInterestPaid,
      intCap: acc.intCap + r.annualInterestCapitalized,
      grace: acc.grace + r.annualGraceLumpSum,
      fees: acc.fees + r.annualBankFees,
      principal: acc.principal + r.annualPrincipalPaid,
      total: acc.total + r.annualTotalPayment,
      disb: acc.disb + r.annualDisbursements,
    }),
    { intPaid: 0, intCap: 0, grace: 0, fees: 0, principal: 0, total: 0, disb: 0 }
  );
  const lastBalance = rows.length > 0 ? rows[rows.length - 1].endingBalance : 0;
  const totalsRow: (string | number)[] = [
    'TOTAL',
    Math.round(totals.intPaid),
    Math.round(totals.intCap),
    Math.round(totals.grace),
    Math.round(totals.fees),
    Math.round(totals.principal),
    Math.round(totals.total),
    Math.round(lastBalance),
    Math.round(totals.disb),
  ];
  if (hasForeign) {
    totalsRow.push('');
    totalsRow.push(Math.round(rows.reduce((s, r) => s + (r.annualInterestOriginal || 0), 0)));
    totalsRow.push(Math.round(rows.reduce((s, r) => s + (r.annualPrincipalOriginal || 0), 0)));
  }
  header.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(header);
  ws['!cols'] = [
    { wch: 6 },  // Año
    { wch: 16 }, // Int. Pagados
    { wch: 18 }, // Int. Capitalizados
    { wch: 22 }, // Int. Gracia
    { wch: 20 }, // Comisiones
    { wch: 18 }, // Capital
    { wch: 16 }, // Total
    { wch: 16 }, // Saldo
    { wch: 14 }, // Desembolsos
    { wch: 18 }, // Moneda Extranjera
    { wch: 20 }, // Int. Originales
    { wch: 22 }, // Capital Original
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Tabla C');

  if (filename) {
    downloadExcel(wb, filename);
  }

  return wb;
}

// ============================================================
// 6. Export Amortization Schedule to Excel
//    Full schedule with dates per loan
// ============================================================
interface AmortizationRowForExport {
  period: number;
  beginningBalance: number;
  disbursementAmount: number;
  payment: number;
  principal: number;
  interest: number;
  capitalizedInterest: number;
  bankFee: number;
  endingBalance: number;
  isGrace: boolean;
}

export function exportAmortizationToExcel(
  loanName: string,
  schedule: AmortizationRowForExport[],
  startDate: string,
  filename?: string
): WorkBook {
  const wb = XLSX.utils.book_new();

  const [startYear, startMonth] = startDate.split('-').map(Number);
  const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const rows: (string | number)[][] = [
    [`Cronograma de Amortización — ${loanName}`],
    [`Fecha de inicio: ${MONTH_NAMES[(startMonth || 1) - 1]} ${startYear || 2025}`],
    [],
    [
      'Período',
      'Fecha',
      'Saldo Inicial',
      'Desembolso',
      'Cuota',
      'Capital',
      'Interés',
      'Int. Capitalizado',
      'Comisiones',
      'Saldo Final',
      'Gracia',
    ],
  ];

  for (const r of schedule) {
    const monthIndex = ((startMonth || 1) - 1 + r.period - 1) % 12;
    const year = (startYear || 2025) + Math.floor(((startMonth || 1) - 1 + r.period - 1) / 12);
    const dateStr = `${MONTH_NAMES[monthIndex]} ${year}`;

    rows.push([
      r.period,
      dateStr,
      Math.round(r.beginningBalance),
      Math.round(r.disbursementAmount),
      Math.round(r.payment),
      Math.round(r.principal),
      Math.round(r.interest),
      Math.round(r.capitalizedInterest),
      Math.round(r.bankFee),
      Math.round(r.endingBalance),
      r.isGrace ? 'Sí' : 'No',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },  // Período
    { wch: 12 }, // Fecha
    { wch: 16 }, // Saldo Inicial
    { wch: 14 }, // Desembolso
    { wch: 14 }, // Cuota
    { wch: 14 }, // Capital
    { wch: 14 }, // Interés
    { wch: 16 }, // Int. Capitalizado
    { wch: 12 }, // Comisiones
    { wch: 14 }, // Saldo Final
    { wch: 8 },  // Gracia
  ];

  XLSX.utils.book_append_sheet(wb, ws, loanName.substring(0, 31));

  if (filename) {
    downloadExcel(wb, filename);
  }

  return wb;
}

// ============================================================
// 7. Export Tabla m) — Variaciones del Capital de Trabajo
//    Formato según Resolución 1/2022 MINCEX-MEP
// ============================================================

interface WCExportParams {
  workingDaysPerYear: number;
  wcCashCoverageDays?: number;
  wcReceivableCoverageDays?: number;
  wcInventoryCoverageDays?: number;
  wcPayableDays?: number;
  wcWipCoverageDays?: number;
  wcFinishedGoodsCoverageDays?: number;
  wcSparePartsCoverageDays?: number;
  wcMercanciasVentaCoverageDays?: number;
}

export function exportWorkingCapitalToExcel(
  wcData: { month: number; year: number; [key: string]: number }[],
  params: WCExportParams,
  filename?: string
): WorkBook {
  const wb = XLSX.utils.book_new();

  // Group by year
  const years = [...new Set(wcData.map(r => r.year))];

  // Header row
  const header: (string | number)[][] = [
    ['Tabla m) — Variaciones del Capital de Trabajo'],
    [`Base de cálculo: ${params.workingDaysPerYear} días/año`],
    [],
    ['No.', 'Concepto', 'Días de Cobertura', ...years.map(y => `Año ${y}`), 'Total'],
  ];

  const concepts = [
    { key: 'efectivo', label: 'Efectivo en Caja', days: params.wcCashCoverageDays ?? 30 },
    { key: 'cuentasPorCobrar', label: 'Cuentas por Cobrar a Clientes', days: params.wcReceivableCoverageDays ?? 30 },
    { key: 'inventarios', label: 'Inventario de Materias Primas', days: params.wcInventoryCoverageDays ?? 45 },
    { key: 'inventariosNacionales', label: '    Inventarios Nacionales (70%)', days: '' },
    { key: 'inventariosImportados', label: '    Inventarios Importados (30%)', days: '' },
    { key: 'productosEnProceso', label: 'Productos en Proceso', days: params.wcWipCoverageDays ?? 15 },
    { key: 'produccionTerminada', label: 'Producción Terminada', days: params.wcFinishedGoodsCoverageDays ?? 30 },
    { key: 'piezasRepuesto', label: 'Piezas de Repuesto y Herramientas', days: params.wcSparePartsCoverageDays ?? 30 },
    { key: 'mercanciasVenta', label: 'Inventario de Mercancías para la Venta', days: params.wcMercanciasVentaCoverageDays ?? 30 },
    { key: 'otrosActivosCorrientes', label: 'Otros Activos Corrientes', days: '' },
    { key: 'totalActivosCorrientes', label: 'TOTAL ACTIVOS CORRIENTES (1)', days: '' },
    { key: 'cuentaPorPagar', label: 'Cuentas por Pagar a Proveedores', days: params.wcPayableDays ?? 30 },
    { key: 'anticipos', label: 'Anticipos Recibidos', days: '' },
    { key: 'otrosPasivosCorrientes', label: 'Otros Pasivos Corrientes', days: '' },
    { key: 'totalPasivosCorrientes', label: 'TOTAL PASIVOS CORRIENTES (2)', days: '' },
    { key: 'capitalTrabajoBruto', label: 'CAPITAL DE TRABAJO BRUTO (=1)', days: '' },
    { key: 'capitalTrabajoNeto', label: 'CAPITAL DE TRABAJO NETO (1-2)', days: '' },
    { key: 'variacion', label: 'Variación del Capital de Trabajo', days: '' },
  ];

  concepts.forEach((concept, idx) => {
    const row: (string | number)[] = [idx + 1, concept.label, typeof concept.days === 'number' ? `${concept.days}` : ''];
    let total = 0;
    for (const year of years) {
      const yearMonths = wcData.filter(r => r.year === year);
      const monthCount = yearMonths.length || 12;
      const val = (yearMonths[0]?.[concept.key as keyof typeof yearMonths[0]] as number || 0) * monthCount;
      row.push(Math.round(val * 100) / 100);
      total += val;
    }
    row.push(Math.round(total * 100) / 100);
    header.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(header);
  ws['!cols'] = [
    { wch: 6 },   // No.
    { wch: 42 },  // Concepto
    { wch: 18 },  // Días de Cobertura
    ...years.map(() => ({ wch: 16 })), // Año columns
    { wch: 16 },  // Total
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Tabla m) CT');

  if (filename) downloadExcel(wb, filename);
  return wb;
}
