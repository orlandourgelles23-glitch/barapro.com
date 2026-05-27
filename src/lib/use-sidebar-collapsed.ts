/**
 * useSidebarCollapsed — lightweight external store for sidebar collapsed state.
 * Uses useSyncExternalStore pattern (same as media-query detection in sidebar.tsx).
 * No dependency on barapro-store — safe to use without touching logic files.
 *
 * Also manages a `data-sidebar-collapsed` attribute on <html> so CSS can react
 * to the state without JavaScript in the layout (avoids hydration mismatches).
 */

import { useEffect, useSyncExternalStore } from 'react';

let collapsed = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
  // Sync DOM attribute for CSS-based responsive margin
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-sidebar-collapsed', String(collapsed));
  }
}

export function setSidebarCollapsed(value: boolean) {
  if (collapsed !== value) {
    collapsed = value;
    // Persist in sessionStorage so it survives page reloads
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('barapro-sidebar-collapsed', String(value));
    }
    emitChange();
  }
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed(!collapsed);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return collapsed;
}

function getServerSnapshot() {
  return false;
}

// Restore from sessionStorage on module load
if (typeof window !== 'undefined') {
  try {
    const saved = sessionStorage.getItem('barapro-sidebar-collapsed');
    if (saved === 'true') {
      collapsed = true;
    }
    // Set initial DOM attribute
    document.documentElement.setAttribute('data-sidebar-collapsed', String(collapsed));
  } catch {
    // ignore
  }
}

export function useSidebarCollapsed() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep DOM attribute in sync on mount + changes
  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar-collapsed', String(value));
  }, [value]);

  return value;
}
