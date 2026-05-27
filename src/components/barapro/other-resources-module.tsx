'use client';

import { useState, useMemo } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { getMergedOtherResourceItems } from '@/lib/barapro-financial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Package, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
import type { OtherResourceItem } from '@/lib/barapro-store';
const CATEGORY_OPTIONS = [
  'Estudios',
  'Capacitación',
  'Gastos Preoperativos',
  'Gastos Financieros',
  'Imprevistos',
  'Otros',
];

interface FormData {
  name: string;
  description: string;
  amountCUP: string;
  amountMLC: string;
  category: string;
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  amountCUP: '',
  amountMLC: '',
  category: '',
};

export function OtherResourcesModule() {
  const {
    otherResourceItems,
    addOtherResourceItem,
    updateOtherResourceItem,
    deleteOtherResourceItem,
    project,
    loans,
  } = useBaraproStore();

  // Lista combinada: items manuales + items automáticos de Gastos Financieros
  const allItems = useMemo(() => getMergedOtherResourceItems({
    ...useBaraproStore.getState(),
    otherResourceItems,
    loans,
    project,
  }), [otherResourceItems, loans, project]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<OtherResourceItem | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...defaultFormData });
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);

  const handleOpenNew = () => {
    setFormData({ ...defaultFormData });
    setSelectedMonths([]);
    setEditingId(null);
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (item: OtherResourceItem) => {
    setFormData({
      name: item.name,
      description: item.description,
      amountCUP: item.amountCUP !== 0 ? String(item.amountCUP) : '0',
      amountMLC: item.amountMLC !== 0 ? String(item.amountMLC) : '0',
      category: item.category,
    });
    setSelectedMonths(Array.isArray(item.months) ? item.months : []);
    setEditingId(item.id);
    setEditDialogOpen(true);
  };

  const handleOpenView = (item: OtherResourceItem) => {
    setViewingItem(item);
    setSelectedMonths(Array.isArray(item.months) ? [...item.months] : []);
    setViewDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!formData.category) {
      toast.error('La categoría es obligatoria');
      return;
    }
    if (selectedMonths.length === 0) {
      toast.error('Seleccione al menos un mes');
      return;
    }

    const itemData = {
      name: formData.name,
      description: formData.description,
      amountCUP: parseFloat(formData.amountCUP) || 0,
      amountMLC: parseFloat(formData.amountMLC) || 0,
      category: formData.category,
      months: selectedMonths,
    };

    if (editingId) {
      updateOtherResourceItem(editingId, itemData);
      toast.success('Recurso actualizado correctamente');
    } else {
      addOtherResourceItem(itemData);
      toast.success('Recurso agregado correctamente');
    }

    setEditDialogOpen(false);
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteOtherResourceItem(deletingId);
      toast.success('Recurso eliminado correctamente');
      setDeletingId(null);
      setDeleteDialogOpen(false);
    }
  };

  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };
  const selectAllMonths = () => {
    const dur = project.monthsDuration || 120;
    setSelectedMonths(Array.from({ length: dur }, (_, i) => i + 1));
  };
  const clearAllMonths = () => setSelectedMonths([]);
  const clearYear1Months = () => {
    setSelectedMonths((prev) => prev.filter((m) => m > 12));
    toast.success('Año 1 limpiado');
  };

  const totalCUP = allItems.reduce((sum, item) => sum + (item.amountCUP || 0), 0);
  const totalMLC = allItems.reduce((sum, item) => sum + (item.amountMLC || 0), 0);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-fin-lg font-semibold">{'Otros Recursos y Gastos'}</h2>
                <p className="text-fin-xs text-muted-foreground mt-0.5">{'Gastos diversos del proyecto no incluidos en otros módulos'}</p>
              </div>
            </div>
            <Button onClick={handleOpenNew} size="sm" className="gap-1.5 focus-ring transition-all duration-200">
              <Plus className="h-4 w-4" />
              {'Agregar'}
            </Button>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-4 flex-wrap">
            <Badge variant="outline" className="text-fin-xs">{allItems.length} {'elementos'}</Badge>
            <Badge variant="outline" className="text-fin-xs">{'Total CUP'} {totalCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</Badge>
            <Badge variant="outline" className="text-fin-xs">{'Total MLC'} {totalMLC.toLocaleString('es-CU', { maximumFractionDigits: 1 })}</Badge>
          </div>
        </div>
      </div>

      {allItems.length > 0 ? (
        <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
          <ScrollableTable maxHeight="500px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Nombre'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Descripción'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Categoría'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Monto CUP'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Monto MLC'}</TableHead>
                  <TableHead className="text-fin-xs fin-col-header">{'Meses'}</TableHead>
                  <TableHead className="text-fin-xs w-[100px] fin-col-header">{'Acciones'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allItems.map((item) => (
                  <TableRow key={item.id} className={`fin-row-hover ${item.isAutoGenerated ? 'bg-warning-muted/50' : ''}`}>
                    <TableCell className="text-fin-sm font-medium">{item.name || '—'}</TableCell>
                    <TableCell className="text-fin-sm max-w-[200px] truncate">{item.description || '—'}</TableCell>
                    <TableCell className="text-fin-sm">
                      {item.category ? (
                        <Badge variant="secondary" className="text-fin-xs">{item.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-fin-sm">{Number(item.amountCUP || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                    <TableCell className="text-fin-sm">{Number(item.amountMLC || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}</TableCell>
                    <TableCell className="text-fin-sm">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {Array.isArray(item.months) && item.months.length > 0 ? (
                          <>
                            <Badge variant="secondary" className="text-fin-xs">{item.months[0]}</Badge>
                            {item.months.length > 1 && (
                              <Badge variant="secondary" className="text-fin-xs">...{item.months[item.months.length - 1]}</Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.isAutoGenerated ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-info hover:text-info focus-ring transition-all duration-200" onClick={() => handleOpenView(item)} title={'Ver detalle'}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Badge variant="outline" className="text-fin-xs text-warning bg-warning-muted">{'Automático'}</Badge>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleOpenEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive focus-ring transition-all duration-200" onClick={() => confirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        </div>
      ) : (
        <div className="glass-card rounded-xl shadow-card-sm">
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-fin-sm">{'No hay elementos. Haga clic en Agregar para crear uno nuevo.'}</p>
          </div>
        </div>
      )}

      {/* ── Dialog de solo lectura para items automáticos ── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-fin-lg">
              <Eye className="h-4 w-4 text-info" />
              {'Detalle de Registro Automático'}
            </DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2 grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label className="text-fin-sm font-medium">{'Nombre'}</Label>
                <div className="text-fin-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2">{viewingItem.name}</div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-fin-sm font-medium">{'Descripción'}</Label>
                <div className="text-fin-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2">{viewingItem.description || '—'}</div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-fin-sm font-medium">{'Categoría'}</Label>
                <div className="text-fin-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2">{viewingItem.category || '—'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-fin-sm font-medium">{'Monto CUP'}</Label>
                  <div className="text-fin-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2">
                    {Number(viewingItem.amountCUP || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-fin-sm font-medium">{'Monto MLC'}</Label>
                  <div className="text-fin-sm bg-muted/50 border border-border/50 rounded-lg px-3 py-2">
                    {Number(viewingItem.amountMLC || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-fin-sm font-medium">{'Meses de aplicación'} ({selectedMonths.length} {'meses'})</Label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-3 border border-border/50 rounded-lg bg-muted/30">
                  {selectedMonths.length > 0 ? (
                    selectedMonths.map((m) => (
                      <Badge key={m} variant="secondary" className="bg-info-muted text-info dark:bg-info-muted dark:text-info">
                        {m}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-fin-xs">{'Sin meses asignados'}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-warning-muted dark:bg-warning-muted border border-warning/20 dark:border-warning rounded-lg">
                <Badge variant="outline" className="text-fin-xs text-warning bg-warning-muted dark:bg-warning-muted">{'Automático'}</Badge>
                <span className="text-fin-xs text-warning dark:text-warning">
                  {'Este registro se genera automáticamente a partir de los préstamos configurados. No puede ser editado ni eliminado manualmente.'}
                </span>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="focus-ring transition-all duration-200">{'Cerrar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">{editingId ? 'Editar' : 'Nuevo'} {'recurso'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Nombre'}</Label>
              <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder={'Nombre del recurso o gasto'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Descripción'}</Label>
              <Input value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder={'Descripción detallada'} className="h-8 text-fin-sm focus-ring transition-all duration-200" />
            </div>
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Categoría'}</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v }))}>
                <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200">
                  <SelectValue placeholder={'Seleccionar categoría...'} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Monto CUP'}</Label>
                <Input type="number" value={formData.amountCUP} onChange={(e) => setFormData((prev) => ({ ...prev, amountCUP: e.target.value }))} step="0.01" className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Monto MLC'}</Label>
                <Input type="number" value={formData.amountMLC} onChange={(e) => setFormData((prev) => ({ ...prev, amountMLC: e.target.value }))} step="0.01" className="h-8 text-fin-sm focus-ring transition-all duration-200" />
              </div>
            </div>
            {/* Month selector - matrix toggle format */}
            <MonthToggleMatrix
              duration={project.monthsDuration || 120}
              selectedMonths={selectedMonths}
              onToggle={toggleMonth}
              onSelectAll={selectAllMonths}
              onClearAll={clearAllMonths}
              label="Meses de Aplicación"
              showClearYear1
              onClearYear1={clearYear1Months}
              onSelectYear={(y) => { const startM = y * 12; const newMonths = [...selectedMonths]; for (let i = 0; i < 12; i++) { const m = startM + i + 1; if (m <= (project.monthsDuration || 120) && !newMonths.includes(m)) newMonths.push(m); } setSelectedMonths(newMonths.sort((a, b) => a - b)); }}
              onClearYear={(y) => { const startM = y * 12; setSelectedMonths((prev) => prev.filter((m) => m < startM + 1 || m > startM + 12)); }}
              compact
            />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
            <Button onClick={handleSave} className="focus-ring transition-all duration-200 shadow-sm">{editingId ? 'Guardar Cambios' : 'Agregar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">{'Esta acción no se puede deshacer. ¿Desea eliminar este elemento?'}</AlertDialogDescription>
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
