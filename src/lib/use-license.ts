'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  validateLicenseKey,
  generateMachineId,
  getLocalLicenseKey,
  getCachedLicenseInfo,
  cacheLicenseInfo,
  saveLicenseToLocal,
  checkClockTampering,
  BUILT_IN_TRIAL_KEY,
  type LicenseInfo,
  type LicenseStatus,
} from '@/lib/license-engine';

export type LicenseGateStatus =
  | 'loading'
  | 'no_license'
  | 'active'
  | 'expired_grace'
  | 'expired'
  | 'invalid';

interface UseLicenseReturn {
  /** Current license info, null if no license */
  licenseInfo: LicenseInfo | null;
  /** Simplified gate status for UI decisions */
  gateStatus: LicenseGateStatus;
  /** True if license is valid (active or in grace period) */
  isValid: boolean;
  /** True if currently validating */
  isValidating: boolean;
  /** Machine ID for this device */
  machineId: string;
  /** Re-validate the license (e.g., after activation) */
  revalidate: () => Promise<void>;
  /** True if clock tampering was detected */
  clockTampered: boolean;
}

function deriveGateStatus(
  status: LicenseStatus | null,
  hasKey: boolean,
  clockOk: boolean
): LicenseGateStatus {
  // Clock tampering overrides everything
  if (!clockOk && hasKey) return 'invalid';

  switch (status) {
    case 'active':
      return 'active';
    case 'expired_grace':
      return 'expired_grace';
    case 'expired':
      return 'expired';
    case 'revoked':
    case 'suspended':
    case 'invalid':
      return 'invalid';
    case 'none':
    default:
      return hasKey ? 'invalid' : 'no_license';
  }
}

export function useLicense(): UseLicenseReturn {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [gateStatus, setGateStatus] = useState<LicenseGateStatus>('loading');
  const [isValidating, setIsValidating] = useState(true);
  const [machineId, setMachineId] = useState<string>('');
  const [clockTampered, setClockTampered] = useState(false);
  const mountedRef = useRef(true);

  const revalidate = useCallback(async () => {
    setIsValidating(true);

    try {
      // Generate or retrieve machine ID
      let mid = machineId;
      if (!mid) {
        try {
          mid = await generateMachineId();
          if (mountedRef.current) setMachineId(mid);
        } catch {
          mid = '';
        }
      }

      // Check clock tampering
      const clockCheck = checkClockTampering();
      if (mountedRef.current) {
        setClockTampered(!clockCheck.ok);
      }

      // Get local license key
      const localKey = getLocalLicenseKey();

      if (!localKey) {
        // No key stored locally — try the built-in trial license from the server
        // The seed script creates a trial license in the database.
        // If the server confirms it exists, auto-activate it locally.
        try {
          const { useAuthStore } = await import('@/lib/auth-store');
          const token = useAuthStore.getState().token;
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const serverRes = await fetch('/api/license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ action: 'status' }),
          });

          if (serverRes.ok) {
            const serverData = await serverRes.json();
            // If server has any license (even with 'invalid' status from RSA),
            // try the built-in trial key
            if (serverData.info || serverData.status) {
              // Try the built-in trial key
              const trialResult = await validateLicenseKey(BUILT_IN_TRIAL_KEY, mid);
              if (trialResult.valid && trialResult.info) {
                // Auto-activate the built-in trial license
                saveLicenseToLocal(BUILT_IN_TRIAL_KEY);
                cacheLicenseInfo(trialResult.info);
                if (mountedRef.current) {
                  setLicenseInfo(trialResult.info);
                  setGateStatus(deriveGateStatus(trialResult.info.status, true, clockCheck.ok));
                }
                return;
              }
            }
          }
        } catch {
          // Server check failed — try built-in trial key directly as last resort
          try {
            const trialResult = await validateLicenseKey(BUILT_IN_TRIAL_KEY, mid);
            if (trialResult.valid && trialResult.info) {
              saveLicenseToLocal(BUILT_IN_TRIAL_KEY);
              cacheLicenseInfo(trialResult.info);
              if (mountedRef.current) {
                setLicenseInfo(trialResult.info);
                setGateStatus(deriveGateStatus(trialResult.info.status, true, clockCheck.ok));
              }
              return;
            }
          } catch {
            // Even built-in trial failed — truly no license
          }
        }

        // No key stored — no license found anywhere
        if (mountedRef.current) {
          setLicenseInfo(null);
          setGateStatus('no_license');
        }
        return;
      }

      // Try cached info first for fast render
      const cached = getCachedLicenseInfo();
      if (cached && mountedRef.current) {
        setLicenseInfo(cached);
        // Optimistically set status from cache, will update after validation
        setGateStatus(deriveGateStatus(cached.status, true, clockCheck.ok));
      }

      // Validate against RSA signature
      try {
        const result = await validateLicenseKey(localKey, mid);

        if (mountedRef.current) {
          if (result.valid && result.info) {
            setLicenseInfo(result.info);
            cacheLicenseInfo(result.info);
            setGateStatus(deriveGateStatus(result.info.status, true, clockCheck.ok));
          } else if (result.info) {
            // License decoded but not valid (expired, etc.)
            setLicenseInfo(result.info);
            cacheLicenseInfo(result.info);
            setGateStatus(deriveGateStatus(result.info.status, true, clockCheck.ok));
          } else {
            // Completely invalid — remove stored key
            setLicenseInfo(null);
            setGateStatus(deriveGateStatus(result.status, true, clockCheck.ok));
          }
        }
      } catch {
        // Validation threw — use cached info if available, otherwise mark invalid
        if (mountedRef.current) {
          if (!cached) {
            setLicenseInfo(null);
            setGateStatus('invalid');
          }
          // If we have cached info, keep it — probably a transient error
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [machineId]);

  // Initial validation on mount
  useEffect(() => {
    mountedRef.current = true;
    revalidate();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isValid = gateStatus === 'active' || gateStatus === 'expired_grace';

  return {
    licenseInfo,
    gateStatus,
    isValid,
    isValidating,
    machineId,
    revalidate,
    clockTampered,
  };
}
