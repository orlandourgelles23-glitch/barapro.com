'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import {
  buildConstructionInterestSchedule,
  buildInvestmentSchedule,
} from '@/lib/barapro-financial';
import type { InvestmentScheduleRow } from '@/lib/barapro-financial';
import { getMonthLabel } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, Clock, AlertTriangle, Wallet, Landmark, Users } from 'lucide-react';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function InvestmentScheduleView() {
  const store = useBaraproStore();
  const interestSchedule = useMemo(() => buildConstructionInterestSchedule(store), [store]);
  const invSchedule = useMemo(() => buildInvestmentSchedule(store), [store]);

  // Filtrar meses con actividad (inversión > 0 o préstamo > 0 o interés > 0)
  const activeMonths = useMemo(() => {
    return interestSchedule.filter(
      (r) => r.disbursementCUP > 0 || r.capitalizedInterest > 0.01
    );
  }, [interestSchedule]);

  // Build a lookup map from invSchedule for prestamoCUP and capitalSocialCUP by month
  const invByMonth = useMemo(() => {
    const map = new Map<number, InvestmentScheduleRow>();
    for (const row of invSchedule.monthly) {
      map.set(row.month, row);
    }
    return map;
  }, [invSchedule.monthly]);

  // Resumen anual
  const yearlySummary = useMemo(() => {
    const map = new Map<number, {
      disbursement: number;
      interest: number;
      totalWithInterest: number;
      prestamo: number;
      capitalSocial: number;
    }>();
    for (const row of interestSchedule) {
      const existing = map.get(row.year) || {
        disbursement: 0, interest: 0, totalWithInterest: 0, prestamo: 0, capitalSocial: 0,
      };
      existing.disbursement += row.disbursementCUP;
      existing.interest += row.capitalizedInterest;
      existing.totalWithInterest = row.totalWithInterest;
      // Loan and social capital from invSchedule
      const invRow = invByMonth.get(row.month);
      if (invRow) {
        existing.prestamo += invRow.prestamoCUP;
        existing.capitalSocial += invRow.capitalSocialCUP;
      }
      map.set(row.year, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => ({ year, ...data }));
  }, [interestSchedule, invByMonth]);

  // Totals
  const totalDisbursement = interestSchedule.reduce((s, r) => s + r.disbursementCUP, 0);
  const totalInterest = interestSchedule.reduce((s, r) => s + r.capitalizedInterest, 0);
  const totalWithInterest = interestSchedule.length > 0
    ? interestSchedule[interestSchedule.length - 1].totalWithInterest : 0;
  const constructionRate = interestSchedule.length > 0 ? interestSchedule[0].constructionInterestRate : 0;
  const investmentMonths = interestSchedule.filter((r) => r.disbursementCUP > 0).length;

  // Loan & social capital totals from invSchedule
  const totalPrestamo = invSchedule.monthly.reduce((s, r) => s + r.prestamoCUP, 0);
  const totalCapitalSocial = invSchedule.monthly.reduce((s, r) => s + r.capitalSocialCUP, 0);

  // ── Export data: Detalle Mensual ──
  const monthlyDetailExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...activeMonths.map(r => getMonthLabel(r.month - 1, store.project.startDate)), 'Total'];
    const rows: TableExportRow[] = [
      { cells: ['1', 'Desembolso', ...activeMonths.map(r => r.disbursementCUP > 0 ? formatNum(r.disbursementCUP) : '—'), formatNum(totalDisbursement)] },
      { cells: ['2', 'Intereses Capitalizados', ...activeMonths.map(r => r.capitalizedInterest > 0.01 ? formatNum(r.capitalizedInterest) : '—'), formatNum(totalInterest)] },
      { cells: ['3', 'Total con Intereses', ...activeMonths.map(r => formatNum(r.totalWithInterest)), formatNum(totalWithInterest)], bold: true, highlight: true },
      { cells: ['4', '(−) Préstamos Recibidos', ...activeMonths.map(r => { const inv = invByMonth.get(r.month); const val = inv?.prestamoCUP || 0; return val > 0 ? formatNum(val) : '—'; }), formatNum(totalPrestamo)] },
      { cells: ['5', '(=) Capital Social o Propio', ...activeMonths.map(r => { const inv = invByMonth.get(r.month); const val = inv?.capitalSocialCUP || 0; return val > 0 ? formatNum(val) : '—'; }), formatNum(totalCapitalSocial)], bold: true, highlight: true },
    ];
    return { headers, rows };
  }, [activeMonths, totalDisbursement, totalInterest, totalWithInterest, totalPrestamo, totalCapitalSocial, invByMonth, store.project.startDate]);

  // ── Export data: Resumen Anual ──
  const annualSummaryExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...yearlySummary.map(y => `Año ${y.year}`), 'Total'];
    const rows: TableExportRow[] = [
      { cells: ['1', 'Desembolso', ...yearlySummary.map(y => formatNum(y.disbursement)), formatNum(yearlySummary.reduce((s, r) => s + r.disbursement, 0))] },
      { cells: ['2', 'Intereses Capitalizados', ...yearlySummary.map(y => formatNum(y.interest)), formatNum(yearlySummary.reduce((s, r) => s + r.interest, 0))] },
      { cells: ['3', 'Total con Intereses', ...yearlySummary.map(y => formatNum(y.totalWithInterest)), formatNum(yearlySummary.reduce((s, r) => s + r.totalWithInterest, 0))], bold: true, highlight: true },
      { cells: ['4', '(−) Préstamos Recibidos', ...yearlySummary.map(y => formatNum(y.prestamo)), formatNum(yearlySummary.reduce((s, r) => s + r.prestamo, 0))] },
      { cells: ['5', '(=) Capital Social o Propio', ...yearlySummary.map(y => formatNum(y.capitalSocial)), formatNum(yearlySummary.reduce((s, r) => s + r.capitalSocial, 0))], bold: true, highlight: true },
    ];
    return { headers, rows };
  }, [yearlySummary]);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Título */}
      <ModuleHeader
        title="Cronograma de Inversión con Intereses en Construcción"
        description="Desglose mensual de desembolsos, intereses capitalizados, préstamos y capital social"
        icon={Clock}
        variant="info"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-info-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Total Desembolsos'}</p>
              <p className="text-fin-xl font-bold text-info">{formatNum(totalDisbursement)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-warning-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Intereses Cap.'}</p>
              <p className="text-fin-xl font-bold text-warning">{formatNum(totalInterest)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-success-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Inversión + Int.'}</p>
              <p className="text-fin-xl font-bold text-success">{formatNum(totalWithInterest)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-danger-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Landmark className="h-4 w-4 text-danger" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Préstamos'}</p>
              <p className="text-fin-xl font-bold text-danger">{formatNum(totalPrestamo)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-info-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Capital Social'}</p>
              <p className="text-fin-xl font-bold text-info">{formatNum(totalCapitalSocial)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-md bg-panel-b-muted p-2 h-9 w-9 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-panel-b" />
            </div>
            <div className="min-w-0">
              <p className="text-fin-xs text-muted-foreground">{'Tasa Construcción'}</p>
              <p className="text-fin-xl font-bold text-panel-b">{formatPct(constructionRate)}</p>
              <p className="text-fin-xs text-muted-foreground">{investmentMonths} {'meses'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla mensual - Concepts as ROWS, Months as COLUMNS */}
      <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
            <CardTitle className="text-fin-sm font-semibold">{'Detalle Mensual'}</CardTitle>
            <TableExportButton
              moduleName="Cronograma de Inversión"
              tableName="Detalle Mensual"
              headers={monthlyDetailExport.headers}
              rows={monthlyDetailExport.rows}
              landscape
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable maxHeight="450px" stickyColumns={2} firstColWidth={40}>
            <Table>
              <TableHeader>
                <TableRow className="fin-row-hover">
                  <TableHead className="min-w-[40px] text-center fin-col-header">#</TableHead>
                  <TableHead className="min-w-[200px] fin-col-header">{'Concepto'}</TableHead>
                  {activeMonths.map((row) => (
                    <TableHead key={row.month} className="text-right fin-col-header-month min-w-[110px]">
                      {getMonthLabel(row.month - 1, store.project.startDate)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] fin-col-header-total font-semibold">{'Total'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Row 1: Desembolso */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">1</TableCell>
                  <TableCell className="text-fin-sm font-medium">{'Desembolso'}</TableCell>
                  {activeMonths.map((row) => (
                    <TableCell key={row.month} className="text-fin-sm text-right tabular-nums text-info">
                      {row.disbursementCUP > 0 ? formatNum(row.disbursementCUP) : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-info bg-info-muted">{formatNum(totalDisbursement)}</TableCell>
                </TableRow>
                {/* Row 2: Intereses Capitalizados */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">2</TableCell>
                  <TableCell className="text-fin-sm font-medium text-warning">{'Intereses Capitalizados'}</TableCell>
                  {activeMonths.map((row) => (
                    <TableCell key={row.month} className="text-fin-sm text-right tabular-nums text-warning">
                      {row.capitalizedInterest > 0.01 ? formatNum(row.capitalizedInterest) : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-info-muted">{formatNum(totalInterest)}</TableCell>
                </TableRow>
                {/* Row 3: Total con Intereses (bold) */}
                <TableRow className="fin-table-total border-t-2 border-muted">
                  <TableCell className="text-fin-sm text-center">3</TableCell>
                  <TableCell className="text-fin-sm font-bold text-success">{'Total con Intereses'}</TableCell>
                  {activeMonths.map((row) => (
                    <TableCell key={row.month} className="text-fin-sm text-right tabular-nums font-bold text-success">
                      {formatNum(row.totalWithInterest)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-info-muted">{formatNum(totalWithInterest)}</TableCell>
                </TableRow>
                {/* Row 4: Préstamos Recibidos */}
                <TableRow className="fin-row-hover border-t border-muted">
                  <TableCell className="text-fin-sm text-center">4</TableCell>
                  <TableCell className="text-fin-sm font-medium text-danger">(−) {'Préstamos Recibidos'}</TableCell>
                  {activeMonths.map((row) => {
                    const inv = invByMonth.get(row.month);
                    const val = inv?.prestamoCUP || 0;
                    return (
                      <TableCell key={row.month} className="text-fin-sm text-right tabular-nums text-danger">
                        {val > 0 ? formatNum(val) : '—'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger bg-info-muted">{formatNum(totalPrestamo)}</TableCell>
                </TableRow>
                {/* Row 5: Capital Social o Propio (bold) */}
                <TableRow className="fin-table-total border-t-2 border-muted">
                  <TableCell className="text-fin-sm text-center">5</TableCell>
                  <TableCell className="text-fin-sm font-bold text-info">(=) {'Capital Social o Propio'}</TableCell>
                  {activeMonths.map((row) => {
                    const inv = invByMonth.get(row.month);
                    const val = inv?.capitalSocialCUP || 0;
                    return (
                      <TableCell key={row.month} className="text-fin-sm text-right tabular-nums font-bold text-info">
                        {val > 0 ? formatNum(val) : '—'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info bg-info-muted">{formatNum(totalCapitalSocial)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Resumen Anual - Concepts as ROWS, Years as COLUMNS */}
      <Card className="glass-card shadow-card-sm rounded-xl border-0"><CardHeader className="pb-2"><div className="flex items-center justify-between">
            <CardTitle className="text-fin-sm font-semibold">{'Resumen Anual'}</CardTitle>
            <TableExportButton
              moduleName="Cronograma de Inversión"
              tableName="Resumen Anual"
              headers={annualSummaryExport.headers}
              rows={annualSummaryExport.rows}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable maxHeight="300px" stickyColumns={2} firstColWidth={40}>
            <Table>
              <TableHeader>
                <TableRow className="fin-row-hover">
                  <TableHead className="min-w-[40px] text-center fin-col-header">#</TableHead>
                  <TableHead className="min-w-[200px] fin-col-header">{'Concepto'}</TableHead>
                  {yearlySummary.map((row) => (
                    <TableHead key={row.year} className="text-right fin-col-header-year min-w-[110px]">
                      {`Año ${row.year}`}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] fin-col-header-total font-semibold">{'Total'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Row 1: Desembolso */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">1</TableCell>
                  <TableCell className="text-fin-sm font-medium">{'Desembolso'}</TableCell>
                  {yearlySummary.map((row) => (
                    <TableCell key={row.year} className="text-fin-sm text-right tabular-nums text-info">
                      {formatNum(row.disbursement)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-info bg-info-muted">
                    {formatNum(yearlySummary.reduce((s, r) => s + r.disbursement, 0))}
                  </TableCell>
                </TableRow>
                {/* Row 2: Intereses Capitalizados */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">2</TableCell>
                  <TableCell className="text-fin-sm font-medium text-warning">{'Intereses Capitalizados'}</TableCell>
                  {yearlySummary.map((row) => (
                    <TableCell key={row.year} className="text-fin-sm text-right tabular-nums text-warning">
                      {formatNum(row.interest)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-warning bg-info-muted">
                    {formatNum(yearlySummary.reduce((s, r) => s + r.interest, 0))}
                  </TableCell>
                </TableRow>
                {/* Row 3: Total con Intereses */}
                <TableRow className="fin-table-total border-t-2 border-muted">
                  <TableCell className="text-fin-sm text-center">3</TableCell>
                  <TableCell className="text-fin-sm font-bold text-success">{'Total con Intereses'}</TableCell>
                  {yearlySummary.map((row) => (
                    <TableCell key={row.year} className="text-fin-sm text-right tabular-nums font-bold text-success">
                      {formatNum(row.totalWithInterest)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-bold text-success bg-info-muted">
                    {formatNum(yearlySummary.reduce((s, r) => s + r.totalWithInterest, 0))}
                  </TableCell>
                </TableRow>
                {/* Row 4: Préstamos Recibidos */}
                <TableRow className="fin-row-hover border-t border-muted">
                  <TableCell className="text-fin-sm text-center">4</TableCell>
                  <TableCell className="text-fin-sm font-medium text-danger">(−) {'Préstamos Recibidos'}</TableCell>
                  {yearlySummary.map((row) => (
                    <TableCell key={row.year} className="text-fin-sm text-right tabular-nums text-danger">
                      {formatNum(row.prestamo)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold text-danger bg-info-muted">
                    {formatNum(yearlySummary.reduce((s, r) => s + r.prestamo, 0))}
                  </TableCell>
                </TableRow>
                {/* Row 5: Capital Social o Propio (bold) */}
                <TableRow className="fin-table-total border-t-2 border-muted">
                  <TableCell className="text-fin-sm text-center">5</TableCell>
                  <TableCell className="text-fin-sm font-bold text-info">(=) {'Capital Social o Propio'}</TableCell>
                  {yearlySummary.map((row) => (
                    <TableCell key={row.year} className="text-fin-sm text-right tabular-nums font-bold text-info">
                      {formatNum(row.capitalSocial)}
                    </TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-bold text-info bg-info-muted">
                    {formatNum(yearlySummary.reduce((s, r) => s + r.capitalSocial, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>
    </div>
  );
}
