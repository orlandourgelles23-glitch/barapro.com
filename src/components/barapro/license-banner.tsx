'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Key,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getLicenseStatusText,
  formatLicenseDate,
  TIER_LABELS,
  type LicenseInfo,
} from '@/lib/license-engine';
import { LicenseManager } from '@/components/barapro/license-manager';
import type { LicenseGateStatus } from '@/lib/use-license';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LicenseBannerProps {
  gateStatus: LicenseGateStatus;
  licenseInfo: LicenseInfo | null;
  onLicenseActivated: () => void;
}

/* ------------------------------------------------------------------ */
/*  Banner config helper                                               */
/* ------------------------------------------------------------------ */

interface BannerConfig {
  icon: React.ReactNode;
  message: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  iconColor: string;
  btnVariant: string;
}

function getBannerConfig(gateStatus: LicenseGateStatus, licenseInfo: LicenseInfo | null): BannerConfig | null {
  if (!licenseInfo) return null;

  switch (gateStatus) {
    case 'expired_grace':
      return {
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        message: `Periodo de gracia — Su licencia expiro el ${formatLicenseDate(licenseInfo.expiresAt)}. Renueve a la brevedad.`,
        bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
        textColor: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-500/25',
        iconColor: 'text-amber-600 dark:text-amber-400',
        btnVariant: 'text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300',
      };
    case 'active': {
      const days = licenseInfo.daysRemaining;
      if (days <= 14) {
        return {
          icon: <Clock className="h-3.5 w-3.5" />,
          message: `Licencia expira en ${days} dia${days !== 1 ? 's' : ''} (${formatLicenseDate(licenseInfo.expiresAt)}). Renueve pronto.`,
          bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
          textColor: 'text-amber-700 dark:text-amber-400',
          borderColor: 'border-amber-500/25',
          iconColor: 'text-amber-600 dark:text-amber-400',
          btnVariant: 'text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300',
        };
      }
      if (days <= 30) {
        return {
          icon: <ShieldCheck className="h-3.5 w-3.5" />,
          message: `Licencia ${TIER_LABELS[licenseInfo.tier]} expira en ${days} dias.`,
          bgColor: 'bg-yellow-500/10 dark:bg-yellow-500/10',
          textColor: 'text-yellow-700 dark:text-yellow-400',
          borderColor: 'border-yellow-500/20',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          btnVariant: 'text-yellow-700 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300',
        };
      }
      return null; // No banner for healthy licenses
    }
    case 'expired':
      return {
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        message: `Licencia expirada el ${formatLicenseDate(licenseInfo.expiresAt)}. Renueve para continuar.`,
        bgColor: 'bg-red-500/10 dark:bg-red-500/15',
        textColor: 'text-red-700 dark:text-red-400',
        borderColor: 'border-red-500/25',
        iconColor: 'text-red-600 dark:text-red-400',
        btnVariant: 'text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300',
      };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  LicenseBanner Component                                            */
/* ------------------------------------------------------------------ */

export function LicenseBanner({ gateStatus, licenseInfo, onLicenseActivated }: LicenseBannerProps) {
  const [showManager, setShowManager] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const config = getBannerConfig(gateStatus, licenseInfo);

  // Don't render if no config or dismissed
  if (!config || dismissed) return null;

  return (
    <>
      <div
        className={`w-full h-9 flex items-center px-3 sm:px-4 border-b ${config.bgColor} ${config.borderColor} shrink-0 animate-fade-in-up`}
        role="alert"
      >
        {/* Icon */}
        <span className={`${config.iconColor} shrink-0`}>
          {config.icon}
        </span>

        {/* Message */}
        <p className={`flex-1 text-fin-xs font-medium ${config.textColor} ml-2 truncate`}>
          {config.message}
        </p>

        {/* Manage license button */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-fin-xs font-medium ${config.btnVariant} shrink-0 ml-2`}
          onClick={() => setShowManager(true)}
        >
          <Key className="h-3 w-3 mr-1" />
          Gestionar Licencia
        </Button>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 shrink-0 ml-1 ${config.btnVariant}`}
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* License Manager dialog */}
      <LicenseManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        onLicenseActivated={onLicenseActivated}
      />
    </>
  );
}
