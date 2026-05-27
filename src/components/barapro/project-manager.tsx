'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Pencil,
  ArrowRightLeft,
  Download,
  FolderPlus,
  FileDown,
  Package,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectManager, type SavedProject } from '@/lib/barapro-project-manager';
import { useBaraproStore } from '@/lib/barapro-store';
import { exportToExcel, downloadExcel } from '@/lib/barapro-excel';
import { downloadBaraproFile, readBaraproFile } from '@/lib/barapro-v10';

interface ProjectManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectManagerDialog({ open, onOpenChange }: ProjectManagerProps) {
  const {
    projects,
    currentProjectId,
    currentProject,
    loadProject,
    createNewProject,
    deleteProject,
    renameProject,
    duplicateProject,
  } = useProjectManager();

  const store = useBaraproStore();
  const baraproImportRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreateNew = () => {
    if (!newName.trim()) {
      toast.error('Ingrese un nombre para el proyecto');
      return;
    }
    createNewProject(newName.trim());
    toast.success('Proyecto creado exitosamente'.replace('{name}', newName.trim()));
    setNewName('');
    setShowNewDialog(false);
    onOpenChange(false);
  };

  const handleSwitch = (projectId: string) => {
    const success = loadProject(projectId);
    if (success) {
      const proj = projects.find((p) => p.id === projectId);
      toast.success('Proyecto cargado exitosamente'.replace('{name}', proj?.name || ''));
      onOpenChange(false);
    } else {
      toast.error('Error al cargar el proyecto');
    }
  };

  const handleRename = () => {
    if (!renamingId || !renameName.trim()) return;
    renameProject(renamingId, renameName.trim());
    toast.success('Proyecto renombrado');
    setShowRenameDialog(false);
    setRenamingId(null);
    setRenameName('');
  };

  const handleDuplicate = (projectId: string) => {
    const newId = duplicateProject(projectId);
    if (newId) {
      const proj = projects.find((p) => p.id === projectId);
      toast.success('Proyecto duplicado exitosamente'.replace('{name}', proj?.name || ''));
    }
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    const proj = projects.find((p) => p.id === deleteConfirmId);
    deleteProject(deleteConfirmId);
    toast.success('Proyecto eliminado'.replace('{name}', proj?.name || ''));
    setDeleteConfirmId(null);
  };

  const handleExportProject = (proj: SavedProject) => {
    const wb = exportToExcel(proj.data);
    const safeName = proj.name.replace(/\s+/g, '_');
    downloadExcel(wb, `${safeName}_BARAPRO.xlsx`);
    toast.success('Proyecto exportado a Excel'.replace('{name}', proj.name));
  };

  const handleBaraproExportProject = async (proj: SavedProject) => {
    try {
      const name = proj.name || proj.data?.project?.projectName || 'proyecto';
      // Create the barapro file from the project data, not from the current store
      const { createBaraproFile } = await import('@/lib/barapro-v10');
      const file = await createBaraproFile(name);
      // Override data with the saved project data
      const overrideFile = { ...file, data: proj.data };
      const json = JSON.stringify(overrideFile, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const safeName = name
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_.]/g, '')
        .replace(/\s+/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.barapro`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Proyecto exportado como "${name}.barapro"`);
    } catch {
      toast.error('Error al exportar archivo .barapro');
    }
  };

  const handleBaraproImport = useCallback(() => {
    baraproImportRef.current?.click();
  }, []);

  const handleBaraproFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const result = await readBaraproFile(file);

        // Check validation
        const validation = result.validation;
        if (!validation.valid) {
          toast.error(
            `Archivo .barapro inválido: ${validation.errors.join('; ')}`,
            { duration: 6000 }
          );
          return;
        }

        // Check checksum
        if (!result.checksumValid) {
          toast.warning(
            'La suma de verificación (checksum) del archivo no coincide. El archivo puede haber sido modificado externamente. Se procederá con la carga de todos modos.',
            { duration: 8000 }
          );
        }

        if (validation.warnings.length > 0) {
          toast.warning(validation.warnings.join('; '), { duration: 5000 });
        }

        if (validation.missingSlices.length > 0) {
          toast.warning(
            `Rebanas faltantes: ${validation.missingSlices.join(', ')}. Se usarán valores predeterminados.`,
            { duration: 6000 }
          );
        }

        store.loadFromExcel(result.file.data);
        toast.success(
          `${'Proyecto importado'} "${result.file.meta.projectName || result.file.data.project?.projectName || ''}" (.barapro v${result.file.meta.formatVersion})`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(
          err?.message || 'Error al importar archivo .barapro. Verifique el formato.',
          { duration: 6000 }
        );
      }

      e.target.value = '';
    },
    [store, onOpenChange]
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg glass-card shadow-card-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {'Mis Proyectos'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {currentProject && (
              <div className="bg-success-muted border border-success/20 rounded-lg p-3">
                <p className="text-xs text-success font-medium mb-1">{'Proyecto Activo'}</p>
                <p className="text-sm font-semibold text-success">{currentProject.name}</p>
                <p className="text-fin-xs text-success mt-0.5">
                  {'Última modificación'} {formatDate(currentProject.updatedAt)}
                </p>
              </div>
            )}

            <Button onClick={() => setShowNewDialog(true)} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground focus-ring transition-all duration-200">
              <FolderPlus className="h-4 w-4" />
              {'Nuevo Proyecto'}
            </Button>

            {/* Import .barapro button */}
            <input
              ref={baraproImportRef}
              type="file"
              accept=".barapro"
              className="hidden"
              onChange={handleBaraproFileChange}
            />
            <Button
              variant="outline"
              onClick={handleBaraproImport}
              className="w-full gap-2 border-dashed border-primary/40 hover:bg-primary/5 focus-ring transition-all duration-200"
            >
              <Upload className="h-4 w-4 text-primary" />
              {'Importar archivo .barapro'}
            </Button>

            {projects.length > 0 ? (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-2">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                        proj.id === currentProjectId
                          ? 'border-success/30 bg-success-muted/50'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSwitch(proj.id)}>
                        <p className="text-sm font-medium truncate">{proj.name}</p>
                        <p className="text-fin-xs text-muted-foreground">
                          {'Creado'} {formatDate(proj.createdAt)} · {'Modificado'} {formatDate(proj.updatedAt)}
                        </p>
                      </div>

                      {proj.id === currentProjectId && (
                        <Badge variant="outline" className="bg-success-muted text-success border-success/20 text-fin-xs shrink-0">
                          {'Activo'}
                        </Badge>
                      )}

                      <div className="flex gap-1 shrink-0">
                        {proj.id !== currentProjectId && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleSwitch(proj.id)} title={'Abrir Proyecto'}>
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleExportProject(proj)} title={'Exportar a Excel'}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleBaraproExportProject(proj)} title={'Exportar .barapro'}>
                          <FileDown className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => { setRenamingId(proj.id); setRenameName(proj.name); setShowRenameDialog(true); }} title={'Renombrar'}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 focus-ring transition-all duration-200" onClick={() => handleDuplicate(proj.id)} title={'Duplicar'}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 focus-ring transition-all duration-200" onClick={() => setDeleteConfirmId(proj.id)} title={'Eliminar'}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{'No hay proyectos guardados'}</p>
                <p className="text-xs">{'Cree un nuevo proyecto para comenzar'}</p>
              </div>
            )}

            {projects.length > 0 && (
              <p className="text-fin-xs text-muted-foreground text-center">
                {projects.length} {projects.length !== 1 ? 'proyectos guardados' : 'proyecto guardado'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md glass-card shadow-card-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              {'Nuevo Proyecto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-warning-muted border border-warning/20 rounded-lg p-3 text-fin-xs text-warning">
              <strong>Nota:</strong> {'Se creará un proyecto nuevo con los valores predeterminados. El proyecto actual no se perderá pero no estará activo.'}
            </div>
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Nombre del Proyecto'}</Label>
              <Input placeholder="Ej: Restaurante El Morro" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()} autoFocus className="focus-ring text-fin-base transition-all duration-200" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
              <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90 text-primary-foreground focus-ring transition-all duration-200 shadow-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                {'Crear'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md glass-card shadow-card-lg">
          <DialogHeader>
            <DialogTitle>{'Renombrar Proyecto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Nuevo Nombre'}</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} autoFocus className="focus-ring text-fin-base transition-all duration-200" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenameDialog(false)} className="focus-ring transition-all duration-200">{'Cancelar'}</Button>
              <Button onClick={handleRename} className="bg-primary hover:bg-primary/90 text-primary-foreground focus-ring transition-all duration-200 shadow-sm">{'Guardar'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'Eliminar Proyecto'}</AlertDialogTitle>
            <AlertDialogDescription>{'¿Está seguro de que desea eliminar el proyecto '}{projects.find((p) => p.id === deleteConfirmId)?.name}{'? Esta acción no se puede deshacer.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-1.5" />
              {'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
