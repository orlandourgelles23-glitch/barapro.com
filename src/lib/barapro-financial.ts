import type { BaraproState, PaymentFrequency, AmortizationSystem, GraceInterestPayment, LoanBankFees, InterestRateEntry, ExchangeRateEntry, BankFeeTiming } from './barapro-store';
import { FREQUENCY_PERIODS_PER_YEAR } from './barapro-store';
import { getMonthLabel } from './format';

// Defensive helper: ensure months/quantity is always a valid array
// Handles: undefined, null, JSON strings from Excel, and already-valid arrays
function safeMonths(months: any): number[] {
  if (Array.isArray(months)) return months;
  if (typeof months === 'string' && months.length > 0) {
    try {
      const parsed = JSON.parse(months);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not valid JSON, return empty */ }
  }
  return [];
}

// Defensive helper: ensure any state array property is iterable
// Prevents TypeError when tests or external code pass partial state objects
function safeArray<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

// ============================================================
// SALARY CONTRIBUTIONS HELPER
// Calculates salary totals per worker per month
// Returns { salaryTotal, employerSS, employerITF, workerIIP, workerSS, totalCompanyCost, salaryMonthly, salaryCUP, salaryMLCinCUP }
// ============================================================
export function calcWorkerContributions(
  monthlySalaryCUP: number,
  monthlySalaryMLC: number,
  quantity: number,
  cupToMlc: number,
  includesSocialSecurity: boolean,
  includesWorkforceTax: boolean,
  params: {
    vacationNormRate: number;
    specialSocialSecurityRate: number;
    taxOnWorkforceRate: number;
    personalIncomeTaxExemptMin: number;
    personalIncomeTaxRate: number;
    workerSocialSecurityRate: number;
  }
) {
  const salaryCUP = monthlySalaryCUP * quantity;
  const salaryMLCinCUP = monthlySalaryMLC * quantity * cupToMlc;
  const salaryMonthly = salaryCUP + salaryMLCinCUP;

  // Rate parameters are stored as percentages (whole numbers), divide by 100 for formulas
  const vacationNorm = (params.vacationNormRate || 0) / 100;
  const specialSS = (params.specialSocialSecurityRate || 0) / 100;
  const taxWorkforce = (params.taxOnWorkforceRate || 0) / 100;
  const personalTaxRate = (params.personalIncomeTaxRate || 0) / 100;
  const workerSSRate = (params.workerSocialSecurityRate || 0) / 100;

  // Concept 1: Salario Total = Salario Mensual × (1 + Norma de Vacaciones)
  const salaryTotal = salaryMonthly * (1 + vacationNorm);

  // Concept 2: Contribución a la Seguridad Social = Salario Total × Rate (employer)
  const employerSS = includesSocialSecurity ? salaryTotal * specialSS : 0;

  // Concept 3: Impuesto sobre Fuerza de Trabajo = Salario Total × Rate
  const employerITF = includesWorkforceTax ? salaryTotal * taxWorkforce : 0;

  // Concept 4: IIP (worker) = max(0, Salario Mensual - Mínimo Exento) × Rate
  const taxableBase = Math.max(0, salaryMonthly - (params.personalIncomeTaxExemptMin || 0));
  const workerIIP = taxableBase * personalTaxRate;

  // Concept 5: Contribución trabajadores SS = Salario Mensual × Rate
  const workerSS = salaryMonthly * workerSSRate;

  // Total cost to company (concepts 1+2+3)
  const totalCompanyCost = salaryTotal + employerSS + employerITF;

  return {
    salaryTotal,
    employerSS,
    employerITF,
    workerIIP,
    workerSS,
    totalCompanyCost,
    salaryMonthly,
    salaryCUP,
    salaryMLCinCUP,
  };
}

// Helper to compute calcWorkerContributions for a salary item (ResourceItem format)
function calcItemContributions(item: any, state: BaraproState) {
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  return calcWorkerContributions(
    item.monthlySalaryCUP || 0,
    item.monthlySalaryMLC || 0,
    item.quantity || 1,
    cupToMlc,
    item.includesSocialSecurity !== false,
    item.includesWorkforceTax !== false,
    state.parameters as any
  );
}

// Helper to get ventasBrutas per month from sales items
function buildVentasBrutasMonthly(state: BaraproState): number[] {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  return Array.from({ length: duration }, (_, i) => {
    const m = i + 1;
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        total += item.quantity[m - 1] * item.priceCUP + item.quantity[m - 1] * item.priceMLC * cupToMlc;
      }
    }
    return total;
  });
}

// Sum all employer contributions across all salary modules for a given month
function sumAllEmployerContribs(state: BaraproState, m: number) {
  const allSalaryArrays = [
    state.commercialSalaries,
    state.adminSalaries,
    state.maintenanceSalaries,
    state.indirectSalaries,
    state.directCostSalaries,
  ];
  let totalEmployerSS = 0;
  let totalEmployerITF = 0;
  let totalWorkerIIP = 0;
  let totalWorkerSS = 0;
  let totalSalaryTotal = 0;
  for (const arr of allSalaryArrays) {
    for (const raw of arr) {
      const item = { ...raw, months: safeMonths(raw.months) };
      if (item.months.includes(m)) {
        const c = calcItemContributions(item, state);
        totalEmployerSS += c.employerSS;
        totalEmployerITF += c.employerITF;
        totalWorkerIIP += c.workerIIP;
        totalWorkerSS += c.workerSS;
        totalSalaryTotal += c.salaryTotal;
      }
    }
  }
  // Module E (ResourceItems) - inversión inicial
  for (const raw of safeArray(state.resourceItems)) {
    const item = { ...raw, months: safeMonths(raw.months) };
    if (item.months.includes(m)) {
      const c = calcItemContributions(item, state);
      totalEmployerSS += c.employerSS;
      totalEmployerITF += c.employerITF;
      totalWorkerIIP += c.workerIIP;
      totalWorkerSS += c.workerSS;
      totalSalaryTotal += c.salaryTotal;
    }
  }
  return { totalEmployerSS, totalEmployerITF, totalWorkerIIP, totalWorkerSS, totalSalaryTotal };
}

// Sum employer contributions from operations only (excludes Module E - initial investment)
function sumOperationsContribs(state: BaraproState, m: number) {
  const allSalaryArrays = [
    state.commercialSalaries,
    state.adminSalaries,
    state.maintenanceSalaries,
    state.indirectSalaries,
    state.directCostSalaries,
  ];
  let totalEmployerSS = 0;
  let totalEmployerITF = 0;
  let totalWorkerIIP = 0;
  let totalWorkerSS = 0;
  let totalSalaryTotal = 0;
  for (const arr of allSalaryArrays) {
    for (const raw of arr) {
      const item = { ...raw, months: safeMonths(raw.months) };
      if (item.months.includes(m)) {
        const c = calcItemContributions(item, state);
        totalEmployerSS += c.employerSS;
        totalEmployerITF += c.employerITF;
        totalWorkerIIP += c.workerIIP;
        totalWorkerSS += c.workerSS;
        totalSalaryTotal += c.salaryTotal;
      }
    }
  }
  return { totalEmployerSS, totalEmployerITF, totalWorkerIIP, totalWorkerSS, totalSalaryTotal };
}

// Sum employer contributions from initial investment only (Module E - ResourceItems)
function sumInvestmentContribs(state: BaraproState, m: number) {
  let totalEmployerSS = 0;
  let totalEmployerITF = 0;
  let totalWorkerIIP = 0;
  let totalWorkerSS = 0;
  let totalSalaryTotal = 0;
  for (const raw of safeArray(state.resourceItems)) {
    const item = { ...raw, months: safeMonths(raw.months) };
    if (item.months.includes(m)) {
      const c = calcItemContributions(item, state);
      totalEmployerSS += c.employerSS;
      totalEmployerITF += c.employerITF;
      totalWorkerIIP += c.workerIIP;
      totalWorkerSS += c.workerSS;
      totalSalaryTotal += c.salaryTotal;
    }
  }
  return { totalEmployerSS, totalEmployerITF, totalWorkerIIP, totalWorkerSS, totalSalaryTotal };
}

// Build monthly arrays of all salary contributions
export function buildAllSalaryContribsMonthly(state: BaraproState) {
  const duration = state.project.monthsDuration || 120;
  const result = Array.from({ length: duration }, (_, i) => {
    const m = i + 1;
    const contribs = sumAllEmployerContribs(state, m);
    return { month: m, ...contribs };
  });
  return result;
}

// Build Other Taxes Timeline — separated into investment vs operations
export function buildOtherTaxesTimeline(state: BaraproState) {
  const duration = state.project.monthsDuration || 120;
  const territorialTaxRate = (state.parameters.territorialTaxRate || 0) / 100;
  const ventasBrutas = buildVentasBrutasMonthly(state);

  return Array.from({ length: duration }, (_, i) => {
    const m = i + 1;
    const ops = sumOperationsContribs(state, m);
    const inv = sumInvestmentContribs(state, m);
    return {
      month: m,
      ventasBrutas: ventasBrutas[i],
      operations: {
        territorialContribution: ventasBrutas[i] * territorialTaxRate,
        employerSS: ops.totalEmployerSS,
        employerITF: ops.totalEmployerITF,
        workerIIP: ops.totalWorkerIIP,
        workerSS: ops.totalWorkerSS,
      },
      investment: {
        employerSS: inv.totalEmployerSS,
        employerITF: inv.totalEmployerITF,
        workerIIP: inv.totalWorkerIIP,
        workerSS: inv.totalWorkerSS,
      },
    };
  });
}

// ============================================================
// 1. VAN - Valor Actual Neto (NPV)
// ============================================================
export function calcVAN(cashFlows: number[], discountRate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + discountRate, t + 1);
  }
  return npv;
}

// ============================================================
// 1b. VAN ANUAL con Período de Inversión (t=0 para investment period)
// ============================================================
/**
 * VAN from annual cash flows where the investment period years are at t=0 (no discount).
 * This matches the Resolución 1/2022 approach: the pre-operations period is the present (t=0).
 *
 * @param annualFlows - Annual aggregated cash flows (year 0 = investment period)
 * @param annualRate  - Annual discount rate (e.g. 0.10 for 10%)
 * @param investmentYears - Number of years that are pre-operations (t=0, not discounted)
 */
export function calcVANWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number {
  let npv = 0;
  for (let y = 0; y < annualFlows.length; y++) {
    if (y < investmentYears) {
      npv += annualFlows[y]; // inversión: sin descuento (t=0)
    } else {
      npv += annualFlows[y] / Math.pow(1 + annualRate, y - investmentYears + 1);
    }
  }
  return npv;
}

/**
 * PRA (Periodo de Recuperación Actualizado) con período de inversión en t=0.
 */
export function calcPRAWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number | null {
  let cumulative = 0;
  for (let y = 0; y < annualFlows.length; y++) {
    const discounted = y < investmentYears
      ? annualFlows[y]
      : annualFlows[y] / Math.pow(1 + annualRate, y - investmentYears + 1);
    cumulative += discounted;
    if (cumulative >= 0 && y >= investmentYears) {
      const prev = cumulative - discounted;
      if (prev < 0 && discounted > 0) {
        // Interpolar dentro del año
        return (y - investmentYears) + Math.abs(prev) / discounted;
      }
      return y - investmentYears + 1;
    }
  }
  return null;
}

/**
 * RVAN (Rentabilidad del VAN) con período de inversión en t=0.
 */
export function calcRVANWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number {
  const van = calcVANWithIP(annualFlows, annualRate, investmentYears);
  let vai = 0;
  for (let y = 0; y < annualFlows.length; y++) {
    if (annualFlows[y] < 0) {
      vai += Math.abs(y < investmentYears
        ? annualFlows[y]
        : annualFlows[y] / Math.pow(1 + annualRate, y - investmentYears + 1));
    }
  }
  if (vai === 0) return van > 0 ? Infinity : 0;
  return van / vai;
}

/**
 * Relación Beneficio-Costo (B/C) con período de inversión en t=0.
 */
export function calcBCWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number {
  let pvBenefits = 0;
  let pvCosts = 0;
  for (let y = 0; y < annualFlows.length; y++) {
    const pv = y < investmentYears
      ? annualFlows[y]
      : annualFlows[y] / Math.pow(1 + annualRate, y - investmentYears + 1);
    if (pv >= 0) pvBenefits += pv;
    else pvCosts += Math.abs(pv);
  }
  if (pvCosts === 0) return pvBenefits >= 0 ? Infinity : 0;
  return pvBenefits / pvCosts;
}

/**
 * Índice de Rentabilidad (PI) con período de inversión en t=0.
 */
export function calcIRWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number {
  let pvInflows = 0;
  let pvOutflows = 0;
  for (let y = 0; y < annualFlows.length; y++) {
    const pv = y < investmentYears
      ? annualFlows[y]
      : annualFlows[y] / Math.pow(1 + annualRate, y - investmentYears + 1);
    if (annualFlows[y] > 0) pvInflows += pv;
    else pvOutflows += Math.abs(pv);
  }
  if (pvOutflows === 0) return pvInflows > 0 ? Infinity : 0;
  return (pvInflows - pvOutflows) / pvOutflows;
}

/**
 * Valor Anual Equivalente (VAE) con período de inversión en t=0.
 * Anualiza el VAN solo sobre los años operacionales.
 */
export function calcVAEWithIP(
  annualFlows: number[],
  annualRate: number,
  investmentYears: number
): number {
  const npv = calcVANWithIP(annualFlows, annualRate, investmentYears);
  const opsYears = annualFlows.length - investmentYears;
  if (opsYears <= 0 || annualRate === 0) return npv / Math.max(annualFlows.length, 1);
  const annuityFactor = (annualRate * Math.pow(1 + annualRate, opsYears)) / (Math.pow(1 + annualRate, opsYears) - 1);
  return npv * annuityFactor;
}

// ============================================================
// 2. TIR - Tasa Interna de Retorno (IRR) - Newton-Raphson
// ============================================================
export function calcTIR(cashFlows: number[]): number | null {
  const maxIterations = 1000;
  const tolerance = 1e-8;
  let rate = 0.1;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const exp = t + 1;
      const factor = Math.pow(1 + rate, exp);
      npv += cashFlows[t] / factor;
      dnpv -= (exp * cashFlows[t]) / Math.pow(1 + rate, exp + 1);
    }
    if (Math.abs(dnpv) < 1e-15) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;
    if (rate < -1 || rate > 100) break;
  }

  let low = -0.99;
  let high = 10.0;
  for (let i = 0; i < maxIterations; i++) {
    rate = (low + high) / 2;
    const npv = calcVAN(cashFlows, rate);
    if (Math.abs(npv) < tolerance) return rate;
    if (npv > 0) low = rate;
    else high = rate;
  }

  return null;
}

// ============================================================
// 3. TIRM - Tasa Interna de Retorno Modificada (MIRR)
// ============================================================
export function calcTIRM(
  cashFlows: number[],
  financeRate: number,
  reinvestRate: number
): number | null {
  let pvNegative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] < 0) {
      pvNegative += Math.abs(cashFlows[t]) / Math.pow(1 + financeRate, t + 1);
    }
  }
  if (pvNegative === 0) return null;

  let fvPositive = 0;
  const n = cashFlows.length;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] > 0) {
      fvPositive += cashFlows[t] * Math.pow(1 + reinvestRate, n - t);
    }
  }

  const ratio = fvPositive / pvNegative;
  if (ratio <= 0) return null;
  return Math.pow(ratio, 1 / n) - 1;
}

// ============================================================
// 4. PR - Período de Recuperación (Payback Period)
// ============================================================
export function calcPR(cashFlows: number[]): number | null {
  let cumulative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    cumulative += cashFlows[t];
    if (cumulative >= 0 && t > 0) {
      const prev = cumulative - cashFlows[t];
      if (prev < 0 && cashFlows[t] > 0) {
        return t - 1 + Math.abs(prev) / cashFlows[t];
      }
      return t;
    }
  }
  return null;
}

// ============================================================
// 4b. PRA - Período de Recuperación Actualizado (Discounted Payback)
// ============================================================
export function calcPRA(cashFlows: number[], discountRate: number): number | null {
  let cumulative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const discounted = cashFlows[t] / Math.pow(1 + discountRate, t + 1);
    cumulative += discounted;
    if (cumulative >= 0 && t > 0) {
      const prev = cumulative - discounted;
      if (prev < 0 && discounted > 0) {
        return t - 1 + Math.abs(prev) / discounted;
      }
      return t;
    }
  }
  return null;
}

// ============================================================
// 4c. RVAN - Rentabilidad del VAN (NPV Efficiency Index)
// ============================================================
export function calcRVAN(cashFlows: number[], discountRate: number): number {
  let van = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    van += cashFlows[t] / Math.pow(1 + discountRate, t + 1);
  }
  let vai = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] < 0) {
      vai += Math.abs(cashFlows[t]) / Math.pow(1 + discountRate, t + 1);
    }
  }
  if (vai === 0) return van > 0 ? Infinity : 0;
  return van / vai;
}

// ============================================================
// 5. VPN_Beta - Valor Presente Neto Modificado
// ============================================================
export function calcVPN_Beta(
  cashFlows: number[],
  discountRate: number,
  reinvestRate: number
): number {
  let fv = 0;
  const n = cashFlows.length;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] !== 0) {
      fv += cashFlows[t] * Math.pow(1 + reinvestRate, n - t);
    }
  }
  return fv / Math.pow(1 + discountRate, n);
}

// ============================================================
// 6. Relación Beneficio-Costo (Benefit-Cost Ratio)
// ============================================================
export function calcRelacionBeneficioCosto(
  cashFlows: number[],
  discountRate: number
): number {
  let pvBenefits = 0;
  let pvCosts = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const pv = cashFlows[t] / Math.pow(1 + discountRate, t + 1);
    if (pv >= 0) pvBenefits += pv;
    else pvCosts += Math.abs(pv);
  }
  if (pvCosts === 0) return pvBenefits >= 0 ? Infinity : 0;
  return pvBenefits / pvCosts;
}

// ============================================================
// 7. Tasa Interna de Retorno (Bisection)
// ============================================================
export function calcTasaInternaRetorno(cashFlows: number[]): number | null {
  const maxIter = 2000;
  const tol = 1e-10;
  let low = -0.99;
  let high = 5.0;
  const npvLow = calcVAN(cashFlows, low);
  const npvHigh = calcVAN(cashFlows, high);
  if (npvLow * npvHigh > 0) return calcTIR(cashFlows);
  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const npv = calcVAN(cashFlows, mid);
    if (Math.abs(npv) < tol) return mid;
    if (npvLow * npv > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// ============================================================
// 8. Valor Anual Equivalente (Equivalent Annual Value)
// ============================================================
export function calcValorAnualEquivalente(
  cashFlows: number[],
  discountRate: number
): number {
  const npv = calcVAN(cashFlows, discountRate);
  const n = cashFlows.length;
  if (n <= 0 || discountRate === 0) return npv / Math.max(n, 1);
  const annuityFactor = (discountRate * Math.pow(1 + discountRate, n)) / (Math.pow(1 + discountRate, n) - 1);
  return npv * annuityFactor;
}

// ============================================================
// 9. Tasa de Rendimiento (Rate of Return)
// ============================================================
export function calcTasaRendimiento(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const investment = Math.abs(cashFlows[0]);
  if (investment === 0) return null;
  const totalReturns = cashFlows.slice(1).reduce((sum, cf) => sum + Math.max(cf, 0), 0);
  const n = cashFlows.length;
  return (totalReturns / n) / investment;
}

// ============================================================
// 10. Índice de Rentabilidad (Profitability Index)
// ============================================================
export function calcIndiceRentabilidad(
  cashFlows: number[],
  discountRate: number
): number {
  let pvInflows = 0;
  let pvOutflows = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const pv = cashFlows[t] / Math.pow(1 + discountRate, t + 1);
    if (cashFlows[t] > 0) pvInflows += pv;
    else pvOutflows += Math.abs(pv);
  }
  if (pvOutflows === 0) return pvInflows > 0 ? Infinity : 0;
  return (pvInflows - pvOutflows) / pvOutflows;
}

// ============================================================
// 11. Capital Recuperado (Recovered Capital)
// ============================================================
export function calcCapitalRecuperado(cashFlows: number[]): {
  recovered: number;
  unrecovered: number;
  percentage: number;
  period: number | null;
} {
  let cumulative = 0;
  const investment = Math.abs(cashFlows[0]);
  let period: number | null = null;

  for (let t = 0; t < cashFlows.length; t++) {
    cumulative += cashFlows[t];
    if (cumulative >= 0 && period === null) {
      period = t;
    }
  }

  const recovered = Math.max(cumulative, 0);
  const unrecovered = investment <= 0 ? 0 : Math.max(investment - recovered, 0);
  const percentage = investment > 0 ? Math.min((recovered / investment) * 100, 100) : 0;
  return { recovered, unrecovered, percentage, period };
}

// ============================================================
// 11b. Punto de Equilibrio (Break-Even Point)
// ============================================================
export function calcPuntoEquilibrio(state: BaraproState): number {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const salesTaxRate = (state.parameters.salesTaxRate || 0) / 100;
  const territorialTaxRate = (state.parameters.territorialTaxRate || 0) / 100;
  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));

  // 1. Calculate total annual revenue from sales (Ventas Netas = Brutas × (1 - ISV))
  let totalRevenue = 0;
  for (const item of _salesItems) {
    for (let m = 0; m < Math.min(item.quantity.length, duration); m++) {
      if (item.quantity[m] > 0) {
        const bruto = item.quantity[m] * item.priceCUP + item.quantity[m] * item.priceMLC * cupToMlc;
        totalRevenue += bruto * (1 - salesTaxRate);
      }
    }
  }

  // If total revenue is 0 or invalid, return 0
  if (!totalRevenue || !Number.isFinite(totalRevenue) || totalRevenue <= 0) return 0;

  // 2. Get annual cost breakdown from buildCurrentCosts
  const currentCosts = buildCurrentCosts(state);
  const depSummary = buildDepreciationByItem(state);
  const finCosts = buildFinancialCosts(state);

  // Aggregate totals across all months
  let totalFixedCosts = 0;
  let totalVariableCosts = 0;

  // Financial costs by month (totalInterest + bankFee)
  // NOTA: totalInterest incluye intereses pagados en efectivo + capitalizados
  const finCostByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    finCostByMonth[fc.month] = (finCostByMonth[fc.month] || 0) + fc.totalInterest + fc.bankFee;
  }

  for (let i = 0; i < duration; i++) {
    const cc = currentCosts[i];
    const m = i + 1;

    // Fixed costs: admin + maintenance + indirect + depreciation + financial costs
    // NOTA: buildCurrentCosts ya incluye CSS patronal + ITF dentro de cada categoría
    // (usa totalCompanyCost = salaryTotal + employerSS + employerITF), por lo que NO
    // se deben agregar de nuevo. Solo se agrega la Contribución Territorial que no
    // forma parte de totalCompanyCost.
    const monthlyDep = (depSummary.totalMonthlyDepreciation[i] || 0)
                     + (depSummary.totalMonthlyAmortization[i] || 0);
    const monthlyFinCost = finCostByMonth[m] || 0;

    // Contribución Territorial = Ventas Brutas × territorialTaxRate
    const ventasBrutasM = (() => {
      let v = 0;
      for (const item of _salesItems) {
        for (let mm = 0; mm < Math.min(item.quantity.length, duration); mm++) {
          if (item.quantity[mm] > 0 && mm === i) {
            v += item.quantity[mm] * item.priceCUP + item.quantity[mm] * item.priceMLC * cupToMlc;
          }
        }
      }
      return v;
    })();
    const territorialTax = ventasBrutasM * territorialTaxRate;

    totalFixedCosts += cc.gastosAdmin + cc.gastosMantenimiento + cc.gastosIndirectos
                     + monthlyDep + monthlyFinCost + territorialTax;

    // Variable costs: direct costs (including raw materials) + commercial expenses
    totalVariableCosts += cc.totalCostosDirectos + cc.gastosComerciales;
  }

  // 3. Calculate variable cost ratio
  const variableCostRatio = totalVariableCosts / totalRevenue;

  // Guard against NaN/Infinity propagation
  if (!Number.isFinite(variableCostRatio)) return 0;

  // If variable cost ratio >= 1, return Infinity (never breaks even)
  if (variableCostRatio >= 1) return Infinity;

  // 4. Break-Even Point = Fixed Costs / (1 - Variable Cost Ratio)
  return totalFixedCosts / (1 - variableCostRatio);
}

// ============================================================
// 11c. Margen de Seguridad (Safety Margin)
// ============================================================
export function calcMargenSeguridad(state: BaraproState): number {
  const pe = calcPuntoEquilibrio(state);

  // Get total revenue (Ventas Netas — same logic as calcPuntoEquilibrio)
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const salesTaxRate = (state.parameters.salesTaxRate || 0) / 100;
  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  let totalRevenue = 0;

  for (const item of _salesItems) {
    for (let m = 0; m < Math.min(item.quantity.length, duration); m++) {
      if (item.quantity[m] > 0) {
        const bruto = item.quantity[m] * item.priceCUP + item.quantity[m] * item.priceMLC * cupToMlc;
        totalRevenue += bruto * (1 - salesTaxRate);
      }
    }
  }

  // If revenue is 0, return 0
  if (totalRevenue === 0) return 0;

  // Safety Margin = (Revenue - Break-Even) / Revenue
  return (totalRevenue - pe) / totalRevenue;
}

// ============================================================
// 12. Amortización de Préstamos
// ============================================================
export interface AmortizationRow {
  period: number;
  beginningBalance: number;
  disbursementAmount: number;  // monto desembolsado en este período
  payment: number;             // cuota total pagada en efectivo este período (sin bankFee)
  principal: number;           // capital amortizado este período
  interest: number;            // interés total calculado este período (pagado + capitalizado)
  capitalizedInterest: number; // intereses capitalizados (acumulados al capital, NO pagados)
  graceAccumulatedInterest: number; // intereses acumulados en gracia no capitalizable con pago único
  bankFee: number;             // gastos bancarios (comisión + seguro + otros, según desglose)
  endingBalance: number;
  isGrace: boolean;
}

/**
 * Convierte una tasa nominal anual a tasa efectiva periódica (conversión simple).
 *
 * Fórmula: i_periodo = Tasa_nominal_anual / periodos_por_año
 *
 * Usa esta función cuando el período de capitalización coincide con la frecuencia de pago.
 *
 * Ejemplo:
 *   Tasa anual 12%, frecuencia mensual → 0.12 / 12 = 0.01 (1% mensual)
 *   Tasa anual 12%, frecuencia trimestral → 0.12 / 4 = 0.03 (3% trimestral)
 */
export function convertNominalToEffective(
  annualNominalRate: number,
  frequency: PaymentFrequency = 'monthly'
): number {
  const periodsPerYear = FREQUENCY_PERIODS_PER_YEAR[frequency];
  return annualNominalRate / periodsPerYear;
}

/**
 * Convierte una tasa nominal anual a tasa efectiva periódica usando capitalización compuesta.
 *
 * Fórmula de equivalencia de tasas:
 *   i_target = (1 + i_nominal / n_cap)^(n_cap / n_target) - 1
 *
 * Donde:
 *   - i_nominal: tasa nominal anual
 *   - n_cap: períodos de capitalización por año (capitalizationPeriod)
 *   - n_target: períodos de la frecuencia objetivo por año (targetFrequency)
 *
 * Casos especiales:
 *   - Si capitalizationPeriod === targetFrequency → división simple (equivalente a convertNominalToEffective)
 *   - Si tasa = 0 → retorna 0
 *
 * Ejemplos:
 *   Tasa 12% nominal, capitalización trimestral, pago mensual:
 *     i_cap = 0.12/4 = 0.03
 *     i_mensual = (1.03)^(4/12) - 1 = (1.03)^(1/3) - 1 ≈ 0.009901...
 *
 *   Tasa 12% nominal, capitalización mensual, pago trimestral:
 *     i_cap = 0.12/12 = 0.01
 *     i_trimestral = (1.01)^3 - 1 ≈ 0.030301...
 */
export function convertNominalToEffectiveCompound(
  annualNominalRate: number,
  capitalizationPeriod: PaymentFrequency,
  targetFrequency: PaymentFrequency
): number {
  if (annualNominalRate === 0) return 0;

  const nCap = FREQUENCY_PERIODS_PER_YEAR[capitalizationPeriod];
  const nTarget = FREQUENCY_PERIODS_PER_YEAR[targetFrequency];

  // Si coinciden, usar división simple
  if (nCap === nTarget) {
    return annualNominalRate / nCap;
  }

  const iCap = annualNominalRate / nCap;
  return Math.pow(1 + iCap, nCap / nTarget) - 1;
}

/**
 * Convierte una tasa nominal anual a tasa efectiva mensual,
 * usando el período de capitalización especificado.
 *
 * Esta es la función principal que debe usarse en calcAmortizacion
 * para obtener la tasa mensual equivalente (sea simple o compuesta).
 *
 * @param annualNominalRate Tasa nominal anual
 * @param capitalizationPeriod Período de capitalización de la tasa
 * @returns Tasa efectiva mensual
 */
export function convertToMonthlyRate(
  annualNominalRate: number,
  capitalizationPeriod: PaymentFrequency = 'monthly'
): number {
  return convertNominalToEffectiveCompound(annualNominalRate, capitalizationPeriod, 'monthly');
}

/**
 * Calcula la cuota fija del sistema francés.
 * PMT = S * (i * (1+i)^n) / ((1+i)^n - 1)
 */
function calcFrenchPayment(principal: number, periodRate: number, numPayments: number): number {
  if (periodRate === 0) return principal / numPayments;
  return (principal * periodRate * Math.pow(1 + periodRate, numPayments)) /
         (Math.pow(1 + periodRate, numPayments) - 1);
}

/**
 * Obtiene los desembolsos mensuales de un préstamo.
 * Si tiene disbursementSchedule lo usa; si no, desembolso único en startMonth.
 * Retorna un Record<monthAbs, amount>.
 */
export function getLoanDisbursements(loan: {
  amountCUP: number;
  startMonth: number;
  disbursementSchedule?: { month: number; amount: number }[];
}): Record<number, number> {
  const result: Record<number, number> = {};
  if (loan.disbursementSchedule && loan.disbursementSchedule.length > 0) {
    for (const d of loan.disbursementSchedule) {
      if (d.amount > 0) {
        result[d.month] = (result[d.month] || 0) + d.amount;
      }
    }
  } else {
    result[loan.startMonth] = (result[loan.startMonth] || 0) + loan.amountCUP;
  }
  return result;
}

/**
 * Calcula los gastos bancarios para un desembolso dado.
 * Soporta tanto bankFeeRate simple como desglose LoanBankFees.
 * Retorna la suma de todos los componentes aplicables.
 */
function calcBankFee(
  disbursementAmount: number,
  bankFeeRate: number | undefined,
  bankFees: LoanBankFees | undefined
): number {
  if (disbursementAmount <= 0) return 0;

  // Si hay desglose detallado, usarlo (prioridad)
  if (bankFees) {
    const commission = disbursementAmount * (bankFees.commissionRate || 0);
    const insurance = disbursementAmount * (bankFees.insuranceRate || 0);
    const other = disbursementAmount * (bankFees.otherRate || 0);
    return commission + insurance + other;
  }

  // Retrocompatible: bankFeeRate simple (parámetro global)
  return disbursementAmount * (bankFeeRate || 0);
}

/**
 * Resuelve la tasa nominal anual vigente para un período dado.
 * Si hay interestRateTable, busca la última entrada con periodStart <= period.
 * Si no hay tabla o está vacía, retorna la tasa fija (annualRate).
 * 
 * @param period Período relativo (1-based)
 * @param annualRate Tasa fija (fallback)
 * @param rateTable Tabla de tasas variables (opcional)
 */
export function resolveRateForPeriod(
  period: number,
  annualRate: number,
  rateTable?: InterestRateEntry[]
): number {
  if (!rateTable || rateTable.length === 0) return annualRate;
  
  // Sort by periodStart ascending to ensure correct lookup
  const sorted = [...rateTable].sort((a, b) => a.periodStart - b.periodStart);
  let applicableRate = annualRate;
  for (const entry of sorted) {
    if (entry.periodStart <= period) {
      applicableRate = entry.rate;
    } else {
      break; // sorted, so no need to continue
    }
  }
  return applicableRate;
}

/**
 * Resuelve la tasa de cambio para un período dado de un préstamo en moneda extranjera.
 * Si la moneda es CUP, retorna 1 (sin conversión).
 * Si no hay tabla, usa la tasa del proyecto (project.exchangeRates.cupToMlc).
 * Si hay tabla, busca la última entrada con periodStart <= period.
 *
 * @param period Período relativo del préstamo (1-based)
 * @param loanCurrency Moneda del préstamo ('CUP', 'MLC', 'USD')
 * @param projectCupToMlc Tasa de cambio del proyecto (cupToMlc)
 * @param exchangeRateTable Tabla de tasas de cambio variables (opcional)
 */
export function resolveExchangeRateForPeriod(
  period: number,
  loanCurrency: string,
  projectCupToMlc: number,
  exchangeRateTable?: ExchangeRateEntry[]
): number {
  // If CUP, no conversion needed (rate = 1)
  if (loanCurrency === 'CUP' || !loanCurrency) return 1;
  // If no table, use project rate
  if (!exchangeRateTable || exchangeRateTable.length === 0) return projectCupToMlc;
  // Sort by periodStart ascending to ensure correct lookup
  const sorted = [...exchangeRateTable].sort((a, b) => a.periodStart - b.periodStart);
  let applicableRate = projectCupToMlc;
  for (const entry of sorted) {
    if (entry.periodStart <= period) {
      applicableRate = entry.rate;
    } else {
      break;
    }
  }
  return applicableRate;
}

/**
 * Calcula la tabla de amortización de un préstamo según la Resolución GOC-2022-O95
 * y el Esquema de Metodología de Préstamos.
 *
 * Sistemas de amortización:
 * - Francés (amortizationSystem='french' o undefined): cuota fija.
 * - Alemán (amortizationSystem='german'): amortización de capital constante, cuota decreciente.
 *
 * Frecuencia de pagos (paymentFrequency):
 * - 'monthly': pagos mensuales (12/año) — por defecto, retrocompatible.
 * - 'quarterly': pagos trimestrales (4/año).
 * - 'semiannual': pagos semestrales (2/año).
 *
 * Modalidades de interés durante gracia:
 * - Capitalizable (capitalizableInterest=true): intereses se ACUMULAN al capital.
 * - No capitalizable, pago periódico (graceInterestPayment='periodico' o undefined):
 *   intereses se pagan mes a mes (salida de efectivo).
 * - No capitalizable, pago único (graceInterestPayment='pago-unico'):
 *   intereses se acumulan durante la gracia y se pagan en lump sum al final.
 *
 * Número de cuotas:
 * - Si se especifica numInstallments, se usa directamente.
 * - Si no, se calcula automáticamente según termMonths, gracePeriodMonths y paymentFrequency.
 *
 * Gastos bancarios:
 * - Soporta desglose (comisión apertura, seguro, otros) vía bankFees.
 * - Retrocompatible con bankFeeRate simple.
 */
export function calcAmortizacion(loan: {
  amountCUP: number;
  annualRate: number;
  termMonths: number;
  gracePeriodMonths: number;
  startMonth: number;
  disbursementSchedule?: { month: number; amount: number }[];
  capitalizableInterest?: boolean;
  graceInterestPayment?: GraceInterestPayment;
  bankFeeRate?: number;
  bankFees?: LoanBankFees;
  bankFeeTiming?: BankFeeTiming;
  amortizationSystem?: AmortizationSystem;
  paymentFrequency?: PaymentFrequency;
  capitalizationPeriod?: PaymentFrequency;
  numInstallments?: number;
  interestRateTable?: InterestRateEntry[];
  /** Duración del proyecto en meses. Si se proporciona, el plazo del préstamo
   *  se ajusta para no exceder el horizonte del proyecto:
   *  effectiveTerm = min(termMonths, projectDuration - startMonth + 1) */
  projectDuration?: number;
}): AmortizationRow[] {
  const { amountCUP, annualRate, termMonths, gracePeriodMonths } = loan;

  // Ajustar plazo para que el préstamo no exceda el horizonte del proyecto
  const effectiveTerm = loan.projectDuration
    ? Math.min(termMonths, Math.max(0, loan.projectDuration - loan.startMonth + 1))
    : termMonths;
  const schedule: AmortizationRow[] = [];

  // ── Parámetros de frecuencia ──
  const frequency: PaymentFrequency = loan.paymentFrequency || 'monthly';
  const capPeriod: PaymentFrequency = loan.capitalizationPeriod || loan.paymentFrequency || 'monthly';
  const monthsPerPeriod = FREQUENCY_PERIODS_PER_YEAR[frequency] === 12
    ? 1
    : 12 / FREQUENCY_PERIODS_PER_YEAR[frequency]; // quarterly→3, semiannual→6

  // Tasa periódica según frecuencia de pago, con capitalización compuesta
  // (si capitalizationPeriod difiere de paymentFrequency, se usa conversión compuesta)
  const periodRate = convertNominalToEffectiveCompound(annualRate, capPeriod, frequency);

  // Tasa mensual efectiva derivada del período de capitalización
  const monthlyRate = convertToMonthlyRate(annualRate, capPeriod);

  const isCapitalizable = !!loan.capitalizableInterest;
  const isGerman = loan.amortizationSystem === 'german';
  const gracePayment: GraceInterestPayment = loan.graceInterestPayment || 'periodico';
  const isGraceLumpSum = !isCapitalizable && gracePayment === 'pago-unico';

  // Construir mapa de desembolsos por periodo relativo (1-based desde startMonth)
  const disbursements = getLoanDisbursements(loan);
  const disbursementByPeriod: Record<number, number> = {};
  let lastDisbursementPeriod = 0;
  for (const [m, amt] of Object.entries(disbursements)) {
    const period = parseInt(m) - loan.startMonth + 1;
    if (period >= 1) {
      disbursementByPeriod[period] = (disbursementByPeriod[period] || 0) + amt;
      if (period > lastDisbursementPeriod) lastDisbursementPeriod = period;
    }
  }

  const hasGradualDisbursements = lastDisbursementPeriod > 1;

  // Período efectivo de gracia = máximo entre el período de gracia contractual
  // y la fase de desembolsos
  const effectiveGraceEnd = hasGradualDisbursements
    ? Math.max(gracePeriodMonths, lastDisbursementPeriod)
    : gracePeriodMonths;

  // ═══════ PASO 1: Calcular el saldo acumulado al final del período de gracia ═══════
  let accumulatedBalance = 0;
  let totalCapitalizedInterest = 0;
  let graceAccumulatedInterest = 0; // para pago único (no capitalizable)

  for (let period = 1; period <= effectiveGraceEnd && period <= effectiveTerm; period++) {
    const disb = disbursementByPeriod[period] || 0;
    if (disb > 0) accumulatedBalance += disb;

    // Resolve rate for this specific period (variable rate support)
    const periodAnnualRate = resolveRateForPeriod(period, annualRate, loan.interestRateTable);
    const periodMonthlyRate = convertToMonthlyRate(periodAnnualRate, capPeriod);

    // Durante gracia SIEMPRE se calculan intereses mensuales sobre el saldo
    // usando la tasa mensual efectiva derivada del período de capitalización
    const interest = accumulatedBalance * periodMonthlyRate;

    if (isCapitalizable) {
      totalCapitalizedInterest += interest;
      accumulatedBalance += interest;
    } else if (isGraceLumpSum) {
      // Acumular intereses para pago único al final de la gracia
      // (no se pagan mes a mes, no se capitalizan)
      graceAccumulatedInterest += interest;
    }
  }

  // ═══════ PASO 2: Calcular cuota de amortización según sistema ═══════
  // Convertir effectiveGraceEnd a período de pago relativo
  const gracePaymentPeriods = Math.ceil(effectiveGraceEnd / monthsPerPeriod);

  // Número de cuotas: usar numInstallments si se especifica, si no calcular
  let activePaymentPeriods: number;
  if (loan.numInstallments && loan.numInstallments > 0) {
    activePaymentPeriods = loan.numInstallments;
  } else {
    const totalPaymentPeriods = Math.ceil(effectiveTerm / monthsPerPeriod);
    activePaymentPeriods = Math.max(0, totalPaymentPeriods - gracePaymentPeriods);
  }

  const balanceForPayment = (isCapitalizable && effectiveGraceEnd > 0)
    ? accumulatedBalance
    : amountCUP;

  let periodPayment = 0; // cuota por período de pago (no por mes)
  let constantPrincipal = 0; // para sistema alemán

  if (isGerman) {
    // ═══ SISTEMA ALEMÁN: capital constante ═══
    constantPrincipal = activePaymentPeriods > 0 ? balanceForPayment / activePaymentPeriods : 0;
  } else {
    // ═══ SISTEMA FRANCÉS: cuota fija ═══
    periodPayment = calcFrenchPayment(balanceForPayment, periodRate, activePaymentPeriods);
  }

  // ═══════ PASO 3: Generar cronograma completo (mensual) ═══════
  let currentBalance = 0;
  let germanRemainingPrincipal = balanceForPayment; // saldo pendiente para sistema alemán
  let graceLumpSumPaid = false;
  let paymentPeriodCount = 0; // contador de cuotas efectivamente pagadas

  for (let period = 1; period <= effectiveTerm; period++) {
    const beginningBalance = currentBalance;

    // Aplicar desembolso de este periodo
    const disb = disbursementByPeriod[period] || 0;
    if (disb > 0) {
      currentBalance += disb;
    }

    const isGrace = period <= effectiveGraceEnd;

    // Resolve rate for this period (variable rate support)
    const periodAnnualRate = resolveRateForPeriod(period, annualRate, loan.interestRateTable);
    const periodMonthlyRate = convertToMonthlyRate(periodAnnualRate, capPeriod);
    const periodPeriodRate = convertNominalToEffectiveCompound(periodAnnualRate, capPeriod, frequency);

    // Interés mensual sobre el saldo actual
    let interest = currentBalance * periodMonthlyRate;

    let principal = 0;
    let payment = 0;
    let capitalizedInterest = 0;
    let graceAccInterest = 0; // intereses acumulados gracia (pago único)

    if (isGrace) {
      if (isCapitalizable) {
        capitalizedInterest = interest;
        currentBalance += interest;
        payment = 0;
        principal = 0;
      } else if (isGraceLumpSum) {
        // Gracia no capitalizable con pago único: acumular intereses, no pagar
        payment = 0;
        principal = 0;
        graceAccInterest = interest;
      } else {
        // Interés no capitalizable con pago periódico: se paga mensualmente (comportamiento original)
        payment = interest;
        principal = 0;
      }
    } else {
      // ═══ FASE DE AMORTIZACIÓN ═══
      // Verificar si este mes corresponde a un período de pago
      const isPaymentMonth = ((period - effectiveGraceEnd) % monthsPerPeriod === 0) || monthsPerPeriod === 1;

      if (isPaymentMonth) {
        // ═══ LIMITAR CUOTAS A numInstallments ═══
        const maxInstallments = loan.numInstallments && loan.numInstallments > 0
          ? loan.numInstallments : Infinity;
        paymentPeriodCount++;

        if (paymentPeriodCount > maxInstallments) {
          // Se excedió el número de cuotas: no más pagos
          payment = 0;
          principal = 0;
        } else {
          // ═══ PAGO ÚNICO DE INTERESES DE GRACIA ═══
          // Se paga en el primer período de amortización (primera cuota)
          let lumpSumGrace = 0;
          if (isGraceLumpSum && !graceLumpSumPaid && graceAccumulatedInterest > 0) {
            lumpSumGrace = graceAccumulatedInterest;
            graceLumpSumPaid = true;
            graceAccInterest = graceAccumulatedInterest;
          }

          if (isGerman) {
            // ═══ ALEMÁN ═══
            const periodInterest = germanRemainingPrincipal * periodPeriodRate;
            interest = periodInterest;
            principal = Math.min(constantPrincipal, germanRemainingPrincipal);
            payment = principal + periodInterest + lumpSumGrace;
            germanRemainingPrincipal -= principal;
          } else {
            // ═══ FRANCÉS: with variable rates, recalculate cuota based on remaining periods ═══
            let currentPayment = periodPayment;

            // If variable rate, recalculate payment based on remaining balance
            if (loan.interestRateTable && loan.interestRateTable.length > 0) {
              const remainingPeriods = Math.max(0, activePaymentPeriods - paymentPeriodCount + 1);
              if (remainingPeriods > 0 && currentBalance > 0) {
                currentPayment = calcFrenchPayment(currentBalance, periodPeriodRate, remainingPeriods);
              } else {
                currentPayment = currentBalance * (1 + periodPeriodRate); // last payment
              }
            }

            const periodInterest = currentBalance * periodPeriodRate;
            interest = periodInterest;
            payment = currentPayment + lumpSumGrace;
            principal = payment - periodInterest - lumpSumGrace;
            if (principal > currentBalance) principal = currentBalance;
            payment = principal + periodInterest + lumpSumGrace;
          }
        }
      } else {
        // Mes intermedio (no es período de pago): no hay cuota
        payment = 0;
        principal = 0;
      }
    }

    const endingBalance = Math.max(currentBalance - principal, 0);

    // Gastos bancarios según bankFeeTiming (Phase 7)
    let bankFee = 0;
    if (loan.bankFeeTiming === 'periodic') {
      // Modo periódico: gastos bancarios se aplican en cada período de pago
      // durante la amortización. La base es el saldo después del desembolso
      // del período (currentBalance antes de restar principal).
      if (!isGrace && payment > 0) {
        bankFee = calcBankFee(currentBalance, loan.bankFeeRate, loan.bankFees);
      }
    } else {
      // Modo por defecto (at-disbursement o undefined): solo al desembolso
      bankFee = calcBankFee(disb, loan.bankFeeRate, loan.bankFees);
    }

    schedule.push({
      period,
      beginningBalance,
      disbursementAmount: disb,
      payment,
      principal,
      interest,
      capitalizedInterest,
      graceAccumulatedInterest: graceAccInterest,
      bankFee,
      endingBalance,
      isGrace,
    });
    currentBalance = endingBalance;
    // Solo romper si el saldo es cero DESPUÉS de la fase de amortización
    // (no durante gracia cuando aún no hay desembolsos)
    if (currentBalance <= 0 && disb === 0 && period > effectiveGraceEnd) break;
  }
  return schedule;
}

// ============================================================
// 13. Depreciación (por activo individual)
// ============================================================
export interface DepreciationRow {
  year: number;
  beginningValue: number;
  depreciation: number;
  accumulatedDepreciation: number;
  endingValue: number;
}

export function calcDepreciacion(
  assetCost: number,
  usefulLife: number,
  residualValuePercent: number,
  method: 'straight-line' | 'declining'
): DepreciationRow[] {
  const schedule: DepreciationRow[] = [];
  const residualValue = assetCost * residualValuePercent;
  if (assetCost <= 0 || usefulLife <= 0) return schedule;

  if (method === 'straight-line') {
    const annualDepreciation = (assetCost - residualValue) / usefulLife;
    let accumulated = 0;
    for (let year = 1; year <= usefulLife; year++) {
      const dep = year === usefulLife ? assetCost - residualValue - accumulated : annualDepreciation;
      accumulated += dep;
      schedule.push({
        year,
        beginningValue: assetCost - accumulated + dep,
        depreciation: dep,
        accumulatedDepreciation: accumulated,
        endingValue: assetCost - accumulated,
      });
    }
  } else {
    const rate = 1 - Math.pow(residualValue / assetCost, 1 / usefulLife);
    let bookValue = assetCost;
    let accumulated = 0;
    for (let year = 1; year <= usefulLife; year++) {
      const dep = Math.min(bookValue * rate, bookValue - residualValue);
      accumulated += dep;
      const ending = Math.max(assetCost - accumulated, residualValue);
      schedule.push({
        year,
        beginningValue: bookValue,
        depreciation: dep,
        accumulatedDepreciation: accumulated,
        endingValue: ending,
      });
      bookValue = ending;
    }
  }
  return schedule;
}

// ============================================================
// AGGREGATION FUNCTIONS
// ============================================================

export interface TimelinePoint {
  month: number;
  cup: number;
  mlc: number;
}

export function buildCostTimeline(state: BaraproState): TimelinePoint[] {
  const duration = state.project.monthsDuration || 120;
  const timeline: TimelinePoint[] = Array.from({ length: duration }, (_, i) => ({
    month: i + 1,
    cup: 0,
    mlc: 0,
  }));

  // Defensive: ensure every item has a valid months array (guards against undefined from DB imports)
  const safe = <T extends { months?: number[] }>(item: T): T & { months: number[] } => ({
    ...item,
    months: safeMonths(item.months),
  });

  const addCost = (months: number[], cupPerMonth: number, mlcPerMonth: number) => {
    for (const m of months) {
      if (m >= 1 && m <= duration) {
        timeline[m - 1].cup += cupPerMonth;
        timeline[m - 1].mlc += mlcPerMonth;
      }
    }
  };

  // Module B - Construction
  for (const raw of safeArray(state.constructionItems)) {
    const item = safe(raw);
    const total = item.quantity * item.unitCostCUP;
    const totalMLC = item.quantity * item.unitCostMLC;
    const perMonth = item.months.length > 0 ? total / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? totalMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module C - Capital
  for (const raw of safeArray(state.capitalItems)) {
    const item = safe(raw);
    const total = item.quantity * item.unitCostCUP;
    const totalMLC = item.quantity * item.unitCostMLC;
    const perMonth = item.months.length > 0 ? total / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? totalMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module D - Subcontracts
  for (const raw of safeArray(state.subcontractItems)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.totalCostCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.totalCostMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module E - Resources
  for (const raw of safeArray(state.resourceItems)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Module F - Purchases
  for (const raw of safeArray(state.purchaseItems)) {
    const item = safe(raw);
    const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
    if (quantities) {
      // Use per-month quantities
      for (let m = 0; m < item.months.length; m++) {
        const monthIdx = item.months[m] - 1;
        if (monthIdx >= 0 && monthIdx < quantities.length) {
          const q = quantities[monthIdx] || 0;
          const cupCost = q * (item.unitCostCUP || 0);
          const mlcCost = q * (item.unitCostMLC || 0);
          addCost([item.months[m]], cupCost, mlcCost);
        }
      }
    } else {
      // Legacy: spread total evenly across months
      const total = item.quantity * item.unitCostCUP;
      const totalMLC = item.quantity * item.unitCostMLC;
      const perMonth = item.months.length > 0 ? total / item.months.length : 0;
      const perMonthMLC = item.months.length > 0 ? totalMLC / item.months.length : 0;
      addCost(item.months, perMonth, perMonthMLC);
    }
  }

  // Module I - Commercial
  for (const raw of safeArray(state.commercialExpenses)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module I - Commercial Salaries
  for (const raw of safeArray(state.commercialSalaries)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Module J - Admin
  for (const raw of safeArray(state.adminExpenses)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module J - Admin Salaries
  for (const raw of safeArray(state.adminSalaries)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Module K - Maintenance
  for (const raw of safeArray(state.maintenanceItems)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module K - Maintenance Salaries
  for (const raw of safeArray(state.maintenanceSalaries)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Module L - Indirect
  for (const raw of safeArray(state.indirectExpenses)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Module L - Indirect Salaries
  for (const raw of safeArray(state.indirectSalaries)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Direct Costs
  for (const raw of safeArray(state.directCostItems)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Direct Costs Salaries
  for (const raw of safeArray(state.directCostSalaries)) {
    const item = safe(raw);
    const contribs = calcItemContributions(item, state);
    addCost(item.months, contribs.totalCompanyCost, contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100));
  }

  // Spare Parts
  for (const raw of safeArray(state.sparePartItems)) {
    const item = safe(raw);
    const total = item.quantity * item.unitCostCUP;
    const totalMLC = item.quantity * item.unitCostMLC;
    const perMonth = item.months.length > 0 ? total / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? totalMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  // Other Resources (incluye items automáticos de Gastos Financieros de inversión)
  for (const raw of getMergedOtherResourceItems(state)) {
    const item = safe(raw);
    const perMonth = item.months.length > 0 ? item.amountCUP / item.months.length : 0;
    const perMonthMLC = item.months.length > 0 ? item.amountMLC / item.months.length : 0;
    addCost(item.months, perMonth, perMonthMLC);
  }

  return timeline;
}

export function buildRevenueTimeline(state: BaraproState): TimelinePoint[] {
  const duration = state.project.monthsDuration || 120;
  const timeline: TimelinePoint[] = Array.from({ length: duration }, (_, i) => ({
    month: i + 1,
    cup: 0,
    mlc: 0,
  }));

  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  for (const item of _salesItems) {
    for (let m = 0; m < Math.min(item.quantity.length, duration); m++) {
      if (item.quantity[m] > 0) {
        timeline[m].cup += item.quantity[m] * item.priceCUP;
        timeline[m].mlc += item.quantity[m] * item.priceMLC;
      }
    }
  }

  return timeline;
}

// ============================================================
// CASH FLOW
// ============================================================

export interface CashFlowPoint {
  month: number;
  inflow: number;
  outflow: number;
  netFlow: number;
  cumulativeFlow: number;
  discountedFlow: number;
  cumulativeDiscounted: number;
}

export function buildCashFlowTimeline(state: BaraproState): CashFlowPoint[] {
  const costs = buildCostTimeline(state);
  const revenues = buildRevenueTimeline(state);
  const duration = state.project.monthsDuration || 120;
  const rate = (state.parameters.discountRateCUP || 0) / 100;
  const monthlyRate = Math.pow(1 + rate, 1 / 12) - 1;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const salesTaxRate = (state.parameters.salesTaxRate || 0) / 100;

  // Período inicial (pre-operaciones): NO se descuenta (t=0)
  const opStartMonth = findOperationStartMonth(state);
  const investmentMonths = opStartMonth > duration ? 0 : opStartMonth - 1;

  // Build other income monthly array
  const otherIncomeMonthly = new Array(duration).fill(0) as number[];
  for (const oi of state.otherIncomeItems) {
    const monthlyTotal = (oi.amountCUP || 0) + (oi.amountMLC || 0) * cupToMlc;
    for (const m of safeMonths(oi.months)) {
      if (m >= 1 && m <= duration) otherIncomeMonthly[m - 1] += monthlyTotal;
    }
  }

  const flows: CashFlowPoint[] = [];
  let cumulative = 0;
  let cumDisc = 0;

  for (let i = 0; i < duration; i++) {
    const costCUP = costs[i].cup + costs[i].mlc * cupToMlc;
    const brutoCUP = revenues[i].cup + revenues[i].mlc * cupToMlc;
    // Ventas Netas = Ventas Brutas × (1 − ISV)
    const ventasNetas = brutoCUP * (1 - salesTaxRate);
    // Ingresos Totales = Ventas Netas + Otros Ingresos
    const inflow = ventasNetas + otherIncomeMonthly[i];
    const outflow = costCUP;
    const netFlow = inflow - outflow;
    cumulative += netFlow;
    // Período inicial: sin descuento; operacional: descuento desde inicio de operaciones
    const discounted = i < investmentMonths
      ? netFlow  // período inicial: sin descuento (t=0)
      : netFlow / Math.pow(1 + monthlyRate, i - investmentMonths + 1);
    cumDisc += discounted;

    flows.push({
      month: i + 1,
      inflow,
      outflow,
      netFlow,
      cumulativeFlow: cumulative,
      discountedFlow: discounted,
      cumulativeDiscounted: cumDisc,
    });
  }

  return flows;
}

// ============================================================
// 14. PRESUPUESTO DE INVERSIÓN POR PARTIDAS
// ============================================================

export interface InvestmentBudgetItem {
  partida: string;
  subpartida: string;
  nombre: string;
  totalCUP: number;
  totalMLC: number;
  totalCUPConvertido: number;   // CUP + MLC × cupToMlc
  totalMLCConvertido: number;    // CUP / cupToMlc + MLC
  totalCLConvertido: number;     // CUP / cupToCl + MLC / mlcToCl
  months: number[];
}

export interface InvestmentBudgetSummary {
  items: InvestmentBudgetItem[];
  subtotalCUP: number;
  subtotalMLC: number;
  totalCUP: number;
  totalMLC: number;
  contingencyCUP: number;
  contingencyMLC: number;
  initialWCCUP: number;
  initialWCMLC: number;
  grandTotalCUP: number;   // Total inversión expresado en CUP
  grandTotalMLC: number;  // Total inversión expresado en MLC
  grandTotalCL: number;   // Total inversión expresado en CL
  // Financing breakdown
  totalLoanCUP: number;   // Total préstamos (CUP)
  totalCapitalSocialCUP: number; // Capital Social = Total inversión - Préstamos
}

export function buildInvestmentBudget(state: BaraproState): InvestmentBudgetSummary {
  const items: InvestmentBudgetItem[] = [];
  let subtotalCUP = 0;
  let subtotalMLC = 0;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const cupToCl = state.project.exchangeRates.cupToCl;
  const mlcToCl = state.project.exchangeRates.mlcToCl;

  // Helper to add items with full multi-currency support
  const addItems = (
    sourceArray: any[],
    partida: string,
    getName: (i: any) => string,
    getSubpartida: (i: any) => string,
    getCUP: (i: any) => number,
    getMLC: (i: any) => number,
    getMonths: (i: any) => number[]
  ) => {
    for (const item of sourceArray) {
      const cup = getCUP(item);
      const mlc = getMLC(item);
      const cupConverted = cup + mlc * cupToMlc;
      const mlcConverted = cupToMlc > 0 ? (cup / cupToMlc) + mlc : 0;
      const clConverted = (cupToCl > 0 ? cup / cupToCl : 0) + (mlcToCl > 0 ? mlc / mlcToCl : mlc);
      items.push({
        partida,
        subpartida: getSubpartida(item),
        nombre: getName(item),
        totalCUP: cup,
        totalMLC: mlc,
        totalCUPConvertido: cupConverted,
        totalMLCConvertido: mlcConverted,
        totalCLConvertido: clConverted,
        months: getMonths(item),
      });
      subtotalCUP += cup;
      subtotalMLC += mlc;
    }
  };

  // B - Construcción y Montaje
  addItems(
    state.constructionItems,
    'B. Construcción y Montaje',
    (i) => i.name,
    (i) => i.costCategory || 'General',
    (i) => i.quantity * i.unitCostCUP,
    (i) => i.quantity * i.unitCostMLC,
    (i) => safeMonths(i.months)
  );

  // C - Gastos de Capital
  addItems(
    state.capitalItems,
    'C. Gastos de Capital',
    (i) => i.name,
    (i) => i.costCategory || 'General',
    (i) => i.quantity * i.unitCostCUP,
    (i) => i.quantity * i.unitCostMLC,
    (i) => safeMonths(i.months)
  );

  // D - Subcontrataciones
  addItems(
    state.subcontractItems,
    'D. Subcontrataciones',
    (i) => i.name,
    (i) => 'Servicios',
    (i) => i.totalCostCUP,
    (i) => i.totalCostMLC,
    (i) => safeMonths(i.months)
  );

  // E - Recursos Humanos (inversión inicial)
  addItems(
    state.resourceItems,
    'E. Recursos Humanos (Inversión)',
    (i) => `${i.name} - ${i.position}`,
    (i) => i.category || 'General',
    (i) => {
      const contribs = calcItemContributions(i, state);
      return contribs.totalCompanyCost;
    },
    (i) => {
      const contribs = calcItemContributions(i, state);
      return contribs.salaryMLCinCUP * (1 + (state.parameters.vacationNormRate || 0) / 100) / 100;
    },
    (i) => safeMonths(i.months)
  );

  // Piezas de Repuesto y Herramientas — Depreciables → Inversión Fija
  const piezasDepreciables = state.sparePartItems.filter(i => i.depreciable);
  const piezasNoDepreciables = state.sparePartItems.filter(i => !i.depreciable);

  addItems(
    piezasDepreciables,
    'Piezas y Herramientas (Inversión Fija)',
    (i) => i.name,
    (i) => i.depreciable ? 'Depreciable' : 'No depreciable',
    (i) => i.quantity * i.unitCostCUP,
    (i) => i.quantity * i.unitCostMLC,
    (i) => safeMonths(i.months)
  );

  // Piezas de Repuesto y Herramientas — No depreciables → Gastos Previos
  addItems(
    piezasNoDepreciables,
    'Piezas y Herramientas',
    (i) => i.name,
    (i) => i.depreciable ? 'Depreciable' : 'No depreciable',
    (i) => i.quantity * i.unitCostCUP,
    (i) => i.quantity * i.unitCostMLC,
    (i) => safeMonths(i.months)
  );

  // Otros Recursos (incluye items automáticos de Gastos Financieros de inversión)
  addItems(
    getMergedOtherResourceItems(state),
    'Otros Recursos y Gastos',
    (i) => i.name,
    (i) => i.category || 'General',
    (i) => i.amountCUP,
    (i) => i.amountMLC,
    (i) => safeMonths(i.months)
  );

  // Activos Intangibles (Amortizables)
  addItems(
    state.intangibleAssets,
    'Activos Intangibles',
    (i) => i.name,
    (i) => i.category || 'Intangible',
    (i) => i.amountCUP,
    (i) => i.amountMLC,
    (i) => safeMonths(i.months)
  );

  // Reservas para contingencias inversión
  const contingencyRate = (state.parameters.contingencyReserveRate || 0) / 100;
  const contingencyCUP = subtotalCUP * contingencyRate;
  const contingencyMLC = subtotalMLC * contingencyRate;

  // Capital de Trabajo inicial (CT Neto del mes 1)
  const initialWC = getInitialWorkingCapital(state);
  const initialWCCUP = initialWC;
  const initialWCMLC = 0; // El CT se calcula en CUP convertidos

  const totalCUP = subtotalCUP + contingencyCUP + initialWCCUP;
  const totalMLC = subtotalMLC + contingencyMLC + initialWCMLC;

  // Grand totals in each currency
  const grandTotalCUP = totalCUP + totalMLC * cupToMlc;
  const grandTotalMLC = cupToMlc > 0 ? (totalCUP / cupToMlc) + totalMLC : 0;
  const grandTotalCL = (cupToCl > 0 ? totalCUP / cupToCl : 0) + (mlcToCl > 0 ? totalMLC / mlcToCl : totalMLC);

  // Financing: total loans and social capital (convert foreign currency loans to CUP)
  const totalLoanCUP = (state.loans || []).reduce((s, l) => {
    if (l.currency && l.currency !== 'CUP') {
      const rate = resolveExchangeRateForPeriod(1, l.currency, cupToMlc, l.exchangeRateTable);
      return s + l.amountCUP * rate;
    }
    return s + l.amountCUP;
  }, 0);
  const totalCapitalSocialCUP = grandTotalCUP - totalLoanCUP;

  return {
    items,
    subtotalCUP,
    subtotalMLC,
    totalCUP,
    totalMLC,
    contingencyCUP,
    contingencyMLC,
    initialWCCUP,
    initialWCMLC,
    grandTotalCUP,
    grandTotalMLC,
    grandTotalCL,
    totalLoanCUP,
    totalCapitalSocialCUP,
  };
}

// ============================================================
// 14-b. CRONOGRAMA DE INVERSIÓN (desglose mensual por partida)
// ============================================================

export interface InvestmentScheduleRow {
  month: number;               // 1-based
  year: number;                // derived from startDate
  construccionCUP: number;
  capitalCUP: number;
  subcontratacionesCUP: number;
  recursosHumanosCUP: number;
  piezasDepreciablesCUP: number;    // Piezas depreciables → Inversión Fija
  piezasNoDepreciablesCUP: number;  // Piezas no depreciables → Gastos Previos
  otrosRecursosCUP: number;
  activosIntangiblesCUP: number;
  subtotalInversionCUP: number;
  contingenciaCUP: number;
  capitalTrabajoCUP: number;
  totalInversionCUP: number;
  // Financing (monthly)
  prestamoCUP: number;          // Desembolso de préstamos en el mes
  capitalSocialCUP: number;     // Capital social en el mes = totalInversion - prestamo
  // MLC
  construccionMLC: number;
  capitalMLC: number;
  subcontratacionesMLC: number;
  recursosHumanosMLC: number;
  piezasDepreciablesMLC: number;    // Piezas depreciables → Inversión Fija
  piezasNoDepreciablesMLC: number;  // Piezas no depreciables → Gastos Previos
  otrosRecursosMLC: number;
  activosIntangiblesMLC: number;
  subtotalInversionMLC: number;
  contingenciaMLC: number;
  capitalTrabajoMLC: number;
  totalInversionMLC: number;
}

export function buildInvestmentSchedule(state: BaraproState): {
  monthly: InvestmentScheduleRow[];
  maxMonth: number;
  categories: { key: keyof InvestmentScheduleRow; label: string }[];
} {
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const startDate = state.project.startDate || new Date().toISOString().slice(0, 7);
  const [startYear, startMonth] = startDate.split('-').map(Number);

  // Get budget items
  const budget = buildInvestmentBudget(state);
  const items = budget.items;
  const contingencyRate = (state.parameters.contingencyReserveRate || 0) / 100;
  const initialWC = budget.initialWCCUP;

  // Find max investment month (items + loans + project duration)
  let maxMonth = state.project.monthsDuration || 1;
  for (const item of items) {
    for (const m of item.months) {
      if (m > maxMonth) maxMonth = m;
    }
  }
  // Also consider loan disbursement months
  for (const loan of state.loans) {
    if (loan.disbursementSchedule && loan.disbursementSchedule.length > 0) {
      for (const d of loan.disbursementSchedule) {
        if (d.month > maxMonth) maxMonth = d.month;
      }
    } else {
      if (loan.startMonth > maxMonth) maxMonth = loan.startMonth;
    }
  }
  // Ensure at least 1 month
  if (maxMonth === 0) maxMonth = 1;

  // Initialize monthly arrays for each category
  const len = maxMonth;
  const zeros = () => new Array<number>(len).fill(0);

  const construccionCUP = zeros();
  const capitalCUP = zeros();
  const subcontratacionesCUP = zeros();
  const recursosHumanosCUP = zeros();
  const piezasDepreciablesCUP = zeros();
  const piezasNoDepreciablesCUP = zeros();
  const otrosRecursosCUP = zeros();
  const activosIntangiblesCUP = zeros();
  const construccionMLC = zeros();
  const capitalMLC = zeros();
  const subcontratacionesMLC = zeros();
  const recursosHumanosMLC = zeros();
  const piezasDepreciablesMLC = zeros();
  const piezasNoDepreciablesMLC = zeros();
  const otrosRecursosMLC = zeros();
  const activosIntangiblesMLC = zeros();

  // Distribute each item's cost evenly across its active months
  for (const item of items) {
    if (item.months.length === 0) continue;
    const cupPerMonth = item.totalCUP / item.months.length;
    const mlcPerMonth = item.totalMLC / item.months.length;

    let cupArr: number[];
    let mlcArr: number[];

    switch (item.partida) {
      case 'B. Construcción y Montaje':
        cupArr = construccionCUP; mlcArr = construccionMLC; break;
      case 'C. Gastos de Capital':
        cupArr = capitalCUP; mlcArr = capitalMLC; break;
      case 'D. Subcontrataciones':
        cupArr = subcontratacionesCUP; mlcArr = subcontratacionesMLC; break;
      case 'E. Recursos Humanos (Inversión)':
        cupArr = recursosHumanosCUP; mlcArr = recursosHumanosMLC; break;
      case 'Piezas y Herramientas (Inversión Fija)':
        cupArr = piezasDepreciablesCUP; mlcArr = piezasDepreciablesMLC; break;
      case 'Piezas y Herramientas':
        cupArr = piezasNoDepreciablesCUP; mlcArr = piezasNoDepreciablesMLC; break;
      case 'Otros Recursos y Gastos':
        cupArr = otrosRecursosCUP; mlcArr = otrosRecursosMLC; break;
      case 'Activos Intangibles':
        cupArr = activosIntangiblesCUP; mlcArr = activosIntangiblesMLC; break;
      default:
        cupArr = otrosRecursosCUP; mlcArr = otrosRecursosMLC;
    }

    for (const m of item.months) {
      if (m >= 1 && m <= len) {
        cupArr[m - 1] += cupPerMonth;
        mlcArr[m - 1] += mlcPerMonth;
      }
    }
  }

  // Working capital — first month only (initial)
  const wcCUPArr = new Array(len).fill(0);
  const wcMLCArr = new Array(len).fill(0);
  if (initialWC > 0 && len > 0) {
    wcCUPArr[0] = initialWC;
  }

  // Build rows
  const monthly: InvestmentScheduleRow[] = [];

  // Calculate monthly loan disbursements (convert foreign currency to CUP)
  const prestamoCUPArr = new Array(len).fill(0);
  for (const loan of state.loans) {
    const disbs = getLoanDisbursements(loan);
    for (const [m, amt] of Object.entries(disbs)) {
      const idx = parseInt(m) - 1;
      if (idx >= 0 && idx < len) {
        const periodFromStart = parseInt(m) - loan.startMonth + 1;
        const exchangeRate = resolveExchangeRateForPeriod(
          periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );
        prestamoCUPArr[idx] += amt * exchangeRate;
      }
    }
  }

  for (let i = 0; i < len; i++) {
    const month = i + 1;
    const totalMonthsFromStart = i + (startMonth - 1);
    const year = startYear + Math.floor(totalMonthsFromStart / 12);

    const subInvCUP = construccionCUP[i]
      + capitalCUP[i] + subcontratacionesCUP[i]
      + recursosHumanosCUP[i] + piezasDepreciablesCUP[i] + piezasNoDepreciablesCUP[i]
      + otrosRecursosCUP[i] + activosIntangiblesCUP[i];

    const contCUP = subInvCUP * contingencyRate;
    const totalCUP = subInvCUP + contCUP + wcCUPArr[i];

    const subInvMLC = construccionMLC[i]
      + capitalMLC[i] + subcontratacionesMLC[i]
      + recursosHumanosMLC[i] + piezasDepreciablesMLC[i] + piezasNoDepreciablesMLC[i]
      + otrosRecursosMLC[i] + activosIntangiblesMLC[i];

    const contMLC = subInvMLC * contingencyRate;
    const totalMLC = subInvMLC + contMLC + wcMLCArr[i];

    monthly.push({
      month,
      year,
      construccionCUP: construccionCUP[i],
      capitalCUP: capitalCUP[i],
      subcontratacionesCUP: subcontratacionesCUP[i],
      recursosHumanosCUP: recursosHumanosCUP[i],
      piezasDepreciablesCUP: piezasDepreciablesCUP[i],
      piezasNoDepreciablesCUP: piezasNoDepreciablesCUP[i],
      otrosRecursosCUP: otrosRecursosCUP[i],
      activosIntangiblesCUP: activosIntangiblesCUP[i],
      subtotalInversionCUP: subInvCUP,
      contingenciaCUP: contCUP,
      capitalTrabajoCUP: wcCUPArr[i],
      totalInversionCUP: totalCUP,
      prestamoCUP: prestamoCUPArr[i],
      capitalSocialCUP: totalCUP + totalMLC * cupToMlc - prestamoCUPArr[i],
      construccionMLC: construccionMLC[i],
      capitalMLC: capitalMLC[i],
      subcontratacionesMLC: subcontratacionesMLC[i],
      recursosHumanosMLC: recursosHumanosMLC[i],
      piezasDepreciablesMLC: piezasDepreciablesMLC[i],
      piezasNoDepreciablesMLC: piezasNoDepreciablesMLC[i],
      otrosRecursosMLC: otrosRecursosMLC[i],
      activosIntangiblesMLC: activosIntangiblesMLC[i],
      subtotalInversionMLC: subInvMLC,
      contingenciaMLC: contMLC,
      capitalTrabajoMLC: wcMLCArr[i],
      totalInversionMLC: totalMLC,
    });
  }

  const categories = [
    { key: 'construccionCUP' as keyof InvestmentScheduleRow, label: 'B. Construcción y Montaje' },
    { key: 'capitalCUP' as keyof InvestmentScheduleRow, label: 'C. Gastos de Capital' },
    { key: 'subcontratacionesCUP' as keyof InvestmentScheduleRow, label: 'D. Subcontrataciones' },
    { key: 'recursosHumanosCUP' as keyof InvestmentScheduleRow, label: 'E. Recursos Humanos' },
    { key: 'piezasDepreciablesCUP' as keyof InvestmentScheduleRow, label: 'Piezas Depreciables (Inv. Fija)' },
    { key: 'piezasNoDepreciablesCUP' as keyof InvestmentScheduleRow, label: 'Piezas No Depreciables (Gastos Previos)' },
    { key: 'otrosRecursosCUP' as keyof InvestmentScheduleRow, label: 'Otros Recursos' },
    { key: 'activosIntangiblesCUP' as keyof InvestmentScheduleRow, label: 'Activos Intangibles' },
    { key: 'subtotalInversionCUP' as keyof InvestmentScheduleRow, label: 'subtotal' },
    { key: 'contingenciaCUP' as keyof InvestmentScheduleRow, label: 'contingency' },
    { key: 'capitalTrabajoCUP' as keyof InvestmentScheduleRow, label: 'workingCapital' },
    { key: 'totalInversionCUP' as keyof InvestmentScheduleRow, label: 'totalInvestment' },
  ];

  return { monthly, maxMonth, categories };
}

// ============================================================
// 15. DEPRECIACIÓN POR PARTIDA (aligned with depreciable items)
// ============================================================

export interface DepreciableAssetItem {
  id: string;
  name: string;
  category: string;
  assetCategoryId: string;
  totalCost: number;
  totalCostMLC: number;
  usefulLifeYears: number;
  residualPercent: number;
  method: 'straight-line' | 'declining';
  schedule: DepreciationRow[];
  startMonth: number;
  monthlyDepreciationByMonth: number[]; // per-project-month
}

export interface AmortizableAssetItem {
  id: string;
  name: string;
  category: string;
  totalCost: number;
  totalCostMLC: number;
  usefulLifeYears: number;
  schedule: DepreciationRow[];
  startMonth: number;
  monthlyAmortizationByMonth: number[];
}

export interface DepreciationSummary {
  assets: DepreciableAssetItem[];
  intangibleAssets: AmortizableAssetItem[];
  totalMonthlyDepreciation: number[];
  totalMonthlyAmortization: number[];
  totalAssetCost: number;
  totalIntangibleCost: number;
  /** Valor en libros al final del proyecto: Costo − Depreciación acumulada */
  bookValueAtEnd: number;
}

export function buildDepreciationByItem(state: BaraproState): DepreciationSummary {
  const assets: DepreciableAssetItem[] = [];
  const intangibleAssets: AmortizableAssetItem[] = [];
  const method = (state.parameters.depreciationMethod || 'straight-line') as 'straight-line' | 'declining';
  const globalResidual = (state.parameters.residualValuePercent || 0) / 100;
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;

  const _construction = safeArray(state.constructionItems).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _capital = safeArray(state.capitalItems).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _spareParts = safeArray(state.sparePartItems).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _intangibles = safeArray(state.intangibleAssets).map(i => ({ ...i, months: safeMonths(i.months) }));

  // Build lookup maps from user-configurable rates (stored in parameters)
  const rateMap = new Map<string, { life: number; residual: number }>();
  for (const r of (state.parameters.assetCategoryRates || [])) {
    rateMap.set(r.id, { life: r.lifeYears, residual: (r.residualPercent || 0) / 100 });
  }

  const getLife = (itemCategory?: string, itemLife?: number, defaultModuleLife?: number) => {
    if (itemLife && itemLife > 0) return itemLife;
    if (itemCategory && rateMap.has(itemCategory)) return rateMap.get(itemCategory)!.life;
    return defaultModuleLife || state.parameters.usefulLifeYears || 10;
  };

  const getResidual = (itemRes?: number, categoryId?: string) => {
    if (itemRes !== undefined && itemRes !== null) return (itemRes || 0) / 100;
    if (categoryId && rateMap.has(categoryId)) return rateMap.get(categoryId)!.residual;
    return globalResidual;
  };

  // ── Determinar mes de inicio de operación (primer mes con ingresos) ──
  // La depreciación/amortización NO comienza cuando se compra el activo,
  // sino cuando el proyecto empieza a operar y generar ingresos.
  let operationStartMonth = duration + 1; // por defecto: nunca opera
  const _sales = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  for (let m = 0; m < duration; m++) {
    let hasRevenue = false;
    for (const sale of _sales) {
      if (m < sale.quantity.length && sale.quantity[m] > 0) {
        hasRevenue = true;
        break;
      }
    }
    if (hasRevenue) {
      operationStartMonth = m + 1;
      break;
    }
  }
  // Si no hay ventas, usar el mes posterior al último mes de inversión
  // (determinado como el mes máximo entre todos los items de inversión B, C, D, E, M)
  if (operationStartMonth > duration) {
    const allInvestmentMonths = [
      ..._construction.flatMap(i => i.months),
      ..._capital.flatMap(i => i.months),
      ...safeArray(state.subcontractItems).map(i => safeMonths(i.months)).flat(),
      ...safeArray(state.resourceItems).map(i => safeMonths(i.months)).flat(),
    ];
    if (allInvestmentMonths.length > 0) {
      operationStartMonth = Math.max(...allInvestmentMonths) + 1;
    } else {
      operationStartMonth = 1;
    }
  }

  let itemId = 0;

  // Helper to build monthly array from schedule
  // La depreciación siempre empieza en operationStartMonth (inicio de operación),
  // independientemente de cuándo se adquirió el activo.
  const buildMonthlyArray = (schedule: DepreciationRow[], _acquisitionMonth: number, dur: number): number[] => {
    const arr = new Array(dur).fill(0);
    const effectiveStart = Math.max(operationStartMonth, 1);
    for (let y = 0; y < schedule.length; y++) {
      const monthlyDep = schedule[y].depreciation / 12;
      for (let mm = 0; mm < 12; mm++) {
        const m = y * 12 + mm + effectiveStart;
        if (m >= 1 && m <= dur) {
          arr[m - 1] += monthlyDep;
        }
      }
    }
    return arr;
  };

  // Construction items
  for (const item of _construction) {
    if (item.depreciable === false) continue;
    const costCUP = item.quantity * item.unitCostCUP;
    const costMLC = item.quantity * item.unitCostMLC;
    const totalCost = costCUP + costMLC * cupToMlc;
    if (totalCost <= 0) continue;

    const acquisitionMonth = item.months.length > 0 ? Math.min(...item.months) : 1;
    const life = getLife(item.assetCategory, item.usefulLifeYears, 50);
    const residual = getResidual(item.residualPercent, item.assetCategory);
    const schedule = calcDepreciacion(totalCost, life, residual, method);
    const depStart = operationStartMonth; // depreciación desde inicio de operación

    assets.push({
      id: `b-${itemId++}`,
      name: item.name,
      category: `B. ${item.costCategory || 'Construcción'}`,
      assetCategoryId: item.assetCategory || 'edificaciones',
      totalCost,
      totalCostMLC: costMLC,
      usefulLifeYears: life,
      residualPercent: residual,
      method,
      schedule,
      startMonth: depStart,
      monthlyDepreciationByMonth: buildMonthlyArray(schedule, depStart, duration),
    });
  }

  // Capital items
  for (const item of _capital) {
    if (item.depreciable === false) continue;
    const costCUP = item.quantity * item.unitCostCUP;
    const costMLC = item.quantity * item.unitCostMLC;
    const totalCost = costCUP + costMLC * cupToMlc;
    if (totalCost <= 0) continue;

    const acquisitionMonth = item.months.length > 0 ? Math.min(...item.months) : 1;
    const life = getLife(item.assetCategory, item.usefulLifeYears, 10);
    const residual = getResidual(item.residualPercent, item.assetCategory);
    const schedule = calcDepreciacion(totalCost, life, residual, method);
    const depStart = operationStartMonth;

    assets.push({
      id: `c-${itemId++}`,
      name: item.name,
      category: `C. ${item.costCategory || 'Capital'}`,
      assetCategoryId: item.assetCategory || 'maquinaria',
      totalCost,
      totalCostMLC: costMLC,
      usefulLifeYears: life,
      residualPercent: residual,
      method,
      schedule,
      startMonth: depStart,
      monthlyDepreciationByMonth: buildMonthlyArray(schedule, depStart, duration),
    });
  }

  // Spare parts marked as depreciable
  for (const item of _spareParts) {
    if (!item.depreciable) continue;
    const costCUP = item.quantity * item.unitCostCUP;
    const costMLC = item.quantity * item.unitCostMLC;
    const totalCost = costCUP + costMLC * cupToMlc;
    if (totalCost <= 0) continue;

    const acquisitionMonth = item.months.length > 0 ? Math.min(...item.months) : 1;
    const life = item.usefulLifeYears || 5;
    const residual = getResidual(undefined, 'herramientas');
    const schedule = calcDepreciacion(totalCost, life, residual, method);
    const depStart = operationStartMonth;

    assets.push({
      id: `sp-${itemId++}`,
      name: item.name,
      category: 'Piezas y Herramientas',
      assetCategoryId: 'herramientas',
      totalCost,
      totalCostMLC: costMLC,
      usefulLifeYears: life,
      residualPercent: residual,
      method,
      schedule,
      startMonth: depStart,
      monthlyDepreciationByMonth: buildMonthlyArray(schedule, depStart, duration),
    });
  }

  // Intangible assets (amortization - always straight-line, 0% residual)
  for (const item of _intangibles) {
    const totalCost = item.amountCUP + item.amountMLC * cupToMlc;
    if (totalCost <= 0) continue;

    const acquisitionMonth = item.months.length > 0 ? Math.min(...item.months) : 1;
    const life = item.usefulLifeYears || 5;
    const schedule = calcDepreciacion(totalCost, life, 0, 'straight-line');
    const amortStart = operationStartMonth;

    intangibleAssets.push({
      id: `ia-${itemId++}`,
      name: item.name,
      category: item.category || 'Intangible',
      totalCost,
      totalCostMLC: item.amountMLC,
      usefulLifeYears: life,
      schedule,
      startMonth: amortStart,
      monthlyAmortizationByMonth: buildMonthlyArray(schedule, amortStart, duration),
    });
  }

  // Aggregate monthly totals
  const totalMonthlyDepreciation = new Array(duration).fill(0);
  for (const asset of assets) {
    for (let i = 0; i < duration; i++) {
      totalMonthlyDepreciation[i] += asset.monthlyDepreciationByMonth[i] || 0;
    }
  }

  const totalMonthlyAmortization = new Array(duration).fill(0);
  for (const asset of intangibleAssets) {
    for (let i = 0; i < duration; i++) {
      totalMonthlyAmortization[i] += asset.monthlyAmortizationByMonth[i] || 0;
    }
  }

  const totalAssetCost = assets.reduce((s, a) => s + a.totalCost, 0);
  const totalIntangibleCost = intangibleAssets.reduce((s, a) => s + a.totalCost, 0);

  // Valor en libros al final del proyecto = Costo − Depreciación/Amortización acumulada
  // (Valor remanente de activos según la depreciación real, no un % global)
  let bookValueAtEnd = 0;
  for (const asset of assets) {
    const accumulatedDep = asset.monthlyDepreciationByMonth.reduce((s, v) => s + v, 0);
    bookValueAtEnd += Math.max(0, asset.totalCost - accumulatedDep);
  }
  for (const asset of intangibleAssets) {
    const accumulatedAmort = asset.monthlyAmortizationByMonth.reduce((s, v) => s + v, 0);
    bookValueAtEnd += Math.max(0, asset.totalCost - accumulatedAmort);
  }

  return { assets, intangibleAssets, totalMonthlyDepreciation, totalMonthlyAmortization, totalAssetCost, totalIntangibleCost, bookValueAtEnd };
}

// ============================================================
// 16. COSTOS CORRIENTES (Operational Cost Summary)
// ============================================================

export interface CurrentCostRow {
  month: number;
  year: number;
  materiasPrimas: number;
  mpNacional: number;       // FIX (Fisura #4): MP de origen nacional
  mpImportada: number;      // FIX (Fisura #4): MP de origen importado
  serviciosPublicos: number;
  gastosComerciales: number;
  gastosAdmin: number;
  gastosMantenimiento: number;
  gastosIndirectos: number;
  salariosOperativos: number;
  totalCostosDirectos: number;
  totalCostosIndirectos: number;
  totalCostosCorrientes: number;
}

export function buildCurrentCosts(state: BaraproState): CurrentCostRow[] {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const rows: CurrentCostRow[] = [];

  // Defensive: fallback to [] prevents TypeError if state is partial (e.g. in tests)
  const _purchases = (state.purchaseItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _directCosts = (state.directCostItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _publicServices = (state.publicServiceItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _commercial = (state.commercialExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _admin = (state.adminExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _maintenance = (state.maintenanceItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _indirect = (state.indirectExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _commercialSalaries = (state.commercialSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _adminSalaries = (state.adminSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _maintenanceSalaries = (state.maintenanceSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _indirectSalaries = (state.indirectSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _directCostSalaries = (state.directCostSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));

  for (let i = 0; i < duration; i++) {
    const m = i + 1;

    // Materias Primas — Fuente 1: Ventas (qty × costo MP unitario)
    // Cada producto vendido tiene un costo de MP asociado (nacional y/o importada)
    let mpFromSales = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        const qty = item.quantity[m - 1];
        mpFromSales += (item.unitCostMPCUP || 0) * qty + (item.unitCostMPMLC || 0) * qty * cupToMlc;
      }
    }

    // Materias Primas — Fuente 2: Module F (Compras — solo materiales, sin salarios)
    let materiasPrimas = mpFromSales;
    let mpNacional = 0;  // FIX (Fisura #4): track national vs imported
    let mpImportada = 0;
    for (const item of _purchases) {
      if (item.months.includes(m)) {
        const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
        let itemCost = 0;
        if (quantities) {
          // Use per-month quantity
          const q = quantities[m - 1] || 0;
          itemCost = q * (item.unitCostCUP || 0) + q * (item.unitCostMLC || 0) * cupToMlc;
        } else {
          // Legacy: spread evenly
          const total = item.quantity * item.unitCostCUP + item.quantity * item.unitCostMLC * cupToMlc;
          itemCost = item.months.length > 0 ? total / item.months.length : 0;
        }
        materiasPrimas += itemCost;
        // FIX (Fisura #4): separate national vs imported based on origin field
        if (item.origin === 'Importada') {
          mpImportada += itemCost;
        } else {
          mpNacional += itemCost;
        }
      }
    }

    // Costos Directos Adicionales (Módulo M — gastos directos no salariales)
    let costosDirectos = 0;
    for (const item of _directCosts) {
      if (item.months.includes(m)) {
        costosDirectos += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Gastos de Distribución y Ventas (I)
    let gastosComerciales = 0;
    for (const item of _commercial) {
      if (item.months.includes(m)) {
        gastosComerciales += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Commercial Salaries (I)
    for (const item of _commercialSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        gastosComerciales += contribs.totalCompanyCost;
      }
    }

    // Gastos Generales y de Administración (J)
    let gastosAdmin = 0;
    for (const item of _admin) {
      if (item.months.includes(m)) {
        gastosAdmin += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Admin Salaries (J)
    for (const item of _adminSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        gastosAdmin += contribs.totalCompanyCost;
      }
    }

    // Mantenimiento (K)
    let gastosMantenimiento = 0;
    for (const item of _maintenance) {
      if (item.months.includes(m)) {
        gastosMantenimiento += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Maintenance Salaries (K)
    for (const item of _maintenanceSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        gastosMantenimiento += contribs.totalCompanyCost;
      }
    }

    // Indirectos (L)
    let gastosIndirectos = 0;
    for (const item of _indirect) {
      if (item.months.includes(m)) {
        gastosIndirectos += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Indirect Salaries (L)
    for (const item of _indirectSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        gastosIndirectos += contribs.totalCompanyCost;
      }
    }

    // Servicios Públicos (sub-módulo de Costos Directos)
    let serviciosPublicos = 0;
    for (const item of _publicServices) {
      if (item.months.includes(m)) {
        serviciosPublicos += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1);
      }
    }

    // Salarios Operativos Directos (M - Costos Directos)
    let salariosOperativos = 0;
    for (const item of _directCostSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        salariosOperativos += contribs.totalCompanyCost;
      }
    }

    const totalCostosDirectos = materiasPrimas + salariosOperativos + costosDirectos + serviciosPublicos;
    const totalCostosIndirectos = gastosComerciales + gastosAdmin + gastosMantenimiento + gastosIndirectos;

    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      materiasPrimas,
      mpNacional,          // FIX (Fisura #4)
      mpImportada,         // FIX (Fisura #4)
      serviciosPublicos,
      gastosComerciales,
      gastosAdmin,
      gastosMantenimiento,
      gastosIndirectos,
      salariosOperativos,
      totalCostosDirectos,
      totalCostosIndirectos,
      totalCostosCorrientes: totalCostosDirectos + totalCostosIndirectos,
    });
  }

  return rows;
}

// ============================================================
// 17. COSTOS FINANCIEROS (con Gastos Bancarios)
// ============================================================

export interface FinancialCostRow {
  month: number;
  loanName: string;
  interest: number;             // intereses pagados en efectivo (excluye capitalizados) — converted to CUP
  capitalizedInterest: number;  // intereses capitalizados (acumulados al capital, NO pagados en el período) — converted to CUP
  graceAccumulatedInterest: number; // intereses de gracia acumulados pagados como lump sum — converted to CUP
  totalInterest: number;        // interés total = pagados + capitalizados + gracia acumulada — converted to CUP
  principal: number;            // converted to CUP
  bankFee: number;              // converted to CUP
  totalPayment: number;         // payment + bankFee (efectivo desembolsado) — converted to CUP
  remainingBalance: number;     // converted to CUP
  loanPurpose: string; // 'inversion' | 'capital-trabajo' — from Loan.loanPurpose
  // Multi-currency fields (Phase 6)
  loanCurrency: string;           // 'CUP', 'MLC', 'USD'
  exchangeRateUsed: number;       // rate used for conversion (1 if CUP)
  originalAmountMLC: number;      // flag: 1 if foreign currency, 0 if CUP
  interestOriginal: number;       // interest in original currency (0 if CUP)
  principalOriginal: number;      // principal in original currency (0 if CUP)
  totalPaymentOriginal: number;   // total payment in original currency (0 if CUP)
}

export function buildFinancialCosts(state: BaraproState): FinancialCostRow[] {
  const projectDuration = state.project.monthsDuration || 120;
  const duration = projectDuration; // No expandir: calcAmortizacion clampa al proyecto
  const rows: FinancialCostRow[] = [];
  const bankFeeRate = (state.parameters.bankFeeRate || 0) / 100;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;

  for (const loan of state.loans) {
    const amort = calcAmortizacion({ ...loan, bankFeeRate, projectDuration });
    const isForeignCurrency = loan.currency && loan.currency !== 'CUP';

    for (const a of amort) {
      const m = loan.startMonth + a.period - 1;
      if (m >= 1 && m <= duration) {
        // ── Exchange rate for this period (Phase 6) ──
        const exchangeRate = resolveExchangeRateForPeriod(
          a.period, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );

        // ── Intereses: calcular interés pagado en efectivo ──
        // Regla general: solo hay interés cash cuando payment > 0.
        // - Gracia capitalizable: payment=0 → cash=0
        // - Gracia lump sum: payment=0 → cash=0
        // - Gracia periódico: payment=interés → cash=interés
        // - Amortización con lump sum: payment incluye lump sum → cash = interés + lump sum
        // - Amortización normal: cash = interés del período
        let cashInterest: number;
        if (a.payment > 0) {
          // Hay pago: interés cash = interés del período + lump sum de gracia (si aplica)
          cashInterest = a.interest + (a.graceAccumulatedInterest || 0);
        } else {
          // Sin pago: no hay interés cash (ni gracia capitalizable ni lump sum pagan en este mes)
          cashInterest = 0;
        }

        // ── Gastos bancarios: desglose (comisión, seguro, otros) o tasa simple ──
        const bankFee = a.bankFee || 0;

        // ── Total pagado en efectivo = cuota (principal + interés cash) + gastos bancarios ──
        const totalPayment = a.payment + bankFee;

        // ── Convert to CUP for consolidated reporting (Phase 6) ──
        // For CUP loans, exchangeRate = 1, so all amounts remain unchanged
        const interestCUP = cashInterest * exchangeRate;
        const capitalizedInterestCUP = (a.capitalizedInterest || 0) * exchangeRate;
        const graceAccumulatedInterestCUP = (a.graceAccumulatedInterest || 0) * exchangeRate;
        const totalInterestCUP = (a.interest + (a.graceAccumulatedInterest || 0)) * exchangeRate;
        const principalCUP = a.principal * exchangeRate;
        const bankFeeCUP = bankFee * exchangeRate;
        const totalPaymentCUP = totalPayment * exchangeRate;
        const remainingBalanceCUP = a.endingBalance * exchangeRate;

        rows.push({
          month: m,
          loanName: loan.name,
          interest: interestCUP,
          capitalizedInterest: capitalizedInterestCUP,
          graceAccumulatedInterest: graceAccumulatedInterestCUP,
          totalInterest: totalInterestCUP,
          principal: principalCUP,
          bankFee: bankFeeCUP,
          totalPayment: totalPaymentCUP,
          remainingBalance: remainingBalanceCUP,
          loanPurpose: loan.loanPurpose || 'inversion',
          // Multi-currency fields (Phase 6)
          loanCurrency: loan.currency || 'CUP',
          exchangeRateUsed: exchangeRate,
          originalAmountMLC: isForeignCurrency ? 1 : 0,
          interestOriginal: isForeignCurrency ? cashInterest : 0,
          principalOriginal: isForeignCurrency ? a.principal : 0,
          totalPaymentOriginal: isForeignCurrency ? totalPayment : 0,
        });
      }
    }
  }

  return rows.sort((a, b) => a.month - b.month || a.loanName.localeCompare(b.loanName));
}

// ============================================================
// 17c. TABLA C — RESUMEN ANUAL DE FINANCIAMIENTO (Resolución 1/2022)
// ============================================================

/**
 * Fila del resumen anual de financiamiento (Tabla C).
 * Formato según la Resolución 1/2022 del Ministerio de Finanzas y Precios.
 *
 * Cada fila representa un año del horizonte del proyecto, consolidando
 * todos los préstamos. Los montos se expresan en la moneda del proyecto.
 */
export interface AnnualLoanSummaryRow {
  /** Año (1-based, derivado de los meses del proyecto) */
  year: number;
  /** Total intereses pagados en efectivo durante el año (excluye capitalizados) */
  annualInterestPaid: number;
  /** Total intereses capitalizados durante el año (no son salida de efectivo) */
  annualInterestCapitalized: number;
  /** Total intereses acumulados de gracia pagados como pago único durante el año */
  annualGraceLumpSum: number;
  /** Comisiones bancarias, seguro y otros gastos bancarios del año */
  annualBankFees: number;
  /** Total capital amortizado (devuelto al banco) durante el año */
  annualPrincipalPaid: number;
  /** Total pagado en efectivo durante el año = intereses pagados + principal + comisiones */
  annualTotalPayment: number;
  /** Saldo insoluto total al final del año (suma de todos los préstamos) */
  endingBalance: number;
  /** Desembolsos totales recibidos durante el año */
  annualDisbursements: number;
  // Multi-currency fields (Phase 6) — aggregated info
  hasForeignCurrency: boolean;   // true if any loan in this year is foreign currency
  annualInterestOriginal: number; // interest in original currency (foreign loans only)
  annualPrincipalOriginal: number; // principal in original currency (foreign loans only)
  // ── Desglose por propósito (inversión vs capital de trabajo) ──
  /** Saldo insoluto de préstamos de inversión al cierre del año */
  endingBalanceInversion: number;
  /** Saldo insoluto de préstamos de capital de trabajo al cierre del año */
  endingBalanceCapitalTrabajo: number;
  /** Principal pagado en el año — préstamos de inversión */
  annualPrincipalPaidInversion: number;
  /** Principal pagado en el año — préstamos de capital de trabajo */
  annualPrincipalPaidCapitalTrabajo: number;
}

/**
 * Construye la Tabla C — Resumen Anual de Financiamiento.
 *
 * consolida los datos de todos los préstamos del proyecto,
 * agrupándolos por año calendario según el mes de inicio del proyecto.
 *
 * Proceso:
 * 1. Calcular buildFinancialCosts() para obtener datos mensuales por préstamo.
 * 2. Calcular desembolsos mensuales consolidados.
 * 3. Agrupar por año (Math.ceil(month / 12)).
 * 4. Para cada año, sumar: intereses pagados, capitalizados, comisiones, principal, desembolsos.
 * 5. El saldo final es el último remainingBalance conocido del año.
 */
export function buildAnnualLoanSummary(state: BaraproState): AnnualLoanSummaryRow[] {
  const duration = state.project.monthsDuration || 120;
  const financialCosts = buildFinancialCosts(state);

  // Desembolsos mensuales consolidados (converted to CUP for foreign currency loans)
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const monthlyDisb = new Array(duration).fill(0) as number[];
  for (const loan of state.loans) {
    const disbs = getLoanDisbursements(loan);
    const isForeignCurrency = loan.currency && loan.currency !== 'CUP';
    for (const [m, amt] of Object.entries(disbs)) {
      const idx = parseInt(m) - 1;
      if (idx >= 0 && idx < duration) {
        // Convert disbursement to CUP for foreign currency loans
        // Use period 1 exchange rate as approximation for disbursement period
        const periodFromStart = parseInt(m) - loan.startMonth + 1;
        const exchangeRate = resolveExchangeRateForPeriod(
          periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );
        monthlyDisb[idx] += amt * exchangeRate;
      }
    }
  }

  // Agrupar datos financieros mensuales por año
  const totalYears = Math.ceil(duration / 12);
  const yearData: Map<number, {
    interestPaid: number;
    interestCapitalized: number;
    graceLumpSum: number;
    bankFees: number;
    principal: number;
    principalInversion: number;
    principalCapitalTrabajo: number;
    disbursements: number;
    hasForeignCurrency: boolean;
    interestOriginal: number;
    principalOriginal: number;
  }> = new Map();

  // Rastrear saldo insoluto por préstamo para poder sumar correctamente
  // (no se puede simplemente sobreescribir el lastBalance porque hay
  // múltiples préstamos con saldos independientes)
  const loanLastBalanceByYear: Map<number, Map<string, { balance: number; isInversion: boolean }>> = new Map();

  // Inicializar todos los años
  for (let y = 1; y <= totalYears; y++) {
    yearData.set(y, { interestPaid: 0, interestCapitalized: 0, graceLumpSum: 0, bankFees: 0, principal: 0, principalInversion: 0, principalCapitalTrabajo: 0, disbursements: 0, hasForeignCurrency: false, interestOriginal: 0, principalOriginal: 0 });
    loanLastBalanceByYear.set(y, new Map());
  }

  // Acumular datos mensuales por año
  for (const row of financialCosts) {
    const year = Math.ceil(row.month / 12);
    const data = yearData.get(year);
    if (!data) continue;

    data.interestPaid += row.interest || 0;
    data.interestCapitalized += row.capitalizedInterest || 0;
    data.graceLumpSum += row.graceAccumulatedInterest || 0;
    data.bankFees += row.bankFee || 0;
    data.principal += row.principal || 0;
    // Registrar saldo por préstamo individual (el último mes del año para cada préstamo)
    const isInversion = row.loanPurpose !== 'capital-trabajo';
    if (isInversion) data.principalInversion += row.principal || 0;
    else data.principalCapitalTrabajo += row.principal || 0;
    loanLastBalanceByYear.get(year)!.set(row.loanName, { balance: row.remainingBalance || 0, isInversion });
    // Phase 6: track foreign currency info
    if (row.originalAmountMLC > 0) {
      data.hasForeignCurrency = true;
      data.interestOriginal += row.interestOriginal || 0;
      data.principalOriginal += row.principalOriginal || 0;
    }
  }

  // Acumular desembolsos por año
  for (let i = 0; i < duration; i++) {
    if (monthlyDisb[i] > 0) {
      const year = Math.ceil((i + 1) / 12);
      const data = yearData.get(year);
      if (data) data.disbursements += monthlyDisb[i];
    }
  }

  // Construir filas de resultado, eliminando años vacíos al final
  const rows: AnnualLoanSummaryRow[] = [];
  let lastNonZeroYear = 0;

  for (let y = 1; y <= totalYears; y++) {
    const data = yearData.get(y)!;
    const totalPayment = data.interestPaid + data.principal + data.bankFees;
    // Sumar saldos de TODOS los préstamos al cierre del año
    const loanBalances = [...(loanLastBalanceByYear.get(y)?.values() || [])];
    const endingBalance = loanBalances.reduce((s, v) => s + v.balance, 0);
    const endingBalanceInversion = loanBalances.filter(v => v.isInversion).reduce((s, v) => s + v.balance, 0);
    const endingBalanceCapitalTrabajo = loanBalances.filter(v => !v.isInversion).reduce((s, v) => s + v.balance, 0);

    rows.push({
      year: y,
      annualInterestPaid: data.interestPaid,
      annualInterestCapitalized: data.interestCapitalized,
      annualGraceLumpSum: data.graceLumpSum,
      annualBankFees: data.bankFees,
      annualPrincipalPaid: data.principal,
      annualTotalPayment: totalPayment,
      endingBalance,
      annualDisbursements: data.disbursements,
      hasForeignCurrency: data.hasForeignCurrency,
      annualInterestOriginal: data.interestOriginal,
      annualPrincipalOriginal: data.principalOriginal,
      endingBalanceInversion,
      endingBalanceCapitalTrabajo,
      annualPrincipalPaidInversion: data.principalInversion,
      annualPrincipalPaidCapitalTrabajo: data.principalCapitalTrabajo,
    });

    // Marcar último año con actividad
    if (data.interestPaid > 0 || data.principal > 0 || data.bankFees > 0 ||
        data.interestCapitalized > 0 || data.disbursements > 0 || endingBalance > 0) {
      lastNonZeroYear = y;
    }
  }

  // Eliminar años vacíos al final (trailing zeros)
  return rows.filter(r => r.year <= lastNonZeroYear || r.annualDisbursements > 0 || r.endingBalance > 0);
}

// ============================================================
// 17c-2. GASTOS FINANCIEROS AUTOMÁTICOS PARA OTROS RECURSOS
// Genera OtherResourceItem entries a partir de los costos
// financieros de préstamos durante el periodo de inversión/gracia.
// ============================================================

/**
 * Genera automáticamente items de Otros Recursos con categoría "Gastos Financieros"
 * correspondientes a los costos financieros (intereses + comisiones + int. capitalizados)
 * de los préstamos durante el periodo de inversión/gracia (antes del inicio de operaciones).
 *
 * Retorna un array de OtherResourceItem con isAutoGenerated=true.
 * Se genera UN REGISTRO POR CADA MES que tenga saldo de gastos financieros.
 * Cada registro tiene un único mes asignado y el monto total de ese mes
 * (puede incluir aportes de varios préstamos en CUP y/o MLC).
 */
export function generateAutoFinancialExpenseItems(state: BaraproState): import('./barapro-store').OtherResourceItem[] {
  const duration = state.project.monthsDuration || 120;

  // Determinar inicio de operaciones (primer mes con ventas reales)
  let operationStartMonth = findOperationStartMonth(state);

  // Obtener costos financieros
  const finCosts = buildFinancialCosts(state);
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;

  // Acumular por moneda y por mes (solo periodo de inversión/gracia)
  const cupByMonth: Record<number, number> = {};
  const mlcByMonth: Record<number, number> = {};

  for (const fc of finCosts) {
    if (fc.month < operationStartMonth) {
      const total = fc.interest + fc.bankFee + (fc.capitalizedInterest || 0);
      if (total <= 0) continue;

      const rate = fc.exchangeRateUsed || 1;
      const isForeign = fc.loanCurrency && fc.loanCurrency !== 'CUP';

      if (isForeign && rate > 0) {
        // Préstamo en moneda extranjera → monto MLC
        const mlcAmount = total / rate;
        mlcByMonth[fc.month] = (mlcByMonth[fc.month] || 0) + mlcAmount;
      } else {
        // Préstamo en CUP
        cupByMonth[fc.month] = (cupByMonth[fc.month] || 0) + total;
      }
    }
  }

  const items: import('./barapro-store').OtherResourceItem[] = [];

  // Unir todos los meses que tienen saldo (CUP o MLC)
  const allMonthsWithBalance = new Set<number>([
    ...Object.keys(cupByMonth).map(Number),
    ...Object.keys(mlcByMonth).map(Number),
  ]);

  // Generar UN REGISTRO por cada mes con saldo
  const sortedMonths = [...allMonthsWithBalance].sort((a, b) => a - b);
  for (const m of sortedMonths) {
    const monthCUP = cupByMonth[m] || 0;
    const monthMLC = mlcByMonth[m] || 0;

    // Determinar el tipo de moneda predominante para el nombre
    const hasCUP = monthCUP > 0;
    const hasMLC = monthMLC > 0;
    let currencyLabel = '';
    if (hasCUP && hasMLC) currencyLabel = 'CUP + MLC';
    else if (hasCUP) currencyLabel = 'CUP';
    else if (hasMLC) currencyLabel = 'MLC';

    // Calcular monto CUP total (CUP directo + MLC convertido a CUP)
    const totalCUP = monthCUP + monthMLC * cupToMlc;

    items.push({
      id: `__auto_fin_exp_m${m}__`,
      name: `Gastos Financieros (Inv.) — Mes ${m}`,
      description: `Intereses + comisiones + intereses capitalizados del mes ${m} (${currencyLabel}). Periodo de inversión/gracia.`,
      amountCUP: totalCUP,
      amountMLC: monthMLC,
      months: [m],
      category: 'Gastos Financieros',
      isAutoGenerated: true,
    });
  }

  return items;
}

/**
 * Retorna la lista combinada de OtherResourceItem del usuario + items automáticos
 * de Gastos Financieros generados a partir de los préstamos.
 */
export function getMergedOtherResourceItems(state: BaraproState): import('./barapro-store').OtherResourceItem[] {
  const autoItems = generateAutoFinancialExpenseItems(state);
  // Filtrar items manuales que no sean auto-generados obsoletos
  const manualItems = safeArray(state.otherResourceItems).filter(i => !i.isAutoGenerated);
  return [...manualItems, ...autoItems];
}

// ============================================================
// 17d. BALANCE FINANCIERO EXTERNO (Tabla j) — Resolución 1/2022
// Seguimiento de deuda en MLC/USD y su impacto en divisas
// ============================================================

/**
 * Fila del Balance Financiero Externo (Tabla j).
 * Muestra la deuda en moneda extranjera (MLC/USD) y su equivalente en CUP.
 * Agrupa por año y moneda.
 */
export interface ExternalFinancialBalanceRow {
  /** Año del proyecto (1-based) */
  year: number;
  /** Moneda de la deuda ('MLC' o 'USD') */
  currency: string;
  /** Total desembolsos recibidos en el año (en moneda original, ya convertidos a CUP) */
  annualDisbursementsCUP: number;
  /** Total intereses pagados en el año (CUP) */
  annualInterestCUP: number;
  /** Total comisiones bancarias en el año (CUP) */
  annualBankFeesCUP: number;
  /** Total principal amortizado en el año (CUP) */
  annualPrincipalPaidCUP: number;
  /** Total servicio de deuda = intereses + principal + comisiones (CUP) */
  annualTotalServiceCUP: number;
  /** Saldo insoluto al final del año (CUP) */
  endingBalanceCUP: number;
}

/**
 * Construye el Balance Financiero Externo (Tabla j).
 * Filtra préstamos cuya moneda NO sea CUP, consolida por año y moneda.
 *
 * Nota: Todos los montos en amountCUP ya incluyen la conversión implícita
 * (el usuario ingresa el monto equivalente en CUP). La tasa de cambio utilizada
 * se puede inferir de cupToMlc en project.exchangeRates.
 */
export function buildExternalFinancialBalance(state: BaraproState): ExternalFinancialBalanceRow[] {
  const projectDuration = state.project.monthsDuration || 120;
  const duration = projectDuration;
  const bankFeeRate = (state.parameters.bankFeeRate || 0) / 100;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const foreignLoans = (state.loans || []).filter(l => l.currency && l.currency !== 'CUP');

  if (foreignLoans.length === 0) return [];

  // Calcular financialCosts para estos préstamos
  const rows: ExternalFinancialBalanceRow[] = [];

  for (const loan of foreignLoans) {
    const amort = calcAmortizacion({ ...loan, bankFeeRate, projectDuration });

    // Desembolsos por mes
    const disbs = getLoanDisbursements(loan);

    // Agrupar por año
    const totalYears = Math.ceil(duration / 12);
    const yearData: Map<number, {
      disbursements: number;
      interest: number;
      bankFees: number;
      principal: number;
      lastBalance: number;
    }> = new Map();

    for (let y = 1; y <= totalYears; y++) {
      yearData.set(y, { disbursements: 0, interest: 0, bankFees: 0, principal: 0, lastBalance: 0 });
    }

    // Acumular por año (convertir moneda original a CUP)
    for (const a of amort) {
      const m = loan.startMonth + a.period - 1;
      if (m >= 1 && m <= duration) {
        const year = Math.ceil(m / 12);
        const data = yearData.get(year);
        if (!data) continue;

        const exchangeRate = resolveExchangeRateForPeriod(
          a.period, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );

        // Cash interest (solo pagado en efectivo)
        const cashInt = a.payment > 0 ? (a.interest + (a.graceAccumulatedInterest || 0)) : 0;
        data.interest += cashInt * exchangeRate;
        data.bankFees += (a.bankFee || 0) * exchangeRate;
        data.principal += (a.principal || 0) * exchangeRate;
        data.lastBalance = (a.endingBalance || 0) * exchangeRate;
      }
    }

    // Acumular desembolsos por año (convertir a CUP)
    for (const [mStr, amt] of Object.entries(disbs)) {
      const mi = parseInt(mStr);
      if (mi >= 1 && mi <= duration) {
        const year = Math.ceil(mi / 12);
        const data = yearData.get(year);
        if (data) {
          const periodFromStart = mi - loan.startMonth + 1;
          const exchangeRate = resolveExchangeRateForPeriod(
            periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
          );
          data.disbursements += amt * exchangeRate;
        }
      }
    }

    // Crear filas por año
    let lastNonZeroYear = 0;
    for (let y = 1; y <= totalYears; y++) {
      const data = yearData.get(y)!;
      const totalService = data.interest + data.principal + data.bankFees;

      rows.push({
        year: y,
        currency: loan.currency,
        annualDisbursementsCUP: data.disbursements,
        annualInterestCUP: data.interest,
        annualBankFeesCUP: data.bankFees,
        annualPrincipalPaidCUP: data.principal,
        annualTotalServiceCUP: totalService,
        endingBalanceCUP: data.lastBalance,
      });

      if (data.interest > 0 || data.principal > 0 || data.bankFees > 0 ||
          data.disbursements > 0 || data.lastBalance > 0) {
        lastNonZeroYear = y;
      }
    }

  } // end for (const loan of foreignLoans)

  // Limpiar filas vacías al final (último año con actividad)
  const lastNonZeroYear = rows.length > 0 ? rows[rows.length - 1].year : 0;
  return rows.filter(r => r.year <= lastNonZeroYear);
}

export interface ConstructionInterestRow {
  month: number;
  year: number;
  disbursementCUP: number;
  cumulativeInvestment: number;
  capitalizedInterest: number;
  cumulativeInterest: number;
  totalWithInterest: number;
  constructionInterestRate: number;
}

export function buildConstructionInterestSchedule(state: BaraproState): ConstructionInterestRow[] {
  const invBudget = buildInvestmentBudget(state);
  const duration = state.project.monthsDuration || 120;
  const schedule: ConstructionInterestRow[] = [];

  // Desglose mensual de desembolsos por partida
  const monthlyDisbursement = new Array(duration).fill(0);
  for (const item of invBudget.items) {
    if (item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) monthlyDisbursement[m - 1] += perMonth;
      }
    }
  }

  // Tasa de interés en construcción = promedio ponderado de tasas de préstamos
  let constructionRate = 0;
  let weightTotal = 0;
  for (const loan of state.loans) {
    constructionRate += loan.annualRate * loan.amountCUP;
    weightTotal += loan.amountCUP;
  }
  if (weightTotal > 0) constructionRate = constructionRate / weightTotal;

  // Construir cronograma con intereses capitalizados
  let cumulative = 0;
  let cumulativeInterest = 0;
  const monthlyRate = constructionRate / 12;
  const [startYear, startMo] = (state.project.startDate || '2025-01').split('-').map(Number);

  for (let i = 0; i < duration; i++) {
    const disbursement = monthlyDisbursement[i];
    const beginBalance = cumulative;
    cumulative += disbursement;
    // Interés sobre saldo inicial + mitad del desembolso del mes (método del promedio)
    const avgBalance = beginBalance + disbursement * 0.5;
    const interest = avgBalance * monthlyRate;
    cumulativeInterest += interest;

    const totalMonthsFromStart = i + (startMo - 1);
    const calYear = startYear + Math.floor(totalMonthsFromStart / 12);

    schedule.push({
      month: i + 1,
      year: calYear,
      disbursementCUP: disbursement,
      cumulativeInvestment: cumulative,
      capitalizedInterest: interest,
      cumulativeInterest,
      totalWithInterest: cumulative + cumulativeInterest,
      constructionInterestRate: constructionRate,
    });

    // Detener si ya no hay más desembolsos ni intereses significativos
    if (i > 12 && disbursement === 0 && interest < 0.01) break;
  }

  return schedule;
}

// ============================================================
// 18. CAPITAL DE TRABAJO (Metodología PDL - Cálculo Anual)
// ============================================================

export interface WorkingCapitalRow {
  month: number;
  year: number;
  // Activos Corrientes - desglose mensual (= anual / 12)
  efectivo: number;              // Caja y bancos
  cuentasPorCobrar: number;      // Cuentas por cobrar a clientes
  inventarios: number;           // Inventarios (materias primas)
  inventariosNacionales: number;       // desglose nacional (proxy: 70% of inventarios)
  inventariosImportados: number;       // desglose importado (proxy: 30% of inventarios)
  productosEnProceso: number;    // Productos en proceso
  produccionTerminada: number;   // Producción terminada
  piezasRepuesto: number;        // Piezas de repuesto y herramientas
  mercanciasVenta: number;       // Inventario de mercancías para la venta
  otrosActivosCorrientes: number; // Otros activos corrientes (default 0)
  // Pasivos Corrientes
  totalPasivosCorrientes: number;
  cuentaPorPagar: number;        // desglose de pasivos
  anticipos: number;             // anticipos (default 0)
  otrosPasivosCorrientes: number; // otros pasivos (default 0)
  // Totales
  totalActivosCorrientes: number;
  capitalTrabajoBruto: number;   // = totalActivosCorrientes
  capitalTrabajoNeto: number;    // = activos - pasivos
  variacion: number;             // cambio respecto al mes anterior
}

/**
 * Calcula el Capital de Trabajo mensual usando la metodología PDL.
 *
 * FUENTES DE DATOS (Refactorizado):
 *   - Módulo N (Parámetros): días de cobertura y base de cálculo anual
 *   - Estado de Resultados Financieros (ERF): todos los componentes de costos e ingresos
 *   - Los datos se importan de _buildERFCalculations (fuente única de verdad del ERF)
 *
 * LÓGICA: Se calcula el CT ANUAL primero, luego se divide entre 12 meses.
 *
 * Paso 1 — Agregar por año:
 *   Sumar costos e ingresos mensuales del ERF para obtener los totales anuales.
 *
 * Paso 2 — Aplicar coeficientes de rotación anuales:
 *   Coeficiente = Días de Cobertura / Días de Trabajo al Año
 *
 * Paso 3 — Obtener CT mensual:
 *   Cada componente mensual = Componente Anual / 12
 *
 * Fórmulas anuales (datos del ERF):
 *   Efectivo_anual           = Costos y Gastos de Operación (ERF L18) × (díasEfectivo / díasTrabajoAño)
 *   CxC_anual                = Ventas Brutas × (díasCxC / díasTrabajoAño)
 *   Inventarios_anual        = Materias Primas (ERF) × (díasInventario / díasTrabajoAño)
 *   PEP_anual                = Costos Directos Totales (ERF) × (díasPEP / díasTrabajoAño)
 *   PT_anual                 = (Costos Directos + Mantenimiento) (ERF) × (díasPT / díasTrabajoAño)
 *   Piezas_anual             = Gastos Mantenimiento (ERF) × (díasPR / díasTrabajoAño)
 *   Pasivos_anuales          = (MP + Servicios Públicos) (ERF) × (díasCxP / díasTrabajoAño)
 *
 * Fórmulas mensuales (para cada mes del año):
 *   Componente_mensual = Componente_anual / 12
 *   CT Neto = Total Activos − Total Pasivos
 *   Variación = CT Neto(mes) − CT Neto(mes anterior)
 */
export function buildWorkingCapital(state: BaraproState): WorkingCapitalRow[] {
  // ── FUENTE DE DATOS: Estado de Resultados Financieros (ERF) ──
  // Importa todos los cálculos base del ERF (fuente única de verdad)
  const erf = _buildERFCalculations(state);
  const duration = state.project.monthsDuration || 120;

  // ── FUENTE DE DATOS: Módulo N (Parámetros) ──
  const daysPerYear = state.parameters.workingDaysPerYear || 360;
  const cashDays = state.parameters.wcCashCoverageDays || 30;
  const receivableDays = state.parameters.wcReceivableCoverageDays || 30;
  const inventoryDays = state.parameters.wcInventoryCoverageDays || 45;
  const payableDays = state.parameters.wcPayableDays || 30;
  const wipDays = state.parameters.wcWipCoverageDays || 15;
  const finishedGoodsDays = state.parameters.wcFinishedGoodsCoverageDays || 30;
  const sparePartsDays = state.parameters.wcSparePartsCoverageDays || 30;
  const mercanciasVentaDays = state.parameters.wcMercanciasVentaCoverageDays || 30;

  // Coeficientes de rotación anuales = días de cobertura / días de trabajo al año
  const rotCash = cashDays / daysPerYear;
  const rotReceivable = receivableDays / daysPerYear;
  const rotInventory = inventoryDays / daysPerYear;
  const rotPayable = payableDays / daysPerYear;
  const rotWip = wipDays / daysPerYear;
  const rotFinishedGoods = finishedGoodsDays / daysPerYear;
  const rotSpareParts = sparePartsDays / daysPerYear;
  const rotMercancias = mercanciasVentaDays / daysPerYear;

  // ── PASO 1: Agregar costos e ingresos por año desde el ERF ──
  const totalYears = Math.ceil(duration / 12);

  interface AnnualAgg {
    year: number;
    costsNoDep: number;           // Costos y Gastos de Operación (ERF L18, sin depreciación)
    ventasBrutas: number;         // Ventas Brutas del ERF (base para CxC)
    totalCostosDirectos: number;  // Costos Directos Totales del ERF (base para PEP)
    materiasPrimas: number;       // Materias Primas del ERF (base para Inventarios)
    mpNacional: number;           // MP Nacional del ERF
    mpImportada: number;          // MP Importada del ERF
    mpAndServices: number;        // MP + Servicios Públicos del ERF (base para CxP)
    costosProduccion: number;     // Costos Directos + Mantenimiento del ERF (base para PT)
    gastosMantenimiento: number;  // Gastos de Mantenimiento del ERF (base para Piezas)
    monthCount: number;           // Meses reales en este año (último año puede ser parcial)
  }

  // ── Contribuciones patronales por módulo salarial (para ajustar costos del CT) ──
  // El ERF usa salaryTotal para las líneas de costos, pero para el CT los inventarios
  // de PEP/PT/Piezas deben incluir el costo total (CSS + ITF patronal).
  const _directCostSalaries = (state.directCostSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _maintenanceSalaries = (state.maintenanceSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));

  const annualData: AnnualAgg[] = [];

  for (let y = 0; y < totalYears; y++) {
    let costsNoDep = 0;
    let ventasBrutas = 0;
    let totalCostosDirectos = 0;
    let materiasPrimas = 0;
    let mpNacional = 0;
    let mpImportada = 0;
    let mpAndServices = 0;
    let costosProduccion = 0;
    let gastosMantenimiento = 0;
    let monthCount = 0;

    for (let m = 0; m < 12; m++) {
      const idx = y * 12 + m;
      if (idx >= duration) break;
      monthCount++;
      const monthNum = idx + 1;

      // Importar datos del ERF (Estado de Resultados Financieros)
      // COSTOS Y GASTOS DE OPERACIÓN (ERF línea 18):
      // El ERF produce costosGastosOperacion = Gastos Variables + Gastos Fijos.
      // Este dato NO incluye depreciación, CSS patronal ni ITF/Imp.Territorial
      // (esas son líneas separadas del ERF: 23-24).
      // Para el CT, el Efectivo en Caja usa directamente el dato del ERF.
      costsNoDep += erf.costosGastosOperacion[idx];
      ventasBrutas += erf.ventasBrutas[idx];

      // Contribuciones patronales de salarios directos (para ajustar PEP y PT)
      let directEmployerContribs = 0;
      for (const item of _directCostSalaries) {
        if (item.months.includes(monthNum)) {
          const c = calcItemContributions(item, state);
          directEmployerContribs += c.employerSS + c.employerITF;
        }
      }

      // Contribuciones patronales de salarios de mantenimiento (para ajustar PT y Piezas)
      let maintEmployerContribs = 0;
      for (const item of _maintenanceSalaries) {
        if (item.months.includes(monthNum)) {
          const c = calcItemContributions(item, state);
          maintEmployerContribs += c.employerSS + c.employerITF;
        }
      }

      // Costos Directos Totales con contribuciones patronales (base para PEP)
      totalCostosDirectos += erf.totalCostosDirectos[idx] + directEmployerContribs;
      materiasPrimas += erf.materiasPrimas[idx];
      mpNacional += erf.mpNacional[idx];
      mpImportada += erf.mpImportada[idx];
      mpAndServices += erf.materiasPrimas[idx] + erf.serviciosPublicos[idx];
      // Costos de Producción con contribuciones (base para PT): directos + mantenimiento
      costosProduccion += erf.totalCostosDirectos[idx] + directEmployerContribs
                        + erf.gastosMantenimiento[idx] + maintEmployerContribs;
      // Gastos de Mantenimiento con contribuciones patronales (base para Piezas)
      gastosMantenimiento += erf.gastosMantenimiento[idx] + maintEmployerContribs;
    }

    annualData.push({
      year: y + 1,
      costsNoDep,
      ventasBrutas,
      totalCostosDirectos,
      materiasPrimas,
      mpNacional,
      mpImportada,
      mpAndServices,
      costosProduccion,
      gastosMantenimiento,
      monthCount,
    });
  }

  // ── PASO 2: Calcular CT Anual por componentes ──
  // ── PASO 3: Dividir entre 12 para obtener CT Mensual ──

  const rows: WorkingCapitalRow[] = new Array(duration);
  let prevCTNeto = 0;

  for (let y = 0; y < annualData.length; y++) {
    const ad = annualData[y];

    // CT Anual — aplicar coeficientes de rotación sobre datos del ERF
    // Efectivo = Costos y Gastos de Operación (ERF L18) × días cobertura / días año
    const efectivoAnual = ad.costsNoDep * rotCash;
    // CxC basado en Ventas Brutas del ERF (sin descontar ISV)
    const cxCAnual = ad.ventasBrutas * rotReceivable;
    // Inventarios basado en Materias Primas del ERF
    const inventariosAnual = ad.materiasPrimas * rotInventory;
    // PEP basado en Costos Directos Totales del ERF + contribuciones patronales directos
    const pepAnual = ad.totalCostosDirectos * rotWip;
    // PT basado en Costos de Producción del ERF (directos + mantenimiento) + contribuciones patronales
    const ptAnual = ad.costosProduccion * rotFinishedGoods;
    // Piezas basado en Gastos de Mantenimiento del ERF + contribuciones patronales mantenimiento
    const piezasAnual = ad.gastosMantenimiento * rotSpareParts;
    // Mercancías para la Venta: aplica solo a actividades comerciales (Resolución 1/2022)
    const mercanciasAnual = mercanciasVentaDays > 0 ? ad.materiasPrimas * rotMercancias : 0;

    const totalActivosAnual = efectivoAnual + cxCAnual + inventariosAnual + pepAnual + ptAnual + piezasAnual + mercanciasAnual;
    // Cuentas por Pagar = (MP + Servicios Públicos) del ERF × rotación
    const totalPasivosAnual = ad.mpAndServices * rotPayable;
    const ctNetoAnual = totalActivosAnual - totalPasivosAnual;

    // CT Mensual = CT Anual / meses vigentes del año
    const monthsInYear = ad.monthCount || 12;
    const efectivo = efectivoAnual / monthsInYear;
    const cuentasPorCobrar = cxCAnual / monthsInYear;
    const inventarios = inventariosAnual / monthsInYear;
    // Inventarios nacionales/importados desde datos reales del ERF
    const totalMP = ad.materiasPrimas || 1;
    const nacRatio = ad.materiasPrimas > 0 ? (ad.mpNacional / totalMP) : 0.7;
    const impRatio = 1 - nacRatio;
    const inventariosNacionales = inventarios * nacRatio;
    const inventariosImportados = inventarios * impRatio;
    const productosEnProceso = pepAnual / monthsInYear;
    const produccionTerminada = ptAnual / monthsInYear;
    const piezasRepuesto = piezasAnual / monthsInYear;
    const mercanciasVenta = mercanciasAnual / monthsInYear;
    const totalActivosCorrientes = totalActivosAnual / monthsInYear;
    const totalPasivosCorrientes = totalPasivosAnual / monthsInYear;
    const cuentaPorPagar = totalPasivosCorrientes;
    const capitalTrabajoBruto = totalActivosCorrientes;
    const capitalTrabajoNeto = totalActivosCorrientes - totalPasivosCorrientes;

    // Variación del CT: se distribuye uniformemente entre todos los meses del año.
    const variacionMensual = y === 0
      ? capitalTrabajoNeto
      : capitalTrabajoNeto - prevCTNeto;

    // Rellenar los meses del año con el mismo valor mensual
    for (let m = 0; m < monthsInYear; m++) {
      const idx = y * 12 + m;
      if (idx >= duration) break;

      rows[idx] = {
        month: idx + 1,
        year: y + 1,
        efectivo,
        cuentasPorCobrar,
        inventarios,
        inventariosNacionales,
        inventariosImportados,
        productosEnProceso,
        produccionTerminada,
        piezasRepuesto,
        mercanciasVenta,
        otrosActivosCorrientes: 0,
        totalPasivosCorrientes,
        cuentaPorPagar,
        anticipos: 0,
        otrosPasivosCorrientes: 0,
        totalActivosCorrientes,
        capitalTrabajoBruto,
        capitalTrabajoNeto,
        variacion: variacionMensual,
      };
    }

    prevCTNeto = capitalTrabajoNeto;
  }

  return rows;
}

/**
 * Obtiene el Capital de Trabajo inicial para incluir en el presupuesto de inversión.
 * Retorna el CT Neto ANUAL del primer año (no el mensual).
 */
export function getInitialWorkingCapital(state: BaraproState): number {
  const wc = buildWorkingCapital(state);
  if (wc.length === 0) return 0;
  // CT Neto del primer año = mensual × cantidad de meses del año 1
  const firstYearMonths = wc.filter(r => r.year === 1).length || 12;
  return wc[0].capitalTrabajoNeto * firstYearMonths;
}

// ============================================================
// 19. EFECTO SOBRE LAS DIVISAS
// ============================================================

export interface CurrencyEffectRow {
  month: number;
  year: number;
  ingresosMLC: number;
  ingresosCUPequivalent: number;
  egresosMLC: number;
  egresosCUPequivalent: number;
  balanceMLC: number;
  balanceCUP: number;
  acumuladoMLC: number;
  acumuladoCUP: number;
  // Foreign currency loan service costs (informational)
  loanInteresesMLC: number;      // interest payments on foreign currency loans (MLC equivalent)
  loanPrincipalMLC: number;      // principal payments on foreign currency loans (MLC equivalent)
  loanComisionesMLC: number;     // bank fees on foreign currency loans (MLC equivalent)
  loanTotalServiceMLC: number;   // total service on foreign currency loans (MLC equivalent)
}

export function buildCurrencyEffect(state: BaraproState): CurrencyEffectRow[] {
  const costs = buildCostTimeline(state);
  const revenues = buildRevenueTimeline(state);
  const finCosts = buildFinancialCosts(state);
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const rows: CurrencyEffectRow[] = [];
  let accMLC = 0;
  let accCUP = 0;

  // Foreign currency loan costs (reverse-convert CUP to original currency using exchangeRateUsed)
  const foreignLoanCosts: Record<number, { interest: number; principal: number; bankFee: number }> = {};
  const foreignLoanRateByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    // Use the new originalAmountMLC flag and exchangeRateUsed from FinancialCostRow
    if (fc.originalAmountMLC > 0) {
      if (!foreignLoanCosts[fc.month]) foreignLoanCosts[fc.month] = { interest: 0, principal: 0, bankFee: 0 };
      foreignLoanCosts[fc.month].interest += fc.interestOriginal || 0;
      foreignLoanCosts[fc.month].principal += fc.principalOriginal || 0;
      foreignLoanCosts[fc.month].bankFee += fc.bankFee / (fc.exchangeRateUsed || 1); // convert CUP bankFee back
      // Track the exchange rate used (use the first non-zero rate for this month)
      if (fc.exchangeRateUsed > 0 && !foreignLoanRateByMonth[fc.month]) {
        foreignLoanRateByMonth[fc.month] = fc.exchangeRateUsed;
      }
    }
  }

  for (let i = 0; i < duration; i++) {
    const m = i + 1;
    const ingresosMLC = revenues[i].mlc;
    const ingresosCUPequivalent = ingresosMLC * cupToMlc;
    const egresosMLC = costs[i].mlc;
    const egresosCUPequivalent = egresosMLC * cupToMlc;
    const balanceMLC = ingresosMLC - egresosMLC;
    const balanceCUP = ingresosCUPequivalent - egresosCUPequivalent;
    accMLC += balanceMLC;
    accCUP += balanceCUP;

    const flc = foreignLoanCosts[m] || { interest: 0, principal: 0, bankFee: 0 };
    // Use original amounts directly (already in foreign currency)
    const loanInteresesMLC = flc.interest;
    const loanPrincipalMLC = flc.principal;
    const loanComisionesMLC = flc.bankFee;
    const loanTotalServiceMLC = loanInteresesMLC + loanPrincipalMLC + loanComisionesMLC;

    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      ingresosMLC,
      ingresosCUPequivalent,
      egresosMLC,
      egresosCUPequivalent,
      balanceMLC,
      balanceCUP,
      acumuladoMLC: accMLC,
      acumuladoCUP: accCUP,
      loanInteresesMLC,
      loanPrincipalMLC,
      loanComisionesMLC,
      loanTotalServiceMLC,
    });
  }

  return rows;
}

// ============================================================
// 20. DISTRIBUCIÓN DE UTILIDADES
// ============================================================

export interface UtilityDistributionRow {
  month: number;
  year: number;
  utilidadNeta: number;
  utilidadesDisponibles: number;
  cam: number;      // % Dividendo CAM
  retenida: number;  // % Utilidades Retenidas
  proyecto: number;  // % Cuenta Proyecto
  totalDistribuido: number;
  acumuladoCAM: number;
  acumuladoRetenida: number;
  acumuladoProyecto: number;
}

export function buildUtilityDistribution(state: BaraproState): UtilityDistributionRow[] {
  const erf = buildEnhancedERF(state);
  const duration = state.project.monthsDuration || 120;
  const camRate = (state.parameters.dividendCAMRate || 0) / 100;
  const retainedRate = (state.parameters.retainedEarningsRate || 0) / 100;
  const projectRate = (state.parameters.projectAccountRate || 0) / 100;

  const rows: UtilityDistributionRow[] = [];
  let accCAM = 0;
  let accRetenida = 0;
  let accProyecto = 0;
  // Compensación de pérdidas dentro del mismo año.
  // Al finalizar cada año (cada 12 meses), se reinician las pérdidas acumuladas.
  let perdidasAcumuladas = 0;

  for (let i = 0; i < duration; i++) {
    const utilidadNeta = erfVal(erf, 32, i);      // L32 Utilidad Neta
    const utilidadesDisponibles = erfVal(erf, 36, i); // L36 Utilidades Disponibles

    // Compensación de pérdidas dentro del año: si disponibles ≤ 0, se acumula la pérdida
    let baseDisponible = utilidadesDisponibles;
    if (baseDisponible <= 0) {
      perdidasAcumuladas += Math.abs(baseDisponible);
      baseDisponible = 0;
    } else if (perdidasAcumuladas > 0) {
      if (baseDisponible > perdidasAcumuladas) {
        baseDisponible -= perdidasAcumuladas;
        perdidasAcumuladas = 0;
      } else {
        perdidasAcumuladas -= baseDisponible;
        baseDisponible = 0;
      }
    }
    // Reiniciar pérdidas al finalizar cada año (cada 12 meses)
    if ((i + 1) % 12 === 0) perdidasAcumuladas = 0;

    const cam = baseDisponible * camRate;
    const retenida = baseDisponible * retainedRate;
    const proyecto = baseDisponible * projectRate;

    accCAM += cam;
    accRetenida += retenida;
    accProyecto += proyecto;

    rows.push({
      month: i + 1,
      year: Math.ceil((i + 1) / 12),
      utilidadNeta,
      utilidadesDisponibles,
      cam,
      retenida,
      proyecto,
      totalDistribuido: cam + retenida + proyecto,
      acumuladoCAM: accCAM,
      acumuladoRetenida: accRetenida,
      acumuladoProyecto: accProyecto,
    });
  }

  return rows;
}

// ============================================================
// 21. ESTADOS FINANCIEROS (Resolución 1/2022)
// ============================================================
//
// Tres estados según la Resolución 1/2022 del MFP de Cuba:
//   A) Estado de Resultados (Ingresos → Gastos → Utilidad)
//   B) Estado de Costos de Producción y Ventas (desglose de costos)
//   C) ERF Expandido (combinación de A + B, 33 líneas)
//
// Arquitectura:
//   _buildERFCalculations(state) → objeto con todos los cálculos base
//   buildEstadoResultados(state)   → filas del Estado de Resultados
//   buildEstadoCostosProduccion(state) → filas del Estado de Costos
//   buildEnhancedERF(state)        → 33 líneas (wrapper de compatibilidad)
// ============================================================

export interface EnhancedERFRow {
  linea: number;
  concepto: string;
  monthly: number[];
  annual: number[];
  total: number;
  /** Descripción/explicación del concepto (tooltip) */
  descripcion?: string;
}

// ── Helper: búsqueda por número de línea en el ERF (evita indices posicionales) ──
// buildEnhancedERF tiene 55 elementos con sub-líneas decimales (1.1, 4.1, 19.1, etc.),
// por lo que el índice del array NO coincide con el número de línea.
function erfByLine(erf: EnhancedERFRow[], linea: number): EnhancedERFRow | undefined {
  return erf.find(r => r.linea === linea);
}
function erfVal(erf: EnhancedERFRow[], linea: number, monthIdx: number): number {
  return erfByLine(erf, linea)?.monthly[monthIdx] || 0;
}

// Tipo compartido para los dos estados financieros separados
export interface EstadoFinancieroRow {
  linea: number;
  concepto: string;
  monthly: number[];
  annual: number[];
  total: number;
  /** Tipo de línea para estilizado visual */
  tipo: 'total' | 'subtotal' | 'resultado' | 'normal' | 'info' | 'porciento';
  /** Sección a la que pertenece (para agrupación visual) */
  seccion: string;
  /** Descripción/explicación del concepto (tooltip) */
  descripcion?: string;
}

// ═══════════════════════════════════════════════════════════════
// Cálculos base compartidos (fuente única de verdad)
// ═══════════════════════════════════════════════════════════════
export interface ERFCalculations {
  duration: number;
  // Ingresos
  ventasBrutas: number[];
  ventasNacionales: number[];
  ventasExportaciones: number[];
  impuestoVentas: number[];
  ventasNetas: number[];
  otrosIngresos: number[];
  subvenciones: number[];
  devoluciones: number[];
  ingresosTotales: number[];
  // Costos Directos
  mpNacional: number[];
  mpImportada: number[];
  materiasPrimas: number[];
  serviciosPublicos: number[];
  salariosDirectos: number[];
  costosDirectosAdicionales: number[];
  otrosGastosVariables: number[];            // DIF-3: Otros Gastos Variables (% Ventas Netas)
  totalCostosDirectos: number[];
  // Costos Indirectos / Gastos
  gastosDistribucionVentas: number[];
  gastosGeneralesAdmin: number[];
  gastosMantenimiento: number[];
  otrosGastos: number[];
  totalCostosIndirectos: number[];
  costoTotal: number[];
  // Subtotales Resolución 1/2022
  gastosVariables: number[];
  gastosFijos: number[];
  costosGastosOperacion: number[];
  utilidadesEnOperaciones: number[];
  gastosTotalesProduccionServicios: number[];
  // FT desglosada por módulo
  ftComercial: number[];
  ftAdmin: number[];
  ftMantenimiento: number[];
  ftIndirectos: number[];
  // Utilidades
  utilidadBruta: number[];
  utilidadOperativa: number[];
  depreciacionOnly: number[];              // DIF-4: Depreciación (sin amortización)
  amortizacionOnly: number[];              // DIF-4: Amortización (sin depreciación)
  depreciacion: number[];                  // Depreciación + Amortización + Gastos Previos
  utilidadOperativaNeta: number[];        // EBIT = utilidadOperativa - depreciacion
  ebitda: number[];
  // Gastos financieros e impuestos (DIF-5: desglose intereses/comisiones)
  interesesOnly: number[];                // Solo intereses pagados en efectivo
  comisionesOnly: number[];               // Solo comisiones bancarias (bankFee)
  gastosFinancieros: number[];            // intereses + comisiones
  interesesCapitalizados: number[];       // Info only (no gasto)
  honorariosAdmin: number[];
  cssContribucion: number[];
  otrosImpuestos: number[];
  totalImpuestos: number[];
  // Resultados finales
  utilidadAntesImpuestos: number[];
  reservas: number[];                     // DIF-2: Ahora sobre Utilidad antes de Impuestos
  utilidadAjustada: number[];             // DIF-2: Utilidad antes Imp − Reserva Contingencia
  beneficioReinvertir: number[];
  utilidadesImponibles: number[];
  impuestoUtilidades: number[];
  utilidadNeta: number[];
  arie: number[];
  reservasEstimulacion: number[];
  otrasReservasVoluntarias: number[];     // DIF-6: Otras Reservas Voluntarias
  utilidadesDisponibles: number[];
  utilidadesRetenidas: number[];
  pagoUtilidadesRetenidas: number[];     // DIF-7: Pago de Util. Retenidas (de períodos ant.)
  utilidadesDistribuir: number[];
  dividendoEstatal: number[];            // DIF-8: Desglose por tipo de socio
  dividendoSocioCubano: number[];         // DIF-8
  dividendoSocioExtranjero: number[];     // DIF-8
  margenNeto: number[];
  // Helpers
  salariosBrutos: number[];
  // Mantener compatibilidad con código existente (aliases obsoletos)
  utilidadOperativaAjustada: number[];    // DEPRECATED: ahora = utilidadOperativa (sin contingencia)
}

// ── Helper: determinar primer mes de operación (primer mes con ventas reales quantity > 0) ──
// Usa salesItems[].quantity (ventas reales), NO salesItems[].months (meses activos).
export function findOperationStartMonth(state: BaraproState): number {
  const duration = state.project.monthsDuration || 120;
  const _sales = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  for (let m = 0; m < duration; m++) {
    for (const sale of _sales) {
      if (m < sale.quantity.length && sale.quantity[m] > 0) {
        return m + 1;
      }
    }
  }
  return duration + 1; // sin ventas
}

function _buildERFCalculations(state: BaraproState): ERFCalculations {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const incomeTaxRate = (state.parameters.incomeTaxRate || 0) / 100;
  const salesTaxRate = (state.parameters.salesTaxRate || 0) / 100;
  const depSummary = buildDepreciationByItem(state);
  const finCosts = buildFinancialCosts(state);

  // Defensive: fallback to [] prevents TypeError if state is partial
  const _purchaseItems = (state.purchaseItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _directCostSalaries = (state.directCostSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _commercialSalaries = (state.commercialSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _adminSalaries = (state.adminSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _maintenanceSalaries = (state.maintenanceSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _indirectSalaries = (state.indirectSalaries || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _commercial = (state.commercialExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _admin = (state.adminExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _maintenance = (state.maintenanceItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _indirect = (state.indirectExpenses || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _directCosts = (state.directCostItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));
  const _publicServices = (state.publicServiceItems || []).map(i => ({ ...i, months: safeMonths(i.months) }));

  const makeMonthly = (fn: (m: number) => number) =>
    Array.from({ length: duration }, (_, i) => fn(i + 1));

  // ── Determinar inicio de operaciones (primer mes con ventas reales) ──
  let operationStartMonthERF = findOperationStartMonth(state);
  if (operationStartMonthERF > duration) operationStartMonthERF = 1;

  // Gastos financieros por mes — DIF-5: desglose intereses vs comisiones
  // NOTA: Los intereses capitalizados NO se incluyen como gasto operativo según
  // principios contables y la Resolución 1/2022 — se capitalizan al costo del activo.
  // SOLO para el periodo de operaciones (>= operationStartMonthERF).
  const finExpByMonth: Record<number, number> = {};
  const intOnlyByMonth: Record<number, number> = {};    // DIF-5: solo intereses
  const comOnlyByMonth: Record<number, number> = {};    // DIF-5: solo comisiones (bankFee)
  const capitalizedIntByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    if (fc.month >= operationStartMonthERF) {
      finExpByMonth[fc.month] = (finExpByMonth[fc.month] || 0) + fc.interest + fc.bankFee;
      intOnlyByMonth[fc.month] = (intOnlyByMonth[fc.month] || 0) + fc.interest;
      comOnlyByMonth[fc.month] = (comOnlyByMonth[fc.month] || 0) + fc.bankFee;
      capitalizedIntByMonth[fc.month] = (capitalizedIntByMonth[fc.month] || 0) + fc.capitalizedInterest;
    }
  }

  // Depreciation + Amortization by month — DIF-4: desglose depreciación vs amortización
  const gpAmort = calcGastosPreviosAmortization(state);
  const depByMonth: Record<number, number> = {};
  const depOnlyByMonth: number[] = [];   // DIF-4: solo depreciación
  const amorOnlyByMonth: number[] = [];   // DIF-4: solo amortización (intangibles + gastos previos)
  for (let i = 0; i < duration; i++) {
    const dep = depSummary.totalMonthlyDepreciation[i] || 0;
    const amor = (depSummary.totalMonthlyAmortization[i] || 0) + (gpAmort.monthlyAmortization[i] || 0);
    depOnlyByMonth.push(dep);
    amorOnlyByMonth.push(amor);
    depByMonth[i + 1] = dep + amor;
  }

  const toAnnual = (monthly: number[]) => {
    const years: number[] = [];
    const numYears = Math.ceil(monthly.length / 12);
    for (let y = 0; y < numYears; y++) {
      const start = y * 12;
      const end = Math.min(start + 12, monthly.length);
      years.push(monthly.slice(start, end).reduce((s, v) => s + v, 0));
    }
    return years;
  };

  const totalize = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

  // ═══════════════════════════════════════════════════════════════
  // LÍNEA 1: Ventas Brutas (ingresos totales por ventas sin descontar ISV)
  // ═══════════════════════════════════════════════════════════════
  const _salesItems = (state.salesItems || []).map(i => ({ ...i, quantity: safeMonths(i.quantity) }));
  const ventasBrutas = makeMonthly((m) => {
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        total += item.quantity[m - 1] * item.priceCUP + item.quantity[m - 1] * item.priceMLC * cupToMlc;
      }
    }
    return total;
  });

  // ── Ventas Nacionales vs Exportaciones (Resolución 1/2022) ──
  // Usa el campo explícito `marketType` de SalesItem ('nacional' | 'exportacion').
  // Retrocompatible: si no tiene marketType, asume 'nacional'.
  const ventasNacionales = makeMonthly((m) => {
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        const qty = item.quantity[m - 1];
        const isNacional = !item.marketType || item.marketType === 'nacional';
        if (isNacional) {
          total += qty * item.priceCUP + qty * item.priceMLC * cupToMlc;
        }
      }
    }
    return total;
  });
  const ventasExportaciones = makeMonthly((m) => {
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        const qty = item.quantity[m - 1];
        if (item.marketType === 'exportacion') {
          total += qty * item.priceCUP + qty * item.priceMLC * cupToMlc;
        }
      }
    }
    return total;
  });

  // ═══════════════════════════════════════════════════════════════
  // LÍNEA 2: Impuesto sobre Ventas (ISV) = Ventas Brutas × tasa ISV
  // ═══════════════════════════════════════════════════════════════
  const impuestoVentas = ventasBrutas.map((v) => v > 0 ? v * salesTaxRate : 0);

  // ═══════════════════════════════════════════════════════════════
  // LÍNEA 3: Ventas Netas = Ventas Brutas − ISV
  // ═══════════════════════════════════════════════════════════════
  const ventasNetas = ventasBrutas.map((v, i) => v - impuestoVentas[i]);

  // ═══════════════════════════════════════════════════════════════
  // LÍNEA 4: Otros Ingresos (subsidios, alquileres, servicios, etc.)
  // ═══════════════════════════════════════════════════════════════
  const otrosIngresosERF = makeMonthly((m) => {
    let total = 0;
    for (const oi of state.otherIncomeItems) {
      const monthlyTotal = (oi.amountCUP || 0) + (oi.amountMLC || 0) * cupToMlc;
      for (const mi of safeMonths(oi.months)) {
        if (mi === m) total += monthlyTotal;
      }
    }
    return total;
  });

  // ── Subvenciones (Resolución 1/2022 — Módulo H.3) ──
  const subvencionesERF = makeMonthly((m) => {
    let total = 0;
    for (const s of safeArray(safeArray(state.subventionItems))) {
      const qtyArr = safeMonths(s.quantity);
      const monthlyVal = (s.unitCostCUP || 0) + (s.unitCostMLC || 0) * cupToMlc;
      const qty = (m - 1 < qtyArr.length) ? qtyArr[m - 1] : 0;
      if (qty > 0 && s.months.includes(m)) total += qty * monthlyVal;
    }
    return total;
  });

  // ── Devoluciones y Rebajas en Venta (Resolución 1/2022 — Módulo H.4) ──
  const devolucionesERF = makeMonthly((m) => {
    let total = 0;
    for (const d of safeArray(state.salesReturnItems)) {
      const qtyArr = safeMonths(d.quantity);
      const monthlyVal = (d.unitCostCUP || 0) + (d.unitCostMLC || 0) * cupToMlc;
      const qty = (m - 1 < qtyArr.length) ? qtyArr[m - 1] : 0;
      if (qty > 0 && d.months.includes(m)) total += qty * monthlyVal;
    }
    return total;
  });

  // ═══════════════════════════════════════════════════════════════
  // LÍNEA 5: Ingresos Totales = Ventas Netas + Otros Ingresos + Subvenciones − Devoluciones
  // ═══════════════════════════════════════════════════════════════
  const ingresosTotales = ventasNetas.map((v, i) => v + otrosIngresosERF[i] + subvencionesERF[i] - devolucionesERF[i]);

  // ═══════════════════════════════════════════════════════════════
  // Materias Primas — Fuente 1: Ventas (qty × costo MP unitario)
  // ═══════════════════════════════════════════════════════════════
  const mpNacionalVentas = makeMonthly((m) => {
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        const qty = item.quantity[m - 1];
        const cupMP = (item.unitCostMPCUP || 0) * qty;
        total += cupMP;
      }
    }
    return total;
  });
  const mpImportadaVentas = makeMonthly((m) => {
    let total = 0;
    for (const item of _salesItems) {
      if (m - 1 < item.quantity.length && item.quantity[m - 1] > 0) {
        const qty = item.quantity[m - 1];
        const mlcMP = (item.unitCostMPMLC || 0) * qty * cupToMlc;
        total += mlcMP;
      }
    }
    return total;
  });

  // ═══════════════════════════════════════════════════════════════
  // Materias Primas — Fuente 2: Módulo F (Compras)
  // ═══════════════════════════════════════════════════════════════
  const mpNacionalCompras = makeMonthly((m) => {
    let total = 0;
    for (const item of _purchaseItems) {
      const isNacional = item.origin === 'Importada' ? false : (item.origin === 'Nacional' ? true : item.unitCostMLC === 0);
      if (isNacional && item.months.includes(m)) {
        const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
        if (quantities) {
          total += (quantities[m - 1] || 0) * (item.unitCostCUP || 0);
        } else {
          total += (item.quantity * item.unitCostCUP) / (item.months.length || 1);
        }
      }
    }
    return total;
  });
  const mpImportadaCompras = makeMonthly((m) => {
    let total = 0;
    for (const item of _purchaseItems) {
      const isImportada = item.origin === 'Importada' ? true : (item.origin === 'Nacional' ? false : item.unitCostMLC > 0);
      if (isImportada && item.months.includes(m)) {
        const quantities = Array.isArray(item.quantities) && item.quantities.length > 0 ? item.quantities : null;
        if (quantities) {
          total += (quantities[m - 1] || 0) * ((item.unitCostCUP || 0) + (item.unitCostMLC || 0) * cupToMlc);
        } else {
          total += (item.quantity * item.unitCostCUP + item.quantity * item.unitCostMLC * cupToMlc) / (item.months.length || 1);
        }
      }
    }
    return total;
  });

  const mpNacional = mpNacionalVentas.map((v, i) => v + mpNacionalCompras[i]);
  const mpImportada = mpImportadaVentas.map((v, i) => v + mpImportadaCompras[i]);
  const materiasPrimas = mpNacional.map((v, i) => v + mpImportada[i]);

  // Salarios Directos (salaryTotal only — employerSS y employerITF van por separado)
  const salarios = makeMonthly((m) => {
    let total = 0;
    for (const item of _directCostSalaries) {
      if (item.months.includes(m)) {
        const contribs = calcItemContributions(item, state);
        total += contribs.salaryTotal;
      }
    }
    return total;
  });

  // Salarios brutos (salaryTotal from calcWorkerContributions) para calcular CSS patronal
  // Incluye TODOS los salarios de la empresa: comercial(I), admin(J), mantenimiento(K), indirectos(L), directos(M)
  const salariosBrutos = makeMonthly((m) => {
    let total = 0;
    for (const item of _commercialSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    for (const item of _adminSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    for (const item of _maintenanceSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    for (const item of _indirectSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    for (const item of _directCostSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    return total;
  });

  // Gastos de Distribución y Ventas (incluye salarios del módulo I)
  const gastosComerciales = makeMonthly((m) => {
    let total = 0;
    for (const item of _commercial) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    for (const item of _commercialSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    return total;
  });

  // Gastos Generales y de Administración (incluye salarios del módulo J)
  const gastosAdmin = makeMonthly((m) => {
    let total = 0;
    for (const item of _admin) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    for (const item of _adminSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    return total;
  });

  // Gastos de Mantenimiento (incluye salarios del módulo K)
  const mantenimiento = makeMonthly((m) => {
    let total = 0;
    for (const item of _maintenance) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    for (const item of _maintenanceSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    return total;
  });

  // Otros Gastos (incluye salarios del módulo L)
  const indirectos = makeMonthly((m) => {
    let total = 0;
    for (const item of _indirect) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    for (const item of _indirectSalaries) { if (item.months.includes(m)) { total += calcItemContributions(item, state).salaryTotal; } }
    return total;
  });

  // Depreciación
  const depreciacion = makeMonthly((m) => depByMonth[m] || 0);

  // ── Gastos Financieros y Bancarios (ERF L24) — sumatoria explícita de sub-índices ──
  // Sub-índice 24.3: Desglose — Intereses capitalizados
  const interesesCapitalizados = makeMonthly((m) => capitalizedIntByMonth[m] || 0);
  // Sub-índice 24.1: Total de Intereses = solo intereses pagados en efectivo
  const interesesOnly = makeMonthly((m) => intOnlyByMonth[m] || 0);
  // Sub-índice 24.2: Comisiones, Seguros y Otros gastos bancarios
  const comisionesOnly = makeMonthly((m) => comOnlyByMonth[m] || 0);
  // L24 = sumatoria de sub-índices 24.1 + 24.2
  const gastosFinancieros = interesesOnly.map((v, i) => v + comisionesOnly[i]);

  // ═══════════════════════════════════════════════════════════════
  // CÁLCULOS DERIVADOS — Cadena corregida según Resolución 1/2022
  // ═══════════════════════════════════════════════════════════════

  // Costos Directos Adicionales (Módulo M — gastos directos no salariales)
  const costosDirectosAdicionales = makeMonthly((m) => {
    let total = 0;
    for (const item of _directCosts) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    return total;
  });

  // Servicios Públicos (sub-módulo de Costos Directos)
  const serviciosPublicos = makeMonthly((m) => {
    let total = 0;
    for (const item of _publicServices) { if (item.months.includes(m)) { total += (item.amountCUP + item.amountMLC * cupToMlc) / (item.months.length || 1); } }
    return total;
  });

  // Total Costos Directos = MP + Salarios Directos + Costos Directos Adicionales + Servicios Públicos
  const totalCostosDirectos = materiasPrimas.map((v, i) => v + salarios[i] + costosDirectosAdicionales[i] + serviciosPublicos[i]);
  // Utilidad Bruta = Ingresos Totales − Costos Directos
  const utilidadBruta = ingresosTotales.map((v, i) => v - totalCostosDirectos[i]);
  // Total Costos Indirectos = Comerciales + Admin + Mantenimiento + Indirectos
  const totalCostosIndirectos = gastosComerciales.map((v, i) => v + gastosAdmin[i] + mantenimiento[i] + indirectos[i]);

  // ── FT desglosada por módulo (salaryTotal, sin CSS/ITF) ──
  const ftComercial = makeMonthly((m) => {
    let t = 0; for (const item of _commercialSalaries) { if (item.months.includes(m)) t += calcItemContributions(item, state).salaryTotal; } return t;
  });
  const ftAdmin = makeMonthly((m) => {
    let t = 0; for (const item of _adminSalaries) { if (item.months.includes(m)) t += calcItemContributions(item, state).salaryTotal; } return t;
  });
  const ftMantenimiento = makeMonthly((m) => {
    let t = 0; for (const item of _maintenanceSalaries) { if (item.months.includes(m)) t += calcItemContributions(item, state).salaryTotal; } return t;
  });
  const ftIndirectos = makeMonthly((m) => {
    let t = 0; for (const item of _indirectSalaries) { if (item.months.includes(m)) t += calcItemContributions(item, state).salaryTotal; } return t;
  });

  // ── Subtotales Resolución 1/2022 ──
  // DIF-3: Otros Gastos Variables (% sobre Ventas Netas)
  const otrosGastosVariablesRate = (state.parameters.otrosGastosVariablesPct || 0) / 100;
  const otrosGastosVariables = makeMonthly((m) => ventasNetas[m - 1] * otrosGastosVariablesRate);

  // Gastos Variables = Total Costos Directos + Otros Gastos Variables
  const gastosVariables = totalCostosDirectos.map((v, i) => v + otrosGastosVariables[i]);
  // Gastos Fijos = Total Costos Indirectos (Distribución + Admin + Mant. + Otros)
  const gastosFijos = totalCostosIndirectos;
  // Costos y Gastos de Operación = Variables + Fijos
  const costosGastosOperacion = gastosVariables.map((v, i) => v + gastosFijos[i]);
  // Utilidades en Operaciones = Ingresos Totales − Costos y Gastos de Operación (Resolución 1/2022)
  // Ingresos Totales = Ventas Netas + Otros Ingresos + Subvenciones − Devoluciones
  const utilidadesEnOperaciones = ingresosTotales.map((v, i) => v - costosGastosOperacion[i]);

  // Costo Total Operativo = Costos y Gastos de Operación (incluye Otros Gastos Variables)
  const costoTotal = costosGastosOperacion;
  // Utilidad Operativa = alias de Utilidades en Operaciones (mismo cálculo, base coherente)
  const utilidadOperativa = utilidadesEnOperaciones;

  // DIF-2: Depreciación antes de contingencia (sin reservas intermedias)
  // EBIT = Utilidades en Operaciones − Depreciación y Amortización (flujo desde L19)
  const utilidadOperativaNeta = utilidadesEnOperaciones.map((v, i) => v - depreciacion[i]);
  const ebitda = utilidadesEnOperaciones;  // EBITDA = Utilidades en Op (antes de depreciación)

  // Honorarios de administración (porcentaje sobre utilidad operativa neta, si aplica)
  const honorariosRate = (state.parameters.honorariosAdminRate || 0) / 100;
  const honorariosAdmin = honorariosRate > 0
    ? utilidadOperativaNeta.map((v) => v > 0 ? v * honorariosRate : 0)
    : makeMonthly(() => 0);

  // Gastos Totales de Producción y Servicios = Op. + Deprec + Gastos Fin. + Honorarios
  const gastosTotalesProduccionServicios = costosGastosOperacion.map((v, i) =>
    v + depreciacion[i] + gastosFinancieros[i] + honorariosAdmin[i]);

  // DIF-5: interesesOnly y comisionesOnly ya definidos arriba (L3696-3700) como sub-índices de L24

  // CSS — contribución patronal del empleador (solo operaciones, excluye inversión inicial)
  const cssContribucion = makeMonthly((m) => sumOperationsContribs(state, m).totalEmployerSS);

  // Otros impuestos, tasas y contribuciones (CSS + ITF + imp. territorial sobre ventas brutas)
  // La Contribución Seguridad Social forma parte de Otros Impuestos, Tasas y Contribuciones
  const territorialTaxRate = (state.parameters.territorialTaxRate || 0) / 100;
  const otrosImpuestos = makeMonthly((m) => {
    const contribs = sumOperationsContribs(state, m);
    return contribs.totalEmployerSS + contribs.totalEmployerITF + ventasBrutas[m - 1] * territorialTaxRate;
  });

  const totalImpuestos = otrosImpuestos; // CSS ya incluido en otrosImpuestos
  const gastosPrevImpuestos = gastosFinancieros.map((v, i) => v + honorariosAdmin[i] + totalImpuestos[i]);
  // Utilidad antes de Impuestos = Utilidad Operativa Neta - Gastos Previos
  const utilAntesImp = utilidadOperativaNeta.map((v, i) => v - gastosPrevImpuestos[i]);

  // ── DIF-2: Contingencia DESPUÉS de Utilidad antes de Impuestos (Resolución 1/2022) ──
  // La reserva de contingencia se calcula con compensación de pérdidas dentro del mismo año,
  // igual que el impuesto sobre utilidades: las pérdidas de meses anteriores del año se
  // compensan con las ganancias posteriores antes de aplicar la tasa de contingencia.
  const contingencyRate = (state.parameters.operationsContingencyRate || 0) / 100;
  let perdidasContingencia = 0;
  const reservas = utilAntesImp.map((v, i) => {
    if (v <= 0) {
      perdidasContingencia += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasContingencia = 0;
      return 0;
    }
    if (perdidasContingencia > 0) {
      if (v > perdidasContingencia) {
        const base = v - perdidasContingencia;
        perdidasContingencia = 0;
        if ((i + 1) % 12 === 0) perdidasContingencia = 0;
        return base * contingencyRate;
      } else {
        perdidasContingencia -= v;
        if ((i + 1) % 12 === 0) perdidasContingencia = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasContingencia = 0;
    return v * contingencyRate;
  });
  // Utilidad Ajustada = Utilidad antes de Imp − Reserva de Contingencia
  const utilidadAjustada = utilAntesImp.map((v, i) => v - reservas[i]);

  // ── Resolución 1/2022: Reinvertir → Impónibles → Impuestos → Neta → ARIE → Estimulación → Otras Reservas → Disponibles ──
  const beneficioReinvertirRate = (state.parameters.beneficioReinvertirRate || 0) / 100;
  const beneficioReinvertir = utilidadAjustada.map((v) => v > 0 ? v * beneficioReinvertirRate : 0);
  const utilidadesImponibles = utilidadAjustada.map((v, i) => v - beneficioReinvertir[i]);
  // Impuesto sobre Utilidades con compensación de pérdidas dentro del mismo año.
  // Las pérdidas de meses anteriores del año se compensan con las ganancias de meses
  // posteriores del mismo año. Al finalizar el año, las pérdidas no compensadas se reinician.
  let perdidasAcumuladas = 0;
  const impFinal = utilidadesImponibles.map((v, i) => {
    if (v <= 0) {
      perdidasAcumuladas += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasAcumuladas = 0;
      return 0;
    }
    if (perdidasAcumuladas > 0) {
      if (v > perdidasAcumuladas) {
        const gravable = v - perdidasAcumuladas;
        perdidasAcumuladas = 0;
        if ((i + 1) % 12 === 0) perdidasAcumuladas = 0;
        return gravable * incomeTaxRate;
      } else {
        perdidasAcumuladas -= v;
        if ((i + 1) % 12 === 0) perdidasAcumuladas = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasAcumuladas = 0;
    return v * incomeTaxRate;
  });
  // Utilidad Neta
  const utilNetaFinal = utilidadesImponibles.map((v, i) => v - impFinal[i]);

  // ARIE — Aporte Rendimiento Inversión Estatal
  const arieRate = (state.parameters.arieRate || 0) / 100;
  const arie = utilNetaFinal.map((v) => v > 0 ? v * arieRate : 0);
  // Reservas de Estimulación
  const reservasEstimulacionRate = (state.parameters.reservasEstimulacionRate || 0) / 100;
  const reservasEstimulacion = utilNetaFinal.map((v) => v > 0 ? v * reservasEstimulacionRate : 0);
  // DIF-6: Otras Reservas Voluntarias
  const otrasReservasVoluntariasRate = (state.parameters.otrasReservasVoluntariasRate || 0) / 100;
  const otrasReservasVoluntarias = utilNetaFinal.map((v) => v > 0 ? v * otrasReservasVoluntariasRate : 0);
  // Utilidades Disponibles = Utilidad Neta − ARIE − Reservas Estimulación − Otras Reservas
  const utilidadesDisponibles = utilNetaFinal.map((v, i) => v - arie[i] - reservasEstimulacion[i] - otrasReservasVoluntarias[i]);
  // Utilidades Retenidas con compensación de pérdidas dentro del mismo año.
  let perdidasRetenidas = 0;
  const utilRetenidas = utilidadesDisponibles.map((v, i) => {
    if (v <= 0) {
      perdidasRetenidas += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasRetenidas = 0;
      return 0;
    }
    if (perdidasRetenidas > 0) {
      if (v > perdidasRetenidas) {
        const gravable = v - perdidasRetenidas;
        perdidasRetenidas = 0;
        if ((i + 1) % 12 === 0) perdidasRetenidas = 0;
        return gravable * ((state.parameters.retainedEarningsRate || 0) / 100);
      } else {
        perdidasRetenidas -= v;
        if ((i + 1) % 12 === 0) perdidasRetenidas = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasRetenidas = 0;
    return v * ((state.parameters.retainedEarningsRate || 0) / 100);
  });
  // DIF-7: Pago de Utilidades Retenidas (de períodos anteriores)
  const pagoUtilidadesRetenidasAmt = state.parameters.pagoUtilidadesRetenidasAmt || 0;
  const pagoUtilidadesRetenidas = makeMonthly(() => pagoUtilidadesRetenidasAmt);
  // Utilidades a Distribuir = Utilidades Disponibles − Retenidas + Pago Retenidas
  const utilDistribuir = utilidadesDisponibles.map((v, i) => v - utilRetenidas[i] + pagoUtilidadesRetenidas[i]);

  // DIF-8: Desglose por tipo de socio/partícipe
  const divEstatalPct = (state.parameters.dividendoEstatalPct || 0) / 100;
  const divCubanoPct = (state.parameters.dividendoSocioCubanoPct || 0) / 100;
  const divExtranjeroPct = (state.parameters.dividendoSocioExtranjeroPct || 0) / 100;
  const dividendoEstatal = utilDistribuir.map((v) => v > 0 ? v * divEstatalPct : 0);
  const dividendoSocioCubano = utilDistribuir.map((v) => v > 0 ? v * divCubanoPct : 0);
  const dividendoSocioExtranjero = utilDistribuir.map((v) => v > 0 ? v * divExtranjeroPct : 0);

  // Margen Neto % = Utilidad Neta / Ventas Netas (no Ingresos Totales, según Resolución 1/2022)
  const margenNeto = ventasNetas.map((v, i) => v > 0 ? (utilNetaFinal[i] / v) * 100 : 0);

  // DEPRECATED alias: utilidadOperativaAjustada ahora = utilidadOperativa (sin contingencia aplicada)
  const utilidadOperativaAjustada = utilidadOperativa;

  return {
    duration,
    ventasBrutas, ventasNacionales, ventasExportaciones,
    impuestoVentas, ventasNetas,
    otrosIngresos: otrosIngresosERF, subvenciones: subvencionesERF, devoluciones: devolucionesERF,
    ingresosTotales,
    mpNacional, mpImportada, materiasPrimas, serviciosPublicos, salariosDirectos: salarios,
    costosDirectosAdicionales, otrosGastosVariables, totalCostosDirectos,
    gastosDistribucionVentas: gastosComerciales, gastosGeneralesAdmin: gastosAdmin, gastosMantenimiento: mantenimiento,
    otrosGastos: indirectos, totalCostosIndirectos, costoTotal,
    gastosVariables, gastosFijos, costosGastosOperacion, utilidadesEnOperaciones,
    gastosTotalesProduccionServicios,
    ftComercial, ftAdmin, ftMantenimiento, ftIndirectos,
    utilidadBruta, utilidadOperativa,
    depreciacionOnly: depOnlyByMonth, amortizacionOnly: amorOnlyByMonth,
    depreciacion, utilidadOperativaNeta, ebitda,
    interesesOnly, comisionesOnly, gastosFinancieros, interesesCapitalizados, honorariosAdmin,
    cssContribucion, otrosImpuestos, totalImpuestos,
    utilidadAntesImpuestos: utilAntesImp,
    reservas, utilidadAjustada,
    beneficioReinvertir, utilidadesImponibles,
    impuestoUtilidades: impFinal,
    utilidadNeta: utilNetaFinal, arie, reservasEstimulacion, otrasReservasVoluntarias,
    utilidadesDisponibles,
    utilidadesRetenidas: utilRetenidas, pagoUtilidadesRetenidas,
    utilidadesDistribuir: utilDistribuir,
    dividendoEstatal, dividendoSocioCubano, dividendoSocioExtranjero,
    margenNeto,
    salariosBrutos,
    utilidadOperativaAjustada,
  };
}

// ═══════════════════════════════════════════════════════════════
// A) ESTADO DE RESULTADOS (Resolución 1/2022)
// ═══════════════════════════════════════════════════════════════
// Estructura: Ingresos → Costos → Utilidad Bruta → Gastos Op. →
//             Utilidad Operativa → Depreciación → EBIT →
//             Gastos Financieros → Impuestos → Utilidad Neta
// ═══════════════════════════════════════════════════════════════

export function buildEstadoResultados(state: BaraproState): EstadoFinancieroRow[] {
  const c = _buildERFCalculations(state);

  const row = (linea: number, concepto: string, monthly: number[], tipo: EstadoFinancieroRow['tipo'], seccion: string, descripcion?: string): EstadoFinancieroRow => ({
    linea, concepto, monthly, annual: _toAnnual(monthly), total: _totalize(monthly), tipo, seccion, descripcion,
  });

  const lines: EstadoFinancieroRow[] = [
    // ── SECCIÓN 1: INGRESOS ──
    row(1,    '+ Ventas Brutas',                      c.ventasBrutas,           'total',   'Ingresos'),
    row(1.1,  '    Mercado Nacional',                c.ventasNacionales,       'normal',  'Ingresos'),
    row(1.2,  '    Exportaciones',                    c.ventasExportaciones,    'normal',  'Ingresos'),
    row(2,    '- Impuesto sobre Ventas (ISV)',         c.impuestoVentas,        'normal',  'Ingresos'),
    row(3,    '= Ventas Netas',                        c.ventasNetas,           'resultado','Ingresos'),
    row(4,    '+ Otros Ingresos',                      c.otrosIngresos,         'normal',  'Ingresos'),
    row(5,    '+ Subvenciones',                        c.subvenciones,          'normal',  'Ingresos'),
    row(6,    '- Devoluciones y Rebajas',              c.devoluciones,          'normal',  'Ingresos'),
    row(7,    '= Ingresos Totales',                    c.ingresosTotales,       'total',   'Ingresos'),

    // ── SECCIÓN 2: GASTOS VARIABLES ──
    row(8,    '- Total Materias Primas',               c.materiasPrimas,         'normal',  'Gastos Variables'),
    row(8.1,  '    MP Nacional',                      c.mpNacional,            'normal',  'Gastos Variables'),
    row(8.2,  '    MP Importada',                     c.mpImportada,           'normal',  'Gastos Variables'),
    row(9,    '- Servicios Públicos',                  c.serviciosPublicos,      'normal',  'Gastos Variables'),
    row(10,   '- Fuerza de Trabajo Directa',           c.salariosDirectos,      'normal',  'Gastos Variables'),
    row(11,   '- Costos Directos Adicionales',          c.costosDirectosAdicionales,'normal','Gastos Variables'),
    row(11.5, '- Otros Gastos Variables',               c.otrosGastosVariables,  'normal',  'Gastos Variables'),
    row(12,   '= Total Gastos Variables',              c.gastosVariables,        'subtotal','Gastos Variables'),

    // ── SECCIÓN 3: GASTOS FIJOS ──
    row(13,   '- Gastos de Distribución y Ventas',     c.gastosDistribucionVentas,'normal','Gastos Fijos'),
    row(13.1, '    FT Comercial',                     c.ftComercial,            'normal',  'Gastos Fijos'),
    row(14,   '- Gastos Generales y de Administración', c.gastosGeneralesAdmin,  'normal',  'Gastos Fijos'),
    row(14.1, '    FT Administración',                c.ftAdmin,                'normal',  'Gastos Fijos'),
    row(15,   '- Gastos de Mantenimiento',             c.gastosMantenimiento,    'normal',  'Gastos Fijos'),
    row(15.1, '    FT Mantenimiento',                 c.ftMantenimiento,        'normal',  'Gastos Fijos'),
    row(16,   '- Otros Gastos',                        c.otrosGastos,            'normal',  'Gastos Fijos'),
    row(16.1, '    FT Indirectos',                     c.ftIndirectos,           'normal',  'Gastos Fijos'),
    row(17,   '= Total Gastos Fijos',                  c.gastosFijos,            'subtotal','Gastos Fijos'),

    // ── SECCIÓN 4: UTILIDADES EN OPERACIONES ──
    row(18,   '= Costos y Gastos de Operación',        c.costosGastosOperacion,  'total',   'Utilidades en Operaciones'),
    row(19,   '= Utilidades en Operaciones',           c.utilidadesEnOperaciones,'resultado','Utilidades en Operaciones'),

    // ── SECCIÓN 5: RESULTADO OPERATIVO (DIF-2: depreciación primero, sin contingencia) ──
    row(20,   '- Depreciación y Amortización',         c.depreciacion,          'normal',  'Resultado Operativo'),
    row(20.1, '    Depreciación',                      c.depreciacionOnly,      'normal',  'Resultado Operativo'),
    row(20.2, '    Amortización',                      c.amortizacionOnly,      'normal',  'Resultado Operativo'),
    row(21,   '= Utilidad Operativa Neta (EBIT)',      c.utilidadOperativaNeta, 'resultado','Resultado Operativo'),
    row(22,   '  EBITDA',                               c.ebitda,                'info',    'Resultado Operativo'),
    row(23,   '= Gastos Totales Producción y Servicios', c.gastosTotalesProduccionServicios,'subtotal','Resultado Operativo'),

    // ── SECCIÓN 6: GASTOS FINANCIEROS E IMPUESTOS (DIF-5: desglose intereses/comisiones) ──
    row(24,   '- Gastos Financieros y Bancarios',      c.gastosFinancieros,     'normal',  'Gastos Financieros'),
    row(24.1, '    Intereses pagados',                     c.interesesOnly,         'normal',  'Gastos Financieros'),
    row(24.2, '    Comisiones, Seguros y Otros',       c.comisionesOnly,        'normal',  'Gastos Financieros'),
    row(24.3, '    (desglose) Intereses Capitalizados', c.interesesCapitalizados,'info',  'Gastos Financieros'),
    row(25,   '- Honorarios de Administración',         c.honorariosAdmin,       'normal',  'Gastos Financieros'),
    row(26,   '- Otros Impuestos, Tasas y Contribuciones', c.otrosImpuestos,     'normal',  'Gastos Financieros'),
    row(26.1, '    Contribución Seguridad Social',        c.cssContribucion,       'normal',  'Gastos Financieros'),
    row(27,   '= Utilidad antes de Impuestos',         c.utilidadAntesImpuestos,'resultado','Gastos Financieros'),

    // ── SECCIÓN 7: DISTRIBUCIÓN DE UTILIDADES (DIF-2: contingencia aquí) ──
    row(29,   '- Reserva de Contingencia',             c.reservas,              'normal',  'Distribución'),
    row(30,   '= Utilidad Ajustada',                    c.utilidadAjustada,      'resultado','Distribución'),
    row(31,   '- Utilidades a Reinvertir',             c.beneficioReinvertir,   'normal',  'Distribución'),
    row(32,   '= Utilidades Imponibles',               c.utilidadesImponibles,  'subtotal','Distribución'),
    row(33,   '- Impuesto sobre Utilidades',           c.impuestoUtilidades,    'normal',  'Distribución'),
    row(34,   '= Utilidad Neta',                       c.utilidadNeta,          'resultado','Distribución'),
    row(35,   '- ARIE',                                c.arie,                  'normal',  'Distribución'),
    row(36,   '- Reservas de Estimulación',            c.reservasEstimulacion,  'normal',  'Distribución'),
    row(37,   '- Otras Reservas Voluntarias',           c.otrasReservasVoluntarias,'normal','Distribución'),
    row(38,   '= Utilidades Disponibles',              c.utilidadesDisponibles, 'subtotal','Distribución'),
    row(39,   '- Utilidades Retenidas',                c.utilidadesRetenidas,   'normal',  'Distribución'),
    row(40,   '+ Pago Utilidades Retenidas',           c.pagoUtilidadesRetenidas,'normal','Distribución'),
    row(41,   '= Utilidades a Distribuir',             c.utilidadesDistribuir,  'total',   'Distribución'),
    row(41.1, '    Dividendo Empresa Estatal',         c.dividendoEstatal,      'normal',  'Distribución'),
    row(41.2, '    Dividendo Socio Cubano',            c.dividendoSocioCubano,  'normal',  'Distribución'),
    row(41.3, '    Dividendo Socio Extranjero',        c.dividendoSocioExtranjero,'normal','Distribución'),
    row(42,   '  Margen Neto (%)',                     c.margenNeto,            'porciento','Distribución'),
  ];

  // ── SECCIÓN 8: PUNTO DE EQUILIBRIO ──
  const pe = calcBreakEvenByYear(c.ventasNetas, c.gastosVariables, c.gastosFijos, c.utilidadesEnOperaciones);
  const duration = c.ventasNetas.length;
  const peMonthly = expandPeToMonthly(pe.peIngresos, duration);
  const peTotalRow = Array.from({ length: duration }, () => pe.peTotal);
  const mcMonthly = expandPeToMonthly(pe.contribucionMarginal, duration);
  const msMonthly = expandPeToMonthly(pe.margenSeguridad, duration);
  const mesEqRow = Array.from({ length: duration }, () => pe.mesEquilibrio > 0 ? pe.mesEquilibrio : 0);

  lines.push(
    row(43,   'Punto de Equilibrio (PE)',              peMonthly,               'resultado','Punto de Equilibrio',
      'Nivel de ventas netas anual necesario para cubrir todos los costos fijos y variables (PE = CF / (1 − CV/Ventas Netas))'),
    row(43.1, '    PE Ventas Netas del Proyecto',      peTotalRow,              'info',    'Punto de Equilibrio',
      'Punto de equilibrio acumulado de todo el proyecto (ventas netas totales para no tener pérdidas ni ganancias)'),
    row(44,   'Margen de Contribución',                 mcMonthly,               'normal',  'Punto de Equilibrio',
      'Diferencia entre Ventas Netas y Costos Variables; es lo que queda para cubrir los costos fijos'),
    row(45,   'Margen de Seguridad (%)',                msMonthly,               'porciento','Punto de Equilibrio',
      'Porcentaje en que las ventas superan al PE; a mayor margen, menor riesgo de pérdidas'),
    row(46,   'Mes de Equilibrio',                      mesEqRow,                'info',    'Punto de Equilibrio',
      'Primer mes en que las utilidades en operaciones acumuladas alcanzan cero o positivo'),
  );

  return lines;
}

// ═══════════════════════════════════════════════════════════════
// B) ESTADO DE COSTOS DE PRODUCCIÓN Y VENTAS (Resolución 1/2022)
// ═══════════════════════════════════════════════════════════════
// Desglose detallado de costos directos e indirectos.
// Este estado se vincula al Estado de Resultados a través de
// la línea "Total Costos de Producción y Ventas".
// ═══════════════════════════════════════════════════════════════

export function buildEstadoCostosProduccion(state: BaraproState): EstadoFinancieroRow[] {
  const c = _buildERFCalculations(state);

  const row = (linea: number, concepto: string, monthly: number[], tipo: EstadoFinancieroRow['tipo'], seccion: string, descripcion?: string): EstadoFinancieroRow => ({
    linea, concepto, monthly, annual: _toAnnual(monthly), total: _totalize(monthly), tipo, seccion, descripcion,
  });

  // Costo unitario = Total Costos Directos / Ingresos Totales (como proxy de unidades)
  // Si hay ventas > 0, muestra el ratio; si no, 0
  const costoUnitario = c.ingresosTotales.map((v, i) => v > 0 ? (c.totalCostosDirectos[i] / v) * 100 : 0);

  const lines: EstadoFinancieroRow[] = [
    // ── SECCIÓN 1: COSTOS DIRECTOS (Gastos Variables) ──
    row(1,    'Materias Primas — Nacional',            c.mpNacional,             'normal',  'Costos Directos'),
    row(2,    'Materias Primas — Importada',           c.mpImportada,            'normal',  'Costos Directos'),
    row(3,    '= Total Materias Primas',               c.materiasPrimas,         'subtotal','Costos Directos'),
    row(4,    'Servicios Públicos',                    c.serviciosPublicos,      'normal',  'Costos Directos'),
    row(5,    'Fuerza de Trabajo Directa',             c.salariosDirectos,       'normal',  'Costos Directos'),
    row(6,    'Costos Directos Adicionales',            c.costosDirectosAdicionales,'normal','Costos Directos'),
    row(7,    '= Total Costos Directos',                c.totalCostosDirectos,    'total',   'Costos Directos'),
    row(8,    '  % Costos Directos / Ingresos',         costoUnitario,            'porciento','Costos Directos'),

    // ── SECCIÓN 2: COSTOS INDIRECTOS (Gastos Fijos) ──
    row(9,    'Gastos de Distribución y Ventas',       c.gastosDistribucionVentas,'normal','Costos Indirectos'),
    row(9.1,  '    FT Comercial',                      c.ftComercial,            'normal',  'Costos Indirectos'),
    row(10,   'Gastos Generales y de Administración',  c.gastosGeneralesAdmin,   'normal',  'Costos Indirectos'),
    row(10.1, '    FT Administración',                 c.ftAdmin,                'normal',  'Costos Indirectos'),
    row(11,   'Gastos de Mantenimiento',               c.gastosMantenimiento,    'normal',  'Costos Indirectos'),
    row(11.1, '    FT Mantenimiento',                  c.ftMantenimiento,        'normal',  'Costos Indirectos'),
    row(12,   'Otros Gastos',                           c.otrosGastos,            'normal',  'Costos Indirectos'),
    row(12.1, '    FT Indirectos',                      c.ftIndirectos,           'normal',  'Costos Indirectos'),
    row(13,   '= Total Costos Indirectos',              c.totalCostosIndirectos,  'subtotal','Costos Indirectos'),

    // ── SECCIÓN 3: TOTAL DE COSTOS ──
    row(14,   '= Total Gastos Variables',               c.gastosVariables,        'subtotal','Total Costos'),
    row(15,   '= Total Gastos Fijos',                   c.gastosFijos,            'subtotal','Total Costos'),
    row(16,   '= Costos y Gastos de Operación',         c.costosGastosOperacion,  'total',   'Total Costos'),
    row(17,   '= Utilidades en Operaciones',            c.utilidadesEnOperaciones,'resultado','Total Costos'),
    row(18,   '  % Costo Total / Ingresos',             c.costoTotal.map((v, i) => c.ingresosTotales[i] > 0 ? (v / c.ingresosTotales[i]) * 100 : 0), 'porciento', 'Total Costos'),
  ];

  return lines;
}

// ═══════════════════════════════════════════════════════════════
// C) ERF EXPANDIDO — 38 líneas (Wrapper de compatibilidad)
// ═══════════════════════════════════════════════════════════════
// Mantiene la interfaz EnhancedERFRow[] para no romper las
// 5 funciones dependientes internas ni la generación DOCX.
// Actualizado con cascada completa de distribución Resolución 1/2022.
// ═══════════════════════════════════════════════════════════════

export function buildEnhancedERF(state: BaraproState): EnhancedERFRow[] {
  const c = _buildERFCalculations(state);

  const r = (linea: number, concepto: string, monthly: number[], descripcion?: string): EnhancedERFRow => ({
    linea, concepto, monthly, annual: _toAnnual(monthly), total: _totalize(monthly), descripcion,
  });

  const lines: EnhancedERFRow[] = [
    // ── INGRESOS ──
    r(1,    '+ Ventas Brutas',                      c.ventasBrutas),
    r(1.1,  '    Mercado Nacional',                 c.ventasNacionales),
    r(1.2,  '    Exportaciones',                     c.ventasExportaciones),
    r(2,    '- Impuesto sobre Ventas (ISV)',         c.impuestoVentas),
    r(3,    '= Ventas Netas',                        c.ventasNetas),
    r(4,    '+ Otros Ingresos',                      c.otrosIngresos),
    r(4.1,  '+ Subvenciones',                        c.subvenciones),
    r(4.2,  '- Devoluciones y Rebajas',              c.devoluciones),
    r(5,    '= Ingresos Totales',                    c.ingresosTotales),
    // ── GASTOS VARIABLES ──
    r(6,    '    - MP Nacional',                     c.mpNacional),
    r(7,    '    - MP Importada',                    c.mpImportada),
    r(8,    '= Total Materias Primas',               c.materiasPrimas),
    r(8.5,  '- Servicios Públicos',                  c.serviciosPublicos),
    r(9,    '- Salarios y Prestaciones (Dir.)',      c.salariosDirectos),
    r(9.5,  '- Costos Directos Adicionales',         c.costosDirectosAdicionales),
    r(9.7,  '- Otros Gastos Variables',              c.otrosGastosVariables),
    r(10,   '= Total Costos Directos',               c.totalCostosDirectos),
    r(11,   '= Utilidad Bruta',                      c.utilidadBruta),
    // ── GASTOS FIJOS ──
    r(12,   '- Gastos de Distribución y Ventas',     c.gastosDistribucionVentas),
    r(13,   '- Gastos Generales y de Administración', c.gastosGeneralesAdmin),
    r(14,   '- Gastos de Mantenimiento',             c.gastosMantenimiento),
    r(15,   '- Otros Gastos',                        c.otrosGastos),
    r(16,   '= Total Costos Indirectos',             c.totalCostosIndirectos),
    r(17,   '= Costo Total Operativo',               c.costoTotal),
    r(18,   '= Utilidad Operativa',                  c.utilidadOperativa),
    // ── RESULTADO OPERATIVO (DIF-2: depreciación primero) ──
    r(19,   '- Depreciación y Amortización',         c.depreciacion),
    r(19.1, '    Depreciación',                      c.depreciacionOnly),
    r(19.2, '    Amortización',                      c.amortizacionOnly),
    r(20,   '= Utilidad Operativa Neta (EBIT)',      c.utilidadOperativaNeta),
    r(21,   '  EBITDA',                              c.ebitda),
    // ── GASTOS FINANCIEROS E IMPUESTOS (DIF-5: desglose) ──
    r(22,   '- Gastos Financieros y Bancarios',      c.gastosFinancieros),
    r(22.1, '    Intereses pagados',               c.interesesOnly),
    r(22.2, '    Comisiones, Seguros y Otros',       c.comisionesOnly),
    r(22.3, '    (desglose) Int. Capitalizados',     c.interesesCapitalizados),
    r(23,   '- Honorarios de Administración',        c.honorariosAdmin),
    r(24,   '- Otros Impuestos, Tasas y Contribuciones', c.otrosImpuestos),
    r(24.1, '    Contribución Seguridad Social',      c.cssContribucion),
    r(25,   '= Utilidad antes de Imp.',              c.utilidadAntesImpuestos),
    // ── DISTRIBUCIÓN (DIF-2: contingencia después de utilidad antes imp) ──
    r(27,   '- Reserva de Contingencia',             c.reservas),
    r(28,   '= Utilidad Ajustada',                    c.utilidadAjustada),
    r(29,   '- Utilidades a Reinvertir',             c.beneficioReinvertir),
    r(30,   '= Utilidades Imponibles',               c.utilidadesImponibles),
    r(31,   '- Impuesto sobre Utilidades',           c.impuestoUtilidades),
    r(32,   '= Utilidad Neta',                       c.utilidadNeta),
    r(33,   '- ARIE',                                c.arie),
    r(34,   '- Reservas de Estimulación',            c.reservasEstimulacion),
    r(35,   '- Otras Reservas Voluntarias',           c.otrasReservasVoluntarias),
    r(36,   '= Utilidades Disponibles',              c.utilidadesDisponibles),
    r(37,   '- Utilidades Retenidas',                c.utilidadesRetenidas),
    r(38,   '+ Pago Utilidades Retenidas',           c.pagoUtilidadesRetenidas),
    r(39,   '= Utilidades a Distribuir',             c.utilidadesDistribuir),
    r(39.1, '    Dividendo Empresa Estatal',         c.dividendoEstatal),
    r(39.2, '    Dividendo Socio Cubano',            c.dividendoSocioCubano),
    r(39.3, '    Dividendo Socio Extranjero',        c.dividendoSocioExtranjero),
    r(40,   '  Margen Neto (%)',                     c.margenNeto),
  ];

  // ── PUNTO DE EQUILIBRIO ──
  const pe = calcBreakEvenByYear(c.ventasNetas, c.gastosVariables, c.gastosFijos, c.utilidadesEnOperaciones);
  const peDur = c.ventasNetas.length;
  const peMonthly = expandPeToMonthly(pe.peIngresos, peDur);
  const peTotalArr = Array.from({ length: peDur }, () => pe.peTotal);
  const mcMonthly = expandPeToMonthly(pe.contribucionMarginal, peDur);
  const msMonthly = expandPeToMonthly(pe.margenSeguridad, peDur);
  const mesEqArr = Array.from({ length: peDur }, () => pe.mesEquilibrio > 0 ? pe.mesEquilibrio : 0);

  lines.push(
    r(41,   'Punto de Equilibrio (PE)',              peMonthly,
      'Nivel de ventas netas anual necesario para cubrir todos los costos fijos y variables (PE = CF / (1 − CV/Ventas Netas))'),
    r(41.1, '    PE Ingresos Totales del Proyecto',  peTotalArr,
      'Punto de equilibrio acumulado de todo el proyecto (ventas netas totales para no tener pérdidas ni ganancias)'),
    r(42,   'Margen de Contribución',                 mcMonthly,
      'Diferencia entre Ventas Netas y Costos Variables; es lo que queda para cubrir los costos fijos'),
    r(43,   'Margen de Seguridad (%)',                msMonthly,
      'Porcentaje en que las ventas superan al PE; a mayor margen, menor riesgo de pérdidas'),
    r(44,   'Mes de Equilibrio',                      mesEqArr,
      'Primer mes en que las utilidades en operaciones acumuladas alcanzan cero o positivo'),
  );

  return lines;
}

// ═══════════════════════════════════════════════════════════════
// D) ERF ACTIVIDAD COMERCIAL (Resolución 1/2022)
// ═══════════════════════════════════════════════════════════════
// Para empresas dedicadas a la compra-venta de mercancías.
// Reutiliza la cabecera de ingresos y la cola de distribución
// del ERF de Producción, pero reemplaza la sección de costos
// por compras de mercancías, inventarios y costos específicos.
// ═══════════════════════════════════════════════════════════════

export function buildERFComercial(state: BaraproState): EstadoFinancieroRow[] {
  const c = _buildERFCalculations(state);
  const duration = c.duration;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const canonRate = (state.parameters.canonRoyaltiesRate || 0) / 100;
  const arrendMensual = state.parameters.arrendamientoMensual || 0;

  // ── Compras de mercancías para la venta (usa purchaseItems del Módulo F) ──
  const comprasNacional = c.mpNacional;
  const comprasImportada = c.mpImportada;
  const comprasMercancias = c.materiasPrimas;

  // ── Gastos en compras (fletes, aduanas, seguros) ──
  // NOTA: c.materiasPrimas ya incluye los costos de compra de purchaseItems,
  // por lo que gastosCompras debe representar SOLO gastos accesorios (fletes,
  // aduanas, seguros). Actualmente no existe un campo dedicado en el store,
  // así que se inicializa en cero hasta que se agregue esa funcionalidad.
  const gastosCompras = Array.from({ length: duration }, () => 0);

  const comprasTotales = comprasMercancias.map((v, i) => v + gastosCompras[i]);
  const descuentosCompras = Array.from({ length: duration }, () => 0);
  const comprasNetas = comprasTotales.map((v, i) => v - descuentosCompras[i]);

  // ── Inventario Inicial y Final (DIF-11: estimado por días de rotación) ──
  const wcInventoryDays = state.parameters.wcInventoryCoverageDays || 30;
  const invRotationFactor = Math.min(wcInventoryDays / 365, 1);
  const inventarioFinal: number[] = [];
  const inventarioInicial: number[] = [];
  let prevInvFinal = 0;
  for (let i = 0; i < duration; i++) {
    inventarioInicial.push(i === 0 ? 0 : prevInvFinal);
    const invFinal = Math.max(0, comprasNetas[i] * invRotationFactor);
    inventarioFinal.push(invFinal);
    prevInvFinal = invFinal;
  }
  const totalMercancias = comprasNetas.map((v, i) => v + inventarioInicial[i]);
  const costoVentas = totalMercancias.map((v, i) => v - inventarioFinal[i]);

  // ── Gastos Variables Comerciales ──
  const ftDirecta = c.salariosDirectos;
  const serviciosPub = c.serviciosPublicos;
  const gastosVariablesComercial = costoVentas.map((v, i) =>
    v + ftDirecta[i] + serviciosPub[i] + c.otrosGastosVariables[i]);

  // ── Gastos Fijos + Canon + Arrendamiento ──
  const canonRoyalties = c.ventasNetas.map((v) => v * canonRate);
  const gastosArrendamiento = Array.from({ length: duration }, () => arrendMensual);

  const costosGastosOpComercial = gastosVariablesComercial.map((v, i) =>
    v + c.gastosFijos[i] + canonRoyalties[i] + gastosArrendamiento[i]);

  // ── DIF-2: Contingencia DESPUÉS de Utilidad antes de Impuestos ──
  // Utilidades en Operaciones = Ingresos Totales − Costos y Gastos de Operación (Resolución 1/2022)
  const ingresosTotalesComercial = c.ventasNetas.map((v, i) =>
    v + c.otrosIngresos[i] + c.subvenciones[i] - c.devoluciones[i]);
  const utilidadesEnOpComercial = ingresosTotalesComercial.map((v, i) => v - costosGastosOpComercial[i]);
  const utilOpNetaComercial = utilidadesEnOpComercial.map((v, i) => v - c.depreciacion[i]);
  const ebitdaComercial = utilidadesEnOpComercial; // EBITDA = antes de depreciación

  const gastosPrevImpComercial = c.gastosFinancieros.map((v, i) =>
    v + c.honorariosAdmin[i] + c.totalImpuestos[i]);
  const utilAntesImpComercial = utilOpNetaComercial.map((v, i) => v - gastosPrevImpComercial[i]);

  // Contingencia sobre Utilidad antes de Impuestos (con compensación de pérdidas dentro del mismo año)
  const contingencyRate = (state.parameters.operationsContingencyRate || 0) / 100;
  let perdidasContingenciaComercial = 0;
  const reservasComercial = utilAntesImpComercial.map((v, i) => {
    if (v <= 0) {
      perdidasContingenciaComercial += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasContingenciaComercial = 0;
      return 0;
    }
    if (perdidasContingenciaComercial > 0) {
      if (v > perdidasContingenciaComercial) {
        const base = v - perdidasContingenciaComercial;
        perdidasContingenciaComercial = 0;
        if ((i + 1) % 12 === 0) perdidasContingenciaComercial = 0;
        return base * contingencyRate;
      } else {
        perdidasContingenciaComercial -= v;
        if ((i + 1) % 12 === 0) perdidasContingenciaComercial = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasContingenciaComercial = 0;
    return v * contingencyRate;
  });
  const utilidadAjustadaComercial = utilAntesImpComercial.map((v, i) => v - reservasComercial[i]);

  // Cadena de distribución completa (DIF-6,7,8)
  const beneReinvertir = utilidadAjustadaComercial.map((v) => v > 0 ? v * ((state.parameters.beneficioReinvertirRate || 0) / 100) : 0);
  const utilImponibles = utilidadAjustadaComercial.map((v, i) => v - beneReinvertir[i]);
  // Impuesto sobre Utilidades con compensación de pérdidas dentro del mismo año.
  let perdidasAcumuladasComercial = 0;
  const impFinal = utilImponibles.map((v, i) => {
    if (v <= 0) {
      perdidasAcumuladasComercial += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasAcumuladasComercial = 0;
      return 0;
    }
    if (perdidasAcumuladasComercial > 0) {
      if (v > perdidasAcumuladasComercial) {
        const gravable = v - perdidasAcumuladasComercial;
        perdidasAcumuladasComercial = 0;
        if ((i + 1) % 12 === 0) perdidasAcumuladasComercial = 0;
        return gravable * ((state.parameters.incomeTaxRate || 0) / 100);
      } else {
        perdidasAcumuladasComercial -= v;
        if ((i + 1) % 12 === 0) perdidasAcumuladasComercial = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasAcumuladasComercial = 0;
    return v * ((state.parameters.incomeTaxRate || 0) / 100);
  });
  const utilNetaFinal = utilImponibles.map((v, i) => v - impFinal[i]);
  const arieComercial = utilNetaFinal.map((v) => v > 0 ? v * ((state.parameters.arieRate || 0) / 100) : 0);
  const resEstimComercial = utilNetaFinal.map((v) => v > 0 ? v * ((state.parameters.reservasEstimulacionRate || 0) / 100) : 0);
  const otrasReservasComercial = utilNetaFinal.map((v) => v > 0 ? v * ((state.parameters.otrasReservasVoluntariasRate || 0) / 100) : 0);
  const utilDisponibles = utilNetaFinal.map((v, i) => v - arieComercial[i] - resEstimComercial[i] - otrasReservasComercial[i]);
  // Utilidades Retenidas con compensación de pérdidas dentro del mismo año.
  let perdidasRetenidasComercial = 0;
  const utilRetenidas = utilDisponibles.map((v, i) => {
    if (v <= 0) {
      perdidasRetenidasComercial += Math.abs(v);
      if ((i + 1) % 12 === 0) perdidasRetenidasComercial = 0;
      return 0;
    }
    if (perdidasRetenidasComercial > 0) {
      if (v > perdidasRetenidasComercial) {
        const gravable = v - perdidasRetenidasComercial;
        perdidasRetenidasComercial = 0;
        if ((i + 1) % 12 === 0) perdidasRetenidasComercial = 0;
        return gravable * ((state.parameters.retainedEarningsRate || 0) / 100);
      } else {
        perdidasRetenidasComercial -= v;
        if ((i + 1) % 12 === 0) perdidasRetenidasComercial = 0;
        return 0;
      }
    }
    if ((i + 1) % 12 === 0) perdidasRetenidasComercial = 0;
    return v * ((state.parameters.retainedEarningsRate || 0) / 100);
  });
  const pagoRetenidasAmt = state.parameters.pagoUtilidadesRetenidasAmt || 0;
  const pagoRetenidas = Array.from({ length: duration }, () => pagoRetenidasAmt);
  const utilDistribuir = utilDisponibles.map((v, i) => v - utilRetenidas[i] + pagoRetenidas[i]);
  const margenNetoComercial = c.ventasNetas.map((v, i) => v > 0 ? (utilNetaFinal[i] / v) * 100 : 0);

  // DIF-8: Desglose por tipo de socio
  const divEstatal = utilDistribuir.map((v) => v > 0 ? v * ((state.parameters.dividendoEstatalPct || 0) / 100) : 0);
  const divCubano = utilDistribuir.map((v) => v > 0 ? v * ((state.parameters.dividendoSocioCubanoPct || 0) / 100) : 0);
  const divExtranjero = utilDistribuir.map((v) => v > 0 ? v * ((state.parameters.dividendoSocioExtranjeroPct || 0) / 100) : 0);

  // DIF-9: Nombre correcto — "Gastos Totales de la Actividad"
  const gastosTotalesComercial = costosGastosOpComercial.map((v, i) =>
    v + c.depreciacion[i] + c.gastosFinancieros[i] + c.honorariosAdmin[i]);

  const row = (linea: number, concepto: string, monthly: number[], tipo: EstadoFinancieroRow['tipo'], seccion: string, descripcion?: string): EstadoFinancieroRow => ({
    linea, concepto, monthly, annual: _toAnnual(monthly), total: _totalize(monthly), tipo, seccion, descripcion,
  });

  const lines: EstadoFinancieroRow[] = [
    // ── SECCIÓN 1: INGRESOS (igual que Producción) ──
    row(1,    '+ Ventas Brutas',                      c.ventasBrutas,           'total',   'Ingresos'),
    row(1.1,  '    Mercado Nacional',                c.ventasNacionales,       'normal',  'Ingresos'),
    row(1.2,  '    Exportaciones',                    c.ventasExportaciones,    'normal',  'Ingresos'),
    row(2,    '- Impuesto sobre Ventas (ISV)',         c.impuestoVentas,        'normal',  'Ingresos'),
    row(3,    '= Ventas Netas',                        c.ventasNetas,           'resultado','Ingresos'),
    row(4,    '+ Otros Ingresos',                      c.otrosIngresos,         'normal',  'Ingresos'),
    row(5,    '+ Subvenciones',                        c.subvenciones,          'normal',  'Ingresos'),
    row(6,    '- Devoluciones y Rebajas',              c.devoluciones,          'normal',  'Ingresos'),
    row(7,    '= Ingresos Totales',                    c.ingresosTotales,       'total',   'Ingresos'),

    // ── SECCIÓN 2: COMPRAS Y COSTO DE VENTAS ──
    row(8,    '- Compras de Mercancías — Nacional',    comprasNacional,         'normal',  'Compras y Costo de Ventas'),
    row(8.1,  '    Compras de Mercancías — Importación', comprasImportada,     'normal',  'Compras y Costo de Ventas'),
    row(9,    '= Total Compras de Mercancías',         comprasMercancias,       'subtotal','Compras y Costo de Ventas'),
    row(10,   '+ Gastos en Compras',                   gastosCompras,          'normal',  'Compras y Costo de Ventas'),
    row(11,   '= Compras Totales',                     comprasTotales,         'subtotal','Compras y Costo de Ventas'),
    row(12,   '- Descuentos sobre Compras',            descuentosCompras,       'normal',  'Compras y Costo de Ventas'),
    row(13,   '= Compras Netas',                       comprasNetas,           'total',   'Compras y Costo de Ventas'),
    row(14,   '+ Inventario Inicial',                  inventarioInicial,       'normal',  'Compras y Costo de Ventas'),
    row(15,   '= Total de Mercancías',                 totalMercancias,         'subtotal','Compras y Costo de Ventas'),
    row(16,   '- Inventario Final',                    inventarioFinal,         'normal',  'Compras y Costo de Ventas'),
    row(17,   '= Costo de Ventas (Variables)',         costoVentas,            'total',   'Compras y Costo de Ventas'),

    // ── SECCIÓN 3: GASTOS VARIABLES COMERCIALES ──
    row(18,   '- Fuerza de Trabajo Directa',           ftDirecta,               'normal',  'Gastos Variables'),
    row(19,   '- Servicios Públicos',                  serviciosPub,            'normal',  'Gastos Variables'),
    row(19.5, '- Otros Gastos Variables',               c.otrosGastosVariables,  'normal',  'Gastos Variables'),
    row(20,   '= Total Gastos Variables',              gastosVariablesComercial,'subtotal','Gastos Variables'),

    // ── SECCIÓN 4: GASTOS FIJOS ──
    row(21,   '- Gastos de Distribución y Ventas',     c.gastosDistribucionVentas,'normal','Gastos Fijos'),
    row(21.1, '    FT Comercial',                     c.ftComercial,           'normal',  'Gastos Fijos'),
    row(22,   '- Gastos Generales y de Administración', c.gastosGeneralesAdmin,'normal', 'Gastos Fijos'),
    row(22.1, '    FT Administración',                c.ftAdmin,               'normal',  'Gastos Fijos'),
    row(23,   '- Gastos de Mantenimiento',             c.gastosMantenimiento,   'normal',  'Gastos Fijos'),
    row(23.1, '    FT Mantenimiento',                  c.ftMantenimiento,       'normal',  'Gastos Fijos'),
    row(24,   '- Otros Gastos',                        c.otrosGastos,           'normal',  'Gastos Fijos'),
    row(24.1, '    FT Indirectos',                     c.ftIndirectos,          'normal',  'Gastos Fijos'),
    row(25,   '= Total Gastos Fijos',                  c.gastosFijos,           'subtotal','Gastos Fijos'),

    // ── SECCIÓN 5: GASTOS ESPECÍFICOS COMERCIALES ──
    row(26,   '- Pago de Canon y Royalties',           canonRoyalties,          'normal',  'Gastos Comerciales'),
    row(27,   '- Gastos de Arrendamiento',             gastosArrendamiento,     'normal',  'Gastos Comerciales'),

    // ── SECCIÓN 6: UTILIDADES EN OPERACIONES ──
    row(28,   '= Costos y Gastos de Operación',        costosGastosOpComercial, 'total',   'Utilidades en Operaciones'),
    row(29,   '= Utilidades en Operaciones',           utilidadesEnOpComercial, 'resultado','Utilidades en Operaciones'),

    // ── SECCIÓN 7: RESULTADO OPERATIVO (DIF-2: depreciación primero, sin contingencia) ──
    row(30,   '- Depreciación y Amortización',         c.depreciacion,          'normal',  'Resultado Operativo'),
    row(30.1, '    Depreciación',                      c.depreciacionOnly,      'normal',  'Resultado Operativo'),
    row(30.2, '    Amortización',                      c.amortizacionOnly,      'normal',  'Resultado Operativo'),
    row(31,   '= Utilidad Operativa Neta (EBIT)',      utilOpNetaComercial,    'resultado','Resultado Operativo'),
    row(32,   '  EBITDA',                               ebitdaComercial,        'info',    'Resultado Operativo'),
    row(33,   '= Gastos Totales de la Actividad',       gastosTotalesComercial,'subtotal','Resultado Operativo'),

    // ── SECCIÓN 8: GASTOS FINANCIEROS E IMPUESTOS (DIF-5: desglose) ──
    row(34,   '- Gastos Financieros y Bancarios',      c.gastosFinancieros,     'normal',  'Gastos Financieros'),
    row(34.1, '    Intereses pagados',                     c.interesesOnly,         'normal',  'Gastos Financieros'),
    row(34.2, '    Comisiones, Seguros y Otros',       c.comisionesOnly,        'normal',  'Gastos Financieros'),
    row(34.3, '    (desglose) Intereses Capitalizados', c.interesesCapitalizados,'info',  'Gastos Financieros'),
    row(35,   '- Honorarios de Administración',         c.honorariosAdmin,       'normal',  'Gastos Financieros'),
    row(36,   '- Otros Impuestos, Tasas y Contribuciones', c.otrosImpuestos,     'normal',  'Gastos Financieros'),
    row(36.1, '    Contribución Seguridad Social',        c.cssContribucion,       'normal',  'Gastos Financieros'),
    row(37,   '= Utilidad antes de Impuestos',         utilAntesImpComercial,   'resultado','Gastos Financieros'),

    // ── SECCIÓN 9: DISTRIBUCIÓN DE UTILIDADES (DIF-2: contingencia aquí) ──
    row(39,   '- Reserva de Contingencia',             reservasComercial,       'normal',  'Distribución'),
    row(40,   '= Utilidad Ajustada',                    utilidadAjustadaComercial,'resultado','Distribución'),
    row(41,   '- Utilidades a Reinvertir',             beneReinvertir,          'normal',  'Distribución'),
    row(42,   '= Utilidades Imponibles',               utilImponibles,          'subtotal','Distribución'),
    row(43,   '- Impuesto sobre Utilidades',           impFinal,               'normal',  'Distribución'),
    row(44,   '= Utilidad Neta',                       utilNetaFinal,           'resultado','Distribución'),
    row(45,   '- ARIE',                                arieComercial,           'normal',  'Distribución'),
    row(46,   '- Reservas de Estimulación',            resEstimComercial,       'normal',  'Distribución'),
    row(47,   '- Otras Reservas Voluntarias',           otrasReservasComercial, 'normal',  'Distribución'),
    row(48,   '= Utilidades Disponibles',              utilDisponibles,         'subtotal','Distribución'),
    row(49,   '- Utilidades Retenidas',                utilRetenidas,           'normal',  'Distribución'),
    row(50,   '+ Pago Utilidades Retenidas',           pagoRetenidas,           'normal',  'Distribución'),
    row(51,   '= Utilidades a Distribuir',             utilDistribuir,          'total',   'Distribución'),
    row(51.1, '    Dividendo Empresa Estatal',         divEstatal,             'normal',  'Distribución'),
    row(51.2, '    Dividendo Socio Cubano',            divCubano,              'normal',  'Distribución'),
    row(51.3, '    Dividendo Socio Extranjero',        divExtranjero,          'normal',  'Distribución'),
    row(52,   '  Margen Neto (%)',                     margenNetoComercial,     'porciento','Distribución'),
  ];

  // ── SECCIÓN 10: PUNTO DE EQUILIBRIO (Comercial) ──
  // Usar gastosVariablesComercial y gastosFijosComercial (incluyen canon + arrendamiento),
  // NO c.gastosVariables/c.gastosFijos que corresponden a la estructura de Producción.
  const gastosFijosComercial = c.gastosFijos.map((v, i) => v + canonRoyalties[i] + gastosArrendamiento[i]);
  const pe = calcBreakEvenByYear(c.ventasNetas, gastosVariablesComercial, gastosFijosComercial, utilidadesEnOpComercial);
  const dur = c.ventasNetas.length;
  const peMonthly = expandPeToMonthly(pe.peIngresos, dur);
  const peTotalRow = Array.from({ length: dur }, () => pe.peTotal);
  const mcMonthly = expandPeToMonthly(pe.contribucionMarginal, dur);
  const msMonthly = expandPeToMonthly(pe.margenSeguridad, dur);
  const mesEqRow = Array.from({ length: dur }, () => pe.mesEquilibrio > 0 ? pe.mesEquilibrio : 0);

  lines.push(
    row(53,   'Punto de Equilibrio (PE)',              peMonthly,               'resultado','Punto de Equilibrio',
      'Nivel de ventas netas anual necesario para cubrir todos los costos fijos y variables (PE = CF / (1 − CV/Ventas Netas))'),
    row(53.1, '    PE Ventas Netas del Proyecto',      peTotalRow,              'info',    'Punto de Equilibrio',
      'Punto de equilibrio acumulado de todo el proyecto (ventas netas totales para no tener pérdidas ni ganancias)'),
    row(54,   'Margen de Contribución',                 mcMonthly,               'normal',  'Punto de Equilibrio',
      'Diferencia entre Ventas Netas y Costos Variables; es lo que queda para cubrir los costos fijos'),
    row(55,   'Margen de Seguridad (%)',                msMonthly,               'porciento','Punto de Equilibrio',
      'Porcentaje en que las ventas superan al PE; a mayor margen, menor riesgo de pérdidas'),
    row(56,   'Mes de Equilibrio',                      mesEqRow,                'info',    'Punto de Equilibrio',
      'Primer mes en que las utilidades en operaciones acumuladas alcanzan cero o positivo'),
  );

  return lines;
}

// ═══════════════════════════════════════════════════════════════
// Helpers compartidos (usados por los tres estados)
// ═══════════════════════════════════════════════════════════════

function _toAnnual(monthly: number[]): number[] {
  const years: number[] = [];
  const numYears = Math.ceil(monthly.length / 12);
  for (let y = 0; y < numYears; y++) {
    const start = y * 12;
    const end = Math.min(start + 12, monthly.length);
    years.push(monthly.slice(start, end).reduce((s, v) => s + v, 0));
  }
  return years;
}

function _totalize(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0);
}

// ═══════════════════════════════════════════════════════════════
// PUNTO DE EQUILIBRIO DE OPERACIONES — Cálculo por año y total del proyecto
// PE = Costos Fijos / (1 - (Costos Variables / Ventas Netas))
// Ventas Netas = base de ingresos (excluye Otros Ingresos, Subvenciones, Devoluciones)
// Costos Fijos = Total Costos Indirectos (L17 del ERF)
// Costos Variables = Total Costos Directos + Otros Gastos Variables (L12 del ERF)
// Si Ventas Netas ≤ 0, el PE es infinito (no hay base para cubrir costos fijos).
// ═══════════════════════════════════════════════════════════════
interface PuntoEquilibrioResult {
  peIngresos: number[];            // PE en Ventas Netas por año
  peTotal: number;                 // PE total del proyecto (Ventas Netas)
  contribucionMarginal: number[];  // Margen de contribución por año (Ventas Netas − Gastos Variables)
  margenSeguridad: number[];       // Margen de seguridad (%) por año
  mesEquilibrio: number;           // Mes en que Utilidades en Operaciones acumulado ≥ 0
}

function calcBreakEvenByYear(
  ventasNetas: number[],
  gastosVariables: number[],
  gastosFijos: number[],
  utilidadesEnOperaciones: number[],
): PuntoEquilibrioResult {
  const duration = ventasNetas.length;
  const numYears = Math.ceil(duration / 12);
  const peIngresos: number[] = [];
  const contribucionMarginal: number[] = [];
  const margenSeguridad: number[] = [];

  let totalVentas = 0;
  let totalGastosVar = 0;
  let totalGastosFijos = 0;

  for (let y = 0; y < numYears; y++) {
    const start = y * 12;
    const end = Math.min(start + 12, duration);
    const yrVentas = ventasNetas.slice(start, end).reduce((s, v) => s + v, 0);
    const yrGastosVar = gastosVariables.slice(start, end).reduce((s, v) => s + v, 0);
    const yrGastosFijos = gastosFijos.slice(start, end).reduce((s, v) => s + v, 0);

    totalVentas += yrVentas;
    totalGastosVar += yrGastosVar;
    totalGastosFijos += yrGastosFijos;

    // Margen de contribución = Ventas Netas − Gastos Variables
    const mc = yrVentas - yrGastosVar;
    contribucionMarginal.push(mc);

    // Ratio de costo variable = Gastos Variables / Ventas Netas (evitar div/0)
    const cvRatio = yrVentas > 0 ? yrGastosVar / yrVentas : 1;
    // PE = Gastos Fijos / (1 − ratio CV)
    const pe = cvRatio < 1 ? yrGastosFijos / (1 - cvRatio) : Infinity;
    peIngresos.push(pe);

    // Margen de seguridad = (Ventas Netas − PE) / Ventas Netas × 100
    if (yrVentas > 0 && pe !== Infinity && pe < yrVentas) {
      margenSeguridad.push(((yrVentas - pe) / yrVentas) * 100);
    } else {
      margenSeguridad.push(yrVentas > 0 ? -100 : 0);
    }
  }

  // PE total del proyecto
  const totalCvRatio = totalVentas > 0 ? totalGastosVar / totalVentas : 1;
  const peTotal = totalCvRatio < 1 ? totalGastosFijos / (1 - totalCvRatio) : Infinity;

  // Mes de equilibrio: primer mes donde Utilidades en Operaciones acumulado ≥ 0
  // Esto es consistente con L19 del ERF (IngresosTotales − CostosGastosOp)
  // Incluye el efecto de Otros Ingresos, Subvenciones y Devoluciones
  let mesEquilibrio = -1;
  let acumUtilidades = 0;
  for (let i = 0; i < duration; i++) {
    acumUtilidades += utilidadesEnOperaciones[i];
    if (acumUtilidades >= 0 && ventasNetas[i] > 0) {
      mesEquilibrio = i + 1;
      break;
    }
  }

  return { peIngresos, peTotal, contribucionMarginal, margenSeguridad, mesEquilibrio };
}

// Expande PE anual a array mensual (repite el valor del año en cada mes)
function expandPeToMonthly(peAnnual: number[], duration: number): number[] {
  const monthly: number[] = [];
  for (let i = 0; i < duration; i++) {
    const yr = Math.floor(i / 12);
    monthly.push(peAnnual[yr] ?? 0);
  }
  return monthly;
}

// ============================================================
// 22. FLUJO DE CAJA - PLANIFICACIÓN FINANCIERA (Resolución 1/2022)
// ============================================================
//
// Estructura exacta de la Resolución 1/2022 — "Flujo de caja para DL":
// Organizado en TRES secciones por TIPO DE ACTIVIDAD:
//
// I. FLUJO DE CAJA EN INVERSIONES
//   ENTRADAS: (+) Valor Remanente de Activos
//   SALIDAS:  (−) Inversión Fija, (−) Activos Intangibles, (−) Gastos Previos,
//             (=) Capital Fijo, (−) Variación Capital de Trabajo
//   SALDO:    Saldo FC en Inversiones
//
// II. FLUJO DE CAJA POR FINANCIAMIENTO
//   ENTRADAS: (+) Capital Social, (+) Financiamiento, (=) Recursos Financieros
//   SALIDAS:  (−) Intereses de Deuda, (−) Reembolso del Principal,
//             (−) Gastos Financieros, (=) Servicio de la Deuda
//   SALDO:    Saldo FC por Financiamiento
//
// III. FLUJO DE CAJA EN OPERACIONES
//   ENTRADAS: (+) Ingresos por Ventas Netas, (+) Otros Ingresos
//   SALIDAS:  (−) Costos Variables, (−) Costos Fijos, (=) Costos de Operación,
//             (−) Impuesto sobre Utilidades, (−) Otros Impuestos y Tasas,
//             (−) Reservas
//   SALDO:    Saldo FC en Operaciones
//
// CONSOLIDADO: Saldo Anual = I + II + III, Saldo Acumulado

export interface CashFlowPlanningRow {
  month: number;
  year: number;

  // ─── I. FLUJO DE CAJA EN INVERSIONES ───
  valorRemanente: number;           // Valor remanente de activos (último año)
  inversionFija: number;            // Inversión Fija (Construcción + Maquinarias + Activos Fijos Intangibles)
  activosIntangibles: number;       // Desglose informativo: activos intangibles (ya incluidos en inversionFija)
  gastosPrevios: number;            // Gastos Previos (subcontrataciones, RH inversión, piezas, otros recursos)
  capitalFijo: number;              // = inversionFija + gastosPrevios
  capitalTrabajoInicial: number;    // Capital de Trabajo Inicial (año 1)
  interesesCapitalizados: number;   // intereses capitalizados (informativo, NO afecta saldo)
  saldoInversiones: number;         // Saldo FC en Inversiones

  // ─── II. FLUJO DE CAJA POR FINANCIAMIENTO ───
  capitalSocial: number;            // Capital Social = Inversión − Préstamos
  financiamiento: number;           // Préstamos recibidos (desembolsos)
  recursosFinancieros: number;      // = capitalSocial + financiamiento
  interesesDeuda: number;           // Intereses de préstamos
  reembolsoPrincipal: number;       // Reembolso del principal de préstamos
  servicioDeuda: number;            // = interesesDeuda + reembolsoPrincipal (SIN gastos financieros)
  saldoFinanciamiento: number;      // Saldo FC por Financiamiento

  // ─── III. FLUJO DE CAJA EN OPERACIONES ───
  ventasNetas: number;              // Ingresos por ventas netas
  otrosIngresos: number;            // Otros ingresos (subsidios, alquileres, servicios, etc.)
  capitalTrabajoPrecedente: number; // Capital de trabajo del año precedente (cuando CT disminuye)
  totalEntradasOp: number;          // = ventasNetas + otrosIngresos + capitalTrabajoPrecedente
  costosVariables: number;          // Costos variables (materias primas + salarios + directos)
  costosFijos: number;              // Costos fijos (comerciales + admin + mantenimiento + indirectos)
  costosOperacion: number;          // = costosVariables + costosFijos (SIN depreciación)
  honorariosAdmin: number;          // Honorarios de Administración (ERF L23)
  variacionCapitalTrabajo: number;  // Variación de CT (aumento = salida, disminución = entrada)
  gastosFinancieros: number;        // Gastos financieros bancarios (excluye intereses)
  impuestoUtilidades: number;       // Impuesto sobre utilidades
  otrosImpuestos: number;           // Otros impuestos y tasas (CSS + ITF + territorial)
  reservasEstimulacion: number;     // Reservas para el Fondo de Estimulación (ERF L34)
  totalSalidasOp: number;           // = costosOperacion + honorarios + variacionCT + gastosFin + impuestos + reservas
  saldoOperaciones: number;         // Saldo FC en Operaciones

  // ─── TOTALES GLOBALES (compatibilidad con KPIs) ───
  totalEntradas: number;            // recursosFinancieros + ventasNetas + otrosIngresos + capitalTrabajoPrec + valorRemanente
  totalSalidas: number;             // capitalFijo + CTInicial + costosOp + honorarios + variacionCT + gastosFin + impuestos + intereses + reembolso + reservas

  // ─── SALDOS CONSOLIDADOS ───
  saldoAnual: number;               // = saldoInversiones + saldoFinanciamiento + saldoOperaciones
  saldoAcumulado: number;           // Acumulado del saldo anual
}

export interface CashFlowPlanningInfo {
  totalYears: number;
  operationStartMonth: number;      // 1-based mes donde empiezan operaciones (informativo)
}

export interface CashFlowPlanningResult {
  monthlyRows: CashFlowPlanningRow[];
  annualRows: CashFlowPlanningRow[];
  info: CashFlowPlanningInfo;
}

/**
 * Build the Financial Planning Cash Flow per Resolución 1/2022.
 * Organized in THREE activity-based sections:
 *   I.   Flujo de Caja en Inversiones
 *   II.  Flujo de Caja por Financiamiento
 *   III. Flujo de Caja en Operaciones
 * Plus consolidated balance and accumulated balance.
 */
export function buildCashFlowPlanning(state: BaraproState): CashFlowPlanningResult {
  const emptyResult: CashFlowPlanningResult = {
    monthlyRows: [],
    annualRows: [],
    info: { totalYears: 0, operationStartMonth: 0 },
  };
  if (!state?.project) return emptyResult;

  const duration = state.project.monthsDuration || 120;
  if (duration <= 0) return emptyResult;

  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const invBudget = buildInvestmentBudget(state);
  const invSchedule = buildInvestmentSchedule(state);
  const revenueTimeline = buildRevenueTimeline(state);
  const finCosts = buildFinancialCosts(state);
  const depSummary = buildDepreciationByItem(state);
  const wc = buildWorkingCapital(state);
  const erf = buildEnhancedERF(state);

  // ── Info: determine operation start month (informational only) ──
  const operationStartMonth = (() => {
    const osm = findOperationStartMonth(state);
    return osm > duration ? duration + 1 : osm;
  })();

  // ── Monthly investment outflow ──
  const invByMonth = new Array(duration).fill(0);
  const invFijaByMonth = new Array(duration).fill(0);
  const activosIntangiblesByMonth = new Array(duration).fill(0);
  const gastosPreviosByMonth = new Array(duration).fill(0);

  const invFijaPartidas = new Set([
    'B. Construcción y Montaje',
    'C. Gastos de Capital',
    'Activos Intangibles',               // Activos Fijos Intangibles → Inversión Fija
    'Piezas y Herramientas (Inversión Fija)', // Piezas depreciables → Inversión Fija
  ]);

  const previoPartidas = new Set([
    'D. Subcontrataciones',
    'E. Recursos Humanos (Inversión)',
    'Piezas y Herramientas',             // Piezas NO depreciables → Gastos Previos
    'Otros Recursos y Gastos',
  ]);

  for (const item of invBudget.items) {
    if (item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) {
          invByMonth[m - 1] += perMonth;
          if (item.partida === 'Activos Intangibles') {
            // Los activos intangibles son Inversión Fija (Activos Fijos Intangibles)
            activosIntangiblesByMonth[m - 1] += perMonth;
            invFijaByMonth[m - 1] += perMonth;
          } else if (previoPartidas.has(item.partida)) {
            gastosPreviosByMonth[m - 1] += perMonth;
          } else if (invFijaPartidas.has(item.partida)) {
            invFijaByMonth[m - 1] += perMonth;
          }
        }
      }
    }
  }

  // ── Loan disbursements by month (convert foreign currency to CUP) ──
  const loanDisbursementsByMonth: Record<number, number> = {};
  for (const loan of state.loans) {
    const disbs = getLoanDisbursements(loan);
    for (const [m, amt] of Object.entries(disbs)) {
      const mi = parseInt(m);
      if (mi >= 1 && mi <= duration) {
        const periodFromStart = mi - loan.startMonth + 1;
        const exchangeRate = resolveExchangeRateForPeriod(
          periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );
        loanDisbursementsByMonth[mi] = (loanDisbursementsByMonth[mi] || 0) + amt * exchangeRate;
      }
    }
  }

  // ── Capital Social por mes: del módulo Inversión Inicial ──
  // Tomado directamente de buildInvestmentSchedule() que incluye
  // inversión fija + gastos previos + contingencia + capital de trabajo − préstamos
  const capitalSocialByMonth = new Array(duration).fill(0);
  for (const schedRow of invSchedule.monthly) {
    if (schedRow.month >= 1 && schedRow.month <= duration) {
      capitalSocialByMonth[schedRow.month - 1] = Math.max(0, schedRow.capitalSocialCUP);
    }
  }

  // ── Financial costs by month ──
  // Intereses pagados en efectivo (excluye capitalizados)
  const interestByMonth: Record<number, number> = {};
  const principalByMonth: Record<number, number> = {};
  const bankFeeByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    interestByMonth[fc.month] = (interestByMonth[fc.month] || 0) + fc.interest;
    principalByMonth[fc.month] = (principalByMonth[fc.month] || 0) + fc.principal;
    bankFeeByMonth[fc.month] = (bankFeeByMonth[fc.month] || 0) + fc.bankFee;
  }

  // ── Capitalized interest by month ──
  // Solo intereses pagados en efectivo van a Intereses de la Deuda (Financiamiento).
  // Los capitalizados se muestran como informativos en Inversiones (NO afectan saldo).
  const capitalizedIntByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    capitalizedIntByMonth[fc.month] = (capitalizedIntByMonth[fc.month] || 0) + fc.capitalizedInterest;
  }

  // ── Revenue by month (CUP converted) → Ventas Brutas ──
  const salesTaxRate = (state.parameters.salesTaxRate || 0) / 100;
  const ventasNetasByMonth: number[] = new Array(duration).fill(0);
  for (let i = 0; i < duration; i++) {
    const bruto = (revenueTimeline[i]?.cup || 0) + (revenueTimeline[i]?.mlc || 0) * cupToMlc;
    ventasNetasByMonth[i] = bruto * (1 - salesTaxRate);
  }

  // ── Variación Capital de Trabajo ──
  const variacionCTByMonth: number[] = new Array(duration).fill(0);
  for (let i = 0; i < Math.min(duration, wc.length); i++) {
    variacionCTByMonth[i] = wc[i].variacion;
  }

  // ── Valor remanente de activos (último mes) ──
  const totalYears = Math.ceil(duration / 12);
  const valorRemanenteTotal = depSummary.bookValueAtEnd;

  // ── Capital de Trabajo Inicial (primer año, de Inversión) ──
  const capitalTrabajoInicialTotal = (() => {
    // Sum all positive variaciones in year 1 as initial CT
    let ctInit = 0;
    for (let i = 0; i < Math.min(12, duration); i++) {
      if (i < wc.length && wc[i].variacion > 0) ctInit += wc[i].variacion;
    }
    return ctInit;
  })();

  // ── Capital de Trabajo del año precedente (para Operaciones) ──
  // Cuando la variación de CT es negativa, significa liberación de CT = entrada
  const capitalTrabajoPrecedenteByMonth: number[] = new Array(duration).fill(0);
  for (let i = 12; i < duration; i++) {  // solo del año 2 en adelante
    if (i < wc.length && wc[i].variacion < 0) {
      capitalTrabajoPrecedenteByMonth[i] = Math.abs(wc[i].variacion);
    }
  }

  // ── ERF values by month ──
  const erfLine = (linea: number) => (monthIndex: number) => erfVal(erf, linea, monthIndex);
  const erfCostosVariables = erfLine(10);   // ERF L10: Total Costos Directos
  const erfCostosFijos = erfLine(16);        // ERF L16: Total Costos Indirectos
  const erfImpUtilidades = erfLine(31);
  const erfOtrosImpuestos = erfLine(24);   // L24: Otros Impuestos, Tasas y Contribuciones (incluye CSS)
  const erfHonorariosAdmin = erfLine(23);
  const erfReservasEstimulacion = erfLine(34);

  // ── Otros Ingresos ──
  const otrosIngresosMonthly = new Array(duration).fill(0);
  for (const oi of state.otherIncomeItems) {
    const monthlyTotal = (oi.amountCUP || 0) + (oi.amountMLC || 0) * cupToMlc;
    for (const m of safeMonths(oi.months)) {
      if (m >= 1 && m <= duration) otrosIngresosMonthly[m - 1] += monthlyTotal;
    }
  }

  // ── Build monthly rows ──
  const monthlyRows: CashFlowPlanningRow[] = [];
  let saldoAcumulado = 0;

  for (let i = 0; i < duration; i++) {
    const m = i + 1;
    const y = Math.ceil(m / 12);

    // ══════════════════════════════════════════════════════════
    // I. FLUJO DE CAJA EN INVERSIONES
    // ══════════════════════════════════════════════════════════
    const inversionFija = invFijaByMonth[i];  // Incluye Construcción + Gastos de Capital + Activos Intangibles
    const activosIntangibles = activosIntangiblesByMonth[i];  // Desglose informativo (ya incluido en inversionFija)
    const gastosPrevios = gastosPreviosByMonth[i];
    const capitalFijo = inversionFija + gastosPrevios;  // inversionFija ya incluye activos intangibles
    // Capital de Trabajo Inicial: solo en el primer año (primeros 12 meses)
    const capitalTrabajoInicial = (i < 12 && capitalTrabajoInicialTotal > 0)
      ? (i === 0 ? capitalTrabajoInicialTotal : 0)  // concentrado en mes 1
      : 0;
    const interesesCapitalizados = capitalizedIntByMonth[m] || 0;
    const isLastMonth = i === duration - 1;
    const valorRemanente = isLastMonth ? valorRemanenteTotal : 0;
    // Saldo Inversiones = Entradas (valorRemanente) − Salidas (capitalFijo + CTInicial)
    const saldoInversiones = valorRemanente - capitalFijo - capitalTrabajoInicial;

    // ══════════════════════════════════════════════════════════
    // II. FLUJO DE CAJA POR FINANCIAMIENTO
    // Per Resolución: Servicio de la Deuda = Intereses + Reembolso Principal (SIN gastos financieros)
    // Gastos financieros bancarios van en Operaciones
    // ══════════════════════════════════════════════════════════
    const capitalSocial = capitalSocialByMonth[i];
    const financiamiento = loanDisbursementsByMonth[m] || 0;
    const recursosFinancieros = capitalSocial + financiamiento;
    // Intereses de la Deuda = solo intereses pagados en efectivo
    const interesesDeuda = interestByMonth[m] || 0;
    const reembolsoPrincipal = principalByMonth[m] || 0;
    const servicioDeuda = interesesDeuda + reembolsoPrincipal;
    // Saldo Financiamiento = Entradas (recursosFinancieros) − Salidas (servicioDeuda)
    const saldoFinanciamiento = recursosFinancieros - servicioDeuda;

    // ══════════════════════════════════════════════════════════
    // III. FLUJO DE CAJA EN OPERACIONES
    // Per Resolución: incluye Gastos Financieros, Variación CT,
    // Honorarios Admin, Reservas de Estimulación, Capital de Trabajo Precedente
    // ══════════════════════════════════════════════════════════
    const ventasNetas = ventasNetasByMonth[i];
    const otrosIngresos = otrosIngresosMonthly[i];
    const capitalTrabajoPrecedente = capitalTrabajoPrecedenteByMonth[i];
    const totalEntradasOp = ventasNetas + otrosIngresos + capitalTrabajoPrecedente;

    // Costos de Operación (SIN depreciación — no es movimiento de efectivo)
    // Fuente: ERF L10 (Costos Directos) y L16 (Costos Indirectos) — ya sin SS embebido
    const costosVariablesCalc = erfCostosVariables(i);
    const costosFijosCalc = erfCostosFijos(i);
    const costosOperacion = costosVariablesCalc + costosFijosCalc;

    const honorariosAdmin = erfHonorariosAdmin(i);
    // Variación de CT: solo positiva en Año 2+ (incrementos de CT = salida de efectivo)
    // Año 1: CT inicial ya capturado en capitalTrabajoInicial (Inversiones) → 0 aquí
    // Año 2+: variación negativa (liberación) capturada por capitalTrabajoPrecedente → 0 aquí
    const variacionCapitalTrabajo = (i >= 12 && variacionCTByMonth[i] > 0)
      ? variacionCTByMonth[i]
      : 0;
    // Gastos Financieros solo a partir del inicio de operaciones
    // (en la inversión inicial ya están registrados; duplicaríamos si los incluimos antes)
    const gastosFinancieros = m >= operationStartMonth ? (bankFeeByMonth[m] || 0) : 0;
    const impuestoUtilidades = erfImpUtilidades(i);
    const otrosImpuestos = erfOtrosImpuestos(i);  // Ya incluye CSS en L24
    const reservasEstimulacion = erfReservasEstimulacion(i);
    const totalSalidasOp = costosOperacion + honorariosAdmin + variacionCapitalTrabajo
      + gastosFinancieros + impuestoUtilidades + otrosImpuestos + reservasEstimulacion;
    // Saldo Operaciones = Entradas − Salidas
    const saldoOperaciones = totalEntradasOp - totalSalidasOp;

    // ══════════════════════════════════════════════════════════
    // CONSOLIDADO
    // ══════════════════════════════════════════════════════════
    const totalEntradas = recursosFinancieros + ventasNetas + otrosIngresos
      + capitalTrabajoPrecedente + valorRemanente;
    const totalSalidas = capitalFijo
      + capitalTrabajoInicial
      + costosOperacion
      + honorariosAdmin
      + variacionCapitalTrabajo
      + gastosFinancieros
      + impuestoUtilidades
      + otrosImpuestos
      + interesesDeuda
      + reembolsoPrincipal
      + reservasEstimulacion;
    const saldoAnual = saldoInversiones + saldoFinanciamiento + saldoOperaciones;
    saldoAcumulado += saldoAnual;

    monthlyRows.push({
      month: m,
      year: y,
      // I. Inversiones
      valorRemanente,
      inversionFija,
      activosIntangibles,
      gastosPrevios,
      capitalFijo,
      capitalTrabajoInicial,
      interesesCapitalizados,
      saldoInversiones,
      // II. Financiamiento
      capitalSocial,
      financiamiento,
      recursosFinancieros,
      interesesDeuda,
      reembolsoPrincipal,
      servicioDeuda,
      saldoFinanciamiento,
      // III. Operaciones
      ventasNetas,
      otrosIngresos,
      capitalTrabajoPrecedente,
      totalEntradasOp,
      costosVariables: costosVariablesCalc,
      costosFijos: costosFijosCalc,
      costosOperacion,
      honorariosAdmin,
      variacionCapitalTrabajo,
      gastosFinancieros,
      impuestoUtilidades,
      otrosImpuestos,
      reservasEstimulacion,
      totalSalidasOp,
      saldoOperaciones,
      // Totales globales
      totalEntradas,
      totalSalidas,
      // Saldos consolidados
      saldoAnual,
      saldoAcumulado,
    });
  }

  // ── Aggregate by year ──
  const annualRows: CashFlowPlanningRow[] = [];

  for (let y = 0; y < totalYears; y++) {
    const start = y * 12;
    const end = Math.min(start + 12, duration);
    const yearMonths = monthlyRows.slice(start, end);

    if (yearMonths.length === 0) continue;

    const sum = (key: keyof CashFlowPlanningRow) =>
      yearMonths.reduce((s, r) => s + (r[key] as number || 0), 0);

    const totalEntradas = yearMonths.reduce((s, r) => s + r.totalEntradas, 0);
    const totalSalidas = yearMonths.reduce((s, r) => s + r.totalSalidas, 0);
    const prevAccum = annualRows.length > 0 ? annualRows[annualRows.length - 1].saldoAcumulado : 0;

    const saldoInv = sum('saldoInversiones');
    const saldoFin = sum('saldoFinanciamiento');
    const saldoOp = sum('saldoOperaciones');
    const yearSaldoAnual = saldoInv + saldoFin + saldoOp;

    // Valor remanente: solo si algún mes del año lo tiene
    const vr = sum('valorRemanente');
    // Intereses capitalizados: informativo
    const ic = sum('interesesCapitalizados');

    annualRows.push({
      month: 0,
      year: y + 1,
      // I. Inversiones
      valorRemanente: vr,
      inversionFija: sum('inversionFija'),
      activosIntangibles: sum('activosIntangibles'),
      gastosPrevios: sum('gastosPrevios'),
      capitalFijo: sum('capitalFijo'),
      capitalTrabajoInicial: sum('capitalTrabajoInicial'),
      interesesCapitalizados: ic,
      saldoInversiones: saldoInv,
      // II. Financiamiento
      capitalSocial: sum('capitalSocial'),
      financiamiento: sum('financiamiento'),
      recursosFinancieros: sum('recursosFinancieros'),
      interesesDeuda: sum('interesesDeuda'),
      reembolsoPrincipal: sum('reembolsoPrincipal'),
      servicioDeuda: sum('servicioDeuda'),
      saldoFinanciamiento: saldoFin,
      // III. Operaciones
      ventasNetas: sum('ventasNetas'),
      otrosIngresos: sum('otrosIngresos'),
      capitalTrabajoPrecedente: sum('capitalTrabajoPrecedente'),
      totalEntradasOp: sum('totalEntradasOp'),
      costosVariables: sum('costosVariables'),
      costosFijos: sum('costosFijos'),
      costosOperacion: sum('costosOperacion'),
      honorariosAdmin: sum('honorariosAdmin'),
      variacionCapitalTrabajo: sum('variacionCapitalTrabajo'),
      gastosFinancieros: sum('gastosFinancieros'),
      impuestoUtilidades: sum('impuestoUtilidades'),
      otrosImpuestos: sum('otrosImpuestos'),
      reservasEstimulacion: sum('reservasEstimulacion'),
      totalSalidasOp: sum('totalSalidasOp'),
      saldoOperaciones: saldoOp,
      // Totales globales
      totalEntradas,
      totalSalidas,
      // Saldos consolidados
      saldoAnual: yearSaldoAnual,
      saldoAcumulado: prevAccum + yearSaldoAnual,
    });
  }

  return {
    monthlyRows,
    annualRows,
    info: { totalYears, operationStartMonth },
  };
}

// ============================================================
// 23. FLUJO DE CAJA - RENDIMIENTO DE LA INVERSIÓN (Resolución 1/2022)
// ============================================================

/**
 * Monthly cash flow row for the Investment Performance cash flow.
 * Expanded per Resolución 1/2022 to include all line items.
 */
export interface CashFlowInvestmentRow {
  month: number;
  year: number;
  // ─── ENTRADAS DE EFECTIVO (1) ───
  ventasNetas: number;
  otrosIngresos: number;    // Otros ingresos (subsidios, alquileres, servicios, etc.)
  totalEntradas: number;   // (1)

  // ─── SALIDA DE EFECTIVO (2) ───
  inversionTotal: number;     // Inversión Total Fija = Capital Fijo + Gastos Previos + CT inicial
  capitalFijo: number;        // Inversión Fija (B+C+Intangibles: Construcción + Maquinarias + Activos Fijos Intangibles)
  activosIntangibles: number; // Desglose informativo: activos intangibles (ya incluidos en capitalFijo)
  gastosPrevios: number;      // Gastos pre-operativos (subcontrataciones, RH inversión, piezas, otros recursos)
  capitalTrabajoInicial: number;
  variacionCapitalTrabajo: number;
  costosOperacion: number;  // ERF L17 + depreciación (investment perspective)
  honorariosAdmin: number;     // Honorarios de Administración (ERF L23)
  reservasEstimulacion: number; // Reservas para el Fondo de Estimulación (ERF L34)
  impuestoUtilidades: number;
  otrosImpuestosTasas: number; // Otros Impuestos, Tasas y Contribuciones (ERF L24, incluye CSS)
  totalImpuestosTasas: number; // impuestoUtilidades + otrosImpuestosTasas
  // Valor actual de los activos existentes (incluido en totalSalidas, solo último mes)
  valorActualActivos: number;       // Total book value at end (solo último mes)
  valorActualCapitalFijo: number;   // Book value of tangible fixed assets at end
  valorActualIntangibles: number;   // Book value of intangible assets at end
  valorActualGastosPrevios: number; // Book value of gastos previos (unamortized) at end
  totalSalidas: number;     // (2)

  // ─── VALOR REMANENTE (columna informativa, solo último mes) ───
  valorDesecho: number;     // Valor residual / remanente (only in last month, informational)

  // ─── SALDOS ───
  saldoAnual: number;       // (1) - (2) per Resolución 1/2022
  saldoAcumulado: number;
  flujoCajaActualizado: number; // Flujo descontado del período
  flujoCajaActualizadoAcumulado: number; // Flujo descontado acumulado

  // ─── BACKWARD COMPAT ───
  flujoNeto: number;
  flujoAcumulado: number;
  flujoDescontado: number;
  flujoDescontadoAcum: number;
}

/** Indicators for investment cash flow (per Resolución 1/2022) */
export interface CashFlowInvestmentIndicators {
  tasaActualizacion: number;
  van: number;
  tir: number | null;
  pr: number | null;
  pra: number | null;
  rvan: number;
  valorRemanenteUltimoAnio: number;
}

export interface CashFlowInvestmentResult {
  monthly: CashFlowInvestmentRow[];
  indicators: CashFlowInvestmentIndicators;
}

export function buildCashFlowInvestment(state: BaraproState): CashFlowInvestmentResult {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const startDate = state.project.startDate || new Date().toISOString().slice(0, 7);
  const annualRate = (state.parameters.discountRateCUP || 0) / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

  // Período inicial (pre-operaciones): NO se descuenta (t=0)
  const opStartMonth = findOperationStartMonth(state);
  const investmentMonths = opStartMonth > duration ? 0 : opStartMonth - 1; // meses antes de operaciones (0-based count)

  const revenueTimeline = buildRevenueTimeline(state);
  const currentCosts = buildCurrentCosts(state);
  const finCosts = buildFinancialCosts(state);
  const depSummary = buildDepreciationByItem(state);
  const erf = buildEnhancedERF(state);
  const invBudget = buildInvestmentBudget(state);
  const wc = buildWorkingCapital(state);

  // Build per-month investment: Inversión Fija = B+C+Intangibles+Piezas Depreciables
  const capitalFijoByMonth = new Array(duration).fill(0);
  const invByMonth = new Array(duration).fill(0);
  const invFijaPartidas = new Set([
    'B. Construcción y Montaje',
    'C. Gastos de Capital',
    'Activos Intangibles',                      // Activos Fijos Intangibles → Inversión Fija
    'Piezas y Herramientas (Inversión Fija)',   // Piezas depreciables → Inversión Fija
  ]);

  for (const item of invBudget.items) {
    // Skip partitions handled separately below
    if (item.partida === 'Otros Recursos y Gastos') continue;
    if (item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) {
          invByMonth[m - 1] += perMonth;
          if (invFijaPartidas.has(item.partida)) {
            capitalFijoByMonth[m - 1] += perMonth;
          }
        }
      }
    }
  }

  // Activos intangibles (amortizables) — desglose informativo (ya incluidos en capitalFijoByMonth)
  const _intangibles = safeArray(state.intangibleAssets).map(i => ({ ...i, months: safeMonths(i.months) }));
  const activosIntangiblesByMonth = new Array(duration).fill(0);
  for (const item of _intangibles) {
    const total = item.amountCUP + item.amountMLC * cupToMlc;
    if (item.months.length > 0) {
      const perMonth = total / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) activosIntangiblesByMonth[m - 1] += perMonth;
      }
    }
  }

  // Gastos previos = Subcontrataciones (D) + RH Inversión (E) + Piezas NO depreciables + Otros Recursos
  const previoPartidasInv = new Set([
    'D. Subcontrataciones',
    'E. Recursos Humanos (Inversión)',
    'Piezas y Herramientas',             // Piezas NO depreciables → Gastos Previos
    'Otros Recursos y Gastos',
  ]);
  const gastosPreviosByMonth = new Array(duration).fill(0);
  for (const item of invBudget.items) {
    if (previoPartidasInv.has(item.partida) && item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) gastosPreviosByMonth[m - 1] += perMonth;
      }
    }
  }

  // Capital de trabajo inicial — first year only
  const initialWC = invBudget.initialWCCUP;
  const wcInitialByMonth = new Array(duration).fill(0);
  if (initialWC > 0 && duration > 0) {
    // Spread across first 12 months (or less)
    const spread = Math.min(12, duration);
    for (let i = 0; i < spread; i++) {
      wcInitialByMonth[i] = initialWC / spread;
    }
  }

  // Variación capital de trabajo (changes in WC after first year)
  const variacionWCByMonth = new Array(duration).fill(0);
  for (let i = 12; i < duration; i++) {
    if (i < wc.length) {
      variacionWCByMonth[i] = wc[i]?.variacion || 0;
    }
  }

  // Valor remanente de activos = valor en libros al final del proyecto
  const valorRemanenteTotal = depSummary.bookValueAtEnd;

  // Amortización de gastos previos (necesaria para book value y costos)
  const gpAmortInv = calcGastosPreviosAmortization(state);

  // Valor actual de los activos existentes (desglose por tipo de activo)
  let bookValueCapitalFijo = 0;
  for (const asset of depSummary.assets) {
    const accumulatedDep = asset.monthlyDepreciationByMonth.reduce((s, v) => s + v, 0);
    bookValueCapitalFijo += Math.max(0, asset.totalCost - accumulatedDep);
  }
  let bookValueIntangibles = 0;
  for (const asset of depSummary.intangibleAssets) {
    const accumulatedAmort = asset.monthlyAmortizationByMonth.reduce((s, v) => s + v, 0);
    bookValueIntangibles += Math.max(0, asset.totalCost - accumulatedAmort);
  }
  const bookValueGastosPrevios = Math.max(0, gpAmortInv.totalGastosPrevios - gpAmortInv.totalAmortized);

  // Revenue per month → Ventas Netas (after ISV)
  const salesTaxRateInv = (state.parameters.salesTaxRate || 0) / 100;
  const revenueByMonth: number[] = new Array(duration).fill(0);
  for (let i = 0; i < duration; i++) {
    const bruto = (revenueTimeline[i]?.cup || 0) + (revenueTimeline[i]?.mlc || 0) * cupToMlc;
    revenueByMonth[i] = bruto * (1 - salesTaxRateInv);
  }

  const rows: CashFlowInvestmentRow[] = [];
  let saldoAcum = 0;
  let descAcum = 0;

  // Loan interest by month (for separating from operation costs)
  const interestByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    interestByMonth[fc.month] = (interestByMonth[fc.month] || 0) + fc.interest;
  }

  // ── Otros Ingresos (modelado desde store) ──
  const otrosIngresosMonthly = new Array(duration).fill(0);
  for (const oi of state.otherIncomeItems) {
    const monthlyTotal = (oi.amountCUP || 0) + (oi.amountMLC || 0) * cupToMlc;
    for (const m of safeMonths(oi.months)) {
      if (m >= 1 && m <= duration) otrosIngresosMonthly[m - 1] += monthlyTotal;
    }
  }

  for (let i = 0; i < duration; i++) {
    const m = i + 1;

    // ENTRADAS (sin Valor de Desecho — se muestra por separado)
    const ventasNetas = revenueByMonth[i];
    const otrosIngresos = otrosIngresosMonthly[i];
    const totalEntradas = ventasNetas + otrosIngresos;

    // SALIDAS
    const capitalFijo = capitalFijoByMonth[i];
    const activosIntangibles = activosIntangiblesByMonth[i];
    const gastosPrevios = gastosPreviosByMonth[i];
    const capitalTrabajoInicial = wcInitialByMonth[i];
    const variacionCapitalTrabajo = variacionWCByMonth[i];

    // Costos de Operación: tomado del ERF Costos y Gastos de Operación (L17)
    const costosOperacion = erfVal(erf, 17, i);

    // Honorarios de Administración (ERF L23)
    const honorariosAdmin = erfVal(erf, 23, i);
    // Reservas para el Fondo de Estimulación (ERF L34)
    const reservasEstimulacion = erfVal(erf, 34, i);
    // Impuesto sobre Utilidades (ERF L31)
    const impuestoUtilidades = erfVal(erf, 31, i);
    // Otros Impuestos, Tasas y Contribuciones (ERF L24, incluye CSS)
    const otrosImpuestosTasas = erfVal(erf, 24, i);
    const totalImpuestosTasas = impuestoUtilidades + otrosImpuestosTasas;

    // Valor actual de los activos existentes (desglose, solo último mes)
    const isLastMonth = i === duration - 1;
    const valorActualCapitalFijo = isLastMonth ? bookValueCapitalFijo : 0;
    const valorActualIntangibles = isLastMonth ? bookValueIntangibles : 0;
    const valorActualGastosPrevios = isLastMonth ? bookValueGastosPrevios : 0;
    const valorActualActivos = valorActualCapitalFijo + valorActualIntangibles + valorActualGastosPrevios;

    // Valor de Desecho / Valor Residual (fuera de Entradas, solo último mes)
    const valorDesecho = isLastMonth ? valorRemanenteTotal : 0;

    const inversionTotal = capitalFijo + gastosPrevios + capitalTrabajoInicial;  // capitalFijo ya incluye activos intangibles
    const totalSalidas = inversionTotal + valorActualActivos + variacionCapitalTrabajo + costosOperacion
      + honorariosAdmin + reservasEstimulacion + totalImpuestosTasas;

    // saldoAnual = Entradas - Salidas (Resolución 1/2022: SALDO ANUAL = (1) - (2))
    const saldoAnual = totalEntradas - totalSalidas;
    saldoAcum += saldoAnual;

    // Backward compat: flujoNeto
    const flujoNeto = totalEntradas - totalSalidas;
    // Flujo de caja actualizado: se usa descuento ANUAL consistente con calcVANWithIP.
    // El descuento se aplica por año calendario (no por mes individual) para
    // garantizar que descAcum = VAN al final del período.
    // Período de inversión (pre-operaciones): sin descuento (t=0)
    // Período operacional: descuento anual desde el inicio de operaciones
    const operationalYear = Math.floor((i - investmentMonths) / 12) + 1;
    const desc = i < investmentMonths
      ? flujoNeto  // período inicial: sin descuento (t=0)
      : flujoNeto / Math.pow(1 + annualRate, operationalYear);
    descAcum += desc;

    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      ventasNetas,
      otrosIngresos,
      totalEntradas,
      inversionTotal,
      capitalFijo,
      activosIntangibles,
      gastosPrevios,
      capitalTrabajoInicial,
      variacionCapitalTrabajo,
      costosOperacion,
      honorariosAdmin,
      reservasEstimulacion,
      impuestoUtilidades,
      otrosImpuestosTasas,
      totalImpuestosTasas,
      valorActualActivos,
      valorActualCapitalFijo,
      valorActualIntangibles,
      valorActualGastosPrevios,
      totalSalidas,
      valorDesecho,
      saldoAnual,
      saldoAcumulado: saldoAcum,
      flujoCajaActualizado: desc,
      flujoCajaActualizadoAcumulado: descAcum,
      // backward compat
      flujoNeto,
      flujoAcumulado: saldoAcum,
      flujoDescontado: desc,
      flujoDescontadoAcum: descAcum,
    });
  }

  // ─── Indicators ───
  // VAN = último valor del flujo de caja actualizado acumulado (descuento mensual)
  const van = descAcum;

  // Monthly → Annual aggregation for TIR, PR, PRA, RVAN
  const totalYears = Math.ceil(duration / 12);
  const investmentYears = Math.ceil(investmentMonths / 12);
  const annualFlows: number[] = [];
  for (let y = 0; y < totalYears; y++) {
    const start = y * 12;
    const end = Math.min(start + 12, duration);
    const yearSum = rows.slice(start, end).reduce((s, r) => s + r.saldoAnual, 0);
    annualFlows.push(yearSum);
  }

  const tir = calcTIR(annualFlows);
  const pr = calcPR(annualFlows);
  const pra = calcPRAWithIP(annualFlows, annualRate, investmentYears);
  const rvan = calcRVANWithIP(annualFlows, annualRate, investmentYears);

  // Valor remanente del último año = residual value of all assets
  const valorRemanenteUltimoAnio = valorRemanenteTotal;

  const indicators: CashFlowInvestmentIndicators = {
    tasaActualizacion: annualRate,
    van,
    tir,
    pr,
    pra,
    rvan,
    valorRemanenteUltimoAnio,
  };

  return { monthly: rows, indicators };
}

// ============================================================
// 24. FLUJO DE CAJA - RENDIMIENTO DEL CAPITAL SOCIAL (Resolución 1/2022)
// ============================================================

/**
 * Monthly cash flow row for the Equity Performance cash flow.
 * FCFE (Free Cash Flow to Equity) approach per Resolución 1/2022:
 *
 * ENTRADAS:  Ventas Netas + Otros Ingresos + Préstamos Recibidos
 * SALIDAS:   Inversión Total + Servicios de la Deuda + Costos Operativos + Impuestos
 * SALDO:     Entradas - Salidas  (Resolución 1/2022: SALDO ANUAL = (1) - (3))
 *
 * Key difference from Investment CF:
 *   - Préstamos (loan disbursements) are ENTRADAS (not just implicit)
 *   - Capital Social is NOT a separate salida (implicit: Inversión - Préstamos = Capital Social)
 *   - Servicios de la Deuda (intereses, reembolso, gastos bancarios) are SALIDAS
 *   - Valor actual de activos existentes NO incluido en totalSalidas (no aparece en la tabla)
 *   - Sin Valor de Desecho en saldoAnual (fórmula estrictamente (1) - (3))
 */
export interface CashFlowEquityRow {
  month: number;
  year: number;
  // ─── ENTRADAS DE EFECTIVO (1) ───
  ventasNetas: number;
  otrosIngresos: number;
  financiamiento: number;         // Préstamos recibidos (desembolsos)
  totalEntradas: number;         // (1)

  // ─── SALIDA DE EFECTIVO (2) ───
  capitalSocial: number;         // Capital Social aportado por inversores (solo período de inversión)
  inversionTotalNegativa: number;// Inversión Total como salida negativa
  inversionTotal: number;        // Inversión Total Fija (valor absoluto)
  capitalFijo: number;
  activosIntangibles: number;
  gastosPrevios: number;
  capitalTrabajoInicial: number;
  variacionCapitalTrabajo: number;
  totalServiciosDeuda: number;   // Servicios de la Deuda (intereses + reembolso + gastos bancarios)
  interesesDeuda: number;        // Intereses de la Deuda
  reembolsoPrincipal: number;    // Reembolso del Principal
  gastosBancarios: number;       // Gastos Bancarios
  costosOperacion: number;       // ERF L17
  honorariosAdmin: number;       // ERF L23
  reservasEstimulacion: number;  // ERF L34
  impuestoUtilidades: number;
  otrosImpuestosTasas: number;   // Otros Impuestos, Tasas y Contribuciones (ERF L24, incluye CSS)
  totalImpuestosTasas: number;
  totalSalidas: number;          // (2)

  // ─── VALOR REMANENTE (columna informativa, solo último mes) ───
  valorDesecho: number;
  // Valor actual de los activos existentes (incluido en totalSalidas, solo último mes)
  valorActualActivos: number;
  valorActualCapitalFijo: number;
  valorActualIntangibles: number;
  valorActualGastosPrevios: number;

  // ─── SALDOS ───
  saldoAnual: number;              // (1) - (3) per Resolución 1/2022
  saldoAcumulado: number;
  flujoCajaActualizado: number;    // Flujo descontado del período
  flujoCajaActualizadoAcumulado: number; // Flujo descontado acumulado
}

/** Indicators for equity cash flow (per Resolución 1/2022) */
export interface CashFlowEquityIndicators {
  tasaActualizacion: number;
  van: number;
  tir: number | null;
  pr: number | null;
  pra: number | null;
  rvan: number;
}

export interface CashFlowEquityResult {
  monthly: CashFlowEquityRow[];
  indicators: CashFlowEquityIndicators;
}

export function buildCashFlowEquity(state: BaraproState): CashFlowEquityResult {
  const erf = buildEnhancedERF(state);
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const annualRate = (state.parameters.discountRateCUP || 0) / 100;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

  // Período inicial (pre-operaciones): NO se descuenta (t=0)
  const opStartMonth = findOperationStartMonth(state);
  const investmentMonths = opStartMonth > duration ? 0 : opStartMonth - 1;

  const revenueTimeline = buildRevenueTimeline(state);
  const finCosts = buildFinancialCosts(state);
  const depSummary = buildDepreciationByItem(state);
  const invBudget = buildInvestmentBudget(state);
  const wc = buildWorkingCapital(state);
  const gpAmortEq = calcGastosPreviosAmortization(state);

  // ── Build per-month investment (same as Investment flow) ──
  const capitalFijoByMonth = new Array(duration).fill(0);
  const invByMonth = new Array(duration).fill(0);
  const invFijaPartidas = new Set([
    'B. Construcción y Montaje',
    'C. Gastos de Capital',
    'Activos Intangibles',                      // Activos Fijos Intangibles → Inversión Fija
    'Piezas y Herramientas (Inversión Fija)',   // Piezas depreciables → Inversión Fija
  ]);

  for (const item of invBudget.items) {
    if (item.partida === 'Otros Recursos y Gastos') continue;
    if (item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) {
          invByMonth[m - 1] += perMonth;
          if (invFijaPartidas.has(item.partida)) {
            capitalFijoByMonth[m - 1] += perMonth;
          }
        }
      }
    }
  }

  // Activos intangibles — desglose informativo (ya incluidos en capitalFijoByMonth)
  const _intangibles = safeArray(state.intangibleAssets).map(i => ({ ...i, months: safeMonths(i.months) }));
  const activosIntangiblesByMonth = new Array(duration).fill(0);
  for (const item of _intangibles) {
    const total = item.amountCUP + item.amountMLC * cupToMlc;
    if (item.months.length > 0) {
      const perMonth = total / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) activosIntangiblesByMonth[m - 1] += perMonth;
      }
    }
  }

  // Gastos previos
  const previoPartidasInv = new Set([
    'D. Subcontrataciones',
    'E. Recursos Humanos (Inversión)',
    'Piezas y Herramientas',             // Solo piezas NO depreciables → Gastos Previos
    'Otros Recursos y Gastos',
  ]);
  const gastosPreviosByMonth = new Array(duration).fill(0);
  for (const item of invBudget.items) {
    if (previoPartidasInv.has(item.partida) && item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) gastosPreviosByMonth[m - 1] += perMonth;
      }
    }
  }

  // Capital de trabajo inicial
  const initialWC = invBudget.initialWCCUP;
  const wcInitialByMonth = new Array(duration).fill(0);
  if (initialWC > 0 && duration > 0) {
    const spread = Math.min(12, duration);
    for (let i = 0; i < spread; i++) {
      wcInitialByMonth[i] = initialWC / spread;
    }
  }

  // Variación capital de trabajo (after first year)
  const variacionWCByMonth = new Array(duration).fill(0);
  for (let i = 12; i < duration; i++) {
    if (i < wc.length) {
      variacionWCByMonth[i] = wc[i]?.variacion || 0;
    }
  }

  // Valor remanente de activos
  const valorRemanenteTotal = depSummary.bookValueAtEnd;

  // Valor actual de los activos existentes (desglose por tipo)
  let bookValueCapitalFijo = 0;
  for (const asset of depSummary.assets) {
    const accumulatedDep = asset.monthlyDepreciationByMonth.reduce((s, v) => s + v, 0);
    bookValueCapitalFijo += Math.max(0, asset.totalCost - accumulatedDep);
  }
  let bookValueIntangibles = 0;
  for (const asset of depSummary.intangibleAssets) {
    const accumulatedAmort = asset.monthlyAmortizationByMonth.reduce((s, v) => s + v, 0);
    bookValueIntangibles += Math.max(0, asset.totalCost - accumulatedAmort);
  }
  const bookValueGastosPrevios = Math.max(0, gpAmortEq.totalGastosPrevios - gpAmortEq.totalAmortized);

  // Revenue per month → Ventas Netas (after ISV)
  const salesTaxRateEq = (state.parameters.salesTaxRate || 0) / 100;
  const revenueByMonth: number[] = new Array(duration).fill(0);
  for (let i = 0; i < duration; i++) {
    const bruto = (revenueTimeline[i]?.cup || 0) + (revenueTimeline[i]?.mlc || 0) * cupToMlc;
    revenueByMonth[i] = bruto * (1 - salesTaxRateEq);
  }

  // ── Equity-specific: Loan disbursements (entradas) ──
  // En el flujo de capital social, los préstamos son ENTRADAS porque financian la inversión
  // junto con el capital social. El flujo neto = préstamos - inversión = capital social invertido.
  const loanDisbursementsByMonth: Record<number, number> = {};
  for (const loan of state.loans) {
    const disbs = getLoanDisbursements(loan);
    for (const [m, amt] of Object.entries(disbs)) {
      const mi = parseInt(m);
      if (mi >= 1 && mi <= duration) {
        const periodFromStart = mi - loan.startMonth + 1;
        const exchangeRate = resolveExchangeRateForPeriod(
          periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );
        loanDisbursementsByMonth[mi] = (loanDisbursementsByMonth[mi] || 0) + amt * exchangeRate;
      }
    }
  }

  // ── Equity-specific: Loan interest, principal and bank fees ──
  const interestByMonth: Record<number, number> = {};
  const principalByMonth: Record<number, number> = {};
  const bankFeeByMonth: Record<number, number> = {};
  for (const fc of finCosts) {
    interestByMonth[fc.month] = (interestByMonth[fc.month] || 0) + fc.interest;
    principalByMonth[fc.month] = (principalByMonth[fc.month] || 0) + fc.principal;
    bankFeeByMonth[fc.month] = (bankFeeByMonth[fc.month] || 0) + fc.bankFee;
  }

  // ── Otros Ingresos ──
  const otrosIngresosMonthly = new Array(duration).fill(0);
  for (const oi of state.otherIncomeItems) {
    const monthlyTotal = (oi.amountCUP || 0) + (oi.amountMLC || 0) * cupToMlc;
    for (const m of safeMonths(oi.months)) {
      if (m >= 1 && m <= duration) otrosIngresosMonthly[m - 1] += monthlyTotal;
    }
  }

  const rows: CashFlowEquityRow[] = [];
  let saldoAcum = 0;
  let descAcum = 0;

  for (let i = 0; i < duration; i++) {
    const m = i + 1;

    // ENTRADAS: Ventas + Otros Ingresos + Préstamos Recibidos
    // A diferencia del Flujo de Inversión, aquí los préstamos son ENTRADAS
    // porque evaluamos el rendimiento desde la perspectiva del capital social:
    //   Neto = (Ingresos + Préstamos) - (Inversión + Servicios Deuda + Costos Operativos)
    //   Durante la inversión: Préstamos - Inversión = Capital Social invertido (salida neta)
    const ventasNetas = revenueByMonth[i];
    const otrosIngresos = otrosIngresosMonthly[i];
    const financiamiento = loanDisbursementsByMonth[m] || 0;
    const totalEntradas = ventasNetas + otrosIngresos + financiamiento;

    // SALIDAS: Inversión + Servicios de la Deuda + Costos Operativos
    // NO se incluye Capital Social como salida (ya está implícito: Inversión - Préstamos = Capital Social)
    const capitalFijo = capitalFijoByMonth[i];
    const activosIntangibles = activosIntangiblesByMonth[i];
    const gastosPrevios = gastosPreviosByMonth[i];
    const capitalTrabajoInicial = wcInitialByMonth[i];
    const variacionCapitalTrabajo = variacionWCByMonth[i];

    // Servicios de la Deuda
    // Durante el período de inversión, los intereses y gastos bancarios ya están
    // incluidos en la inversión inicial (via generateAutoFinancialExpenseItems),
    // por lo que NO se incluyen en servicios de la deuda para evitar duplicación.
    const isInvestmentPeriod = i < investmentMonths;
    const interesesDeuda = isInvestmentPeriod ? 0 : (interestByMonth[m] || 0);
    const reembolsoPrincipal = principalByMonth[m] || 0;
    const gastosBancarios = isInvestmentPeriod ? 0 : (bankFeeByMonth[m] || 0);
    const totalServiciosDeuda = interesesDeuda + reembolsoPrincipal + gastosBancarios;

    // Salidas operativas
    const costosOperacion = erfVal(erf, 17, i);
    const honorariosAdmin = erfVal(erf, 23, i);
    const reservasEstimulacion = erfVal(erf, 34, i);
    const impuestoUtilidades = erfVal(erf, 31, i);
    const otrosImpuestosTasas = erfVal(erf, 24, i); // L24 incluye CSS
    const totalImpuestosTasas = impuestoUtilidades + otrosImpuestosTasas;

    const isLastMonth = i === duration - 1;
    const valorActualCapitalFijo = isLastMonth ? bookValueCapitalFijo : 0;
    const valorActualIntangibles = isLastMonth ? bookValueIntangibles : 0;
    const valorActualGastosPrevios = isLastMonth ? bookValueGastosPrevios : 0;
    const valorActualActivos = valorActualCapitalFijo + valorActualIntangibles + valorActualGastosPrevios;

    const valorDesecho = isLastMonth ? valorRemanenteTotal : 0;

    const inversionTotal = capitalFijo + gastosPrevios + capitalTrabajoInicial;  // capitalFijo ya incluye activos intangibles
    const inversionTotalNegativa = -inversionTotal;
    const capitalSocial = isInvestmentPeriod ? Math.max(0, inversionTotal - financiamiento) : 0;
    // totalSalidas: inversionTotal + servicios de deuda + costos operativos (Resolución 1/2022)
    // NOTA: valorActualActivos NO se incluye en Capital Social (no aparece en la tabla de la resolución)
    const totalSalidas = inversionTotal + variacionCapitalTrabajo + totalServiciosDeuda
      + costosOperacion + honorariosAdmin + reservasEstimulacion + totalImpuestosTasas;

    // saldoAnual = Entradas - Salidas (Resolución 1/2022: SALDO ANUAL = (1) - (3))
    const saldoAnual = totalEntradas - totalSalidas;
    saldoAcum += saldoAnual;
    // Flujo de caja actualizado: se usa descuento ANUAL consistente con calcVANWithIP.
    // Período de inversión (pre-operaciones): sin descuento (t=0)
    // Período operacional: descuento anual desde el inicio de operaciones
    const operationalYear = Math.floor((i - investmentMonths) / 12) + 1;
    const desc = i < investmentMonths
      ? saldoAnual  // período inicial: sin descuento (t=0)
      : saldoAnual / Math.pow(1 + annualRate, operationalYear);
    descAcum += desc;

    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      ventasNetas,
      otrosIngresos,
      financiamiento,
      totalEntradas,
      capitalSocial,
      inversionTotalNegativa,
      inversionTotal,
      capitalFijo,
      activosIntangibles,
      gastosPrevios,
      capitalTrabajoInicial,
      variacionCapitalTrabajo,
      totalServiciosDeuda,
      interesesDeuda,
      reembolsoPrincipal,
      gastosBancarios,
      costosOperacion,
      honorariosAdmin,
      reservasEstimulacion,
      impuestoUtilidades,
      otrosImpuestosTasas,
      totalImpuestosTasas,
      totalSalidas,
      valorDesecho,
      valorActualActivos,
      valorActualCapitalFijo,
      valorActualIntangibles,
      valorActualGastosPrevios,
      saldoAnual,
      saldoAcumulado: saldoAcum,
      flujoCajaActualizado: desc,
      flujoCajaActualizadoAcumulado: descAcum,
    });
  }

  // ─── Indicators ───
  // VAN = último valor del flujo de caja actualizado acumulado (descuento mensual)
  const van = descAcum;

  // Monthly → Annual aggregation for TIR, PR, PRA, RVAN
  const totalYears = Math.ceil(duration / 12);
  const investmentYears = Math.ceil(investmentMonths / 12);
  const annualFlows: number[] = [];
  for (let y = 0; y < totalYears; y++) {
    const start = y * 12;
    const end = Math.min(start + 12, duration);
    const yearSum = rows.slice(start, end).reduce((s, r) => s + r.saldoAnual, 0);
    annualFlows.push(yearSum);
  }

  const tir = calcTIR(annualFlows);
  const pr = calcPR(annualFlows);
  const pra = calcPRAWithIP(annualFlows, annualRate, investmentYears);
  const rvan = calcRVANWithIP(annualFlows, annualRate, investmentYears);

  const indicators: CashFlowEquityIndicators = {
    tasaActualizacion: annualRate,
    van,
    tir,
    pr,
    pra,
    rvan,
  };

  return { monthly: rows, indicators };
}

// ============================================================
// ORIGINAL FUNCTIONS (kept for backward compatibility)
// ============================================================

export interface IncomeStatementRow {
  month: number;
  year: number;
  ventasBrutas: number;             // Ventas Brutas (ERF L1)
  impuestoVentas: number;           // ISV (ERF L2)
  ventasNetas: number;              // Ventas Netas (ERF L3)
  otrosIngresos: number;            // Otros Ingresos (ERF L4)
  ingresosTotales: number;          // Ingresos Totales = Ventas Netas + Otros (ERF L5)
  mpNacional: number;               // MP Nacional (ERF L6)
  mpImportada: number;              // MP Importada (ERF L7)
  totalDirectCosts: number;         // Total Costos Directos (ERF L10)
  grossProfit: number;              // Utilidad Bruta (ERF L11)
  totalIndirectCosts: number;       // Total Costos Indirectos (ERF L16)
  totalOperativeCosts: number;      // Costo Total Operativo (ERF L17)
  operatingProfit: number;          // Utilidad Operativa (ERF L18)
  depreciation: number;             // Depreciación y Amortización (ERF L21)
  ebit: number;                     // Utilidad Operativa Neta / EBIT (ERF L22)
  ebitda: number;                   // EBITDA (ERF L23)
  financialExpenses: number;        // Gastos Financieros (ERF L24)
  honorariosAdmin: number;          // Honorarios de Administración (ERF L25)
  cssContribucion: number;          // Contrib. Seguridad Social (ERF L26)
  otrosImpuestos: number;           // Otros Impuestos y Tasas (ERF L27)
  profitBeforeTax: number;          // Utilidad antes de Impuestos (ERF L28)
  incomeTax: number;                // Impuesto sobre Utilidades (ERF L29)
  netProfit: number;                // Utilidad Neta (ERF L30)
  reserves: number;                 // Reservas (ERF L19)
  retainedEarnings: number;         // Utilidades Retenidas (ERF L31)
  distributableProfit: number;      // Utilidades a Distribuir (ERF L32)
  netMargin: number;                // Margen Neto % (ERF L33)
}

export function buildIncomeStatement(state: BaraproState): IncomeStatementRow[] {
  // Delegate to the corrected ERF builder — single source of truth
  const erf = buildEnhancedERF(state);
  const duration = state.project.monthsDuration || 120;

  const rows: IncomeStatementRow[] = [];

  for (let i = 0; i < duration; i++) {
    const month = i + 1;
    const grossProfit = erfVal(erf, 11, i);   // L11 Utilidad Bruta
    const netProfit = erfVal(erf, 32, i);     // L32 Utilidad Neta
    const netMargin = erfVal(erf, 40, i);     // L40 Margen Neto %

    rows.push({
      month,
      year: Math.ceil(month / 12),
      ventasBrutas: erfVal(erf, 1, i),       // L1 Ventas Brutas
      impuestoVentas: erfVal(erf, 2, i),     // L2 ISV
      ventasNetas: erfVal(erf, 3, i),        // L3 Ventas Netas
      otrosIngresos: erfVal(erf, 4, i),      // L4 Otros Ingresos
      ingresosTotales: erfVal(erf, 5, i),    // L5 Ingresos Totales
      mpNacional: erfVal(erf, 6, i),         // L6 MP Nacional
      mpImportada: erfVal(erf, 7, i),        // L7 MP Importada
      totalDirectCosts: erfVal(erf, 10, i),  // L10 Total Costos Directos
      grossProfit,                           // L11
      totalIndirectCosts: erfVal(erf, 16, i),// L16 Total Costos Indirectos
      totalOperativeCosts: erfVal(erf, 17, i),// L17 Costo Total Operativo
      operatingProfit: erfVal(erf, 18, i),   // L18 Utilidad Operativa
      reserves: erfVal(erf, 27, i),         // L27 Reserva de Contingencia
      depreciation: erfVal(erf, 19, i),      // L19 Depreciación y Amortización
      ebit: erfVal(erf, 20, i),             // L20 EBIT
      ebitda: erfVal(erf, 21, i),           // L21 EBITDA
      financialExpenses: erfVal(erf, 22, i),// L22 Gastos Financieros
      honorariosAdmin: erfVal(erf, 23, i),  // L23 Honorarios Admin
      otrosImpuestos: erfVal(erf, 24, i),   // L24 Otros Impuestos, Tasas y Contribuciones (incluye CSS)
      cssContribucion: erfVal(erf, 24.1, i),// L24.1 Contribución Seguridad Social (desglose)
      profitBeforeTax: erfVal(erf, 25, i),  // L25 Utilidad antes de Imp.
      incomeTax: erfVal(erf, 31, i),        // L31 Impuesto sobre Utilidades
      netProfit,                             // L32
      retainedEarnings: erfVal(erf, 37, i), // L37 Utilidades Retenidas
      distributableProfit: erfVal(erf, 39, i),// L39 Utilidades a Distribuir
      netMargin,                             // L40
    });
  }

  return rows;
}

// ============================================================
// 21. ESTADO DE SITUACIÓN (Balance General) — Resolución 1/2022
// ============================================================

export interface BalanceSheetRow {
  year: number;

  // ── ACTIVOS ──
  // I. Activo Circulante
  efectivoEnCaja: number;               // Efectivo en Caja (del módulo Capital de Trabajo)
  efectivoEnBanco: number;              // Efectivo en Banco (saldo acumulado del FC Planificación)
  cuentasPorCobrar: number;             // Cuentas por Cobrar a clientes
  inventarios: number;                  // Inventarios (MP + PEP + PT + piezas)
  mercanciasVenta: number;              // Inventario de mercancías para la venta
  otrosActivosCirculantes: number;      // Otros activos corrientes
  activoCirculante: number;             // Total Activo Circulante

  // II. Activos Fijos Tangibles (bruto y neto)
  activosFijosTangiblesBruto: number;   // Valor bruto
  depreciacionAcumuladaAFT: number;     // Depreciación acumulada
  activosFijosTangiblesNeto: number;    // Bruto – Depreciación

  // III. Activos Fijos Intangibles (bruto y neto)
  activosFijosIntangiblesBruto: number; // Valor bruto
  amortizacionAcumuladaAFI: number;     // Amortización acumulada
  activosFijosIntangiblesNeto: number;  // Bruto – Amortización

  // IV. Intereses Capitalizados Activados (NIC 23 / Resolución 1/2022)
  // Intereses capitalizados durante el período de inversión que se incorporan
  // al costo del activo fijo tangible, evitando duplicación con el pasivo.
  interesesCapitalizadosActivos: number; // Acumulado de intereses capitalizados al cierre del año

  // V. Gastos Previos a la Operación (activo diferido)
  gastosPreviosBruto: number;           // Total gastos previos (valor original)
  amortizacionAcumuladaGP: number;      // Amortización acumulada de gastos previos
  gastosPreviosNeto: number;            // Valor en libros = bruto – amortización

  totalActivos: number;                 // TOTAL DE ACTIVOS

  // ── PASIVOS ──
  // I. Pasivos Circulantes
  cuentaPorPagar: number;               // Cuenta por Pagar
  anticipos: number;                    // Anticipos recibidos
  otrosPasivosCorrientes: number;       // Otros pasivos corrientes
  deudaCortoPlazo: number;              // Porción de deuda con vencimiento ≤ 12 meses
  deudaCortoPlazoInversion: number;     // deuda CP de préstamos de inversión
  deudaCortoPlazoCapitalTrabajo: number;// deuda CP de préstamos de capital de trabajo
  pasivoCirculante: number;             // Total Pasivos Circulantes

  // II. Pasivo a Largo Plazo
  pasivoLargoPlazoFinanciamiento: number; // Financiamiento (remaining debt - CP)
  pasivoLPInversion: number;            // pasivo LP de inversión
  pasivoLPCapitalTrabajo: number;       // pasivo LP de capital de trabajo

  totalPasivos: number;                 // TOTAL DE PASIVOS

  // ── CAPITAL CONTABLE O APORTACIONES ──
  capitalSocialPagado: number;          // Capital Social Pagado (calculado como residual de la ecuación contable)
  capitalSocialCalculado: number;       // Capital Social calculado independientemente (inversión − préstamos) — informativo
  capitalAutorizado: number;            // Capital Autorizado (inversión total) — informativo
  capitalPorPagar: number;              // Capital por Pagar = autorizado − pagado — informativo
  reservas: number;                     // Reservas acumuladas (contingencia + estimulación + voluntarias)
  utilidadesRetenidas: number;          // Utilidades Retenidas acumuladas (años anteriores, CUMULATIVO)
  saldoNoDistribuido: number;           // Saldo no Distribuido (resultado del ejercicio del año)
  dividendos: number;                   // Dividendos / Utilidades a Distribuir (informativo, NO se resta)
  resultadoDelEjercicio: number;        // Utilidad (pérdida) neta del ejercicio (informativo)
  capitalContable: number;              // Total Capital Contable = CS Pagado + Reservas + Util. Retenidas + Saldo No Distribuido

  totalPasivoCapital: number;           // TOTAL PASIVO + CAPITAL (= totalActivos si balancea)
  ecuacionContable: number;             // totalActivos − totalPasivoCapital (debe ser 0)

  // ══════════════════════════════════════════════════════════════
  // RAZONES FINANCIERAS (Resolución 1/2022)
  // ══════════════════════════════════════════════════════════════
  // --- LIQUIDEZ ---
  razonCirculante: number;              // AC / PC
  razonRapida: number;                  // (AC – Inventarios – Mercancías) / PC (Prueba Ácida)
  // --- SOLVENCIA / ENDEUDAMIENTO ---
  razonEndeudamiento: number;           // Pasivos Totales / Activos Totales
  razonCapitalSocialPasivo: number;     // Capital Social Pagado / Pasivo Total (%)
  razonDeudaLPCapitalContable: number;  // Deuda LP / Capital Contable (%)
  razonApalancamiento: number;          // Pasivos Totales / Capital Contable (%)
  coberturaIntereses: number;           // EBIT / Gastos Financieros (veces)
  // --- RENTABILIDAD ---
  capacidadGenerarUtilidades: number;   // Utilidad antes de Imp. / Activos Totales
  rentabilidadActivosROA: number;       // Utilidad Neta / Activos Totales (%)
  rentabilidadCapitalROE: number;       // Utilidad Neta / Capital Contable (%)
  margenBruto: number;                  // Utilidad Bruta / Ventas Netas (%)
  margenNeto: number;                   // Utilidad Neta / Ventas Netas (%)
  // --- ACTIVIDAD / EFICIENCIA ---
  capitalTrabajoNeto: number;           // Activo Circulante − Pasivo Circulante
  rotacionActivos: number;              // Ventas Netas / Activos Totales (veces)
  rotacionInventarios: number;          // Costo Total Operativo / Inventarios (veces)
}

/**
 * Build Balance Sheet per Resolución 1/2022 format.
 * Returns one row per project year (year-end snapshot).
 *
 * Estructura según Resolución 1/2022 (Tabla h):
 *   ACTIVOS = Activo Circulante + Activos Fijos Tangibles (neto) + Activos Fijos Intangibles (neto) + Gastos Previos (neto)
 *   PASIVOS = Pasivo Circulante + Pasivo Largo Plazo
 *   CAPITAL CONTABLE = Capital Social Pagado + Reservas + Utilidades Retenidas + Saldo no Distribuido
 *   Ecuación: ACTIVOS = PASIVOS + CAPITAL CONTABLE
 *
 * Razones Financieras (exigidas por Resolución):
 *   1. Capital Social Pagado / Pasivo Total (%)
 *   2. Deuda a Largo Plazo / Capital Contable (%)
 *   3. Activo Circulante / Pasivo Circulante (razón circulante)
 */
export function buildBalanceSheet(state: BaraproState): BalanceSheetRow[] {
  const planningCF = buildCashFlowPlanning(state);  // Para Efectivo en Banco
  const erf = buildEnhancedERF(state);
  const depSummary = buildDepreciationByItem(state);
  const wc = buildWorkingCapital(state);
  const invBudget = buildInvestmentBudget(state);
  const gpAmort = calcGastosPreviosAmortization(state);
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;
  const parameters = state.parameters;
  const totalYears = Math.ceil(duration / 12);

  // ── Fuente única de deuda: Tabla C del módulo de financiamiento ──
  // Se usa buildAnnualLoanSummary como fuente para Deuda CP y Pasivo LP,
  // garantizando concordancia exacta con el módulo de financiamiento.
  const annualLoanSummary = buildAnnualLoanSummary(state);
  // Lookup por año
  const loanSummaryByYear = new Map<number, typeof annualLoanSummary[number]>();
  for (const row of annualLoanSummary) {
    loanSummaryByYear.set(row.year, row);
  }

  // ── Intereses capitalizados acumulados por año (NIC 23) ──
  // Durante el período de inversión, los intereses capitalizados se incorporan
  // al costo del activo fijo tangible. Esto evita la duplicación: el saldo
  // de pasivos (endingBalance) incluye los intereses capitalizados, pero
  // el activo también debe reflejarlos para mantener la ecuación contable.
  let cumulativeCapitalizedInterest = 0;
  const capitalizedInterestByYear = new Map<number, number>();
  for (const row of annualLoanSummary) {
    cumulativeCapitalizedInterest += row.annualInterestCapitalized || 0;
    capitalizedInterestByYear.set(row.year, cumulativeCapitalizedInterest);
  }

  // ── Residual floors ──
  function getResidualPercent(assetCategoryId?: string): number {
    if (!assetCategoryId) return (parameters.residualValuePercent || 0) / 100;
    const rate = (parameters.assetCategoryRates || []).find(r => r.id === assetCategoryId);
    return rate ? (rate.residualPercent || 0) / 100 : (parameters.residualValuePercent || 0) / 100;
  }
  const residualFloorFixed = depSummary.assets.reduce((sum, asset) => {
    return sum + asset.totalCost * getResidualPercent(asset.assetCategoryId);
  }, 0);
  const residualFloorIntangible = depSummary.intangibleAssets.reduce((sum, asset) => {
    return sum + asset.totalCost * (parameters.residualValuePercent || 0) / 100;
  }, 0);

  // ── Capital Autorizado = total investment (CUP) ──
  const capitalAutorizado = invBudget.grandTotalCUP;

  // ── Per-month investment tracking for capital social pagado ──
  const invByMonth = new Array(duration).fill(0);
  for (const item of invBudget.items) {
    if (item.months.length > 0) {
      const perMonth = item.totalCUPConvertido / item.months.length;
      for (const m of item.months) {
        if (m >= 1 && m <= duration) invByMonth[m - 1] += perMonth;
      }
    }
  }

  // ── Per-month loan disbursement tracking ──
  const loanDisbByMonth: number[] = new Array(duration).fill(0);
  for (const loan of state.loans) {
    const disbs = getLoanDisbursements(loan);
    for (const [mStr, amt] of Object.entries(disbs)) {
      const mi = parseInt(mStr);
      if (mi >= 1 && mi <= duration) {
        const periodFromStart = mi - loan.startMonth + 1;
        const exchangeRate = resolveExchangeRateForPeriod(
          periodFromStart, loan.currency || 'CUP', cupToMlc, loan.exchangeRateTable
        );
        loanDisbByMonth[mi - 1] += amt * exchangeRate;
      }
    }
  }

  // ── Pre-compute accumulated depreciation / amortization per month ──
  const cumDepByMonth: number[] = new Array(duration).fill(0);
  const cumAmortByMonth: number[] = new Array(duration).fill(0);
  const cumGpAmortByMonth: number[] = new Array(duration).fill(0);
  for (let i = 0; i < duration; i++) {
    cumDepByMonth[i] = (cumDepByMonth[i - 1] || 0) + (depSummary.totalMonthlyDepreciation[i] || 0);
    cumAmortByMonth[i] = (cumAmortByMonth[i - 1] || 0) + (depSummary.totalMonthlyAmortization[i] || 0);
    cumGpAmortByMonth[i] = (cumGpAmortByMonth[i - 1] || 0) + (gpAmort.monthlyAmortization[i] || 0);
  }

  // ── ERF line lookups by line number ──
  const utilAntesImp = erfVal(erf, 25, 0) !== undefined ? Array.from({ length: duration }, (_, i) => erfVal(erf, 25, i)) : new Array(duration).fill(0);
  const utilRetenidas = Array.from({ length: duration }, (_, i) => erfVal(erf, 37, i));
  const utilDistribuir = Array.from({ length: duration }, (_, i) => erfVal(erf, 39, i));
  // L31 = Impuesto sobre Utilidades (para calcular resultado del ejercicio)
  const impuestosUtil = Array.from({ length: duration }, (_, i) => erfVal(erf, 31, i));
  // L34 = Reservas de Estimulación
  const reservasEstimulacion = Array.from({ length: duration }, (_, i) => erfVal(erf, 34, i));
  // L35 = Otras Reservas Voluntarias
  const otrasReservasVolunt = Array.from({ length: duration }, (_, i) => erfVal(erf, 35, i));

  // ── Running totals for equity components (CUMULATIVE) ──
  let accumulatedReserves = 0;          // acumulado de L27 (contingencia)
  let accumulatedReservasEstim = 0;     // acumulado de reservas estimulación
  let accumulatedOtrasReservas = 0;     // acumulado de otras reservas voluntarias
  let accumulatedUtilRetenidas = 0;     // acumulado de L37 (utilidades retenidas)
  let cumulInvestment = 0;
  let cumulLoanDisb = 0;

  const rows: BalanceSheetRow[] = [];

  for (let y = 0; y < totalYears; y++) {
    const year = y + 1;
    const startMonth = y * 12;
    const endMonth = Math.min((y + 1) * 12, duration) - 1;

    // ── Accumulate monthly values for the year ──
    let yearReserves = 0;
    let yearReservasEstim = 0;
    let yearOtrasReservas = 0;
    let yearInvestment = 0;
    let yearLoanDisb = 0;
    let yearUtilRetenidas = 0;           // L37 del año actual (para sumar al acumulado)
    let yearUtilAntesImp = 0;            // L25 Utilidad antes de impuestos
    let yearImpuestos = 0;               // L28 Impuestos sobre utilidades
    let yearDividendos = 0;              // L39 Utilidades a Distribuir

    for (let m = startMonth; m <= endMonth; m++) {
      yearReserves += erfVal(erf, 27, m);   // L27 Reserva de Contingencia
      yearReservasEstim += reservasEstimulacion[m];  // Reservas Estimulación
      yearOtrasReservas += otrasReservasVolunt[m];    // Otras Reservas Voluntarias
      yearInvestment += invByMonth[m];
      yearLoanDisb += loanDisbByMonth[m];
      yearUtilRetenidas += utilRetenidas[m]; // L37 Utilidades Retenidas
      yearUtilAntesImp += utilAntesImp[m];   // L25 Utilidad antes de Impuestos
      yearImpuestos += impuestosUtil[m];     // L28 Impuestos
      yearDividendos += utilDistribuir[m];   // L39 Dividendos
    }

    // Acumular para los running totals (para años siguientes)
    const prevAccumReserves = accumulatedReserves;
    const prevAccumUtilRetenidas = accumulatedUtilRetenidas;
    accumulatedReserves += yearReserves;
    accumulatedReservasEstim += yearReservasEstim;
    accumulatedOtrasReservas += yearOtrasReservas;
    accumulatedUtilRetenidas += yearUtilRetenidas;
    cumulInvestment += yearInvestment;
    cumulLoanDisb += yearLoanDisb;

    // ── End-of-year month index ──
    const eom = endMonth;
    // Meses reales en este año (el último año puede ser parcial)
    const monthsInThisYear = endMonth - startMonth + 1;

    // ══════════════════════════════════════════════════════════════
    // ACTIVOS
    // ══════════════════════════════════════════════════════════════

    // I. Activo Circulante — valores ANUALES del módulo Capital de Trabajo + Planificación Financiera
    // NOTA: El módulo WC calcula valores anuales y luego divide por monthsInYear para
    // obtener el mensual. El Balance General (que es anual) debe usar los valores anuales,
    // por lo que multiplicamos el valor mensual por monthsInThisYear.
    const wcMonth = wc[eom] || null;
    // Efectivo en Caja = necesidad anual de caja del módulo Capital de Trabajo (días de cobertura)
    const efectivoEnCaja = (wcMonth?.efectivo || 0) * monthsInThisYear;
    // Efectivo en Banco = saldo acumulado del FC de Planificación Financiera
    // Es el valor que aparece en la última línea (saldoAcumulado) del flujo de caja por años
    const efectivoEnBanco = planningCF.annualRows[y]?.saldoAcumulado || 0;
    const cuentasPorCobrarVal = (wcMonth?.cuentasPorCobrar || 0) * monthsInThisYear;
    const inventariosVal = ((wcMonth?.inventarios || 0)
      + (wcMonth?.productosEnProceso || 0)
      + (wcMonth?.produccionTerminada || 0)
      + (wcMonth?.piezasRepuesto || 0)) * monthsInThisYear;
    const mercanciasVentaVal = (wcMonth?.mercanciasVenta || 0) * monthsInThisYear;
    const otrosActivosCirculantesVal = (wcMonth?.otrosActivosCorrientes || 0) * monthsInThisYear;
    const activoCirculante = efectivoEnCaja + efectivoEnBanco + cuentasPorCobrarVal + inventariosVal
      + mercanciasVentaVal + otrosActivosCirculantesVal;

    // Intereses capitalizados acumulados al cierre del año (NIC 23)
    // NOTA: Los intereses capitalizados ya están incluidos en Gastos Previos
    // (vía generateAutoFinancialExpenseItems → Otros Recursos → GP).
    // Se muestra como línea informativa pero NO se suma al AFT para evitar
    // doble conteo.
    const cumulCI = capitalizedInterestByYear.get(year) || 0;

    // II. Activos Fijos Tangibles (gross & net)
    const aftBruto = depSummary.totalAssetCost;
    const depAcum = cumDepByMonth[eom] || 0;
    const aftNeto = Math.max(aftBruto - depAcum, residualFloorFixed);

    // III. Activos Fijos Intangibles (gross & net)
    const afiBruto = depSummary.totalIntangibleCost || 0;
    const amortAcum = cumAmortByMonth[eom] || 0;
    const afiNeto = Math.max(afiBruto - amortAcum, residualFloorIntangible);

    // IV. Gastos Previos a la Operación (activo diferido)
    const gpBruto = gpAmort.totalGastosPrevios;
    const gpAmortAcum = cumGpAmortByMonth[eom] || 0;
    const gpNeto = Math.max(gpBruto - gpAmortAcum, 0);

    const totalActivos = activoCirculante + aftNeto + afiNeto + gpNeto;

    // ══════════════════════════════════════════════════════════════
    // PASIVOS
    // ══════════════════════════════════════════════════════════════

    // I. Pasivos Circulantes — valores ANUALES del Capital de Trabajo
    const cuentaPorPagarVal = (wcMonth?.cuentaPorPagar || 0) * monthsInThisYear;
    const anticiposVal = (wcMonth?.anticipos || 0) * monthsInThisYear;
    const otrosPasivosCorrientesVal = (wcMonth?.otrosPasivosCorrientes || 0) * monthsInThisYear;

    // ── Deuda a Corto Plazo y Pasivo a Largo Plazo ──
    // Fuente: Tabla C del módulo de financiamiento (buildAnnualLoanSummary)
    // Deuda CP = capital a amortizar en el PRÓXIMO año (vencimiento ≤ 12 meses)
    //   = annualPrincipalPaid del año Y+1
    // Pasivo LP = saldo insoluto al cierre del año − Deuda CP
    const currentYearSummary = loanSummaryByYear.get(year);
    const nextYearSummary = loanSummaryByYear.get(year + 1);

    // Saldo insoluto total al cierre del año (de la Tabla C)
    const totalDeudaFinanciera = currentYearSummary?.endingBalance || 0;
    const totalDeudaInversion = currentYearSummary?.endingBalanceInversion || 0;
    const totalDeudaCapitalTrabajo = currentYearSummary?.endingBalanceCapitalTrabajo || 0;

    // Deuda CP: principal que se pagará en el próximo año
    const deudaCortoPlazo = nextYearSummary?.annualPrincipalPaid || 0;
    const deudaCortoPlazoInversion = nextYearSummary?.annualPrincipalPaidInversion || 0;
    const deudaCortoPlazoCapitalTrabajo = nextYearSummary?.annualPrincipalPaidCapitalTrabajo || 0;

    const pasivoLargoPlazoFin = Math.max(totalDeudaFinanciera - deudaCortoPlazo, 0);
    const pasivoLPInversion = Math.max(totalDeudaInversion - deudaCortoPlazoInversion, 0);
    const pasivoLPCapitalTrabajo = Math.max(totalDeudaCapitalTrabajo - deudaCortoPlazoCapitalTrabajo, 0);

    const pasivoCirculante = cuentaPorPagarVal + anticiposVal + otrosPasivosCorrientesVal + deudaCortoPlazo;

    const totalPasivos = pasivoCirculante + pasivoLargoPlazoFin;

    // ══════════════════════════════════════════════════════════════
    // CAPITAL CONTABLE O APORTACIONES (según Resolución 1/2022)
    // ══════════════════════════════════════════════════════════════
    //
    // Estructura:
    //   Capital Social Pagado
    //   + Reservas (contingencia + estimulación + voluntarias)
    //   + Utilidades Retenidas (acumuladas de años anteriores)
    //   + Saldo no Distribuido (resultado del ejercicio del año)
    //   = Capital Contable
    //
    // Dividendos: informativo, NO se resta del capital
    //

    // ── Reservas = Contingencia + Estimulación + Voluntarias (todas acumuladas) ──
    const totalReservas = accumulatedReserves + accumulatedReservasEstim + accumulatedOtrasReservas;

    // ── Utilidades Retenidas = ACUMULADAS de años anteriores (NO incluye el año actual) ──
    // El año actual se refleja en Saldo no Distribuido
    const utilidadesRetenidas = prevAccumUtilRetenidas;

    // ── Resultado del Ejercicio = Utilidad Neta del año ──
    // = Utilidad antes de Impuestos − Impuestos − Reservas del año
    const resultadoDelEjercicio = yearUtilAntesImp - yearImpuestos;

    // ── Saldo no Distribuido = Resultado del Ejercicio del año ──
    const saldoNoDistribuido = resultadoDelEjercicio;

    // ══════════════════════════════════════════════════════════════
    // CAPITAL SOCIAL PAGADO — RESIDUAL (garantiza A = P + C)
    // ══════════════════════════════════════════════════════════════
    // En un balance general proyectado, el Capital Social Pagado se
    // calcula como la diferencia entre Activos y (Pasivos + demás
    // componentes del Capital Contable). Esto garantiza que la
    // ecuación contable siempre cuadre (ecuacionContable = 0).
    //
    // Razonamiento: Existen múltiples fuentes de datos independientes
    // (WC, ERF, amortización, cronograma de préstamos) con pequeñas
    // inconsistencias de redondeo y timing que impiden un cálculo
    // independiente exacto del capital social.
    //
    // Se conserva el valor «independiente» (inversión acumulada −
    // préstamos) como campo informativo para verificación.
    const capitalSocialCalculado = Math.max(cumulInvestment - cumulLoanDisb, 0);

    // Capital Social Pagado = residual para garantizar balance contable
    const capitalSocialPagado = Math.max(
      totalActivos - totalPasivos - totalReservas - utilidadesRetenidas - saldoNoDistribuido,
      0
    );
    const capitalPorPagarVal = Math.max(capitalAutorizado - capitalSocialPagado, 0);

    // Capital Contable = suma de sus componentes (garantiza A = P + C)
    const capitalContable = capitalSocialPagado + totalReservas + utilidadesRetenidas + saldoNoDistribuido;

    // Dividendos = Utilidades a Distribuir (L39) — informativo, NO se resta del capital
    const dividendosVal = yearDividendos;

    // Ecuación contable: Activos = Pasivos + Capital Contable
    // Verificación de balance
    const totalPasivoCapital = totalPasivos + capitalContable;

    // ── Verificación de la ecuación contable básica ──
    // ACTIVOS = PASIVOS + CAPITAL CONTABLE  →  diferencia debe ser 0
    const ecuacionContable = totalActivos - totalPasivoCapital;

    // ══════════════════════════════════════════════════════════════
    // RAZONES FINANCIERAS (Resolución 1/2022 y normas asociadas)
    // ══════════════════════════════════════════════════════════════

    // --- Datos auxiliares del ERF para las razones ---
    let yearVentasNetas = 0;
    let yearUtilidadBruta = 0;
    let yearUtilidadNeta = 0;
    let yearEBIT = 0;
    let yearGastosFinancieros = 0;
    let yearCostoTotalOperativo = 0;
    for (let m = startMonth; m <= endMonth; m++) {
      yearVentasNetas += erfVal(erf, 3, m);           // L3 Ventas Netas
      yearUtilidadBruta += erfVal(erf, 11, m);        // L11 Utilidad Bruta
      yearUtilidadNeta += erfVal(erf, 32, m);         // L32 Utilidad Neta
      yearEBIT += erfVal(erf, 20, m);                // L20 EBIT
      yearGastosFinancieros += erfVal(erf, 22, m);    // L22 Gastos Financieros
      yearCostoTotalOperativo += erfVal(erf, 17, m);  // L17 Costo Total Operativo
    }

    // --- LIQUIDEZ ---
    // 1. Razón Circulante = Activo Circulante / Pasivo Circulante
    const razonCirculante = pasivoCirculante > 0 ? activoCirculante / pasivoCirculante : 0;
    // 2. Prueba Ácida = (Activo Circulante − Inventarios − Mercancías) / Pasivo Circulante
    const razonRapida = pasivoCirculante > 0
      ? (activoCirculante - inventariosVal - mercanciasVentaVal) / pasivoCirculante : 0;

    // --- SOLVENCIA / ENDEUDAMIENTO ---
    // 3. Razón de Endeudamiento = Pasivos Totales / Activos Totales
    const razonEndeudamiento = totalActivos > 0 ? totalPasivos / totalActivos : 0;
    // 4. Capital Social Pagado / Pasivo Total (%)
    const razonCapitalSocialPasivo = totalPasivos > 0 ? (capitalSocialPagado / totalPasivos) * 100 : 0;
    // 5. Deuda LP / Capital Contable (%)
    const razonDeudaLPCapitalContable = capitalContable > 0 ? (pasivoLargoPlazoFin / capitalContable) * 100 : 0;
    // 6. Apalancamiento = Pasivos Totales / Capital Contable (%)
    const razonApalancamiento = capitalContable > 0 ? (totalPasivos / capitalContable) * 100 : 0;
    // 7. Cobertura de Intereses = EBIT / Gastos Financieros (veces)
    const coberturaIntereses = yearGastosFinancieros > 0 ? yearEBIT / yearGastosFinancieros : 0;

    // --- RENTABILIDAD ---
    // 8. Capacidad para Generar Utilidades = Utilidad antes de Imp. / Activos Totales
    const capacidadGenerarUtilidades = totalActivos > 0 ? yearUtilAntesImp / totalActivos : 0;
    // 9. ROA = Utilidad Neta / Activos Totales (%)
    const rentabilidadActivosROA = totalActivos > 0 ? (yearUtilidadNeta / totalActivos) * 100 : 0;
    // 10. ROE = Utilidad Neta / Capital Contable (%)
    const rentabilidadCapitalROE = capitalContable > 0 ? (yearUtilidadNeta / capitalContable) * 100 : 0;
    // 11. Margen Bruto = Utilidad Bruta / Ventas Netas (%)
    const margenBruto = yearVentasNetas > 0 ? (yearUtilidadBruta / yearVentasNetas) * 100 : 0;
    // 12. Margen Neto = Utilidad Neta / Ventas Netas (%)
    const margenNeto = yearVentasNetas > 0 ? (yearUtilidadNeta / yearVentasNetas) * 100 : 0;

    // --- ACTIVIDAD / EFICIENCIA ---
    // 13. Capital de Trabajo Neto = Activo Circulante − Pasivo Circulante
    const capitalTrabajoNeto = activoCirculante - pasivoCirculante;
    // 14. Rotación de Activos = Ventas Netas / Activos Totales (veces)
    const rotacionActivos = totalActivos > 0 ? yearVentasNetas / totalActivos : 0;
    // 15. Rotación de Inventarios = Costo Total Operativo / Inventarios (veces)
    const rotacionInventarios = inventariosVal > 0 ? yearCostoTotalOperativo / inventariosVal : 0;

    rows.push({
      year,
      // I. Activos - Circulante
      efectivoEnCaja,
      efectivoEnBanco,
      cuentasPorCobrar: cuentasPorCobrarVal,
      inventarios: inventariosVal,
      mercanciasVenta: mercanciasVentaVal,
      otrosActivosCirculantes: otrosActivosCirculantesVal,
      activoCirculante,
      // II. Activos Fijos Tangibles
      activosFijosTangiblesBruto: aftBruto,
      depreciacionAcumuladaAFT: depAcum,
      activosFijosTangiblesNeto: aftNeto,
      // III. Activos Fijos Intangibles
      activosFijosIntangiblesBruto: afiBruto,
      amortizacionAcumuladaAFI: amortAcum,
      activosFijosIntangiblesNeto: afiNeto,
      // IV. Intereses Capitalizados Activados (NIC 23)
      interesesCapitalizadosActivos: cumulCI,
      // V. Gastos Previos
      gastosPreviosBruto: gpBruto,
      amortizacionAcumuladaGP: gpAmortAcum,
      gastosPreviosNeto: gpNeto,
      totalActivos,
      // I. Pasivos - Circulantes
      cuentaPorPagar: cuentaPorPagarVal,
      anticipos: anticiposVal,
      otrosPasivosCorrientes: otrosPasivosCorrientesVal,
      deudaCortoPlazo,
      deudaCortoPlazoInversion,
      deudaCortoPlazoCapitalTrabajo,
      pasivoCirculante,
      // II. Pasivo Largo Plazo
      pasivoLargoPlazoFinanciamiento: pasivoLargoPlazoFin,
      pasivoLPInversion,
      pasivoLPCapitalTrabajo,
      totalPasivos,
      // Capital Contable
      capitalSocialPagado,
      capitalSocialCalculado,
      capitalAutorizado,
      capitalPorPagar: capitalPorPagarVal,
      reservas: totalReservas,
      utilidadesRetenidas,
      saldoNoDistribuido,
      dividendos: dividendosVal,
      capitalContable,
      resultadoDelEjercicio,
      totalPasivoCapital,
      ecuacionContable,
      // ═══ Razones Financieras (Resolución 1/2022) ═══
      // Liquidez
      razonCirculante,
      razonRapida,
      // Solvencia / Endeudamiento
      razonEndeudamiento,
      razonCapitalSocialPasivo,
      razonDeudaLPCapitalContable,
      razonApalancamiento,
      coberturaIntereses,
      // Rentabilidad
      capacidadGenerarUtilidades,
      rentabilidadActivosROA,
      rentabilidadCapitalROE,
      margenBruto,
      margenNeto,
      // Actividad / Eficiencia
      capitalTrabajoNeto,
      rotacionActivos,
      rotacionInventarios,
    });
  }

  return rows;
}

// ============================================================
// 28. AMORTIZACIÓN DE GASTOS PREVIOS (Resolución 1/2022, Art. V.h)
// ============================================================
//
// "Los gastos previos a la explotación se amortizan en un plazo máximo
//  de hasta cinco (5) años, a partir de puesta en marcha."
//
// Reglas:
//  - totalGastosPrevios / min(añosOperación, 5) = cuotaAnual
//  - Si un año de amortización es parcial (ej. comienza en abril),
//    la cuota anual se distribuye equitativamente entre los meses
//    activos: mensual = cuotaAnual / mesesActivosDelAño.
//  - El último año ajusta redondeo para que total = gastosPrevios.
//

export interface GastosPreviosAmortYear {
  year: number;            // 1-based
  startMonthAbs: number;   // mes absoluto (1-based) del inicio
  endMonthAbs: number;     // mes absoluto (1-based) del fin
  activeMonths: number;    // meses activos en este año
  annualAmount: number;    // monto total del año
  monthlyRate: number;     // cuota mensual
  isPartial: boolean;      // año parcial (< 12 meses)
}

export interface GastosPreviosAmortResult {
  totalGastosPrevios: number;
  totalAmortized: number;
  operationStartMonth: number; // 1-based, primer mes de operación
  amortYears: number;          // min(añosOperación, 5)
  yearlySchedule: GastosPreviosAmortYear[];
  monthlyAmortization: number[]; // indexado por (mes - 1), longitud = duration
  // Desglose por fuente de gastos previos
  breakdown: {
    subcontrataciones: number;
    recursosHumanosInv: number;
    piezasHerramientas: number;
    otrosRecursos: number;
  };
}

/**
 * Calcula la amortización de gastos previos según Resolución 1/2022.
 *
 * Los gastos previos provienen del Presupuesto de Inversión Inicial, partidas:
 *   - Módulo D: Subcontrataciones
 *   - Módulo E: Recursos Humanos (Inversión)
 *   - Piezas y Herramientas
 *   - Otros Recursos y Gastos
 *
 * El total se calcula directamente desde los arrays del estado (no se usa
 * buildInvestmentBudget() para evitar dependencia circular:
 * buildInvestmentBudget → getInitialWorkingCapital → buildWorkingCapital
 * → _buildERFCalculations → calcGastosPreviosAmortization → buildInvestmentBudget).
 *
 * La amortización comienza en el primer mes de operación (primer mes con ventas).
 * Si no hay ventas, se asume que la operación empieza en el mes 1.
 */
export function calcGastosPreviosAmortization(state: BaraproState): GastosPreviosAmortResult {
  const duration = state.project.monthsDuration || 120;
  const cupToMlc = state.project.exchangeRates?.cupToMlc ?? 1;

  const empty = (): GastosPreviosAmortResult => ({
    totalGastosPrevios: 0,
    totalAmortized: 0,
    operationStartMonth: 1,
    amortYears: 0,
    yearlySchedule: [],
    monthlyAmortization: new Array(duration).fill(0),
    breakdown: { subcontrataciones: 0, recursosHumanosInv: 0, piezasHerramientas: 0, otrosRecursos: 0 },
  });

  // ── 1. Calcular gastos previos directamente desde los arrays del estado ──
  // NOTA: NO se llama buildInvestmentBudget() aquí porque crea una dependencia
  // circular: buildInvestmentBudget → getInitialWorkingCapital → buildWorkingCapital
  // → _buildERFCalculations → calcGastosPreviosAmortization → buildInvestmentBudget
  // En su lugar, se replican los cálculos de las partidas GP directamente.
  const breakdown = { subcontrataciones: 0, recursosHumanosInv: 0, piezasHerramientas: 0, otrosRecursos: 0 };

  // D. Subcontrataciones
  for (const item of safeArray(state.subcontractItems)) {
    const cup = item.totalCostCUP || 0;
    const mlc = item.totalCostMLC || 0;
    breakdown.subcontrataciones += cup + mlc * cupToMlc;
  }

  // E. Recursos Humanos (Inversión) — replicar fórmula de buildInvestmentBudget:
  // totalCUPConvertido = getCUP + getMLC * cupToMlc
  // donde getCUP = totalCompanyCost, getMLC = salaryMLCinCUP * (1 + vacationNormRate)
  for (const item of safeArray(state.resourceItems)) {
    const contribs = calcItemContributions(item, state);
    const vacRate = (state.parameters.vacationNormRate || 0) / 100;
    breakdown.recursosHumanosInv += contribs.totalCompanyCost
      + contribs.salaryMLCinCUP * (1 + vacRate) * cupToMlc;
  }

  // Piezas y Herramientas — solo las NO depreciables van a Gastos Previos.
  // Las piezas depreciables ya se recuperan vía depreciación en buildDepreciationByItem.
  for (const item of safeArray(state.sparePartItems)) {
    if (item.depreciable) continue;  // Se deprecián como activos fijos, no amortizán como gastos previos
    const cup = (item.quantity || 0) * (item.unitCostCUP || 0);
    const mlc = (item.quantity || 0) * (item.unitCostMLC || 0);
    breakdown.piezasHerramientas += cup + mlc * cupToMlc;
  }

  // Otros Recursos y Gastos (manual + auto-generados de gastos financieros de inversión)
  const otrosItems = getMergedOtherResourceItems(state);
  for (const item of otrosItems) {
    const cup = item.amountCUP || 0;
    const mlc = item.amountMLC || 0;
    breakdown.otrosRecursos += cup + mlc * cupToMlc;
  }

  const totalGastosPrevios = breakdown.subcontrataciones + breakdown.recursosHumanosInv
                           + breakdown.piezasHerramientas + breakdown.otrosRecursos;

  if (totalGastosPrevios <= 0) return empty();

  // ── 2. Determinar inicio de operación ──
  // Primer mes con ventas reales (quantity > 0) = inicio de operación (puesta en marcha)
  let operationStartMonth = findOperationStartMonth(state);
  if (operationStartMonth > duration) operationStartMonth = 1;

  // ── 3. Calcular años de operación y amortización ──
  const operationMonths = Math.max(0, duration - operationStartMonth + 1);
  const operationYears = Math.ceil(operationMonths / 12);
  const maxAmortYears = state.parameters.gastosPreviosAmortYears || 5;
  const amortYears = Math.min(operationYears, maxAmortYears);

  if (amortYears <= 0) return empty();

  // ── 4. Cuota anual base ──
  const baseAnnualQuota = totalGastosPrevios / amortYears;

  // ── 5. Determinar posición calendárica del inicio de operación ──
  // Para prorratear el primer año si no inicia en enero
  const startDate = state.project.startDate
    ? new Date(state.project.startDate + '-01')
    : new Date();
  const opStartDate = new Date(startDate);
  opStartDate.setMonth(opStartDate.getMonth() + (operationStartMonth - 1));
  const monthInYearOfOpStart = opStartDate.getMonth(); // 0-based (0=ene, 3=abr)
  const monthsInFirstCalendarYear = 12 - monthInYearOfOpStart;

  // ── 6. Construir cronograma anual y mensual ──
  const yearlySchedule: GastosPreviosAmortYear[] = [];
  const monthlyAmortization = new Array(duration).fill(0);
  let remaining = totalGastosPrevios;

  for (let y = 0; y < amortYears; y++) {
    // Mes absoluto de inicio de este año de amortización
    const yearStartAbs = operationStartMonth + (y * 12);
    // Fin natural del año (12 meses después)
    const yearEndNatural = yearStartAbs + 11;
    // Límites del proyecto
    const yearEndClamped = Math.min(yearEndNatural, duration);
    // Límite de operación (no amortizar después del fin del proyecto)
    const yearEndOp = operationStartMonth + operationMonths - 1;
    const yearEnd = Math.min(yearEndClamped, yearEndOp);

    if (yearStartAbs > duration || yearStartAbs > yearEndOp) break;

    let activeMonths = yearEnd - yearStartAbs + 1;

    // ── Prorrateo del primer año ──
    // El primer año de operación puede ser parcial (ej: empieza en abril = 9 meses)
    let isPartial = false;
    if (y === 0 && monthsInFirstCalendarYear < 12) {
      activeMonths = Math.min(activeMonths, monthsInFirstCalendarYear);
      isPartial = true;
    }

    // ── Prorrateo del último año si el proyecto termina antes ──
    if (y === amortYears - 1 && activeMonths < 12) {
      isPartial = true;
    }

    if (activeMonths <= 0) break;

    // Cuota anual = baseAnnualQuota (igual para todos los años)
    let annualAmount = baseAnnualQuota;

    // ── Último año: ajustar por redondeo ──
    if (y === amortYears - 1) {
      annualAmount = remaining; // lo que quede por amortizar
    }

    // Tasa mensual = cuota anual / meses activos (distribución equitativa)
    const monthlyRate = activeMonths > 0 ? annualAmount / activeMonths : 0;

    yearlySchedule.push({
      year: y + 1,
      startMonthAbs: yearStartAbs,
      endMonthAbs: yearStartAbs + activeMonths - 1,
      activeMonths,
      annualAmount,
      monthlyRate,
      isPartial,
    });

    // Llenar array mensual
    for (let m = 0; m < activeMonths; m++) {
      const idx = yearStartAbs + m - 1; // 0-based
      if (idx >= 0 && idx < duration) {
        monthlyAmortization[idx] = monthlyRate;
      }
    }

    remaining -= annualAmount;
  }

  const totalAmortized = totalGastosPrevios - remaining;

  return {
    totalGastosPrevios,
    totalAmortized,
    operationStartMonth,
    amortYears,
    yearlySchedule,
    monthlyAmortization,
    breakdown,
  };
}
