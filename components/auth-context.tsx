'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';


interface User {
  id: number;
  username: string;
  email?: string;
  phone_no?: string;
  role: string;
  status: string;
  allowed_pages?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  canAccess: (page: string) => boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem('auth_user');
    const storedToken = localStorage.getItem('auth_token');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    if (storedToken) {
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    localStorage.setItem('auth_token', data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  const isAdmin = user?.role === 'admin';

  const canAccess = (page: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin can access everything
    if (!user.allowed_pages) return false;
    return user.allowed_pages.includes(page);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
