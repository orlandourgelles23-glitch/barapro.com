'use client';

import { Fragment, useMemo, useState } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { groupMonthsByYear, YearMonthHeader, getMonthlyValuesWithSubtotals } from '@/components/barapro/year-month-header';
import {
  buildEnhancedERF,
  buildEstadoResultados,
  buildEstadoCostosProduccion,
  buildERFComercial,
  type EstadoFinancieroRow,
  type EnhancedERFRow,
} from '@/lib/barapro-financial';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  CheckCircle,
  Percent,
  PiggyBank,
  Wallet,
  Calculator,
  ClipboardList,
  Layers,
  Store,
  Factory,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { ModuleHeader } from '@/components/barapro/shared/module-header';
import { TableExportButton, type TableExportRow } from '@/components/barapro/table-export-button';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ═══════════════════════════════════════════════════════════════
// Estilos para ERF expandido (40 líneas — Resolución 1/2022)
// ═══════════════════════════════════════════════════════════════
// SECTION_TOTAL_LINES: líneas con estilo 'total' (negrita slate) — solo las que NO son cubiertas por checks de mayor prioridad
// L5→revenue, L18/26/28/32→result, L30→distribution, L36/39→result, L41→breakeven son cubiertos primero
const SECTION_TOTAL_LINES = [8, 10, 11, 16, 17];
const RESULT_LINES = [18, 20, 26, 28, 32, 36, 39, 41];
// L31 (Impuesto s/Utilidades) añadido — estaba ausente, rompía la banda morada de distribución
const DISTRIBUTION_LINES = [27, 28, 29, 30, 31, 33, 34, 35, 37, 38, 39];
const CONTINGENCY_LINE = 27;
const REVENUE_LINES = [1, 3, 5];
const ISV_LINE = 2;
const PERCENT_LINE = 40;
const BREAK_EVEN_LINES = [41, 42];
const BREAK_EVEN_INFO_LINES = [41.1, 44];
const BREAK_EVEN_PCT_LINE = 43;
const INFO_LINES = [21, 22.3];

function getLineType(linea: number): 'total' | 'result' | 'distribution' | 'contingency' | 'revenue' | 'isv' | 'percent' | 'breakeven' | 'breakeven_info' | 'breakeven_pct' | 'info' | 'normal' {
  if (linea === CONTINGENCY_LINE) return 'contingency';
  if (BREAK_EVEN_LINES.includes(linea)) return 'breakeven';
  if (BREAK_EVEN_INFO_LINES.includes(linea)) return 'breakeven_info';
  if (linea === BREAK_EVEN_PCT_LINE) return 'breakeven_pct';
  if (RESULT_LINES.includes(linea)) return 'result';
  if (DISTRIBUTION_LINES.includes(linea)) return 'distribution';
  if (REVENUE_LINES.includes(linea)) return 'revenue';
  if (ISV_LINE === linea) return 'isv';
  if (PERCENT_LINE === linea) return 'percent';
  if (INFO_LINES.includes(linea)) return 'info';
  if (SECTION_TOTAL_LINES.includes(linea)) return 'total';
  return 'normal';
}

function getRowBgClassERF(linea: number): string {
  const type = getLineType(linea);
  switch (type) {
    case 'revenue': return 'fin-row-revenue';
    case 'isv': return 'fin-row-cost';
    case 'result': return 'fin-row-result';
    case 'distribution': return 'fin-row-distribution';
    case 'contingency': return '';
    case 'breakeven': return 'fin-row-result';
    case 'breakeven_info': return '';
    case 'breakeven_pct': return '';
    case 'total': return '';
    case 'info': return '';
    default: return '';
  }
}

function getConceptColorClassERF(linea: number): string {
  const type = getLineType(linea);
  switch (type) {
    case 'revenue': return 'text-success font-semibold';
    case 'isv': return 'text-danger font-medium';
    case 'result': return 'text-info font-bold';
    case 'distribution': return 'text-panel-b';
    case 'contingency': return 'text-warning font-semibold';
    case 'breakeven': return 'text-info font-bold';
    case 'breakeven_info': return 'text-info font-medium italic';
    case 'breakeven_pct': return 'text-info font-medium';
    case 'total': return 'font-bold text-muted-foreground';
    case 'percent': return 'text-info font-medium';
    case 'info': return 'text-warning font-medium italic';
    default: return '';
  }
}

// ═══════════════════════════════════════════════════════════════
// Estilos para estados financieros separados (EstadoFinancieroRow)
// ═══════════════════════════════════════════════════════════════
function getRowBgClassTipo(tipo: EstadoFinancieroRow['tipo'], seccion: string): string {
  if (seccion === 'Punto de Equilibrio') {
    switch (tipo) {
      case 'resultado': return 'fin-row-result';
      case 'porciento': return '';
      case 'info': return '';
      default: return '';
    }
  }
  switch (tipo) {
    case 'total': return '';
    case 'subtotal': return '';
    case 'resultado': return 'fin-row-result';
    case 'porciento': return '';
    case 'info': return '';
    default: return '';
  }
}

function getConceptColorClassTipo(tipo: EstadoFinancieroRow['tipo'], seccion?: string): string {
  if (seccion === 'Punto de Equilibrio') {
    switch (tipo) {
      case 'resultado': return 'text-info font-bold';
      case 'porciento': return 'text-info font-medium';
      case 'info': return 'text-info font-medium italic';
      default: return 'text-info';
    }
  }
  switch (tipo) {
    case 'total': return 'font-bold text-muted-foreground';
    case 'subtotal': return 'font-semibold text-muted-foreground';
    case 'resultado': return 'text-info font-bold';
    case 'porciento': return 'text-info font-medium';
    case 'info': return 'text-muted-foreground italic';
    default: return '';
  }
}

// ═══════════════════════════════════════════════════════════════
// Sección header helper
// ═══════════════════════════════════════════════════════════════
function SectionHeaderRow({ seccion, colSpan }: { seccion: string; colSpan: number }) {
  return (
    <TableRow className="fin-section-header border-l-4 border-l-info">
      <TableCell colSpan={colSpan} className="text-fin-xs font-bold text-info uppercase tracking-wider py-2 px-4">
        {seccion}
      </TableCell>
    </TableRow>
  );
}

// ═══════════════════════════════════════════════════════════════
// Celda de concepto con tooltip descriptivo
// ═══════════════════════════════════════════════════════════════
function ConceptoCell({ concepto, descripcion, colorClass }: { concepto: string; descripcion?: string; colorClass: string }) {
  if (!descripcion) {
    return <span className={colorClass}>{concepto}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(colorClass, 'inline-flex items-center gap-1 cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}>
          {concepto}
          <Info className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="max-w-xs bg-info-muted text-info-muted">
        <p className="text-fin-xs leading-relaxed">{descripcion}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ═══════════════════════════════════════════════════════════════
// Export helper functions
// ═══════════════════════════════════════════════════════════════

type ExportMonthGroups = ReturnType<typeof groupMonthsByYear>;

function buildExportHeaders(isAnnual: boolean, yearCols: number, mGroups: ExportMonthGroups): string[] {
  if (isAnnual) {
    return ['#', 'Concepto', ...Array.from({ length: yearCols }, (_, i) => `Año ${i + 1}`), 'Total'];
  }
  const headers = ['#', 'Concepto'];
  for (const g of mGroups) {
    for (const m of g.months) headers.push(`${m.label} ${g.year}`);
    headers.push(`Subt. ${g.year}`);
  }
  headers.push('Total');
  return headers;
}

function buildEstadoExportRows(
  data: EstadoFinancieroRow[],
  headers: string[],
  isAnnual: boolean,
  mGroups: ExportMonthGroups,
): TableExportRow[] {
  const rows: TableExportRow[] = [];
  let lastSeccion = '';
  for (const row of data) {
    if (row.seccion !== lastSeccion) {
      lastSeccion = row.seccion;
      rows.push({ cells: ['', row.seccion, ...Array(headers.length - 2).fill('')], isSectionHeader: true, bold: true });
    }
    const isPct = row.tipo === 'porciento';
    const fmt = (v: number) => isPct ? formatPct(v) : formatNum(v);
    const values = isAnnual
      ? row.annual.map(fmt)
      : getMonthlyValuesWithSubtotals(row.monthly, mGroups).map(c => fmt(c.value));
    rows.push({
      cells: [row.linea.toString(), row.concepto, ...values, fmt(row.total)],
      bold: row.tipo === 'total' || row.tipo === 'resultado',
      highlight: row.tipo === 'resultado',
    });
  }
  return rows;
}

function buildErfExportRows(
  data: EnhancedERFRow[],
  isAnnual: boolean,
  mGroups: ExportMonthGroups,
): TableExportRow[] {
  return data.map(row => {
    const lineType = getLineType(row.linea);
    const isPct = lineType === 'percent' || lineType === 'breakeven_pct';
    const fmt = (v: number) => isPct ? formatPct(v) : formatNum(v);
    const values = isAnnual
      ? row.annual.map(fmt)
      : getMonthlyValuesWithSubtotals(row.monthly, mGroups).map(c => fmt(c.value));
    return {
      cells: [row.linea.toString(), row.concepto, ...values, fmt(row.total)],
      bold: lineType === 'total' || lineType === 'result',
      highlight: lineType === 'result',
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════
export function EnhancedERFView() {
  const store = useBaraproStore();
  const duration = store.project.monthsDuration || 120;
  const showMonthly = duration <= 60;
  const activityType = store.project.activityType || 'produccion';
  const isComercial = activityType === 'comercial';

  // Computar los estados según tipo de actividad
  const estadoResultados = useMemo(
    () => isComercial ? [] : buildEstadoResultados(store),
    [store, isComercial]
  );
  const estadoCostos = useMemo(
    () => isComercial ? [] : buildEstadoCostosProduccion(store),
    [store, isComercial]
  );
  const erfComercial = useMemo(
    () => isComercial ? buildERFComercial(store) : [],
    [store, isComercial]
  );
  const erfData = useMemo(() => buildEnhancedERF(store), [store]);

  // Datos activos según tipo de actividad
  // Producción: 59 filas (idx→linea map) + 5 PE = 64 total
  // Comercial: 68 filas (idx→linea map) + 5 PE = 73 total
  const activeEstado = isComercial ? erfComercial : estadoResultados;

  // Summary cards — adaptar índices según tipo
  // ═══════════════════════════════════════════════════════════════════
  // Producción ERF (59 filas): L1=idx0, L2=3, L3=4, L4=5, L5=6, L6=7, L7=8,
  //   L19=idx27 Util. en Op, L21=idx31 EBIT, L23=idx33 Gastos Totales,
  //   L28=idx41 Util. antes Imp, L30=idx43 Util. Ajustada,
  //   L34=idx47 Utilidad Neta, L42=idx58 Margen Neto,
  //   L38=idx51 Util. Disponibles, L41=idx54 Util. a Distribuir
  // Comercial ERF (68 filas): L1=idx0, L2=3, L3=4, ..., L28=idx35 Costos/Gastos Op,
  //   L29=idx36 Util. en Op, L31=idx40 EBIT, L33=idx42 Gastos Totales Actividad,
  //   L38=idx50 Util. antes Imp, L40=idx52 Util. Ajustada, L44=idx56 Utilidad Neta,
  //   L48=idx60 Util. Disponibles, L51=idx63 Util. a Distribuir, L52=idx67 Margen Neto
  const ventasBrutas = activeEstado[0]?.total || 0;
  const impuestoVentas = activeEstado[3]?.total || 0;
  const ventasNetas = activeEstado[4]?.total || 0;
  const otrosIngresos = activeEstado[5]?.total || 0;
  const subvenciones = activeEstado[6]?.total || 0;
  const devoluciones = activeEstado[7]?.total || 0;
  const ingresosTotales = activeEstado[8]?.total || 0;
  const utilidadNeta = isComercial
    ? (erfComercial[56]?.total || 0)      // L44 Utilidad Neta
    : (estadoResultados[47]?.total || 0); // L34 Utilidad Neta
  const margenNeto = isComercial
    ? (erfComercial[67]?.total || 0)      // L52 Margen Neto
    : (estadoResultados[58]?.total || 0); // L42 Margen Neto
  const utilidadesEnOperaciones = isComercial
    ? (erfComercial[36]?.total || 0)      // L29 Utilidades en Op
    : (estadoResultados[27]?.total || 0); // L19 Utilidades en Op
  const utilidadesDistribuir = isComercial
    ? (erfComercial[63]?.total || 0)      // L51 Util. a Distribuir
    : (estadoResultados[54]?.total || 0); // L41 Util. a Distribuir
  const costoTotal = isComercial
    ? (erfComercial[35]?.total || 0)      // L28 Costos y Gastos de Op
    : (estadoResultados[26]?.total || 0); // L18 Costos y Gastos de Op
  const utilOperativa = isComercial
    ? (erfComercial[52]?.total || 0)      // L40 Utilidad Ajustada
    : (estadoResultados[43]?.total || 0); // L30 Utilidad Ajustada

  const yearColumns = activeEstado[0]?.annual.length || 0;
  const monthGroups = useMemo(() =>
    groupMonthsByYear(duration, store.project.startDate),
    [duration, store.project.startDate]
  );

  // Tab principal: "estado" (resultados/costos) | "erf" (expandido)
  const [mainTab, setMainTab] = useState<string>('estado');
  // Sub-tab dentro del ERF expandido: anual | mensual
  const [erfView, setErfView] = useState<string>('annual');
  // Sub-tab dentro de estado: resultados | costos
  const [estadoView, setEstadoView] = useState<string>('resultados');

  // Total column count for section headers
  const totalCols = yearColumns + 3; // # + Concepto + Año N... + Total
  // Monthly view: # + Concepto + months + subtotal cols (one per year) + Total
  const monthlyTotalCols = duration + monthGroups.length + 3;

  // ═══════════════════════════════════════════════════════════════
  // Helper: interleave monthly values with year subtotal cells
  // Devuelve [{value, isSubtotal}, ...] — una columna subtotal al final de cada año
  // ═══════════════════════════════════════════════════════════════
  function getMonthlyCellsWithSubtotals(monthly: number[]) {
    const cells: { value: number; isSubtotal: boolean }[] = [];
    for (const group of monthGroups) {
      let yearSum = 0;
      for (const m of group.months) {
        cells.push({ value: monthly[m.monthIndex], isSubtotal: false });
        yearSum += monthly[m.monthIndex];
      }
      cells.push({ value: yearSum, isSubtotal: true });
    }
    return cells;
  }

  // ═══════════════════════════════════════════════════════════════
  // Renderer: Tabla de Estado Financiero (EstadoResultados / EstadoCostos)
  // En vista mensual: columnas de subtotal anual al finalizar cada año
  // ═══════════════════════════════════════════════════════════════

  const renderEstadoTable = (data: EstadoFinancieroRow[], isAnnual: boolean) => {
    let lastSeccion = '';
    return (
      <ScrollableTable maxHeight="550px" stickyColumns={2} firstColWidth={40}>
        <Table>
          <TableHeader>
            {isAnnual ? (
              <TableRow>
                <TableHead className="fin-col-header font-bold min-w-[40px] text-center">#</TableHead>
                <TableHead className="fin-col-header font-bold min-w-[280px]">{"Concepto"}</TableHead>
                {Array.from({ length: yearColumns }, (_, i) => (
                  <TableHead key={i} className="fin-col-header-year text-right min-w-[100px]">
                    {`Año ${i + 1}`}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header-total text-right min-w-[120px] font-bold bg-info-muted">{"Total"}</TableHead>
              </TableRow>
            ) : (
              <YearMonthHeader groups={monthGroups} stickyColumns={2} totalColumnMinWidth="120px" monthColumnMinWidth="85px" showYearSubtotals />
            )}
          </TableHeader>
          <TableBody>
            {!isAnnual ? (
              // Vista mensual con subtotales por columna al final de cada año
              <>
                {data.map((row) => {
                  const showSectionHeader = row.seccion !== lastSeccion;
                  lastSeccion = row.seccion;
                  const isPercent = row.tipo === 'porciento';
                  const isResult = row.tipo === 'resultado';
                  const cells = getMonthlyCellsWithSubtotals(row.monthly);

                  return (
                    <Fragment key={`sec-${row.seccion}-${row.linea}`}>
                      {showSectionHeader && (
                        <SectionHeaderRow seccion={row.seccion} colSpan={monthlyTotalCols} />
                      )}
                      <TableRow className={cn(getRowBgClassTipo(row.tipo, row.seccion), "fin-row-hover")}>
                        <TableCell className={cn(
                          'text-fin-xs text-center',
                          row.tipo === 'total' || row.tipo === 'resultado' ? 'font-bold' : ''
                        )}>
                          {row.linea}
                        </TableCell>
                        <TableCell className="text-fin-sm">
                          <ConceptoCell
                            concepto={row.concepto}
                            descripcion={row.descripcion}
                            colorClass={getConceptColorClassTipo(row.tipo, row.seccion)}
                          />
                        </TableCell>
                        {cells.map((cell, vi) => (
                          <TableCell
                            key={vi}
                            className={cn(
                              'text-fin-sm text-right tabular-nums',
                              cell.isSubtotal && 'fin-subtotal-col text-info',
                              isPercent && !cell.isSubtotal ? 'text-info font-medium' :
                              isResult && !cell.isSubtotal ? 'font-bold' :
                              row.tipo === 'total' && !cell.isSubtotal ? 'font-semibold' : '',
                              !isPercent && cell.value < 0 && !cell.isSubtotal ? 'text-danger' : '',
                              isPercent && cell.isSubtotal ? 'text-info font-semibold' : '',
                              !isPercent && cell.value < 0 && cell.isSubtotal ? 'text-danger font-semibold' : ''
                            )}
                          >
                            {isPercent ? formatPct(cell.value) : formatNum(cell.value)}
                          </TableCell>
                        ))}
                        <TableCell className={cn(
                          'text-fin-sm text-right font-bold tabular-nums fin-total-col',
                          isPercent ? 'text-info' :
                          isResult ? 'text-info' :
                          row.total < 0 ? 'text-danger' : ''
                        )}>
                          {isPercent ? formatPct(row.total) : formatNum(row.total)}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </>
            ) : (
              // Vista anual: normal
              data.map((row) => {
                const showSectionHeader = row.seccion !== lastSeccion;
                lastSeccion = row.seccion;
                const isPercent = row.tipo === 'porciento';
                const isResult = row.tipo === 'resultado';
                const values = row.annual;

                return (
                  <Fragment key={`sec-${row.seccion}-${row.linea}`}>
                    {showSectionHeader && (
                      <SectionHeaderRow seccion={row.seccion} colSpan={totalCols} />
                    )}
                    <TableRow className={cn(getRowBgClassTipo(row.tipo, row.seccion), "fin-row-hover")}>
                      <TableCell className={cn(
                        'text-fin-xs text-center',
                        row.tipo === 'total' || row.tipo === 'resultado' ? 'font-bold' : ''
                      )}>
                        {row.linea}
                      </TableCell>
                      <TableCell className="text-fin-sm">
                        <ConceptoCell
                          concepto={row.concepto}
                          descripcion={row.descripcion}
                          colorClass={getConceptColorClassTipo(row.tipo, row.seccion)}
                        />
                      </TableCell>
                      {values.map((val, vi) => (
                        <TableCell
                          key={vi}
                          className={cn(
                            'text-fin-sm text-right tabular-nums',
                            isPercent ? 'text-info font-medium' :
                            isResult ? 'font-bold' :
                            row.tipo === 'total' ? 'font-semibold' : '',
                            !isPercent && val < 0 ? 'text-danger' : ''
                          )}
                        >
                          {isPercent ? formatPct(val) : formatNum(val)}
                        </TableCell>
                      ))}
                      <TableCell className={cn(
                        'text-fin-sm text-right font-bold tabular-nums fin-total-col',
                        isPercent ? 'text-info' :
                        isResult ? 'text-info' :
                        row.total < 0 ? 'text-danger' : ''
                      )}>
                        {isPercent ? formatPct(row.total) : formatNum(row.total)}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollableTable>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // Renderer: Tabla ERF Expandido (formato actualizado Resolución 1/2022)
  // En vista mensual: columnas de subtotal anual al final de cada año
  // ═══════════════════════════════════════════════════════════════

  const renderErfTable = (isAnnual: boolean) => {
    return (
      <ScrollableTable maxHeight="600px" stickyColumns={2} firstColWidth={40}>
        <Table>
          <TableHeader>
            {isAnnual ? (
              <TableRow>
                <TableHead className="fin-col-header font-bold min-w-[40px] text-center">#</TableHead>
                <TableHead className="fin-col-header font-bold min-w-[280px]">{"Concepto"}</TableHead>
                {Array.from({ length: yearColumns }, (_, i) => (
                  <TableHead key={i} className="fin-col-header-year text-right min-w-[100px]">
                    {`Año ${i + 1}`}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header-total text-right min-w-[120px] font-bold bg-info-muted">{"Total"}</TableHead>
              </TableRow>
            ) : (
              <YearMonthHeader groups={monthGroups} stickyColumns={2} totalColumnMinWidth="120px" monthColumnMinWidth="85px" showYearSubtotals />
            )}
          </TableHeader>
          <TableBody>
            {erfData.map((row) => {
              const lineType = getLineType(row.linea);
              const isPercent = lineType === 'percent' || lineType === 'breakeven_pct';
              const isRevenue = lineType === 'revenue';
              const isResult = lineType === 'result';
              const values = isAnnual ? row.annual : getMonthlyCellsWithSubtotals(row.monthly);

              return (
                <TableRow key={row.linea} className={cn(getRowBgClassERF(row.linea), "fin-row-hover")}>
                  <TableCell className={cn(
                    'text-fin-xs text-center',
                    lineType === 'total' || lineType === 'result' ? 'font-bold' : ''
                  )}>
                    {row.linea}
                  </TableCell>
                  <TableCell className="text-fin-sm">
                    <ConceptoCell
                      concepto={row.concepto}
                      descripcion={row.descripcion}
                      colorClass={getConceptColorClassERF(row.linea)}
                    />
                  </TableCell>
                  {isAnnual ? (
                    values.map((val, vi) => (
                      <TableCell
                        key={vi}
                        className={cn(
                          'text-fin-sm text-right tabular-nums',
                          isPercent ? 'text-info font-medium' :
                          isResult ? 'font-bold' :
                          lineType === 'total' ? 'font-semibold' : '',
                          !isPercent && val < 0 ? 'text-danger' : '',
                          !isPercent && val > 0 && isRevenue ? 'text-success' : ''
                        )}
                      >
                        {isPercent ? formatPct(val) : formatNum(val)}
                      </TableCell>
                    ))
                  ) : (
                    values.map((cell, vi) => (
                      <TableCell
                        key={vi}
                        className={cn(
                          'text-fin-sm text-right tabular-nums',
                          cell.isSubtotal && 'fin-subtotal-col text-info',
                          isPercent && !cell.isSubtotal ? 'text-info font-medium' :
                          isResult && !cell.isSubtotal ? 'font-bold' :
                          lineType === 'total' && !cell.isSubtotal ? 'font-semibold' : '',
                          !isPercent && cell.value < 0 && !cell.isSubtotal ? 'text-danger' : '',
                          !isPercent && cell.value > 0 && isRevenue && !cell.isSubtotal ? 'text-success' : '',
                          isPercent && cell.isSubtotal ? 'text-info font-semibold' : '',
                          !isPercent && cell.value < 0 && cell.isSubtotal ? 'text-danger font-semibold' : ''
                        )}
                      >
                        {isPercent ? formatPct(cell.value) : formatNum(cell.value)}
                      </TableCell>
                    ))
                  )}
                  <TableCell className={cn(
                    'text-fin-sm text-right font-bold tabular-nums fin-total-col',
                    isPercent ? 'text-info' :
                    isResult ? 'text-info' :
                    row.total < 0 ? 'text-danger' : ''
                  )}>
                    {isPercent ? formatPct(row.total) : formatNum(row.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollableTable>
    );
  };

  // ─── Export data for tables ───
  const isAnnualView = erfView === 'annual' || !showMonthly;

  const erComercialExportData = useMemo(() => {
    if (!isComercial || erfComercial.length === 0) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = buildExportHeaders(isAnnualView, yearColumns, monthGroups);
    const rows = buildEstadoExportRows(erfComercial, headers, isAnnualView, monthGroups);
    return { headers, rows };
  }, [erfComercial, isComercial, isAnnualView, yearColumns, monthGroups]);

  const erResultadosExportData = useMemo(() => {
    if (isComercial || estadoResultados.length === 0) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = buildExportHeaders(isAnnualView, yearColumns, monthGroups);
    const rows = buildEstadoExportRows(estadoResultados, headers, isAnnualView, monthGroups);
    return { headers, rows };
  }, [estadoResultados, isComercial, isAnnualView, yearColumns, monthGroups]);

  const erCostosExportData = useMemo(() => {
    if (isComercial || estadoCostos.length === 0) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = buildExportHeaders(isAnnualView, yearColumns, monthGroups);
    const rows = buildEstadoExportRows(estadoCostos, headers, isAnnualView, monthGroups);
    return { headers, rows };
  }, [estadoCostos, isComercial, isAnnualView, yearColumns, monthGroups]);

  const erfExpandidoExportData = useMemo(() => {
    if (erfData.length === 0) return { headers: [] as string[], rows: [] as TableExportRow[] };
    const headers = buildExportHeaders(isAnnualView, yearColumns, monthGroups);
    const rows = buildErfExportRows(erfData, isAnnualView, monthGroups);
    return { headers, rows };
  }, [erfData, isAnnualView, yearColumns, monthGroups]);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header con Toggle de Actividad */}
      <ModuleHeader
        title="Estados Financieros"
        description={isComercial
          ? 'ERF Actividad Comercial — Compra-Venta de Mercancías (Resolución 1/2022)'
          : 'Estado de Resultados y Estado de Costos de Producción y Ventas (Resolución 1/2022)'}
        icon={FileText}
        variant="info"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Tabs value={activityType} onValueChange={(v) => store.updateProject({ activityType: v as 'produccion' | 'comercial' })}>
              <TabsList className="h-8">
                <TabsTrigger value="produccion" className="gap-1 text-fin-xs px-3 focus-ring">
                  <Factory className="h-3 w-3" />
                  {'Producción/Servicios'}
                </TabsTrigger>
                <TabsTrigger value="comercial" className="gap-1 text-fin-xs px-3 focus-ring">
                  <Store className="h-3 w-3" />
                  {'Act. Comercial'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Badge className={cn(
              isComercial ? 'bg-warning-muted text-warning' : 'bg-success-muted text-success',
              'hover:bg-opacity-100 text-fin-xs'
            )}>
              {isComercial ? 'ERF Comercial (68 filas)' : '2 Estados (59+18 filas)'}
            </Badge>
            <Badge className="bg-info-muted text-info hover:bg-info-muted text-fin-xs">
              Resolución 1/2022
            </Badge>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-success p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-success" />
            <p className="text-fin-xs text-muted-foreground">{'Ventas Brutas'}</p>
          </div>
          <p className="text-fin-xl font-bold text-success">{formatNum(ventasBrutas)} <span className="text-fin-xs font-normal text-muted-foreground">CUP</span></p>
          <p className="text-fin-xs text-muted-foreground mt-0.5">
            {'ISV: '}{formatNum(impuestoVentas)}{' · Netas: '}{formatNum(ventasNetas)}{' · Otros: '}{formatNum(otrosIngresos)}{' · '}
            <span className="font-semibold text-success">{'Total: '}{formatNum(ingresosTotales)}</span>
          </p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-warning p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-warning" />
            <p className="text-fin-xs text-muted-foreground">{'Costo Total'}</p>
          </div>
          <p className="text-fin-xl font-bold text-warning">{formatNum(costoTotal)} <span className="text-fin-xs font-normal text-muted-foreground">CUP</span></p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-info p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-info" />
            <p className="text-fin-xs text-muted-foreground">{'Utilidad Neta'}</p>
          </div>
          <p className={cn('text-fin-xl font-bold', utilidadNeta >= 0 ? 'text-info' : 'text-danger')}>
            {formatNum(utilidadNeta)} <span className="text-fin-xs font-normal text-muted-foreground">CUP</span>
          </p>
        </div>
        <div className="glass-card shadow-card-sm rounded-xl border-l-4 border-l-panel-b p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-4 w-4 text-panel-b" />
            <p className="text-fin-xs text-muted-foreground">{'Margen Neto'}</p>
          </div>
          <p className={cn('text-fin-xl font-bold', margenNeto >= 0 ? 'text-panel-b' : 'text-danger')}>
            {formatPct(margenNeto)}
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card shadow-card-sm rounded-xl bg-gradient-to-r from-success-muted to-success-muted/50 border-0 p-3 flex items-center justify-between">
          <div>
            <p className="text-fin-xs text-success uppercase tracking-wide">{'Util. en Operaciones'}</p>
            <p className="text-fin-base font-bold text-success">{formatNum(utilidadesEnOperaciones)}</p>
          </div>
          <ArrowUpRight className={cn('h-5 w-5', utilidadesEnOperaciones >= 0 ? 'text-success' : 'text-danger')} />
        </div>
        <div className="glass-card shadow-card-sm rounded-xl bg-gradient-to-r from-info-muted to-info-muted/50 border-0 p-3 flex items-center justify-between">
          <div>
            <p className="text-fin-xs text-info uppercase tracking-wide">{'Util. Operativa Ajustada'}</p>
            <p className="text-fin-base font-bold text-info">{formatNum(utilOperativa)}</p>
          </div>
          <BarChart3 className={cn('h-5 w-5', utilOperativa >= 0 ? 'text-info' : 'text-danger')} />
        </div>
        <div className="glass-card shadow-card-sm rounded-xl bg-gradient-to-r from-panel-b-muted to-panel-b-muted/50 border-0 p-3 flex items-center justify-between">
          <div>
            <p className="text-fin-xs text-panel-b uppercase tracking-wide">{'A Distribuir'}</p>
            <p className="text-fin-base font-bold text-panel-b">{formatNum(utilidadesDistribuir)}</p>
          </div>
          <Wallet className={cn('h-5 w-5', utilidadesDistribuir >= 0 ? 'text-panel-b' : 'text-danger')} />
        </div>
      </div>

      {/* Main Tabs: Estados Financieros | ERF Expandido */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="estado" className="gap-1.5 focus-ring transition-all duration-200">
            <Layers className="h-3.5 w-3.5" />
            {isComercial ? 'ERF Comercial' : 'Estados Financieros'}
          </TabsTrigger>
          {!isComercial && (
            <TabsTrigger value="erf" className="gap-1.5 focus-ring transition-all duration-200">
              <BarChart3 className="h-3.5 w-3.5" />
              {'ERF Expandido (45 filas)'}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ═══ TAB: Estados Financieros (Producción o Comercial) ═══ */}
        <TabsContent value="estado">
          {isComercial ? (
            /* ── VISTA COMERCIAL: ERF completo en una tabla ── */
            <div className="glass-card shadow-card-sm rounded-xl">
              <div className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-warning" />
                    <CardTitle className="text-fin-base">{'ERF Actividad Comercial'}</CardTitle>
                    <Badge className="bg-warning-muted text-warning hover:bg-warning-muted text-fin-xs">
                      {'68 filas · Compras → Distribución con desgloses'}
                    </Badge>
                  </div>
                  <TableExportButton
                    moduleName="Estados Financieros"
                    tableName="ERF Comercial"
                    headers={erComercialExportData.headers}
                    rows={erComercialExportData.rows}
                    landscape={erComercialExportData.headers.length > 6}
                  />
                </div>
              </div>
              <div className="p-0">
                {renderEstadoTable(erfComercial, erfView === 'annual' || !showMonthly)}
              </div>
            </div>
          ) : (
            /* ── VISTA PRODUCCIÓN: 2 tabs (Resultados + Costos) ── */
            <Tabs value={estadoView} onValueChange={setEstadoView}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="resultados" className="gap-1.5 focus-ring transition-all duration-200">
                    <Calculator className="h-3.5 w-3.5" />
                    {'Estado de Resultados'}
                  </TabsTrigger>
                  <TabsTrigger value="costos" className="gap-1.5 focus-ring transition-all duration-200">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {'Estado de Costos de Producción'}
                  </TabsTrigger>
                </TabsList>
                <Tabs value={erfView} onValueChange={setErfView}>
                  <TabsList className="flex-wrap">
                    <TabsTrigger value="annual" className="gap-1 text-fin-xs focus-ring transition-all duration-200">
                      <FileText className="h-3 w-3" />
                      {'Anual'}
                    </TabsTrigger>
                    <TabsTrigger value="monthly" className="gap-1 text-fin-xs focus-ring transition-all duration-200">
                      <BarChart3 className="h-3 w-3" />
                      {showMonthly ? 'Mensual' : 'Anual (detallado)'}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <TabsContent value="resultados">
                <div className="glass-card shadow-card-sm rounded-xl">
                  <div className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <CardTitle className="text-fin-base">{'Estado de Resultados'}</CardTitle>
                        <Badge className="bg-success-muted text-success hover:bg-success-muted text-fin-xs">
                          {'59 líneas · Ingresos → Distribución con desgloses'}
                        </Badge>
                      </div>
                      <TableExportButton
                        moduleName="Estados Financieros"
                        tableName="Estado de Resultados"
                        headers={erResultadosExportData.headers}
                        rows={erResultadosExportData.rows}
                        landscape={erResultadosExportData.headers.length > 6}
                      />
                    </div>
                  </div>
                  <div className="p-0">
                    {renderEstadoTable(estadoResultados, erfView === 'annual' || !showMonthly)}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="costos">
                <div className="glass-card shadow-card-sm rounded-xl">
                  <div className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-warning" />
                        <CardTitle className="text-fin-base">{'Estado de Costos de Producción y Ventas'}</CardTitle>
                        <Badge className="bg-warning-muted text-warning hover:bg-warning-muted text-fin-xs">
                          {'18 filas · Variables + Fijos + Desglose FT'}
                        </Badge>
                      </div>
                      <TableExportButton
                        moduleName="Estados Financieros"
                        tableName="Estado de Costos de Producción"
                        headers={erCostosExportData.headers}
                        rows={erCostosExportData.rows}
                        landscape={erCostosExportData.headers.length > 6}
                      />
                    </div>
                  </div>
                  <div className="p-0">
                    {renderEstadoTable(estadoCostos, erfView === 'annual' || !showMonthly)}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ═══ TAB: ERF Expandido ═══ */}
        <TabsContent value="erf">
          <div className="flex items-center justify-end mb-2 flex-wrap gap-2">
            <Tabs value={erfView} onValueChange={setErfView}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="annual" className="gap-1 text-fin-xs focus-ring transition-all duration-200">
                  <FileText className="h-3 w-3" />
                  {'Anual'}
                </TabsTrigger>
                <TabsTrigger value="monthly" className="gap-1 text-fin-xs focus-ring transition-all duration-200">
                  <BarChart3 className="h-3 w-3" />
                  {showMonthly ? 'Mensual' : 'Anual (detallado)'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="glass-card shadow-card-sm rounded-xl">
            <div className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-info" />
                  <CardTitle className="text-fin-base">{'ERF Expandido (45 filas)'}</CardTitle>
                  <Badge className="bg-info-muted text-info hover:bg-info-muted text-fin-xs">
                    {'Vista combinada + Punto de Equilibrio · Resolución 1/2022'}
                  </Badge>
                </div>
                <TableExportButton
                  moduleName="Estados Financieros"
                  tableName="ERF Expandido"
                  headers={erfExpandidoExportData.headers}
                  rows={erfExpandidoExportData.rows}
                  landscape={erfExpandidoExportData.headers.length > 6}
                />
              </div>
            </div>
            <div className="p-0">
              {renderErfTable(erfView === 'annual' || !showMonthly)}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
