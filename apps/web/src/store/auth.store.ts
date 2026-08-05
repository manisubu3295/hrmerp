'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string | null;
  persona?: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  } | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string, refreshToken?: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

// One-time migration from the pre-rebrand 'sankoerp_*' storage keys, so
// users logged in before the Aadhirai HRM OS rename aren't hard-logged-out.
// Safe to remove once no meaningful population of browsers still has the old
// keys set.
function migrateLegacyAuthKeys(): void {
  // Zustand's own persisted state (user/token/isAuthenticated) — must be
  // migrated before persist() below reads it on store creation.
  if (!localStorage.getItem('aadhirai-auth')) {
    const legacyPersisted = localStorage.getItem('sankoerp-auth');
    if (legacyPersisted) localStorage.setItem('aadhirai-auth', legacyPersisted);
  }
  localStorage.removeItem('sankoerp-auth');

  if (localStorage.getItem('aadhirai_token')) return;
  const legacyToken = localStorage.getItem('sankoerp_token');
  const legacyRefresh = localStorage.getItem('sankoerp_refresh_token');
  if (legacyToken) {
    localStorage.setItem('aadhirai_token', legacyToken);
    document.cookie = `aadhirai_token=${legacyToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  }
  if (legacyRefresh) localStorage.setItem('aadhirai_refresh_token', legacyRefresh);
  localStorage.removeItem('sankoerp_token');
  localStorage.removeItem('sankoerp_refresh_token');
  document.cookie = 'sankoerp_token=; path=/; max-age=0';
}
migrateLegacyAuthKeys();

// Single source of truth is the zustand store (persisted to localStorage under
// 'aadhirai-auth'). The raw 'aadhirai_token'/'aadhirai_refresh_token' localStorage
// keys and the cookie are kept in sync alongside it — api.ts's axios interceptor
// reads the raw key directly (simpler than importing the store there), so all
// three must be written/cleared together, which is why setAuth/clearAuth live
// here as the only place that's allowed to touch them.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) => {
        localStorage.setItem('aadhirai_token', token);
        document.cookie = `aadhirai_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        if (refreshToken) {
          localStorage.setItem('aadhirai_refresh_token', refreshToken);
        }
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true });
      },
      setAccessToken: (token) => {
        localStorage.setItem('aadhirai_token', token);
        document.cookie = `aadhirai_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        set({ token });
      },
      clearAuth: () => {
        localStorage.removeItem('aadhirai_token');
        localStorage.removeItem('aadhirai_refresh_token');
        document.cookie = 'aadhirai_token=; path=/; max-age=0';
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    { name: 'aadhirai-auth' },
  ),
);
