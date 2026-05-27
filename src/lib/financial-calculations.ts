// Utilidades de cálculo financiero para estudios de factibilidad económica
// Metodología BARAPRO - Estudios de factibilidad para proyectos de desarrollo local

// ─── Tipos de datos ─────────────────────────────────────────────────────────

export interface PeriodicData {
  period: number;
  netCashFlow: number;
  discountedCashFlow: number;
  cumulativeNPV: number;
  inflow?: number;
  outflow?: number;
}

export interface SensitivityVariation {
  change: number;
  newNPV: number;
  newIRR: number | null;
}

export interface SensitivityResult {
  variable: string;
  baseValue: number;
  variations: SensitivityVariation[];
}

export interface ScenarioIndicators {
  npv: number;
  irr: number | null;
  benefitCostRatio: number;
  paybackPeriod: number | null;
  roi: number;
}

export interface ScenarioResult {
  optimistic: ScenarioIndicators;
  expected: ScenarioIndicators;
  pessimistic: ScenarioIndicators;
  expectedVAN: number;
  standardDeviation: number;
}

export interface BreakEvenResult {
  units: number;
  value: number;
  marginOfSafety: number;
  marginOfSafetyPercent: number;
}

export interface IncomeStatementRow {
  year: number;
  netSales: number;
  variableCosts: number;
  fixedCosts: number;
  depreciation: number;
  financialExpenses: number;
  profitBeforeTax: number;
  contingencyReserve: number;
  taxableIncome: number;
  incomeTax: number;
  profitAfterTax: number;
  availableProfit: number;
  retainedEarnings: number;
}

export interface DepreciationRow {
  year: number;
  totalDepreciation: number;
  items: { name: string; depreciation: number; remainingValue: number }[];
}

export interface FinancialCostsRow {
  year: number;
  principalPayment: number;
  interest: number;
  bankFees: number;
  totalCosts: number;
  remainingBalance: number;
}

export interface WorkingCapitalRow {
  year: number;
  cash: number;
  accountsReceivable: number;
  inventories: number;
  totalCurrentAssets: number;
  totalCurrentLiabilities: number;
  netWorkingCapital: number;
  variation: number;
}

export interface BalanceSheetRow {
  year: number;
  totalAssets: number;
  currentAssets: number;
  fixedAssets: number;
  totalLiabilities: number;
  currentLiabilities: number;
  longTermDebt: number;
  equity: number;
  debtToEquity: number;
  liquidity: number;
}

export interface CashFlowDLRow {
  year: number;
  inflowCapital: number;
  inflowFinancing: number;
  inflowSales: number;
  inflowOther: number;
  totalInflows: number;
  outflowInvestment: number;
  outflowWorkingCapital: number;
  outflowOperations: number;
  outflowFinancialCosts: number;
  outflowTaxes: number;
  outflowPrincipal: number;
  totalOutflows: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

export interface CalculationResult {
  npv: number;
  irr: number | null;
  roi: number;
  paybackPeriod: number | null;
  benefitCostRatio: number;
  rvan: number;
  tirm: number | null;
  prd: number | null;
  breakEven: BreakEvenResult;
  periodicData: PeriodicData[];
  sensitivity: SensitivityResult[];
  scenarios: ScenarioResult;
  conclusion: string;
  recommendations: string;
  incomeStatement: IncomeStatementRow[];
  depreciationSchedule: DepreciationRow[];
  financialCosts: FinancialCostsRow[];
  workingCapital: WorkingCapitalRow[];
  balanceSheet: BalanceSheetRow[];
  cashFlowDL: CashFlowDLRow[];
}

// ─── Interfaces para parámetros de funciones auxiliares ─────────────────────

interface InvestmentItemParam {
  itemName: string;
  quantity: number;
  unitPrice: number;
  usefulLife?: number | null;
}

interface FinancingSourceParam {
  sourceName: string;
  amount: number;
  interestRate?: number | null;
  term?: number | null;
  gracePeriod?: number | null;
}

interface WorkingCapitalParams {
  duration: number;
  cashCoverageDays: number;
  receivableCoverageDays: number;
  materialsCoverageDays: number;
  annualCosts: number;
  annualRevenue: number;
  variableCosts: number;
  materiasPrimas?: number;
  depreciationPerYear: number[];
}

// ─── Funciones base de cálculo financiero ───────────────────────────────────

/**
 * Calcula el Valor Presente Neto (VPN)
 * Suma de flujos de caja descontados menos la inversión inicial
 */
export function calculateNPV(
  rate: number,
  cashFlows: number[],
  initialInvestment: number
): number {
  let npv = -initialInvestment;
  for (let i = 0; i < cashFlows.length; i++) {
    npv += cashFlows[i] / Math.pow(1 + rate, i + 1);
  }
  return npv;
}

/**
 * Calcula el VPN con tasas de descuento diferenciadas por año
 */
export function calculateNPVWithVariableRates(
  ratesPerYear: number[],
  cashFlows: number[],
  initialInvestment: number
): number {
  let npv = -initialInvestment;
  let discountFactor = 1;
  for (let i = 0; i < cashFlows.length; i++) {
    const rate = i < ratesPerYear.length ? ratesPerYear[i] / 100 : ratesPerYear[ratesPerYear.length - 1] / 100;
    discountFactor *= (1 + rate);
    npv += cashFlows[i] / discountFactor;
  }
  return npv;
}

/**
 * Calcula la Tasa Interna de Retorno (TIR)
 * Utiliza el método de bisección para encontrar la tasa donde VPN = 0
 */
export function calculateIRR(
  cashFlows: number[],
  initialInvestment: number
): number | null {
  const allFlows = [-initialInvestment, ...cashFlows];

  const hasPositive = allFlows.some((f) => f > 0);
  const hasNegative = allFlows.some((f) => f < 0);

  if (!hasPositive || !hasNegative) {
    return null;
  }

  let low = -0.5;
  let high = 10.0;
  const maxIterations = 1000;
  const tolerance = 1e-8;

  let npvLow = calculateNPVFromFlows(low, allFlows);
  let npvHigh = calculateNPVFromFlows(high, allFlows);

  if (npvLow * npvHigh > 0) {
    low = -0.9;
    high = 100.0;
    npvLow = calculateNPVFromFlows(low, allFlows);
    npvHigh = calculateNPVFromFlows(high, allFlows);
    if (npvLow * npvHigh > 0) {
      return null;
    }
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = calculateNPVFromFlows(mid, allFlows);

    if (Math.abs(npvMid) < tolerance) {
      return mid;
    }

    if (npvMid * calculateNPVFromFlows(low, allFlows) < 0) {
      high = mid;
    } else {
      low = mid;
    }

    if (Math.abs(high - low) < tolerance) {
      return (low + high) / 2;
    }
  }

  return (low + high) / 2;
}

/**
 * Función auxiliar para calcular VPN desde un arreglo de flujos
 */
function calculateNPVFromFlows(rate: number, flows: number[]): number {
  let npv = 0;
  for (let i = 0; i < flows.length; i++) {
    npv += flows[i] / Math.pow(1 + rate, i);
  }
  return npv;
}

/**
 * Calcula el Retorno sobre Inversión (ROI)
 */
export function calculateROI(totalBenefits: number, totalCosts: number): number {
  if (totalCosts === 0) return 0;
  return ((totalBenefits - totalCosts) / totalCosts) * 100;
}

/**
 * Calcula el Período de Recuperación (Payback Period)
 */
export function calculatePaybackPeriod(
  cashFlows: number[],
  initialInvestment: number
): number | null {
  let cumulative = -initialInvestment;

  for (let i = 0; i < cashFlows.length; i++) {
    cumulative += cashFlows[i];
    if (cumulative >= 0) {
      const prevCumulative = cumulative - cashFlows[i];
      const fraction =
        cashFlows[i] !== 0 ? -prevCumulative / cashFlows[i] : 0;
      return i + fraction;
    }
  }

  return null;
}

/**
 * Calcula la Relación Beneficio/Costo (B/C)
 */
export function calculateBenefitCostRatio(
  rate: number,
  inflows: number[],
  outflows: number[],
  initialInvestment: number
): number {
  let pvBenefits = 0;
  let pvCosts = initialInvestment;

  for (let i = 0; i < inflows.length; i++) {
    pvBenefits += inflows[i] / Math.pow(1 + rate, i + 1);
  }

  for (let i = 0; i < outflows.length; i++) {
    pvCosts += outflows[i] / Math.pow(1 + rate, i + 1);
  }

  if (pvCosts === 0) return 0;
  return pvBenefits / pvCosts;
}

/**
 * Calcula el RVAN (Rentabilidad del Valor Actual Neto / NPV Profitability Index)
 * RVAN = VAN / VAI (Valor Actualizado de la Inversión)
 */
export function calculateRVAN(
  npv: number,
  initialInvestment: number,
  rate: number,
  cashFlows: number[]
): number {
  // VAI: suma de los flujos de inversión descontados (flujos negativos)
  let vai = initialInvestment; // inversión inicial en período 0

  for (let i = 0; i < cashFlows.length; i++) {
    if (cashFlows[i] < 0) {
      vai += Math.abs(cashFlows[i]) / Math.pow(1 + rate, i + 1);
    }
  }

  if (vai === 0) return 0;
  return npv / vai;
}

/**
 * Calcula la TIRM (Tasa Interna de Retorno Modificada / MIRR)
 */
export function calculateTIRM(
  cashFlows: number[],
  initialInvestment: number,
  financeRate: number,
  reinvestRate: number
): number | null {
  const allFlows = [-initialInvestment, ...cashFlows];
  const n = allFlows.length;

  // VP de todos los flujos negativos a la tasa de financiamiento
  let pvNegative = 0;
  for (let i = 0; i < allFlows.length; i++) {
    if (allFlows[i] < 0) {
      pvNegative += Math.abs(allFlows[i]) / Math.pow(1 + financeRate, i);
    }
  }

  // VF de todos los flujos positivos a la tasa de reinversión
  let fvPositive = 0;
  for (let i = 0; i < allFlows.length; i++) {
    if (allFlows[i] > 0) {
      fvPositive += allFlows[i] * Math.pow(1 + reinvestRate, n - 1 - i);
    }
  }

  if (pvNegative === 0) return null;

  // TIRM = (VF / VP)^(1/n) - 1
  const tirm = Math.pow(fvPositive / pvNegative, 1 / n) - 1;
  return tirm;
}

/**
 * Calcula el PRD (Período de Recuperación Descontado / Discounted Payback Period)
 */
export function calculateDiscountedPayback(
  cashFlows: number[],
  initialInvestment: number,
  rate: number
): number | null {
  let cumulative = -initialInvestment;

  for (let i = 0; i < cashFlows.length; i++) {
    const discountedFlow = cashFlows[i] / Math.pow(1 + rate, i + 1);
    cumulative += discountedFlow;

    if (cumulative >= 0) {
      const prevCumulative = cumulative - discountedFlow;
      const fraction =
        discountedFlow !== 0 ? -prevCumulative / discountedFlow : 0;
      return i + fraction;
    }
  }

  return null;
}

/**
 * Calcula el Punto de Equilibrio (Break-even Point)
 * Usa costos fijos y variables por separado
 */
export function calculateBreakEven(
  fixedCosts: number,
  variableCosts: number,
  revenue: number,
  pricePerUnit?: number,
  variableCostPerUnit?: number
): BreakEvenResult {
  // Cálculo por unidades si se proporcionan precios unitarios
  const units = pricePerUnit && pricePerUnit > 0
    ? pricePerUnit - (variableCostPerUnit || 0) > 0
      ? fixedCosts / (pricePerUnit - (variableCostPerUnit || 0))
      : Infinity
    : revenue > variableCosts
      ? fixedCosts / ((revenue - variableCosts) / revenue)
      : Infinity;

  const variableCostRatio = revenue > 0 ? variableCosts / revenue : 0;
  const bepValue = (1 - variableCostRatio) > 0
    ? fixedCosts / (1 - variableCostRatio)
    : Infinity;

  const marginOfSafety = revenue > bepValue ? revenue - bepValue : 0;
  const marginOfSafetyPercent = revenue > 0 ? (marginOfSafety / revenue) * 100 : 0;

  return {
    units: isFinite(units) ? Math.round(units * 100) / 100 : 0,
    value: isFinite(bepValue) ? Math.round(bepValue * 100) / 100 : 0,
    marginOfSafety: Math.round(marginOfSafety * 100) / 100,
    marginOfSafetyPercent: Math.round(marginOfSafetyPercent * 100) / 100,
  };
}

/**
 * Genera flujos de caja periódicos a partir de estimaciones anuales
 */
export function generateCashFlows(
  initialInvestment: number,
  annualRevenue: number,
  annualCosts: number,
  duration: number
): number[] {
  const netAnnual = annualRevenue - annualCosts;
  const cashFlows: number[] = [];

  for (let i = 0; i < duration; i++) {
    cashFlows.push(netAnnual);
  }

  return cashFlows;
}

// ─── Nuevas funciones de cálculo BARAPRO ────────────────────────────────────

/**
 * Calcula la depreciación anual de los items de inversión
 * Items con vida útil: depreciación lineal anual = (cantidad * precioUnitario) / vidaÚtil
 * Items sin vida útil: se expensan completamente en el año 1
 */
export function calculateDepreciation(
  investmentItems: InvestmentItemParam[],
  duration: number
): DepreciationRow[] {
  const schedule: DepreciationRow[] = [];

  // Identificar items depreciables y no depreciables
  const depreciableItems = investmentItems.filter(item => item.usefulLife && item.usefulLife > 0);
  const nonDepreciableItems = investmentItems.filter(item => !item.usefulLife || item.usefulLife <= 0);

  for (let year = 1; year <= duration; year++) {
    let totalDepreciation = 0;
    const itemsDetail: { name: string; depreciation: number; remainingValue: number }[] = [];

    // Items no depreciables: solo en año 1
    if (year === 1) {
      for (const item of nonDepreciableItems) {
        const totalValue = item.quantity * item.unitPrice;
        itemsDetail.push({
          name: item.itemName,
          depreciation: totalValue,
          remainingValue: 0,
        });
        totalDepreciation += totalValue;
      }
    } else {
      for (const item of nonDepreciableItems) {
        itemsDetail.push({
          name: item.itemName,
          depreciation: 0,
          remainingValue: 0,
        });
      }
    }

    // Items depreciables
    for (const item of depreciableItems) {
      const totalValue = item.quantity * item.unitPrice;
      const usefulLife = item.usefulLife!;
      const annualDep = totalValue / usefulLife;

      if (year <= usefulLife) {
        itemsDetail.push({
          name: item.itemName,
          depreciation: annualDep,
          remainingValue: totalValue - (annualDep * year),
        });
        totalDepreciation += annualDep;
      } else {
        itemsDetail.push({
          name: item.itemName,
          depreciation: 0,
          remainingValue: 0,
        });
      }
    }

    schedule.push({
      year,
      totalDepreciation: Math.round(totalDepreciation * 100) / 100,
      items: itemsDetail,
    });
  }

  return schedule;
}

/**
 * Calcula los costos financieros por fuentes de financiamiento
 * Para cada fuente con tasa de interés y plazo:
 * - Cuota anual de capital (considerando período de gracia)
 * - Interés anual = saldo restante * tasaInterés/100
 * - Comisión bancaria = 3.5% del interés (según BARAPRO)
 */
export function calculateFinancialCosts(
  financingSources: FinancingSourceParam[],
  duration: number
): FinancialCostsRow[] {
  const schedule: FinancialCostsRow[] = [];

  // Filtrar fuentes con préstamo (tasa de interés definida)
  const loans = financingSources.filter(
    fs => fs.interestRate != null && fs.interestRate > 0 && fs.term != null && fs.term > 0
  );

  if (loans.length === 0) {
    // Sin préstamos, todos los años con costos financieros cero
    for (let year = 1; year <= duration; year++) {
      schedule.push({
        year,
        principalPayment: 0,
        interest: 0,
        bankFees: 0,
        totalCosts: 0,
        remainingBalance: 0,
      });
    }
    return schedule;
  }

  // Para cada préstamo, calcular desglose anual
  const loanDetails = loans.map(loan => {
    const amount = loan.amount;
    const annualRate = loan.interestRate! / 100;
    const termMonths = loan.term!;
    const graceMonths = loan.gracePeriod || 0;
    const termYears = termMonths / 12;
    const graceYears = graceMonths / 12;

    // Cuota anual de capital
    const annualPrincipal = amount / termYears;

    // Desglose por año
    const yearlyData: {
      principal: number;
      interest: number;
      bankFees: number;
      balance: number;
    }[] = [];

    let balance = amount;

    for (let year = 1; year <= duration; year++) {
      const interest = balance * annualRate;
      const bankFees = interest * 0.035; // 3.5% del interés según BARAPRO

      let principal = 0;
      if (year > graceYears && year <= graceYears + termYears) {
        principal = annualPrincipal;
      } else if (year <= graceYears && graceYears < termYears) {
        // Durante período de gracia no se paga capital
        principal = 0;
      }

      const totalPayment = principal + interest + bankFees;
      balance = Math.max(0, balance - principal);

      yearlyData.push({
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        bankFees: Math.round(bankFees * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      });
    }

    return { sourceName: loan.sourceName, yearlyData };
  });

  // Consolidar todos los préstamos por año
  for (let year = 1; year <= duration; year++) {
    let principalPayment = 0;
    let interest = 0;
    let bankFees = 0;
    let remainingBalance = 0;

    for (const loan of loanDetails) {
      const yd = loan.yearlyData[year - 1];
      if (yd) {
        principalPayment += yd.principal;
        interest += yd.interest;
        bankFees += yd.bankFees;
        remainingBalance += yd.balance;
      }
    }

    schedule.push({
      year,
      principalPayment: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      bankFees: Math.round(bankFees * 100) / 100,
      totalCosts: Math.round((principalPayment + interest + bankFees) * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
    });
  }

  return schedule;
}

/**
 * Calcula el Estado de Resultados completo por año
 */
export function calculateIncomeStatement(params: {
  duration: number;
  revenue: number;
  variableCosts: number;
  fixedCosts: number;
  taxRateSales: number;
  taxRateIncome: number;
  generalExpensesCoefficient: number;
  depreciationSchedule: DepreciationRow[];
  financialCosts: FinancialCostsRow[];
  contingencyReserveRate: number;
  retainedEarningsRate: number;
}): IncomeStatementRow[] {
  const {
    duration,
    revenue,
    variableCosts,
    fixedCosts,
    taxRateSales,
    taxRateIncome,
    generalExpensesCoefficient,
    depreciationSchedule,
    financialCosts,
    contingencyReserveRate,
    retainedEarningsRate,
  } = params;

  const statements: IncomeStatementRow[] = [];

  for (let year = 1; year <= duration; year++) {
    // Ventas netas = ingresos * (1 - tasaImpuestoVentas/100)
    const netSales = revenue * (1 - taxRateSales / 100);

    // Costos variables
    const vc = variableCosts;

    // Costos fijos (comerciales + administración + mantenimiento)
    const fc = fixedCosts;

    // Depreciación del año
    const depreciation = depreciationSchedule[year - 1]?.totalDepreciation || 0;

    // Gastos financieros (interés + comisiones bancarias)
    const finCosts = financialCosts[year - 1]
      ? financialCosts[year - 1].interest + financialCosts[year - 1].bankFees
      : 0;

    // Utilidad antes de impuestos
    const profitBeforeTax = netSales - vc - fc - depreciation - finCosts;

    // Reserva de contingencia (solo si hay ganancia)
    const contingencyReserve = profitBeforeTax > 0
      ? profitBeforeTax * (contingencyReserveRate / 100)
      : 0;

    // Utilidad imponible
    const taxableIncome = profitBeforeTax - contingencyReserve;

    // Impuesto sobre utilidades (solo si hay ganancia imponible)
    const incomeTax = taxableIncome > 0
      ? taxableIncome * (taxRateIncome / 100)
      : 0;

    // Utilidad después de impuestos
    const profitAfterTax = taxableIncome - incomeTax;

    // Utilidad disponible (después de impuestos - otras reservas)
    const availableProfit = profitAfterTax;

    // Utilidades retenidas
    const retainedEarnings = availableProfit > 0
      ? availableProfit * (retainedEarningsRate / 100)
      : 0;

    statements.push({
      year,
      netSales: Math.round(netSales * 100) / 100,
      variableCosts: Math.round(vc * 100) / 100,
      fixedCosts: Math.round(fc * 100) / 100,
      depreciation: Math.round(depreciation * 100) / 100,
      financialExpenses: Math.round(finCosts * 100) / 100,
      profitBeforeTax: Math.round(profitBeforeTax * 100) / 100,
      contingencyReserve: Math.round(contingencyReserve * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      incomeTax: Math.round(incomeTax * 100) / 100,
      profitAfterTax: Math.round(profitAfterTax * 100) / 100,
      availableProfit: Math.round(availableProfit * 100) / 100,
      retainedEarnings: Math.round(retainedEarnings * 100) / 100,
    });
  }

  return statements;
}

/**
 * @deprecated Use buildWorkingCapital() from barapro-financial.ts instead.
 * This function is kept for backward compatibility but uses the correct 360-day base
 * (was incorrectly using 365) and delegates to the primary calculation engine.
 *
 * FIX (Fisura #4): Changed denominator from 365 to 360 per Resolución 1/2022 MINCEX-MEP.
 */
export function calculateWorkingCapital(params: WorkingCapitalParams): WorkingCapitalRow[] {
  // Convert legacy params to use 360-day base (was incorrectly using 365)
  const workingCapitalRows: WorkingCapitalRow[] = [];
  let previousNetWC = 0;

  for (let year = 1; year <= params.duration; year++) {
    const costsNoDep = params.annualCosts - (params.depreciationPerYear[year - 1] || 0);
    const cash = Math.max(0, costsNoDep / 360 * params.cashCoverageDays);
    const accountsReceivable = params.annualRevenue / 360 * params.receivableCoverageDays;
    // FIX (Fisura #2): Inventarios base = materiasPrimas only, NOT total variableCosts
    const inventories = (params.materiasPrimas ?? params.variableCosts) / 360 * params.materialsCoverageDays;
    const totalCurrentAssets = cash + accountsReceivable + inventories;
    const totalCurrentLiabilities = params.variableCosts / 360 * 30;
    const netWorkingCapital = totalCurrentAssets - totalCurrentLiabilities;
    const variation = netWorkingCapital - previousNetWC;
    previousNetWC = netWorkingCapital;

    workingCapitalRows.push({
      year,
      cash: Math.round(cash * 100) / 100,
      accountsReceivable: Math.round(accountsReceivable * 100) / 100,
      inventories: Math.round(inventories * 100) / 100,
      totalCurrentAssets: Math.round(totalCurrentAssets * 100) / 100,
      totalCurrentLiabilities: Math.round(totalCurrentLiabilities * 100) / 100,
      netWorkingCapital: Math.round(netWorkingCapital * 100) / 100,
      variation: Math.round(variation * 100) / 100,
    });
  }

  return workingCapitalRows;
}

/**
 * Calcula el Balance General por año
 */
export function calculateBalanceSheet(params: {
  duration: number;
  initialInvestment: number;
  depreciationSchedule: DepreciationRow[];
  financialCosts: FinancialCostsRow[];
  incomeStatement: IncomeStatementRow[];
  workingCapital: WorkingCapitalRow[];
  totalLoans: number;
}): BalanceSheetRow[] {
  const {
    duration,
    initialInvestment,
    depreciationSchedule,
    financialCosts,
    incomeStatement,
    workingCapital,
    totalLoans,
  } = params;

  const balanceSheetRows: BalanceSheetRow[] = [];
  let accumulatedRetainedEarnings = 0;

  // Valor total de los activos fijos al inicio (inversión inicial)
  const totalFixedAssetsInitial = initialInvestment;

  // Depreciación acumulada por año
  let accumulatedDepreciation = 0;

  for (let year = 1; year <= duration; year++) {
    const depYear = depreciationSchedule[year - 1];
    const finYear = financialCosts[year - 1];
    const incYear = incomeStatement[year - 1];
    const wcYear = workingCapital[year - 1];

    // Depreciación acumulada
    accumulatedDepreciation += depYear?.totalDepreciation || 0;

    // Activos fijos tangibles (valor remanente)
    const fixedAssets = Math.max(0, totalFixedAssetsInitial - accumulatedDepreciation);

    // Activos corrientes
    const currentAssets = wcYear?.totalCurrentAssets || 0;

    // Total activos
    const totalAssets = currentAssets + fixedAssets;

    // Pasivos corrientes
    const currentLiabilities = wcYear?.totalCurrentLiabilities || 0;

    // Deuda largo plazo (saldo de préstamos)
    const longTermDebt = finYear?.remainingBalance || 0;

    // Total pasivos
    const totalLiabilities = currentLiabilities + longTermDebt;

    // Utilidades retenidas acumuladas
    accumulatedRetainedEarnings += incYear?.retainedEarnings || 0;

    // Utilidades del ejercicio (después de impuestos - reservas)
    const currentProfit = (incYear?.availableProfit || 0) - (incYear?.retainedEarnings || 0);

    // Capital = Capital social + Reservas + Utilidades retenidas + Utilidades del ejercicio
    // El capital social se asume como inversión - préstamos
    const capitalSocial = Math.max(0, initialInvestment - totalLoans);
    const contingencyReserve = incYear?.contingencyReserve || 0;
    const equity = capitalSocial + contingencyReserve + accumulatedRetainedEarnings + currentProfit;

    // Razones financieras
    const debtToEquity = equity > 0 ? totalLiabilities / equity : 0;
    const liquidity = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

    balanceSheetRows.push({
      year,
      totalAssets: Math.round(totalAssets * 100) / 100,
      currentAssets: Math.round(currentAssets * 100) / 100,
      fixedAssets: Math.round(fixedAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      currentLiabilities: Math.round(currentLiabilities * 100) / 100,
      longTermDebt: Math.round(longTermDebt * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      debtToEquity: Math.round(debtToEquity * 100) / 100,
      liquidity: Math.round(liquidity * 100) / 100,
    });
  }

  return balanceSheetRows;
}

/**
 * Calcula el Flujo de Caja completo para Desarrollo Local (DL)
 */
export function calculateCashFlowDL(params: {
  duration: number;
  initialInvestment: number;
  totalLoans: number;
  incomeStatement: IncomeStatementRow[];
  financialCosts: FinancialCostsRow[];
  workingCapital: WorkingCapitalRow[];
}): CashFlowDLRow[] {
  const {
    duration,
    initialInvestment,
    totalLoans,
    incomeStatement,
    financialCosts,
    workingCapital,
  } = params;

  const cashFlowRows: CashFlowDLRow[] = [];
  let cumulativeCashFlow = 0;

  // Capital social = inversión - préstamos
  const capitalSocial = Math.max(0, initialInvestment - totalLoans);

  // Determinar año de recepción de financiamiento (año 0 implícito)
  for (let year = 0; year <= duration; year++) {
    let inflowCapital = 0;
    let inflowFinancing = 0;
    let inflowSales = 0;
    let inflowOther = 0;
    let outflowInvestment = 0;
    let outflowWorkingCapital = 0;
    let outflowOperations = 0;
    let outflowFinancialCosts = 0;
    let outflowTaxes = 0;
    let outflowPrincipal = 0;

    if (year === 0) {
      // Año cero: inversión inicial
      inflowCapital = capitalSocial;
      inflowFinancing = totalLoans;
      outflowInvestment = -initialInvestment;
    } else {
      const incYear = incomeStatement[year - 1];
      const finYear = financialCosts[year - 1];
      const wcYear = workingCapital[year - 1];

      // Ingresos por ventas netas
      inflowSales = incYear?.netSales || 0;

      // Variación de capital de trabajo
      outflowWorkingCapital = wcYear?.variation || 0;

      // Costos de operación (variables + fijos)
      outflowOperations = (incYear?.variableCosts || 0) + (incYear?.fixedCosts || 0);

      // Gastos financieros (intereses + comisiones)
      outflowFinancialCosts = finYear
        ? finYear.interest + finYear.bankFees
        : 0;

      // Impuestos sobre utilidades
      outflowTaxes = incYear?.incomeTax || 0;

      // Reembolso de principal
      outflowPrincipal = finYear?.principalPayment || 0;
    }

    const totalInflows = inflowCapital + inflowFinancing + inflowSales + inflowOther;
    const totalOutflows = Math.abs(outflowInvestment) + outflowWorkingCapital + outflowOperations + outflowFinancialCosts + outflowTaxes + outflowPrincipal;
    const netCashFlow = totalInflows - totalOutflows;

    cumulativeCashFlow += netCashFlow;

    cashFlowRows.push({
      year,
      inflowCapital: Math.round(inflowCapital * 100) / 100,
      inflowFinancing: Math.round(inflowFinancing * 100) / 100,
      inflowSales: Math.round(inflowSales * 100) / 100,
      inflowOther: Math.round(inflowOther * 100) / 100,
      totalInflows: Math.round(totalInflows * 100) / 100,
      outflowInvestment: Math.round(Math.abs(outflowInvestment) * 100) / 100,
      outflowWorkingCapital: Math.round(outflowWorkingCapital * 100) / 100,
      outflowOperations: Math.round(outflowOperations * 100) / 100,
      outflowFinancialCosts: Math.round(outflowFinancialCosts * 100) / 100,
      outflowTaxes: Math.round(outflowTaxes * 100) / 100,
      outflowPrincipal: Math.round(outflowPrincipal * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      cumulativeCashFlow: Math.round(cumulativeCashFlow * 100) / 100,
    });
  }

  return cashFlowRows;
}

// ─── Análisis de Sensibilidad (corregido) ───────────────────────────────────

/**
 * Análisis de Sensibilidad
 * Analiza cómo cambia el VPN al variar parámetros individuales
 * CORREGIDO: La tasa de descuento se aplica correctamente en el análisis
 */
export function sensitivityAnalysis(params: {
  initialInvestment: number;
  annualRevenue: number;
  annualCosts: number;
  discountRate: number;
  projectDuration: number;
  cashFlows: number[];
  fixedCosts?: number;
  variableCosts?: number;
  financingSources?: FinancingSourceParam[];
}): SensitivityResult[] {
  const {
    initialInvestment,
    annualRevenue,
    annualCosts,
    discountRate,
    projectDuration,
    cashFlows,
  } = params;

  // Variaciones según BARAPRO: -30%, -20%, -10%, -5%, 0%, +5%, +10%, +20%, +30%
  const variations = [-30, -20, -10, -5, 0, 5, 10, 20, 30];

  function analyzeVariable(
    variableName: string,
    baseValue: number,
    modifyFlows: (originalFlows: number[], changePercent: number) => number[],
    modifyInvestment?: (inv: number, changePercent: number) => number,
    modifiedRate?: (baseRate: number, changePercent: number) => number
  ): SensitivityResult {
    return {
      variable: variableName,
      baseValue,
      variations: variations.map((change) => {
        const multiplier = 1 + change / 100;
        const modifiedFlows = modifyFlows(cashFlows, change);
        const modifiedInvestment = modifyInvestment
          ? modifyInvestment(initialInvestment, change)
          : initialInvestment;

        // CORRECCIÓN: usar la tasa de descuento modificada si aplica
        const effectiveRate = modifiedRate
          ? modifiedRate(discountRate, change)
          : discountRate;

        const newNPV = calculateNPV(effectiveRate, modifiedFlows, modifiedInvestment);
        const newIRR = calculateIRR(modifiedFlows, modifiedInvestment);

        return {
          change,
          newNPV: Math.round(newNPV * 100) / 100,
          newIRR: newIRR !== null ? Math.round(newIRR * 10000) / 10000 : null,
        };
      }),
    };
  }

  return [
    analyzeVariable(
      "Inversión Inicial",
      initialInvestment,
      (flows) => flows,
      (inv, change) => inv * (1 + change / 100)
    ),
    analyzeVariable(
      "Ingresos Anuales",
      annualRevenue,
      (flows, change) => flows.map((f) => f + (annualRevenue * (change / 100) * (projectDuration > 0 ? 1 : 0) / projectDuration))
    ),
    analyzeVariable(
      "Costos Anuales",
      annualCosts,
      (flows, change) => flows.map((f) => f - (annualCosts * (change / 100) / projectDuration))
    ),
    analyzeVariable(
      "Tasa de Descuento",
      discountRate * 100,
      (flows) => flows,
      undefined,
      (rate, change) => rate * (1 + change / 100) // CORRECCIÓN: la tasa sí se modifica
    ),
  ];
}

// ─── Análisis de Escenarios (mejorado con variaciones separadas) ────────────

/**
 * Análisis de Escenarios
 * Compara escenarios optimista, esperado y pesimista
 * MEJORADO: Usa variaciones separadas para inversión, ingresos y costos
 */
export function scenarioAnalysis(params: {
  initialInvestment: number;
  annualRevenue: number;
  annualCosts: number;
  discountRate: number;
  projectDuration: number;
  cashFlows: number[];
  // Variaciones separadas por variable
  scenarioInvestPessimist?: number;
  scenarioInvestOptimist?: number;
  scenarioRevenuePessimist?: number;
  scenarioRevenueOptimist?: number;
  scenarioCostsPessimist?: number;
  scenarioCostsOptimist?: number;
  // Margenes legacy (compatibilidad hacia atrás)
  optimistMargin?: number;
  pessimistMargin?: number;
}): ScenarioResult {
  const {
    initialInvestment,
    annualRevenue,
    annualCosts,
    discountRate,
    projectDuration,
    cashFlows,
    scenarioInvestPessimist = 0.10,
    scenarioInvestOptimist = -0.05,
    scenarioRevenuePessimist = -0.20,
    scenarioRevenueOptimist = 0.05,
    scenarioCostsPessimist = 0.15,
    scenarioCostsOptimist = 0.05,
    optimistMargin,
    pessimistMargin,
  } = params;

  function calculateScenario(
    investVar: number,
    revenueVar: number,
    costsVar: number
  ): ScenarioIndicators {
    const modifiedInvestment = initialInvestment * (1 + investVar);
    const modifiedRevenue = annualRevenue * (1 + revenueVar);
    const modifiedCosts = annualCosts * (1 + costsVar);

    const modifiedFlows = cashFlows.map((cf) => {
      const revChange = annualRevenue * revenueVar / projectDuration;
      const costChange = annualCosts * costsVar / projectDuration;
      return cf + revChange - costChange;
    });

    const npv = calculateNPV(discountRate, modifiedFlows, modifiedInvestment);
    const irr = calculateIRR(modifiedFlows, modifiedInvestment);

    const inflows = modifiedFlows.map((cf) => Math.max(cf, 0));
    const outflows = modifiedFlows.map((cf) => (cf < 0 ? Math.abs(cf) : 0));
    const bcr = calculateBenefitCostRatio(
      discountRate,
      inflows,
      outflows,
      modifiedInvestment
    );
    const payback = calculatePaybackPeriod(modifiedFlows, modifiedInvestment);

    const totalBenefits = modifiedFlows.reduce(
      (sum, cf) => sum + Math.max(cf, 0),
      0
    );
    const totalCosts =
      modifiedInvestment +
      modifiedFlows.reduce((sum, cf) => sum + Math.min(cf, 0), 0) * -1;
    const roi = calculateROI(totalBenefits, totalCosts);

    return {
      npv: Math.round(npv * 100) / 100,
      irr: irr !== null ? Math.round(irr * 10000) / 10000 : null,
      benefitCostRatio: Math.round(bcr * 100) / 100,
      paybackPeriod:
        payback !== null ? Math.round(payback * 100) / 100 : null,
      roi: Math.round(roi * 100) / 100,
    };
  }

  // Usar variaciones separadas si están disponibles; si no, caer a margenes legacy
  let optimistic: ScenarioIndicators;
  let expected: ScenarioIndicators;
  let pessimistic: ScenarioIndicators;

  if (optimistMargin !== undefined && pessimistMargin !== undefined) {
    // Modo legacy con margenes únicos
    optimistic = calculateScenario(pessimistMargin, optimistMargin, -optimistMargin);
    expected = calculateScenario(0, 0, 0);
    pessimistic = calculateScenario(Math.abs(pessimistMargin), pessimistMargin, Math.abs(pessimistMargin));
  } else {
    // Modo BARAPRO con variaciones separadas
    optimistic = calculateScenario(
      scenarioInvestOptimist,   // inversión baja (negativo)
      scenarioRevenueOptimist,  // ingresos altos (positivo)
      scenarioCostsOptimist     // costos bajos (positivo en este contexto = más costos, pero el param es negativo)
    );
    expected = calculateScenario(0, 0, 0);
    pessimistic = calculateScenario(
      scenarioInvestPessimist,    // inversión alta (positivo)
      scenarioRevenuePessimist,   // ingresos bajos (negativo)
      scenarioCostsPessimist      // costos altos (positivo)
    );
  }

  // VAN esperado (promedio ponderado: 25% pesimista, 50% esperado, 25% optimista)
  const expectedVAN =
    optimistic.npv * 0.25 + expected.npv * 0.5 + pessimistic.npv * 0.25;

  // Desviación estándar
  const mean = expectedVAN;
  const variance =
    Math.pow(optimistic.npv - mean, 2) * 0.25 +
    Math.pow(expected.npv - mean, 2) * 0.5 +
    Math.pow(pessimistic.npv - mean, 2) * 0.25;
  const standardDeviation = Math.sqrt(variance);

  return {
    optimistic,
    expected,
    pessimistic,
    expectedVAN: Math.round(expectedVAN * 100) / 100,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
  };
}

// ─── Cálculo integral de todos los indicadores ──────────────────────────────

interface CalculateAllIndicatorsParams {
  initialInvestment: number;
  discountRate: number;
  cashFlows: number[];
  annualRevenue: number;
  annualCosts: number;
  duration: number;
  optimistMargin?: number;
  pessimistMargin?: number;
  // Nuevos parámetros
  fixedCosts?: number;
  variableCosts?: number;
  financeRate?: number | null;
  reinvestRate?: number | null;
  contingencyReserveRate?: number;
  retainedEarningsRate?: number;
  discountRatesByYear?: number[];
  financingSources?: FinancingSourceParam[];
  investmentItems?: InvestmentItemParam[];
  // Parámetros de escenario separados
  scenarioInvestPessimist?: number;
  scenarioInvestOptimist?: number;
  scenarioRevenuePessimist?: number;
  scenarioRevenueOptimist?: number;
  scenarioCostsPessimist?: number;
  scenarioCostsOptimist?: number;
  // Parámetros tributarios
  taxRateSales?: number;
  taxRateIncome?: number;
  generalExpensesCoefficient?: number;
  // FIX (Fisura #2): Parámetros de cobertura de Capital de Trabajo
  workingCapitalCoverageDays?: {
    cash?: number;
    receivable?: number;
    inventory?: number;
    payable?: number;
  };
}

/**
 * Cálculo completo de todos los indicadores financieros
 * Basado en la metodología BARAPRO para proyectos de desarrollo local
 */
export function calculateAllIndicators(
  initialInvestment: number,
  discountRate: number,
  cashFlows: number[],
  annualRevenue: number,
  annualCosts: number,
  duration: number,
  optimistMargin: number = 0.10,
  pessimistMargin: number = -0.10,
  extraParams?: Partial<CalculateAllIndicatorsParams>
): CalculationResult {
  // Extraer parámetros opcionales
  const fixedCosts = extraParams?.fixedCosts ?? annualCosts * 0.4;
  const variableCosts = extraParams?.variableCosts ?? annualCosts * 0.6;
  const financeRate = extraParams?.financeRate ?? discountRate;
  const reinvestRate = extraParams?.reinvestRate ?? discountRate;
  const contingencyReserveRate = extraParams?.contingencyReserveRate ?? 0;
  const retainedEarningsRate = extraParams?.retainedEarningsRate ?? 50;
  const discountRatesByYear = extraParams?.discountRatesByYear;
  const financingSources = extraParams?.financingSources ?? [];
  const investmentItems = extraParams?.investmentItems ?? [];

  // ─── Cálculos de soporte ───

  // Depreciación
  const depreciationSchedule = calculateDepreciation(investmentItems, duration);

  // Costos financieros
  const financialCosts = calculateFinancialCosts(financingSources, duration);

  // Estado de resultados
  const incomeStatement = calculateIncomeStatement({
    duration,
    revenue: annualRevenue,
    variableCosts,
    fixedCosts,
    taxRateSales: extraParams?.taxRateSales ?? 10,
    taxRateIncome: extraParams?.taxRateIncome ?? 15,
    generalExpensesCoefficient: extraParams?.generalExpensesCoefficient ?? 0,
    depreciationSchedule,
    financialCosts,
    contingencyReserveRate,
    retainedEarningsRate,
  });

  // Capital de trabajo
  // FIX (Fisura #2): Usar parámetros configurables en vez de días hardcoded.
  // Si no se proporcionan, se usan los defaults anteriores (15, 30, 30) para compatibilidad.
  const wcDays = extraParams?.workingCapitalCoverageDays || {};
  const depreciationPerYear = depreciationSchedule.map(d => d.totalDepreciation);
  const workingCapital = calculateWorkingCapital({
    duration,
    cashCoverageDays: wcDays.cash ?? 15,
    receivableCoverageDays: wcDays.receivable ?? 30,
    materialsCoverageDays: wcDays.inventory ?? 30,
    annualCosts,
    annualRevenue,
    variableCosts,
    depreciationPerYear,
  });

  // Total de préstamos
  const totalLoans = financingSources.reduce((sum, fs) => sum + fs.amount, 0);

  // Balance general
  const balanceSheet = calculateBalanceSheet({
    duration,
    initialInvestment,
    depreciationSchedule,
    financialCosts,
    incomeStatement,
    workingCapital,
    totalLoans,
  });

  // Flujo de caja DL
  const cashFlowDL = calculateCashFlowDL({
    duration,
    initialInvestment,
    totalLoans,
    incomeStatement,
    financialCosts,
    workingCapital,
  });

  // ─── Cálculo de VPN (con tasa simple o por año) ───
  let npv: number;
  if (discountRatesByYear && discountRatesByYear.length > 0) {
    npv = calculateNPVWithVariableRates(discountRatesByYear, cashFlows, initialInvestment);
  } else {
    npv = calculateNPV(discountRate, cashFlows, initialInvestment);
  }

  // Calcular TIR
  const irr = calculateIRR(cashFlows, initialInvestment);

  // Calcular ROI
  const totalBenefits = cashFlows.reduce((sum, cf) => sum + Math.max(cf, 0), 0);
  const totalCosts = initialInvestment + cashFlows.reduce((sum, cf) => sum + Math.min(cf, 0), 0) * -1;
  const roi = calculateROI(totalBenefits, totalCosts);

  // Calcular Período de Recuperación
  const paybackPeriod = calculatePaybackPeriod(cashFlows, initialInvestment);

  // Calcular PRD (Período de Recuperación Descontado)
  const prd = calculateDiscountedPayback(cashFlows, initialInvestment, discountRate);

  // Calcular Relación Beneficio/Costo
  const inflows = cashFlows.map((cf) => Math.max(cf, 0));
  const outflows = cashFlows.map((cf) => (cf < 0 ? Math.abs(cf) : 0));
  const benefitCostRatio = calculateBenefitCostRatio(
    discountRate,
    inflows,
    outflows,
    initialInvestment
  );

  // Calcular RVAN
  const rvan = calculateRVAN(npv, initialInvestment, discountRate, cashFlows);

  // Calcular TIRM
  const tirm = calculateTIRM(cashFlows, initialInvestment, financeRate, reinvestRate);

  // Calcular Punto de Equilibrio con costos fijos/variables separados
  const breakEven = calculateBreakEven(fixedCosts, variableCosts, annualRevenue);

  // Generar datos periódicos
  const periodicData: PeriodicData[] = [];
  let cumulativeNPV = -initialInvestment;

  for (let i = 0; i < cashFlows.length; i++) {
    const discountedCashFlow =
      cashFlows[i] / Math.pow(1 + discountRate, i + 1);
    cumulativeNPV += discountedCashFlow;

    periodicData.push({
      period: i + 1,
      netCashFlow: cashFlows[i],
      discountedCashFlow: Math.round(discountedCashFlow * 100) / 100,
      cumulativeNPV: Math.round(cumulativeNPV * 100) / 100,
      inflow: Math.max(cashFlows[i], 0),
      outflow: cashFlows[i] < 0 ? Math.abs(cashFlows[i]) : 0,
    });
  }

  // Análisis de Sensibilidad
  const sensitivity = sensitivityAnalysis({
    initialInvestment,
    annualRevenue,
    annualCosts,
    discountRate,
    projectDuration: duration,
    cashFlows,
    fixedCosts,
    variableCosts,
    financingSources,
  });

  // Análisis de Escenarios
  const scenarios = scenarioAnalysis({
    initialInvestment,
    annualRevenue,
    annualCosts,
    discountRate,
    projectDuration: duration,
    cashFlows,
    optimistMargin,
    pessimistMargin,
    scenarioInvestPessimist: extraParams?.scenarioInvestPessimist,
    scenarioInvestOptimist: extraParams?.scenarioInvestOptimist,
    scenarioRevenuePessimist: extraParams?.scenarioRevenuePessimist,
    scenarioRevenueOptimist: extraParams?.scenarioRevenueOptimist,
    scenarioCostsPessimist: extraParams?.scenarioCostsPessimist,
    scenarioCostsOptimist: extraParams?.scenarioCostsOptimist,
  });

  // Determinar conclusión
  const isFeasible = npv > 0 && benefitCostRatio > 1;
  const conclusion = isFeasible ? "Factible" : "No Factible";

  // Generar recomendaciones basadas en la metodología BARAPRO
  let recommendations = "";

  if (isFeasible) {
    recommendations = `El proyecto presenta una VPN positiva de ${formatCurrency(npv)}, lo que indica que genera valor por encima de la tasa de descuento del ${(discountRate * 100).toFixed(1)}%. `;

    if (irr !== null) {
      recommendations += `La TIR del ${(irr * 100).toFixed(2)}% ${irr > discountRate ? "supera" : "es inferior a"} la tasa de descuento, ${irr > discountRate ? "confirmando" : "questionando"} la viabilidad económica. `;
    }

    if (tirm !== null) {
      recommendations += `La TIRM del ${(tirm * 100).toFixed(2)}% refleja una tasa de retorno modificada más realista. `;
    }

    if (rvan > 0) {
      recommendations += `El RVAN de ${rvan.toFixed(2)} indica rentabilidad positiva por cada unidad de inversión descontada. `;
    }

    if (paybackPeriod !== null) {
      recommendations += `El período de recuperación simple es de ${paybackPeriod.toFixed(1)} años. `;
    }

    if (prd !== null) {
      recommendations += `El período de recuperación descontado (PRD) es de ${prd.toFixed(1)} años de un total de ${duration} años del proyecto. `;
    }

    recommendations += `La relación Beneficio/Costo de ${benefitCostRatio.toFixed(2)} indica que por cada unidad invertida se obtiene ${benefitCostRatio.toFixed(2)} unidades de beneficio. `;

    if (breakEven.marginOfSafetyPercent > 30) {
      recommendations += `El margen de seguridad del ${breakEven.marginOfSafetyPercent.toFixed(1)}% es amplio, lo que proporciona un colchón contra variaciones desfavorables. `;
    } else if (breakEven.marginOfSafetyPercent > 0) {
      recommendations += `El margen de seguridad del ${breakEven.marginOfSafetyPercent.toFixed(1)}% es reducido, lo que sugiere cuidado ante variaciones del mercado. `;
    }
  } else {
    recommendations = `El proyecto NO es financieramente factible según la metodología BARAPRO. `;

    if (npv <= 0) {
      recommendations += `La VPN de ${formatCurrency(npv)} indica que los beneficios no cubren la tasa de descuento requerida. `;
    }

    if (benefitCostRatio <= 1) {
      recommendations += `La relación Beneficio/Costo de ${benefitCostRatio.toFixed(2)} es menor a 1, lo que significa que los costos superan los beneficios. `;
    }

    if (irr !== null && irr < discountRate) {
      recommendations += `La TIR del ${(irr * 100).toFixed(2)}% es inferior a la tasa de descuento del ${(discountRate * 100).toFixed(1)}%. `;
    }

    recommendations +=
      "Se recomienda reconsiderar los parámetros del proyecto o buscar fuentes de financiamiento alternativas conforme al marco regulatorio cubano (Decreto 33/2021). ";
  }

  return {
    npv: Math.round(npv * 100) / 100,
    irr: irr !== null ? Math.round(irr * 10000) / 10000 : null,
    roi: Math.round(roi * 100) / 100,
    paybackPeriod:
      paybackPeriod !== null
        ? Math.round(paybackPeriod * 100) / 100
        : null,
    benefitCostRatio: Math.round(benefitCostRatio * 100) / 100,
    rvan: Math.round(rvan * 100) / 100,
    tirm: tirm !== null ? Math.round(tirm * 10000) / 10000 : null,
    prd: prd !== null ? Math.round(prd * 100) / 100 : null,
    breakEven,
    periodicData,
    sensitivity,
    scenarios,
    conclusion,
    recommendations,
    incomeStatement,
    depreciationSchedule,
    financialCosts,
    workingCapital,
    balanceSheet,
    cashFlowDL,
  };
}

// ─── Funciones de formateo ──────────────────────────────────────────────────

/**
 * Formatea un número como moneda (CUP)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CU", {
    style: "currency",
    currency: "CUP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatea un número como porcentaje
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
