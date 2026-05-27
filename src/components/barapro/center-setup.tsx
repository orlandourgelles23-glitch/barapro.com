'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  User,
  Lock,
  Building2,
  Shield,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuthStore, handleApiError } from '@/lib/auth-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CenterConfig {
  centerName: string;
  organism: string;
  masterUsername: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 4) return 'weak';
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'Débil';
    case 'medium':
      return 'Media';
    case 'strong':
      return 'Fuerte';
  }
}

function getStrengthStyles(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-danger-muted text-danger';
    case 'medium':
      return 'bg-warning-muted text-warning';
    case 'strong':
      return 'bg-success-muted text-success';
  }
}

function getStrengthBarWidth(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'w-1/3';
    case 'medium':
      return 'w-2/3';
    case 'strong':
      return 'w-full';
  }
}

function getStrengthBarColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-danger';
    case 'medium':
      return 'bg-warning';
    case 'strong':
      return 'bg-success';
  }
}

/* ------------------------------------------------------------------ */
/*  Center Setup Component                                             */
/* ------------------------------------------------------------------ */

export function CenterSetup() {
  /* ---- Center config state ---- */
  const [centerName, setCenterName] = useState('');
  const [organism, setOrganism] = useState('');
  const [masterUsername, setMasterUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');

  /* ---- Password state ---- */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* ---- UI state ---- */
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('centro');

  /* ---- Password strength ---- */
  const passwordStrength = getPasswordStrength(newPassword);

  /* ---- Load config on dialog open ---- */
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadConfig() {
      setIsLoading(true);
      try {
        const token = useAuthStore.getState().token;
        const res = await fetch('/api/center-config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (handleApiError(res)) return; // 401 → auto-logout
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al cargar la configuración');
        }
        const data: CenterConfig = await res.json();
        if (cancelled) return;

        setCenterName(data.centerName ?? '');
        setOrganism(data.organism ?? '');
        setMasterUsername(data.masterUsername ?? '');
        setOriginalUsername(data.masterUsername ?? '');
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || 'Error al cargar la configuración del centro.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  /* ---- Reset form on dialog close ---- */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setActiveTab('centro');
    }
  }, []);

  /* ---- Save handler ---- */
  const handleSave = useCallback(async () => {
    // Validate password fields if user is on the password tab or has entered password fields
    const hasPasswordChanges = newPassword.trim() !== '';
    const hasUsernameChanges = masterUsername.trim() !== originalUsername.trim();

    if (hasPasswordChanges) {
      if (!currentPassword.trim()) {
        toast.error('Debe ingresar su contraseña actual para cambiar la contraseña.');
        return;
      }
      if (newPassword.trim().length < 4) {
        toast.error('La nueva contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('La nueva contraseña y la confirmación no coinciden.');
        return;
      }
    }

    // Require current password for username change too
    if (hasUsernameChanges && !hasPasswordChanges && !currentPassword.trim()) {
      toast.error('Debe ingresar su contraseña actual para cambiar el usuario.');
      return;
    }

    // Basic field validation
    if (!centerName.trim()) {
      toast.error('El nombre del centro no puede estar vacío.');
      return;
    }

    setIsSaving(true);

    try {
      const body: Record<string, string> = {
        centerName: centerName.trim(),
        organism: organism.trim(),
      };

      if (hasUsernameChanges) {
        body.masterUsername = masterUsername.trim();
        body.currentPassword = currentPassword.trim();
      }

      if (hasPasswordChanges) {
        body.masterPassword = newPassword.trim();
        body.currentPassword = currentPassword.trim();
      }

      const token = useAuthStore.getState().token;
      const res = await fetch('/api/center-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (handleApiError(res)) return; // 401 → auto-logout

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al guardar la configuración.');
        return;
      }

      // Update auth store if username changed
      if (hasUsernameChanges) {
        useAuthStore.setState((state) => ({
          user: state.user
            ? { ...state.user, username: masterUsername.trim() }
            : null,
        }));
        setOriginalUsername(masterUsername.trim());
      }

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast.success('Configuración guardada exitosamente.');

      // If password was changed, suggest re-login
      if (hasPasswordChanges) {
        setTimeout(() => {
          toast.info('Se recomuelve iniciar sesión nuevamente con su nueva contraseña.');
        }, 1000);
      }
    } catch {
      toast.error('Error de conexión. Verifique su red e intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    centerName,
    organism,
    masterUsername,
    originalUsername,
    currentPassword,
    newPassword,
    confirmPassword,
  ]);

  /* ---- Check if there are unsaved changes ---- */
  const hasChanges =
    centerName.trim() !== '' ||
    organism.trim() !== '' ||
    masterUsername.trim() !== originalUsername.trim() ||
    newPassword.trim() !== '';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          {'Configuración'}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="glass-card sm:max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {'Configuración del Sistema'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando configuración...</p>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="centro" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Centro</span>
              </TabsTrigger>
              <TabsTrigger value="usuario" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Usuario</span>
              </TabsTrigger>
              <TabsTrigger value="contrasena" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Contraseña</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Centro Tab ─────────────────────────────────────────── */}
            <TabsContent value="centro" className="mt-4 space-y-4">
              <Card className="border-0 shadow-none bg-muted/30">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="center-name" className="text-sm font-medium">
                      Nombre del Centro
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="center-name"
                        placeholder="Ingrese el nombre del centro"
                        value={centerName}
                        onChange={(e) => setCenterName(e.target.value)}
                        className="h-10 pl-9"
                        disabled={isSaving}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Nombre de la organización o centro que aparecerá en los reportes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organism" className="text-sm font-medium">
                      Organismo
                    </Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="organism"
                        placeholder="Ingrese el organismo superior"
                        value={organism}
                        onChange={(e) => setOrganism(e.target.value)}
                        className="h-10 pl-9"
                        disabled={isSaving}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Organismo o entidad superior al que pertenece el centro.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Info badge */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-info-muted/50 border border-info/15">
                <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <p className="text-xs text-info">
                  Los cambios en el nombre del centro se reflejarán en los reportes y documentos generados por el sistema.
                </p>
              </div>
            </TabsContent>

            {/* ── Usuario Tab ────────────────────────────────────────── */}
            <TabsContent value="usuario" className="mt-4 space-y-4">
              <Card className="border-0 shadow-none bg-muted/30">
                <CardContent className="p-4 space-y-4">
                  {/* Current username display */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Usuario actual</Label>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-info-muted text-info hover:bg-info-muted font-mono"
                      >
                        <User className="h-3 w-3 mr-1" />
                        {originalUsername || '—'}
                      </Badge>
                    </div>
                  </div>

                  {/* New username */}
                  <div className="space-y-2">
                    <Label htmlFor="new-username" className="text-sm font-medium">
                      Nuevo nombre de usuario
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-username"
                        placeholder="Ingrese el nuevo nombre de usuario"
                        value={masterUsername}
                        onChange={(e) => setMasterUsername(e.target.value)}
                        className="h-10 pl-9"
                        disabled={isSaving}
                      />
                    </div>
                    {masterUsername.trim() !== originalUsername.trim() && masterUsername.trim() && (
                      <div className="flex items-center gap-1.5 text-xs text-warning">
                        <AlertCircle className="h-3 w-3" />
                        <span>El nombre de usuario cambiará al guardar</span>
                      </div>
                    )}
                  </div>

                  {/* Current password for username change */}
                  {masterUsername.trim() !== originalUsername.trim() && masterUsername.trim() && (
                    <div className="space-y-2">
                      <Label htmlFor="current-pass-username" className="text-sm font-medium">
                        Contraseña actual
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="current-pass-username"
                          type={showCurrentPassword ? 'text' : 'password'}
                          placeholder="Confirme su contraseña actual"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-10 pl-9 pr-10"
                          disabled={isSaving}
                          autoComplete="current-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          tabIndex={-1}
                          aria-label={showCurrentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60">
                        Se requiere su contraseña actual para cambiar el nombre de usuario.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Contraseña Tab ─────────────────────────────────────── */}
            <TabsContent value="contrasena" className="mt-4 space-y-4">
              <Card className="border-0 shadow-none bg-muted/30">
                <CardContent className="p-4 space-y-4">
                  {/* Current password */}
                  <div className="space-y-2">
                    <Label htmlFor="current-password" className="text-sm font-medium">
                      Contraseña actual
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Ingrese su contraseña actual"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-10 pl-9 pr-10"
                        disabled={isSaving}
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        tabIndex={-1}
                        aria-label={showCurrentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* New password */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium">
                      Nueva contraseña
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Ingrese la nueva contraseña"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-10 pl-9 pr-10"
                        disabled={isSaving}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Password strength indicator */}
                    {newPassword.trim() && (
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getStrengthBarColor(passwordStrength)} ${getStrengthBarWidth(passwordStrength)}`}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${getStrengthStyles(passwordStrength)} border-0`}
                          >
                            {getStrengthLabel(passwordStrength)}
                          </Badge>
                          {newPassword.trim().length < 4 && (
                            <span className="text-[11px] text-danger">
                              Mínimo 4 caracteres
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">
                      Confirmar nueva contraseña
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Repita la nueva contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-10 pl-9 pr-10"
                        disabled={isSaving}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {/* Match indicator */}
                    {confirmPassword.trim() && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {newPassword === confirmPassword ? (
                          <>
                            <Check className="h-3 w-3 text-success" />
                            <span className="text-success">Las contraseñas coinciden</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 text-danger" />
                            <span className="text-danger">Las contraseñas no coinciden</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Security notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-muted/40 border border-warning/15">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="text-xs text-warning">
                  <p className="font-medium">Aviso de seguridad</p>
                  <p className="mt-0.5 opacity-80">
                    Después de cambiar la contraseña, se recomienda cerrar sesión e iniciar sesión nuevamente con la nueva contraseña.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* ── Save button ───────────────────────────────────────────── */}
        {!isLoading && (
          <div className="pt-2 border-t border-border/50">
            <Button
              className="w-full gradient-primary text-primary-foreground font-medium shadow-card-md hover:shadow-card-lg transition-all duration-200"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Guardando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  <span>Guardar Cambios</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
