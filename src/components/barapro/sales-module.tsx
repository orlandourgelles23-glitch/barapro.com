'use client';

import { useState, useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { buildRevenueTimeline } from '@/lib/barapro-financial';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, BarChart3, Eraser, Gift, RotateCcw, Globe, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { MonthMatrixInput, MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
import { getMonthLabel } from '@/lib/format';

function formatNum(n: number): string {
  return n.toLocaleString('es-CU', { maximumFractionDigits: 1 });
}

// ═══════════════════════════════════════════════════════
// GENERIC QUANTITY-BASED SUB-MODULE (Subvenciones / Devoluciones)
// ═══════════════════════════════════════════════════════
interface QtySubModuleProps {
  title: string;
  description: string;
  items: any[];
  onAdd: (item: any) => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  accentColor: string; // tailwind color: 'teal', 'red', etc.
  icon: React.ElementType;
  showPrice?: boolean;
}

function QtySubModule({ title, description, items, onAdd, onUpdate, onDelete, accentColor, icon: Icon, showPrice = false }: QtySubModuleProps) {
  const { project } = useBaraproStore();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const dur = project.monthsDuration || 120;

  const [form, setForm] = useState({
    description: '',
    unit: 'Und',
    unitCostCUP: '',
    unitCostMLC: '',
    quantity: Array(dur).fill(0) as number[],
  });

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < dur; i++) {
      labels.push(getMonthLabel(i, project.startDate));
    }
    return labels;
  }, [project.startDate, dur]);

  const handleNew = () => {
    setForm({
      description: '',
      unit: 'Und',
      unitCostCUP: '',
      unitCostMLC: '',
      quantity: Array(dur).fill(0),
    });
    setEditingId(null);
    setEditOpen(true);
  };

  const handleEdit = (item: any) => {
    setForm({
      description: item.description,
      unit: item.unit || 'Und',
      unitCostCUP: item.unitCostCUP !== 0 ? String(item.unitCostCUP) : '0',
      unitCostMLC: item.unitCostMLC !== 0 ? String(item.unitCostMLC) : '0',
      quantity: Array.isArray(item.quantity) ? [...item.quantity] : Array(dur).fill(0),
    });
    setEditingId(item.id);
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    const quantities = [...form.quantity];
    while (quantities.length < dur) quantities.push(0);
    if (quantities.length > dur) quantities.length = dur;
    const months = quantities.map((q, idx) => (q > 0 ? idx + 1 : -1)).filter((m) => m > 0);

    const itemData = {
      description: form.description,
      unit: form.unit,
      unitCostCUP: parseFloat(form.unitCostCUP) || 0,
      unitCostMLC: parseFloat(form.unitCostMLC) || 0,
      quantity: quantities,
      months,
    };
    if (editingId) {
      onUpdate(editingId, itemData);
      toast.success(`${title}: Elemento actualizado correctamente`);
    } else {
      onAdd(itemData);
      toast.success(`${title}: Elemento agregado correctamente`);
    }
    setEditOpen(false);
  };

  const handleQuantityChange = (idx: number, value: string) => {
    setForm((prev) => {
      const newQ = [...prev.quantity];
      newQ[idx] = parseFloat(value) || 0;
      return { ...prev, quantity: newQ };
    });
  };

  const fillAllMonths = (value: number) => {
    setForm((prev) => ({
      ...prev,
      quantity: Array(dur).fill(value) as number[],
    }));
  };

  const totalCUP = items.reduce(
    (s, item) => s + (item.quantity || []).reduce((acc: number, q: number) => acc + q * (item.unitCostCUP || 0), 0), 0
  );
  const totalMLC = items.reduce(
    (s, item) => s + (item.quantity || []).reduce((acc: number, q: number) => acc + q * (item.unitCostMLC || 0), 0), 0
  );

  const btnClass = accentColor === 'teal' ? 'bg-primary hover:bg-primary/90' : accentColor === 'red' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90';
  const textClass = accentColor === 'teal' ? 'text-info' : accentColor === 'red' ? 'text-danger' : 'text-success';

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <Button onClick={handleNew} size="sm" className={` gap-1.5 shadow-sm transition-all duration-200`}>
              <Plus className="h-4 w-4" />
              {'Agregar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline">{items.length} elementos</Badge>
            <Badge variant="outline">Total CUP {formatNum(totalCUP)}</Badge>
            <Badge variant="outline">Total MLC {formatNum(totalMLC)}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {items.length > 0 ? (
        <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollableTable maxHeight="400px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow className="fin-row-hover">
                    <TableHead className="fin-col-header min-w-[180px]">{'Descripción'}</TableHead>
                    <TableHead className="fin-col-header min-w-[80px]">{'Unidad'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[100px]">{'Costo Unit. CUP'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[100px]">{'Costo Unit. MLC'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[110px]">{'Total CUP'}</TableHead>
                    <TableHead className="fin-col-header w-[100px]">{'Acciones'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const total = (item.quantity || []).reduce((s: number, q: number) => s + q * (item.unitCostCUP || 0), 0);
                    return (
                      <TableRow key={item.id || `qty-`} className="fin-row-hover">
                        <TableCell className="text-sm font-medium">{item.description}</TableCell>
                        <TableCell className="text-sm">{item.unit}</TableCell>
                        <TableCell className="text-fin-sm text-right">{formatNum(item.unitCostCUP)}</TableCell>
                        <TableCell className="text-fin-sm text-right">{formatNum(item.unitCostMLC)}</TableCell>
                        <TableCell className="text-fin-sm text-right font-semibold">{formatNum(total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTargetId(item.id); setDeleteOpen(true); }}>
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
            <p className="text-muted-foreground text-sm">{'No hay elementos registrados. Haga clic en Agregar.'}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription>{'¿Desea eliminar este elemento?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTargetId) { onDelete(deleteTargetId); toast.success('Elemento eliminado correctamente'); setDeleteTargetId(null); } }} className="bg-danger text-danger-foreground hover:bg-danger/90">
              {'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit/Add Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar' : 'Nuevo'} {'Elemento'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Descripción'} *</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={'Descripción del elemento'} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Unidad'}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder={'Und'} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Costo Unitario CUP'}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.unitCostCUP} onChange={(e) => setForm((p) => ({ ...p, unitCostCUP: e.target.value }))} step="0.01" placeholder="0.00" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Costo Unitario MLC'}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.unitCostMLC} onChange={(e) => setForm((p) => ({ ...p, unitCostMLC: e.target.value }))} step="0.01" placeholder="0.00" />
                </div>
              </div>
              {/* Monthly quantities - matrix format */}
              <MonthMatrixInput
                duration={dur}
                values={form.quantity}
                onChange={handleQuantityChange}
                onFillAll={fillAllMonths}
                label="Cantidades mensuales"
                step="1"
                showClearYear1
                onClearYear1={() => {
                  setForm((prev) => {
                    const next = [...prev.quantity];
                    for (let i = 0; i < 12 && i < dur; i++) next[i] = 0;
                    return { ...prev, quantity: next };
                  });
                  toast.success('A\u00f1o 1 limpiado');
                }}
                compact
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{'Cancelar'}</Button>
            <Button onClick={handleSave} className={btnClass}>
              {editingId ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OTROS INGRESOS SUB-MODULE
// ═══════════════════════════════════════════════════════
function OtherIncomeSection() {
  const {
    otherIncomeItems, addOtherIncomeItem, updateOtherIncomeItem, deleteOtherIncomeItem,
    project,
  } = useBaraproStore();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: '',
    amountCUP: '',
    amountMLC: '',
    months: [] as number[],
  });

  const dur = project.monthsDuration || 120;
  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < dur; i++) {
      labels.push(getMonthLabel(i, project.startDate));
    }
    return labels;
  }, [project.startDate, dur]);

  const handleNew = () => {
    setForm({ description: '', amountCUP: '', amountMLC: '', months: [] });
    setEditingId(null);
    setEditOpen(true);
  };

  const handleEdit = (item: any) => {
    setForm({
      description: item.description,
      amountCUP: item.amountCUP !== 0 ? String(item.amountCUP) : '0',
      amountMLC: item.amountMLC !== 0 ? String(item.amountMLC) : '0',
      months: Array.isArray(item.months) ? [...item.months] : [],
    });
    setEditingId(item.id);
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    const itemData = {
      description: form.description,
      amountCUP: parseFloat(form.amountCUP) || 0,
      amountMLC: parseFloat(form.amountMLC) || 0,
      months: form.months,
    };
    if (editingId) {
      updateOtherIncomeItem(editingId, itemData);
      toast.success('Otro ingreso actualizado correctamente');
    } else {
      addOtherIncomeItem(itemData);
      toast.success('Otro ingreso agregado correctamente');
    }
    setEditOpen(false);
  };

  const toggleMonth = (m: number) => {
    setForm((prev) => {
      const months = [...prev.months];
      const idx = months.indexOf(m);
      if (idx >= 0) months.splice(idx, 1);
      else months.push(m);
      months.sort((a, b) => a - b);
      return { ...prev, months };
    });
  };

  const fillAllMonths = () => {
    setForm((prev) => ({
      ...prev,
      months: Array.from({ length: dur }, (_, i) => i + 1),
    }));
  };

  const clearAllMonths = () => {
    setForm((prev) => ({ ...prev, months: [] }));
  };

  const totalOtherCUP = otherIncomeItems.reduce(
    (s, item) => s + item.amountCUP * (item.months || []).length, 0
  );
  const totalOtherMLC = otherIncomeItems.reduce(
    (s, item) => s + item.amountMLC * (item.months || []).length, 0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{'Otros Ingresos'}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {'Registre los ingresos no operacionales del proyecto (subsidios, alquileres, servicios, etc.)'}
              </p>
            </div>
            <Button onClick={handleNew} size="sm" className="bg-primary hover:bg-primary/90 gap-1.5">
              <Plus className="h-4 w-4" />
              {'Agregar Otro Ingreso'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline">{otherIncomeItems.length} elementos</Badge>
            <Badge variant="outline">CUP {formatNum(totalOtherCUP)}</Badge>
            <Badge variant="outline">MLC {formatNum(totalOtherMLC)}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {otherIncomeItems.length > 0 ? (
        <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollableTable maxHeight="400px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow className="fin-row-hover">
                    <TableHead className="fin-col-header min-w-[180px]">{'Descripción'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[100px]">{'Monto Mensual CUP'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[100px]">{'Monto Mensual MLC'}</TableHead>
                    <TableHead className="fin-col-header text-center min-w-[80px]">{'Meses Activos'}</TableHead>
                    <TableHead className="fin-col-header text-right min-w-[110px]">{'Total CUP'}</TableHead>
                    <TableHead className="fin-col-header w-[100px]">{'Acciones'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherIncomeItems.map((item, idx) => {
                    const total = item.amountCUP * (item.months || []).length;
                    return (
                      <TableRow key={item.id || `other-income-`} className="fin-row-hover">
                        <TableCell className="text-sm font-medium">{item.description}</TableCell>
                        <TableCell className="text-sm text-right">{formatNum(item.amountCUP)}</TableCell>
                        <TableCell className="text-sm text-right">{formatNum(item.amountMLC)}</TableCell>
                        <TableCell className="text-sm text-center">{(item.months || []).length}</TableCell>
                        <TableCell className="text-sm text-right font-semibold text-info">{formatNum(total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTargetId(item.id); setDeleteOpen(true); }}>
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
            <p className="text-muted-foreground text-sm">{'No hay otros ingresos registrados'}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription>{'¿Desea eliminar este otro ingreso?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTargetId) { deleteOtherIncomeItem(deleteTargetId); toast.success('Otro ingreso eliminado correctamente'); setDeleteTargetId(null); } }} className="bg-danger text-danger-foreground hover:bg-danger/90">
              {'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit/Add Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar Otro Ingreso' : 'Nuevo'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Descripción'} *</Label>
                <Input className="h-8 text-fin-sm focus-ring transition-all duration-200"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder={'Ej: Alquiler de equipos, Subsidio, Servicios técnicos'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Monto Mensual CUP'}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.amountCUP} onChange={(e) => setForm((p) => ({ ...p, amountCUP: e.target.value }))} step="0.01" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{'Monto Mensual MLC'}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.amountMLC} onChange={(e) => setForm((p) => ({ ...p, amountMLC: e.target.value }))} step="0.01" />
                </div>
              </div>

              {/* Month selector - matrix toggle format */}
              <MonthToggleMatrix
                duration={dur}
                selectedMonths={form.months}
                onToggle={toggleMonth}
                onSelectAll={fillAllMonths}
                onClearAll={clearAllMonths}
                label="Meses Activos"
                onSelectYear={(y) => { const startM = y * 12; const newMonths = [...form.months]; for (let i = 0; i < 12; i++) { const m = startM + i + 1; if (m <= dur && !newMonths.includes(m)) newMonths.push(m); } setForm((prev) => ({ ...prev, months: newMonths.sort((a, b) => a - b) })); }}
                onClearYear={(y) => { const startM = y * 12; setForm((prev) => ({ ...prev, months: prev.months.filter((m) => m < startM + 1 || m > startM + 12) })); }}
                compact
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{'Cancelar'}</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ANNUAL SUMMARY
// ═══════════════════════════════════════════════════════
function AnnualSummary() {
  const store = useBaraproStore();
  const duration = store.project.monthsDuration || 120;
  const cupToMlc = store.project.exchangeRates.cupToMlc;
  const salesTaxRate = store.parameters.salesTaxRate || 0;

  const revenueTimeline = useMemo(() => buildRevenueTimeline(store), [store]);

  // Build other income monthly array
  const otherIncomeMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.otherIncomeItems) {
      const monthlyCUP = item.amountCUP || 0;
      const monthlyMLC = (item.amountMLC || 0) * cupToMlc;
      for (const m of (Array.isArray(item.months) ? item.months : [])) {
        if (m >= 1 && m <= duration) {
          arr[m - 1] += monthlyCUP + monthlyMLC;
        }
      }
    }
    return arr;
  }, [store.otherIncomeItems, duration, cupToMlc]);

  // Build subventions monthly array
  const subventionMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.subventionItems) {
      const quantities = Array.isArray(item.quantity) ? item.quantity : [];
      for (let m = 0; m < duration; m++) {
        const q = quantities[m] || 0;
        if (q > 0) {
          arr[m] += q * (item.unitCostCUP || 0) + q * (item.unitCostMLC || 0) * cupToMlc;
        }
      }
    }
    return arr;
  }, [store.subventionItems, duration, cupToMlc]);

  // Build sales returns monthly array
  const salesReturnMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.salesReturnItems) {
      const quantities = Array.isArray(item.quantity) ? item.quantity : [];
      for (let m = 0; m < duration; m++) {
        const q = quantities[m] || 0;
        if (q > 0) {
          arr[m] += q * (item.unitCostCUP || 0) + q * (item.unitCostMLC || 0) * cupToMlc;
        }
      }
    }
    return arr;
  }, [store.salesReturnItems, duration, cupToMlc]);

  const numYears = Math.ceil(duration / 12);

  const yearlyData = useMemo(() => {
    const rows: {
      year: number;
      salesCUP: number;
      salesMLC: number;
      ventasBrutas: number;
      ventasNetas: number;
      subvenciones: number;
      devoluciones: number;
      otherIncome: number;
      totalIncome: number;
    }[] = [];

    let cumulative = 0;
    for (let y = 0; y < numYears; y++) {
      let salesCUP = 0, salesMLC = 0, other = 0, subv = 0, devol = 0;
      for (let m = 0; m < 12; m++) {
        const idx = y * 12 + m;
        if (idx >= duration) break;
        salesCUP += revenueTimeline[idx]?.cup || 0;
        salesMLC += revenueTimeline[idx]?.mlc || 0;
        other += otherIncomeMonthly[idx] || 0;
        subv += subventionMonthly[idx] || 0;
        devol += salesReturnMonthly[idx] || 0;
      }
      const ventasBrutas = salesCUP + salesMLC * cupToMlc;
      const ventasNetas = ventasBrutas * (1 - salesTaxRate);
      const totalIncome = ventasNetas + other + subv - devol;
      cumulative += totalIncome;
      rows.push({ year: y + 1, salesCUP, salesMLC, ventasBrutas, ventasNetas, subvenciones: subv, devoluciones: devol, otherIncome: other, totalIncome });
    }
    return { rows, totalCumulative: cumulative };
  }, [revenueTimeline, otherIncomeMonthly, subventionMonthly, salesReturnMonthly, numYears, duration, cupToMlc, salesTaxRate]);

  // Compute column totals
  const totalVentasNetas = yearlyData.rows.reduce((s, r) => s + r.ventasNetas, 0);
  const totalSubvenciones = yearlyData.rows.reduce((s, r) => s + r.subvenciones, 0);
  const totalDevoluciones = yearlyData.rows.reduce((s, r) => s + r.devoluciones, 0);
  const totalOtrosIngresos = yearlyData.rows.reduce((s, r) => s + r.otherIncome, 0);
  const totalGeneral = yearlyData.totalCumulative;

  return (
    <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-info" />
          {'Resumen Anual de Ingresos'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollableTable maxHeight="500px" stickyColumns={1}>
          <Table>
            <TableHeader>
              <TableRow className="fin-row-hover">
                <TableHead className="fin-col-header min-w-[140px]">Concepto</TableHead>
                {yearlyData.rows.map((row) => (
                  <TableHead key={row.year} className="fin-col-header text-right min-w-[100px]">
                    Año {row.year}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header text-right min-w-[120px] bg-muted/50">Total General</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Ventas Netas row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium">Ventas Netas</TableCell>
                {yearlyData.rows.map((row) => (
                  <TableCell key={row.year} className="text-fin-sm text-right">{formatNum(row.ventasNetas)}</TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold bg-muted/30">{formatNum(totalVentasNetas)}</TableCell>
              </TableRow>
              {/* Subvenciones row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium text-info">Subvenciones</TableCell>
                {yearlyData.rows.map((row) => (
                  <TableCell key={row.year} className="text-fin-sm text-right text-info">{formatNum(row.subvenciones)}</TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold text-info bg-muted/30">{formatNum(totalSubvenciones)}</TableCell>
              </TableRow>
              {/* Devoluciones row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium text-danger">Devoluciones y Rebajas</TableCell>
                {yearlyData.rows.map((row) => (
                  <TableCell key={row.year} className="text-fin-sm text-right text-danger">-{formatNum(row.devoluciones)}</TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold text-danger bg-muted/30">-{formatNum(totalDevoluciones)}</TableCell>
              </TableRow>
              {/* Otros Ingresos row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium">Otros Ingresos</TableCell>
                {yearlyData.rows.map((row) => (
                  <TableCell key={row.year} className="text-fin-sm text-right">{formatNum(row.otherIncome)}</TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold bg-muted/30">{formatNum(totalOtrosIngresos)}</TableCell>
              </TableRow>
              {/* Total row */}
              <TableRow className="font-bold bg-muted/50 fin-table-total">
                <TableCell className="text-fin-sm font-bold">Total Ingresos</TableCell>
                {yearlyData.rows.map((row) => (
                  <TableCell key={row.year} className="text-fin-sm text-right font-bold bg-muted/30">{formatNum(row.totalIncome)}</TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-bold bg-muted/50">{formatNum(totalGeneral)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollableTable>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// MONTHLY SUMMARY
// ═══════════════════════════════════════════════════════
function MonthlySummary() {
  const store = useBaraproStore();
  const duration = store.project.monthsDuration || 120;
  const cupToMlc = store.project.exchangeRates.cupToMlc;
  const salesTaxRate = store.parameters.salesTaxRate || 0;

  const revenueTimeline = useMemo(() => buildRevenueTimeline(store), [store]);

  const otherIncomeMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.otherIncomeItems) {
      const monthlyCUP = item.amountCUP || 0;
      const monthlyMLC = (item.amountMLC || 0) * cupToMlc;
      for (const m of (Array.isArray(item.months) ? item.months : [])) {
        if (m >= 1 && m <= duration) {
          arr[m - 1] += monthlyCUP + monthlyMLC;
        }
      }
    }
    return arr;
  }, [store.otherIncomeItems, duration, cupToMlc]);

  const subventionMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.subventionItems) {
      const quantities = Array.isArray(item.quantity) ? item.quantity : [];
      for (let m = 0; m < duration; m++) {
        const q = quantities[m] || 0;
        if (q > 0) arr[m] += q * (item.unitCostCUP || 0) + q * (item.unitCostMLC || 0) * cupToMlc;
      }
    }
    return arr;
  }, [store.subventionItems, duration, cupToMlc]);

  const salesReturnMonthly = useMemo(() => {
    const arr = new Array(duration).fill(0) as number[];
    for (const item of store.salesReturnItems) {
      const quantities = Array.isArray(item.quantity) ? item.quantity : [];
      for (let m = 0; m < duration; m++) {
        const q = quantities[m] || 0;
        if (q > 0) arr[m] += q * (item.unitCostCUP || 0) + q * (item.unitCostMLC || 0) * cupToMlc;
      }
    }
    return arr;
  }, [store.salesReturnItems, duration, cupToMlc]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: duration }, (_, i) => {
      const gross = (revenueTimeline[i]?.cup || 0) + (revenueTimeline[i]?.mlc || 0) * cupToMlc;
      const salesNet = gross * (1 - salesTaxRate);
      const other = otherIncomeMonthly[i] || 0;
      const subv = subventionMonthly[i] || 0;
      const devol = salesReturnMonthly[i] || 0;
      const total = salesNet + other + subv - devol;
      return { month: i + 1, salesNet, subv, devol, other, total };
    });
  }, [revenueTimeline, otherIncomeMonthly, subventionMonthly, salesReturnMonthly, duration, cupToMlc, salesTaxRate]);

  return (
    <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          {'Resumen Mensual General de Ingresos'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollableTable maxHeight="500px" stickyColumns={1}>
          <Table>
            <TableHeader>
              <TableRow className="fin-row-hover">
                <TableHead className="fin-col-header min-w-[140px]">Concepto</TableHead>
                {monthlyData.map((row) => (
                  <TableHead key={row.month} className={`fin-col-header text-right min-w-[90px] ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {getMonthLabel(row.month - 1, store.project.startDate)}
                  </TableHead>
                ))}
                <TableHead className="fin-col-header text-right min-w-[110px] bg-muted/50">Total General</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Ventas Netas row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium">Ventas Netas</TableCell>
                {monthlyData.map((row) => (
                  <TableCell key={row.month} className={`text-fin-sm text-right ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {row.salesNet > 0 ? formatNum(row.salesNet) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold bg-muted/30">{formatNum(monthlyData.reduce((s, r) => s + r.salesNet, 0))}</TableCell>
              </TableRow>
              {/* Subvenciones row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium text-info">Subvenciones</TableCell>
                {monthlyData.map((row) => (
                  <TableCell key={row.month} className={`text-fin-sm text-right text-info ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {row.subv > 0 ? formatNum(row.subv) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold text-info bg-muted/30">{formatNum(monthlyData.reduce((s, r) => s + r.subv, 0))}</TableCell>
              </TableRow>
              {/* Devoluciones row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium text-danger">Devoluciones y Rebajas</TableCell>
                {monthlyData.map((row) => (
                  <TableCell key={row.month} className={`text-fin-sm text-right text-danger ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {row.devol > 0 ? `-${formatNum(row.devol)}` : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold text-danger bg-muted/30">-{formatNum(monthlyData.reduce((s, r) => s + r.devol, 0))}</TableCell>
              </TableRow>
              {/* Otros Ingresos row */}
              <TableRow className="fin-row-hover">
                <TableCell className="text-fin-base font-medium">Otros Ingresos</TableCell>
                {monthlyData.map((row) => (
                  <TableCell key={row.month} className={`text-fin-sm text-right ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {row.other > 0 ? formatNum(row.other) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-semibold bg-muted/30">{formatNum(monthlyData.reduce((s, r) => s + r.other, 0))}</TableCell>
              </TableRow>
              {/* Total row */}
              <TableRow className="font-bold bg-muted/50 fin-table-total">
                <TableCell className="text-fin-sm font-bold">Total Ingresos</TableCell>
                {monthlyData.map((row) => (
                  <TableCell key={row.month} className={`text-fin-sm text-right font-bold bg-muted/30 ${(row.month - 1) % 12 === 0 ? 'border-l border-muted' : ''}`}>
                    {row.total > 0 ? formatNum(row.total) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-fin-sm text-right font-bold bg-muted/50">{formatNum(monthlyData.reduce((s, r) => s + r.total, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollableTable>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN INCOME MODULE (formerly SalesModule)
// ═══════════════════════════════════════════════════════
export function SalesModule() {
  const {
    salesItems, addSalesItem, updateSalesItem, deleteSalesItem,
    project, otherIncomeItems, subventionItems, salesReturnItems,
    addSubventionItem, updateSubventionItem, deleteSubventionItem,
    addSalesReturnItem, updateSalesReturnItem, deleteSalesReturnItem,
  } = useBaraproStore();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState({
    product: '',
    unit: 'Und',
    priceCUP: '',
    priceMLC: '',
    unitCostMPCUP: '',
    unitCostMPMLC: '',
    marketType: 'nacional' as 'nacional' | 'exportacion',
    quantity: Array(project.monthsDuration || 120).fill(0) as number[],
  });

  const handleNew = () => {
    setForm({
      product: '',
      unit: 'Und',
      priceCUP: '',
      priceMLC: '',
      unitCostMPCUP: '',
      unitCostMPMLC: '',
      marketType: 'nacional',
      quantity: Array(project.monthsDuration || 120).fill(0),
    });
    setEditingId(null);
    setEditOpen(true);
  };

  const handleEdit = (item: any) => {
    setForm({
      product: item.product,
      unit: item.unit,
      priceCUP: item.priceCUP !== 0 ? String(item.priceCUP) : '0',
      priceMLC: item.priceMLC !== 0 ? String(item.priceMLC) : '0',
      unitCostMPCUP: item.unitCostMPCUP !== 0 ? String(item.unitCostMPCUP) : '0',
      unitCostMPMLC: item.unitCostMPMLC !== 0 ? String(item.unitCostMPMLC) : '0',
      marketType: item.marketType || 'nacional',
      quantity: Array.isArray(item.quantity) ? [...item.quantity] : Array(project.monthsDuration || 120).fill(0),
    });
    setEditingId(item.id);
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.product.trim()) {
      toast.error('El nombre del producto es obligatorio');
      return;
    }
    const dur = project.monthsDuration || 120;
    const quantities = [...form.quantity];
    while (quantities.length < dur) quantities.push(0);
    if (quantities.length > dur) quantities.length = dur;
    const months = quantities.map((q, idx) => (q > 0 ? idx + 1 : -1)).filter((m) => m > 0);
    const itemData = {
      product: form.product,
      unit: form.unit,
      priceCUP: parseFloat(form.priceCUP) || 0,
      priceMLC: parseFloat(form.priceMLC) || 0,
      unitCostMPCUP: parseFloat(form.unitCostMPCUP) || 0,
      unitCostMPMLC: parseFloat(form.unitCostMPMLC) || 0,
      marketType: form.marketType,
      quantity: quantities,
      months,
    };
    if (editingId) {
      updateSalesItem(editingId, itemData);
      toast.success('Producto actualizado correctamente');
    } else {
      addSalesItem(itemData);
      toast.success('Producto agregado correctamente');
    }
    setEditOpen(false);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteTargetId) {
      deleteSalesItem(deleteTargetId);
      toast.success('Producto eliminado correctamente');
      setDeleteTargetId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleQuantityChange = (idx: number, value: string) => {
    setForm((prev) => {
      const newQ = [...prev.quantity];
      newQ[idx] = parseFloat(value) || 0;
      return { ...prev, quantity: newQ };
    });
  };

  const fillAllMonths = (value: number) => {
    setForm((prev) => ({
      ...prev,
      quantity: Array(project.monthsDuration || 120).fill(value) as number[],
    }));
  };

  // Totals por clasificación
  const totalNacionalCUP = salesItems
    .filter((item) => !item.marketType || item.marketType === 'nacional')
    .reduce((sum, item) => sum + (item.quantity || []).reduce((s, q) => s + q * item.priceCUP, 0), 0);
  const totalExportCUP = salesItems
    .filter((item) => item.marketType === 'exportacion')
    .reduce((sum, item) => sum + (item.quantity || []).reduce((s, q) => s + q * item.priceCUP, 0), 0);
  const totalExportMLC = salesItems
    .filter((item) => item.marketType === 'exportacion')
    .reduce((sum, item) => sum + (item.quantity || []).reduce((s, q) => s + q * item.priceMLC, 0), 0);
  const totalRevenueCUP = salesItems.reduce(
    (sum, item) => sum + (item.quantity || []).reduce((s, q) => s + q * item.priceCUP, 0), 0
  );
  const totalRevenueMLC = salesItems.reduce(
    (sum, item) => sum + (item.quantity || []).reduce((s, q) => s + q * item.priceMLC, 0), 0
  );
  const totalSubvCUP = subventionItems.reduce(
    (s, item) => s + (item.quantity || []).reduce((acc: number, q: number) => acc + q * (item.unitCostCUP || 0), 0), 0
  );
  const totalDevCUP = salesReturnItems.reduce(
    (s, item) => s + (item.quantity || []).reduce((acc: number, q: number) => acc + q * (item.unitCostCUP || 0), 0), 0
  );
  const totalOtherCUP = otherIncomeItems.reduce(
    (s, item) => s + item.amountCUP * item.months.length, 0
  );

  const monthsToShow = project.monthsDuration || 120;
  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < monthsToShow; i++) {
      labels.push(getMonthLabel(i, project.startDate));
    }
    return labels;
  }, [project.startDate, monthsToShow]);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Header */}
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="min-w-0">
            <CardTitle className="text-base">{'Ingresos'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {'Registre todos los componentes de ingresos del proyecto'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="py-1.5 px-4">
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline">{salesItems.length} {'productos'}</Badge>
            <Badge variant="outline" className="text-info border-info/20">
              <Building2 className="h-3 w-3 inline mr-1" />{'Mercado Nacional'} {formatNum(totalNacionalCUP)}
            </Badge>
            <Badge variant="outline" className="text-success border-success/20">
              <Globe className="h-3 w-3 inline mr-1" />{'Exportaciones'} {formatNum(totalExportCUP)} / {formatNum(totalExportMLC)} MLC
            </Badge>
            <Badge variant="outline">{'Ventas Totales CUP'} {formatNum(totalRevenueCUP)}</Badge>
            <Badge variant="outline" className="text-info border-info/20">
              {'Subvenciones'} {formatNum(totalSubvCUP)}
            </Badge>
            <Badge variant="outline" className="text-danger border-danger/20">
              {'Devoluciones'} {formatNum(totalDevCUP)}
            </Badge>
            <Badge variant="outline" className="text-warning border-warning/20">
              {'Otros Ingresos'} {formatNum(totalOtherCUP)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="ventas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ventas" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="subvenciones" className="gap-1.5">
            <Gift className="h-3.5 w-3.5" />
            Subvenciones
          </TabsTrigger>
          <TabsTrigger value="devoluciones" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Devoluciones y Rebajas
          </TabsTrigger>
          <TabsTrigger value="otros-ingresos" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            {'Otros Ingresos'}
          </TabsTrigger>
          <TabsTrigger value="resumen-anual" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {'Resumen Anual'}
          </TabsTrigger>
          <TabsTrigger value="resumen-mensual" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {'Resumen Mensual'}
          </TabsTrigger>
        </TabsList>

        {/* TAB: Ventas (CRUD existente) */}
        <TabsContent value="ventas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleNew} size="sm" className="bg-success text-success-foreground hover:bg-success/90 gap-1.5">
              <Plus className="h-4 w-4" />
              {'Agregar Producto'}
            </Button>
          </div>

          {salesItems.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <ScrollableTable maxHeight="300px" stickyColumns={1}>
                  <Table>
                    <TableHeader>
                      <TableRow className="fin-row-hover">
                        <TableHead className="fin-col-header min-w-[160px]">{'Producto'}</TableHead>
                        <TableHead className="fin-col-header min-w-[130px]">{'Mercado'}</TableHead>
                        <TableHead className="fin-col-header min-w-[80px]">{'Unidad'}</TableHead>
                        <TableHead className="fin-col-header text-right min-w-[100px]">{'Precio CUP'}</TableHead>
                        <TableHead className="fin-col-header text-right min-w-[100px]">{'Precio MLC'}</TableHead>
                        <TableHead className="fin-col-header text-right min-w-[110px]">{'Total CUP'}</TableHead>
                        <TableHead className="fin-col-header min-w-[100px]">{'Acciones'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesItems.map((item, idx) => {
                        const totalCup = (item.quantity || []).reduce((s, q) => s + q * item.priceCUP, 0);
                        return (
                          <TableRow key={item.id || `sales-${idx}`}>
                            <TableCell className="text-sm font-medium">{item.product}</TableCell>
                            <TableCell>
                              <Badge variant={item.marketType === 'exportacion' ? 'default' : 'secondary'}
                                className={`text-fin-xs px-1.5 py-0 ${
                                  item.marketType === 'exportacion'
                                    ? 'bg-success-muted text-success hover:bg-success-muted border-success/20'
                                    : 'bg-info-muted text-info hover:bg-info-muted border-info/20'
                                }`}>
                                {item.marketType === 'exportacion' ? 'Exportación' : 'Mercado Nacional'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{item.unit}</TableCell>
                            <TableCell className="text-sm text-right">{formatNum(item.priceCUP)}</TableCell>
                            <TableCell className="text-sm text-right">{formatNum(item.priceMLC)}</TableCell>
                            <TableCell className="text-sm text-right font-semibold">{formatNum(totalCup)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => confirmDelete(item.id)}>
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
                <p className="text-muted-foreground text-sm">{'No hay productos registrados. Haga clic en Agregar Producto.'}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Subvenciones */}
        <TabsContent value="subvenciones">
          <QtySubModule
            title="Subvenciones"
            description="Registre las subvenciones recibidas por el proyecto (sin precio de venta, directo al costo)"
            items={subventionItems}
            onAdd={addSubventionItem}
            onUpdate={updateSubventionItem}
            onDelete={deleteSubventionItem}
            accentColor="teal"
            icon={Gift}
          />
        </TabsContent>

        {/* TAB: Devoluciones y Rebajas en Venta */}
        <TabsContent value="devoluciones">
          <QtySubModule
            title="Devoluciones y Rebajas en Venta"
            description="Registre las devoluciones y rebajas aplicadas sobre las ventas (descuentan de los ingresos)"
            items={salesReturnItems}
            onAdd={addSalesReturnItem}
            onUpdate={updateSalesReturnItem}
            onDelete={deleteSalesReturnItem}
            accentColor="red"
            icon={RotateCcw}
          />
        </TabsContent>

        {/* TAB: Otros Ingresos */}
        <TabsContent value="otros-ingresos">
          <OtherIncomeSection />
        </TabsContent>

        {/* TAB: Resumen Anual */}
        <TabsContent value="resumen-anual">
          <AnnualSummary />
        </TabsContent>

        {/* TAB: Resumen Mensual */}
        <TabsContent value="resumen-mensual">
          <MonthlySummary />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription>{'¿Desea eliminar este producto?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-danger-foreground hover:bg-danger/90">
              {'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar Producto' : 'Nuevo'} {'Producto'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Producto')} *</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} placeholder={'Nombre del producto'} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Unidad')}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} placeholder={'Und'} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Clasificación de Mercado')}</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, marketType: 'nacional' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        form.marketType === 'nacional'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-muted hover:border-info/30'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {'Mercado Nacional'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, marketType: 'exportacion' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        form.marketType === 'exportacion'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-muted hover:border-success/30'
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {'Exportación'}
                    </button>
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Precio CUP')}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.priceCUP} onChange={(e) => setForm((p) => ({ ...p, priceCUP: e.target.value }))} step="0.01" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Precio MLC')}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.priceMLC} onChange={(e) => setForm((p) => ({ ...p, priceMLC: e.target.value }))} step="0.01" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Costo MP Unitario (CUP)')}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.unitCostMPCUP} onChange={(e) => setForm((p) => ({ ...p, unitCostMPCUP: e.target.value }))} step="0.01" placeholder="0.00" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">{('Costo MP Unitario (MLC)')}</Label>
                  <Input className="h-8 text-fin-sm focus-ring transition-all duration-200" type="number" value={form.unitCostMPMLC} onChange={(e) => setForm((p) => ({ ...p, unitCostMPMLC: e.target.value }))} step="0.01" placeholder="0.00" />
                </div>
              </div>
              {/* Monthly quantities - matrix format */}
              <MonthMatrixInput
                duration={monthsToShow}
                values={form.quantity}
                onChange={handleQuantityChange}
                onFillAll={fillAllMonths}
                label="Cantidades mensuales"
                step="1"
                showClearYear1
                onClearYear1={() => {
                  setForm((prev) => {
                    const next = [...prev.quantity];
                    for (let i = 0; i < 12 && i < (project.monthsDuration || 120); i++) next[i] = 0;
                    return { ...prev, quantity: next };
                  });
                  toast.success('A\u00f1o 1 limpiado');
                }}
                compact
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{'Cancelar'}</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {editingId ? 'Guardar' : 'Agregar Producto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
