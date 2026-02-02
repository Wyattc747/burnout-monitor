'use client';

import { useAuth } from '@/lib/auth';
import { ManagerDashboard } from './ManagerDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

export default function DashboardPage() {
  const { user, employeeId, isLoading } = useAuth();

  // Show loading state while auth is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen via auth hook)
  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Please log in to view your dashboard.</p>
        </div>
      </div>
    );
  }

  if (user.role === 'manager') {
    return <ManagerDashboard />;
  }

  // Handle case where employeeId might not be available yet
  if (!employeeId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Unable to load employee data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return <EmployeeDashboard employeeId={employeeId} />;
}
