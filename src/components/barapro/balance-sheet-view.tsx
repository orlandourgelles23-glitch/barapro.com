'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildBalanceSheet, type BalanceSheetRow } from '@/lib/barapro-financial';
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
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { formatCurrency, formatDecimal } from '@/lib/format';
import {
  Scale,
  Landmark,
  Shield,
  Wallet,
  Building,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRatio(n: number): string {
  return isFinite(n) ? formatDecimal(n, 2) : '—';
}

function formatPct(n: number): string {
  return isFinite(n) ? `${n.toFixed(1)}%` : '—';
}

// ── Concept row definition for the balance table ───────────────────────────────

interface ConceptRow {
  num: number;
  indent: number;
  label: string;
  labelKey: string;
  key: keyof BalanceSheetRow | '__section';
  isDeduction?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isRatio?: boolean;
  isSection?: boolean;
  isNetLine?: boolean;
  isVerification?: boolean;
  isPct?: boolean;
  isInfo?: boolean;
}

const balanceConcepts: ConceptRow[] = [
  // ── ACTIVOS ──
  { num: 0, indent: 0, label: 'TOTAL DE ACTIVOS', labelKey: '__totalActivos', key: 'totalActivos', isTotal: true },

  { num: 1, indent: 1, label: 'I. Activo Circulante', labelKey: '__activoCirculante', key: 'activoCirculante', isSubtotal: true },
  { num: 2, indent: 2, label: 'Efectivo en Caja', labelKey: '__efectivoEnCaja', key: 'efectivoEnCaja' },
  { num: 3, indent: 2, label: 'Efectivo en Banco', labelKey: '__efectivoEnBanco', key: 'efectivoEnBanco' },
  { num: 4, indent: 2, label: 'Cuentas por Cobrar', labelKey: '__cuentasPorCobrar', key: 'cuentasPorCobrar' },
  { num: 5, indent: 2, label: 'Inventarios', labelKey: '__inventarios', key: 'inventarios' },
  { num: 5.1, indent: 2, label: 'Mercancías para la Venta', labelKey: '__mercanciasVenta', key: 'mercanciasVenta' },
  { num: 5.2, indent: 2, label: 'Otros Activos Circulantes', labelKey: '__otrosActivosCirculantes', key: 'otrosActivosCirculantes' },

  { num: 7, indent: 1, label: 'II. Activos Fijos Tangibles (valor bruto)', labelKey: '__aftBruto', key: 'activosFijosTangiblesBruto' },
  { num: 8, indent: 2, label: 'Menos: Depreciación Acumulada', labelKey: '__depAFT', key: 'depreciacionAcumuladaAFT', isDeduction: true },
  { num: 9, indent: 1, label: 'Activos Fijos Tangibles (neto)', labelKey: '__aftNeto', key: 'activosFijosTangiblesNeto', isNetLine: true },

  { num: 10, indent: 1, label: 'III. Activos Fijos Intangibles (valor bruto)', labelKey: '__afiBruto', key: 'activosFijosIntangiblesBruto' },
  { num: 11, indent: 2, label: 'Menos: Amortización Acumulada', labelKey: '__amortAFI', key: 'amortizacionAcumuladaAFI', isDeduction: true },
  { num: 12, indent: 1, label: 'Activos Fijos Intangibles (neto)', labelKey: '__afiNeto', key: 'activosFijosIntangiblesNeto', isNetLine: true },

  { num: 12.01, indent: 1, label: 'IV. Intereses Capitalizados Activados (NIC 23)', labelKey: '__intCap', key: 'interesesCapitalizadosActivos' },

  { num: 12.1, indent: 1, label: 'V. Gastos Previos a la Operación (bruto)', labelKey: '__gpBruto', key: 'gastosPreviosBruto' },
  { num: 12.2, indent: 2, label: 'Menos: Amortización Acumulada GP', labelKey: '__amortGP', key: 'amortizacionAcumuladaGP', isDeduction: true },
  { num: 12.3, indent: 1, label: 'Gastos Previos (neto)', labelKey: '__gpNeto', key: 'gastosPreviosNeto', isNetLine: true },

  // ── PASIVOS ──
  { num: 13, indent: 0, label: 'TOTAL DE PASIVOS', labelKey: '__totalPasivos', key: 'totalPasivos', isTotal: true },

  { num: 14, indent: 1, label: 'I. Pasivos Circulantes', labelKey: '__pasivoCirculante', key: 'pasivoCirculante', isSubtotal: true },
  { num: 15, indent: 2, label: 'Cuenta por Pagar', labelKey: '__cuentaPorPagar', key: 'cuentaPorPagar' },
  { num: 16, indent: 2, label: 'Anticipos', labelKey: '__anticipos', key: 'anticipos' },
  { num: 16.05, indent: 2, label: 'Otros Pasivos Corrientes', labelKey: '__otrosPasivosCorrientes', key: 'otrosPasivosCorrientes' },
  { num: 16.1, indent: 2, label: 'Deuda CP (vencimiento ≤ 12 meses)', labelKey: '__deudaCP', key: 'deudaCortoPlazo' },

  { num: 17, indent: 1, label: 'II. Pasivo a Largo Plazo (Financiamiento)', labelKey: '__pasivoLP', key: 'pasivoLargoPlazoFinanciamiento', isSubtotal: true },

  // ── CAPITAL CONTABLE O APORTACIONES ──
  { num: 18, indent: 0, label: 'CAPITAL CONTABLE O APORTACIONES', labelKey: '__capitalContable', key: 'capitalContable', isTotal: true },
  { num: 19, indent: 1, label: 'Capital Social Pagado', labelKey: '__capitalSocialPagado', key: 'capitalSocialPagado' },
  { num: 19.5, indent: 2, label: '(CS Calculado: Inversión − Préstamos)', labelKey: '__capitalSocialCalculado', key: 'capitalSocialCalculado', isInfo: true },
  { num: 20, indent: 1, label: 'Capital Autorizado', labelKey: '__capitalAutorizado', key: 'capitalAutorizado' },
  { num: 21, indent: 1, label: 'Capital por Pagar', labelKey: '__capitalPorPagar', key: 'capitalPorPagar' },
  { num: 22, indent: 1, label: 'Reservas', labelKey: '__reservas', key: 'reservas' },
  { num: 23, indent: 1, label: 'Utilidades Retenidas', labelKey: '__utilidadesRetenidas', key: 'utilidadesRetenidas' },
  { num: 23.5, indent: 1, label: 'Saldo no Distribuido', labelKey: '__saldoNoDistribuido', key: 'saldoNoDistribuido' },
  { num: 24, indent: 1, label: 'Dividendos', labelKey: '__dividendos', key: 'dividendos', isDeduction: true },
  { num: 24.5, indent: 1, label: 'Resultado del Ejercicio', labelKey: '__resultadoDelEjercicio', key: 'resultadoDelEjercicio' },

  // ── TOTAL PASIVO + CAPITAL ──
  { num: 25, indent: 0, label: 'TOTAL PASIVO + CAPITAL', labelKey: '__totalPasivoCapital', key: 'totalPasivoCapital', isTotal: true },

  // ── VERIFICACIÓN ──
  { num: 25.5, indent: 0, label: 'Ecuación Contable: A − (P + C) = 0', labelKey: '__ecuacionContable', key: 'ecuacionContable', isVerification: true },

  // ── RAZONES FINANCIERAS (Resolución 1/2022) ──
  { num: 30, indent: 0, label: 'RAZONES FINANCIERAS (Resolución 1/2022)', labelKey: '__ratiosSection', key: '__section', isSection: true },

  // --- LIQUIDEZ ---
  { num: 31, indent: 0, label: 'I. Liquidez', labelKey: '__liqSection', key: '__section', isSection: true },
  { num: 31.1, indent: 1, label: 'Razón Circulante (AC / PC)', labelKey: '__razonCirculante', key: 'razonCirculante', isRatio: true },
  { num: 31.2, indent: 1, label: 'Prueba Ácida ((AC − Inv.) / PC)', labelKey: '__razonRapida', key: 'razonRapida', isRatio: true },

  // --- SOLVENCIA / ENDEUDAMIENTO ---
  { num: 32, indent: 0, label: 'II. Solvencia / Endeudamiento', labelKey: '__solvSection', key: '__section', isSection: true },
  { num: 32.1, indent: 1, label: 'Razón de Endeudamiento (Deuda / Activos)', labelKey: '__razonEndeudamiento', key: 'razonEndeudamiento', isRatio: true, isPct: true },
  { num: 32.2, indent: 1, label: 'CS Pagado / Pasivo Total (%)', labelKey: '__razonCapitalSocialPasivo', key: 'razonCapitalSocialPasivo', isRatio: true, isPct: true },
  { num: 32.3, indent: 1, label: 'Deuda LP / Capital Contable (%)', labelKey: '__razonDeudaLPCapitalContable', key: 'razonDeudaLPCapitalContable', isRatio: true, isPct: true },
  { num: 32.4, indent: 1, label: 'Apalancamiento (Pasivos / Capital Contable %)', labelKey: '__razonApalancamiento', key: 'razonApalancamiento', isRatio: true, isPct: true },
  { num: 32.5, indent: 1, label: 'Cobertura de Intereses (EBIT / GF)', labelKey: '__coberturaIntereses', key: 'coberturaIntereses', isRatio: true },

  // --- RENTABILIDAD ---
  { num: 33, indent: 0, label: 'III. Rentabilidad', labelKey: '__rentSection', key: '__section', isSection: true },
  { num: 33.1, indent: 1, label: 'Capacidad Gen. Utilidades (Util. Imp. / Activos)', labelKey: '__capacidadGenerarUtilidades', key: 'capacidadGenerarUtilidades', isRatio: true },
  { num: 33.2, indent: 1, label: 'ROA — Rentabilidad sobre Activos (%)', labelKey: '__rentabilidadActivosROA', key: 'rentabilidadActivosROA', isRatio: true, isPct: true },
  { num: 33.3, indent: 1, label: 'ROE — Rentabilidad sobre Capital (%)', labelKey: '__rentabilidadCapitalROE', key: 'rentabilidadCapitalROE', isRatio: true, isPct: true },
  { num: 33.4, indent: 1, label: 'Margen Bruto (%)', labelKey: '__margenBruto', key: 'margenBruto', isRatio: true, isPct: true },
  { num: 33.5, indent: 1, label: 'Margen Neto (%)', labelKey: '__margenNeto', key: 'margenNeto', isRatio: true, isPct: true },

  // --- ACTIVIDAD / EFICIENCIA ---
  { num: 34, indent: 0, label: 'IV. Actividad / Eficiencia', labelKey: '__activSection', key: '__section', isSection: true },
  { num: 34.1, indent: 1, label: 'Capital de Trabajo Neto (AC − PC)', labelKey: '__capitalTrabajoNeto', key: 'capitalTrabajoNeto' },
  { num: 34.2, indent: 1, label: 'Rotación de Activos (Ventas / Activos)', labelKey: '__rotacionActivos', key: 'rotacionActivos', isRatio: true },
  { num: 34.3, indent: 1, label: 'Rotación de Inventarios (Costo Op. / Inv.)', labelKey: '__rotacionInventarios', key: 'rotacionInventarios', isRatio: true },
];

// ── Main View ───────────────────────────────────────────────────────────────────

export function BalanceSheetView() {
  const store = useBaraproStore();
  const data = useMemo(() => {
    try { return buildBalanceSheet(store); }
    catch { return []; }
  }, [store]);

  const latest = data.length > 0 ? data[data.length - 1] : null;

  // Transposed table renderer (Resolución 1/2022: concepts = rows, years = columns)
  const renderBalanceTable = () => {
    const numPeriods = data.length;

    return (
      <ScrollableTable maxHeight="700px" stickyColumns={1} firstColWidth={360}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold min-w-[360px] fin-col-header text-fin-xs">
                {'Concepto'}
              </TableHead>
              {data.map((row) => (
                <TableHead key={row.year} className="text-right min-w-[110px] fin-col-header-year text-fin-xs">
                  {`Año ${row.year}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {balanceConcepts.map((c) => {
              if (c.isSection) {
                return (
                  <TableRow key={c.num} className="fin-section-header">
                    <TableCell colSpan={numPeriods + 1} className="text-fin-xs font-bold text-muted-foreground uppercase tracking-wider py-2 px-4">
                      {c.label}
                    </TableCell>
                  </TableRow>
                );
              }

              const values = data.map((row) => {
                const val = row[c.key as keyof BalanceSheetRow];
                return typeof val === 'number' ? val : 0;
              });

              const rowBg = c.isTotal ? 'fin-table-total'
                : c.isSubtotal ? 'fin-table-subtotal'
                : c.isNetLine ? 'fin-row-result'
                : c.isVerification ? 'fin-section-breakeven'
                : '';

              const conceptCls = c.isTotal ? 'font-bold text-success'
                : c.isSubtotal ? 'font-semibold text-success'
                : c.isDeduction ? 'text-danger'
                : c.isInfo ? 'italic text-muted-foreground text-fin-xs'
                : c.isRatio ? 'italic text-muted-foreground font-mono'
                : c.isNetLine ? 'font-semibold text-info'
                : c.isVerification ? 'font-semibold'
                : '';

              const dedPrefix = c.isDeduction ? '(−) ' : c.indent === 2 ? '    ' : c.indent === 1 ? '  ' : '';

              return (
                <TableRow key={c.num} className={cn(rowBg, 'fin-row-hover')}>
                  <TableCell className={cn('text-fin-sm', conceptCls)}>
                    {dedPrefix}{c.label}
                  </TableCell>
                  {values.map((val, vi) => (
                    <TableCell key={vi} className={cn(
                      'text-fin-sm text-right tabular-nums',
                      c.isDeduction && 'text-danger',
                      c.isRatio && 'italic font-mono',
                      c.isInfo && 'text-muted-foreground text-fin-xs',
                      c.isTotal && 'font-bold text-success',
                      c.isSubtotal && 'font-semibold text-success',
                      c.isNetLine && 'font-semibold text-info',
                      c.isVerification && Math.abs(val) < 0.01 ? 'text-success font-semibold' : c.isVerification ? 'text-danger font-semibold' : '',
                    )}>
                      {c.isVerification
                        ? (Math.abs(val) < 0.01 ? '✓' : formatCurrency(val))
                        : c.isPct ? formatPct(val)
                        : c.isRatio ? formatRatio(val)
                        : formatCurrency(val)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollableTable>
    );
  };

  // Ecuación contable verification
  const eqOk = latest ? Math.abs(latest.ecuacionContable) < 0.01 : false;

  // ── Export data: Balance Sheet ──
  const balanceExportData = useMemo(() => {
    const headers = ['Concepto', ...data.map((row) => `Año ${row.year}`)];
    const rows: TableExportRow[] = balanceConcepts.map((c) => {
      if (c.isSection) {
        return { cells: [c.label, ...data.map(() => '')], isSectionHeader: true };
      }
      const values = data.map((row) => {
        const val = row[c.key as keyof BalanceSheetRow];
        return typeof val === 'number' ? val : 0;
      });
      const dedPrefix = c.isDeduction ? '(−) ' : c.indent === 2 ? '    ' : c.indent === 1 ? '  ' : '';
      return {
        cells: [`${dedPrefix}${c.label}`, ...values.map((val) =>
          c.isVerification
            ? (Math.abs(val) < 0.01 ? '✓' : formatCurrency(val))
            : c.isPct ? formatPct(val)
            : c.isRatio ? formatRatio(val)
            : formatCurrency(val)
        )],
        bold: !!(c.isTotal || c.isSubtotal || c.isNetLine),
        highlight: !!(c.isTotal || c.isVerification),
      };
    });
    return { headers, rows };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="space-y-4 animate-slide-up">
        <Card className="border-0 glass-card shadow-card-sm rounded-xl border-l-4 border-l-success">
          <CardHeader className="pb-3">
            <CardTitle className="text-fin-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-success" />
              {'Balance General'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-0 glass-card shadow-card-sm rounded-xl">
          <CardContent className="py-12 text-center text-muted-foreground text-fin-sm">
            {'No hay datos suficientes para generar el Estado de Situación'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <ModuleHeader
        title="Balance General"
        description="Estado de Situación — Proyección anual del balance general"
        icon={Scale}
        variant="success"
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-success-muted text-success hover:bg-success-muted">
              Resolución 1/2022
            </Badge>
            {eqOk ? (
              <Badge className="bg-success-muted text-success hover:bg-success-muted">
                <CheckCircle className="h-3 w-3 mr-1" /> Balanceado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" /> Desbalanceado
              </Badge>
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building className="h-4 w-4 text-success" />
            <p className="text-fin-xs text-muted-foreground">{'Total Activos'}</p>
          </div>
          <p className="text-fin-xl font-bold text-success">{formatCurrency(latest?.totalActivos || 0)}</p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning p-4">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="h-4 w-4 text-warning" />
            <p className="text-fin-xs text-muted-foreground">{'Total Pasivos'}</p>
          </div>
          <p className="text-fin-xl font-bold text-warning">{formatCurrency(latest?.totalPasivos || 0)}</p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-info" />
            <p className="text-fin-xs text-muted-foreground">{'Capital Contable'}</p>
          </div>
          <p className="text-fin-xl font-bold text-info">{formatCurrency(latest?.capitalContable || 0)}</p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-panel-b p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-panel-b" />
            <p className="text-fin-xs text-muted-foreground">{'Razón Circulante'}</p>
          </div>
          <p className={cn('text-fin-xl font-bold', (latest?.razonCirculante || 0) >= 1 ? 'text-panel-b' : 'text-danger')}>
            {formatRatio(latest?.razonCirculante || 0)}
          </p>
        </div>
      </div>

      {/* Current Asset Breakdown Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Efectivo Caja', value: latest?.efectivoEnCaja || 0, bgClass: 'glass-card shadow-card-sm bg-success-muted/30' },
          { label: 'Efectivo Banco', value: latest?.efectivoEnBanco || 0, bgClass: 'glass-card shadow-card-sm bg-info-muted/30' },
          { label: 'Ctas. por Cobrar', value: latest?.cuentasPorCobrar || 0, bgClass: 'glass-card shadow-card-sm bg-warning-muted/30' },
          { label: 'Inventarios', value: latest?.inventarios || 0, bgClass: 'glass-card shadow-card-sm bg-warning-muted/30' },
          { label: 'AFT Neto', value: latest?.activosFijosTangiblesNeto || 0, bgClass: 'glass-card shadow-card-sm bg-info-muted/30' },
        ].map((item) => (
          <div key={item.label} className={`${item.bgClass} rounded-xl p-3`}>
            <p className="text-fin-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
            <p className="text-fin-sm font-bold text-muted-foreground">{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Balance Sheet Table */}
      <div className="glass-card shadow-card-sm rounded-xl">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-fin-base font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              {'Estado de Situación'}
            </h3>
            <TableExportButton
              moduleName="Balance General"
              tableName="Estado de Situación"
              headers={balanceExportData.headers}
              rows={balanceExportData.rows}
              landscape={balanceExportData.headers.length > 6}
            />
          </div>
        </div>
        {renderBalanceTable()}
      </div>
    </div>
  );
}
