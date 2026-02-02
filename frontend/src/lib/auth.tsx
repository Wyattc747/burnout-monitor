'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api';
import type { User, UserRole, LoginCredentials, RegisterOrganizationData, AcceptInvitationData, SubscriptionTier } from '@/types';

// ============================================
// PERMISSIONS SYSTEM
// ============================================

// Define granular permissions
export type Permission =
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  | 'team:read'
  | 'team:write'
  | 'departments:read'
  | 'departments:write'
  | 'departments:delete'
  | 'organization:read'
  | 'organization:write'
  | 'billing:read'
  | 'billing:update'
  | 'integrations:read'
  | 'integrations:write'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'audit:read';

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'employees:read', 'employees:write', 'employees:delete',
    'team:read', 'team:write',
    'departments:read', 'departments:write', 'departments:delete',
    'organization:read', 'organization:write',
    'billing:read', 'billing:update',
    'integrations:read', 'integrations:write',
    'users:read', 'users:write', 'users:delete',
    'audit:read',
  ],
  admin: [
    'employees:read', 'employees:write', 'employees:delete',
    'team:read', 'team:write',
    'departments:read', 'departments:write', 'departments:delete',
    'organization:read', 'organization:write',
    'billing:read',
    'integrations:read', 'integrations:write',
    'users:read', 'users:write',
    'audit:read',
  ],
  manager: [
    'employees:read',
    'team:read', 'team:write',
    'departments:read',
    'organization:read',
  ],
  employee: [
    'organization:read',
  ],
};

// ============================================
// TYPES
// ============================================

interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  subscriptionTier: SubscriptionTier;
  isDemoAccount: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  organization: OrganizationContext | null;
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
  registerOrganization: (data: RegisterOrganizationData) => Promise<void>;
  acceptInvitation: (data: AcceptInvitationData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  employeeId: string | null;
  // Permission helpers
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  // Role helpers
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isManager: () => boolean;
  isManagerOrAbove: () => boolean;
  canManageUser: (targetRole: UserRole) => boolean;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    organization: null,
  });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const router = useRouter();

  // Build organization context from user data
  const buildOrganizationContext = useCallback((user: User): OrganizationContext | null => {
    if (!user.organizationId) return null;
    return {
      id: user.organizationId,
      name: user.organizationName || '',
      slug: user.organizationSlug || '',
      logoUrl: user.organizationLogo,
      subscriptionTier: user.subscriptionTier || 'trial',
      isDemoAccount: user.isDemoAccount || false,
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('token');
    const storedEmployeeId = localStorage.getItem('employeeId');

    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
    }

    if (token) {
      authApi.getMe()
        .then((data) => {
          if (isMounted) {
            setState({
              user: data,
              isLoading: false,
              isAuthenticated: true,
              organization: buildOrganizationContext(data),
            });
          }
        })
        .catch(() => {
          if (isMounted) {
            localStorage.removeItem('token');
            localStorage.removeItem('employeeId');
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
              organization: null,
            });
          }
        });
    } else {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        organization: null,
      });
    }

    return () => {
      isMounted = false;
    };
  }, [buildOrganizationContext]);

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
      organization: buildOrganizationContext(userData),
    });

    // Route based on role
    if (userData.role === 'super_admin' || userData.role === 'admin') {
      router.push('/admin/dashboard');
    } else {
      router.push('/dashboard');
    }
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
      organization: buildOrganizationContext(userData),
    });

    // Redirect to onboarding after registration
    router.push('/onboarding');
  };

  const registerOrganization = async (data: RegisterOrganizationData) => {
    const response = await authApi.registerOrganization(data);
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
      organization: buildOrganizationContext(userData),
    });

    // Redirect to admin onboarding for new organizations
    router.push('/admin/onboarding');
  };

  const acceptInvitation = async (data: AcceptInvitationData) => {
    const response = await authApi.acceptInvitation(data);
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
      organization: buildOrganizationContext(userData),
    });

    // Redirect to employee onboarding
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
      organization: null,
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
        organization: buildOrganizationContext(userData),
      });
    } catch (e) {
      // Ignore refresh errors
    }
  };

  // Permission helpers
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!state.user?.role) return false;
    const permissions = ROLE_PERMISSIONS[state.user.role] || [];
    return permissions.includes(permission);
  }, [state.user?.role]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    return permissions.some(p => hasPermission(p));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissions: Permission[]): boolean => {
    return permissions.every(p => hasPermission(p));
  }, [hasPermission]);

  // Role helpers
  const isAdmin = useCallback((): boolean => {
    return state.user?.role === 'admin' || state.user?.role === 'super_admin';
  }, [state.user?.role]);

  const isSuperAdmin = useCallback((): boolean => {
    return state.user?.role === 'super_admin';
  }, [state.user?.role]);

  const isManager = useCallback((): boolean => {
    return state.user?.role === 'manager';
  }, [state.user?.role]);

  const isManagerOrAbove = useCallback((): boolean => {
    return ['manager', 'admin', 'super_admin'].includes(state.user?.role || '');
  }, [state.user?.role]);

  const canManageUser = useCallback((targetRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      super_admin: 4,
      admin: 3,
      manager: 2,
      employee: 1,
    };
    const userLevel = roleHierarchy[state.user?.role || 'employee'];
    const targetLevel = roleHierarchy[targetRole];
    return userLevel > targetLevel;
  }, [state.user?.role]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      registerOrganization,
      acceptInvitation,
      logout,
      refreshUser,
      employeeId,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isAdmin,
      isSuperAdmin,
      isManager,
      isManagerOrAbove,
      canManageUser,
    }}>
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

export function useRequireAuth(options?: {
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  redirectTo?: string;
}) {
  const {
    user,
    isLoading,
    isAuthenticated,
    refreshUser,
    hasPermission,
    hasAllPermissions,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check single required role
    if (options?.requiredRole && user?.role !== options.requiredRole) {
      router.push(options.redirectTo || '/dashboard');
      return;
    }

    // Check multiple allowed roles
    if (options?.requiredRoles && !options.requiredRoles.includes(user?.role as UserRole)) {
      router.push(options.redirectTo || '/dashboard');
      return;
    }

    // Check single required permission
    if (options?.requiredPermission && !hasPermission(options.requiredPermission)) {
      router.push(options.redirectTo || '/dashboard');
      return;
    }

    // Check multiple required permissions
    if (options?.requiredPermissions && !hasAllPermissions(options.requiredPermissions)) {
      router.push(options.redirectTo || '/dashboard');
      return;
    }
  }, [isLoading, isAuthenticated, user, options, router, hasPermission, hasAllPermissions]);

  return { user, isLoading, isAuthenticated, refreshUser };
}

// Hook for admin pages
export function useRequireAdmin() {
  return useRequireAuth({
    requiredRoles: ['super_admin', 'admin'],
    redirectTo: '/dashboard',
  });
}

// Hook for manager pages
export function useRequireManagerOrAbove() {
  return useRequireAuth({
    requiredRoles: ['super_admin', 'admin', 'manager'],
    redirectTo: '/dashboard',
  });
}

// ============================================
// PERMISSION GATE COMPONENT
// ============================================

interface PermissionGateProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  role?: UserRole;
  roles?: UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    if (!hasAccess) {
      return <>{fallback}</>;
    }
  }

  // Check single role
  if (role && user?.role !== role) {
    return <>{fallback}</>;
  }

  // Check multiple roles
  if (roles && !roles.includes(user?.role as UserRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
