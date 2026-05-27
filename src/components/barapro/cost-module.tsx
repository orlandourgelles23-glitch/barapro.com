'use client';

import { useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { ModuleId } from '@/lib/barapro-store';
import { ScrollableTable } from '@/components/barapro/scrollable-table';
import { PurchaseOriginBreakdown } from '@/components/barapro/purchase-origin-breakdown';
import { MonthMatrixInput, MonthToggleMatrix } from '@/components/barapro/shared/month-matrix-input';
import { getMonthLabel } from '@/lib/format';

interface CostField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  defaultValue?: string | number;
  hidden?: boolean;
}

export interface CostModuleConfig {
  moduleId: ModuleId;
  title: string;
  description: string;
  fields: CostField[];
  showUnitCost?: boolean;
  showQuantity?: boolean;
  showFrequency?: boolean;
  showCategory?: boolean;
  showSocialSecurity?: boolean;
  showPosition?: boolean;
  showCategoryField?: boolean;
  showOriginBreakdown?: boolean;
  showMonthlyQuantities?: boolean;
  showClearYear1?: boolean;
  storeKey: string;
  monthsLabel?: string;
}

interface CostModuleProps {
  config: CostModuleConfig;
}

export function CostModule({ config }: CostModuleProps) {
  const store = useBaraproStore();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [monthlyQuantities, setMonthlyQuantities] = useState<number[]>([]);

  const useMonthlyQty = config.showMonthlyQuantities || config.showOriginBreakdown;
  const duration = store.project.monthsDuration || 120;

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < duration; i++) {
      labels.push(getMonthLabel(i, store.project.startDate));
    }
    return labels;
  }, [store.project.startDate, duration]);

  // Localized config
  const lc = useMemo(() => ({
    title: config.title,
    description: config.description,
  }), [config.title, config.description]);

  const getFieldLabel = (field: CostField) =>
    field.label;

  const getOptionLabel = (opt: string) =>
    opt;

  // Get items from store dynamically
  const getItems = (): any[] => {
    const key = config.storeKey as keyof typeof store;
    return (store[key] as any) || [];
  };

  // Explicit action name map to avoid fragile string derivation
  const ACTION_MAP: Record<string, { add: string; update: string; delete: string }> = {
    constructionItems: { add: 'addConstructionItem', update: 'updateConstructionItem', delete: 'deleteConstructionItem' },
    capitalItems: { add: 'addCapitalItem', update: 'updateCapitalItem', delete: 'deleteCapitalItem' },
    subcontractItems: { add: 'addSubcontractItem', update: 'updateSubcontractItem', delete: 'deleteSubcontractItem' },
    resourceItems: { add: 'addResourceItem', update: 'updateResourceItem', delete: 'deleteResourceItem' },
    purchaseItems: { add: 'addPurchaseItem', update: 'updatePurchaseItem', delete: 'deletePurchaseItem' },
    commercialExpenses: { add: 'addCommercialExpense', update: 'updateCommercialExpense', delete: 'deleteCommercialExpense' },
    adminExpenses: { add: 'addAdminExpense', update: 'updateAdminExpense', delete: 'deleteAdminExpense' },
    maintenanceItems: { add: 'addMaintenanceItem', update: 'updateMaintenanceItem', delete: 'deleteMaintenanceItem' },
    indirectExpenses: { add: 'addIndirectExpense', update: 'updateIndirectExpense', delete: 'deleteIndirectExpense' },
    directCostItems: { add: 'addDirectCostItem', update: 'updateDirectCostItem', delete: 'deleteDirectCostItem' },
    publicServiceItems: { add: 'addPublicServiceItem', update: 'updatePublicServiceItem', delete: 'deletePublicServiceItem' },
  };

  const getAction = (key: string, operation: 'add' | 'update' | 'delete') => {
    return ACTION_MAP[key]?.[operation] || null;
  };

  const addItem = (store: any, key: string, item: any) => {
    const action = getAction(key, 'add');
    if (action && typeof store[action] === 'function') {
      store[action](item);
    } else {
      console.error(`[CostModule] add action not found for storeKey: ${key}`);
    }
  };

  const updateItem = (store: any, key: string, id: string, data: any) => {
    const action = getAction(key, 'update');
    if (action && typeof store[action] === 'function') {
      store[action](id, data);
    } else {
      console.error(`[CostModule] update action not found for storeKey: ${key}`);
    }
  };

  const deleteItem = (store: any, key: string, id: string) => {
    const action = getAction(key, 'delete');
    if (action && typeof store[action] === 'function') {
      store[action](id);
    } else {
      console.error(`[CostModule] delete action not found for storeKey: ${key}`);
    }
  };

  const handleOpenNew = () => {
    const defaults: Record<string, any> = {};
    config.fields.forEach((f) => {
      if (f.hidden) return;
      defaults[f.key] = f.type === 'number'
        ? (f.defaultValue !== undefined ? String(f.defaultValue) : '')
        : (f.defaultValue ?? '');
    });
    setFormData(defaults);
    setSelectedMonths([]);
    setMonthlyQuantities(Array(duration).fill(0));
    setEditingId(null);
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    const data: Record<string, any> = {};
    config.fields.forEach((f) => {
      if (f.hidden) return;
      data[f.key] = f.type === 'number'
        ? (item[f.key] != null && item[f.key] !== 0 ? String(item[f.key]) : (item[f.key] === 0 ? '0' : ''))
        : (item[f.key] ?? '');
    });
    setFormData(data);
    setSelectedMonths(Array.isArray(item.months) ? item.months : []);
    setMonthlyQuantities(
      Array.isArray(item.quantities) && item.quantities.length > 0
        ? [...item.quantities]
        : Array(duration).fill(0)
    );
    setEditingId(item.id);
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name && config.fields.some((f) => f.key === 'name')) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const itemData: Record<string, any> = {};

    if (useMonthlyQty) {
      // Derive months from quantities (months where quantity > 0)
      const quantities = [...monthlyQuantities];
      while (quantities.length < duration) quantities.push(0);
      if (quantities.length > duration) quantities.length = duration;
      const months = quantities.map((q, idx) => (q > 0 ? idx + 1 : -1)).filter((m) => m > 0);
      itemData.months = months;
      itemData.quantities = quantities;
      itemData.quantity = quantities.reduce((s: number, q: number) => s + q, 0);
    } else {
      itemData.months = selectedMonths;
    }

    for (const field of config.fields) {
      if (field.hidden) continue;
      const raw = formData[field.key];
      if (field.type === 'number') {
        const parsed = parseFloat(raw);
        itemData[field.key] = isNaN(parsed) ? 0 : parsed;
      } else {
        itemData[field.key] = raw ?? '';
      }
    }

    if (editingId) {
      updateItem(store, config.storeKey, editingId, itemData);
      toast.success('Elemento actualizado correctamente');
    } else {
      addItem(store, config.storeKey, itemData);
      toast.success('Elemento agregado correctamente');
    }

    setEditDialogOpen(false);
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteTargetId) {
      deleteItem(store, config.storeKey, deleteTargetId);
      toast.success('Elemento eliminado correctamente');
      setDeleteTargetId(null);
      setDeleteDialogOpen(false);
    }
  };

  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const selectAllMonths = () => {
    setSelectedMonths(Array.from({ length: duration }, (_, i) => i + 1));
  };

  const clearAllMonths = () => {
    setSelectedMonths([]);
  };

  const clearYear1Months = () => {
    setSelectedMonths((prev) => prev.filter((m) => m > 12));
  };

  const handleQuantityChange = (idx: number, value: string) => {
    setMonthlyQuantities((prev) => {
      const newQ = [...prev];
      newQ[idx] = parseFloat(value) || 0;
      return newQ;
    });
  };

  const fillAllMonthsQuantities = (value: number) => {
    setMonthlyQuantities(Array(duration).fill(value));
  };

  const items = getItems();
  const totalCUP = items.reduce(
    (sum: number, item: any) => {
      if (useMonthlyQty && Array.isArray(item.quantities) && item.quantities.length > 0) {
        return sum + item.quantities.reduce((s: number, q: number) => s + q * (item.unitCostCUP || 0), 0);
      }
      return sum + ((item.unitCostCUP || 0) * (item.quantity || 1) + (item.amountCUP || 0) + (item.totalCostCUP || 0) + (item.monthlySalaryCUP || 0));
    },
    0
  );
  const totalMLC = items.reduce(
    (sum: number, item: any) => {
      if (useMonthlyQty && Array.isArray(item.quantities) && item.quantities.length > 0) {
        return sum + item.quantities.reduce((s: number, q: number) => s + q * (item.unitCostMLC || 0), 0);
      }
      return sum + ((item.unitCostMLC || 0) * (item.quantity || 1) + (item.amountMLC || 0) + (item.totalCostMLC || 0) + (item.monthlySalaryMLC || 0));
    },
    0
  );

  // Filter fields for display (hide hidden ones)
  const visibleFields = config.fields.filter((f) => !f.hidden);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shadow-card-sm">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-fin-lg font-semibold">{lc.title}</h2>
                <p className="text-fin-xs text-muted-foreground mt-0.5">{lc.description}</p>
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
              {items.length} {'elementos'}
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
      {items.length > 0 ? (
        <div className="glass-card rounded-xl shadow-card-sm overflow-hidden">
          <ScrollableTable maxHeight="500px" stickyColumns={1}>
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleFields.map((f) => (
                    <TableHead key={f.key} className="text-fin-xs whitespace-nowrap fin-col-header">
                      {getFieldLabel(f)}
                    </TableHead>
                  ))}
                  {!useMonthlyQty && (
                    <TableHead className="text-fin-xs fin-col-header">{'Meses'}</TableHead>
                  )}
                  <TableHead className="text-fin-xs text-right fin-col-header">{'Total CUP'}</TableHead>
                  <TableHead className="text-fin-xs w-[100px] fin-col-header">{'Acciones'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, idx: number) => {
                  const itemTotalCUP = (useMonthlyQty && Array.isArray(item.quantities) && item.quantities.length > 0)
                    ? item.quantities.reduce((s: number, q: number) => s + q * (item.unitCostCUP || 0), 0)
                    : (item.unitCostCUP || 0) * (item.quantity || 1) + (item.amountCUP || 0) + (item.totalCostCUP || 0);
                  return (
                    <TableRow key={item.id || `cost-${config.moduleId}-${idx}`} className="fin-row-hover">
                      {visibleFields.map((f) => (
                        <TableCell key={f.key} className="text-fin-sm">
                          {f.type === 'number'
                            ? Number(item[f.key] || 0).toLocaleString('es-CU', { maximumFractionDigits: 1 })
                            : item[f.key] || '—'}
                        </TableCell>
                      ))}
                      {!useMonthlyQty && (
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
                      )}
                      <TableCell className="text-fin-sm text-right font-semibold">
                        {itemTotalCUP.toLocaleString('es-CU', { maximumFractionDigits: 1 })}
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
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 focus-ring transition-all duration-200"
                            onClick={() => confirmDelete(item.id)}
                          >
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
        </div>
      ) : (
        <div className="glass-card rounded-xl shadow-card-sm">
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-fin-sm">
              {'No hay elementos. Haga clic en Agregar para crear uno nuevo.'}
            </p>
          </div>
        </div>
      )}

      {/* Origin Breakdown Table (Module F - Purchases) */}
      {config.showOriginBreakdown && items.length > 0 && (
        <PurchaseOriginBreakdown items={items} monthsDuration={duration} cupToMlc={store.project.exchangeRates.cupToMlc || 300} startDate={store.project.startDate} />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-lg">{'Confirmar eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">
              {'Esta acción no se puede deshacer. ¿Desea eliminar este elemento?'}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent aria-describedby={undefined} className="glass-card border-border/50 shadow-card-lg max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-1.5 shrink-0">
            <DialogTitle className="text-fin-lg">
              {editingId ? 'Editar' : 'Nuevo'} {lc.title.replace(/^[A-Z]\.\s*/, '')}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2 grid gap-3 py-2">
            {/* Form fields in 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleFields.map((field) => (
                <div key={field.key} className="grid gap-1">
                  <Label className="text-fin-xs font-medium text-muted-foreground">
                    {getFieldLabel(field)}
                    {field.type === 'number' && <span className="ml-0.5 opacity-50">({field.key.includes('CUP') ? 'CUP' : field.key.includes('MLC') ? 'MLC' : '#'})</span>}
                  </Label>
                  {field.type === 'select' && field.options ? (
                    <Select value={String(formData[field.key] || '')} onValueChange={(v) => setFormData((prev) => ({ ...prev, [field.key]: v }))}>
                      <SelectTrigger className="h-8 text-fin-sm focus-ring transition-all duration-200"><SelectValue placeholder={'Seleccionar...'} /></SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{getOptionLabel(opt)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      step={field.type === 'number' ? '0.01' : undefined}
                      placeholder={field.type === 'number' ? '0.00' : undefined}
                      className="h-8 text-fin-sm focus-ring transition-all duration-200"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Monthly inputs — different modes */}
            {useMonthlyQty ? (
              <MonthMatrixInput
                duration={duration}
                values={monthlyQuantities}
                onChange={handleQuantityChange}
                onFillAll={fillAllMonthsQuantities}
                label="Cantidades mensuales"
                step="1"
                showClearYear1={config.showClearYear1}
                onClearYear1={() => { setMonthlyQuantities((prev) => { const next = [...prev]; for (let i = 0; i < 12 && i < duration; i++) next[i] = 0; return next; }); toast.success('A\u00f1o 1 limpiado'); }}
                compact
              />
            ) : (
              <MonthToggleMatrix
                duration={duration}
                selectedMonths={selectedMonths}
                onToggle={toggleMonth}
                onSelectAll={selectAllMonths}
                onClearAll={clearAllMonths}
                label="Meses de aplicaci\u00f3n"
                showClearYear1={config.showClearYear1}
                onClearYear1={clearYear1Months}
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
            )}

            {config.showSocialSecurity && !useMonthlyQty && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="socialSecurity"
                  checked={formData.includesSocialSecurity || false}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, includesSocialSecurity: checked === true }))}
                  className="focus-ring"
                />
                <Label htmlFor="socialSecurity" className="text-fin-sm font-medium cursor-pointer">{'Incluye Seguridad Social'}</Label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/50 bg-background shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
            <Button onClick={handleSave} className="focus-ring transition-all duration-200 shadow-sm">{editingId ? 'Guardar Cambios' : 'Agregar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// CONFIGURATIONS FOR EACH MODULE
// ============================================================
export const moduleBConfig: CostModuleConfig = {
  moduleId: 'B',
  title: 'B. Construcción',
  description: 'Costos de construcción y obra civil del proyecto',
  storeKey: 'constructionItems',
  fields: [
    { key: 'name', label: 'Nombre / Descripción', type: 'text' },
    { key: 'unit', label: 'Unidad', type: 'text', defaultValue: 'Und' },
    { key: 'quantity', label: 'Cantidad', type: 'number', defaultValue: 1 },
    { key: 'unitCostCUP', label: 'Costo Unit. CUP', type: 'number' },
    { key: 'unitCostMLC', label: 'Costo Unit. MLC', type: 'number' },
    { key: 'costCategory', label: 'Categoría', type: 'select', options: ['Obra Civil', 'Instalaciones', 'Acabados', 'Otros'] },
  ],
};

export const moduleCConfig: CostModuleConfig = {
  moduleId: 'C',
  title: 'C. Gastos de Capital',
  description: 'Equipos, maquinaria y bienes de capital del proyecto',
  storeKey: 'capitalItems',
  fields: [
    { key: 'name', label: 'Nombre / Equipo', type: 'text' },
    { key: 'unit', label: 'Unidad', type: 'text', defaultValue: 'Und' },
    { key: 'quantity', label: 'Cantidad', type: 'number', defaultValue: 1 },
    { key: 'unitCostCUP', label: 'Costo Unit. CUP', type: 'number' },
    { key: 'unitCostMLC', label: 'Costo Unit. MLC', type: 'number' },
    { key: 'costCategory', label: 'Categoría', type: 'select', options: ['Equipos', 'Maquinaria', 'Vehículos', 'Mobiliario', 'Herramientas', 'Equipos Informáticos', 'Otros'] },
  ],
};

export const moduleDConfig: CostModuleConfig = {
  moduleId: 'D',
  title: 'D. Subcontrataciones',
  description: 'Servicios contratados a terceros',
  storeKey: 'subcontractItems',
  fields: [
    { key: 'name', label: 'Nombre', type: 'text' },
    { key: 'description', label: 'Descripción', type: 'text' },
    { key: 'totalCostCUP', label: 'Costo Total CUP', type: 'number' },
    { key: 'totalCostMLC', label: 'Costo Total MLC', type: 'number' },
  ],
};

export const moduleEConfig: CostModuleConfig = {
  moduleId: 'E',
  title: 'E. Recursos Humanos',
  description: 'Personal del proyecto con salarios y cargos',
  storeKey: 'resourceItems',
  fields: [
    { key: 'name', label: 'Nombre', type: 'text' },
    { key: 'position', label: 'Cargo / Posición', type: 'text' },
    { key: 'category', label: 'Categoría', type: 'select', options: ['Directivo', 'Técnico', 'Administrativo', 'Obrero', 'Servicio'] },
    { key: 'monthlySalaryCUP', label: 'Salario Mensual CUP', type: 'number' },
    { key: 'monthlySalaryMLC', label: 'Salario Mensual MLC', type: 'number' },
    { key: 'quantity', label: 'Cantidad', type: 'number', defaultValue: 1 },
  ],
  showSocialSecurity: true,
};

export const moduleFConfig: CostModuleConfig = {
  moduleId: 'F',
  title: 'F. Compras',
  description: 'Materias primas, insumos y materiales de compra',
  storeKey: 'purchaseItems',
  showOriginBreakdown: true,
  showMonthlyQuantities: true,
  showClearYear1: true,
  fields: [
    { key: 'name', label: 'Nombre / Material', type: 'text' },
    { key: 'unit', label: 'Unidad', type: 'text', defaultValue: 'Und' },
    { key: 'unitCostCUP', label: 'Costo Unit. CUP', type: 'number' },
    { key: 'unitCostMLC', label: 'Costo Unit. MLC', type: 'number' },
    { key: 'origin', label: 'Origen', type: 'select', options: ['Nacional', 'Importada'], defaultValue: 'Nacional' },
    { key: 'quantity', label: 'Cantidad', type: 'number', hidden: true },
    { key: 'frequency', label: 'Frecuencia', type: 'select', options: ['Mensual', 'Trimestral', 'Semestral', 'Anual', 'Único'], hidden: true },
  ],
};


export const moduleIConfig: CostModuleConfig = {
  moduleId: 'I',
  title: 'I. Gastos de Distribución y Ventas',
  description: 'Gastos de distribución, venta y comercialización del proyecto',
  storeKey: 'commercialExpenses',
  showClearYear1: true,
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
  ],
};

export const moduleJConfig: CostModuleConfig = {
  moduleId: 'J',
  title: 'J. Gastos Generales y de Administración',
  description: 'Gastos operativos, generales y administrativos del negocio',
  storeKey: 'adminExpenses',
  showClearYear1: true,
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
  ],
};

export const moduleKConfig: CostModuleConfig = {
  moduleId: 'K',
  title: 'K. Mantenimiento',
  description: 'Gastos de mantenimiento preventivo y correctivo',
  storeKey: 'maintenanceItems',
  showClearYear1: true,
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
    { key: 'frequency', label: 'Frecuencia', type: 'select', options: ['Mensual', 'Trimestral', 'Semestral', 'Anual'] },
  ],
};

export const moduleLConfig: CostModuleConfig = {
  moduleId: 'L',
  title: 'L. Otros Gastos',
  description: 'Otros gastos operativos del proyecto',
  storeKey: 'indirectExpenses',
  showClearYear1: true,
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
  ],
};

export const moduleDirectCostsConfig: CostModuleConfig = {
  moduleId: 'direct-costs',
  title: 'Costos Directos',
  description: 'Costos directos de producción y operación del proyecto',
  storeKey: 'directCostItems',
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'description', label: 'Descripción', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
  ],
};

export const modulePublicServicesConfig: CostModuleConfig = {
  moduleId: 'direct-costs',
  title: 'Servicios Públicos',
  description: 'Costos de servicios públicos: agua, electricidad, comunicaciones, combustible y otros',
  storeKey: 'publicServiceItems',
  fields: [
    { key: 'name', label: 'Concepto', type: 'text' },
    { key: 'description', label: 'Descripción', type: 'text' },
    { key: 'amountCUP', label: 'Monto CUP', type: 'number' },
    { key: 'amountMLC', label: 'Monto MLC', type: 'number' },
    { key: 'category', label: 'Clasificación', type: 'select', options: ['Agua', 'Electricidad', 'Comunicaciones', 'Combustible', 'Otros'] },
  ],
};
