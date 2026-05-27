'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';
import { toast } from 'sonner';
import {
  V10_DATA_SLICES,
  BARAPRO_FORMAT_VERSION,
  saveBackup,
  estimateDataSize,
  formatBytes,
  LOCALSTORAGE_WARNING_THRESHOLD,
} from '@/lib/barapro-v10';

const STORAGE_KEY = 'barapro_autosave';
const PROJECTS_KEY = 'barapro_projects_list';
const CURRENT_PROJECT_KEY = 'barapro_current_project_id';

/**
 * Auto-save hook: saves the entire BARAPRO state to localStorage
 * on every change, with debouncing to avoid excessive writes.
 * V10: Includes all 27 data slices, backup rotation, size monitoring.
 */
export function useAutoSave() {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const lastSavedRef = useRef<string>('');
  const isRestoredRef = useRef(false);

  // Extract saveable state (exclude navigation and UI state) — ALL 27 slices
  const getSaveableState = useCallback(() => {
    const store = useBaraproStore.getState();
    const data: Record<string, any> = {};
    for (const key of V10_DATA_SLICES) {
      data[key] = (store as any)[key];
    }
    return {
      ...data,
      savedAt: new Date().toISOString(),
      version: BARAPRO_FORMAT_VERSION,
    };
  }, []);

  // Save to localStorage with backup rotation and size monitoring
  const save = useCallback(() => {
    try {
      const state = getSaveableState();
      const json = JSON.stringify(state);
      lastSavedRef.current = json;

      // Size check — warn if approaching localStorage limits
      const size = estimateDataSize(state);
      if (size > LOCALSTORAGE_WARNING_THRESHOLD) {
        console.warn(
          `[BARAPRO V10] Autosave data is ${formatBytes(size)}, approaching localStorage limit. ` +
          `Consider exporting to .barapro or Excel file.`
        );
      }

      localStorage.setItem(STORAGE_KEY, json);

      // Also create a backup entry (rotated, keeps last 3)
      saveBackup(state);

      // Also update the project in the projects list if there's a current project
      try {
        const currentId = localStorage.getItem(CURRENT_PROJECT_KEY);
        if (currentId) {
          const projectsList = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
          const idx = projectsList.findIndex((p: any) => p.id === currentId);
          if (idx >= 0) {
            projectsList[idx].data = state;
            projectsList[idx].updatedAt = new Date().toISOString();
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsList));
          }
        }
      } catch {
        // silently fail if project list is corrupted
      }

      setSaveStatus('saved');
    } catch (err) {
      console.error('Error guardando:', err);

      // If localStorage is full, try to clear old backups to make space
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        try {
          // Clear oldest backups first
          const backupKeys = Object.keys(localStorage)
            .filter(k => k.startsWith('barapro_backup_'))
            .sort();
          for (const key of backupKeys) {
            localStorage.removeItem(key);
          }
          // Try saving again
          const state = getSaveableState();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          setSaveStatus('saved');
          toast.warning('Espacio de almacenamiento limitado. Se eliminaron respaldos antiguos.');
        } catch {
          setSaveStatus('error');
          toast.error('No se pudo guardar: almacenamiento lleno. Exporte su proyecto a archivo .barapro.');
        }
      } else {
        setSaveStatus('error');
      }
    }
  }, [getSaveableState]);

  // Restore from localStorage (only once on mount)
  useEffect(() => {
    if (isRestoredRef.current) return;
    isRestoredRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.version) {
          // V10: Use migration logic for older format versions
          const version = data.version || '3.0';
          const major = Number(version.split('.')[0]) || 0;

          // Ensure all V10 slices are present (fill missing with defaults)
          if (major < 10) {
            for (const key of V10_DATA_SLICES) {
              if (!(key in data)) {
                if (key === 'project') { /* keep as-is */ }
                else if (key === 'parameters') { /* keep as-is */ }
                else if (key === 'logicalFramework') { data[key] = { rows: [] }; }
                else { data[key] = []; }
              }
            }

            // Convert decimal rates to integer percentages (pre-V10 convention)
            if (data.parameters && typeof data.parameters === 'object') {
              const RATE_KEYS = [
                'incomeTaxRate', 'salesTaxRate', 'specialSocialSecurityRate',
                'taxOnWorkforceRate', 'personalIncomeTaxRate', 'workerSocialSecurityRate',
                'territorialTaxRate', 'honorariosAdminRate',
                'discountRateCUP', 'discountRateMLC', 'minimumAcceptableRate', 'inflationRate',
                'contingencyReserveRate', 'operationsContingencyRate', 'retainedEarningsRate',
                'dividendCAMRate', 'projectAccountRate', 'arieRate', 'reservasEstimulacionRate',
                'beneficioReinvertirRate', 'canonRoyaltiesRate', 'otrosGastosVariablesPct',
                'otrasReservasVoluntariasRate', 'dividendoEstatalPct',
                'dividendoSocioCubanoPct', 'dividendoSocioExtranjeroPct',
                'bankFeeRate', 'vacationNormRate', 'salaryComplementRate',
                'residualValuePercent',
              ];
              let needsConversion = false;
              for (const rk of RATE_KEYS) {
                const v = data.parameters[rk];
                if (typeof v === 'number' && v > 0 && v < 1) {
                  needsConversion = true;
                  break;
                }
              }
              if (needsConversion) {
                for (const rk of RATE_KEYS) {
                  const v = data.parameters[rk];
                  if (typeof v === 'number' && v > 0 && v < 1) {
                    data.parameters[rk] = Math.round(v * 10000) / 100;
                  }
                }
                // Also convert residualPercent inside assetCategoryRates
                if (Array.isArray(data.parameters.assetCategoryRates)) {
                  for (const cat of data.parameters.assetCategoryRates) {
                    if (cat && typeof cat.residualPercent === 'number' && cat.residualPercent > 0 && cat.residualPercent < 1) {
                      cat.residualPercent = Math.round(cat.residualPercent * 100);
                    }
                  }
                }
              }
            }
          }

          useBaraproStore.getState().loadFromExcel(data);
          const savedDate = data.savedAt ? new Date(data.savedAt).toLocaleString('es-CU') : '';
          if (savedDate) {
            // Delay toast slightly so it appears after the UI renders
            setTimeout(() => {
              toast.info(`Datos restaurados automáticamente (guardado: ${savedDate})`);
            }, 500);
          }
        }
      }
    } catch (err) {
      console.error('Error restaurando datos:', err);
      // Try to restore from backup
      try {
        const backupKeys = Object.keys(localStorage)
          .filter(k => k.startsWith('barapro_backup_'))
          .sort()
          .reverse();

        if (backupKeys.length > 0) {
          const latestBackup = localStorage.getItem(backupKeys[0]);
          if (latestBackup) {
            const data = JSON.parse(latestBackup);
            useBaraproStore.getState().loadFromExcel(data);
            toast.warning('Datos restaurados desde respaldo de emergencia');
          }
        }
      } catch {
        // Even backup restore failed — nothing we can do
      }
    }
  }, []);

  // Subscribe to store changes and auto-save with debounce
  useEffect(() => {
    const unsub = useBaraproStore.subscribe(() => {
      setSaveStatus('unsaved');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        save();
      }, 800); // Save 800ms after last change
    });

    return () => {
      unsub();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Flush pending save before unmount to prevent data loss
        save();
      }
    };
  }, [save]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    lastSavedRef.current = '';
    setSaveStatus('saved');
  }, []);

  // Force save
  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setSaveStatus('saving');
    save();
  }, [save]);

  return { saveStatus, clearSavedData, forceSave };
}
