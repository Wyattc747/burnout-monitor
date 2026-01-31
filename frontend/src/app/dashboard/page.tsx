'use client';

import { useAuth } from '@/lib/auth';
import { ManagerDashboard } from './ManagerDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

export default function DashboardPage() {
  const { user, employeeId } = useAuth();

  if (!user) return null;

  if (user.role === 'manager') {
    return <ManagerDashboard />;
  }

  return <EmployeeDashboard employeeId={employeeId!} />;
}
