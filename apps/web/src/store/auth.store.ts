'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  role: string;
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
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('sankoerp_token', token);
        document.cookie = `sankoerp_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('sankoerp_token');
        document.cookie = 'sankoerp_token=; path=/; max-age=0';
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'sankoerp-auth' },
  ),
);
