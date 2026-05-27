import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// INTERFACES - Module A: Datos del Proyecto
// ============================================================
export interface ProjectData {
  projectName: string;
  investorName: string;
  province: string;
  municipality: string;
  sector: string;
  startDate: string; // YYYY-MM
  monthsDuration: number; // sin límite
  baseCurrency: string; // CUP, MLC, CL
  calculationMode: 'monthly' | 'yearly';
  projectType: string; // 'nuevo' | 'ampliacion' | 'reposicion'
  activityType: 'produccion' | 'comercial'; // Producción/Servicios o Actividad Comercial (Resolución 1/2022)
  exchangeRates: {
    cupToMlc: number;
    cupToCl: number;
    mlcToCl: number;
  };
}

// Module B - Construccion
export interface ConstructionItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCostCUP: number;
  unitCostMLC: number;
  months: number[];
  costCategory: string;
  assetCategory?: string;   // id from ASSET_CATEGORIES
  usefulLifeYears?: number; // override default from category
  residualPercent?: number; // override global residual
  depreciable?: boolean;    // default true
}

// Module C - Gastos de Capital
export interface CapitalItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCostCUP: number;
  unitCostMLC: number;
  months: number[];
  costCategory: string;
  assetCategory?: string;
  usefulLifeYears?: number;
  residualPercent?: number;
  depreciable?: boolean;    // default true
}

// Module D - Subcontrataciones
export interface SubcontractItem {
  id: string;
  name: string;
  description: string;
  totalCostCUP: number;
  totalCostMLC: number;
  months: number[];
}

// Module E - Recursos Humanos
export interface ResourceItem {
  id: string;
  name: string;
  position: string;
  category: string;
  monthlySalaryCUP: number;
  monthlySalaryMLC: number;
  quantity: number;
  months: number[];
  includesSocialSecurity: boolean;
  includesWorkforceTax: boolean;
}

// Module F - Compras
export type PurchaseOrigin = 'Nacional' | 'Importada';

export interface PurchaseItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCostCUP: number;
  unitCostMLC: number;
  frequency: string;
  origin: PurchaseOrigin;
  months: number[];
  quantities: number[];
}

// Module H - Ventas
export type MarketType = 'nacional' | 'exportacion';

export interface SalesItem {
  id: string;
  product: string;
  unit: string;
  priceCUP: number;
  priceMLC: number;
  quantity: number[]; // per month
  months: number[];
  unitCostMPCUP: number;  // Costo de materia prima por unidad (CUP)
  unitCostMPMLC: number;  // Costo de materia prima por unidad (MLC) - si >0 es importada
  marketType: MarketType; // Clasificación Mercado Nacional / Exportaciones (Resolución 1/2022)
}

// Sub-módulo H.2 - Otros Ingresos
export interface OtherIncomeItem {
  id: string;
  description: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
}

// Sub-módulo H.3 - Subvenciones
export interface SubventionItem {
  id: string;
  description: string;
  unit: string;
  unitCostCUP: number;
  unitCostMLC: number;
  quantity: number[]; // per month
  months: number[];
}

// Sub-módulo H.4 - Devoluciones y Rebajas en Venta
export interface SalesReturnItem {
  id: string;
  description: string;
  unit: string;
  unitCostCUP: number;
  unitCostMLC: number;
  quantity: number[]; // per month
  months: number[];
}

// Module I - Gastos de Distribución y Ventas
export interface CommercialExpense {
  id: string;
  name: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
}

// Module J - Gastos Generales y de Administración
export interface AdminExpense {
  id: string;
  name: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
}

// Module K - Mantenimiento
export interface MaintenanceItem {
  id: string;
  name: string;
  amountCUP: number;
  amountMLC: number;
  frequency: string;
  months: number[];
}

// Module L - Otros Gastos
export interface IndirectExpense {
  id: string;
  name: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
}

// Costos Directos
export interface DirectCostItem {
  id: string;
  name: string;
  description: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
  category: string;
}

// Servicios Públicos (sub-módulo de Costos Directos)
export interface PublicServiceItem {
  id: string;
  name: string;
  description: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
  category: string;
}

// Piezas de Repuesto y Herramientas
export interface SparePartItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCostCUP: number;
  unitCostMLC: number;
  months: number[];
  usefulLifeYears: number;
  depreciable: boolean;
}

// Activos Intangibles (Amortización)
export interface IntangibleAsset {
  id: string;
  name: string;
  description: string;
  amountCUP: number;
  amountMLC: number;
  usefulLifeYears: number;
  months: number[];
  category: string; // Software, Patentes, Marcas, Licencias, Gastos Organización, Capacitación, Know-how
}

// Asset categories with default useful lives (based on Cuban Resolution 3060)
export interface AssetCategory {
  id: string;
  name: string;
  defaultLifeYears: number;
  defaultResidualPercent: number;
  type: 'tangible' | 'intangible';
}

// User-configurable rates per category
export interface CategoryRate {
  id: string; // matches AssetCategory.id
  lifeYears: number;
  residualPercent: number;
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  { id: 'edificaciones', name: 'Edificaciones y Construcciones', defaultLifeYears: 50, defaultResidualPercent: 10, type: 'tangible' },
  { id: 'infraestructura', name: 'Infraestructura e Instalaciones', defaultLifeYears: 25, defaultResidualPercent: 10, type: 'tangible' },
  { id: 'maquinaria', name: 'Maquinaria y Equipos', defaultLifeYears: 10, defaultResidualPercent: 10, type: 'tangible' },
  { id: 'transporte', name: 'Equipos de Transporte', defaultLifeYears: 8, defaultResidualPercent: 10, type: 'tangible' },
  { id: 'computo', name: 'Equipos de Cómputo', defaultLifeYears: 4, defaultResidualPercent: 5, type: 'tangible' },
  { id: 'mobiliario', name: 'Mobiliario y Enseres', defaultLifeYears: 10, defaultResidualPercent: 10, type: 'tangible' },
  { id: 'herramientas', name: 'Herramientas y Utensilios', defaultLifeYears: 5, defaultResidualPercent: 5, type: 'tangible' },
  { id: 'otros-activos', name: 'Otros Activos Fijos', defaultLifeYears: 10, defaultResidualPercent: 10, type: 'tangible' },
];

export const INTANGIBLE_CATEGORIES: AssetCategory[] = [
  { id: 'software', name: 'Software y Licencias', defaultLifeYears: 3, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'patentes', name: 'Patentes', defaultLifeYears: 10, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'marcas', name: 'Marcas Registradas', defaultLifeYears: 10, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'licencias', name: 'Licencias y Concesiones', defaultLifeYears: 10, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'gastos-org', name: 'Gastos de Organización', defaultLifeYears: 5, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'capacitacion', name: 'Capacitación del Personal', defaultLifeYears: 2, defaultResidualPercent: 0, type: 'intangible' },
  { id: 'know-how', name: 'Know-how / Transferencia Tecnológica', defaultLifeYears: 5, defaultResidualPercent: 0, type: 'intangible' },
];

// Otros Recursos y Otros Gastos
export interface OtherResourceItem {
  id: string;
  name: string;
  description: string;
  amountCUP: number;
  amountMLC: number;
  months: number[];
  category: string;
  isAutoGenerated?: boolean; // true = generado automáticamente (Gastos Financieros de inversión)
}

// Module M - Financiamiento (Loans)
export interface LoanDisbursement {
  month: number;  // mes absoluto del proyecto (1-based)
  amount: number; // monto desembolsado en ese mes
}

export type AmortizationSystem = 'french' | 'german';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'semiannual';
export type LoanPurpose = 'inversion' | 'capital-trabajo';
export type GraceInterestPayment = 'periodico' | 'pago-unico';
export type BankFeeTiming = 'at-disbursement' | 'periodic';

export const FREQUENCY_PERIODS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
};

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
};

export const AMORTIZATION_LABELS: Record<AmortizationSystem, string> = {
  french: 'Francés (cuota fija)',
  german: 'Alemán (capital constante)',
};

export const LOAN_PURPOSE_LABELS: Record<LoanPurpose, string> = {
  inversion: 'Inversión',
  'capital-trabajo': 'Capital de Trabajo',
};

export const GRACE_INTEREST_PAYMENT_LABELS: Record<GraceInterestPayment, string> = {
  periodico: 'Pago Periódico (mensual)',
  'pago-unico': 'Pago Único (al final de la gracia)',
};

export const BANK_FEE_TIMING_LABELS: Record<BankFeeTiming, string> = {
  'at-disbursement': 'Al Desembolso',
  'periodic': 'Periódico (por cuota)',
};

/**
   * Desglose de gastos bancarios asociados al préstamo.
   * Según el Esquema de Metodología de Préstamos, sección 2.
   */
export interface LoanBankFees {
  /** Comisión por apertura (%) sobre el monto desembolsado */
  commissionRate?: number;
  /** Seguro (%) sobre el monto desembolsado o saldo */
  insuranceRate?: number;
  /** Otros gastos bancarios (%) */
  otherRate?: number;
}

/**
 * Entrada de tasa variable por período.
 * Cada fila define la tasa nominal anual vigente a partir de un período relativo.
 * 
 * Ejemplo: { periodStart: 1, rate: 0.04 } → 4% desde el período 1
 *          { periodStart: 25, rate: 0.06 } → 6% desde el período 25
 *          { periodStart: 49, rate: 0.08 } → 8% desde el período 49
 * 
 * El período es relativo al startMonth del préstamo (1-based).
 * Si no se especifica, se usa la tasa fija (annualRate).
 */
export interface InterestRateEntry {
  /** Período relativo desde el inicio del préstamo (1-based) */
  periodStart: number;
  /** Tasa nominal anual (decimal, ej: 0.06 = 6%) */
  rate: number;
}

/**
 * Entrada de tasa de cambio variable por período.
 * Cada fila define la tasa de cambio (MLC/USD → CUP) vigente a partir de un período relativo.
 *
 * Ejemplo: { periodStart: 1, rate: 300 } → 300 CUP/MLC desde el período 1
 *          { periodStart: 25, rate: 350 } → 350 CUP/MLC desde el período 25
 *
 * El período es relativo al startMonth del préstamo (1-based).
 * Si no se especifica, se usa project.exchangeRates.cupToMlc.
 */
export interface ExchangeRateEntry {
  /** Período relativo desde el inicio del préstamo (1-based) */
  periodStart: number;
  /** Tasa de cambio MLC/USD a CUP (ej: 300 = 300 CUP por 1 MLC) */
  rate: number;
}

export interface Loan {
  id: string;
  name: string;
  amountCUP: number;
  /**
   * Monto total autorizado del préstamo (límite). Puede ser mayor que
   * la suma de desembolsos (tomas parciales). Por defecto igual a amountCUP.
   */
  authorizedAmount?: number;
  annualRate: number;
  termMonths: number;
  gracePeriodMonths: number;
  startMonth: number;
  currency: string;
  monthlyPayment?: number;
  /**
   * Sistema de amortización según el Esquema de Metodología de Préstamos.
   * - 'french': cuota fija (por defecto, retrocompatible).
   * - 'german': amortización de capital constante, cuota decreciente.
   */
  amortizationSystem?: AmortizationSystem;
  /**
   * Frecuencia de pagos durante la fase de amortización.
   * Afecta: conversión de tasa, número de cuotas, periodicidad del cronograma.
   * Por defecto 'monthly' (retrocompatible).
   */
  paymentFrequency?: PaymentFrequency;
  /**
   * Período de capitalización de la tasa nominal (coincide con paymentFrequency por defecto).
   * Ejemplo: tasa nominal anual 12% con capitalización trimestral → tasa efectiva trimestral = 3%.
   */
  capitalizationPeriod?: PaymentFrequency;
  /**
   * Destino del préstamo. Afecta la clasificación en estados financieros.
   * - 'inversion': préstamo para inversión (construcción, equipamiento). Intereses pueden capitalizarse.
   * - 'capital-trabajo': préstamo para capital de trabajo (operaciones). Intereses son gasto corriente.
   */
  loanPurpose?: LoanPurpose;
  /**
   * Tipo de interés durante el período de gracia/desembolso (Resolución GOC-2022-O95).
   * - false (no capitalizable): los intereses se pagan periódicamente (salida de efectivo).
   * - true (capitalizable): los intereses se acumulan al capital (no son salida de efectivo,
   *   pero incrementan el saldo del préstamo). Aplica principalmente a préstamos de inversión
   *   durante la fase de construcción.
   */
  capitalizableInterest?: boolean;
  /**
   * Modo de pago de intereses durante gracia no capitalizable.
   * - 'periodico': se pagan mes a mes (por defecto, retrocompatible).
   * - 'pago-unico': se acumulan y pagan en un solo pago al final del período de gracia.
   * Solo aplica cuando capitalizableInterest = false.
   */
  graceInterestPayment?: GraceInterestPayment;
  /**
   * Número de cuotas de amortización (después de la gracia).
   * Si no se especifica, se calcula automáticamente: (termMonths - gracePeriodMonths) según frecuencia.
   */
  numInstallments?: number;
  /**
   * Desglose de gastos bancarios (comisión apertura, seguro, otros).
   * Si se especifica, reemplaza al bankFeeRate global para este préstamo.
   */
  bankFees?: LoanBankFees;
  /**
   * Tabla de tasas de interés variable por período.
   * Cada entrada define la tasa vigente desde un período relativo.
   * Si está vacía o undefined, se usa annualRate fija (comportamiento retrocompatible).
   */
  interestRateTable?: InterestRateEntry[];
  /** Cronograma de desembolsos mensuales. Si está vacío, se asume desembolso único en startMonth. */
  disbursementSchedule?: LoanDisbursement[];
  /**
   * Per-period exchange rate table (MLC/USD → CUP). Optional.
   * If not provided, uses project.exchangeRates.cupToMlc.
   */
  exchangeRateTable?: ExchangeRateEntry[];
  /**
   * Momento de aplicación de gastos bancarios.
   * - 'at-disbursement': se aplican solo al desembolso (por defecto, retrocompatible).
   * - 'periodic': se aplican periódicamente en cada cuota de pago durante la amortización.
   *   La base para el cálculo es el saldo insoluto al inicio del período de pago.
   */
  bankFeeTiming?: BankFeeTiming;
}

// Module N - Parametros (expanded to 20+ fields)
export interface Parameters {
  // Tax group — valores en % (ej: 15 significa 15%, no 0.15)
  incomeTaxRate: number;          // Impuesto sobre Utilidades (%)
  salesTaxRate: number;           // Impuesto sobre Ventas / ISV (%)
  taxOnWorkforceRate: number;     // Impuesto sobre la Fuerza de Trabajo (%)
  territorialTaxRate: number;     // Impuesto Territorial (%)
  honorariosAdminRate: number;    // Honorarios de Administración (% sobre Util. Operativa Neta)

  // Discount group — valores en %
  discountRateCUP: number;        // Tasa de Descuento CUP (%)
  discountRateMLC: number;        // Tasa de Descuento MLC (%)
  minimumAcceptableRate: number;  // Tasa Mínima Aceptable de Rendimiento / TMA (%)
  inflationRate: number;          // Tasa de Inflación (%)

  // Reserves group — valores en %
  contingencyReserveRate: number;        // Reserva de Contingencia sobre Inversión (%)
  operationsContingencyRate: number;     // Reserva de Contingencia sobre Operaciones (%)
  retainedEarningsRate: number;          // Utilidades Retenidas (% sobre Utilidad Neta)

  // Distribution group — valores en %
  dividendCAMRate: number;        // Dividendo CAM (% sobre Utilidad Neta)
  projectAccountRate: number;     // Cuenta de Proyecto (% sobre Utilidad Neta)

  // Resolución 1/2022 group — Distribución de Utilidades (% sobre Utilidad Neta)
  arieRate: number;
  reservasEstimulacionRate: number;
  beneficioReinvertirRate: number;

  // Actividad Comercial (Resolución 1/2022)
  canonRoyaltiesRate: number;           // Canon y Royalties (% sobre Ventas Netas)
  arrendamientoMensual: number;         // Gastos de Arrendamiento mensuales (CUP)

  // Resolución 1/2022 — Desgloses adicionales
  otrosGastosVariablesPct: number;      // Otros Gastos Variables (% sobre Ventas Netas)
  otrasReservasVoluntariasRate: number;  // Otras Reservas Voluntarias (% sobre Utilidad Neta)
  pagoUtilidadesRetenidasAmt: number;   // Pago de Utilidades Retenidas (CUP/mes)
  dividendoEstatalPct: number;          // Dividendo Empresa Estatal (%)
  dividendoSocioCubanoPct: number;      // Dividendo Socio Cubano (%)
  dividendoSocioExtranjeroPct: number;  // Dividendo Socio Extranjero (%)

  // Financial group — tasas en %
  bankFeeRate: number;              // Comisión Bancaria (%)
  vacationNormRate: number;         // Norma de Vacaciones (%)
  salaryComplementRate?: number;    // Complemento Salarial (%)
  specialSocialSecurityRate: number; // Seguridad Social Especial (%)
  personalIncomeTaxExemptMin: number; // Exención mínima Impuesto Personal (CUP)
  personalIncomeTaxRate: number;    // Impuesto sobre la Renta Personal (%)
  workerSocialSecurityRate: number; // Seguridad Social del Trabajador (%)

  // Depreciation group
  depreciationMethod: string;
  usefulLifeYears: number;
  residualValuePercent: number;    // Valor Residual (%)
  assetCategoryRates: CategoryRate[];
  gastosPreviosAmortYears: number;

  // Working Capital group — valores en días
  workingDaysPerYear: number;
  workingDaysPerMonth: number;
  wcCashCoverageDays: number;
  wcReceivableCoverageDays: number;
  wcInventoryCoverageDays: number;
  wcPayableDays: number;
  wcWipCoverageDays: number;
  wcFinishedGoodsCoverageDays: number;
  wcSparePartsCoverageDays: number;
  wcMercanciasVentaCoverageDays: number;
}

// Logical Framework
export interface LogicalFrameworkRow {
  id: string;
  level: 'fin' | 'proposito' | 'componente' | 'actividad';
  narrative: string;
  indicators: string;
  verificationMeans: string;
  assumptions: string;
  parentId?: string;
}

export interface LogicalFramework {
  rows: LogicalFrameworkRow[];
}

// ============================================================
// STORE TYPES
// ============================================================
export type ModuleId =
  | 'dashboard' | 'logical-framework'
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'H' | 'I' | 'J' | 'K' | 'L'
  | 'M' | 'N'
  | 'spare-parts' | 'other-resources'
  | 'intangible-assets'
  | 'direct-costs'
  | 'investment-budget' | 'investment-schedule' | 'depreciation'
  | 'costs-financial'
  | 'working-capital'
  | 'cash-flow-planning' | 'cash-flow-investment'
  | 'currency-effect' | 'utility-distribution' | 'indicators'
  | 'scenarios'
  | 'income-statement' | 'cash-flow'
  | 'balance-sheet' | 'sensitivity'
  | 'pdf-report'
  | 'other-taxes';

export interface BaraproState {
  // Navigation
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Module A
  project: ProjectData;
  updateProject: (data: Partial<ProjectData>) => void;

  // Module B
  constructionItems: ConstructionItem[];
  addConstructionItem: (item: Omit<ConstructionItem, 'id'>) => void;
  updateConstructionItem: (id: string, data: Partial<ConstructionItem>) => void;
  deleteConstructionItem: (id: string) => void;

  // Module C
  capitalItems: CapitalItem[];
  addCapitalItem: (item: Omit<CapitalItem, 'id'>) => void;
  updateCapitalItem: (id: string, data: Partial<CapitalItem>) => void;
  deleteCapitalItem: (id: string) => void;

  // Module D
  subcontractItems: SubcontractItem[];
  addSubcontractItem: (item: Omit<SubcontractItem, 'id'>) => void;
  updateSubcontractItem: (id: string, data: Partial<SubcontractItem>) => void;
  deleteSubcontractItem: (id: string) => void;

  // Module E
  resourceItems: ResourceItem[];
  addResourceItem: (item: Omit<ResourceItem, 'id'>) => void;
  updateResourceItem: (id: string, data: Partial<ResourceItem>) => void;
  deleteResourceItem: (id: string) => void;

  // Module F
  purchaseItems: PurchaseItem[];
  addPurchaseItem: (item: Omit<PurchaseItem, 'id'>) => void;
  updatePurchaseItem: (id: string, data: Partial<PurchaseItem>) => void;
  deletePurchaseItem: (id: string) => void;

  // Module H
  salesItems: SalesItem[];
  addSalesItem: (item: Omit<SalesItem, 'id'>) => void;
  updateSalesItem: (id: string, data: Partial<SalesItem>) => void;
  deleteSalesItem: (id: string) => void;

  // Sub-module H.2 - Otros Ingresos
  otherIncomeItems: OtherIncomeItem[];
  addOtherIncomeItem: (item: Omit<OtherIncomeItem, 'id'>) => void;
  updateOtherIncomeItem: (id: string, data: Partial<OtherIncomeItem>) => void;
  deleteOtherIncomeItem: (id: string) => void;

  // Sub-module H.3 - Subvenciones
  subventionItems: SubventionItem[];
  addSubventionItem: (item: Omit<SubventionItem, 'id'>) => void;
  updateSubventionItem: (id: string, data: Partial<SubventionItem>) => void;
  deleteSubventionItem: (id: string) => void;

  // Sub-module H.4 - Devoluciones y Rebajas en Venta
  salesReturnItems: SalesReturnItem[];
  addSalesReturnItem: (item: Omit<SalesReturnItem, 'id'>) => void;
  updateSalesReturnItem: (id: string, data: Partial<SalesReturnItem>) => void;
  deleteSalesReturnItem: (id: string) => void;

  // Module I
  commercialExpenses: CommercialExpense[];
  addCommercialExpense: (item: Omit<CommercialExpense, 'id'>) => void;
  updateCommercialExpense: (id: string, data: Partial<CommercialExpense>) => void;
  deleteCommercialExpense: (id: string) => void;

  // Module J
  adminExpenses: AdminExpense[];
  addAdminExpense: (item: Omit<AdminExpense, 'id'>) => void;
  updateAdminExpense: (id: string, data: Partial<AdminExpense>) => void;
  deleteAdminExpense: (id: string) => void;

  // Module K
  maintenanceItems: MaintenanceItem[];
  addMaintenanceItem: (item: Omit<MaintenanceItem, 'id'>) => void;
  updateMaintenanceItem: (id: string, data: Partial<MaintenanceItem>) => void;
  deleteMaintenanceItem: (id: string) => void;

  // Module L
  indirectExpenses: IndirectExpense[];
  addIndirectExpense: (item: Omit<IndirectExpense, 'id'>) => void;
  updateIndirectExpense: (id: string, data: Partial<IndirectExpense>) => void;
  deleteIndirectExpense: (id: string) => void;

  // Module M
  loans: Loan[];
  addLoan: (item: Omit<Loan, 'id'>) => void;
  updateLoan: (id: string, data: Partial<Loan>) => void;
  deleteLoan: (id: string) => void;

  // Module N
  parameters: Parameters;
  updateParameters: (data: Partial<Parameters>) => void;

  // Spare Parts
  sparePartItems: SparePartItem[];
  addSparePartItem: (item: Omit<SparePartItem, 'id'>) => void;
  updateSparePartItem: (id: string, data: Partial<SparePartItem>) => void;
  deleteSparePartItem: (id: string) => void;

  // Other Resources
  otherResourceItems: OtherResourceItem[];
  addOtherResourceItem: (item: Omit<OtherResourceItem, 'id'>) => void;
  updateOtherResourceItem: (id: string, data: Partial<OtherResourceItem>) => void;
  deleteOtherResourceItem: (id: string) => void;

  // Intangible Assets
  intangibleAssets: IntangibleAsset[];
  addIntangibleAsset: (item: Omit<IntangibleAsset, 'id'>) => void;
  updateIntangibleAsset: (id: string, data: Partial<IntangibleAsset>) => void;
  deleteIntangibleAsset: (id: string) => void;

  // Direct Costs
  directCostItems: DirectCostItem[];
  addDirectCostItem: (item: Omit<DirectCostItem, 'id'>) => void;
  updateDirectCostItem: (id: string, data: Partial<DirectCostItem>) => void;
  deleteDirectCostItem: (id: string) => void;

  // Servicios Públicos (sub-módulo de Costos Directos)
  publicServiceItems: PublicServiceItem[];
  addPublicServiceItem: (item: Omit<PublicServiceItem, 'id'>) => void;
  updatePublicServiceItem: (id: string, data: Partial<PublicServiceItem>) => void;
  deletePublicServiceItem: (id: string) => void;

  commercialSalaries: ResourceItem[];
  addCommercialSalary: (item: Omit<ResourceItem, 'id'>) => void;
  updateCommercialSalary: (id: string, data: Partial<ResourceItem>) => void;
  deleteCommercialSalary: (id: string) => void;

  adminSalaries: ResourceItem[];
  addAdminSalary: (item: Omit<ResourceItem, 'id'>) => void;
  updateAdminSalary: (id: string, data: Partial<ResourceItem>) => void;
  deleteAdminSalary: (id: string) => void;

  maintenanceSalaries: ResourceItem[];
  addMaintenanceSalary: (item: Omit<ResourceItem, 'id'>) => void;
  updateMaintenanceSalary: (id: string, data: Partial<ResourceItem>) => void;
  deleteMaintenanceSalary: (id: string) => void;

  indirectSalaries: ResourceItem[];
  addIndirectSalary: (item: Omit<ResourceItem, 'id'>) => void;
  updateIndirectSalary: (id: string, data: Partial<ResourceItem>) => void;
  deleteIndirectSalary: (id: string) => void;

  directCostSalaries: ResourceItem[];
  addDirectCostSalary: (item: Omit<ResourceItem, 'id'>) => void;
  updateDirectCostSalary: (id: string, data: Partial<ResourceItem>) => void;
  deleteDirectCostSalary: (id: string) => void;

  // Logical Framework
  logicalFramework: LogicalFramework;
  updateLogicalFramework: (data: Partial<LogicalFramework>) => void;
  addLogicalFrameworkRow: (row: Omit<LogicalFrameworkRow, 'id'>) => void;
  updateLogicalFrameworkRow: (id: string, data: Partial<LogicalFrameworkRow>) => void;
  deleteLogicalFrameworkRow: (id: string) => void;

  // Helpers
  getMonthsRange: () => string[];

  // Bulk actions
  loadFromExcel: (data: any) => void;
  resetAll: () => void;
}

// ============================================================
// DEFAULT DATA
// ============================================================
const defaultProject: ProjectData = {
  projectName: '',
  investorName: '',
  province: '',
  municipality: '',
  sector: '',
  startDate: new Date().toISOString().slice(0, 7),
  monthsDuration: 120,
  baseCurrency: 'CUP',
  calculationMode: 'monthly',
  projectType: 'nuevo',
  activityType: 'produccion',
  exchangeRates: {
    cupToMlc: 300,
    cupToCl: 300,
    mlcToCl: 1,
  },
};

const defaultParameters: Parameters = {
  // Tax group — valores en % (ej: 15 = 15%)
  incomeTaxRate: 15,
  salesTaxRate: 10,
  taxOnWorkforceRate: 5,
  territorialTaxRate: 1,
  honorariosAdminRate: 0,

  // Discount group — valores en %
  discountRateCUP: 14,
  discountRateMLC: 16,
  minimumAcceptableRate: 10,
  inflationRate: 5,

  // Reserves group — valores en %
  contingencyReserveRate: 0,
  operationsContingencyRate: 0,
  retainedEarningsRate: 50,

  // Distribution group — valores en %
  dividendCAMRate: 20,
  projectAccountRate: 30,

  // Resolución 1/2022 group — Distribución de Utilidades (% sobre Utilidad Neta)
  arieRate: 0,
  reservasEstimulacionRate: 0,
  beneficioReinvertirRate: 0,

  // Actividad Comercial (Resolución 1/2022)
  canonRoyaltiesRate: 0,
  arrendamientoMensual: 0,

  // Resolución 1/2022 — Desgloses adicionales
  otrosGastosVariablesPct: 0,
  otrasReservasVoluntariasRate: 0,
  pagoUtilidadesRetenidasAmt: 0,
  dividendoEstatalPct: 0,
  dividendoSocioCubanoPct: 0,
  dividendoSocioExtranjeroPct: 0,

  // Financial group — tasas en %
  bankFeeRate: 3.5,
  vacationNormRate: 9.09,
  salaryComplementRate: 9.09, // Complemento Salarial (%)
  specialSocialSecurityRate: 5,
  personalIncomeTaxExemptMin: 3260,
  personalIncomeTaxRate: 3,
  workerSocialSecurityRate: 5,

  // Depreciation group
  depreciationMethod: 'straight-line',
  usefulLifeYears: 10,
  residualValuePercent: 10,
  assetCategoryRates: [
    // Tangible — residualPercent en %
    { id: 'edificaciones', lifeYears: 50, residualPercent: 10 },
    { id: 'infraestructura', lifeYears: 25, residualPercent: 10 },
    { id: 'maquinaria', lifeYears: 10, residualPercent: 10 },
    { id: 'transporte', lifeYears: 8, residualPercent: 10 },
    { id: 'computo', lifeYears: 4, residualPercent: 5 },
    { id: 'mobiliario', lifeYears: 10, residualPercent: 10 },
    { id: 'herramientas', lifeYears: 5, residualPercent: 5 },
    { id: 'otros-activos', lifeYears: 10, residualPercent: 10 },
    // Intangible
    { id: 'software', lifeYears: 3, residualPercent: 0 },
    { id: 'patentes', lifeYears: 10, residualPercent: 0 },
    { id: 'marcas', lifeYears: 10, residualPercent: 0 },
    { id: 'licencias', lifeYears: 10, residualPercent: 0 },
    { id: 'gastos-org', lifeYears: 5, residualPercent: 0 },
    { id: 'capacitacion', lifeYears: 2, residualPercent: 0 },
    { id: 'know-how', lifeYears: 5, residualPercent: 0 },
  ],
  gastosPreviosAmortYears: 5,

  // Working Capital group — valores en días
  workingDaysPerYear: 360,
  workingDaysPerMonth: 30,
  wcCashCoverageDays: 30,
  wcReceivableCoverageDays: 30,
  wcInventoryCoverageDays: 45,
  wcPayableDays: 30,
  wcWipCoverageDays: 15,
  wcFinishedGoodsCoverageDays: 30,
  wcSparePartsCoverageDays: 30,
  wcMercanciasVentaCoverageDays: 30,
};

const defaultLogicalFramework: LogicalFramework = {
  rows: [
    {
      id: 'fin-1',
      level: 'fin',
      narrative: '',
      indicators: '',
      verificationMeans: '',
      assumptions: '',
    },
    {
      id: 'prop-1',
      level: 'proposito',
      narrative: '',
      indicators: '',
      verificationMeans: '',
      assumptions: '',
    },
  ],
};

// ============================================================
// DATA NORMALIZATION
// ============================================================
// Ensures all array fields are actual arrays (not JSON strings from Excel/autosave).
// This is the single defense point: ALL data entering the store goes through here.
// ============================================================
function normalizeArrayField(value: any): any[] | any {
  if (Array.isArray(value)) return value;
  // Pass through plain objects (e.g., LoanBankFees { commissionRate, insuranceRate, otherRate })
  // These are listed in ARRAY_FIELD_MAP for JSON-parse normalization, but are NOT arrays.
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) return parsed; // JSON-serialized object
    } catch { /* not valid JSON, return empty */ }
  }
  return [];
}

// Fields per state key that must be arrays
const ARRAY_FIELD_MAP: Record<string, string[]> = {
  constructionItems: ['months'],
  capitalItems: ['months'],
  subcontractItems: ['months'],
  resourceItems: ['months'],
  purchaseItems: ['months', 'quantities'],
  salesItems: ['months', 'quantity'],
  otherIncomeItems: ['months'],
  subventionItems: ['months', 'quantities'],
  salesReturnItems: ['months', 'quantities'],
  commercialExpenses: ['months'],
  adminExpenses: ['months'],
  maintenanceItems: ['months'],
  indirectExpenses: ['months'],
  loans: ['disbursementSchedule', 'interestRateTable', 'exchangeRateTable', 'bankFees'], // bankFees is an object but needs JSON parse normalization
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

function normalizeItemsArray(items: any[], stateKey: string): any[] {
  const fields = ARRAY_FIELD_MAP[stateKey] || [];
  if (fields.length === 0) return items;
  return items.map((item) => {
    const normalized = { ...item };
    for (const field of fields) {
      if (field in normalized) {
        normalized[field] = normalizeArrayField(normalized[field]);
      }
    }
    return normalized;
  });
}

// Parámetros de tasa que deben estar en formato entero (ej: 14 = 14%, no 0.14)
const RATE_PARAM_KEYS: (keyof Parameters)[] = [
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
];

// Normalize parameters: parse JSON strings only — NO auto-conversion of values.
// Los valores se guardan exactamente como los introduce el usuario.
// (La convención de enteros para tasas se documenta en PROMPT.md sección 4.3,
//  pero la conversión automática fue eliminada para evitar transformaciones no deseadas.)
function normalizeParameters(params: any): Parameters {
  const p = { ...params };
  if (typeof p.assetCategoryRates === 'string') {
    try {
      const parsed = JSON.parse(p.assetCategoryRates);
      if (Array.isArray(parsed)) p.assetCategoryRates = parsed;
    } catch { /* keep as-is */ }
  }
  return p;
}

// ============================================================
export const useBaraproStore = create<BaraproState>((set, get) => ({
  // Navigation
  activeModule: 'dashboard',
  setActiveModule: (module) => {
    set({ activeModule: module });
    // Persist to URL hash so the page survives refresh
    if (typeof window !== 'undefined') {
      window.location.hash = module;
    }
  },
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Module A
  project: { ...defaultProject },
  updateProject: (data) =>
    set((s) => ({ project: { ...s.project, ...data } })),

  // Module B
  constructionItems: [],
  addConstructionItem: (item) =>
    set((s) => ({
      constructionItems: [...s.constructionItems, { ...item, id: uuidv4() }],
    })),
  updateConstructionItem: (id, data) =>
    set((s) => ({
      constructionItems: s.constructionItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteConstructionItem: (id) =>
    set((s) => ({
      constructionItems: s.constructionItems.filter((i) => i.id !== id),
    })),

  // Module C
  capitalItems: [],
  addCapitalItem: (item) =>
    set((s) => ({
      capitalItems: [...s.capitalItems, { ...item, id: uuidv4() }],
    })),
  updateCapitalItem: (id, data) =>
    set((s) => ({
      capitalItems: s.capitalItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteCapitalItem: (id) =>
    set((s) => ({
      capitalItems: s.capitalItems.filter((i) => i.id !== id),
    })),

  // Module D
  subcontractItems: [],
  addSubcontractItem: (item) =>
    set((s) => ({
      subcontractItems: [...s.subcontractItems, { ...item, id: uuidv4() }],
    })),
  updateSubcontractItem: (id, data) =>
    set((s) => ({
      subcontractItems: s.subcontractItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteSubcontractItem: (id) =>
    set((s) => ({
      subcontractItems: s.subcontractItems.filter((i) => i.id !== id),
    })),

  // Module E
  resourceItems: [],
  addResourceItem: (item) =>
    set((s) => ({
      resourceItems: [...s.resourceItems, { ...item, id: uuidv4() }],
    })),
  updateResourceItem: (id, data) =>
    set((s) => ({
      resourceItems: s.resourceItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteResourceItem: (id) =>
    set((s) => ({
      resourceItems: s.resourceItems.filter((i) => i.id !== id),
    })),

  // Module F
  purchaseItems: [],
  addPurchaseItem: (item) =>
    set((s) => ({
      purchaseItems: [...s.purchaseItems, { ...item, id: uuidv4() }],
    })),
  updatePurchaseItem: (id, data) =>
    set((s) => ({
      purchaseItems: s.purchaseItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deletePurchaseItem: (id) =>
    set((s) => ({
      purchaseItems: s.purchaseItems.filter((i) => i.id !== id),
    })),

  // Module H
  salesItems: [],
  addSalesItem: (item) =>
    set((s) => ({
      salesItems: [...s.salesItems, { ...item, id: uuidv4() }],
    })),
  updateSalesItem: (id, data) =>
    set((s) => ({
      salesItems: s.salesItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteSalesItem: (id) =>
    set((s) => ({
      salesItems: s.salesItems.filter((i) => i.id !== id),
    })),

  // Sub-module H.2 - Otros Ingresos
  otherIncomeItems: [],
  addOtherIncomeItem: (item) =>
    set((s) => ({
      otherIncomeItems: [...s.otherIncomeItems, { ...item, id: uuidv4() }],
    })),
  updateOtherIncomeItem: (id, data) =>
    set((s) => ({
      otherIncomeItems: s.otherIncomeItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteOtherIncomeItem: (id) =>
    set((s) => ({
      otherIncomeItems: s.otherIncomeItems.filter((i) => i.id !== id),
    })),

  // Sub-module H.3 - Subvenciones
  subventionItems: [],
  addSubventionItem: (item) =>
    set((s) => ({
      subventionItems: [...s.subventionItems, { ...item, id: uuidv4() }],
    })),
  updateSubventionItem: (id, data) =>
    set((s) => ({
      subventionItems: s.subventionItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteSubventionItem: (id) =>
    set((s) => ({
      subventionItems: s.subventionItems.filter((i) => i.id !== id),
    })),

  // Sub-module H.4 - Devoluciones y Rebajas en Venta
  salesReturnItems: [],
  addSalesReturnItem: (item) =>
    set((s) => ({
      salesReturnItems: [...s.salesReturnItems, { ...item, id: uuidv4() }],
    })),
  updateSalesReturnItem: (id, data) =>
    set((s) => ({
      salesReturnItems: s.salesReturnItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteSalesReturnItem: (id) =>
    set((s) => ({
      salesReturnItems: s.salesReturnItems.filter((i) => i.id !== id),
    })),

  // Module I
  commercialExpenses: [],
  addCommercialExpense: (item) =>
    set((s) => ({
      commercialExpenses: [...s.commercialExpenses, { ...item, id: uuidv4() }],
    })),
  updateCommercialExpense: (id, data) =>
    set((s) => ({
      commercialExpenses: s.commercialExpenses.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteCommercialExpense: (id) =>
    set((s) => ({
      commercialExpenses: s.commercialExpenses.filter((i) => i.id !== id),
    })),

  // Module J
  adminExpenses: [],
  addAdminExpense: (item) =>
    set((s) => ({
      adminExpenses: [...s.adminExpenses, { ...item, id: uuidv4() }],
    })),
  updateAdminExpense: (id, data) =>
    set((s) => ({
      adminExpenses: s.adminExpenses.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteAdminExpense: (id) =>
    set((s) => ({
      adminExpenses: s.adminExpenses.filter((i) => i.id !== id),
    })),

  // Module K
  maintenanceItems: [],
  addMaintenanceItem: (item) =>
    set((s) => ({
      maintenanceItems: [...s.maintenanceItems, { ...item, id: uuidv4() }],
    })),
  updateMaintenanceItem: (id, data) =>
    set((s) => ({
      maintenanceItems: s.maintenanceItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteMaintenanceItem: (id) =>
    set((s) => ({
      maintenanceItems: s.maintenanceItems.filter((i) => i.id !== id),
    })),

  // Module L
  indirectExpenses: [],
  addIndirectExpense: (item) =>
    set((s) => ({
      indirectExpenses: [...s.indirectExpenses, { ...item, id: uuidv4() }],
    })),
  updateIndirectExpense: (id, data) =>
    set((s) => ({
      indirectExpenses: s.indirectExpenses.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteIndirectExpense: (id) =>
    set((s) => ({
      indirectExpenses: s.indirectExpenses.filter((i) => i.id !== id),
    })),

  // Module M
  loans: [],
  addLoan: (item) =>
    set((s) => ({
      loans: [...s.loans, { ...item, id: uuidv4() }],
    })),
  updateLoan: (id, data) =>
    set((s) => ({
      loans: s.loans.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteLoan: (id) =>
    set((s) => ({
      loans: s.loans.filter((i) => i.id !== id),
    })),

  // Module N
  parameters: { ...defaultParameters },
  updateParameters: (data) =>
    set((s) => ({ parameters: { ...s.parameters, ...data } })),

  // Spare Parts
  sparePartItems: [],
  addSparePartItem: (item) =>
    set((s) => ({
      sparePartItems: [...s.sparePartItems, { ...item, id: uuidv4() }],
    })),
  updateSparePartItem: (id, data) =>
    set((s) => ({
      sparePartItems: s.sparePartItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteSparePartItem: (id) =>
    set((s) => ({
      sparePartItems: s.sparePartItems.filter((i) => i.id !== id),
    })),

  // Other Resources
  otherResourceItems: [],
  addOtherResourceItem: (item) =>
    set((s) => ({
      otherResourceItems: [...s.otherResourceItems, { ...item, id: uuidv4() }],
    })),
  updateOtherResourceItem: (id, data) =>
    set((s) => ({
      otherResourceItems: s.otherResourceItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteOtherResourceItem: (id) =>
    set((s) => ({
      otherResourceItems: s.otherResourceItems.filter((i) => i.id !== id),
    })),

  // Intangible Assets
  intangibleAssets: [],
  addIntangibleAsset: (item) =>
    set((s) => ({
      intangibleAssets: [...s.intangibleAssets, { ...item, id: uuidv4() }],
    })),
  updateIntangibleAsset: (id, data) =>
    set((s) => ({
      intangibleAssets: s.intangibleAssets.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteIntangibleAsset: (id) =>
    set((s) => ({
      intangibleAssets: s.intangibleAssets.filter((i) => i.id !== id),
    })),

  // Direct Costs
  directCostItems: [],
  addDirectCostItem: (item) =>
    set((s) => ({
      directCostItems: [...s.directCostItems, { ...item, id: uuidv4() }],
    })),
  updateDirectCostItem: (id, data) =>
    set((s) => ({
      directCostItems: s.directCostItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deleteDirectCostItem: (id) =>
    set((s) => ({
      directCostItems: s.directCostItems.filter((i) => i.id !== id),
    })),

  // Servicios Públicos (sub-módulo de Costos Directos)
  publicServiceItems: [],
  addPublicServiceItem: (item) =>
    set((s) => ({
      publicServiceItems: [...s.publicServiceItems, { ...item, id: uuidv4() }],
    })),
  updatePublicServiceItem: (id, data) =>
    set((s) => ({
      publicServiceItems: s.publicServiceItems.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),
  deletePublicServiceItem: (id) =>
    set((s) => ({
      publicServiceItems: s.publicServiceItems.filter((i) => i.id !== id),
    })),

  commercialSalaries: [],
  addCommercialSalary: (item) => set((s) => ({ commercialSalaries: [...s.commercialSalaries, { ...item, id: uuidv4() }] })),
  updateCommercialSalary: (id, data) => set((s) => ({ commercialSalaries: s.commercialSalaries.map((i) => i.id === id ? { ...i, ...data } : i) })),
  deleteCommercialSalary: (id) => set((s) => ({ commercialSalaries: s.commercialSalaries.filter((i) => i.id !== id) })),

  adminSalaries: [],
  addAdminSalary: (item) => set((s) => ({ adminSalaries: [...s.adminSalaries, { ...item, id: uuidv4() }] })),
  updateAdminSalary: (id, data) => set((s) => ({ adminSalaries: s.adminSalaries.map((i) => i.id === id ? { ...i, ...data } : i) })),
  deleteAdminSalary: (id) => set((s) => ({ adminSalaries: s.adminSalaries.filter((i) => i.id !== id) })),

  maintenanceSalaries: [],
  addMaintenanceSalary: (item) => set((s) => ({ maintenanceSalaries: [...s.maintenanceSalaries, { ...item, id: uuidv4() }] })),
  updateMaintenanceSalary: (id, data) => set((s) => ({ maintenanceSalaries: s.maintenanceSalaries.map((i) => i.id === id ? { ...i, ...data } : i) })),
  deleteMaintenanceSalary: (id) => set((s) => ({ maintenanceSalaries: s.maintenanceSalaries.filter((i) => i.id !== id) })),

  indirectSalaries: [],
  addIndirectSalary: (item) => set((s) => ({ indirectSalaries: [...s.indirectSalaries, { ...item, id: uuidv4() }] })),
  updateIndirectSalary: (id, data) => set((s) => ({ indirectSalaries: s.indirectSalaries.map((i) => i.id === id ? { ...i, ...data } : i) })),
  deleteIndirectSalary: (id) => set((s) => ({ indirectSalaries: s.indirectSalaries.filter((i) => i.id !== id) })),

  directCostSalaries: [],
  addDirectCostSalary: (item) => set((s) => ({ directCostSalaries: [...s.directCostSalaries, { ...item, id: uuidv4() }] })),
  updateDirectCostSalary: (id, data) => set((s) => ({ directCostSalaries: s.directCostSalaries.map((i) => i.id === id ? { ...i, ...data } : i) })),
  deleteDirectCostSalary: (id) => set((s) => ({ directCostSalaries: s.directCostSalaries.filter((i) => i.id !== id) })),

  // Logical Framework
  logicalFramework: { ...defaultLogicalFramework, rows: [...defaultLogicalFramework.rows] },
  updateLogicalFramework: (data) =>
    set((s) => ({ logicalFramework: { ...s.logicalFramework, ...data } })),
  addLogicalFrameworkRow: (row) =>
    set((s) => ({
      logicalFramework: {
        ...s.logicalFramework,
        rows: [...s.logicalFramework.rows, { ...row, id: uuidv4() }],
      },
    })),
  updateLogicalFrameworkRow: (id, data) =>
    set((s) => ({
      logicalFramework: {
        ...s.logicalFramework,
        rows: s.logicalFramework.rows.map((r) =>
          r.id === id ? { ...r, ...data } : r
        ),
      },
    })),
  deleteLogicalFrameworkRow: (id) =>
    set((s) => ({
      logicalFramework: {
        ...s.logicalFramework,
        rows: s.logicalFramework.rows.filter((r) => r.id !== id),
      },
    })),

  // Helpers
  getMonthsRange: () => {
    const state = get();
    const startDate = state.project.startDate || new Date().toISOString().slice(0, 7);
    const [year, month] = startDate.split('-').map(Number);
    const duration = state.project.monthsDuration || 120;
    const months: string[] = [];
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    for (let i = 0; i < duration; i++) {
      const m = ((month - 1 + i) % 12) + 1;
      const y = year + Math.floor((month - 1 + i) / 12);
      months.push(`${monthNames[m - 1]} ${y}`);
    }
    return months;
  },

  // Load from parsed Excel/JSON data (with normalization to ensure arrays are arrays).
  // IMPORTANT: All state updates are batched into a SINGLE set() call to prevent
  // subscribers (autosave, React components) from observing an intermediate empty
  // state that could cause data loss or NaN rendering errors.
  loadFromExcel: (data: any) => {
    // Filter out auto-generated items (e.g., investment financial expenses)
    const otherResourceFiltered = data.otherResourceItems
      ? data.otherResourceItems.filter((item: any) => !item.isAutoGenerated)
      : [];

    // Single atomic set() — no intermediate empty state visible to subscribers
    set({
      // Project data (only override if provided in import)
      ...(data.project ? { project: { ...defaultProject, ...data.project } } : {}),
      // Parameters: always reset to defaults first, then overlay imported values
      parameters: { ...defaultParameters, ...normalizeParameters(data.parameters || {}) },
      // Item arrays: empty modules default to [] (prevents stale data from previous project),
      // populated modules are normalized to ensure array fields are actual arrays.
      constructionItems: data.constructionItems ? normalizeItemsArray(data.constructionItems, 'constructionItems') : [],
      capitalItems: data.capitalItems ? normalizeItemsArray(data.capitalItems, 'capitalItems') : [],
      subcontractItems: data.subcontractItems ? normalizeItemsArray(data.subcontractItems, 'subcontractItems') : [],
      resourceItems: data.resourceItems ? normalizeItemsArray(data.resourceItems, 'resourceItems') : [],
      purchaseItems: data.purchaseItems ? normalizeItemsArray(data.purchaseItems, 'purchaseItems') : [],
      salesItems: data.salesItems ? normalizeItemsArray(data.salesItems, 'salesItems') : [],
      otherIncomeItems: data.otherIncomeItems ? normalizeItemsArray(data.otherIncomeItems, 'otherIncomeItems') : [],
      subventionItems: data.subventionItems ? normalizeItemsArray(data.subventionItems, 'subventionItems') : [],
      salesReturnItems: data.salesReturnItems ? normalizeItemsArray(data.salesReturnItems, 'salesReturnItems') : [],
      commercialExpenses: data.commercialExpenses ? normalizeItemsArray(data.commercialExpenses, 'commercialExpenses') : [],
      adminExpenses: data.adminExpenses ? normalizeItemsArray(data.adminExpenses, 'adminExpenses') : [],
      maintenanceItems: data.maintenanceItems ? normalizeItemsArray(data.maintenanceItems, 'maintenanceItems') : [],
      indirectExpenses: data.indirectExpenses ? normalizeItemsArray(data.indirectExpenses, 'indirectExpenses') : [],
      loans: data.loans ? normalizeItemsArray(data.loans, 'loans') : [],
      sparePartItems: data.sparePartItems ? normalizeItemsArray(data.sparePartItems, 'sparePartItems') : [],
      otherResourceItems: normalizeItemsArray(otherResourceFiltered, 'otherResourceItems'),
      intangibleAssets: data.intangibleAssets ? normalizeItemsArray(data.intangibleAssets, 'intangibleAssets') : [],
      directCostItems: data.directCostItems ? normalizeItemsArray(data.directCostItems, 'directCostItems') : [],
      publicServiceItems: data.publicServiceItems ? normalizeItemsArray(data.publicServiceItems, 'publicServiceItems') : [],
      commercialSalaries: data.commercialSalaries ? normalizeItemsArray(data.commercialSalaries, 'commercialSalaries') : [],
      adminSalaries: data.adminSalaries ? normalizeItemsArray(data.adminSalaries, 'adminSalaries') : [],
      maintenanceSalaries: data.maintenanceSalaries ? normalizeItemsArray(data.maintenanceSalaries, 'maintenanceSalaries') : [],
      indirectSalaries: data.indirectSalaries ? normalizeItemsArray(data.indirectSalaries, 'indirectSalaries') : [],
      directCostSalaries: data.directCostSalaries ? normalizeItemsArray(data.directCostSalaries, 'directCostSalaries') : [],
      // Logical Framework: always reset to default, override if provided
      logicalFramework: data.logicalFramework
        ? { ...defaultLogicalFramework, ...data.logicalFramework }
        : { ...defaultLogicalFramework, rows: [...defaultLogicalFramework.rows] },
    });
  },

  // Reset
  resetAll: () =>
    set({
      project: { ...defaultProject },
      constructionItems: [],
      capitalItems: [],
      subcontractItems: [],
      resourceItems: [],
      purchaseItems: [],
      salesItems: [],
      otherIncomeItems: [],
      subventionItems: [],
      salesReturnItems: [],
      commercialExpenses: [],
      adminExpenses: [],
      maintenanceItems: [],
      indirectExpenses: [],
      sparePartItems: [],
      otherResourceItems: [],
      intangibleAssets: [],
      directCostItems: [],
      publicServiceItems: [],
      commercialSalaries: [],
      adminSalaries: [],
      maintenanceSalaries: [],
      indirectSalaries: [],
      directCostSalaries: [],
      loans: [],
      parameters: { ...defaultParameters },
      logicalFramework: { ...defaultLogicalFramework, rows: [...defaultLogicalFramework.rows] },
      activeModule: 'dashboard',
      sidebarOpen: false,
    }),
}));
