'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from './api';

export type Role = 'ADMIN' | 'ROSTER_MANAGER' | 'PROJECT_MANAGER' | 'COMPLIANCE_ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  role: Role;
  employeeId?: string | null;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    email?: string;
    phone?: string | null;
    status?: string;
    joinDate?: string;
    maxWeeklyHours?: number;
    preferredShifts?: string[];
    workforceCategory?: string;
    designation?: { id?: string; name: string; level?: number; isCritical?: boolean };
    department?: { id?: string; name: string; capacity?: number } | null;
    location?: { id?: string; name: string; timezone?: string; capacity?: number };
    project?: { id?: string; name: string; code?: string; clientName?: string | null; timezone?: string };
    reportingManager?: { id: string; name: string; employeeCode: string; email: string } | null;
    _count?: { directReports: number };
  } | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, employeeCode?: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = async () => {
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (email: string, password: string, employeeCode?: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', { email, password, employeeCode });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
