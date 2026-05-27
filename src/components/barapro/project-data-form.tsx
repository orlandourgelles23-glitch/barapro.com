'use client';

import { useBaraproStore } from '@/lib/barapro-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, RotateCcw, FileText, ArrowRightLeft, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
const provinces = [
  'Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas',
  'Villa Clara', 'Cienfuegos', 'Sancti Spíritus', 'Ciego de Ávila',
  'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba',
  'Guantánamo', 'Isla de la Juventud',
];

// Municipios por provincia - base completa de Cuba
const municipalitiesByProvince: Record<string, string[]> = {
  'Pinar del Río': [
    'Consolación del Sur', 'Guane', 'La Palma', 'Los Palacios', 'Mantua',
    'Minas de Matahambre', 'Pinar del Río', 'San Juan y Martínez',
    'San Luis', 'Sandino', 'Viñales',
  ],
  'Artemisa': [
    'Alquízar', 'Artemisa', 'Bahía Honda', 'Bauta', 'Caimito',
    'Candelaria', 'Güira de Melena', 'Mariel', 'San Antonio de los Baños',
    'San Cristóbal',
  ],
  'La Habana': [
    'Arroyo Naranjo', 'Boyeros', 'Cerro', 'Centro Habana',
    'Cotorro', 'Diez de Octubre', 'Guanabacoa', 'Habana del Este',
    'Habana Vieja', 'La Lisa', 'Marianao', 'Playa',
    'Plaza de la Revolución', 'Regla', 'San Miguel del Padrón',
  ],
  'Mayabeque': [
    'Batabanó', 'Bejucal', 'Güines', 'Jaruco', 'Madruga',
    'Melena del Sur', 'Nueva Paz', 'Quivicán', 'San José de las Lajas',
    'San Nicolás de Bari', 'Santa Cruz del Norte',
  ],
  'Matanzas': [
    'Calimete', 'Cárdenas', 'Ciénaga de Zapata', 'Colón',
    'Jagüey Grande', 'Jovellanos', 'Limonar', 'Los Arabos',
    'Martí', 'Matanzas', 'Pedro Betancourt', 'Perico', 'Unión de Reyes',
  ],
  'Villa Clara': [
    'Caibarién', 'Camajuaní', 'Cifuentes', 'Corralillo', 'Encrucijada',
    'Manicaragua', 'Placetas', 'Quemado de Güines', 'Ranchuelo',
    'Remedios', 'Sagua la Grande', 'Santa Clara', 'Santo Domingo',
  ],
  'Cienfuegos': [
    'Abreus', 'Aguada de Pasajeros', 'Cienfuegos', 'Cumanayagua',
    'Cruces', 'Lajas', 'Palmira', 'Rodas',
  ],
  'Sancti Spíritus': [
    'Cabaiguán', 'Fomento', 'Jatibonico', 'La Sierpe',
    'Sancti Spíritus', 'Taguasco', 'Trinidad', 'Yaguajay',
  ],
  'Ciego de Ávila': [
    'Baraguá', 'Bolivia', 'Chambas', 'Ciego de Ávila', 'Ciro Redondo',
    'Florencia', 'Majagua', 'Morón', 'Primero de Enero', 'Venezuela',
  ],
  'Camagüey': [
    'Camagüey', 'Carlos Manuel de Céspedes', 'Esmeralda', 'Florida',
    'Guáimaro', 'Jimaguayú', 'Minas', 'Najasa', 'Nuevitas',
    'Santa Cruz del Sur', 'Sibanicú', 'Sierra de Cubitas', 'Vertientes',
  ],
  'Las Tunas': [
    'Amancio', 'Colombia', 'Jesús Menéndez', 'Jobabo', 'Las Tunas',
    'Majibacoa', 'Manatí', 'Puerto Padre',
  ],
  'Holguín': [
    'Antilla', 'Báguanos', 'Banes', 'Cacocum', 'Calixto García',
    'Cueto', 'Frank País', 'Gibara', 'Holguín', 'Mayarí',
    'Moa', 'Rafael Freyre', 'Sagua de Tánamo', 'Urbano Noris',
  ],
  'Granma': [
    'Bartolomé Masó', 'Buey Arriba', 'Campechuela', 'Cauto Cristo',
    'Guisa', 'Jiguaní', 'Manzanillo', 'Media Luna', 'Niquero',
    'Pilón', 'Río Cauto', 'Yara',
  ],
  'Santiago de Cuba': [
    'Contramaestre', 'Guamá', 'Mella', 'Palma Soriano', 'San Luis',
    'Santiago de Cuba', 'Segundo Frente', 'Songo-La Maya',
    'Tercer Frente',
  ],
  'Guantánamo': [
    'Baracoa', 'Caimanera', 'El Salvador', 'Guantánamo', 'Imías',
    'Maisí', 'Manuel Tames', 'Niceto Pérez', 'San Antonio del Sur',
    'Yateras',
  ],
  'Isla de la Juventud': [
    'Nueva Gerona',
  ],
};

const sectors = [
  'Agricultura', 'Ganadería', 'Pesca', 'Turismo', 'Industria',
  'Comercio', 'Servicios', 'Construcción', 'Transporte', 'Alimentario',
  'Tecnología', 'Energía', 'Salud', 'Educación', 'Otro',
];

export function ProjectDataForm() {
  const { project, updateProject, resetAll } = useBaraproStore();
  const [localProject, setLocalProject] = useState({ ...project });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Sync local state when store changes externally (e.g. import/reset)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing Zustand store to local form state
    setLocalProject({ ...project });
  }, [project]);

  const handleChange = (field: string, value: any) => {
    setLocalProject((prev) => ({ ...prev, [field]: value }));
  };

  const handleExchangeRateChange = (field: string, value: number) => {
    setLocalProject((prev) => ({
      ...prev,
      exchangeRates: { ...prev.exchangeRates, [field]: value },
    }));
  };

  // Reset municipality when province changes
  const handleProvinceChange = (province: string) => {
    setLocalProject((prev) => ({ ...prev, province, municipality: '' }));
  };

  const handleSave = () => {
    if (!localProject.projectName.trim()) {
      toast.error('El nombre del proyecto es obligatorio');
      return;
    }
    const dur = localProject.monthsDuration;
    if (!dur || dur < 6 || dur > 240) {
      toast.error('La duración debe ser entre 6 y 240 meses');
      return;
    }
    if (!localProject.exchangeRates.cupToMlc || localProject.exchangeRates.cupToMlc <= 0) {
      toast.error('La tasa de cambio CUP/MLC debe ser mayor a 0');
      return;
    }
    if (!localProject.exchangeRates.cupToCl || localProject.exchangeRates.cupToCl <= 0) {
      toast.error('La tasa de cambio CUP/CL debe ser mayor a 0');
      return;
    }
    updateProject(localProject);
    toast.success('Datos del proyecto guardados');
  };

  const handleReset = () => {
    setResetDialogOpen(true);
  };

  const confirmReset = () => {
    resetAll();
    setLocalProject({
      projectName: '',
      investorName: '',
      province: '',
      municipality: '',
      sector: '',
      startDate: new Date().toISOString().slice(0, 7),
      monthsDuration: 120,
      baseCurrency: 'CUP',
      calculationMode: 'monthly',
      projectType: 'nuevo',
      activityType: 'produccion',
      exchangeRates: { cupToMlc: 300, cupToCl: 300, mlcToCl: 1 },
    });
    toast.success('Datos reiniciados');
    setResetDialogOpen(false);
  };

  const availableMunicipalities = localProject.province
    ? municipalitiesByProvince[localProject.province] || []
    : [];

  return (
    <div className="flex flex-col gap-4 pb-4 animate-slide-up">
      {/* Basic Info Section */}
      <Card className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-border/40 bg-muted/15">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-fin-lg">{'A. Datos del Proyecto'}</CardTitle>
              <p className="text-fin-xs text-muted-foreground mt-0.5">{'Información general y configuración del proyecto'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-4 px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Nombre del Proyecto *'}</Label>
              <Input
                value={localProject.projectName}
                onChange={(e) => handleChange('projectName', e.target.value)}
                placeholder={'Ej: Restaurante El Morro'}
                className="focus-ring text-fin-base transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Nombre del Inversionista'}</Label>
              <Input
                value={localProject.investorName}
                onChange={(e) => handleChange('investorName', e.target.value)}
                placeholder={'Nombre completo'}
                className="focus-ring text-fin-base transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Provincia'}</Label>
              <Select
                value={localProject.province}
                onValueChange={handleProvinceChange}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue placeholder={'Seleccionar provincia...'} />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Municipio'}</Label>
              <Select
                value={localProject.municipality}
                onValueChange={(v) => handleChange('municipality', v)}
                disabled={!localProject.province}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue placeholder={localProject.province ? 'Seleccionar municipio...' : 'Primero seleccione provincia'} />
                </SelectTrigger>
                <SelectContent>
                  {availableMunicipalities.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Sector'}</Label>
              <Select
                value={localProject.sector}
                onValueChange={(v) => handleChange('sector', v)}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue placeholder={'Seleccionar sector...'} />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Fecha de Inicio'}</Label>
              <Input
                type="month"
                value={localProject.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="focus-ring text-fin-base transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Duración (meses)'}</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={String(localProject.monthsDuration || '')}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  const num = parseInt(val);
                  if (val === '' || isNaN(num)) {
                    setLocalProject((prev) => ({ ...prev, monthsDuration: 0 }));
                  } else if (num >= 1 && num <= 600) {
                    setLocalProject((prev) => ({ ...prev, monthsDuration: num }));
                  }
                }}
                className="focus-ring text-fin-base transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Moneda Base'}</Label>
              <Select
                value={localProject.baseCurrency}
                onValueChange={(v) => handleChange('baseCurrency', v)}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUP">{'CUP (Peso Cubano)'}</SelectItem>
                  <SelectItem value="MLC">{'MLC (Moneda Libremente Convertible)'}</SelectItem>
                  <SelectItem value="CL">{'CL (Cupón/Libreta)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Tipo de Proyecto'}</Label>
              <Select
                value={localProject.projectType || 'nuevo'}
                onValueChange={(v) => handleChange('projectType', v)}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">{'Nuevo Proyecto'}</SelectItem>
                  <SelectItem value="ampliacion">{'Ampliación'}</SelectItem>
                  <SelectItem value="reposicion">{'Reposición / Rehabilitación'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Tipo de Actividad (ERF)'}</Label>
              <Select
                value={localProject.activityType || 'produccion'}
                onValueChange={(v) => handleChange('activityType', v)}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produccion">{'Producción / Servicios'}</SelectItem>
                  <SelectItem value="comercial">{'Actividad Comercial (Compra-Venta)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'Modo de Cálculo'}</Label>
              <Select
                value={localProject.calculationMode || 'monthly'}
                onValueChange={(v) => handleChange('calculationMode', v)}
              >
                <SelectTrigger className="focus-ring transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{'Mensual'}</SelectItem>
                  <SelectItem value="yearly">{'Anual'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-fin-xs text-muted-foreground">{'Define la granularidad temporal de los cálculos'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates Section */}
      <Card className="glass-card rounded-xl shadow-card-md overflow-hidden">
        <CardHeader className="py-3 px-5 border-b border-border/40 bg-muted/15">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-info/10">
              <ArrowRightLeft className="h-4 w-4 text-info" />
            </div>
            <div>
              <CardTitle className="text-fin-lg">{'Tasas de Cambio'}</CardTitle>
              <p className="text-fin-xs text-muted-foreground mt-0.5">{'Tipos de cambio entre monedas del proyecto'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-4 px-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'CUP → MLC'}</Label>
              <Input
                type="number"
                value={localProject.exchangeRates.cupToMlc}
                onChange={(e) => handleExchangeRateChange('cupToMlc', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="focus-ring text-fin-base transition-all duration-200"
              />
              <p className="text-fin-xs text-muted-foreground">{'Pesos por MLC'}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'CUP → CL'}</Label>
              <Input
                type="number"
                value={localProject.exchangeRates.cupToCl}
                onChange={(e) => handleExchangeRateChange('cupToCl', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="focus-ring text-fin-base transition-all duration-200"
              />
              <p className="text-fin-xs text-muted-foreground">{'Pesos por CL'}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-fin-sm font-medium">{'MLC → CL'}</Label>
              <Input
                type="number"
                value={localProject.exchangeRates.mlcToCl}
                onChange={(e) => handleExchangeRateChange('mlcToCl', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="focus-ring text-fin-base transition-all duration-200"
              />
              <p className="text-fin-xs text-muted-foreground">{'Equivalencia'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleReset} className="gap-1.5 text-destructive focus-ring transition-all duration-200 hover:bg-danger-muted/50">
          <RotateCcw className="h-4 w-4" />
          {'Reiniciar Todo'}
        </Button>
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-1.5 focus-ring transition-all duration-200 shadow-sm">
          <Save className="h-4 w-4" />
          {'Guardar'}
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="glass-card border-danger/20 shadow-card-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fin-xl">{'¿Reiniciar todos los datos?'}</AlertDialogTitle>
            <AlertDialogDescription className="text-fin-sm">
              {'Esta acción eliminará todos los datos del proyecto y no se puede deshacer. ¿Está seguro de que desea continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-ring">{'Cancelar'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="bg-destructive hover:bg-destructive/90 focus-ring-danger">
              {'Sí, reiniciar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
