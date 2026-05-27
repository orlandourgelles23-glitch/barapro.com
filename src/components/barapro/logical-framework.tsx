'use client';

import { useState } from 'react';
import { useBaraproStore, type LogicalFrameworkRow } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ScrollableTable } from '@/components/barapro/scrollable-table';

// Color map for each logical framework level
const levelColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'fin': {
    bg: 'bg-primary/[0.06]',
    border: 'border-l-primary',
    text: 'text-primary',
    badge: 'bg-primary text-primary-foreground',
  },
  'proposito': {
    bg: 'bg-info/[0.06]',
    border: 'border-l-info',
    text: 'text-info',
    badge: 'bg-info text-info-foreground',
  },
  'componente': {
    bg: 'bg-success/[0.06]',
    border: 'border-l-success',
    text: 'text-success',
    badge: 'bg-success text-success-foreground',
  },
  'actividad': {
    bg: 'bg-warning/[0.06]',
    border: 'border-l-warning',
    text: 'text-warning',
    badge: 'bg-warning text-warning-foreground',
  },
};

export function LogicalFramework() {
  const {
    logicalFramework,
    addLogicalFrameworkRow,
    updateLogicalFrameworkRow,
    deleteLogicalFrameworkRow,
  } = useBaraproStore();
  const rows = logicalFramework.rows;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleAddRow = (level: 'componente' | 'actividad') => {
    const newRow: Omit<LogicalFrameworkRow, 'id'> = {
      level,
      narrative: '',
      indicators: '',
      verificationMeans: '',
      assumptions: '',
    };
    addLogicalFrameworkRow(newRow);
  };

  const handleCellChange = (id: string, field: keyof LogicalFrameworkRow, value: string) => {
    if (field === 'id' || field === 'level') return;
    updateLogicalFrameworkRow(id, { [field]: value });
  };

  const confirmDelete = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row && (row.level === 'fin' || row.level === 'proposito')) return;
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteTargetId) {
      deleteLogicalFrameworkRow(deleteTargetId);
      toast.success('Fila eliminada');
      setDeleteTargetId(null);
      setDeleteDialogOpen(false);
    }
  };

  const finRows = rows.filter((r) => r.level === 'fin');
  const propositoRows = rows.filter((r) => r.level === 'proposito');
  const componenteRows = rows.filter((r) => r.level === 'componente');
  const actividadRows = rows.filter((r) => r.level === 'actividad');

  const levelLabels = [
    { key: 'fin', label: 'Fin', description: 'Impacto final a largo plazo que contribuye al objetivo de desarrollo' },
    { key: 'proposito', label: 'Propósito', description: 'Efecto directo logrado al finalizar el proyecto' },
    { key: 'componente', label: 'Componente', description: 'Resultados intermedios necesarios para lograr el propósito' },
    { key: 'actividad', label: 'Actividad', description: 'Tareas necesarias para producir cada componente' },
  ];

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header banner */}
      <Card className="gradient-primary text-primary-foreground border-0 rounded-xl shadow-card-md overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-foreground/20 shadow-card-sm">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-fin-xl font-bold">{'Matriz de Marco Lógico'}</h2>
              <p className="text-fin-sm text-primary-foreground/80 mt-0.5">
                {'Diseño de la matriz de marco lógico del proyecto según metodología BARAPRO'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guide card */}
      <Card className="glass-card rounded-xl shadow-card-sm overflow-hidden">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {levelLabels.map(({ key, label, description }) => {
              const colors = levelColors[key];
              return (
                <div key={key} className={`p-3 rounded-xl ${colors.bg} ${colors.border} border-l-4 shadow-card-sm transition-all duration-200 hover:shadow-card-md`}>
                  <span className={`text-fin-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>
                    {label}
                  </span>
                  <p className="text-fin-xs text-muted-foreground mt-1.5">{description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-xl">{'Confirmar Eliminación'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">
              {'¿Está seguro de que desea eliminar esta fila del marco lógico? Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 focus-ring-danger">{'Eliminar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Matrix */}
      <div className="border rounded-xl overflow-hidden shadow-card-sm glass-card">
        <ScrollableTable stickyColumns={1}>
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-4 py-3 text-left text-fin-xs font-semibold w-32">{'Nivel'}</th>
                <th className="px-4 py-3 text-left text-fin-xs font-semibold min-w-[200px]">{'Resumen Narrativo'}</th>
                <th className="px-4 py-3 text-left text-fin-xs font-semibold min-w-[180px]">{'Indicadores'}</th>
                <th className="px-4 py-3 text-left text-fin-xs font-semibold min-w-[160px]">{'Medios de Verificación'}</th>
                <th className="px-4 py-3 text-left text-fin-xs font-semibold min-w-[160px]">{'Supuestos'}</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {finRows.map((row) => (
                <LevelRow key={row.id} row={row} levelLabel={'Fin'} levelClass={`${levelColors.fin.bg} ${levelColors.fin.border} border-l-4 font-semibold`} levelTextColor={levelColors.fin.text} onChange={handleCellChange} onDelete={confirmDelete} canDelete={false} deleteRowTitle={'Eliminar fila'} />
              ))}
              <tr><td colSpan={6} className="h-px bg-primary/20" /></tr>
              {propositoRows.map((row) => (
                <LevelRow key={row.id} row={row} levelLabel={'Propósito'} levelClass={`${levelColors.proposito.bg} ${levelColors.proposito.border} border-l-4`} levelTextColor={levelColors.proposito.text} onChange={handleCellChange} onDelete={confirmDelete} canDelete={false} deleteRowTitle={'Eliminar fila'} />
              ))}
              <tr><td colSpan={6} className="h-px bg-primary/20" /></tr>
              {componenteRows.map((row) => (
                <LevelRow key={row.id} row={row} levelLabel={'Comp.'} levelClass={`${levelColors.componente.bg} ${levelColors.componente.border} border-l-4`} levelTextColor={levelColors.componente.text} onChange={handleCellChange} onDelete={confirmDelete} canDelete={true} deleteRowTitle={'Eliminar fila'} />
              ))}
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-2">
                  <Button variant="ghost" size="sm" className="h-7 text-fin-xs gap-1 text-success hover:text-success hover:bg-success/10 focus-ring transition-all duration-200" onClick={() => handleAddRow('componente')}>
                    <Plus className="h-3 w-3" />
                    {'Agregar Componente'}
                  </Button>
                </td>
              </tr>
              <tr><td colSpan={6} className="h-px bg-border" /></tr>
              {actividadRows.map((row) => (
                <LevelRow key={row.id} row={row} levelLabel={'Act.'} levelClass={`${levelColors.actividad.bg} ${levelColors.actividad.border} border-l-4 pl-8`} levelTextColor={levelColors.actividad.text} onChange={handleCellChange} onDelete={confirmDelete} canDelete={true} deleteRowTitle={'Eliminar fila'} />
              ))}
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-2">
                  <Button variant="ghost" size="sm" className="h-7 text-fin-xs gap-1 text-warning hover:text-warning hover:bg-warning/10 ml-6 focus-ring transition-all duration-200" onClick={() => handleAddRow('actividad')}>
                    <Plus className="h-3 w-3" />
                    {'Agregar Actividad'}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}

function LevelRow({
  row,
  levelLabel,
  levelClass,
  levelTextColor,
  onChange,
  onDelete,
  canDelete,
  deleteRowTitle,
}: {
  row: LogicalFrameworkRow;
  levelLabel: string;
  levelClass?: string;
  levelTextColor?: string;
  onChange: (id: string, field: keyof LogicalFrameworkRow, value: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  deleteRowTitle: string;
}) {
  return (
    <tr className={cn('border-t border-border/40 fin-row-hover', levelClass)}>
      <td className={cn('px-4 py-2 text-fin-xs font-semibold whitespace-nowrap', levelTextColor || 'text-primary')}>{levelLabel}</td>
      <td className="px-1.5 py-1"><CellTextarea value={row.narrative} onChange={(v) => onChange(row.id, 'narrative', v)} /></td>
      <td className="px-1.5 py-1"><CellTextarea value={row.indicators} onChange={(v) => onChange(row.id, 'indicators', v)} /></td>
      <td className="px-1.5 py-1"><CellTextarea value={row.verificationMeans} onChange={(v) => onChange(row.id, 'verificationMeans', v)} /></td>
      <td className="px-1.5 py-1"><CellTextarea value={row.assumptions} onChange={(v) => onChange(row.id, 'assumptions', v)} /></td>
      <td className="px-1.5 py-1 text-center">
        {canDelete && (
          <button onClick={() => onDelete(row.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all duration-200 cursor-pointer focus-ring" title={deleteRowTitle}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function CellTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[36px] resize-y text-fin-xs border-transparent bg-transparent focus-visible:border-primary/30 focus-visible:bg-card hover:bg-muted/50 transition-all duration-200 rounded-lg focus-ring"
      rows={1}
    />
  );
}
