import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  isMaster: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True once zustand persist has rehydrated from localStorage */
  _hasHydrated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
  /** Validate stored token against the server. Auto-logout if invalid. */
  validateSession: () => Promise<boolean>;
}

/** Simple JWT format check — rejects old hex tokens from the pre-JWT system */
function isValidJwtFormat(token: string): boolean {
  // JWTs have 3 base64url parts separated by dots: header.payload.signature
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      validateSession: async () => {
        const { token, isAuthenticated } = get();

        // Not authenticated — nothing to validate
        if (!isAuthenticated || !token) {
          return false;
        }

        // Quick format check: reject old non-JWT tokens
        if (!isValidJwtFormat(token)) {
          console.warn('[auth] Stored token is not a valid JWT format — clearing session');
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }

        // Server-side validation: call /api/auth/validate
        try {
          const res = await fetch('/api/auth/validate', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            console.warn('[auth] Token validation failed (401) — clearing session');
            set({ user: null, token: null, isAuthenticated: false });
            return false;
          }

          const data = await res.json();
          if (!data.valid) {
            console.warn('[auth] Token invalid — clearing session');
            set({ user: null, token: null, isAuthenticated: false });
            return false;
          }

          return true;
        } catch (err) {
          console.warn('[auth] Token validation error — keeping session (might be transient)', err);
          // Don't logout on network errors — could be transient
          return true;
        }
      },
    }),
    {
      name: 'barapro-auth',
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated once zustand finishes reading localStorage
        if (state) {
          state._hasHydrated = true;
          state.setHasHydrated(true);
        }
      },
    }
  )
);

/**
 * Convenience hook: auto-logout on any 401 response.
 * Call this from any component that makes authenticated API calls.
 */
export function handleApiError(response: Response): boolean {
  if (response.status === 401) {
    const store = useAuthStore.getState();
    if (store.isAuthenticated) {
      store.logout();
    }
    return true; // was 401
  }
  return false; // not 401
}

/**
 * Auth-aware fetch wrapper. Automatically logs out on 401 responses.
 * Use this for all API calls instead of raw fetch.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = useAuthStore.getState();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  const response = await fetch(url, options);
  handleApiError(response);
  return response;
}
