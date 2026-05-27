'use client';

import { useState, useMemo } from 'react';
import { useBaraproStore, type ResourceItem } from '@/lib/barapro-store';
import { calcWorkerContributions } from '@/lib/barapro-financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp, CalendarCheck, CalendarRange, Calendar, List, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
interface SalarySubModuleProps {
  title: string;
  description: string;
  items: ResourceItem[];
  onAdd: (item: Omit<ResourceItem, 'id'>) => void;
  onUpdate: (id: string, data: Partial<ResourceItem>) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES = ['Directivo', 'Técnico', 'Administrativo', 'Obrero', 'Servicio'];

interface SalaryFormState {
  name: string;
  position: string;
  category: string;
  monthlySalaryCUP: string;
  monthlySalaryMLC: string;
  quantity: string;
  months: number[];
  includesSocialSecurity: boolean;
  includesWorkforceTax: boolean;
}

const defaultForm = (): SalaryFormState => ({
  name: '',
  position: '',
  category: 'Obrero',
  monthlySalaryCUP: '',
  monthlySalaryMLC: '',
  quantity: '1',
  months: [],
  includesSocialSecurity: true,
  includesWorkforceTax: true,
});

type SummaryView = 'summary' | 'monthly' | 'annual';

interface PeriodRow {
  salaryCUP: number;
  salaryMLC: number;
  quantity: number;
  vacationAmount: number;
  salaryTotal: number;
  employerSS: number;
  employerITF: number;
  workerIIP: number;
  workerSS: number;
  totalCompanyCost: number;
}

export function SalarySubModule({
  title,
  description,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: SalarySubModuleProps) {
  const { project, parameters } = useBaraproStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<SalaryFormState>(defaultForm());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summaryView, setSummaryView] = useState<SummaryView>('summary');

  const duration = project.monthsDuration || 120;

  const itemCalculations = useMemo(() => {
    const cupToMlc = project.exchangeRates?.cupToMlc || 300;
    const params = {
      vacationNormRate: parameters.vacationNormRate || 0,
      specialSocialSecurityRate: parameters.specialSocialSecurityRate || 0,
      taxOnWorkforceRate: parameters.taxOnWorkforceRate || 0,
      personalIncomeTaxExemptMin: parameters.personalIncomeTaxExemptMin || 0,
      personalIncomeTaxRate: parameters.personalIncomeTaxRate || 0,
      workerSocialSecurityRate: parameters.workerSocialSecurityRate || 0,
    };
    return items.map((item) => calcWorkerContributions(
      item.monthlySalaryCUP || 0,
      item.monthlySalaryMLC || 0,
      item.quantity || 1,
      cupToMlc,
      item.includesSocialSecurity !== false,
      item.includesWorkforceTax !== false,
      params,
    ));
  }, [items, parameters, project.exchangeRates?.cupToMlc]);

  // Per-month totals across all active workers
  const monthlyData = useMemo((): PeriodRow[] => {
    const rows: PeriodRow[] = [];
    for (let m = 1; m <= duration; m++) {
      let salaryCUP = 0, salaryMLC = 0, quantity = 0, vacationAmount = 0;
      let salaryTotal = 0, employerSS = 0, employerITF = 0, workerIIP = 0, workerSS = 0, totalCompanyCost = 0;
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if ((item.months || []).includes(m)) {
          const c = itemCalculations[idx];
          salaryCUP += item.monthlySalaryCUP * item.quantity;
          salaryMLC += item.monthlySalaryMLC * item.quantity;
          quantity += item.quantity;
          salaryTotal += c.salaryTotal;
          vacationAmount += c.salaryTotal - c.salaryMonthly;
          employerSS += c.employerSS;
          employerITF += c.employerITF;
          workerIIP += c.workerIIP;
          workerSS += c.workerSS;
          totalCompanyCost += c.totalCompanyCost;
        }
      }
      rows.push({ salaryCUP, salaryMLC, quantity, vacationAmount, salaryTotal, employerSS, employerITF, workerIIP, workerSS, totalCompanyCost });
    }
    return rows;
  }, [items, itemCalculations, duration]);

  // Per-year totals
  const yearsCount = Math.ceil(duration / 12);
  const annualData = useMemo((): PeriodRow[] => {
    return Array.from({ length: yearsCount }, (_, y) => {
      const start = y * 12;
      const end = Math.min(start + 12, duration);
      const r: PeriodRow = { salaryCUP: 0, salaryMLC: 0, quantity: 0, vacationAmount: 0, salaryTotal: 0, employerSS: 0, employerITF: 0, workerIIP: 0, workerSS: 0, totalCompanyCost: 0 };
      for (let m = start; m < end; m++) {
        const d = monthlyData[m];
        r.salaryCUP += d.salaryCUP;
        r.salaryMLC += d.salaryMLC;
        r.quantity = Math.max(r.quantity, d.quantity);
        r.vacationAmount += d.vacationAmount;
        r.salaryTotal += d.salaryTotal;
        r.employerSS += d.employerSS;
        r.employerITF += d.employerITF;
        r.workerIIP += d.workerIIP;
        r.workerSS += d.workerSS;
        r.totalCompanyCost += d.totalCompanyCost;
      }
      return r;
    });
  }, [monthlyData, yearsCount, duration]);

  // Summary totals
  const totalsMonthly = useMemo(() => itemCalculations.reduce((a, c) => ({
    salaryTotal: a.salaryTotal + c.salaryTotal,
    employerSS: a.employerSS + c.employerSS,
    employerITF: a.employerITF + c.employerITF,
    workerIIP: a.workerIIP + c.workerIIP,
    workerSS: a.workerSS + c.workerSS,
    totalCompanyCost: a.totalCompanyCost + c.totalCompanyCost,
    salaryMonthly: a.salaryMonthly + c.salaryMonthly,
    vacationAmount: a.vacationAmount + (c.salaryTotal - c.salaryMonthly),
  }), { salaryTotal: 0, employerSS: 0, employerITF: 0, workerIIP: 0, workerSS: 0, totalCompanyCost: 0, salaryMonthly: 0, vacationAmount: 0 }), [itemCalculations]);

  const totalsAnnual = useMemo(() => items.reduce((a, item, idx) => {
    const c = itemCalculations[idx];
    const m = (item.months || []).length || 1;
    return {
      salaryTotal: a.salaryTotal + c.salaryTotal * m,
      employerSS: a.employerSS + c.employerSS * m,
      employerITF: a.employerITF + c.employerITF * m,
      workerIIP: a.workerIIP + c.workerIIP * m,
      workerSS: a.workerSS + c.workerSS * m,
      totalCompanyCost: a.totalCompanyCost + c.totalCompanyCost * m,
      salaryMonthly: a.salaryMonthly + c.salaryMonthly * m,
      vacationAmount: a.vacationAmount + (c.salaryTotal - c.salaryMonthly) * m,
    };
  }, { salaryTotal: 0, employerSS: 0, employerITF: 0, workerIIP: 0, workerSS: 0, totalCompanyCost: 0, salaryMonthly: 0, vacationAmount: 0 }), [items, itemCalculations]);

  const isAnnual = summaryView === 'annual';
  const totals = isAnnual ? totalsAnnual : totalsMonthly;

  const handleNew = () => { setForm(defaultForm()); setSelectedMonths([]); setEditingId(null); setOpen(true); };
  const handleEdit = (item: ResourceItem) => {
    const safeMonths = Array.isArray(item.months) ? item.months : [];
    setForm({ name: item.name, position: item.position, category: item.category,
      monthlySalaryCUP: item.monthlySalaryCUP !== 0 ? String(item.monthlySalaryCUP) : '0',
      monthlySalaryMLC: item.monthlySalaryMLC !== 0 ? String(item.monthlySalaryMLC) : '0',
      quantity: item.quantity !== 1 ? String(item.quantity) : '1',
      months: [...safeMonths], includesSocialSecurity: item.includesSocialSecurity, includesWorkforceTax: item.includesWorkforceTax });
    setSelectedMonths([...safeMonths]); setEditingId(item.id); setOpen(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    const data: Omit<ResourceItem, 'id'> = {
      name: form.name, position: form.position, category: form.category,
      monthlySalaryCUP: parseFloat(form.monthlySalaryCUP) || 0, monthlySalaryMLC: parseFloat(form.monthlySalaryMLC) || 0,
      quantity: parseInt(form.quantity) || 1, months: selectedMonths,
      includesSocialSecurity: form.includesSocialSecurity, includesWorkforceTax: form.includesWorkforceTax,
    };
    if (editingId) { onUpdate(editingId, data); toast.success('Salario actualizado correctamente'); }
    else { onAdd(data); toast.success('Trabajador agregado correctamente'); }
    setOpen(false);
  };
  const confirmDelete = (id: string) => { setDeleteTargetId(id); setDeleteDialogOpen(true); };
  const handleDelete = () => { if (deleteTargetId) { onDelete(deleteTargetId); toast.success('Trabajador eliminado correctamente'); setDeleteTargetId(null); setDeleteDialogOpen(false); } };
  const toggleMonth = (m: number) => setSelectedMonths((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b));
  const selectAllMonths = () => setSelectedMonths(Array.from({ length: duration }, (_, i) => i + 1));
  const clearAllMonths = () => setSelectedMonths([]);

  const fmt = (n: number) => n.toLocaleString('es-CU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const totalMonthlyCUP = items.reduce((s, i) => s + i.monthlySalaryCUP * i.quantity, 0);
  const totalMonthlyMLC = items.reduce((s, i) => s + i.monthlySalaryMLC * i.quantity, 0);
  const ML = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Concept definitions (same as summary table columns)
  const concepts = [
    { key: 'salaryCUP', label: 'Sal. Mensual CUP', bold: false },
    { key: 'salaryMLC', label: 'Sal. Mensual MLC', bold: false },
    { key: 'quantity', label: 'Cant.', bold: false },
    { key: 'vacationAmount', label: 'Vacaciones', bold: false },
    { key: 'salaryTotal', label: 'Salario Total', bold: true },
    { key: 'employerSS', label: 'Contrib. SS', bold: false },
    { key: 'employerITF', label: 'Imp. F. Trabajo', bold: false },
    { key: 'workerIIP', label: 'IIP', bold: false },
    { key: 'workerSS', label: 'Contrib. Trab. SS', bold: false },
    { key: 'totalCompanyCost', label: 'Costo Total', bold: true },
  ] as const;

  const gv = (r: PeriodRow, k: string): number => (r as any)[k] ?? 0;
  const sf = (tl: PeriodRow[], k: string): number => tl.reduce((s, r) => s + gv(r, k), 0);

  const viewBtns: { key: SummaryView; label: string; icon: React.ElementType }[] = [
    { key: 'summary', label: 'Resumen', icon: List },
    { key: 'monthly', label: 'Mensual', icon: Calendar },
    { key: 'annual', label: 'Anual', icon: CalendarRange },
  ];

  // Cell renderer for a concept value
  const renderCell = (r: PeriodRow, k: string) => {
    if (k === 'quantity') return r.quantity > 0 ? String(r.quantity) : '\u2014';
    return fmt(gv(r, k));
  };

  return (
    <div className="glass-card rounded-xl shadow-card-md border-l-4 border-l-primary animate-slide-up">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-fin-lg font-semibold truncate">{title}</h2>
              <p className="text-fin-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <Button onClick={handleNew} size="sm" className="gap-1.5 focus-ring transition-all duration-200">
            <Plus className="h-3.5 w-3.5" />{'Agregar Trabajador'}
          </Button>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex gap-3 flex-wrap mb-3">
          <Badge variant="outline" className="text-fin-xs">{items.length} {'trabajadores'}</Badge>
          <Badge variant="outline" className="text-fin-xs">{'Salario CUP'}: {totalMonthlyCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}{'/mes'}</Badge>
          <Badge variant="outline" className="text-fin-xs">{'Salario MLC'}: {totalMonthlyMLC.toLocaleString('es-CU', { maximumFractionDigits: 1 })}{'/mes'}</Badge>
        </div>

        {items.length > 0 ? (
          <ScrollableTable maxHeight="300px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow className="fin-col-header">
                  <TableHead className="text-fin-xs">{'Nombre'}</TableHead>
                  <TableHead className="text-fin-xs">{'Cargo'}</TableHead>
                  <TableHead className="text-fin-xs">{'Categoría'}</TableHead>
                  <TableHead className="text-fin-xs text-right">{'CUP/mes'}</TableHead>
                  <TableHead className="text-fin-xs text-right">{'MLC/mes'}</TableHead>
                  <TableHead className="text-fin-xs text-center">{'Cant.'}</TableHead>
                  <TableHead className="text-fin-xs">{'Meses'}</TableHead>
                  <TableHead className="text-fin-xs w-[80px]">{'Acc.'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="fin-row-hover">
                    <TableCell className="text-fin-sm">{item.name}</TableCell>
                    <TableCell className="text-fin-sm">{item.position || '\u2014'}</TableCell>
                    <TableCell className="text-fin-sm">{item.category}</TableCell>
                    <TableCell className="text-fin-sm text-right font-medium">{(item.monthlySalaryCUP * item.quantity).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                    <TableCell className="text-fin-sm text-right">{(item.monthlySalaryMLC * item.quantity).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                    <TableCell className="text-fin-sm text-center">{item.quantity}</TableCell>
                    <TableCell className="text-fin-sm">
                      <div className="flex flex-wrap gap-0.5 max-w-[120px]">
                        {(item.months || []).length > 0 ? (
                          <><Badge variant="secondary" className="text-fin-xs px-1">{item.months[0]}</Badge>
                          {(item.months || []).length > 1 && <Badge variant="secondary" className="text-fin-xs px-1">...{item.months[item.months.length - 1]}</Badge>}</>
                        ) : <span className="text-muted-foreground text-fin-xs">\u2014</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 focus-ring transition-all duration-200" onClick={() => handleEdit(item)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive focus-ring transition-all duration-200" onClick={() => confirmDelete(item.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        ) : (
          <p className="text-fin-xs text-muted-foreground text-center py-4">{'No hay personal asignado. Haga clic en Agregar Trabajador.'}</p>
        )}

        {/* ============ THREE VIEWS: Resumen / Mensual / Anual ============ */}
        {items.length > 0 && (
          <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between p-1 h-8 focus-ring transition-all duration-200">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-fin-xs font-semibold text-primary">{'Tabla Resumen de Contribuciones Salariales'}</span>
                  <div className="flex rounded-md border border-primary/30 overflow-hidden ml-2">
                    {viewBtns.map((vb) => {
                      const Ic = vb.icon;
                      return (
                        <span key={vb.key} role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setSummaryView(vb.key); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSummaryView(vb.key); } }}
                          className={`flex items-center gap-1 px-2 py-0.5 text-fin-xs font-medium transition-colors cursor-pointer ${summaryView === vb.key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
                          <Ic className="h-2.5 w-2.5" />{vb.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {summaryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* ========== RESUMEN VIEW ========== */}
              {summaryView === 'summary' && (
                <div className="mt-2 border border-border/50 rounded-xl overflow-hidden">
                  <ScrollableTable maxHeight="400px" stickyColumns={1}>
                    <Table>
                      <TableHeader>
                        <TableRow className="fin-col-header">
                          <TableHead className="text-fin-xs font-bold">{'Nombre'}</TableHead>
                          <TableHead className="text-fin-xs font-bold">{'Cargo'}</TableHead>
                          <TableHead className="text-fin-xs font-bold">{'Categoría'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Sal. Mensual CUP'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Sal. Mensual MLC'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-center">{'Cant.'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-center">{'Meses'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Vacaciones'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Salario Total'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Contrib. SS'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Imp. F. Trabajo'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'IIP'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Contrib. Trab. SS'}</TableHead>
                          <TableHead className="text-fin-xs font-bold text-right">{'Costo Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => {
                          const c = itemCalculations[idx];
                          const ma = (item.months || []).length;
                          const mu = isAnnual ? ma : 1;
                          return (
                            <TableRow key={item.id} className="fin-row-hover">
                              <TableCell className="text-fin-xs font-medium">{item.name}</TableCell>
                              <TableCell className="text-fin-xs">{item.position || '\u2014'}</TableCell>
                              <TableCell className="text-fin-xs">{item.category}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(item.monthlySalaryCUP * (isAnnual ? mu : 1))}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(item.monthlySalaryMLC * (isAnnual ? mu : 1))}</TableCell>
                              <TableCell className="text-fin-xs text-center">{item.quantity}</TableCell>
                              <TableCell className="text-fin-xs text-center">{ma}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt((c.salaryTotal - c.salaryMonthly) * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right font-semibold">{fmt(c.salaryTotal * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(c.employerSS * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(c.employerITF * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(c.workerIIP * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right">{fmt(c.workerSS * mu)}</TableCell>
                              <TableCell className="text-fin-xs text-right font-semibold">{fmt(c.totalCompanyCost * mu)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="fin-table-total">
                          <TableCell className="text-fin-xs" colSpan={3}>{'TOTALES'}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(isAnnual ? items.reduce((s, i) => s + i.monthlySalaryCUP * ((i.months || []).length), 0) : items.reduce((s, i) => s + i.monthlySalaryCUP, 0))}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(isAnnual ? items.reduce((s, i) => s + i.monthlySalaryMLC * ((i.months || []).length), 0) : items.reduce((s, i) => s + i.monthlySalaryMLC, 0))}</TableCell>
                          <TableCell className="text-fin-xs text-right">{items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{'\u2014'}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.vacationAmount)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.salaryTotal)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.employerSS)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.employerITF)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.workerIIP)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.workerSS)}</TableCell>
                          <TableCell className="text-fin-xs text-right">{fmt(totals.totalCompanyCost)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                </div>
              )}

              {/* ========== MENSUAL VIEW: concepts vertical, months horizontal by year ========== */}
              {summaryView === 'monthly' && (
                <div className="mt-2 border border-border/50 rounded-xl overflow-hidden">
                  <ScrollableTable maxHeight="500px" stickyColumns={1}>
                    <Table>
                      <TableHeader>
                        <TableRow className="fin-col-header">
                          <TableHead className="text-fin-xs font-bold min-w-[130px]">{'Concepto'}</TableHead>
                          {Array.from({ length: yearsCount }, (_, y) => {
                            const n = Math.min(12, duration - y * 12);
                            return <TableHead key={y} className="text-fin-xs font-bold text-center fin-col-header-year" colSpan={n}>{'Año'} {y + 1}</TableHead>;
                          })}
                          <TableHead className="text-fin-xs font-bold text-right min-w-[100px] fin-col-header-total">{'TOTALES'}</TableHead>
                        </TableRow>
                        <TableRow className="fin-col-header">
                          <TableHead className="text-fin-xs min-w-[130px]"></TableHead>
                          {Array.from({ length: duration }, (_, i) => (
                            <TableHead key={i} className="text-fin-xs text-center px-0.5 min-w-[68px] fin-col-header-month">{ML[i % 12]}</TableHead>
                          ))}
                          <TableHead className="text-fin-xs min-w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {concepts.map((cr) => (
                          <TableRow key={cr.key} className={`${cr.bold ? 'font-semibold' : ''} fin-row-hover`}>
                            <TableCell className="text-fin-xs font-medium">{cr.label}</TableCell>
                            {monthlyData.map((r, i) => (
                              <TableCell key={i} className="text-fin-xs text-right px-0.5">{renderCell(r, cr.key)}</TableCell>
                            ))}
                            <TableCell className="text-fin-xs text-right px-1 fin-table-total font-semibold">
                              {cr.key === 'quantity' ? '\u2014' : fmt(sf(monthlyData, cr.key))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                </div>
              )}

              {/* ========== ANUAL VIEW: concepts vertical, years horizontal ========== */}
              {summaryView === 'annual' && (
                <div className="mt-2 border border-border/50 rounded-xl overflow-hidden">
                  <ScrollableTable maxHeight="500px" stickyColumns={1}>
                    <Table>
                      <TableHeader>
                        <TableRow className="fin-col-header">
                          <TableHead className="text-fin-xs font-bold min-w-[130px]">{'Concepto'}</TableHead>
                          {Array.from({ length: yearsCount }, (_, y) => (
                            <TableHead key={y} className="text-fin-xs font-bold text-center min-w-[100px] fin-col-header-year">{'Año'} {y + 1}</TableHead>
                          ))}
                          <TableHead className="text-fin-xs font-bold text-right min-w-[110px] fin-col-header-total">{'TOTALES'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {concepts.map((cr) => (
                          <TableRow key={cr.key} className={`${cr.bold ? 'font-semibold' : ''} fin-row-hover`}>
                            <TableCell className="text-fin-xs font-medium">{cr.label}</TableCell>
                            {annualData.map((r, i) => (
                              <TableCell key={i} className="text-fin-xs text-right">{renderCell(r, cr.key)}</TableCell>
                            ))}
                            <TableCell className="text-fin-xs text-right fin-table-total font-semibold">
                              {cr.key === 'quantity' ? '\u2014' : fmt(sf(annualData, cr.key))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTable>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">{'¿Desea eliminar este trabajador?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring transition-all duration-200">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-danger-foreground hover:bg-danger/90 focus-ring-danger transition-all duration-200">{'Eliminar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar' : 'Nuevo'} {'Trabajador'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Nombre'} <span className="text-danger">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={'Nombre del trabajador'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Cargo / Posición'}</Label>
                <Input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} placeholder={'Ej: Operario, Especialista'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Categoría'}</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Salario Mensual CUP'}</Label>
                <Input type="number" value={form.monthlySalaryCUP} onChange={(e) => setForm((p) => ({ ...p, monthlySalaryCUP: e.target.value }))} step="0.01" className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Salario Mensual MLC'}</Label>
                <Input type="number" value={form.monthlySalaryMLC} onChange={(e) => setForm((p) => ({ ...p, monthlySalaryMLC: e.target.value }))} step="0.01" className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Cantidad'}</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} min={1} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
              <div className="flex items-end pb-1 gap-3">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="op-ss"
                    checked={form.includesSocialSecurity}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, includesSocialSecurity: checked === true }))}
                    className="focus-ring"
                  />
                  <Label htmlFor="op-ss" className="text-fin-xs font-medium cursor-pointer">{'Seg. Social'}</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="op-itf"
                    checked={form.includesWorkforceTax}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, includesWorkforceTax: checked === true }))}
                    className="focus-ring"
                  />
                  <Label htmlFor="op-itf" className="text-fin-xs font-medium cursor-pointer">{'Imp. F. Trabajo'}</Label>
                </div>
              </div>
            </div>
            {/* Month selector matrix - toggle in year/month grid */}
            <MonthToggleMatrix
              duration={duration}
              selectedMonths={selectedMonths}
              onToggle={toggleMonth}
              onSelectAll={selectAllMonths}
              onClearAll={clearAllMonths}
              label="Meses de aplicaci\u00f3n"
              showClearYear1
              onClearYear1={() => {
                setSelectedMonths((prev) => prev.filter((m) => m > 12));
                toast.success('A\u00f1o 1 limpiado');
              }}
              onSelectYear={(y) => {
                const startM = y * 12;
                const newMonths = [...selectedMonths];
                for (let i = 0; i < 12; i++) {
                  const m = startM + i + 1;
                  if (m <= duration && !newMonths.includes(m)) newMonths.push(m);
                }
                setSelectedMonths(newMonths.sort((a, b) => a - b));
              }}
              onClearYear={(y) => {
                const startM = y * 12;
                setSelectedMonths((prev) => prev.filter((m) => m < startM + 1 || m > startM + 12));
              }}
              compact
            />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 shrink-0 border-t border-border/50 bg-background">
            <Button variant="outline" onClick={() => setOpen(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
            <Button onClick={handleSave} className="focus-ring transition-all duration-200 shadow-sm">{editingId ? 'Guardar Cambios' : 'Agregar Trabajador'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
