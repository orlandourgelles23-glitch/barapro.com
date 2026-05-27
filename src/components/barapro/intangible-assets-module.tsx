'use client';

import { useState } from 'react';
import { useBaraproStore, INTANGIBLE_CATEGORIES } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Plus, Trash2, Sparkles, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
interface IntangibleFormState {
  name: string;
  description: string;
  amountCUP: string;
  amountMLC: string;
  usefulLifeYears: string;
  months: number[];
  category: string;
}

const defaultForm = (): IntangibleFormState => ({
  name: '',
  description: '',
  amountCUP: '',
  amountMLC: '',
  usefulLifeYears: '5',
  months: [],
  category: 'software',
});

export function IntangibleAssetsModule() {
  const { intangibleAssets, addIntangibleAsset, updateIntangibleAsset, deleteIntangibleAsset, project } = useBaraproStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<IntangibleFormState>(defaultForm());

  const handleAdd = () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    const cupVal = parseFloat(form.amountCUP) || 0;
    const mlcVal = parseFloat(form.amountMLC) || 0;
    if (cupVal <= 0 && mlcVal <= 0) { toast.error('El importe debe ser mayor a cero'); return; }
    if (form.months.length === 0) { toast.error('Seleccione al menos un mes de adquisición'); return; }

    const data = {
      name: form.name,
      description: form.description,
      amountCUP: cupVal,
      amountMLC: mlcVal,
      usefulLifeYears: parseInt(form.usefulLifeYears) || 5,
      months: form.months,
      category: form.category,
    };

    if (editingId) {
      updateIntangibleAsset(editingId, data);
      toast.success('Activo actualizado');
    } else {
      addIntangibleAsset(data);
      toast.success('Activo agregado');
    }
    setForm(defaultForm());
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (item: any) => {
    setForm({
      name: item.name,
      description: item.description || '',
      amountCUP: item.amountCUP !== 0 ? String(item.amountCUP) : '',
      amountMLC: item.amountMLC !== 0 ? String(item.amountMLC) : '',
      usefulLifeYears: String(item.usefulLifeYears || 5),
      months: Array.isArray(item.months) ? [...item.months] : [],
      category: item.category || 'software',
    });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteTargetId) {
      deleteIntangibleAsset(deleteTargetId);
      toast.success('Activo eliminado');
      setDeleteTargetId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleCategoryChange = (catId: string) => {
    const cat = INTANGIBLE_CATEGORIES.find(c => c.id === catId);
    setForm(f => ({ ...f, category: catId, usefulLifeYears: String(cat?.defaultLifeYears || 5) }));
  };

  const toggleMonth = (m: number) => {
    setForm(f => ({
      ...f,
      months: f.months.includes(m) ? f.months.filter(x => x !== m) : [...f.months, m].sort((a, b) => a - b),
    }));
  };
  const selectAllMonths = () => {
    const dur = project.monthsDuration || 120;
    setForm(f => ({ ...f, months: Array.from({ length: dur }, (_, i) => i + 1) }));
  };
  const clearAllMonths = () => setForm(f => ({ ...f, months: [] }));
  const clearYear1Months = () => {
    setForm(f => ({ ...f, months: f.months.filter(m => m > 12) }));
    toast.success('Año 1 limpiado');
  };

  const totalCUP = intangibleAssets.reduce((s, i) => s + i.amountCUP, 0);
  const totalMLC = intangibleAssets.reduce((s, i) => s + i.amountMLC, 0);
  const monthsDuration = project.monthsDuration || 120;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header - glass card with gradient-primary icon container */}
      <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl gradient-primary shadow-card-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-fin-lg font-semibold">{'Activos Intangibles'}</h2>
              <p className="text-fin-xs text-muted-foreground mt-0.5">{'Registro de activos intangibles del proyecto (licencias, patentes, software, etc.)'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-fin-base font-semibold truncate">{'Lista de Activos Intangibles'}</h3>
            </div>
            <Button onClick={() => { setForm(defaultForm()); setEditingId(null); setDialogOpen(true); }} size="sm" className="gap-1.5 focus-ring transition-all duration-200">
              <Plus className="h-4 w-4" /> {'Agregar Activo'}
            </Button>
          </div>
        </div>
        <div className="px-4 pb-4">
          {intangibleAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
              <p className="text-fin-xs">{'No hay activos intangibles registrados'}</p>
            </div>
          ) : (
            <ScrollableTable maxHeight="500px" stickyColumns={1}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Nombre'}</TableHead>
                    <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Categoría'}</TableHead>
                    <TableHead className="text-fin-xs whitespace-nowrap text-right fin-col-header">{'Importe CUP'}</TableHead>
                    <TableHead className="text-fin-xs whitespace-nowrap text-right fin-col-header">{'Importe MLC'}</TableHead>
                    <TableHead className="text-fin-xs whitespace-nowrap text-center fin-col-header">{'Vida Útil'}</TableHead>
                    <TableHead className="text-fin-xs whitespace-nowrap text-center fin-col-header">{'Meses'}</TableHead>
                    <TableHead className="text-fin-xs w-[80px] fin-col-header">{'Acciones'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intangibleAssets.map((item) => (
                    <TableRow key={item.id} className="fin-row-hover">
                      <TableCell className="text-fin-sm font-medium">{item.name}</TableCell>
                      <TableCell className="text-fin-sm text-muted-foreground">{INTANGIBLE_CATEGORIES.find(c => c.id === item.category)?.name || item.category}</TableCell>
                      <TableCell className="text-fin-sm text-right">{item.amountCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                      <TableCell className="text-fin-sm text-right">{item.amountMLC.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                      <TableCell className="text-fin-sm text-center">{item.usefulLifeYears} {'años'}</TableCell>
                      <TableCell className="text-fin-sm text-center">{(item.months || []).length} {'meses'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive focus-ring transition-all duration-200" onClick={() => confirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
          {intangibleAssets.length > 0 && (
            <div className="mt-2 px-4 pb-3 flex justify-end gap-4 text-fin-xs font-medium">
              <span>{'Total CUP'} {totalCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</span>
              <span>{'Total MLC'} {totalMLC.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar Activo Intangible' : 'Nuevo'} {'Activo Intangible'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Nombre del Activo'}</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder={'Ej: Licencia de Software'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Descripción'}</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder={'Descripción del activo'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Importe CUP'}</Label>
                <Input type="number" value={form.amountCUP} onChange={(e) => setForm(f => ({ ...f, amountCUP: e.target.value }))} min={0} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Importe MLC'}</Label>
                <Input type="number" value={form.amountMLC} onChange={(e) => setForm(f => ({ ...f, amountMLC: e.target.value }))} min={0} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Categoría'}</Label>
                <Select value={form.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTANGIBLE_CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.defaultLifeYears} {'años'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Vida Útil (años)'}</Label>
                <Input type="number" value={form.usefulLifeYears} onChange={(e) => setForm(f => ({ ...f, usefulLifeYears: e.target.value }))} min={1} max={50} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
            </div>
            {/* Month acquisition - matrix toggle format */}
            <MonthToggleMatrix
              duration={monthsDuration}
              selectedMonths={form.months}
              onToggle={toggleMonth}
              onSelectAll={selectAllMonths}
              onClearAll={clearAllMonths}
              label="Meses de Adquisición"
              showClearYear1
              onClearYear1={clearYear1Months}
              onSelectYear={(y) => { const startM = y * 12; const newMonths = [...form.months]; for (let i = 0; i < 12; i++) { const m = startM + i + 1; if (m <= monthsDuration && !newMonths.includes(m)) newMonths.push(m); } setForm((prev) => ({ ...prev, months: newMonths.sort((a, b) => a - b) })); }}
              onClearYear={(y) => { const startM = y * 12; setForm((prev) => ({ ...prev, months: prev.months.filter((m) => m < startM + 1 || m > startM + 12) })); }}
              compact
            />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
            <Button onClick={handleAdd} className="focus-ring transition-all duration-200 shadow-sm">{editingId ? 'Guardar Cambios' : 'Agregar Activo'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'Confirmar Eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">{'¿Está seguro de que desea eliminar este activo intangible?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring transition-all duration-200">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger text-danger-foreground hover:bg-danger/90 focus-ring-danger transition-all duration-200">{'Eliminar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
