'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBaraproStore, type Loan, type LoanDisbursement, type InterestRateEntry, type ExchangeRateEntry, type AmortizationSystem, type PaymentFrequency, type LoanPurpose, type GraceInterestPayment, type LoanBankFees, type BankFeeTiming, FREQUENCY_LABELS, AMORTIZATION_LABELS, LOAN_PURPOSE_LABELS, GRACE_INTEREST_PAYMENT_LABELS, BANK_FEE_TIMING_LABELS } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Calculator, TrendingDown, BarChart3, Banknote, Landmark, CreditCard, CalendarDays, Target, ShieldCheck, Receipt, Percent, ArrowLeftRight, Database } from 'lucide-react';
import { toast } from 'sonner';
import { calcAmortizacion, buildFinancialCosts, getLoanDisbursements, resolveExchangeRateForPeriod } from '@/lib/barapro-financial';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { groupMonthsByYear, YearMonthHeader } from '@/components/barapro/year-month-header';

// ─── Types ───────────────────────────────────────────────────────

interface LoanForm {
  name: string;
  amountCUP: string;
  authorizedAmount: string;
  annualRate: string;
  termMonths: string;
  gracePeriodMonths: string;
  startMonth: string;
  currency: string;
  disbursementMode: 'lump' | 'monthly';
  capitalizableInterest: boolean;
  graceInterestPayment: GraceInterestPayment;
  amortizationSystem: AmortizationSystem;
  paymentFrequency: PaymentFrequency;
  capitalizationPeriod: PaymentFrequency;
  loanPurpose: LoanPurpose;
  numInstallments: string;
  // Gastos bancarios desglosados
  bankFeesEnabled: boolean;
  bankFeeTiming: BankFeeTiming;
  commissionRate: string;
  insuranceRate: string;
  otherRate: string;
  // Tasa variable
  variableRateEnabled: boolean;
  rateTableRows: InterestRateEntry[];
  // Tasa de cambio variable (Phase 6)
  customExchangeRates: boolean;
  exchangeRateTableRows: ExchangeRateEntry[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── Edit Dialog: componente separado para remontaje limpio ──────

function LoanEditDialogContent({
  editingId,
  onClose,
}: {
  editingId: string | null;
  onClose: () => void;
}) {
  const store = useBaraproStore();
  const loans = store.loans;
  const addLoan = store.addLoan;
  const updateLoan = store.updateLoan;
  const projectDuration = store.project.monthsDuration || 120;
  const startDate = store.project.startDate || '2025-01';

  // Buscar el préstamo a editar (o null para nuevo)
  const editingLoan = editingId ? loans.find((l) => l.id === editingId) ?? null : null;

  // ── Estado del formulario: se inicializa una sola vez al montar ──
  const [form, setForm] = useState<LoanForm>(() => {
    if (editingLoan) {
      const hasMulti = !!(editingLoan.disbursementSchedule && editingLoan.disbursementSchedule.length > 1);
      const hasBankFees = !!editingLoan.bankFees;
      return {
        name: editingLoan.name,
        amountCUP: String(editingLoan.amountCUP),
        authorizedAmount: String(editingLoan.authorizedAmount || editingLoan.amountCUP),
        annualRate: String((editingLoan.annualRate * 100).toFixed(4)),
        termMonths: String(editingLoan.termMonths),
        gracePeriodMonths: String(editingLoan.gracePeriodMonths),
        startMonth: String(editingLoan.startMonth),
        currency: editingLoan.currency,
        disbursementMode: hasMulti ? 'monthly' : 'lump',
        capitalizableInterest: !!editingLoan.capitalizableInterest,
        graceInterestPayment: editingLoan.graceInterestPayment || 'periodico',
        amortizationSystem: editingLoan.amortizationSystem || 'french',
        paymentFrequency: editingLoan.paymentFrequency || 'monthly',
        capitalizationPeriod: editingLoan.capitalizationPeriod || editingLoan.paymentFrequency || 'monthly',
        loanPurpose: editingLoan.loanPurpose || 'inversion',
        numInstallments: editingLoan.numInstallments ? String(editingLoan.numInstallments) : '',
        bankFeesEnabled: hasBankFees,
        bankFeeTiming: editingLoan.bankFeeTiming || 'at-disbursement',
        commissionRate: hasBankFees ? String((editingLoan.bankFees!.commissionRate || 0) * 100) : '',
        insuranceRate: hasBankFees ? String((editingLoan.bankFees!.insuranceRate || 0) * 100) : '',
        otherRate: hasBankFees ? String((editingLoan.bankFees!.otherRate || 0) * 100) : '',
        variableRateEnabled: !!(editingLoan.interestRateTable && editingLoan.interestRateTable.length > 0),
        rateTableRows: editingLoan.interestRateTable || [],
        customExchangeRates: !!(editingLoan.exchangeRateTable && editingLoan.exchangeRateTable.length > 0),
        exchangeRateTableRows: editingLoan.exchangeRateTable || [],
      };
    }
    return {
      name: '', amountCUP: '', authorizedAmount: '', annualRate: '', termMonths: '60',
      gracePeriodMonths: '0', startMonth: '1', currency: 'CUP', disbursementMode: 'lump',
      capitalizableInterest: false, graceInterestPayment: 'periodico',
      amortizationSystem: 'french', paymentFrequency: 'monthly', capitalizationPeriod: 'monthly', loanPurpose: 'inversion',
      numInstallments: '', bankFeesEnabled: false, bankFeeTiming: 'at-disbursement', commissionRate: '', insuranceRate: '', otherRate: '',
      variableRateEnabled: false, rateTableRows: [],
      customExchangeRates: false, exchangeRateTableRows: [],
    };
  });

  const [disbursementAmounts, setDisbursementAmounts] = useState<Record<number, string>>(() => {
    if (!editingLoan) return {};
    const amounts: Record<number, string> = {};
    if (editingLoan.disbursementSchedule && editingLoan.disbursementSchedule.length > 0) {
      for (const d of editingLoan.disbursementSchedule) {
        amounts[d.month] = String(d.amount);
      }
    } else {
      amounts[editingLoan.startMonth] = String(editingLoan.amountCUP);
    }
    return amounts;
  });

  // ── Meses para la tabla de desembolsos ──
  const formStartMonth = parseInt(form.startMonth) || 1;
  const formTermMonths = parseInt(form.termMonths) || 60;

  const disbursementMonths = useMemo(() => {
    const months: { abs: number; label: string; year: number }[] = [];
    const [startYear, startMo] = startDate.split('-').map(Number);
    for (let i = 0; i < formTermMonths; i++) {
      const abs = formStartMonth + i;
      const totalFromStart = (abs - 1) + (startMo - 1);
      const y = startYear + Math.floor(totalFromStart / 12);
      const m = totalFromStart % 12;
      months.push({ abs, label: `${MONTH_NAMES[m]} ${y}`, year: y });
    }
    return months;
  }, [formStartMonth, formTermMonths, startDate]);

  const formDisbursementTotal = useMemo(() => {
    let total = 0;
    for (const amtStr of Object.values(disbursementAmounts)) total += parseFloat(amtStr) || 0;
    return total;
  }, [disbursementAmounts]);

  // ── Opción A: Sincronizar montos cuando cambian startMonth / termMonths ──
  const prevStartMonthRef = useRef(formStartMonth);
  const prevTermMonthsRef = useRef(formTermMonths);

  useEffect(() => {
    const prevStart = prevStartMonthRef.current;
    const prevTerm = prevTermMonthsRef.current;
    prevStartMonthRef.current = formStartMonth;
    prevTermMonthsRef.current = formTermMonths;

    // No hacer nada si no hay montos o si no cambió nada
    const hasAnyAmount = Object.values(disbursementAmounts).some(v => parseFloat(v) > 0);
    if (!hasAnyAmount) return;
    if (prevStart === formStartMonth && prevTerm === formTermMonths) return;

    const newRangeStart = formStartMonth;
    const newRangeEnd = formStartMonth + formTermMonths - 1;
    const delta = formStartMonth - prevStart;

    setDisbursementAmounts(prev => {
      const shifted: Record<number, string> = {};

      for (const [keyStr, val] of Object.entries(prev)) {
        const oldMonth = parseInt(keyStr);
        const amt = parseFloat(val);
        if (amt <= 0) continue;

        // Desplazar por delta si cambió startMonth
        let newMonth = oldMonth;
        if (delta !== 0) {
          newMonth = oldMonth + delta;
        }

        // Solo conservar si está dentro del rango visible actual
        if (newMonth >= newRangeStart && newMonth <= newRangeEnd) {
          shifted[newMonth] = val;
        }
      }

      return shifted;
    });
  }, [formStartMonth, formTermMonths]);

  const distributeEvenly = useCallback(() => {
    const total = parseFloat(form.amountCUP) || 0;
    if (total <= 0 || disbursementMonths.length === 0) return;
    const perMonth = total / disbursementMonths.length;
    const newAmounts: Record<number, string> = {};
    for (const m of disbursementMonths) newAmounts[m.abs] = perMonth.toFixed(2);
    setDisbursementAmounts(newAmounts);
  }, [form.amountCUP, disbursementMonths]);

  // ── Guardar ──
  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('El nombre del préstamo es obligatorio');
      return;
    }

    let disbursementSchedule: LoanDisbursement[] | undefined;
    if (form.disbursementMode === 'monthly') {
      // ── Opción B: Solo guardar meses dentro del rango visible actual ──
      const validMonths = new Set(disbursementMonths.map(m => m.abs));
      const schedule: LoanDisbursement[] = [];
      for (const [m, amtStr] of Object.entries(disbursementAmounts)) {
        const monthNum = parseInt(m);
        if (!validMonths.has(monthNum)) continue; // descartar datos fantasma
        const amt = parseFloat(amtStr);
        if (amt > 0) schedule.push({ month: monthNum, amount: amt });
      }
      const totalDisb = schedule.reduce((s, d) => s + d.amount, 0);
      const loanAmount = parseFloat(form.amountCUP) || 0;
      const authAmount = parseFloat(form.authorizedAmount) || loanAmount;

      // ═══ VALIDACIÓN: desembolsos dentro del período de gracia ═══
      const graceEnd = parseInt(form.startMonth || '1') + (parseInt(form.gracePeriodMonths) || 0) - 1;
      const outOfGrace = schedule.filter(d => d.month > graceEnd);
      if (outOfGrace.length > 0 && graceEnd > 0) {
        toast.error(`${outOfGrace.length} desembolso(s) fuera del período de gracia (mes ${graceEnd}). Los desembolsos deben estar dentro del período de gracia según el Esquema de Metodología de Préstamos.`);
        return;
      }

      // ═══ VALIDACIÓN: suma de desembolsos ≤ monto autorizado ═══
      if (totalDisb > authAmount + 0.01) {
        toast.error(`El total de desembolsos (${totalDisb.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP) excede el monto autorizado (${authAmount.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP)`);
        return;
      }

      // ═══ VALIDACIÓN: suma de desembolsos ≈ monto del préstamo ═══
      if (Math.abs(totalDisb - loanAmount) > 0.01 && schedule.length > 0) {
        toast.error(`El total de desembolsos (${totalDisb.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP) no coincide con el monto del préstamo (${loanAmount.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP)`);
        return;
      }
      disbursementSchedule = schedule.length > 0 ? schedule : undefined;
    }

    // ═══ Construir bankFees si están habilitados ═══
    let bankFees: LoanBankFees | undefined;
    if (form.bankFeesEnabled) {
      const comm = (parseFloat(form.commissionRate) || 0) / 100;
      const ins = (parseFloat(form.insuranceRate) || 0) / 100;
      const oth = (parseFloat(form.otherRate) || 0) / 100;
      if (comm > 0 || ins > 0 || oth > 0) {
        bankFees = { commissionRate: comm, insuranceRate: ins, otherRate: oth };
      }
    }

    const data: Partial<Loan> = {
      name: form.name,
      amountCUP: parseFloat(form.amountCUP) || 0,
      authorizedAmount: parseFloat(form.authorizedAmount) || undefined,
      annualRate: (parseFloat(form.annualRate) || 0) / 100,
      termMonths: parseInt(form.termMonths) || 60,
      gracePeriodMonths: parseInt(form.gracePeriodMonths) || 0,
      startMonth: parseInt(form.startMonth) || 1,
      currency: form.currency,
      capitalizableInterest: form.capitalizableInterest,
      graceInterestPayment: form.graceInterestPayment,
      disbursementSchedule,
      amortizationSystem: form.amortizationSystem,
      paymentFrequency: form.paymentFrequency,
      capitalizationPeriod: form.capitalizationPeriod,
      loanPurpose: form.loanPurpose,
      numInstallments: form.numInstallments ? parseInt(form.numInstallments) || undefined : undefined,
      bankFees,
      bankFeeTiming: form.bankFeeTiming,
      interestRateTable: form.variableRateEnabled && form.rateTableRows.length > 0
        ? form.rateTableRows.map(r => ({ periodStart: r.periodStart, rate: r.rate }))
        : undefined,
      exchangeRateTable: form.customExchangeRates && form.exchangeRateTableRows.length > 0
        ? form.exchangeRateTableRows.map(r => ({ periodStart: r.periodStart, rate: r.rate }))
        : undefined,
    };

    if (editingId) {
      updateLoan(editingId, data);
      toast.success('Préstamo actualizado');
    } else {
      addLoan({
        name: data.name!, amountCUP: data.amountCUP!, annualRate: data.annualRate!,
        termMonths: data.termMonths!, gracePeriodMonths: data.gracePeriodMonths!,
        startMonth: data.startMonth!, currency: data.currency!,
        capitalizableInterest: data.capitalizableInterest,
        graceInterestPayment: data.graceInterestPayment,
        disbursementSchedule: data.disbursementSchedule,
        amortizationSystem: data.amortizationSystem,
        paymentFrequency: data.paymentFrequency,
        capitalizationPeriod: data.capitalizationPeriod,
        loanPurpose: data.loanPurpose,
        numInstallments: data.numInstallments,
        bankFees: data.bankFees,
        bankFeeTiming: data.bankFeeTiming,
        interestRateTable: data.interestRateTable,
        exchangeRateTable: data.exchangeRateTable,
      });
      toast.success('Préstamo agregado');
    }
    onClose();
  };

  return (
    <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
      <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
        <DialogTitle className="text-fin-lg">{editingId ? 'Editar Préstamo' : 'Nuevo Préstamo'}</DialogTitle>
      </DialogHeader>
      <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
        <div className="grid gap-3 py-2">
        {/* Nombre */}
        <div className="grid gap-1">
          <Label className="text-fin-xs font-medium text-muted-foreground">{'Nombre del Préstamo'} *</Label>
          <Input className="h-8 text-fin-sm focus-ring transition-all duration-200"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={'Ej: Préstamo BANDEC'}
          />
        </div>

        {/* ═══ Fila 1: Datos básicos ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{`Monto (${form.currency || 'CUP'})`}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.amountCUP} onChange={(e) => setForm((p) => ({ ...p, amountCUP: e.target.value }))} step="0.01" placeholder="0.00" />
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              {'Destino'}
            </Label>
            <Select value={form.loanPurpose} onValueChange={(v) => setForm((p) => ({ ...p, loanPurpose: v as LoanPurpose }))}>
              <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inversion">{LOAN_PURPOSE_LABELS.inversion}</SelectItem>
                <SelectItem value="capital-trabajo">{LOAN_PURPOSE_LABELS['capital-trabajo']}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Monto Autorizado (CUP)'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.authorizedAmount || form.amountCUP} onChange={(e) => setForm((p) => ({ ...p, authorizedAmount: e.target.value }))} step="0.01" placeholder="Igual al monto" />
            <p className="text-fin-xs text-muted-foreground">Límite superior (puede exceder la suma de desembolsos)</p>
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Tasa Anual (%)'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.annualRate} onChange={(e) => setForm((p) => ({ ...p, annualRate: e.target.value }))} step="0.01" placeholder="0.00" />
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Plazo (meses)'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.termMonths} onChange={(e) => setForm((p) => ({ ...p, termMonths: e.target.value }))} min={1} max={360} />
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Período de Gracia (meses)'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.gracePeriodMonths} onChange={(e) => setForm((p) => ({ ...p, gracePeriodMonths: e.target.value }))} min={0} />
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Mes de Inicio'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.startMonth} onChange={(e) => setForm((p) => ({ ...p, startMonth: e.target.value }))} min={1} max={projectDuration} />
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Número de Cuotas'}</Label>
            <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.numInstallments} onChange={(e) => setForm((p) => ({ ...p, numInstallments: e.target.value }))} min={1} placeholder="Automático" />
            <p className="text-fin-xs text-muted-foreground">Vacío = calcular automáticamente según plazo y frecuencia</p>
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Moneda'}</Label>
            <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
              <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CUP">CUP</SelectItem>
                <SelectItem value="MLC">MLC</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            {form.currency !== 'CUP' && (
              <p className="text-fin-xs text-muted-foreground">
                Los montos se convertirán a CUP usando la tasa de cambio (Tasa proyecto: {store.project.exchangeRates.cupToMlc} CUP/{form.currency})
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Sistema de Amortización'}</Label>
            <Select value={form.amortizationSystem} onValueChange={(v) => setForm((p) => ({ ...p, amortizationSystem: v as AmortizationSystem }))}>
              <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="french">{AMORTIZATION_LABELS.french}</SelectItem>
                <SelectItem value="german">{AMORTIZATION_LABELS.german}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Frecuencia de Pagos'}</Label>
            <Select value={form.paymentFrequency} onValueChange={(v) => setForm((p) => ({ ...p, paymentFrequency: v as PaymentFrequency }))}>
              <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{FREQUENCY_LABELS.monthly}</SelectItem>
                <SelectItem value="quarterly">{FREQUENCY_LABELS.quarterly}</SelectItem>
                <SelectItem value="semiannual">{FREQUENCY_LABELS.semiannual}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-fin-xs font-medium text-muted-foreground">{'Período de Capitalización'}</Label>
            <Select value={form.capitalizationPeriod} onValueChange={(v) => setForm((p) => ({ ...p, capitalizationPeriod: v as PaymentFrequency }))}>
              <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{FREQUENCY_LABELS.monthly}</SelectItem>
                <SelectItem value="quarterly">{FREQUENCY_LABELS.quarterly}</SelectItem>
                <SelectItem value="semiannual">{FREQUENCY_LABELS.semiannual}</SelectItem>
              </SelectContent>
            </Select>
            {form.capitalizationPeriod !== form.paymentFrequency && (
              <p className="text-fin-xs text-warning bg-warning-muted rounded p-1">
                Difiere de frecuencia de pagos — se aplica conversión compuesta de tasa.
              </p>
            )}
          </div>
        </div>

        {/* ═══════ Tasa Variable ═══════ */}
        <div className="border rounded-xl p-3 mt-2 bg-muted/5 shadow-card-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <Label className="font-semibold">{'Tasa de Interés'}</Label>
            </div>
            <Select
              value={form.variableRateEnabled ? 'variable' : 'fija'}
              onValueChange={(v) => setForm((p) => ({ ...p, variableRateEnabled: v === 'variable' }))}
            >
              <SelectTrigger className="w-full sm:w-auto sm:max-w-[200px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fija">Fija (tasa única)</SelectItem>
                <SelectItem value="variable">Variable (tabla de tasas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.variableRateEnabled ? (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground">
                {'Defina la tasa nominal anual vigente a partir de cada período. Período 1 = inicio del préstamo. La primera entrada puede omitirse (se usa la tasa fija como base).'}
              </p>
              <ScrollableTable maxHeight="200px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow className="fin-row-hover">
                      <TableHead className="fin-col-header" style={{ minWidth: 70 }}>{'Período desde'}</TableHead>
                      <TableHead className="fin-col-header" style={{ minWidth: 100 }}>{'Tasa Anual (%)'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.rateTableRows.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-fin-sm font-medium">{entry.periodStart}</TableCell>
                        <TableCell className="text-fin-sm">{(entry.rate * 100).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {'La tasa es fija durante todo el horizonte del préstamo.'}
            </p>
          )}
        </div>

        {/* ═══════ Tipo de Interés (Resolución GOC-2022-O95) ═══════ */}

        {/* ═══════ Tasa de Cambio (Phase 6) ═══════ */}
        {form.currency !== 'CUP' && (
          <div className="border rounded-xl p-3 mt-1 bg-muted/5 shadow-card-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                <Label className="font-semibold">{`Tasa de Cambio (${form.currency} → CUP)`}</Label>
              </div>
              <Select
                value={form.customExchangeRates ? 'variable' : 'fija'}
                onValueChange={(v) => setForm((p) => ({ ...p, customExchangeRates: v === 'variable' }))}
              >
                <SelectTrigger className="w-full sm:w-auto sm:max-w-[200px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fija">Fija (tasa del proyecto)</SelectItem>
                  <SelectItem value="variable">Variable (tabla de tasas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.customExchangeRates ? (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  {'Defina la tasa de cambio vigente a partir de cada período del préstamo. Período 1 = inicio del préstamo. Tasa proyecto actual: '}{store.project.exchangeRates.cupToMlc}{' CUP/'}{form.currency}
                </p>
                <ScrollableTable maxHeight="200px" stickyColumns={1}>
                  <Table>
                    <TableHeader>
                      <TableRow className="fin-row-hover">
                        <TableHead className="fin-col-header" style={{ minWidth: 70 }}>{'Período desde'}</TableHead>
                        <TableHead className="fin-col-header" style={{ minWidth: 120 }}>{'Tasa (CUP/'}{form.currency}{')'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.exchangeRateTableRows.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-fin-sm font-medium">{entry.periodStart}</TableCell>
                          <TableCell className="text-fin-sm">{entry.rate.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTable>
                {form.exchangeRateTableRows.length === 0 && (
                  <p className="text-fin-xs text-warning bg-warning-muted rounded p-1">
                    {'No hay tasas definidas. Se usará la tasa del proyecto ('}{store.project.exchangeRates.cupToMlc}{') para todos los períodos.'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {'Se usa la tasa fija del proyecto: '}{store.project.exchangeRates.cupToMlc}{' CUP/'}{form.currency}{' para todo el horizonte del préstamo.'}
              </p>
            )}
          </div>
        )}

        {/* ═══════ Tipo de Interés (Resolución GOC-2022-O95) ═══════ */}
        <div className="border rounded-xl p-3 mt-1 bg-muted/5 shadow-card-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <Label className="font-semibold">{'Tipo de Interés (período de gracia)'}</Label>
            </div>
            <Select
              value={form.capitalizableInterest ? 'capitalizable' : 'non-capitalizable'}
              onValueChange={(v) => setForm((p) => ({ ...p, capitalizableInterest: v === 'capitalizable' }))}
            >
              <SelectTrigger className="w-full sm:w-auto sm:max-w-[280px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="non-capitalizable">Solo Capital (se pagan intereses)</SelectItem>
                <SelectItem value="capitalizable">Total (capitaliza intereses)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.capitalizableInterest ? (
            <p className="text-xs text-muted-foreground">
              {'Los intereses del período de gracia se acumulan al capital del préstamo (no son salida de efectivo). La cuota de amortización se calcula sobre el saldo ampliado. Aplicable a préstamos de inversión/construcción según la Resolución GOC-2022-O95.'}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {'Los intereses del período de gracia se pagan (no se acumulan al capital). Seleccione el modo de pago:'}
              </p>
              <Select
                value={form.graceInterestPayment}
                onValueChange={(v) => setForm((p) => ({ ...p, graceInterestPayment: v as GraceInterestPayment }))}
              >
                <SelectTrigger className="w-full max-w-[360px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="periodico">{GRACE_INTEREST_PAYMENT_LABELS.periodico}</SelectItem>
                  <SelectItem value="pago-unico">{GRACE_INTEREST_PAYMENT_LABELS['pago-unico']}</SelectItem>
                </SelectContent>
              </Select>
              {form.graceInterestPayment === 'pago-unico' && (
                <p className="text-xs text-warning bg-warning-muted rounded p-2">
                  <Receipt className="h-3 w-3 inline mr-1" />
                  {'Los intereses se acumulan durante la gracia y se pagan como pago único en la primera cuota de amortización. No se capitalizan al saldo.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ═══════ Tipo de Desembolso ═══════ */}
        <div className="border rounded-xl p-3 mt-2 bg-muted/5 shadow-card-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Label className="font-semibold">{'Tipo de Desembolso'}</Label>
            </div>
            <Select value={form.disbursementMode} onValueChange={(v) => setForm((p) => ({ ...p, disbursementMode: v as 'lump' | 'monthly' }))}>
              <SelectTrigger className="w-full sm:w-auto sm:max-w-[200px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lump">Único (mes de inicio)</SelectItem>
                <SelectItem value="monthly">Por meses (cronograma)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.disbursementMode === 'lump' && (
            <p className="text-xs text-muted-foreground">
              {'El monto total se desembolsa en un solo pago al inicio del préstamo (mes '}{form.startMonth}{').'}
            </p>
          )}

          {form.disbursementMode === 'monthly' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {'Especifique el monto a desembolsar en cada mes. La suma debe ser igual al monto del préstamo.'}
                </p>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={distributeEvenly}>
                  <Banknote className="h-3 w-3" />
                  Distribuir uniformemente
                </Button>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">
                  {'Monto préstamo:'} <span className="font-bold">{(parseFloat(form.amountCUP) || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</span> CUP
                </span>
                <span className={Math.abs(formDisbursementTotal - (parseFloat(form.amountCUP) || 0)) < 0.01 ? 'text-success font-bold' : 'text-destructive font-bold'}>
                  {'Desembolsado:'} {formDisbursementTotal.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP
                  {Math.abs(formDisbursementTotal - (parseFloat(form.amountCUP) || 0)) >= 0.01 && (
                    <span className="ml-1">
                      ({formDisbursementTotal > (parseFloat(form.amountCUP) || 0) ? 'sobran' : 'faltan'}{' '}
                      {Math.abs(formDisbursementTotal - (parseFloat(form.amountCUP) || 0)).toLocaleString('es-CU', { maximumFractionDigits: 1 })})
                    </span>
                  )}
                </span>
              </div>
              <ScrollableTable maxHeight="300px" stickyColumns={1}>
                <Table>
                  <TableHeader>
                    <TableRow className="fin-row-hover">
                      <TableHead className="fin-col-header" style={{ minWidth: 70 }}>{'Mes'}</TableHead>
                      <TableHead className="fin-col-header" style={{ minWidth: 100 }}>{'Monto (CUP)'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursementMonths.map((m) => (
                      <TableRow key={m.abs}>
                        <TableCell className="text-fin-sm font-medium">{m.label}</TableCell>
                        <TableCell className="text-fin-sm">
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            value={disbursementAmounts[m.abs] || ''}
                            onChange={(e) => setDisbursementAmounts((prev) => ({ ...prev, [m.abs]: e.target.value }))}
                            placeholder="0"
                            step="0.01"
                            min="0"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </div>
          )}
        </div>

        {/* ═══════ Gastos Bancarios (desglose) ═══════ */}
        <div className="border rounded-xl p-3 mt-2 bg-muted/5 shadow-card-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <Label className="font-semibold">{'Gastos Bancarios'}</Label>
            </div>
            <Select
              value={form.bankFeesEnabled ? 'desglose' : 'global'}
              onValueChange={(v) => setForm((p) => ({ ...p, bankFeesEnabled: v === 'desglose' }))}
            >
              <SelectTrigger className="w-full sm:w-auto sm:max-w-[240px] h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Tasa global (parámetros)</SelectItem>
                <SelectItem value="desglose">Desglose personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.bankFeesEnabled ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Comisión Apertura (%)
                  </Label>
                  <Input type="number" className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.commissionRate} onChange={(e) => setForm((p) => ({ ...p, commissionRate: e.target.value }))} step="0.01" min="0" placeholder="0.00" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Seguro (%)
                  </Label>
                  <Input type="number" className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.insuranceRate} onChange={(e) => setForm((p) => ({ ...p, insuranceRate: e.target.value }))} step="0.01" min="0" placeholder="0.00" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> Otros (%)
                  </Label>
                  <Input type="number" className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.otherRate} onChange={(e) => setForm((p) => ({ ...p, otherRate: e.target.value }))} step="0.01" min="0" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Banknote className="h-3 w-3" /> Aplicación de Gastos
                  </Label>
                  <Select
                    value={form.bankFeeTiming}
                    onValueChange={(v) => setForm((p) => ({ ...p, bankFeeTiming: v as BankFeeTiming }))}
                  >
                    <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BANK_FEE_TIMING_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.bankFeeTiming === 'periodic' && (
                <p className="text-xs text-warning mt-2">
                  {'Los gastos bancarios se aplicarán periódicamente en cada cuota de amortización sobre el saldo insoluto.'}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {'Se usa la tasa de gastos bancarios global definida en Parámetros (Módulo N).'}
            </p>
          )}
        </div>

        {/* Botones */}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
          <Button variant="outline" onClick={onClose} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 focus-ring transition-all duration-200 shadow-sm">
            {editingId ? 'Guardar Cambios' : 'Agregar Préstamo'}
          </Button>
        </div>
    </DialogContent>
  );
}

// ─── Main Loans Module ──────────────────────────────────────────

interface YearRow {
  num: number; label: string; bold: boolean; colorClass: string;
  /** Flat array: monthly values interleaved with annual subtotals.
   *  For each year group: [m1, m2, ..., mN, subtotal, mN+1, ..., subtotal2, ...]
   */
  values: number[];
  total: number;
  /** Indices in `values` that correspond to annual subtotals */
  subtotalPositions: number[];
}

export function LoansModule() {
  const store = useBaraproStore();
  const loans = store.loans;
  const deleteLoan = store.deleteLoan;
  const cupToMlc = store.project.exchangeRates.cupToMlc;

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [amortOpen, setAmortOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleNew = () => {
    setEditingId(null);
    setEditKey((k) => k + 1);
    setEditOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setEditingId(loan.id);
    setEditKey((k) => k + 1);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
  };

  const loadTestDataLoans = () => {
    if (store.loans.length > 0) {
      const confirmed = window.confirm(
        `Ya existen ${store.loans.length} préstamo(s) en el módulo. ¿Desea eliminarlos y cargar 3 préstamos de prueba?`
      );
      if (!confirmed) return;
      // Clear existing loans
      [...store.loans].forEach((l) => store.deleteLoan(l.id));
    }

    const perDisb = Math.round(2000000 / 6);

    // Préstamo 1: BANDEC Inversión (French, monthly, capitalizable interest, lump sum)
    store.addLoan({
      name: 'Préstamo BANDEC Inversión',
      amountCUP: 5000000,
      authorizedAmount: 6000000,
      annualRate: 0.06,
      termMonths: 84,
      gracePeriodMonths: 12,
      startMonth: 1,
      currency: 'CUP',
      amortizationSystem: 'french',
      paymentFrequency: 'monthly',
      capitalizationPeriod: 'monthly',
      loanPurpose: 'inversion',
      capitalizableInterest: true,
      bankFees: { commissionRate: 0.02, insuranceRate: 0.015, otherRate: 0.005 },
      bankFeeTiming: 'at-disbursement',
      disbursementSchedule: undefined,
    });

    // Préstamo 2: BPA Capital de Trabajo (German, quarterly, gradual disbursement, periodic fees)
    store.addLoan({
      name: 'Crédito BPA Capital de Trabajo',
      amountCUP: 2000000,
      authorizedAmount: 2500000,
      annualRate: 0.08,
      termMonths: 48,
      gracePeriodMonths: 6,
      startMonth: 13,
      currency: 'CUP',
      amortizationSystem: 'german',
      paymentFrequency: 'quarterly',
      capitalizationPeriod: 'monthly',
      loanPurpose: 'capital-trabajo',
      capitalizableInterest: false,
      graceInterestPayment: 'pago-unico',
      bankFees: { commissionRate: 0.025, insuranceRate: 0.01, otherRate: 0 },
      bankFeeTiming: 'periodic',
      disbursementSchedule: [
        { month: 13, amount: perDisb },
        { month: 14, amount: perDisb },
        { month: 15, amount: perDisb },
        { month: 16, amount: perDisb },
        { month: 17, amount: perDisb },
        { month: 18, amount: 2000000 - 5 * perDisb },
      ],
    });

    // Préstamo 3: Financiamiento Externo MLC (French, semiannual, variable exchange rate)
    store.addLoan({
      name: 'Financiamiento Externo MLC',
      amountCUP: 3000000,
      authorizedAmount: 3000000,
      annualRate: 0.05,
      termMonths: 60,
      gracePeriodMonths: 0,
      startMonth: 7,
      currency: 'MLC',
      amortizationSystem: 'french',
      paymentFrequency: 'semiannual',
      capitalizationPeriod: 'quarterly',
      loanPurpose: 'inversion',
      capitalizableInterest: false,
      graceInterestPayment: 'periodico',
      bankFees: { commissionRate: 0.03, insuranceRate: 0.02, otherRate: 0.01 },
      bankFeeTiming: 'at-disbursement',
      exchangeRateTable: [
        { periodStart: 1, rate: 300 },
        { periodStart: 13, rate: 320 },
        { periodStart: 25, rate: 350 },
      ],
    });

    toast.success('3 préstamos de prueba cargados exitosamente');
  };

  const bankFeeRate = store.parameters.bankFeeRate || 0;
  const projectDuration = store.project.monthsDuration || 120;
  const amortData = selectedLoan ? calcAmortizacion({ ...selectedLoan, bankFeeRate, projectDuration }) : [];

  // Monthly financial costs from engine
  const financialData = useMemo(() => buildFinancialCosts(store), [store]);

  // Disbursements by month
  const disbursementsByMonth = useMemo(() => {
    const map: Record<number, number> = {};
    for (const loan of loans) {
      const disbs = getLoanDisbursements(loan);
      for (const [m, amt] of Object.entries(disbs)) {
        map[parseInt(m)] = (map[parseInt(m)] || 0) + amt;
      }
    }
    return map;
  }, [loans]);

  const monthGroups = useMemo(() =>
    groupMonthsByYear(projectDuration, store.project.startDate),
    [projectDuration, store.project.startDate]
  );
  const years = useMemo(() => monthGroups.map((g) => g.year), [monthGroups]);

  // ── Totals for KPI cards ──
  const totals = useMemo(() => ({
    totalDisbursed: loans.reduce((s, l) => {
      if (l.currency && l.currency !== 'CUP') {
        const rate = resolveExchangeRateForPeriod(1, l.currency, cupToMlc, l.exchangeRateTable);
        return s + l.amountCUP * rate;
      }
      return s + l.amountCUP;
    }, 0),
    interest: financialData.reduce((s, r) => s + r.interest, 0),
    capitalizedInterest: financialData.reduce((s, r) => s + r.capitalizedInterest, 0),
    totalInterest: financialData.reduce((s, r) => s + r.totalInterest, 0),
    bankFee: financialData.reduce((s, r) => s + r.bankFee, 0),
    principal: financialData.reduce((s, r) => s + r.principal, 0),
    totalPayment: financialData.reduce((s, r) => s + r.totalPayment, 0),
  }), [loans, financialData, cupToMlc]);
  const hasCapitalized = totals.capitalizedInterest > 0;

  // ── Loan groups for per-loan summary ──
  const loanGroups = useMemo((): { loanName: string; totalInterest: number; totalCapitalizedInterest: number; totalInterestAll: number; totalBankFee: number; totalPrincipal: number; totalPayment: number; finalBalance: number }[] => {
    const groups: Record<string, { interest: number; capitalizedInterest: number; totalInterest: number; bankFee: number; principal: number; totalPayment: number; finalBalance: number }> = {};
    for (const row of financialData) {
      if (!groups[row.loanName]) groups[row.loanName] = { interest: 0, capitalizedInterest: 0, totalInterest: 0, bankFee: 0, principal: 0, totalPayment: 0, finalBalance: 0 };
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
      totalInterest: data.interest,
      totalCapitalizedInterest: data.capitalizedInterest,
      totalInterestAll: data.totalInterest,
      totalBankFee: data.bankFee,
      totalPrincipal: data.principal,
      totalPayment: data.totalPayment,
      finalBalance: data.finalBalance,
    }));
  }, [financialData]);

  const uniqueLoanNames = useMemo(() => loanGroups.map((g) => g.loanName), [loanGroups]);

  // ── Shared monthly aggregates (used by both annual and monthly summaries) ──
  const monthlyAggregates = useMemo(() => {
    const monthlyInterest = Array(projectDuration).fill(0);
    const monthlyPrincipal = Array(projectDuration).fill(0);
    const monthlyBalance: (number | null)[] = Array(projectDuration).fill(null);
    const monthlyBankFee = Array(projectDuration).fill(0);
    const monthlyCapInterest = Array(projectDuration).fill(0);
    const monthlyDisb = Array(projectDuration).fill(0);

    for (const row of financialData) {
      const idx = row.month - 1;
      if (idx >= 0 && idx < projectDuration) {
        monthlyInterest[idx] += row.interest;
        monthlyPrincipal[idx] += row.principal;
        monthlyBankFee[idx] += row.bankFee;
        monthlyCapInterest[idx] += row.capitalizedInterest || 0;
        monthlyBalance[idx] = (monthlyBalance[idx] || 0) + row.remainingBalance;
      }
    }
    for (const [m, amt] of Object.entries(disbursementsByMonth)) {
      const idx = parseInt(m) - 1;
      if (idx >= 0 && idx < projectDuration) monthlyDisb[idx] = amt;
    }
    return { monthlyInterest, monthlyPrincipal, monthlyBalance, monthlyBankFee, monthlyCapInterest, monthlyDisb };
  }, [financialData, disbursementsByMonth, projectDuration]);

  // ── Annual summary (original) ──
  const yearlySummary = useMemo((): { num: number; label: string; bold: boolean; colorClass: string; values: number[]; total: number }[] => {
    const { monthlyInterest, monthlyPrincipal, monthlyBalance, monthlyBankFee, monthlyCapInterest, monthlyDisb } = monthlyAggregates;

    const makeRow = (num: number, label: string, bold: boolean, colorClass: string, monthlyValues: number[]) => {
      const values: number[] = [];
      let total = 0;
      for (const group of monthGroups) {
        let sum = 0;
        for (const m of group.months) sum += monthlyValues[m.monthIndex] || 0;
        values.push(sum);
        total += sum;
      }
      return { num, label, bold, colorClass, values, total };
    };

    const hasCapInterest = monthlyCapInterest.some((v) => v > 0);
    const monthlyTotalInterest = monthlyInterest.map((v, i) => v + monthlyCapInterest[i]);
    const rows: { num: number; label: string; bold: boolean; colorClass: string; values: number[]; total: number }[] = [];

    rows.push(makeRow(1, 'Desembolsos Recibidos', false, 'text-success', monthlyDisb));
    rows.push(makeRow(2, 'Int. Pagados (efectivo)', false, 'text-warning', monthlyInterest));
    let rowNum = 3;
    if (hasCapInterest) {
      rows.push(makeRow(3, 'Int. Capitalizados', false, 'text-warning', monthlyCapInterest));
      rowNum = 4;
    }
    rows.push(makeRow(rowNum, 'Int. Total (efectivo + capitalizado)', true, 'text-danger', monthlyTotalInterest));
    rows.push(makeRow(rowNum + 1, 'Comisiones Bancarias', false, 'text-panel-b', monthlyBankFee));
    rows.push(makeRow(rowNum + 2, 'Capital Amortizado', false, 'text-info', monthlyPrincipal));
    rows.push(makeRow(rowNum + 3, 'Total Pagado (efectivo)', true, '', monthlyInterest.map((v, i) => v + monthlyPrincipal[i] + monthlyBankFee[i])));

    const balanceValues: number[] = [];
    for (const group of monthGroups) {
      let lastBalance = 0;
      for (const m of group.months) {
        if (monthlyBalance[m.monthIndex] !== null) lastBalance = monthlyBalance[m.monthIndex]!;
      }
      balanceValues.push(lastBalance);
    }
    const lastBalance = monthlyBalance.filter((b): b is number => b !== null).pop() || 0;
    rows.push({ num: rowNum + 4, label: 'Saldo de Deuda (fin año)', bold: false, colorClass: '', values: balanceValues, total: lastBalance });
    return rows;
  }, [monthlyAggregates, monthGroups]);

  // ── Monthly summary with annual subtotals ──
  const monthlySummary = useMemo((): YearRow[] => {
    const { monthlyInterest, monthlyPrincipal, monthlyBalance, monthlyBankFee, monthlyCapInterest, monthlyDisb } = monthlyAggregates;

    /** Build a row with monthly values + annual subtotals (flat array).
     *  Structure per year: [m1, m2, ..., mN, subtotal]
     */
    const makeRow = (num: number, label: string, bold: boolean, colorClass: string,
      monthlyValues: number[], isBalanceRow = false) => {
      const values: number[] = [];
      const subtotalPositions: number[] = [];
      let total = 0;
      for (const group of monthGroups) {
        let yearSum = 0;
        let lastBalance = 0;
        for (const m of group.months) {
          if (isBalanceRow) {
            const raw = monthlyBalance[m.monthIndex];
            if (raw !== null) lastBalance = raw;
          }
          const v = isBalanceRow ? lastBalance : (monthlyValues[m.monthIndex] || 0);
          values.push(v);
          if (!isBalanceRow) yearSum += v;
        }
        const subtotal = isBalanceRow ? lastBalance : yearSum;
        values.push(subtotal);
        subtotalPositions.push(values.length - 1);
        total = isBalanceRow ? lastBalance : (total + yearSum);
      }
      return { num, label, bold, colorClass, values, total, subtotalPositions };
    };

    const hasCapInterest = monthlyCapInterest.some((v) => v > 0);
    const monthlyTotalInterest = monthlyInterest.map((v, i) => v + monthlyCapInterest[i]);
    const rows: YearRow[] = [];

    rows.push(makeRow(1, 'Desembolsos Recibidos', false, 'text-success', monthlyDisb));
    rows.push(makeRow(2, 'Int. Pagados (efectivo)', false, 'text-warning', monthlyInterest));
    let rowNum = 3;
    if (hasCapInterest) {
      rows.push(makeRow(3, 'Int. Capitalizados', false, 'text-warning', monthlyCapInterest));
      rowNum = 4;
    }
    rows.push(makeRow(rowNum, 'Int. Total (efectivo + capitalizado)', true, 'text-danger', monthlyTotalInterest));
    rows.push(makeRow(rowNum + 1, 'Comisiones Bancarias', false, 'text-panel-b', monthlyBankFee));
    rows.push(makeRow(rowNum + 2, 'Capital Amortizado', false, 'text-info', monthlyPrincipal));
    rows.push(makeRow(rowNum + 3, 'Total Pagado (efectivo)', true, '', monthlyInterest.map((v, i) => v + monthlyPrincipal[i] + monthlyBankFee[i])));

    const lastBalance = monthlyBalance.filter((b): b is number => b !== null).pop() || 0;
    rows.push(makeRow(rowNum + 4, 'Saldo de Deuda (fin período)', false, '', [], true));
    rows[rows.length - 1].total = lastBalance;
    return rows;
  }, [monthlyAggregates, monthGroups]);

  // ── Monthly schedule: per-loan transposed format (aligned with financial-costs-view) ──
  const uniqueLoanNamesList = useMemo(() => Array.from(new Set(financialData.map((r) => r.loanName))), [financialData]);

  const monthlyTransposedRows = useMemo(() => {
    if (financialData.length === 0) return [] as { key: string; num: number; label: string; valueClass: string; isBold: boolean; values: (number | null)[]; total: number }[];

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
    for (const loan of uniqueLoanNamesList) {
      for (const metric of metricDefs) {
        num++;
        const values = Array.from({ length: projectDuration }, (_, i) => {
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
          label: `${loan} \u2013 ${metric.label}`,
          valueClass: metric.valueClass,
          isBold: metric.isBold,
          values,
          total,
        });
      }
    }

    return rows;
  }, [financialData, uniqueLoanNamesList, projectDuration, totals.capitalizedInterest]);

  function formatNum(n: number): string {
    return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Header */}
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">{'Financiamiento'}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {'Gestión de préstamos y fuentes de financiamiento del proyecto'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button onClick={loadTestDataLoans} variant="outline" size="sm" className="gap-1">
                <Database className="h-3.5 w-3.5" />
                {'Datos de Prueba'}
              </Button>
              <Button onClick={handleNew} size="sm" className="bg-primary hover:bg-primary/90 gap-1">
                <Plus className="h-3.5 w-3.5" />
                {'Agregar'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-1.5 px-4">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline">{loans.length} {loans.length === 1 ? 'préstamo' : 'préstamos'}</Badge>
            <Badge variant="outline">{'Total'}: {totals.totalDisbursed.toLocaleString('es-CU', { maximumFractionDigits: 1 })} CUP</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      {loans.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ScrollableTable maxHeight="300px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow className="fin-row-hover">
                    <TableHead className="fin-col-header">{'Nombre'}</TableHead>
                    <TableHead className="fin-col-header">{'Destino'}</TableHead>
                    <TableHead className="fin-col-header">{'Monto (CUP)'}</TableHead>
                    <TableHead className="fin-col-header">{'Tasa (%)'}</TableHead>
                    <TableHead className="fin-col-header">{'Plazo'}</TableHead>
                    <TableHead className="fin-col-header">{'Gracia'}</TableHead>
                    <TableHead className="fin-col-header">{'Interés'}</TableHead>
                    <TableHead className="fin-col-header">{'Sistema'}</TableHead>
                    <TableHead className="fin-col-header">{'Cuotas'}</TableHead>
                    <TableHead className="fin-col-header w-[130px]">{'Acciones'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => {
                    const hasSchedule = loan.disbursementSchedule && loan.disbursementSchedule.length > 1;
                    return (
                      <TableRow key={loan.id}>
                        <TableCell className="text-sm font-medium">{loan.name}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary" className="text-fin-xs">
                            {loan.loanPurpose === 'capital-trabajo' ? 'C. Trabajo' : 'Inversión'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{loan.amountCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-sm">{(loan.annualRate * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-sm">{loan.termMonths}m</TableCell>
                        <TableCell className="text-sm">{loan.gracePeriodMonths}m</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant={loan.capitalizableInterest ? 'default' : 'secondary'} className={`text-fin-xs ${loan.capitalizableInterest ? 'bg-warning-muted text-warning border-warning/20' : ''}`}>
                            {loan.capitalizableInterest ? 'Capital.' : (loan.graceInterestPayment === 'pago-unico' ? 'P.Único' : 'Periód.')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary" className="text-fin-xs">
                            {loan.amortizationSystem === 'german' ? 'Alemán' : 'Francés'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary" className="text-fin-xs">
                            {loan.numInstallments ? `${loan.numInstallments} (${loan.paymentFrequency ? FREQUENCY_LABELS[loan.paymentFrequency] : 'Mensual'})` : (loan.paymentFrequency ? FREQUENCY_LABELS[loan.paymentFrequency] : 'Mensual')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(loan)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-warning" onClick={() => { setSelectedLoan(loan); setAmortOpen(true); }} title={'Tabla de Amortización'}>
                              <Calculator className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => { setDeleteTargetId(loan.id); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollableTable>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {'No hay préstamos registrados. Agregue un préstamo para comenzar.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ FINANCING SUMMARY TABLES ═══════════ */}
      {/* ═══════════ FINANCING SUMMARY TABLES ═══════════ */}
      {loans.length > 0 && (
        <>
          {/* KPI Cards — alineados con formato de Costos Financieros */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-0.5"><Banknote className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{'Int. Pagados (efectivo)'}</p>
                  <p className="text-lg font-bold text-warning">{formatNum(totals.interest)} CUP</p>
                </div>
              </CardContent>
            </Card>
            {hasCapitalized && (
              <Card>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5"><Landmark className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{'Int. Capitalizados'}</p>
                    <p className="text-lg font-bold text-warning">{formatNum(totals.capitalizedInterest)} CUP</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-0.5"><Landmark className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{'Interés Total'}</p>
                  <p className="text-lg font-bold text-danger">{formatNum(totals.totalInterest)} CUP</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-0.5"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{'Total Pagado (efectivo)'}</p>
                  <p className="text-lg font-bold text-success">{formatNum(totals.totalPayment)} CUP</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen por Préstamo — formato horizontal limpio alineado con Costos Financieros */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {'Resumen por Préstamo'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable stickyColumns={0}>
                <Table>
                  <TableHeader>
                    <TableRow className="fin-row-hover">
                      <TableHead className="fin-col-header">{'Préstamo'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Desembolsado'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Int. Pagados'}</TableHead>
                      {hasCapitalized && <TableHead className="fin-col-header text-right">{'Int. Capital.'}</TableHead>}
                      <TableHead className="fin-col-header text-right">{'Int. Total'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Com. Bancaria'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Capital Amort.'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Total Pagado'}</TableHead>
                      <TableHead className="fin-col-header text-right">{'Saldo Final'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loanGroups.map((group) => (
                      <TableRow key={group.loanName}>
                        <TableCell className="text-sm font-medium">
                          <Badge variant="secondary" className="text-xs mr-2">{uniqueLoanNames.indexOf(group.loanName) + 1}</Badge>
                          {group.loanName}
                        </TableCell>
                        <TableCell className="text-sm text-right text-success">{formatNum(
                          (() => {
                            const loan = loans.find((l) => l.name === group.loanName);
                            if (!loan) return 0;
                            if (loan.currency && loan.currency !== 'CUP') {
                              const rate = resolveExchangeRateForPeriod(1, loan.currency, cupToMlc, loan.exchangeRateTable);
                              return loan.amountCUP * rate;
                            }
                            return loan.amountCUP;
                          })()
                        )}</TableCell>
                        <TableCell className="text-sm text-right text-warning">{formatNum(group.totalInterest)}</TableCell>
                        {hasCapitalized && <TableCell className="text-sm text-right text-warning">{formatNum(group.totalCapitalizedInterest)}</TableCell>}
                        <TableCell className="text-sm text-right text-danger font-medium">{formatNum(group.totalInterestAll)}</TableCell>
                        <TableCell className="text-sm text-right text-panel-b">{formatNum(group.totalBankFee)}</TableCell>
                        <TableCell className="text-sm text-right text-info">{formatNum(group.totalPrincipal)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{formatNum(group.totalPayment)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{formatNum(group.finalBalance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="text-fin-sm">{'Total'}</TableCell>
                      <TableCell className="text-fin-sm text-right text-success">{formatNum(totals.totalDisbursed)}</TableCell>
                      <TableCell className="text-fin-sm text-right text-warning">{formatNum(totals.interest)}</TableCell>
                      {hasCapitalized && <TableCell className="text-fin-sm text-right text-warning">{formatNum(totals.capitalizedInterest)}</TableCell>}
                      <TableCell className="text-fin-sm text-right text-danger">{formatNum(totals.totalInterest)}</TableCell>
                      <TableCell className="text-fin-sm text-right text-panel-b">{formatNum(totals.bankFee)}</TableCell>
                      <TableCell className="text-fin-sm text-right text-info">{formatNum(totals.principal)}</TableCell>
                      <TableCell className="text-fin-sm text-right">{formatNum(totals.totalPayment)}</TableCell>
                      <TableCell className="text-fin-sm text-right">{formatNum(financialData[financialData.length - 1]?.remainingBalance || 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>

          {/* Resumen Anual Consolidado */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {'Resumen Anual Consolidado'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="fin-col-header text-center w-10">{'#'}</TableHead>
                      <TableHead className="fin-col-header">{'Concepto'}</TableHead>
                      {years.map((y) => (
                        <TableHead key={y} className="fin-col-header text-right min-w-[100px] bg-info-muted/50">{y}</TableHead>
                      ))}
                      <TableHead className="fin-col-header text-right min-w-[110px] bg-info-muted">{'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlySummary.map((row) => (
                      <TableRow key={row.num} className={row.bold ? 'font-semibold bg-danger-muted/40' : row.label.includes('Total Pagado') ? 'font-bold bg-muted/30' : undefined}>
                        <TableCell className="text-fin-sm text-center">{row.num}</TableCell>
                        <TableCell className={`text-fin-sm ${row.bold ? 'font-semibold text-danger' : row.label.includes('Total Pagado') ? 'font-bold' : row.colorClass}`}>{row.label}</TableCell>
                        {row.values.map((v, vi) => (
                          <TableCell key={vi} className={`text-sm text-right ${row.colorClass}`}>{formatNum(v)}</TableCell>
                        ))}
                        <TableCell className={`text-sm text-right bg-info-muted font-medium ${row.colorClass}`}>{formatNum(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>

          {/* Resumen Mensual con Subtotales Anuales */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {'Resumen Mensual con Subtotales Anuales'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="420px" stickyColumns={2} firstColWidth={40}>
                <Table className="text-nowrap">
                  <TableHeader>
                    <YearMonthHeader groups={monthGroups} stickyColumns={2} showYearSubtotals monthColumnMinWidth="65px" />
                  </TableHeader>
                  <TableBody>
                    {monthlySummary.map((row) => (
                      <TableRow key={row.num} className={row.bold ? 'font-semibold bg-danger-muted/40' : row.label.includes('Total Pagado') ? 'bg-muted/30' : undefined}>
                        <TableCell className="text-fin-sm text-center">{row.num}</TableCell>
                        <TableCell className={`text-fin-sm ${row.bold ? 'font-semibold text-danger' : row.label.includes('Total Pagado') ? 'font-bold' : row.colorClass}`}>{row.label}</TableCell>
                        {row.values.map((v, vi) => {
                          const isSubtotal = row.subtotalPositions.includes(vi);
                          return (
                            <TableCell
                              key={vi}
                              className={`text-xs text-right ${isSubtotal
                                ? `font-semibold bg-info-muted/60 ${row.colorClass}`
                                : row.colorClass}`}
                            >
                              {formatNum(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell className={`text-fin-sm text-right bg-info-muted font-bold ${row.label.includes('Total Pagado') ? '' : row.colorClass}`}>
                          {formatNum(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>

          {/* Cronograma Mensual de Financiamiento — formato por-préstamo alineado con Costos Financieros */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{'Cronograma Mensual de Financiamiento'}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTable maxHeight="400px" stickyColumns={2} firstColWidth={40}>
                <Table>
                  <TableHeader>
                    <YearMonthHeader groups={monthGroups} stickyColumns={2} />
                  </TableHeader>
                  <TableBody>
                    {monthlyTransposedRows.map((arow) => (
                      <TableRow key={arow.key} className={arow.isBold ? 'bg-muted/30 font-bold' : undefined}>
                        <TableCell className="text-fin-sm text-center">{arow.num}</TableCell>
                        <TableCell className="text-fin-sm">{arow.label}</TableCell>
                        {arow.values.map((val, vi) => (
                          <TableCell key={vi} className={`text-fin-sm text-right ${arow.valueClass}`}>
                            {val !== null ? formatNum(val) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className={`text-fin-sm text-right bg-info-muted font-medium ${arow.valueClass}`}>
                          {formatNum(arow.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </CardContent>
          </Card>
        </>
      )}
      {/* ═══ Edit Dialog — key forces remount so useState() reinitializes with correct loan data ═══ */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) handleCloseEdit(); }}>
        <LoanEditDialogContent key={editKey} editingId={editingId} onClose={handleCloseEdit} />
      </Dialog>

      {/* ═══ Amortization Dialog ═══ */}
      <Dialog open={amortOpen} onOpenChange={setAmortOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-[900px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{'Tabla de Amortización'} — {selectedLoan?.name}</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <Badge>{'Monto'}: {formatNum(
                  selectedLoan.currency && selectedLoan.currency !== 'CUP'
                    ? selectedLoan.amountCUP * resolveExchangeRateForPeriod(1, selectedLoan.currency, cupToMlc, selectedLoan.exchangeRateTable)
                    : selectedLoan.amountCUP
                )} CUP{selectedLoan.currency && selectedLoan.currency !== 'CUP' ? ` (${selectedLoan.amountCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })} ${selectedLoan.currency})` : ''}</Badge>
                <Badge>{'Tasa'}: {(selectedLoan.annualRate * 100).toFixed(2)}%</Badge>
                <Badge>{'Plazo'}: {selectedLoan.termMonths} meses</Badge>
                <Badge className={selectedLoan.capitalizableInterest ? 'bg-warning-muted text-warning' : ''}>
                  {'Interés: '}{selectedLoan.capitalizableInterest ? 'Capitalizable' : 'No Capitalizable'}
                </Badge>
                {selectedLoan.disbursementSchedule && selectedLoan.disbursementSchedule.length > 1 && (
                  <Badge variant="secondary">{'Desembolso por meses'}</Badge>
                )}
                <Badge>{'Gastos Bancarios'}: {(bankFeeRate * 100).toFixed(2)}% ({'comisión sobre desembolso'})</Badge>
              </div>
              <ScrollableTable maxHeight="450px" stickyColumns={1}>
                <Table className="text-nowrap">
                  <TableHeader>
                    <TableRow className="fin-row-hover">
                      <TableHead className="fin-col-header text-center" style={{ width: 40 }}>{'Per.'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 95 }}>{'Saldo Inicial'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 80 }}>{'Desembolso'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 80 }}>{'Interés'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 80 }}>{'Int. Cap.'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 80 }}>{'Gasto Banc.'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 100 }}>{'Cuota'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 90 }}>{'Capital'}</TableHead>
                      <TableHead className="fin-col-header text-right" style={{ minWidth: 95 }}>{'Saldo Final'}</TableHead>
                      <TableHead className="fin-col-header text-center" style={{ width: 48 }}>{'Gracia'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortData.map((row) => (
                      <TableRow key={row.period} className={row.isGrace ? (row.capitalizedInterest > 0 ? 'bg-warning-muted/50' : 'bg-warning-muted/40') : undefined}>
                        <TableCell className="text-fin-sm text-center font-medium">{row.period}</TableCell>
                        <TableCell className="text-fin-sm text-right">{row.beginningBalance.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right text-success">{(row.disbursementAmount || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right text-warning">{(row.interest - (row.capitalizedInterest || 0)).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right text-warning">{(row.capitalizedInterest || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right text-panel-b">{(row.bankFee || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right font-medium">{row.payment.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right text-info">{row.principal.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-right">{row.endingBalance.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                        <TableCell className="text-fin-sm text-center">
                          {row.isGrace
                            ? (row.capitalizedInterest > 0 ? 'Cap.' : 'Paga')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'Confirmar Eliminación'}</AlertDialogTitle>
            <AlertDialogDescription>{'¿Está seguro de que desea eliminar este préstamo? Esta acción no se puede deshacer.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTargetId) { deleteLoan(deleteTargetId); toast.success('Préstamo eliminado'); setDeleteTargetId(null); setDeleteDialogOpen(false); } }} className="bg-destructive hover:bg-destructive/90">{'Eliminar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
