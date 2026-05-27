'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Copy,
  Check,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  validateLicenseKey,
  generateMachineId,
  getLocalLicenseKey,
  saveLicenseToLocal,
  removeLocalLicense,
  cacheLicenseInfo,
  getCachedLicenseInfo,
  getLicenseStatusText,
  getLicenseStatusColor,
  formatLicenseDate,
  FEATURE_LABELS,
  TIER_LABELS,
  type LicenseInfo,
  type LicenseStatus,
  type LicenseFeatures,
  type ValidationResult,
} from '@/lib/license-engine';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LicenseManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseActivated?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Status badge config                                                */
/* ------------------------------------------------------------------ */

function getStatusBadgeStyles(status: LicenseStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400';
    case 'expired_grace':
      return 'bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-400';
    case 'expired':
      return 'bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400';
    case 'revoked':
    case 'suspended':
      return 'bg-red-500/15 text-red-800 border-red-500/25 dark:text-red-400';
    case 'invalid':
      return 'bg-red-500/15 text-red-600 border-red-500/25 dark:text-red-400';
    case 'none':
    default:
      return 'bg-gray-500/15 text-gray-600 border-gray-500/25 dark:text-gray-400';
  }
}

function getStatusIcon(status: LicenseStatus) {
  switch (status) {
    case 'active':
      return <ShieldCheck className="h-4 w-4" />;
    case 'expired_grace':
      return <ShieldAlert className="h-4 w-4" />;
    case 'expired':
    case 'revoked':
    case 'suspended':
    case 'invalid':
      return <ShieldX className="h-4 w-4" />;
    case 'none':
    default:
      return <Shield className="h-4 w-4" />;
  }
}

function getProgressColor(status: LicenseStatus, daysRemaining: number): string {
  if (status === 'expired') return '[&>div]:bg-red-500';
  if (status === 'expired_grace') return '[&>div]:bg-amber-500';
  if (daysRemaining <= 14) return '[&>div]:bg-amber-500';
  if (daysRemaining <= 30) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-emerald-500';
}

/* ------------------------------------------------------------------ */
/*  License Manager Component                                          */
/* ------------------------------------------------------------------ */

export function LicenseManager({ isOpen, onClose, onLicenseActivated }: LicenseManagerProps) {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);

  // Load license info and machine ID on mount
  useEffect(() => {
    async function loadInfo() {
      // Get machine ID
      try {
        const mid = await generateMachineId();
        setMachineId(mid);
      } catch {
        setMachineId('No disponible');
      }

      // Try cached info first for fast render
      const cached = getCachedLicenseInfo();
      if (cached) {
        setLicenseInfo(cached);
      }

      // Then validate from stored key
      const storedKey = getLocalLicenseKey();
      if (storedKey) {
        try {
          const mid = await generateMachineId();
          const result = await validateLicenseKey(storedKey, mid);
          if (result.info) {
            setLicenseInfo(result.info);
            cacheLicenseInfo(result.info);
          } else {
            setLicenseInfo(null);
          }
        } catch {
          // Validation failed — keep cached info if available
        }
      }
    }

    if (isOpen) {
      loadInfo();
    }
  }, [isOpen]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLicenseKey(text.trim());
      setValidationResult(null);
      setActivationError(null);
    } catch {
      // Clipboard API not available — user must paste manually
    }
  }, []);

  const handleValidateAndActivate = useCallback(async () => {
    if (!licenseKey.trim()) {
      setActivationError('Ingrese una clave de licencia.');
      return;
    }

    setIsValidating(true);
    setActivationError(null);
    setActivationSuccess(false);

    try {
      const mid = await generateMachineId();
      const result = await validateLicenseKey(licenseKey.trim(), mid);
      setValidationResult(result);

      if (result.valid && result.info) {
        // Save to local storage
        saveLicenseToLocal(licenseKey.trim());
        cacheLicenseInfo(result.info);
        setLicenseInfo(result.info);
        setActivationSuccess(true);

        // Also notify server
        try {
          await fetch('/api/license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'activate',
              key: licenseKey.trim(),
              machineId: mid,
            }),
          });
        } catch {
          // Server notification failed — local activation still works
        }

        onLicenseActivated?.();
      } else {
        setActivationError(result.errors.join('. ') || 'Clave de licencia inválida.');
      }
    } catch {
      setActivationError('Error al validar la licencia. Intente nuevamente.');
    } finally {
      setIsValidating(false);
    }
  }, [licenseKey, onLicenseActivated]);

  const handleDeactivate = useCallback(async () => {
    removeLocalLicense();
    setLicenseInfo(null);
    setLicenseKey('');
    setValidationResult(null);
    setActivationSuccess(false);
    setActivationError(null);

    try {
      await fetch('/api/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });
    } catch {
      // Server notification failed
    }
  }, []);

  const copyMachineId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      setTimeout(() => setCopiedMachineId(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [machineId]);

  // Compute progress value
  const progressValue = licenseInfo
    ? Math.max(0, Math.min(100, Math.round((licenseInfo.daysRemaining / 365) * 100)))
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="glass-card sm:max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Gestión de Licencia
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="status" className="flex-1">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Estado
            </TabsTrigger>
            <TabsTrigger value="activate" className="flex-1">
              <Key className="h-3.5 w-3.5 mr-1.5" />
              Activar
            </TabsTrigger>
          </TabsList>

          {/* ── Status Tab ─────────────────────────────────────────── */}
          <TabsContent value="status" className="mt-4 space-y-4">
            {licenseInfo ? (
              <>
                {/* Status badge & tier */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(licenseInfo.status)}
                    <Badge
                      variant="outline"
                      className={getStatusBadgeStyles(licenseInfo.status)}
                    >
                      {getLicenseStatusText(licenseInfo.status)}
                    </Badge>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20"
                  >
                    {TIER_LABELS[licenseInfo.tier]}
                  </Badge>
                </div>

                {/* License details card */}
                <Card className="border-0 shadow-none bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Licenciatario
                        </p>
                        <p className="font-medium text-foreground truncate">
                          {licenseInfo.licensee || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Usuarios máximos
                        </p>
                        <p className="font-medium text-foreground">
                          {licenseInfo.maxUsers === 999 ? 'Ilimitados' : licenseInfo.maxUsers}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Emitida
                        </p>
                        <p className="font-medium text-foreground text-fin-sm">
                          {formatLicenseDate(licenseInfo.issuedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Expira
                        </p>
                        <p className={`font-medium ${getLicenseStatusColor(licenseInfo.status)}`}>
                          {formatLicenseDate(licenseInfo.expiresAt)}
                        </p>
                      </div>
                    </div>

                    {/* Days remaining progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Días restantes</span>
                        <span className={`font-mono font-semibold ${getLicenseStatusColor(licenseInfo.status)}`}>
                          {licenseInfo.daysRemaining} / 365
                        </span>
                      </div>
                      <Progress
                        value={progressValue}
                        className={`h-2 ${getProgressColor(licenseInfo.status, licenseInfo.daysRemaining)}`}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Warning messages */}
                {licenseInfo.warnings.length > 0 && (
                  <div className="space-y-2">
                    {licenseInfo.warnings.map((warning, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
                      >
                        <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grace period warning */}
                {licenseInfo.isGracePeriod && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20">
                    <ShieldAlert className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                    <p className="text-sm text-danger">
                      Su licencia ha expirado pero está en período de gracia. Renueve a la brevedad.
                    </p>
                  </div>
                )}

                {/* Feature list */}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Funcionalidades incluidas
                  </p>
                  <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {(Object.entries(licenseInfo.features) as [keyof LicenseFeatures, boolean][]).map(
                      ([feature, enabled]) => (
                        <div
                          key={feature}
                          className={`flex items-center gap-1.5 text-[11px] py-0.5 ${
                            enabled ? 'text-foreground' : 'text-muted-foreground/40 line-through'
                          }`}
                        >
                          {enabled ? (
                            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className="truncate">{FEATURE_LABELS[feature]}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Machine ID */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    ID de Máquina
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] font-mono bg-muted/60 rounded-md px-3 py-1.5 truncate text-muted-foreground">
                      {machineId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={copyMachineId}
                      title="Copiar ID de máquina"
                    >
                      {copiedMachineId ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Deactivate button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-danger border-danger/30 hover:bg-danger/10 hover:text-danger"
                    onClick={handleDeactivate}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Desactivar Licencia
                  </Button>
                </div>
              </>
            ) : (
              /* No license state */
              <div className="text-center py-8 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mx-auto">
                  <Shield className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Sin Licencia Activa</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Active una licencia para acceder a todas las funcionalidades de BARAPRO.
                  </p>
                </div>

                {/* Machine ID still shown when no license */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    ID de Máquina
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] font-mono bg-muted/60 rounded-md px-3 py-1.5 truncate text-muted-foreground">
                      {machineId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={copyMachineId}
                      title="Copiar ID de máquina"
                    >
                      {copiedMachineId ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/50">
                  Proporcione el ID de máquina a su proveedor para obtener una licencia.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Activate Tab ────────────────────────────────────────── */}
          <TabsContent value="activate" className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="license-key" className="text-sm font-medium">
                  Clave de Licencia
                </Label>
                <Textarea
                  id="license-key"
                  placeholder="DETOA-{NIVEL}-{clave}"
                  value={licenseKey}
                  onChange={(e) => {
                    setLicenseKey(e.target.value);
                    setValidationResult(null);
                    setActivationError(null);
                    setActivationSuccess(false);
                  }}
                  className="font-mono text-sm min-h-[80px] resize-none"
                  disabled={isValidating}
                />
              </div>

              {/* Format hint */}
              <p className="text-[11px] text-muted-foreground/60">
                Formato: <code className="font-mono text-muted-foreground/80">DETOA-{'{NIVEL}'}-{'{clave}'}</code>
              </p>

              {/* Paste from clipboard */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handlePasteFromClipboard}
                disabled={isValidating}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Pegar del portapapeles
              </Button>

              {/* Activation error */}
              {activationError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 animate-fade-in-up">
                  <ShieldX className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                  <p className="text-sm text-danger">{activationError}</p>
                </div>
              )}

              {/* Activation success */}
              {activationSuccess && validationResult?.info && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in-up">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                      ¡Licencia activada exitosamente!
                    </p>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 text-xs mt-0.5">
                      {validationResult.info.licensee} — {TIER_LABELS[validationResult.info.tier]}
                    </p>
                  </div>
                </div>
              )}

              {/* Validation result warnings */}
              {validationResult?.warnings && validationResult.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {validationResult.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/15"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Validate & Activate button */}
              <Button
                className="w-full gradient-primary text-primary-foreground font-medium shadow-card-md hover:shadow-card-lg transition-all duration-200"
                onClick={handleValidateAndActivate}
                disabled={isValidating || !licenseKey.trim()}
              >
                {isValidating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Validando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Validar y Activar</span>
                  </div>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
