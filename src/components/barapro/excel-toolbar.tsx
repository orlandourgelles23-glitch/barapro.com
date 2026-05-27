'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Download,
  Upload,
  FilePlus,
  Save,
  FileDown,
  Package,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBaraproStore } from '@/lib/barapro-store';
import {
  exportToExcel,
  importFromExcel,
  createTemplate,
  downloadExcel,
} from '@/lib/barapro-excel';
import {
  downloadBaraproFile,
  readBaraproFile,
} from '@/lib/barapro-v10';

export function ExcelToolbar() {
  const store = useBaraproStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baraproInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filenameInput, setFilenameInput] = useState('');

  // --- Excel file handler ---
  const handleExcelFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const data = importFromExcel(buffer);

          // Show version warning if imported file has a newer format
          if (data._metaFormatVersion) {
            const majorVersion = Number(data._metaFormatVersion.split('.')[0]);
            if (majorVersion > 10) {
              toast.warning(
                `El archivo fue exportado con formato v${data._metaFormatVersion}, más reciente que v10.1. Algunos datos pueden no ser compatibles.`
              );
            }
          }

          store.loadFromExcel(data);
          toast.success(`${'Proyecto importado'} "${data.project?.projectName || data._metaProjectName || ''}"`);
        } catch {
          toast.error('Error al importar. Verifique el formato del archivo.');
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [store]
  );

  // --- .barapro file handler ---
  const handleBaraproFile = useCallback(
    async (file: File) => {
      try {
        const result = await readBaraproFile(file);

        // Check validation
        const validation = result.validation;
        if (!validation.valid) {
          toast.error(
            `Archivo .barapro inválido: ${validation.errors.join('; ')}`,
            { duration: 6000 }
          );
          return; // Don't load if validation has errors
        }

        // Check checksum
        if (!result.checksumValid) {
          toast.warning(
            'La suma de verificación (checksum) del archivo no coincide. El archivo puede haber sido modificado externamente. Se procederá con la carga de todos modos.',
            { duration: 8000 }
          );
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
          toast.warning(validation.warnings.join('; '), { duration: 5000 });
        }

        if (validation.missingSlices.length > 0) {
          toast.warning(
            `Rebanas faltantes: ${validation.missingSlices.join(', ')}. Se usarán valores predeterminados.`,
            { duration: 6000 }
          );
        }

        // Load the data into the store
        store.loadFromExcel(result.file.data);
        toast.success(
          `${'Proyecto importado'} "${result.file.meta.projectName || result.file.data.project?.projectName || ''}" (.barapro v${result.file.meta.formatVersion})`
        );
      } catch (err: any) {
        toast.error(
          err?.message || 'Error al importar archivo .barapro. Verifique el formato.',
          { duration: 6000 }
        );
      }
    },
    [store]
  );

  // --- Unified file change handler (detects extension and routes) ---
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'barapro') {
        handleBaraproFile(file);
      } else {
        handleExcelFile(file);
      }

      e.target.value = '';
    },
    [handleBaraproFile, handleExcelFile]
  );

  // --- .barapro dedicated file change handler ---
  const handleBaraproFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleBaraproFile(file);
      e.target.value = '';
    },
    [handleBaraproFile]
  );

  // Open save dialog with current project name
  const handleExportClick = useCallback(() => {
    const currentName = store.project.projectName || '';
    setFilenameInput(currentName);
    setSaveDialogOpen(true);
  }, [store.project.projectName]);

  // Confirm export with the entered name
  const handleConfirmExport = useCallback(() => {
    const name = filenameInput.trim();
    if (!name) {
      toast.error('Ingrese un nombre para el proyecto');
      return;
    }

    // Save the project name to store if it changed
    if (name !== store.project.projectName) {
      store.updateProject({ projectName: name });
    }

    // Generate filename: NombreProyecto_BARAPRO.xlsx
    const safeName = name
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_.]/g, '')
      .replace(/\s+/g, '_');
    const filename = `${safeName}_BARAPRO.xlsx`;

    const state = {
      project: { ...store.project, projectName: name },
      constructionItems: store.constructionItems,
      capitalItems: store.capitalItems,
      subcontractItems: store.subcontractItems,
      resourceItems: store.resourceItems,
      purchaseItems: store.purchaseItems,
      salesItems: store.salesItems,
      otherIncomeItems: store.otherIncomeItems,
      subventionItems: store.subventionItems,
      salesReturnItems: store.salesReturnItems,
      publicServiceItems: store.publicServiceItems,
      commercialExpenses: store.commercialExpenses,
      adminExpenses: store.adminExpenses,
      maintenanceItems: store.maintenanceItems,
      indirectExpenses: store.indirectExpenses,
      loans: store.loans,
      parameters: store.parameters,
      sparePartItems: store.sparePartItems,
      otherResourceItems: store.otherResourceItems,
      intangibleAssets: store.intangibleAssets,
      directCostItems: store.directCostItems,
      commercialSalaries: store.commercialSalaries,
      adminSalaries: store.adminSalaries,
      maintenanceSalaries: store.maintenanceSalaries,
      indirectSalaries: store.indirectSalaries,
      directCostSalaries: store.directCostSalaries,
      logicalFramework: store.logicalFramework,
    };

    const wb = exportToExcel(state);
    downloadExcel(wb, filename);
    setSaveDialogOpen(false);
    toast.success(`${'Proyecto guardado como:'} ${filename}`);
  }, [filenameInput, store]);

  // --- Excel import button ---
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // --- .barapro import button ---
  const handleBaraproImport = useCallback(() => {
    baraproInputRef.current?.click();
  }, []);

  // --- .barapro export ---
  const handleBaraproExport = useCallback(async () => {
    try {
      const name = store.project.projectName || 'proyecto';
      await downloadBaraproFile(name);
      toast.success(`Proyecto exportado como "${name}.barapro"`);
    } catch {
      toast.error('Error al exportar archivo .barapro');
    }
  }, [store.project.projectName]);

  const handleTemplate = useCallback(() => {
    const wb = createTemplate();
    downloadExcel(wb, 'BARAPRO_Plantilla.xlsx');
    toast.success('Plantilla descargada');
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap glass rounded-xl px-2 py-1.5 shadow-card-sm">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.barapro"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={baraproInputRef}
          type="file"
          accept=".barapro"
          className="hidden"
          onChange={handleBaraproFileChange}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          className="gap-1.5 h-8.5 text-fin-sm font-medium border-border/80 hover:bg-muted focus-ring transition-all duration-200"
          title="Importar Excel (.xlsx, .xls)"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{'Importar'}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleBaraproImport}
          className="gap-1.5 h-8.5 text-fin-sm font-medium border-border/80 hover:bg-muted focus-ring transition-all duration-200"
          title="Importar BARAPRO (.barapro)"
        >
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">{'Importar .barapro'}</span>
          <span className="sm:hidden">{'.barapro'}</span>
        </Button>

        <div className="w-px h-5 bg-border/50 mx-0.5" />

        <Button
          size="sm"
          onClick={handleExportClick}
          className="gap-1.5 h-8.5 text-fin-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm focus-ring transition-all duration-200"
          title="Exportar a Excel (.xlsx)"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{'Guardar Proyecto'}</span>
          <span className="sm:hidden">{'Guardar'}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleBaraproExport}
          className="gap-1.5 h-8.5 text-fin-sm font-medium border-border/80 hover:bg-primary/5 focus-ring transition-all duration-200"
          title="Exportar como archivo .barapro nativo"
        >
          <FileDown className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">{'Exportar .barapro'}</span>
          <span className="sm:hidden">{'.barapro'}</span>
        </Button>

        <div className="w-px h-5 bg-border/50 mx-0.5" />

        <Button
          variant="outline"
          size="sm"
          onClick={handleTemplate}
          className="gap-1.5 h-8.5 text-fin-sm font-medium border-border/80 hover:bg-muted focus-ring transition-all duration-200"
          title="Descargar plantilla en blanco"
        >
          <FilePlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{'Plantilla'}</span>
        </Button>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md glass-card shadow-card-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-fin-xl">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <Save className="h-5 w-5 text-primary" />
              </div>
              {'Guardar Proyecto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-fin-sm font-medium">{'Nombre del Proyecto'}</Label>
              <Input
                id="project-name"
                placeholder={'Ej: Restaurante El Morro'}
                value={filenameInput}
                onChange={(e) => setFilenameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmExport();
                }}
                autoFocus
                className="h-10 focus-ring text-fin-base transition-all duration-200"
              />
            </div>

            <div className="bg-muted/50 rounded-xl p-3.5 space-y-1.5 border border-border/60 shadow-card-sm">
              <p className="text-fin-xs text-muted-foreground font-medium uppercase tracking-wide">
                {'El archivo se guardará como:'}
              </p>
              <p className="text-fin-base font-semibold text-foreground truncate">
                {filenameInput.trim()
                  ? `${filenameInput.trim().replace(/\s+/g, '_')}_BARAPRO.xlsx`
                  : 'Nombre_BARAPRO.xlsx'}
              </p>
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 text-fin-sm text-foreground/80">
              <p><strong className="font-semibold">Consejo:</strong> {'Si importa este archivo en otra sesión, todos los datos del proyecto se restaurarán automáticamente.'}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="h-9 font-medium focus-ring transition-all duration-200">
                {'Cancelar'}
              </Button>
              <Button
                onClick={handleConfirmExport}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 font-medium shadow-sm focus-ring transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
