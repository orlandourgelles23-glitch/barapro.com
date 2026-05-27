'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  Copy,
  Check,
  AlertTriangle,
  Fingerprint,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  validateLicenseKey,
  generateMachineId,
  saveLicenseToLocal,
  cacheLicenseInfo,
  getLicenseStatusText,
  getLicenseStatusColor,
  formatLicenseDate,
  TIER_LABELS,
  type LicenseInfo,
  type LicenseStatus,
  type ValidationResult,
} from '@/lib/license-engine';
import type { LicenseGateStatus } from '@/lib/use-license';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LicenseGateProps {
  gateStatus: LicenseGateStatus;
  licenseInfo: LicenseInfo | null;
  machineId: string;
  isValidating: boolean;
  clockTampered: boolean;
  onLicenseActivated: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helper: status config                                              */
/* ------------------------------------------------------------------ */

function getStatusConfig(status: LicenseGateStatus, licenseInfo: LicenseInfo | null) {
  switch (status) {
    case 'expired':
      return {
        icon: <ShieldX className="h-12 w-12" />,
        title: 'Licencia Expirada',
        subtitle: licenseInfo
          ? `La licencia de ${licenseInfo.licensee || 'este equipo'} expiró el ${formatLicenseDate(licenseInfo.expiresAt)}. Renueve para continuar.`
          : 'Su licencia ha expirado. Renueve para continuar usando el sistema.',
        accentColor: 'text-red-500',
        gradientFrom: 'from-red-500/20',
        gradientTo: 'to-red-600/5',
        badgeVariant: 'bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400' as const,
      };
    case 'invalid':
      return {
        icon: <ShieldAlert className="h-12 w-12" />,
        title: 'Licencia Invalida',
        subtitle: 'La clave de licencia almacenada no es valida o ha sido alterada. Contacte al proveedor.',
        accentColor: 'text-red-500',
        gradientFrom: 'from-red-500/20',
        gradientTo: 'to-red-600/5',
        badgeVariant: 'bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400' as const,
      };
    case 'no_license':
    default:
      return {
        icon: <Lock className="h-12 w-12" />,
        title: 'Activacion de Licencia',
        subtitle: 'Se requiere una licencia valida para acceder a BARAPRO. Ingrese su clave de activacion.',
        accentColor: 'text-primary',
        gradientFrom: 'from-primary/20',
        gradientTo: 'to-primary/5',
        badgeVariant: 'bg-primary/10 text-primary border-primary/20' as const,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  LicenseGate Component                                              */
/* ------------------------------------------------------------------ */

export function LicenseGate({
  gateStatus,
  licenseInfo,
  machineId,
  isValidating: parentValidating,
  clockTampered,
  onLicenseActivated,
}: LicenseGateProps) {
  // Don't render for active, grace period, or loading states
  if (gateStatus === 'loading' || gateStatus === 'active' || gateStatus === 'expired_grace') {
    return null;
  }

  return (
    <LicenseGateOverlay
      gateStatus={gateStatus}
      licenseInfo={licenseInfo}
      machineId={machineId}
      parentValidating={parentValidating}
      clockTampered={clockTampered}
      onLicenseActivated={onLicenseActivated}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Inner overlay (always rendered when gate is active)                */
/* ------------------------------------------------------------------ */

function LicenseGateOverlay({
  gateStatus,
  licenseInfo,
  machineId,
  parentValidating,
  clockTampered,
  onLicenseActivated,
}: {
  gateStatus: LicenseGateStatus;
  licenseInfo: LicenseInfo | null;
  machineId: string;
  parentValidating: boolean;
  clockTampered: boolean;
  onLicenseActivated: () => void;
}) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [copiedMachineId, setCopiedMachineId] = useState(false);

  const config = getStatusConfig(gateStatus, licenseInfo);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLicenseKey(text.trim());
      setValidationResult(null);
      setActivationError(null);
    } catch {
      // Clipboard API not available
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
        setActivationSuccess(true);

        // Notify server
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

        // Notify parent to revalidate
        setTimeout(() => {
          onLicenseActivated();
        }, 1500);
      } else {
        setActivationError(result.errors.join('. ') || 'Clave de licencia invalida.');
      }
    } catch {
      setActivationError('Error al validar la licencia. Intente nuevamente.');
    } finally {
      setIsValidating(false);
    }
  }, [licenseKey, onLicenseActivated]);

  const copyMachineId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      setTimeout(() => setCopiedMachineId(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [machineId]);

  const isLoading = isValidating || parentValidating;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Radial gradient overlay */}
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--color-primary)/10%,transparent_60%)]`} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4 my-8 animate-fade-scale">
        <div className="glass-card rounded-2xl shadow-card-xl overflow-hidden">
          {/* Header with gradient */}
          <div className={`relative px-6 pt-8 pb-6 bg-gradient-to-b ${config.gradientFrom} ${config.gradientTo}`}>
            {/* Shield + Branding */}
            <div className="flex flex-col items-center text-center space-y-3">
              {/* Shield icon */}
              <div className="relative">
                <div className={`p-4 rounded-2xl glass ${config.accentColor}`}>
                  {config.icon}
                </div>
                {/* Pulse ring */}
                <div className={`absolute inset-0 rounded-2xl ${config.accentColor} opacity-20 animate-ping`} style={{ animationDuration: '3s' }} />
              </div>

              {/* BARAPRO branding */}
              <div>
                <div className="flex items-center justify-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-fin-xl font-bold tracking-tight">BARAPRO</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                    v10.1
                  </Badge>
                </div>
                <h1 className="text-fin-lg font-semibold text-foreground mt-2">
                  {config.title}
                </h1>
                <p className="text-fin-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  {config.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-4 space-y-4">
            {/* Clock tampering warning */}
            {clockTampered && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 animate-fade-in-up">
                <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                <div className="text-fin-sm">
                  <p className="text-danger font-medium">Anomalia del reloj detectada</p>
                  <p className="text-danger/70 text-fin-xs mt-0.5">
                    Se ha detectado una modificacion en la fecha/hora del sistema. Corrija el reloj e intente nuevamente.
                  </p>
                </div>
              </div>
            )}

            {/* Expired license info card */}
            {licenseInfo && gateStatus === 'expired' && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-fin-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Licencia anterior
                  </span>
                  <Badge variant="outline" className={config.badgeVariant}>
                    {getLicenseStatusText(licenseInfo.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-fin-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Licenciatario</p>
                    <p className="font-medium text-foreground truncate">{licenseInfo.licensee || '--'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nivel</p>
                    <p className="font-medium text-foreground">{TIER_LABELS[licenseInfo.tier]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Emitida</p>
                    <p className="text-foreground">{formatLicenseDate(licenseInfo.issuedAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expiro</p>
                    <p className={getLicenseStatusColor(licenseInfo.status)}>
                      {formatLicenseDate(licenseInfo.expiresAt)}
                    </p>
                  </div>
                </div>
                <p className="text-fin-xs text-danger font-medium pt-1">
                  Renueve su licencia para continuar usando el sistema.
                </p>
              </div>
            )}

            {/* Activation form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gate-license-key" className="text-fin-sm font-medium">
                  Clave de Licencia
                </Label>
                <Textarea
                  id="gate-license-key"
                  placeholder="DETOA-{NIVEL}-{clave}"
                  value={licenseKey}
                  onChange={(e) => {
                    setLicenseKey(e.target.value);
                    setValidationResult(null);
                    setActivationError(null);
                    setActivationSuccess(false);
                  }}
                  className="font-mono text-fin-sm min-h-[80px] resize-none"
                  disabled={isLoading}
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
                disabled={isLoading}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Pegar del portapapeles
              </Button>

              {/* Activation error */}
              {activationError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 animate-fade-in-up">
                  <ShieldX className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                  <p className="text-fin-sm text-danger">{activationError}</p>
                </div>
              )}

              {/* Activation success */}
              {activationSuccess && validationResult?.info && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in-up">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-fin-sm">
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Licencia activada exitosamente!
                    </p>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 text-fin-xs mt-0.5">
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
                      <p className="text-fin-xs text-amber-700 dark:text-amber-400">{warning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Validate & Activate button */}
              <Button
                className="w-full gradient-primary text-primary-foreground font-medium shadow-card-md hover:shadow-card-lg transition-all duration-200"
                onClick={handleValidateAndActivate}
                disabled={isLoading || !licenseKey.trim()}
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

            {/* Machine ID section */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Fingerprint className="h-3 w-3 text-muted-foreground" />
                <p className="text-fin-xs font-medium uppercase tracking-wider text-muted-foreground">
                  ID de Maquina
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-muted/60 rounded-md px-3 py-1.5 truncate text-muted-foreground">
                  {machineId || 'Cargando...'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={copyMachineId}
                  disabled={!machineId}
                  title="Copiar ID de maquina"
                >
                  {copiedMachineId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Envie este ID a su proveedor para obtener una licencia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
