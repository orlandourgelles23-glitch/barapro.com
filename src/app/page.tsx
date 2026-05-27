'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useBaraproStore, type ModuleId } from '@/lib/barapro-store';
import { useAuthStore } from '@/lib/auth-store';
import { useLicense } from '@/lib/use-license';
import { LicenseGate } from '@/components/barapro/license-gate';
import { LicenseBanner } from '@/components/barapro/license-banner';
import { SalarySubModule } from '@/components/barapro/salary-submodule';
import { AIAssistant } from '@/components/barapro/ai-assistant';
import { Sidebar } from '@/components/barapro/sidebar';
import { ExcelToolbar } from '@/components/barapro/excel-toolbar';
import { LoginScreen } from '@/components/barapro/login-screen';
import { useAutoSave } from '@/lib/barapro-autosave';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Menu, Save, Check, AlertCircle, Loader2, FileText, BarChart3, Download, LogOut, User, KeyRound, Users, ChevronDown } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { UserManagement, ChangePasswordSelfDialog } from '@/components/barapro/user-management';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setSidebarCollapsed } from '@/lib/use-sidebar-collapsed';
import { toast } from 'sonner';
import { L } from '@/lib/labels';

// ── Lazy loading spinner component — modern pulsing animation ──
function ModuleLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </div>
      <span className="text-fin-sm text-muted-foreground">Cargando módulo...</span>
    </div>
  );
}

// ── ChunkLoadError retry wrapper ──
// Turbopack dev server can produce stale chunks; retry up to 3 times with backoff
function withRetry<T extends Record<string, unknown>>(
  importFn: () => Promise<T>,
  maxRetries = 3,
): () => Promise<T> {
  return async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await importFn();
      } catch (err: unknown) {
        lastError = err;
        const isChunkError = err instanceof Error && (
          err.message.includes('ChunkLoadError') ||
          err.message.includes('Failed to load chunk') ||
          err.message.includes('Loading chunk')
        );
        if (!isChunkError || attempt === maxRetries - 1) throw err;
        // Wait before retrying (exponential backoff: 500ms, 1000ms)
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastError;
  };
}

// ── Dynamic imports — modules loaded on demand with chunk retry, not bundled in initial page ──
const ProjectDataForm = dynamic(withRetry(() => import('@/components/barapro/project-data-form').then(m => ({ default: m.ProjectDataForm }))), { loading: ModuleLoader, ssr: false });
const SalesModule = dynamic(withRetry(() => import('@/components/barapro/sales-module').then(m => ({ default: m.SalesModule }))), { loading: ModuleLoader, ssr: false });
const LoansModule = dynamic(withRetry(() => import('@/components/barapro/loans-module').then(m => ({ default: m.LoansModule }))), { loading: ModuleLoader, ssr: false });
const ParametersForm = dynamic(withRetry(() => import('@/components/barapro/parameters-form').then(m => ({ default: m.ParametersForm }))), { loading: ModuleLoader, ssr: false });
const LogicalFramework = dynamic(withRetry(() => import('@/components/barapro/logical-framework').then(m => ({ default: m.LogicalFramework }))), { loading: ModuleLoader, ssr: false });
const DashboardView = dynamic(withRetry(() => import('@/components/barapro/dashboard-view').then(m => ({ default: m.DashboardView }))), { loading: ModuleLoader, ssr: false });
const SparePartsModule = dynamic(withRetry(() => import('@/components/barapro/spare-parts-module').then(m => ({ default: m.SparePartsModule }))), { loading: ModuleLoader, ssr: false });
const OtherResourcesModule = dynamic(withRetry(() => import('@/components/barapro/other-resources-module').then(m => ({ default: m.OtherResourcesModule }))), { loading: ModuleLoader, ssr: false });
const InvestmentBudgetView = dynamic(withRetry(() => import('@/components/barapro/investment-budget-view').then(m => ({ default: m.InvestmentBudgetView }))), { loading: ModuleLoader, ssr: false });
const DepreciationView = dynamic(withRetry(() => import('@/components/barapro/depreciation-view').then(m => ({ default: m.DepreciationView }))), { loading: ModuleLoader, ssr: false });
const FinancialCostsView = dynamic(withRetry(() => import('@/components/barapro/financial-costs-view').then(m => ({ default: m.FinancialCostsView }))), { loading: ModuleLoader, ssr: false });
const WorkingCapitalView = dynamic(withRetry(() => import('@/components/barapro/working-capital-view').then(m => ({ default: m.WorkingCapitalView }))), { loading: ModuleLoader, ssr: false });
const CurrencyEffectView = dynamic(withRetry(() => import('@/components/barapro/currency-effect-view').then(m => ({ default: m.CurrencyEffectView }))), { loading: ModuleLoader, ssr: false });
const UtilityDistributionView = dynamic(withRetry(() => import('@/components/barapro/utility-distribution-view').then(m => ({ default: m.UtilityDistributionView }))), { loading: ModuleLoader, ssr: false });
const IndicatorsView = dynamic(withRetry(() => import('@/components/barapro/indicators-view').then(m => ({ default: m.IndicatorsView }))), { loading: ModuleLoader, ssr: false });
const ScenariosView = dynamic(withRetry(() => import('@/components/barapro/scenarios-view').then(m => ({ default: m.ScenariosView }))), { loading: ModuleLoader, ssr: false });
const EnhancedERFView = dynamic(withRetry(() => import('@/components/barapro/enhanced-erf-view').then(m => ({ default: m.EnhancedERFView }))), { loading: ModuleLoader, ssr: false });
const CashFlowPlanningView = dynamic(withRetry(() => import('@/components/barapro/cash-flow-planning-view').then(m => ({ default: m.CashFlowPlanningView }))), { loading: ModuleLoader, ssr: false });
const CashFlowInvestmentView = dynamic(withRetry(() => import('@/components/barapro/cash-flow-investment-view').then(m => ({ default: m.CashFlowInvestmentView }))), { loading: ModuleLoader, ssr: false });
const SensitivityView = dynamic(withRetry(() => import('@/components/barapro/sensitivity-view').then(m => ({ default: m.SensitivityView }))), { loading: ModuleLoader, ssr: false });
const IntangibleAssetsModule = dynamic(withRetry(() => import('@/components/barapro/intangible-assets-module').then(m => ({ default: m.IntangibleAssetsModule }))), { loading: ModuleLoader, ssr: false });
const BalanceSheetView = dynamic(withRetry(() => import('@/components/barapro/balance-sheet-view').then(m => ({ default: m.BalanceSheetView }))), { loading: ModuleLoader, ssr: false });
const InvestmentScheduleView = dynamic(withRetry(() => import('@/components/barapro/investment-schedule-view').then(m => ({ default: m.InvestmentScheduleView }))), { loading: ModuleLoader, ssr: false });
const DirectCostsModule = dynamic(withRetry(() => import('@/components/barapro/direct-costs-module').then(m => ({ default: m.DirectCostsModule }))), { loading: ModuleLoader, ssr: false });
const OtherTaxesModule = dynamic(withRetry(() => import('@/components/barapro/other-taxes-module').then(m => ({ default: m.OtherTaxesModule }))), { loading: ModuleLoader, ssr: false });

// Cost module and operations wrapper — loaded with their configs
const CostModule = dynamic(withRetry(() => import('@/components/barapro/cost-module').then(m => ({ default: m.CostModule }))), { loading: ModuleLoader, ssr: false });
const OperationsModuleWrapper = dynamic(withRetry(() => import('@/components/barapro/operations-module-wrapper').then(m => ({ default: m.OperationsModuleWrapper }))), { loading: ModuleLoader, ssr: false });

// Cost module configs — lightweight, can stay static
import {
  moduleBConfig,
  moduleCConfig,
  moduleDConfig,
  moduleFConfig,
  moduleIConfig,
  moduleJConfig,
  moduleKConfig,
  moduleLConfig,
} from '@/components/barapro/cost-module';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const costModuleMap: Record<string, any> = {
  B: moduleBConfig,
  C: moduleCConfig,
  D: moduleDConfig,
  F: moduleFConfig,
  I: moduleIConfig,
  J: moduleJConfig,
  K: moduleKConfig,
  L: moduleLConfig,
};

class ModuleErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = {hasError: false, error: null}; }
  static getDerivedStateFromError(error: Error) { return {hasError: true, error}; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center"><h2 className="text-lg font-bold text-danger mb-2">Error en el módulo</h2><p className="text-sm text-muted-foreground mb-4">{this.state.error?.message}</p><Button onClick={() => this.setState({hasError: false, error: null})}>Reintentar</Button></div>;
    }
    return this.props.children;
  }
}

function ModuleRenderer({ moduleId }: { moduleId: ModuleId }) {
  const resourceItems = useBaraproStore((s) => s.resourceItems);
  const addResourceItem = useBaraproStore((s) => s.addResourceItem);
  const updateResourceItem = useBaraproStore((s) => s.updateResourceItem);
  const deleteResourceItem = useBaraproStore((s) => s.deleteResourceItem);

  switch (moduleId) {
    case 'dashboard':
      return <DashboardView />;
    case 'logical-framework':
      return <LogicalFramework />;
    case 'A':
      return <ProjectDataForm />;
    case 'B':
    case 'C':
    case 'D':
      return <CostModule config={costModuleMap[moduleId]} />;
    case 'E': {
      return <SalarySubModule title="E. Recursos Humanos (Inversión Inicial)" description="Personal del proyecto con salarios y cargos durante la inversión" items={resourceItems} onAdd={addResourceItem} onUpdate={updateResourceItem} onDelete={deleteResourceItem} />;
    }
    case 'F':
    case 'I':
    case 'J':
    case 'K':
    case 'L':
      return <OperationsModuleWrapper config={costModuleMap[moduleId]} />;
    case 'H':
      return <SalesModule />;
    case 'direct-costs':
      return <DirectCostsModule />;
    case 'M':
      return <LoansModule />;
    case 'N':
      return <ParametersForm />;
    // New input modules
    case 'spare-parts':
      return <SparePartsModule />;
    case 'other-resources':
      return <OtherResourcesModule />;
    case 'intangible-assets':
      return <IntangibleAssetsModule />;
    // Results views
    case 'investment-budget':
      return <InvestmentBudgetView />;
    case 'investment-schedule':
      return <InvestmentScheduleView />;
    case 'depreciation':
      return <DepreciationView />;
    case 'costs-financial':
      return <FinancialCostsView />;
    case 'working-capital':
      return <WorkingCapitalView />;
    case 'currency-effect':
      return <CurrencyEffectView />;
    case 'utility-distribution':
      return <UtilityDistributionView />;
    case 'indicators':
      return <IndicatorsView />;
    case 'income-statement':
      return <EnhancedERFView />;
    case 'cash-flow-planning':
      return <CashFlowPlanningView />;
    case 'cash-flow-investment':
      return <CashFlowInvestmentView />;
    case 'sensitivity':
      return <SensitivityView />;
    case 'scenarios':
      return <ScenariosView />;
    case 'balance-sheet':
      return <BalanceSheetView />;
    case 'pdf-report':
      return <ReportExportView />;
    case 'other-taxes':
      return <OtherTaxesModule />;
    default:
      return <DashboardView />;
  }
}

// ── ReportExportView — modernized with glass effects and professional styling ──
function ReportExportView() {
  // Use selectors to avoid subscribing to ALL store state (prevents render storms)
  const project = useBaraproStore((s) => s.project);
  const constructionItems = useBaraproStore((s) => s.constructionItems);
  const capitalItems = useBaraproStore((s) => s.capitalItems);
  const subcontractItems = useBaraproStore((s) => s.subcontractItems);
  const resourceItems = useBaraproStore((s) => s.resourceItems);
  const purchaseItems = useBaraproStore((s) => s.purchaseItems);
  const salesItems = useBaraproStore((s) => s.salesItems);
  const otherIncomeItems = useBaraproStore((s) => s.otherIncomeItems);
  const subventionItems = useBaraproStore((s) => s.subventionItems);
  const salesReturnItems = useBaraproStore((s) => s.salesReturnItems);
  const commercialExpenses = useBaraproStore((s) => s.commercialExpenses);
  const adminExpenses = useBaraproStore((s) => s.adminExpenses);
  const maintenanceItems = useBaraproStore((s) => s.maintenanceItems);
  const indirectExpenses = useBaraproStore((s) => s.indirectExpenses);
  const loans = useBaraproStore((s) => s.loans);
  const parameters = useBaraproStore((s) => s.parameters);
  const sparePartItems = useBaraproStore((s) => s.sparePartItems);
  const otherResourceItems = useBaraproStore((s) => s.otherResourceItems);
  const intangibleAssets = useBaraproStore((s) => s.intangibleAssets);
  const directCostItems = useBaraproStore((s) => s.directCostItems);
  const publicServiceItems = useBaraproStore((s) => s.publicServiceItems);
  const commercialSalaries = useBaraproStore((s) => s.commercialSalaries);
  const adminSalaries = useBaraproStore((s) => s.adminSalaries);
  const maintenanceSalaries = useBaraproStore((s) => s.maintenanceSalaries);
  const indirectSalaries = useBaraproStore((s) => s.indirectSalaries);
  const directCostSalaries = useBaraproStore((s) => s.directCostSalaries);
  const logicalFramework = useBaraproStore((s) => s.logicalFramework);
  const [exportingWord, setExportingWord] = useState(false);

  const getSafeName = () => (project.projectName || 'proyecto')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_.]/g, '')
    .replace(/\s+/g, '_');

  const handleExportWord = async () => {
    setExportingWord(true);
    try {
      const { downloadFromApi } = await import('@/lib/download');
      const safeName = getSafeName();

      // Serialize only the data properties of the store (exclude functions)
      const stateData = {
        project,
        constructionItems,
        capitalItems,
        subcontractItems,
        resourceItems,
        purchaseItems,
        salesItems,
        otherIncomeItems,
        subventionItems,
        salesReturnItems,
        commercialExpenses,
        adminExpenses,
        maintenanceItems,
        indirectExpenses,
        loans,
        parameters,
        sparePartItems,
        otherResourceItems,
        intangibleAssets,
        directCostItems,
        publicServiceItems,
        commercialSalaries,
        adminSalaries,
        maintenanceSalaries,
        indirectSalaries,
        directCostSalaries,
        logicalFramework,
      };

      await downloadFromApi(
        '/api/export-docx',
        `${safeName}_Reporte_BARAPRO.docx`,
        stateData,
      );
      toast.success('Reporte Word exportado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al exportar el reporte Word');
    } finally {
      setExportingWord(false);
    }
  };

  // Count totals
  const totalInputItems = constructionItems.length + capitalItems.length
    + subcontractItems.length + resourceItems.length
    + purchaseItems.length
    + salesItems.length + commercialExpenses.length
    + adminExpenses.length + maintenanceItems.length
    + indirectExpenses.length + loans.length
    + sparePartItems.length + otherResourceItems.length
    + intangibleAssets.length + directCostItems.length;

  return (
    <div className="space-y-5 animate-fade-scale">
      {/* Hero card with gradient */}
      <div className="gradient-primary rounded-xl p-5 text-white shadow-card-md relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm">
              <Download className="h-5 w-5" />
            </div>
            <h2 className="text-fin-xl text-white">Exportar Reporte Completo</h2>
          </div>
          <p className="text-fin-sm text-white/75 ml-11">
            Genere el reporte en Word con todos los datos de entrada y resultados financieros
          </p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="grid grid-cols-1 max-w-md mx-auto gap-4">
        {/* Word export */}
        <div className="glass-card rounded-xl shadow-card-md hover:shadow-card-lg transition-all duration-200 hover:scale-[1.01]">
          <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
            <div className="p-3 rounded-xl bg-info-muted/60">
              <FileText className="h-8 w-8 text-info" />
            </div>
            <div>
              <h3 className="text-fin-lg text-foreground">Word (.docx)</h3>
              <p className="text-fin-xs text-muted-foreground mt-1">
                Documento profesional con portada, índice, tablas anuales y mensuales, 14 secciones de resultados
              </p>
            </div>
            <Button
              onClick={handleExportWord}
              disabled={exportingWord}
              className="w-full gap-2 gradient-primary text-white border-0 hover:opacity-90 transition-opacity focus-ring"
            >
              {exportingWord ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
              ) : (
                <><FileText className="h-4 w-4" /> Exportar Word</>
              )}
            </Button>
          </CardContent>
        </div>
      </div>

      {/* Content summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input data summary */}
        <div className="glass-card rounded-xl shadow-card-sm animate-fade-scale" style={{ animationDelay: '0.05s' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-info-muted/60">
                <FileText className="h-4 w-4 text-info" />
              </div>
              <h3 className="text-fin-sm font-semibold">Hojas de Datos de Entrada (19)</h3>
            </div>
            <div className="space-y-1.5 text-fin-xs">
              {[
                ['A. Datos del Proyecto', true],
                ['Marco Lógico', true],
                ['B. Construcción y Montaje', constructionItems.length > 0],
                ['C. Gastos de Capital', capitalItems.length > 0],
                ['D. Subcontrataciones', subcontractItems.length > 0],
                ['E. Recursos Humanos (Inversión)', resourceItems.length > 0],
                ['F. Compras / Materias Primas', purchaseItems.length > 0],
                ['H. Ventas (todos los meses)', salesItems.length > 0],
                ['I. Gastos de Distribución y Ventas', commercialExpenses.length > 0],
                ['J. Gastos Generales y de Administración', adminExpenses.length > 0],
                ['K. Mantenimiento', maintenanceItems.length > 0],
                ['L. Otros Gastos', indirectExpenses.length > 0],
                ['M. Financiamiento', loans.length > 0],
                ['N. Parámetros (27+ campos)', true],
                ['Piezas y Herramientas', sparePartItems.length > 0],
                ['Otros Recursos', otherResourceItems.length > 0],
                ['Activos Intangibles', intangibleAssets.length > 0],
                ['Costos Directos', directCostItems.length > 0],
              ].map(([label, hasData]) => (
                <p key={String(label)} className={`flex items-center gap-1.5 ${hasData ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasData ? 'bg-success' : 'bg-border'}`} />
                  {String(label)}
                </p>
              ))}
            </div>
          </CardContent>
        </div>

        {/* Results summary */}
        <div className="glass-card rounded-xl shadow-card-sm animate-fade-scale" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-success-muted/60">
                <BarChart3 className="h-4 w-4 text-success" />
              </div>
              <h3 className="text-fin-sm font-semibold">Hojas de Resultados Financieros (14)</h3>
            </div>
            <div className="space-y-1.5 text-fin-xs">
              {[
                '8.1 Presupuesto de Inversión (anual + mensual)',
                '8.2 Depreciación y Amortización (anual + mensual)',
                '8.3 Capital de Trabajo (anual + mensual)',
                '8.4 Costos Financieros (anual + mensual)',
                '8.5 ERF — Estado de Rendimiento Financiero (anual + mensual)',
                '8.6 Flujo de Caja — Planificación (anual + mensual)',
                '8.7 Flujo de Caja — Inversión y Capital (anual + mensual)',
                '8.8 Balance General (anual)',
                '8.9 Distribución de Utilidades (anual + mensual)',
                '8.10 Efecto sobre las Divisas (anual + mensual)',
                '8.11 Indicadores Duales (11 indicadores × 2 paneles)',
                '8.12 Análisis de Sensibilidad',
                '8.13 Análisis de Escenarios',
                '8.14 Otros Impuestos (anual + mensual)',
              ].map((label) => (
                <p key={label} className="flex items-center gap-1.5 text-foreground">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                  {label}
                </p>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-fin-xs text-muted-foreground">
                {totalInputItems} registros de entrada | {project.monthsDuration} meses de horizonte
              </p>
            </div>
          </CardContent>
        </div>
      </div>
    </div>
  );
}

// ── Main HomePage — modernized layout with glass header, module transitions ──
export default function HomePage() {
  const activeModule = useBaraproStore((s) => s.activeModule);
  const toggleSidebar = useBaraproStore((s) => s.toggleSidebar);
  const setActiveModule = useBaraproStore((s) => s.setActiveModule);
  const { isAuthenticated, user, logout, _hasHydrated, validateSession } = useAuthStore();
  const { saveStatus } = useAutoSave();
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [isValidatingSession, setIsValidatingSession] = useState(true);
  const { licenseInfo, gateStatus, isValidating, machineId, clockTampered, revalidate } = useLicense();

  // Validate stored session token on first hydration
  useEffect(() => {
    if (!_hasHydrated) return; // Wait for zustand to rehydrate from localStorage

    const check = async () => {
      setIsValidatingSession(true);
      const valid = await validateSession();
      if (!valid) {
        // Token was stale — already auto-logged out by validateSession
      }
      setIsValidatingSession(false);
    };
    check();
  }, [_hasHydrated]);

  // Restore active module from URL hash on mount (survives page refresh)
  // and listen for hashchange events (browser back/forward buttons)
  useEffect(() => {
    const validModules: string[] = [
      'dashboard', 'logical-framework',
      'A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
      'spare-parts', 'other-resources', 'intangible-assets', 'direct-costs',
      'investment-budget', 'investment-schedule', 'depreciation', 'costs-financial',
      'working-capital',
      'cash-flow-planning', 'cash-flow-investment',
      'currency-effect', 'utility-distribution', 'indicators',
      'scenarios', 'income-statement', 'cash-flow',
      'balance-sheet', 'sensitivity', 'pdf-report', 'other-taxes',
    ];

    const restoreFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && validModules.includes(hash)) {
        useBaraproStore.getState().setActiveModule(hash as ModuleId);
      }
    };

    // Restore on mount
    restoreFromHash();

    // Listen for browser back/forward navigation
    window.addEventListener('hashchange', restoreFromHash);
    return () => window.removeEventListener('hashchange', restoreFromHash);
  }, []);

  // Show loading while zustand rehydrates and session is being validated
  if (!_hasHydrated || (isAuthenticated && isValidatingSession)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Verificando sesión...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoginScreen
          onLoginSuccess={(userData, token) => {
            useAuthStore.getState().login(userData, token);
          }}
        />
      </div>
    );
  }

  const saveIndicators: Record<string, { icon: React.ReactNode; text: string; dot: string; color: string; bg: string }> = {
    saved: { icon: <Check className="h-3 w-3" />, text: 'Guardado', dot: 'bg-success', color: 'text-success', bg: 'bg-success-muted/50 border-success/20' },
    saving: { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: 'Guardando...', dot: 'bg-warning', color: 'text-warning', bg: 'bg-warning-muted/50 border-warning/20' },
    unsaved: { icon: <Save className="h-3 w-3" />, text: 'Sin guardar', dot: 'bg-warning', color: 'text-warning', bg: 'bg-warning-muted/50 border-warning/20' },
    error: { icon: <AlertCircle className="h-3 w-3" />, text: 'Error', dot: 'bg-danger', color: 'text-danger', bg: 'bg-danger-muted/50 border-danger/20' },
  };
  const saveIndicator = saveIndicators[saveStatus] ?? saveIndicators.saved;

  const getModuleTitle = (id: ModuleId): string => L(`modules.${id}`);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Sidebar />

      {/* Menu button — refined glass button with shadow, smooth hover */}
      <button
        className="sidebar-menu-btn fixed top-3 left-3 z-30 glass rounded-lg p-2 shadow-card-md cursor-pointer hover:shadow-card-lg hover:scale-105 active:scale-95 transition-all duration-200 focus-ring"
        onClick={() => {
          toggleSidebar();
          setSidebarCollapsed(false);
        }}
        aria-label="Abrir menú lateral"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Main content area — smooth sidebar transition */}
      <div className="main-content-area min-h-screen flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        {/* Top header bar — modern glass effect */}
        <header className="sticky top-0 z-20 glass border-b border-border/50 shrink-0">
          <LicenseBanner
            gateStatus={gateStatus}
            licenseInfo={licenseInfo}
            onLicenseActivated={revalidate}
          />
          <div className="flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex items-center gap-3 pl-10 lg:pl-0">
              <div className="flex items-center">
                <h2 className="text-fin-lg font-bold truncate max-w-[200px] sm:max-w-none px-3 py-1 rounded-lg bg-danger/[0.04] dark:bg-danger/[0.08] text-danger dark:text-danger tracking-tight border border-danger/[0.12] dark:border-danger/[0.18]">
                  {getModuleTitle(activeModule)}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Save indicator — refined styling with smooth dot */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-fin-xs font-medium ${saveIndicator.color} ${saveIndicator.bg} transition-colors duration-200`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${saveIndicator.dot} animate-pulse`} />
                {saveIndicator.icon}
                {saveIndicator.text}
              </div>
              {/* User menu dropdown */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-fin-xs font-medium text-muted-foreground bg-muted/50 border-border/50 hover:bg-muted/80 transition-colors cursor-pointer">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-foreground font-semibold">{user.name || user.username}</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name || user.username}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setChangePwdOpen(true)}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Cambiar Contrasena
                    </DropdownMenuItem>
                    {user.role === 'admin' && (
                      <DropdownMenuItem onClick={() => setUserMgmtOpen(true)}>
                        <Users className="mr-2 h-4 w-4" />
                        Gestionar Usuarios
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        logout();
                        toast.success('Sesion cerrada');
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar Sesion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <ExcelToolbar />
              <ModeToggle />
            </div>
          </div>
        </header>

        {/* Content — with module transition animation */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar">
          <div className="w-full max-w-full pb-8">
            <ModuleErrorBoundary>
              <div key={activeModule} className="module-enter">
                <ModuleRenderer moduleId={activeModule} />
              </div>
            </ModuleErrorBoundary>
          </div>
        </main>
      </div>

      {/* User Management Dialog (admin only) */}
      <UserManagement open={userMgmtOpen} onOpenChange={setUserMgmtOpen} />

      {/* Change Password Dialog (all users) */}
      <ChangePasswordSelfDialog open={changePwdOpen} onOpenChange={setChangePwdOpen} />

      {/* Mobile user menu — visible on small screens */}
      {user && (
        <div className="sm:hidden fixed bottom-4 right-4 z-30 flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center w-12 h-12 rounded-full gradient-primary text-primary-foreground shadow-card-lg hover:shadow-card-xl transition-all duration-200 cursor-pointer">
                <User className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name || user.username}</p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChangePwdOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Cambiar Contrasena
              </DropdownMenuItem>
              {user.role === 'admin' && (
                <DropdownMenuItem onClick={() => setUserMgmtOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Gestionar Usuarios
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  logout();
                  toast.success('Sesion cerrada');
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* AI Assistant FAB */}
      <AIAssistant />

      {/* License Gate — blocks entire app when no valid license */}
      <LicenseGate
        gateStatus={gateStatus}
        licenseInfo={licenseInfo}
        machineId={machineId}
        isValidating={isValidating}
        clockTampered={clockTampered}
        onLicenseActivated={revalidate}
      />
    </div>
  );
}
