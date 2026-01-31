'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api';
import type { User, UserRole, LoginCredentials } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  employeeId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedEmployeeId = localStorage.getItem('employeeId');

    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
    }

    if (token) {
      authApi.getMe()
        .then((data) => {
          setState({
            user: data,
            isLoading: false,
            isAuthenticated: true,
          });
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('employeeId');
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        });
    } else {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await authApi.login(credentials);
    localStorage.setItem('token', response.token);
    if (response.employeeId) {
      localStorage.setItem('employeeId', response.employeeId);
      setEmployeeId(response.employeeId);
    }

    const userData = await authApi.getMe();
    setState({
      user: userData,
      isLoading: false,
      isAuthenticated: true,
    });

    router.push('/dashboard');
  };

  const register = async (data: RegisterData) => {
    const response = await authApi.register(data);
    localStorage.setItem('token', response.token);
    if (response.employeeId) {
      localStorage.setItem('employeeId', response.employeeId);
      setEmployeeId(response.employeeId);
    }

    const userData = await authApi.getMe();
    setState({
      user: userData,
      isLoading: false,
      isAuthenticated: true,
    });

    // Redirect to onboarding after registration
    router.push('/onboarding');
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore logout errors
    }
    localStorage.removeItem('token');
    localStorage.removeItem('employeeId');
    setEmployeeId(null);
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (e) {
      // Ignore refresh errors
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, employeeId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(requiredRole?: UserRole) {
  const { user, isLoading, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }

    if (!isLoading && isAuthenticated && requiredRole && user?.role !== requiredRole) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, requiredRole, router]);

  return { user, isLoading, isAuthenticated, refreshUser };
}
