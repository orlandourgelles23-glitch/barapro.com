'use client';

import { useState } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
import type { SparePartItem } from '@/lib/barapro-store';
interface FormData {
  name: string;
  unit: string;
  quantity: string;
  unitCostCUP: string;
  unitCostMLC: string;
  usefulLifeYears: string;
  depreciable: boolean;
}

const defaultFormData: FormData = {
  name: '',
  unit: 'Und',
  quantity: '1',
  unitCostCUP: '',
  unitCostMLC: '',
  usefulLifeYears: '1',
  depreciable: false,
};

export function SparePartsModule() {
  const {
    sparePartItems,
    addSparePartItem,
    updateSparePartItem,
    deleteSparePartItem,
    project,
  } = useBaraproStore();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...defaultFormData });
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);

  // ── Handlers ──────────────────────────────────────────────

  const handleOpenNew = () => {
    setFormData({ ...defaultFormData });
    setSelectedMonths([]);
    setEditingId(null);
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (item: SparePartItem) => {
    setFormData({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity !== 0 ? String(item.quantity) : '0',
      unitCostCUP: item.unitCostCUP !== 0 ? String(item.unitCostCUP) : '0',
      unitCostMLC: item.unitCostMLC !== 0 ? String(item.unitCostMLC) : '0',
      usefulLifeYears: item.usefulLifeYears !== 0 ? String(item.usefulLifeYears) : '0',
      depreciable: item.depreciable,
    });
    setSelectedMonths(Array.isArray(item.months) ? item.months : []);
    setEditingId(item.id);
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const itemData = {
      name: formData.name,
      unit: formData.unit,
      quantity: parseFloat(formData.quantity) || 0,
      unitCostCUP: parseFloat(formData.unitCostCUP) || 0,
      unitCostMLC: parseFloat(formData.unitCostMLC) || 0,
      usefulLifeYears: parseFloat(formData.usefulLifeYears) || 0,
      depreciable: formData.depreciable,
      months: selectedMonths,
    };

    if (editingId) {
      updateSparePartItem(editingId, itemData);
      toast.success('Repuesto actualizado');
    } else {
      addSparePartItem(itemData);
      toast.success('Repuesto agregado');
    }

    setEditDialogOpen(false);
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteSparePartItem(deletingId);
      toast.success('Repuesto eliminado');
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
    toast.success('A\u00f1o 1 limpiado');
  };

  // ── Computed ──────────────────────────────────────────────

  const totalCUP = sparePartItems.reduce(
    (sum, item) => sum + (item.unitCostCUP || 0) * (item.quantity || 1),
    0
  );
  const totalMLC = sparePartItems.reduce(
    (sum, item) => sum + (item.unitCostMLC || 0) * (item.quantity || 1),
    0
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-fin-lg font-semibold">{'Repuestos y Accesorios'}</h2>
                <p className="text-fin-xs text-muted-foreground mt-0.5">
                  {'Registro de repuestos y accesorios para mantenimiento y operación'}
                </p>
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
            <Badge variant="outline" className="text-fin-xs">
              {sparePartItems.length} {'repuestos'}
            </Badge>
            <Badge variant="outline" className="text-fin-xs">
              {'Total CUP'} {totalCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}
            </Badge>
            <Badge variant="outline" className="text-fin-xs">
              {'Total MLC'} {totalMLC.toLocaleString('es-CU', { maximumFractionDigits: 1 })}
            </Badge>
          </div>
        </div>
      </div>

      {/* Table */}
      {sparePartItems.length > 0 ? (
        <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
          <ScrollableTable maxHeight="500px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Nombre'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Unidad'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Cantidad'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Costo Unit. CUP'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Costo Unit. MLC'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Vida Útil (años)'}</TableHead>
                  <TableHead className="text-fin-xs whitespace-nowrap fin-col-header">{'Depreciable'}</TableHead>
                  <TableHead className="text-fin-xs fin-col-header">{'Meses'}</TableHead>
                  <TableHead className="text-fin-xs w-[100px] fin-col-header">{'Acciones'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sparePartItems.map((item) => (
                  <TableRow key={item.id} className="fin-row-hover">
                    <TableCell className="text-fin-sm font-medium">{item.name || '—'}</TableCell>
                    <TableCell className="text-fin-sm">{item.unit || '—'}</TableCell>
                    <TableCell className="text-fin-sm">
                      {Number(item.quantity || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}
                    </TableCell>
                    <TableCell className="text-fin-sm">
                      {Number(item.unitCostCUP || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}
                    </TableCell>
                    <TableCell className="text-fin-sm">
                      {Number(item.unitCostMLC || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })}
                    </TableCell>
                    <TableCell className="text-fin-sm">{item.usefulLifeYears || 0}</TableCell>
                    <TableCell className="text-fin-sm">
                      {item.depreciable ? (
                        <Badge variant="secondary" className="text-fin-xs bg-success-muted text-success">
                          {'Sí'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-fin-xs">{'No'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-fin-sm">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {Array.isArray(item.months) && item.months.length > 0 ? (
                          <>
                            <Badge variant="secondary" className="text-fin-xs">
                              {item.months[0]}
                            </Badge>
                            {item.months.length > 1 && (
                              <Badge variant="secondary" className="text-fin-xs">
                                ...{item.months[item.months.length - 1]}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 focus-ring transition-all duration-200"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive focus-ring transition-all duration-200"
                          onClick={() => confirmDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
            <p className="text-muted-foreground text-fin-sm">
              {'No hay repuestos registrados'}
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">
              {editingId ? 'Editar Repuesto' : 'Nuevo'} {'Repuesto'}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
            <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Nombre del Repuesto'}</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={'Ej: Filtro de aceite'}
                className="h-8 text-fin-sm focus-ring transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Unidad'}</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  placeholder={'Ej: Unidad'}
                  className="h-8 text-fin-sm focus-ring transition-all duration-200"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Cantidad'}</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  step="0.01"
                  className="h-8 text-fin-sm focus-ring transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Costo Unitario CUP'}</Label>
                <Input
                  type="number"
                  value={formData.unitCostCUP}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      unitCostCUP: e.target.value,
                    }))
                  }
                  step="0.01"
                  className="h-8 text-fin-sm focus-ring transition-all duration-200"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-fin-xs font-medium text-muted-foreground">{'Costo Unitario MLC'}</Label>
                <Input
                  type="number"
                  value={formData.unitCostMLC}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      unitCostMLC: e.target.value,
                    }))
                  }
                  step="0.01"
                  className="h-8 text-fin-sm focus-ring transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-fin-xs font-medium text-muted-foreground">{'Vida Útil (años)'}</Label>
              <Input
                type="number"
                value={formData.usefulLifeYears}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    usefulLifeYears: e.target.value,
                  }))
                }
                step="1"
                min="0"
                placeholder={'Años de vida útil'}
                className="h-8 text-fin-sm focus-ring transition-all duration-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="depreciable"
                checked={formData.depreciable || false}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    depreciable: checked === true,
                  }))
                }
                className="focus-ring"
              />
              <Label htmlFor="depreciable" className="text-fin-xs font-medium text-muted-foreground cursor-pointer">
                {'Depreciable'}
              </Label>
            </div>

            {/* Month selector - matrix toggle format */}
            <MonthToggleMatrix
              duration={project.monthsDuration || 120}
              selectedMonths={selectedMonths}
              onToggle={toggleMonth}
              onSelectAll={selectAllMonths}
              onClearAll={clearAllMonths}
              label="Meses de Aplicaci\u00f3n"
              showClearYear1
              onClearYear1={clearYear1Months}
              onSelectYear={(y) => { const startM = y * 12; const newMonths = [...selectedMonths]; for (let i = 0; i < 12; i++) { const m = startM + i + 1; if (m <= (project.monthsDuration || 120) && !newMonths.includes(m)) newMonths.push(m); } setSelectedMonths(newMonths.sort((a, b) => a - b)); }}
              onClearYear={(y) => { const startM = y * 12; setSelectedMonths((prev) => prev.filter((m) => m < startM + 1 || m > startM + 12)); }}
              compact
            />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="focus-ring transition-all duration-200">
              {'Cancelar'}
            </Button>
            <Button onClick={handleSave} className="focus-ring transition-all duration-200 shadow-sm">
              {editingId ? 'Guardar Cambios' : 'Agregar Repuesto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'Confirmar Eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">
              {'¿Está seguro de que desea eliminar este repuesto?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring transition-all duration-200">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-danger text-danger-foreground hover:bg-danger/90 focus-ring-danger transition-all duration-200"
            >
              {'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
