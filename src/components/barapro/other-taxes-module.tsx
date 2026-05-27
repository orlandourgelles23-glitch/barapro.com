'use client';

import { useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildOtherTaxesTimeline } from '@/lib/barapro-financial';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { Landmark, HardHat, Users, Building2, Receipt } from 'lucide-react';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

export function OtherTaxesModule() {
  const store = useBaraproStore();
  const data = useMemo(() => buildOtherTaxesTimeline(store), [store]);

  // Yearly aggregation — separated into investment vs operations
  const yearlyData = useMemo(() => {
    const years: Record<number, {
      opsTerritorial: number;
      opsEmployerSS: number;
      opsEmployerITF: number;
      opsWorkerIIP: number;
      opsWorkerSS: number;
      invEmployerSS: number;
      invEmployerITF: number;
      invWorkerIIP: number;
      invWorkerSS: number;
      ventasBrutas: number;
    }> = {};
    for (const row of data) {
      const yearNum = Math.ceil(row.month / 12);
      if (!years[yearNum]) {
        years[yearNum] = {
          opsTerritorial: 0, opsEmployerSS: 0, opsEmployerITF: 0,
          opsWorkerIIP: 0, opsWorkerSS: 0,
          invEmployerSS: 0, invEmployerITF: 0, invWorkerIIP: 0, invWorkerSS: 0,
          ventasBrutas: 0,
        };
      }
      years[yearNum].opsTerritorial += row.operations.territorialContribution;
      years[yearNum].opsEmployerSS += row.operations.employerSS;
      years[yearNum].opsEmployerITF += row.operations.employerITF;
      years[yearNum].opsWorkerIIP += row.operations.workerIIP;
      years[yearNum].opsWorkerSS += row.operations.workerSS;
      years[yearNum].invEmployerSS += row.investment.employerSS;
      years[yearNum].invEmployerITF += row.investment.employerITF;
      years[yearNum].invWorkerIIP += row.investment.workerIIP;
      years[yearNum].invWorkerSS += row.investment.workerSS;
      years[yearNum].ventasBrutas += row.ventasBrutas;
    }
    return Object.entries(years)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, vals]) => ({ year: Number(year), ...vals }));
  }, [data]);

  // Totals — operations
  const opsTotals = useMemo(() => ({
    territorial: data.reduce((s, r) => s + r.operations.territorialContribution, 0),
    employerSS: data.reduce((s, r) => s + r.operations.employerSS, 0),
    employerITF: data.reduce((s, r) => s + r.operations.employerITF, 0),
    workerIIP: data.reduce((s, r) => s + r.operations.workerIIP, 0),
    workerSS: data.reduce((s, r) => s + r.operations.workerSS, 0),
  }), [data]);

  // Totals — investment
  const invTotals = useMemo(() => ({
    employerSS: data.reduce((s, r) => s + r.investment.employerSS, 0),
    employerITF: data.reduce((s, r) => s + r.investment.employerITF, 0),
    workerIIP: data.reduce((s, r) => s + r.investment.workerIIP, 0),
    workerSS: data.reduce((s, r) => s + r.investment.workerSS, 0),
  }), [data]);

  // Grand totals
  const totalVentasBrutas = data.reduce((s, r) => s + r.ventasBrutas, 0);
  const opsEmployerTotal = opsTotals.territorial + opsTotals.employerSS + opsTotals.employerITF;
  const opsWorkerTotal = opsTotals.workerIIP + opsTotals.workerSS;
  const invEmployerTotal = invTotals.employerSS + invTotals.employerITF;
  const invWorkerTotal = invTotals.workerIIP + invTotals.workerSS;

  const hasData = data.some(r =>
    r.operations.territorialContribution > 0 || r.operations.employerSS > 0 ||
    r.operations.employerITF > 0 || r.investment.employerSS > 0 ||
    r.investment.employerITF > 0
  );

  const hasInvestment = invEmployerTotal > 0 || invWorkerTotal > 0;

  if (!hasData) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
          <div className="p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-fin-lg font-semibold">{'Otros Impuestos, Tasas y Contribuciones'}</h2>
                <p className="text-fin-xs text-muted-foreground mt-0.5">{'Desglose de impuestos, tasas y contribuciones adicionales'}</p>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4">
            <p className="text-fin-sm text-muted-foreground text-center py-8">
              No hay datos suficientes para calcular los impuestos, tasas y contribuciones.
              Ingrese salarios y ventas para ver los resultados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ═══════ Resumen general ═══════ */}
      <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-fin-lg font-semibold">{'Otros Impuestos, Tasas y Contribuciones'}</h2>
              <p className="text-fin-xs text-muted-foreground mt-0.5">{'Desglose de impuestos, tasas y contribuciones adicionales'}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <div className="text-fin-xs text-muted-foreground">{'Contribución al Desarrollo Local'}</div>
              <div className="text-fin-sm font-semibold">{formatNum(opsTotals.territorial)}</div>
              <div className="text-fin-xs text-muted-foreground">{'Basado en Ventas Brutas'}</div>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <div className="text-fin-xs text-muted-foreground">{'CSS Patronal'}</div>
              <div className="text-fin-sm font-semibold">{formatNum(opsTotals.employerSS + invTotals.employerSS)}</div>
              <div className="text-fin-xs text-muted-foreground">{'Basado en Salarios Totales'}</div>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <div className="text-fin-xs text-muted-foreground">{'Impuesto sobre la Fuerza de Trabajo'}</div>
              <div className="text-fin-sm font-semibold">{formatNum(opsTotals.employerITF + invTotals.employerITF)}</div>
              <div className="text-fin-xs text-muted-foreground">{'Basado en Salarios Totales'}</div>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <div className="text-fin-xs text-muted-foreground">{'IIP'}</div>
              <div className="text-fin-sm font-semibold">{formatNum(opsTotals.workerIIP + invTotals.workerIIP)}</div>
              <div className="text-fin-xs text-muted-foreground">Retención trabajadores</div>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <div className="text-fin-xs text-muted-foreground">{'CSS Trabajadores'}</div>
              <div className="text-fin-sm font-semibold">{formatNum(opsTotals.workerSS + invTotals.workerSS)}</div>
              <div className="text-fin-xs text-muted-foreground">Retención trabajadores</div>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5 border border-primary/20">
              <div className="text-fin-xs text-muted-foreground">Total Aportaciones Empresa</div>
              <div className="text-fin-base font-bold text-primary">{formatNum(opsEmployerTotal + invEmployerTotal)}</div>
              <div className="text-fin-xs text-muted-foreground">Retenciones: {formatNum(opsWorkerTotal + invWorkerTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ INVERSIÓN INICIAL ═══════ */}
      {hasInvestment && (
        <>
          {/* Aportaciones de la Empresa — Inversión Inicial */}
          <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-info/10">
                  <HardHat className="h-4 w-4 text-info" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-fin-base font-semibold">{'Aportaciones de la Empresa — Inversión Inicial (Anual)'}</h3>
                  <p className="text-fin-xs text-muted-foreground mt-0.5">
                    Contribuciones derivadas de los salarios de la inversión inicial (Módulo Recursos Humanos de la Inversión).
                    No incluye Contribución al Desarrollo Local por no existir ventas en esta etapa.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4">
              <ScrollableTable maxHeight="400px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow className="fin-col-header">
                      <TableHead className="min-w-0 fin-col-header">Concepto</TableHead>
                      {yearlyData.map(y => (
                        <TableHead key={y.year} className="text-center fin-col-header-year min-w-[100px]">Año {y.year}</TableHead>
                      ))}
                      <TableHead className="text-center font-bold fin-col-header-total min-w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="fin-row-hover">
                      <TableCell className="text-fin-sm font-medium">{'Contribución a la Seguridad Social'}</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invEmployerSS)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(invTotals.employerSS)}</TableCell>
                    </TableRow>
                    <TableRow className="fin-row-hover">
                      <TableCell className="text-fin-sm font-medium">{'Impuesto sobre la Fuerza de Trabajo'}</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invEmployerITF)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(invTotals.employerITF)}</TableCell>
                    </TableRow>
                    <TableRow className="fin-table-total">
                      <TableCell className="text-fin-sm">Total Aportaciones Inversión</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invEmployerSS + y.invEmployerITF)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(invEmployerTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTable>
            </div>
          </div>

          {/* Retenciones de Trabajadores — Inversión Inicial */}
          <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-warning/10">
                  <Users className="h-4 w-4 text-warning" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-fin-base font-semibold">{'Retenciones de los Trabajadores — Inversión Inicial (Anual)'}</h3>
                  <p className="text-fin-xs text-muted-foreground mt-0.5">
                    Retenciones aplicadas sobre los salarios de la inversión inicial.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4">
              <ScrollableTable maxHeight="400px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow className="fin-col-header">
                      <TableHead className="min-w-0 fin-col-header">Concepto</TableHead>
                      {yearlyData.map(y => (
                        <TableHead key={y.year} className="text-center fin-col-header-year min-w-[100px]">Año {y.year}</TableHead>
                      ))}
                      <TableHead className="text-center font-bold fin-col-header-total min-w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="fin-row-hover">
                      <TableCell className="text-fin-sm font-medium">{'Impuesto sobre Ingresos Personales (IIP)'}</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invWorkerIIP)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(invTotals.workerIIP)}</TableCell>
                    </TableRow>
                    <TableRow className="fin-row-hover">
                      <TableCell className="text-fin-sm font-medium">{'Contribución Especial Trabajadores SS'}</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invWorkerSS)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(invTotals.workerSS)}</TableCell>
                    </TableRow>
                    <TableRow className="fin-table-total">
                      <TableCell className="text-fin-sm">Total Retenciones Inversión</TableCell>
                      {yearlyData.map(y => (
                        <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.invWorkerIIP + y.invWorkerSS)}</TableCell>
                      ))}
                      <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(invWorkerTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTable>
            </div>
          </div>
        </>
      )}

      {/* ═══════ OPERACIONES ═══════ */}
      {/* Aportaciones de la Empresa — Operaciones */}
      <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-success/10">
                <Building2 className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0">
                <h3 className="text-fin-base font-semibold">{'Aportaciones de la Empresa — Operaciones (Anual)'}</h3>
                <p className="text-fin-xs text-muted-foreground mt-0.5">
                  Contribuciones derivadas de las operaciones (producción, administración, comerciales, mantenimiento e indirectos).
                  Estos son los valores que alimentan el Estado de Resultado Financiero.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-fin-xs">
                {'Ventas Brutas'}: {formatNum(totalVentasBrutas)} CUP
              </Badge>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <ScrollableTable maxHeight="400px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow className="fin-col-header">
                  <TableHead className="min-w-0 fin-col-header">Concepto</TableHead>
                  {yearlyData.map(y => (
                    <TableHead key={y.year} className="text-center fin-col-header-year min-w-[100px]">Año {y.year}</TableHead>
                  ))}
                  <TableHead className="text-center font-bold fin-col-header-total min-w-[100px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium">{'Contribución al Desarrollo Local'}</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsTerritorial)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(opsTotals.territorial)}</TableCell>
                </TableRow>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium">{'Contribución a la Seguridad Social'}</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsEmployerSS)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(opsTotals.employerSS)}</TableCell>
                </TableRow>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium">{'Impuesto sobre la Fuerza de Trabajo'}</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsEmployerITF)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(opsTotals.employerITF)}</TableCell>
                </TableRow>
                <TableRow className="fin-table-total">
                  <TableCell className="text-fin-sm">Total Aportaciones Operaciones</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsTerritorial + y.opsEmployerSS + y.opsEmployerITF)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(opsEmployerTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </div>
      </div>

      {/* Retenciones de Trabajadores — Operaciones */}
      <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-warning/10">
              <Users className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0">
              <h3 className="text-fin-base font-semibold">{'Retenciones de los Trabajadores — Operaciones (Anual)'}</h3>
              <p className="text-fin-xs text-muted-foreground mt-0.5">
                Contribuciones que se retienen de los salarios de los trabajadores durante la etapa de operaciones.
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <ScrollableTable maxHeight="400px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow className="fin-col-header">
                  <TableHead className="min-w-0 fin-col-header">Concepto</TableHead>
                  {yearlyData.map(y => (
                    <TableHead key={y.year} className="text-center fin-col-header-year min-w-[100px]">Año {y.year}</TableHead>
                  ))}
                  <TableHead className="text-center font-bold fin-col-header-total min-w-[100px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium">{'Impuesto sobre Ingresos Personales (IIP)'}</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsWorkerIIP)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(opsTotals.workerIIP)}</TableCell>
                </TableRow>
                <TableRow className="fin-row-hover">
                  <TableCell className="text-fin-sm font-medium">{'Contribución Especial Trabajadores SS'}</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsWorkerSS)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums font-semibold">{formatNum(opsTotals.workerSS)}</TableCell>
                </TableRow>
                <TableRow className="fin-table-total">
                  <TableCell className="text-fin-sm">Total Retenciones Operaciones</TableCell>
                  {yearlyData.map(y => (
                    <TableCell key={y.year} className="text-fin-sm text-right tabular-nums">{formatNum(y.opsWorkerIIP + y.opsWorkerSS)}</TableCell>
                  ))}
                  <TableCell className="text-fin-sm text-right tabular-nums">{formatNum(opsWorkerTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTable>
        </div>
      </div>

      {/* ═══════ Parámetros utilizados ═══════ */}
      <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50">
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-fin-base font-semibold">Parámetros Aplicados</h3>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'Desarrollo Local: '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.territorialTaxRate || 0)).toFixed(2)}%</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'CSS Especial: '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.specialSocialSecurityRate || 0)).toFixed(2)}%</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'ITF: '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.taxOnWorkforceRate || 0)).toFixed(2)}%</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'IIP (tasa): '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.personalIncomeTaxRate || 0)).toFixed(2)}%</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'IIP (exento): '}</span>
              <span className="text-fin-sm font-medium">{formatNum(store.parameters.personalIncomeTaxExemptMin || 0)} CUP</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'CSS Trabajadores: '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.workerSocialSecurityRate || 0)).toFixed(2)}%</span>
            </div>
            <div className="glass-card shadow-card-sm rounded-xl p-2.5">
              <span className="text-fin-xs text-muted-foreground">{'Norma Vacaciones: '}</span>
              <span className="text-fin-sm font-medium">{((store.parameters.vacationNormRate || 0)).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
