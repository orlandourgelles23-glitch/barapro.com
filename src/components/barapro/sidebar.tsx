'use client';
import { L } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useBaraproStore, type ModuleId } from '@/lib/barapro-store';
import {
  LayoutDashboard,
  FolderOpen,
  Building2,
  Briefcase,
  Handshake,
  Users,
  ShoppingCart,
  TrendingUp,
  Megaphone,
  Settings,
  Wrench,
  Layers,
  Landmark,
  Sliders,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Target,
  FileDown,
  X,
  GitBranch,
  Cog,
  Package,
  Boxes,
  DollarSign,
  PieChart,
  Scale,
  Globe,
  Wallet,
  Sparkles,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Key,
  Shield,
  Search,
  FolderCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
import { ProjectManagerDialog } from './project-manager';
import { ModeToggle } from '@/components/mode-toggle';
import { LicenseManager } from '@/components/barapro/license-manager';
import { CenterSetup } from '@/components/barapro/center-setup';
import { useSidebarCollapsed, toggleSidebarCollapsed, setSidebarCollapsed } from '@/lib/use-sidebar-collapsed';

/* ------------------------------------------------------------------ */
/*  Section color mapping — uses CSS custom properties                */
/* ------------------------------------------------------------------ */
type SectionTheme = 'panel' | 'marco' | 'datos' | 'inversion' | 'operaciones' | 'resultados';

const sectionThemeMap: Record<string, SectionTheme> = {
  'panel': 'panel',
  'marco-logico': 'marco',
  'datos-parametros': 'datos',
  'inversion-inicial': 'inversion',
  'operaciones': 'operaciones',
  'resultados': 'resultados',
};

/** Returns CSS var references for a section theme */
function getSectionVars(theme: SectionTheme) {
  return {
    header: `var(--section-${theme}-header)`,
    icon: `var(--section-${theme}-icon)`,
    iconActive: `var(--section-${theme}-icon-active)`,
    text: `var(--section-${theme}-text)`,
    textMuted: `var(--section-${theme}-text-muted)`,
    glow: `var(--section-${theme}-glow)`,
    hoverBg: `var(--section-${theme}-hover-bg)`,
    activeBg: `var(--section-${theme}-active-bg)`,
  };
}

/* ------------------------------------------------------------------ */
/*  License button                                                     */
/* ------------------------------------------------------------------ */
function SidebarLicenseManager() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[12px] text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/40 transition-all duration-150"
      >
        <Key className="h-3.5 w-3.5" />
        <span>Licencia</span>
      </button>
      <LicenseManager isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface NavItem {
  id: ModuleId;
  labelKey: string;
  icon: React.ElementType;
}
interface NavSection {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  items: NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Navigation definitions                                             */
/* ------------------------------------------------------------------ */
const navSections: NavSection[] = [
  {
    id: 'panel',
    labelKey: 'sidebar.panel',
    icon: LayoutDashboard,
    items: [{ id: 'dashboard', labelKey: 'sidebar.mainDashboard', icon: LayoutDashboard }],
  },
  {
    id: 'marco-logico',
    labelKey: 'sidebar.logicalFramework',
    icon: GitBranch,
    items: [{ id: 'logical-framework', labelKey: 'sidebar.logicalFramework', icon: GitBranch }],
  },
  {
    id: 'datos-parametros',
    labelKey: 'sidebar.dataAndParameters',
    icon: Settings,
    items: [
      { id: 'A', labelKey: 'sidebar.projectData', icon: FolderOpen },
      { id: 'N', labelKey: 'sidebar.financialParameters', icon: Sliders },
    ],
  },
  {
    id: 'inversion-inicial',
    labelKey: 'sidebar.initialInvestment',
    icon: Building2,
    items: [
      { id: 'B', labelKey: 'sidebar.construction', icon: Building2 },
      { id: 'C', labelKey: 'sidebar.capitalExpenditures', icon: Briefcase },
      { id: 'D', labelKey: 'sidebar.subcontracting', icon: Handshake },
      { id: 'E', labelKey: 'sidebar.humanResources', icon: Users },
      { id: 'spare-parts', labelKey: 'sidebar.sparePartsAndTools', icon: Package },
      { id: 'other-resources', labelKey: 'sidebar.otherResources', icon: Boxes },
      { id: 'intangible-assets', labelKey: 'sidebar.intangibleAssets', icon: Sparkles },
      { id: 'M', labelKey: 'sidebar.financing', icon: Landmark },
    ],
  },
  {
    id: 'operaciones',
    labelKey: 'sidebar.operations',
    icon: Cog,
    items: [
      { id: 'F', labelKey: 'sidebar.purchasesMP', icon: ShoppingCart },
      { id: 'H', labelKey: 'sidebar.sales', icon: TrendingUp },
      { id: 'direct-costs', labelKey: 'sidebar.directCosts', icon: DollarSign },
      { id: 'I', labelKey: 'sidebar.commercialExpenses', icon: Megaphone },
      { id: 'J', labelKey: 'sidebar.adminExpenses', icon: Settings },
      { id: 'K', labelKey: 'sidebar.maintenance', icon: Wrench },
      { id: 'L', labelKey: 'sidebar.indirectExpenses', icon: Layers },
    ],
  },
  {
    id: 'resultados',
    labelKey: 'sidebar.results',
    icon: BarChart3,
    items: [
      { id: 'investment-budget', labelKey: 'sidebar.investmentBudget', icon: Briefcase },
      { id: 'investment-schedule', labelKey: 'sidebar.investmentSchedule', icon: Clock },
      { id: 'depreciation', labelKey: 'sidebar.depreciation', icon: TrendingDown },
      { id: 'costs-financial', labelKey: 'sidebar.financialCosts', icon: Landmark },
      { id: 'income-statement', labelKey: 'sidebar.erf', icon: FileSpreadsheet },
      { id: 'working-capital', labelKey: 'sidebar.workingCapital', icon: Wallet },
      { id: 'cash-flow-planning', labelKey: 'sidebar.planningCashFlow', icon: FileText },
      { id: 'cash-flow-investment', labelKey: 'sidebar.investmentCashFlow', icon: FileText },
      { id: 'balance-sheet', labelKey: 'sidebar.balanceSheet', icon: Scale },
      { id: 'currency-effect', labelKey: 'sidebar.currencyEffect', icon: Globe },
      { id: 'utility-distribution', labelKey: 'sidebar.utilityDistribution', icon: PieChart },
      { id: 'indicators', labelKey: 'sidebar.indicators', icon: Target },
      { id: 'sensitivity', labelKey: 'sidebar.sensitivity', icon: BarChart3 },
      { id: 'scenarios', labelKey: 'sidebar.scenarios', icon: Sparkles },
      { id: 'other-taxes', labelKey: 'sidebar.otherTaxes', icon: Landmark },
      { id: 'pdf-report', labelKey: 'sidebar.exportFormats', icon: FileDown },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */
export function Sidebar() {
  const { activeModule, setActiveModule, project, sidebarOpen, setSidebarOpen } = useBaraproStore();
  const [pmOpen, setPmOpen] = useState(false);
  const sidebarCollapsed = useSidebarCollapsed();
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const desktopSubscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);
  const getDesktopSnapshot = useCallback(() => window.matchMedia('(min-width: 1024px)').matches, []);
  const getDesktopServerSnapshot = useCallback(() => false, []);
  const isDesktop = useSyncExternalStore(desktopSubscribe, getDesktopSnapshot, getDesktopServerSnapshot);

  const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean | null>>({});
  const expandedSections = useMemo(() => {
    const r: Record<string, boolean> = {};
    navSections.forEach((s) => {
      const o = sectionOverrides[s.id];
      r[s.id] = o !== null && o !== undefined ? o : isDesktop;
    });
    return r;
  }, [isDesktop, sectionOverrides]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return navSections;
    const q = searchQuery.toLowerCase();
    return navSections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) => L(i.labelKey).toLowerCase().includes(q) || L(s.labelKey).toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [setSidebarOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleSection = (id: string) => {
    setSectionOverrides((p) => ({ ...p, [id]: !expandedSections[id] }));
  };

  const isModuleInSection = (s: NavSection, m: ModuleId) => s.items.some((i) => i.id === m);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className="sidebar-aside fixed left-0 top-0 z-50 w-64 flex flex-col bg-background/98 backdrop-blur-sm border-r border-border/40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={isDesktop ? undefined : { transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        data-sidebar-open={String(sidebarOpen)}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 h-11 px-3.5 shrink-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/logo-barapro.png" alt="" className="h-full w-full object-cover rounded-md" />
          </div>
          <span className="text-[14px] font-bold tracking-tight text-foreground/90">BARAPRO</span>
          <span className="text-[10px] font-mono text-muted-foreground/35 ml-0.5 bg-muted/40 px-1.5 py-0.5 rounded">v11</span>
          <div className="ml-auto lg:hidden">
            <button
              onClick={() => { setSidebarOpen(false); setSidebarCollapsed(true); }}
              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all duration-150"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Search — always visible ── */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar módulo..."
              className="h-7 pl-7 pr-8 text-[13px] bg-muted/20 border-border/30 rounded-md placeholder:text-muted-foreground/35 focus-visible:ring-1 focus-visible:ring-primary/25 focus-visible:border-primary/30 focus-visible:bg-background transition-all duration-150"
            />
            {!searchQuery ? (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-4 items-center gap-0.5 rounded border border-border/40 bg-muted/20 px-1 font-mono text-[9px] text-muted-foreground/40">
                ⌘K
              </kbd>
            ) : (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded flex items-center justify-center hover:bg-muted/50 transition-all duration-150"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground/50" />
              </button>
            )}
          </div>
        </div>

        {/* ── Project selector — pill/chip style ── */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setPmOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/30 bg-muted/15 text-left hover:border-primary/20 hover:bg-primary/[0.03] transition-all duration-150 group"
          >
            <FolderCog className="h-3.5 w-3.5 text-primary/50 shrink-0 group-hover:text-primary/70" />
            <span className="text-[12px] truncate text-foreground/65 group-hover:text-foreground/85 font-medium transition-all duration-150">
              {project.projectName || 'Sin proyecto'}
            </span>
          </button>
        </div>

        {/* Subtle separator */}
        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-1.5 px-2 space-y-0.5 sidebar-scroll">
          {filteredSections.map((section) => {
            const isExpanded = searchQuery.trim() ? true : expandedSections[section.id] !== false;
            const hasActive = isModuleInSection(section, activeModule);
            const theme = sectionThemeMap[section.id] || 'panel';
            const vars = getSectionVars(theme);

            return (
              <div key={section.id} className="rounded-lg">
                {/* Section header — with color accent */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] uppercase tracking-[0.08em] transition-all duration-150 cursor-pointer select-none rounded-md',
                  )}
                  style={{
                    color: hasActive ? vars.header : undefined,
                  }}
                >
                  {/* Section icon with color */}
                  <section.icon
                    className="h-3.5 w-3.5 shrink-0 transition-colors duration-150"
                    style={{ color: hasActive ? vars.iconActive : vars.icon, opacity: hasActive ? 1 : 0.55 }}
                  />
                  <span
                    className={cn(
                      'truncate font-semibold',
                      !hasActive && 'text-muted-foreground/50',
                    )}
                    style={hasActive ? { color: vars.header } : undefined}
                  >
                    {L(section.labelKey)}
                  </span>
                  <ChevronDown
                    className={cn(
                      'ml-auto h-2.5 w-2.5 shrink-0 transition-transform duration-150',
                      !isExpanded && '-rotate-90'
                    )}
                    style={{ color: hasActive ? vars.icon : undefined }}
                  />
                </button>

                {/* Items */}
                <div
                  className="overflow-hidden transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ maxHeight: isExpanded ? '1200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                >
                  <div className="space-y-px pb-0.5 pl-1">
                    {section.items.map((item) => {
                      const isActive = activeModule === item.id;
                      return (
                        <NavItemButton
                          key={item.id}
                          item={item}
                          active={isActive}
                          sectionTheme={theme}
                          onClick={() => {
                            setActiveModule(item.id);
                            if (window.innerWidth < 1024) setSidebarOpen(false);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSections.length === 0 && searchQuery && (
            <div className="py-8 text-center">
              <p className="text-[12px] text-muted-foreground/30">Sin resultados</p>
            </div>
          )}
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 px-3 pb-2 pt-1">
          <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent mb-2" />
          <div className="flex items-center">
            <CenterSetup />
            <SidebarLicenseManager />
            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/20 mt-2 font-mono text-center tracking-wider">v11.0.0</p>
        </div>
      </aside>

      {/* Toggle */}
      <button
        onClick={toggleSidebarCollapsed}
        className="sidebar-toggle-btn"
        title={sidebarCollapsed ? 'Mostrar panel' : 'Ocultar panel'}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <ProjectManagerDialog open={pmOpen} onOpenChange={setPmOpen} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav item — with section-colored accents                            */
/* ------------------------------------------------------------------ */
function NavItemButton({
  item,
  active,
  sectionTheme,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  sectionTheme: SectionTheme;
  onClick: () => void;
}) {
  const store = useBaraproStore();
  const vars = getSectionVars(sectionTheme);

  const itemCount = useMemo(() => {
    const c: Record<string, number> = {
      A: 1,
      'logical-framework': store.logicalFramework?.rows?.length || 0,
      B: store.constructionItems.length,
      C: store.capitalItems.length,
      D: store.subcontractItems.length,
      E: store.resourceItems.length,
      F: store.purchaseItems.length,
      H: store.salesItems.length,
      'direct-costs': store.directCostItems.length,
      I: store.commercialExpenses.length,
      J: store.adminExpenses.length,
      K: store.maintenanceItems.length,
      L: store.indirectExpenses.length,
      M: store.loans.length,
      N: 1,
      'spare-parts': store.sparePartItems.length,
      'other-resources': store.otherResourceItems.length,
      'intangible-assets': store.intangibleAssets.length,
    };
    return c[item.id] || 0;
  }, [store, item.id]);

  const Icon = item.icon;
  const showDot = !['dashboard', 'N', 'A', 'logical-framework'].includes(item.id) && itemCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-md text-[14px] transition-all duration-150 cursor-pointer relative group',
        active
          ? 'shadow-sm'
          : 'hover:shadow-none',
      )}
      style={{
        backgroundColor: active ? vars.activeBg : undefined,
        color: active ? vars.text : undefined,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = vars.hoverBg;
          e.currentTarget.style.color = vars.textMuted;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = '';
          e.currentTarget.style.color = '';
        }
      }}
    >
      {/* Active left indicator — colored by section */}
      {active && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
          style={{ backgroundColor: vars.iconActive }}
        />
      )}

      <Icon
        className="h-[15px] w-[15px] shrink-0 transition-colors duration-150"
        style={{ color: active ? vars.iconActive : vars.icon, opacity: active ? 1 : 0.5 }}
      />
      <span
        className={cn('truncate transition-all duration-150', active && 'font-semibold')}
      >
        {L(item.labelKey)}
      </span>

      {/* Dot indicator with section color */}
      {showDot && (
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-150"
          style={{
            backgroundColor: active ? vars.iconActive : vars.glow,
            opacity: active ? 0.8 : 0.35,
          }}
        />
      )}
    </button>
  );
}
