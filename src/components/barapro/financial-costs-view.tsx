'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildFinancialCosts } from '@/lib/barapro-financial';
import { getMonthLabel } from '@/lib/format';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
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
import { Banknote, Landmark, CreditCard, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

interface LoanGroup {
  loanName: string;
  loanCurrency: string;
  exchangeRateUsed: number;
  totalInterest: number;           // intereses pagados en efectivo
  totalCapitalizedInterest: number; // intereses capitalizados (acumulados al capital)
  totalInterestAll: number;         // interés total = pagados + capitalizados
  totalBankFee: number;
  totalPrincipal: number;
  totalPayment: number;
  finalBalance: number;
}

export function FinancialCostsView() {
  const store = useBaraproStore();
  const financialData = useMemo(() => buildFinancialCosts(store), [store]);
  const hasLoans = financialData.length > 0;

  const totals = useMemo(() => ({
    interest: financialData.reduce((s, r) => s + r.interest, 0),
    capitalizedInterest: financialData.reduce((s, r) => s + r.capitalizedInterest, 0),
    totalInterest: financialData.reduce((s, r) => s + r.totalInterest, 0),
    bankFee: financialData.reduce((s, r) => s + r.bankFee, 0),
    principal: financialData.reduce((s, r) => s + r.principal, 0),
    totalPayment: financialData.reduce((s, r) => s + r.totalPayment, 0),
  }), [financialData]);

  const loanGroups = useMemo((): LoanGroup[] => {
    const groups: Record<string, { interest: number; capitalizedInterest: number; totalInterest: number; bankFee: number; principal: number; totalPayment: number; finalBalance: number; loanCurrency: string; exchangeRateUsed: number }> = {};
    for (const row of financialData) {
      if (!groups[row.loanName]) groups[row.loanName] = { interest: 0, capitalizedInterest: 0, totalInterest: 0, bankFee: 0, principal: 0, totalPayment: 0, finalBalance: 0, loanCurrency: row.loanCurrency, exchangeRateUsed: row.exchangeRateUsed };
      groups[row.loanName].interest += row.interest;
      groups[row.loanName].capitalizedInterest += row.capitalizedInterest;
      groups[row.loanName].totalInterest += row.totalInterest;
      groups[row.loanName].bankFee += row.bankFee;
      groups[row.loanName].principal += row.principal;
      groups[row.loanName].totalPayment += row.totalPayment;
      groups[row.loanName].finalBalance = row.remainingBalance;
    }
    return Object.entries(groups).map(([loanName, data]) => ({
      loanName,
      loanCurrency: data.loanCurrency,
      exchangeRateUsed: data.exchangeRateUsed,
      totalInterest: data.interest,
      totalCapitalizedInterest: data.capitalizedInterest,
      totalInterestAll: data.totalInterest,
      totalBankFee: data.bankFee,
      totalPrincipal: data.principal,
      totalPayment: data.totalPayment,
      finalBalance: data.finalBalance,
    }));
  }, [financialData]);

  const uniqueLoans = useMemo(() => Array.from(new Set(financialData.map((r) => r.loanName))), [financialData]);

  // Yearly financial summary aggregated from monthly data (Resolución format: concepts in rows, years in columns)
  const yearlyFinancialSummary = useMemo(() => {
    const years: Record<number, { interest: number; capitalizedInterest: number; totalInterest: number; bankFee: number; principal: number; totalPayment: number }> = {};
    for (const row of financialData) {
      const yearNum = Math.ceil(row.month / 12);
      if (!years[yearNum]) years[yearNum] = { interest: 0, capitalizedInterest: 0, totalInterest: 0, bankFee: 0, principal: 0, totalPayment: 0 };
      years[yearNum].interest += row.interest;
      years[yearNum].capitalizedInterest += row.capitalizedInterest;
      years[yearNum].totalInterest += row.totalInterest;
      years[yearNum].bankFee += row.bankFee;
      years[yearNum].principal += row.principal;
      years[yearNum].totalPayment += row.totalPayment;
    }
    const sorted = Object.entries(years).sort(([a], [b]) => Number(a) - Number(b));
    return sorted.map(([year, data]) => ({
      yearNum: Number(year),
      yearLabel: `Año ${year}`,
      ...data,
    }));
  }, [financialData]);

  // Column totals for the yearly summary
  const yearlyTotalInterest = yearlyFinancialSummary.reduce((s, y) => s + y.interest, 0);
  const yearlyTotalCapInterest = yearlyFinancialSummary.reduce((s, y) => s + y.capitalizedInterest, 0);
  const yearlyTotalInterestAll = yearlyFinancialSummary.reduce((s, y) => s + y.totalInterest, 0);
  const yearlyTotalBankFee = yearlyFinancialSummary.reduce((s, y) => s + y.bankFee, 0);
  const yearlyTotalPrincipal = yearlyFinancialSummary.reduce((s, y) => s + y.principal, 0);
  const yearlyTotalPayment = yearlyFinancialSummary.reduce((s, y) => s + y.totalPayment, 0);

  const hasCapitalized = totals.capitalizedInterest > 0;

  // Amortization schedule transposed data: (loan, metric) as rows, months as columns
  const amortDuration = store.project.monthsDuration || 120;

  const amortMonthGroups = useMemo(() =>
    groupMonthsByYear(amortDuration, store.project.startDate),
    [amortDuration, store.project.startDate]
  );

  const amortTransposedRows = useMemo(() => {
    if (financialData.length === 0) return { rows: [] as { key: string; num: number; label: string; valueClass: string; isBold: boolean; values: (number | null)[]; total: number }[] };

    // Build lookup: month -> loanName -> row data
    const lookup: Record<number, Record<string, (typeof financialData)[number]>> = {};
    for (const row of financialData) {
      if (!lookup[row.month]) lookup[row.month] = {};
      lookup[row.month][row.loanName] = row;
    }

    const metricDefs = [
      { key: 'interest' as const, label: 'Int. Pagados', valueClass: 'text-warning', isBold: false },
      ...(totals.capitalizedInterest > 0
        ? [{ key: 'capitalizedInterest' as const, label: 'Int. Capitalizados', valueClass: 'text-warning', isBold: false }]
        : []),
      { key: 'totalInterest' as const, label: 'Int. Total', valueClass: 'text-danger', isBold: false },
      { key: 'bankFee' as const, label: 'Com. Banc.', valueClass: 'text-panel-b', isBold: false },
      { key: 'totalPayment' as const, label: 'Pago Total', valueClass: '', isBold: true },
      { key: 'remainingBalance' as const, label: 'Saldo Restante', valueClass: '', isBold: false },
    ];

    const rows: { key: string; num: number; label: string; valueClass: string; isBold: boolean; values: (number | null)[]; total: number }[] = [];

    let num = 0;
    for (const loan of uniqueLoans) {
      for (const metric of metricDefs) {
        num++;
        const values = Array.from({ length: amortDuration }, (_, i) => {
          const rowData = lookup[i + 1]?.[loan];
          return rowData ? rowData[metric.key] : null;
        });
        const nonNullValues = values.filter((v): v is number => v !== null);
        const total = metric.key === 'remainingBalance'
          ? (nonNullValues.length > 0 ? nonNullValues[nonNullValues.length - 1] : 0)
          : nonNullValues.reduce((s, v) => s + v, 0);
        rows.push({
          key: `${loan}-${metric.key}`,
          num,
          label: `${loan} – ${metric.label}`,
          valueClass: metric.valueClass,
          isBold: metric.isBold,
          values,
          total,
        });
      }
    }

    return { rows };
  }, [financialData, uniqueLoans, amortDuration, totals.capitalizedInterest]);

  // ── Export data: Resumen por Préstamo ──
  const loanSummaryExport = useMemo(() => {
    const headers = hasCapitalized
      ? ['Préstamo', 'Int. Pagados', 'Int. Capital.', 'Int. Total', 'Com. Bancaria', 'Total Pagado', 'Saldo Final']
      : ['Préstamo', 'Int. Pagados', 'Int. Total', 'Com. Bancaria', 'Total Pagado', 'Saldo Final'];
    const rows: TableExportRow[] = [
      ...loanGroups.map(group => ({
        cells: hasCapitalized
          ? [group.loanName, formatNum(group.totalInterest), formatNum(group.totalCapitalizedInterest), formatNum(group.totalInterestAll), formatNum(group.totalBankFee), formatNum(group.totalPayment), formatNum(group.finalBalance)]
          : [group.loanName, formatNum(group.totalInterest), formatNum(group.totalInterestAll), formatNum(group.totalBankFee), formatNum(group.totalPayment), formatNum(group.finalBalance)],
      })),
      {
        cells: hasCapitalized
          ? ['Total', formatNum(totals.interest), formatNum(totals.capitalizedInterest), formatNum(totals.totalInterest), formatNum(totals.bankFee), formatNum(totals.totalPayment), formatNum(financialData[financialData.length - 1]?.remainingBalance || 0)]
          : ['Total', formatNum(totals.interest), formatNum(totals.totalInterest), formatNum(totals.bankFee), formatNum(totals.totalPayment), formatNum(financialData[financialData.length - 1]?.remainingBalance || 0)],
        bold: true,
        highlight: true,
      },
    ];
    return { headers, rows };
  }, [loanGroups, hasCapitalized, totals, financialData]);

  // ── Export data: Resumen Anual ──
  const yearlySummaryExport = useMemo(() => {
    const headers = ['#', 'Concepto', ...yearlyFinancialSummary.map(y => y.yearLabel), 'Total'];
    const rows: TableExportRow[] = [
      { cells: ['1', 'Int. Pagados (efectivo)', ...yearlyFinancialSummary.map(y => formatNum(y.interest)), formatNum(yearlyTotalInterest)] },
      ...(hasCapitalized ? [{ cells: ['2', 'Int. Capitalizados', ...yearlyFinancialSummary.map(y => formatNum(y.capitalizedInterest)), formatNum(yearlyTotalCapInterest)] as string[] }] : []),
      { cells: [`${hasCapitalized ? 3 : 2}`, 'Int. Total (1+2)', ...yearlyFinancialSummary.map(y => formatNum(y.totalInterest)), formatNum(yearlyTotalInterestAll)], bold: true },
      { cells: [`${hasCapitalized ? 4 : 3}`, 'Comisiones Bancarias', ...yearlyFinancialSummary.map(y => formatNum(y.bankFee)), formatNum(yearlyTotalBankFee)] },
      { cells: [`${hasCapitalized ? 5 : 4}`, 'Principal', ...yearlyFinancialSummary.map(y => formatNum(y.principal)), formatNum(yearlyTotalPrincipal)] },
      { cells: ['', 'Total Pagado (efectivo)', ...yearlyFinancialSummary.map(y => formatNum(y.totalPayment)), formatNum(yearlyTotalPayment)], bold: true, highlight: true },
    ];
    return { headers, rows };
  }, [yearlyFinancialSummary, hasCapitalized, yearlyTotalInterest, yearlyTotalCapInterest, yearlyTotalInterestAll, yearlyTotalBankFee, yearlyTotalPrincipal, yearlyTotalPayment]);

  // ── Export data: Cronograma de Amortización ──
  const amortScheduleExport = useMemo(() => {
    const monthHeaders = amortMonthGroups.flatMap(g => [...g.months.map(m => getMonthLabel(m.monthIndex, store.project.startDate)), `Subt. Año ${g.year}`]);
    const headers = ['#', 'Concepto', ...monthHeaders, 'Total'];
    const rows: TableExportRow[] = amortTransposedRows.rows.map(arow => {
      const monthlyValues = arow.values.map(v => v ?? 0);
      const isRemainingBalance = arow.key.endsWith('remainingBalance');
      const subtotalCells = getMonthlyValuesWithSubtotals(monthlyValues, amortMonthGroups, { useLastValue: isRemainingBalance });
      // Map subtotal cells to formatted strings, using '-' for null original values
      let mi = 0;
      const formattedCells = subtotalCells.map(cell => {
        if (cell.isSubtotal) {
          return formatNum(cell.value);
        }
        const originalVal = arow.values[mi];
        mi++;
        return originalVal !== null ? formatNum(originalVal) : '-';
      });
      return {
        cells: [String(arow.num), arow.label, ...formattedCells, formatNum(arow.total)],
        bold: arow.isBold,
      };
    });
    return { headers, rows };
  }, [amortTransposedRows, amortMonthGroups, store.project.startDate]);

  if (!hasLoans) {
    return (
      <div className="space-y-4 animate-slide-up">
        <Card className="glass-card shadow-card-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-fin-lg">{'Costos Financieros'}</CardTitle>
            <p className="text-fin-sm text-muted-foreground mt-1">{'Amortización de préstamos y gastos financieros'}</p>
          </CardHeader>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl py-12">
          <CardContent className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-10 w-10" />
            <p className="text-fin-sm font-medium">{'No hay préstamos registrados'}</p>
            <p className="text-fin-xs text-center max-w-sm">{'Agregue préstamos en el Módulo M (Financiamiento) para ver el cronograma de amortización y los costos financieros asociados.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <ModuleHeader
        title="Costos Financieros"
        description="Cronograma de amortización y costos financieros por préstamo"
        icon={Banknote}
        variant="warning"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="mt-0.5"><Banknote className="h-4 w-4 text-warning" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-fin-xs text-muted-foreground">{'Int. Pagados (efectivo)'}</p>
              <p className="text-fin-xl font-bold text-warning">{formatNum(totals.interest)} CUP</p>
            </div>
          </CardContent>
        </Card>
        {hasCapitalized && (
          <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="mt-0.5"><Landmark className="h-4 w-4 text-warning" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-fin-xs text-muted-foreground">{'Int. Capitalizados'}</p>
                <p className="text-fin-xl font-bold text-warning">{formatNum(totals.capitalizedInterest)} CUP</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-danger">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="mt-0.5"><Landmark className="h-4 w-4 text-danger" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-fin-xs text-muted-foreground">{'Interés Total'}</p>
              <p className="text-fin-xl font-bold text-danger">{formatNum(totals.totalInterest)} CUP</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="mt-0.5"><CreditCard className="h-4 w-4 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-fin-xs text-muted-foreground">{'Total Pagos (efectivo)'}</p>
              <p className="text-fin-xl font-bold text-success">{formatNum(totals.totalPayment)} CUP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Summary (non-time-series, professional formatting) */}
      <Card className="glass-card shadow-card-sm rounded-xl">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-fin-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              {'Resumen por Préstamo'}
            </CardTitle>
            <TableExportButton
              moduleName="Costos Financieros"
              tableName="Resumen por Préstamo"
              headers={loanSummaryExport.headers}
              rows={loanSummaryExport.rows}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="fin-col-header">{'Préstamo'}</TableHead>
                  <TableHead className="fin-col-header text-right">{'Int. Pagados'}</TableHead>
                  {hasCapitalized && <TableHead className="fin-col-header text-right">{'Int. Capital.'}</TableHead>}
                  <TableHead className="fin-col-header text-right">{'Int. Total'}</TableHead>
                  <TableHead className="fin-col-header text-right">{'Com. Bancaria'}</TableHead>
                  <TableHead className="fin-col-header text-right">{'Total Pagado'}</TableHead>
                  <TableHead className="fin-col-header text-right">{'Saldo Final'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loanGroups.map((group) => (
                  <TableRow key={group.loanName} className="fin-row-hover">
                    <TableCell className="text-fin-sm font-medium">
                      <Badge variant="secondary" className="text-fin-sm mr-2">{uniqueLoans.indexOf(group.loanName) + 1}</Badge>
                      {group.loanName}
                      {group.loanCurrency && group.loanCurrency !== 'CUP' && (
                        <span className="ml-2 text-fin-sm text-muted-foreground">
                          ({group.loanCurrency} ×{group.exchangeRateUsed})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-fin-sm text-right text-warning">{formatNum(group.totalInterest)}</TableCell>
                    {hasCapitalized && <TableCell className="text-fin-sm text-right text-warning">{formatNum(group.totalCapitalizedInterest)}</TableCell>}
                    <TableCell className="text-fin-sm text-right text-danger font-medium">{formatNum(group.totalInterestAll)}</TableCell>
                    <TableCell className="text-fin-sm text-right text-warning">{formatNum(group.totalBankFee)}</TableCell>
                    <TableCell className="text-fin-sm text-right font-medium">{formatNum(group.totalPayment)}</TableCell>
                    <TableCell className="text-fin-sm text-right font-medium">{formatNum(group.finalBalance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="fin-table-total font-semibold">
                  <TableCell className="text-fin-sm">{'Total'}</TableCell>
                  <TableCell className="text-fin-sm text-right tabular-nums text-warning">{formatNum(totals.interest)}</TableCell>
                  {hasCapitalized && <TableCell className="text-fin-sm text-right tabular-nums text-warning">{formatNum(totals.capitalizedInterest)}</TableCell>}
                  <TableCell className="text-fin-sm text-right tabular-nums text-danger">{formatNum(totals.totalInterest)}</TableCell>
                  <TableCell className="text-fin-sm text-right tabular-nums text-warning">{formatNum(totals.bankFee)}</TableCell>
                  <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(totals.totalPayment)}</TableCell>
                  <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(financialData[financialData.length - 1]?.remainingBalance || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Yearly Summary — Resolución format: concepts in rows, years in columns */}
      <Card className="glass-card shadow-card-sm rounded-xl">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-fin-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              {'Resumen Anual'}
            </CardTitle>
            <TableExportButton
              moduleName="Costos Financieros"
              tableName="Resumen Anual"
              headers={yearlySummaryExport.headers}
              rows={yearlySummaryExport.rows}
              landscape
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable stickyColumns={2} firstColWidth={40}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="fin-col-header text-center w-10">#</TableHead>
                  <TableHead className="fin-col-header min-w-[180px]">{'Concepto'}</TableHead>
                  {yearlyFinancialSummary.map((y) => (
                    <TableHead key={y.yearNum} className="fin-col-header-year text-right min-w-[100px]">{y.yearLabel}</TableHead>
                  ))}
                  <TableHead className="fin-col-header-total text-right min-w-[110px] bg-info-muted">{'Total'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 1. Intereses Pagados */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">1</TableCell>
                  <TableCell className="text-fin-sm">{'Int. Pagados (efectivo)'}</TableCell>
                  {yearlyFinancialSummary.map((y) => (
                    <TableCell key={y.yearNum} className="text-sm text-right">{formatNum(y.interest)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right bg-info-muted font-medium">{formatNum(yearlyTotalInterest)}</TableCell>
                </TableRow>
                {/* 2. Intereses Capitalizados (solo si existen) */}
                {hasCapitalized && (
                  <TableRow className="fin-row-hover">
                    <TableCell className="text-fin-sm text-center">2</TableCell>
                    <TableCell className="text-fin-sm">{'Int. Capitalizados'}</TableCell>
                    {yearlyFinancialSummary.map((y) => (
                      <TableCell key={y.yearNum} className="text-sm text-right">{formatNum(y.capitalizedInterest)}</TableCell>
                    ))}
                    <TableCell className="text-fin-sm text-right bg-info-muted font-medium">{formatNum(yearlyTotalCapInterest)}</TableCell>
                  </TableRow>
                )}
                {/* 3. Interés Total (pagados + capitalizados) */}
                <TableRow className="fin-row-hover font-semibold bg-danger-muted/40">
                  <TableCell className="text-fin-sm text-center">{hasCapitalized ? 3 : 2}</TableCell>
                  <TableCell className="text-fin-sm font-semibold text-danger">{'Int. Total (1+2)'}</TableCell>
                  {yearlyFinancialSummary.map((y) => (
                    <TableCell key={y.yearNum} className="text-sm text-right font-semibold text-danger">{formatNum(y.totalInterest)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right bg-info-muted font-bold text-danger">{formatNum(yearlyTotalInterestAll)}</TableCell>
                </TableRow>
                {/* 4. Comisiones Bancarias */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">{hasCapitalized ? 4 : 3}</TableCell>
                  <TableCell className="text-fin-sm">{'Comisiones Bancarias'}</TableCell>
                  {yearlyFinancialSummary.map((y) => (
                    <TableCell key={y.yearNum} className="text-sm text-right">{formatNum(y.bankFee)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right bg-info-muted font-medium">{formatNum(yearlyTotalBankFee)}</TableCell>
                </TableRow>
                {/* 5. Capital (Principal) */}
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm text-center">{hasCapitalized ? 5 : 4}</TableCell>
                  <TableCell className="text-fin-sm">{'Principal'}</TableCell>
                  {yearlyFinancialSummary.map((y) => (
                    <TableCell key={y.yearNum} className="text-sm text-right">{formatNum(y.principal)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right bg-info-muted font-medium">{formatNum(yearlyTotalPrincipal)}</TableCell>
                </TableRow>
                {/* 6. Total Pagado (efectivo) (bold separator) */}
                <TableRow className="font-bold fin-table-total">
                  <TableCell className="text-fin-sm text-center"></TableCell>
                  <TableCell className="text-fin-lg font-bold">{'Total Pagado (efectivo)'}</TableCell>
                  {yearlyFinancialSummary.map((y) => (
                    <TableCell key={y.yearNum} className="text-sm text-right font-bold">{formatNum(y.totalPayment)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right bg-info-muted font-bold">{formatNum(yearlyTotalPayment)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Amortization Schedule — transposed: (loan, metric) in rows, months in columns */}
      <Card className="glass-card shadow-card-sm rounded-xl">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-fin-sm font-semibold">{'Cronograma de Amortización'}</CardTitle>
            <TableExportButton
              moduleName="Costos Financieros"
              tableName="Cronograma de Amortización"
              headers={amortScheduleExport.headers}
              rows={amortScheduleExport.rows}
              landscape
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
            <Table>
              <TableHeader>
                <YearMonthHeader groups={amortMonthGroups} stickyColumns={2} showYearSubtotals />
              </TableHeader>
              <TableBody>
                {amortTransposedRows.rows.map((arow) => (
                  <TableRow key={arow.key} className={cn(arow.isBold ? 'fin-table-total font-bold' : '', 'fin-row-hover')}>
                    <TableCell className="text-fin-sm text-center">{arow.num}</TableCell>
                    <TableCell className="text-fin-sm">{arow.label}</TableCell>
                    {(() => {
                      const monthlyValues = arow.values.map(v => v ?? 0);
                      const isRemainingBalance = arow.key.endsWith('remainingBalance');
                      const cells = getMonthlyValuesWithSubtotals(monthlyValues, amortMonthGroups, {
                        useLastValue: isRemainingBalance,
                      });
                      let gi = 0;
                      let mi = 0;
                      return cells.map((cell, ci) => {
                        if (cell.isSubtotal) {
                          const year = amortMonthGroups[gi].year;
                          gi++;
                          return (
                            <TableCell key={`sub-${year}`} className={`text-fin-sm text-right tabular-nums font-semibold bg-info-muted/60 ${arow.valueClass}`}>
                              {formatNum(cell.value)}
                            </TableCell>
                          );
                        }
                        const originalVal = arow.values[mi];
                        mi++;
                        return (
                          <TableCell key={ci} className={`text-fin-sm text-right tabular-nums ${arow.valueClass}`}>
                            {originalVal !== null ? formatNum(originalVal) : '-'}
                          </TableCell>
                        );
                      });
                    })()}
                    <TableCell className={`text-fin-sm text-right tabular-nums bg-info-muted font-medium ${arow.valueClass}`}>
                      {formatNum(arow.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>
    </div>
  );
}
