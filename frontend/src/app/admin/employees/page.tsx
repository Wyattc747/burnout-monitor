'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, departmentsApi } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import { BulkInviteModal } from '@/components/admin/BulkInviteModal';
import { clsx } from 'clsx';
import {
  Search,
  Filter,
  Download,
  Upload,
  UserPlus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Users,
  Edit,
  Eye,
  UserCog,
  AlertCircle,
  CheckCircle,
  UserCheck,
} from 'lucide-react';
import type { Employee, Department, EmploymentStatus, Zone, UserRole } from '@/types';

type SortField = 'name' | 'email' | 'department' | 'role' | 'status' | 'zone';
type SortOrder = 'asc' | 'desc';

const STATUS_OPTIONS: { value: EmploymentStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
];

const ZONE_OPTIONS: { value: Zone | ''; label: string }[] = [
  { value: '', label: 'All Zones' },
  { value: 'red', label: 'Red (At Risk)' },
  { value: 'yellow', label: 'Yellow (Moderate)' },
  { value: 'green', label: 'Green (Peak)' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

function getStatusBadgeClasses(status?: EmploymentStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'on_leave':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'terminated':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  }
}

function getZoneBadgeClasses(zone: Zone): string {
  switch (zone) {
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'yellow':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'green':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  }
}

function formatStatus(status?: EmploymentStatus): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AdminEmployeesPage() {
  const { user, isLoading: authLoading } = useRequireAdmin();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | ''>('');
  const [zoneFilter, setZoneFilter] = useState<Zone | ''>('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<Employee | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<Employee | null>(null);
  const [showManagerModal, setShowManagerModal] = useState<Employee | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const limit = 20;

  // Fetch departments for filter
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.getAll,
    enabled: !!user,
  });

  // Fetch employees with filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-employees', search, departmentFilter, statusFilter, zoneFilter, page, sortField, sortOrder],
    queryFn: () =>
      adminApi.getEmployees({
        search: search || undefined,
        department: departmentFilter || undefined,
        status: statusFilter || undefined,
        zone: zoneFilter || undefined,
        page,
        limit,
        sortBy: sortField,
        sortOrder,
      }),
    enabled: !!user,
  });

  const employees = data?.employees || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit, totalPages: 0 };

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: string; role: UserRole }) =>
      adminApi.updateEmployeeRole(employeeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setShowRoleModal(null);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: string; status: EmploymentStatus }) =>
      adminApi.updateEmployeeStatus(employeeId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setShowStatusModal(null);
    },
  });

  // Fetch potential managers for assignment (any employee can be a manager)
  const { data: managersData } = useQuery({
    queryKey: ['potential-managers'],
    queryFn: () => adminApi.getEmployees({ limit: 100 }),
    enabled: !!showManagerModal,
  });
  const managers = managersData?.employees;

  // Update manager mutation
  const updateManagerMutation = useMutation({
    mutationFn: ({ employeeId, managerId }: { employeeId: string; managerId: string | null }) =>
      adminApi.updateEmployee(employeeId, { managerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setShowManagerModal(null);
      setSelectedManagerId(null);
    },
  });

  // Import CSV mutation
  const importMutation = useMutation({
    mutationFn: adminApi.importEmployees,
    onSuccess: (result) => {
      setImportResult({
        success: true,
        message: `Imported ${result.created} new, updated ${result.updated}, ${result.failed} failed`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setTimeout(() => setImportResult(null), 5000);
    },
    onError: (error: Error) => {
      setImportResult({
        success: false,
        message: error.message || 'Import failed',
      });
      setTimeout(() => setImportResult(null), 5000);
    },
  });

  // Handle CSV import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
      e.target.value = '';
    }
  };

  // Handle CSV export
  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Department', 'Job Title', 'Role', 'Status', 'Zone'];
    const rows = employees.map((emp) => [
      emp.firstName,
      emp.lastName,
      emp.email,
      emp.departmentName || emp.department,
      emp.jobTitle,
      emp.role || 'employee',
      emp.employmentStatus || 'active',
      emp.zone,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle search with debounce effect
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Close action menu when clicking outside
  const handleClickOutside = () => {
    if (showActionMenu) {
      setShowActionMenu(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" onClick={handleClickOutside}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            Employees
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your organization&apos;s employees
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button
            onClick={handleExport}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Employee
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div
          className={clsx(
            'p-4 rounded-lg flex items-center gap-3',
            importResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          )}
        >
          {importResult.success ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {importResult.message}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="input py-2"
            >
              <option value="">All Departments</option>
              {departments?.map((dept: Department) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as EmploymentStatus | '');
              setPage(1);
            }}
            className="input py-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Zone Filter */}
          <select
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value as Zone | '');
              setPage(1);
            }}
            className="input py-2"
          >
            {ZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortField === 'name' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-1">
                    Email
                    {sortField === 'email' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('department')}
                >
                  <div className="flex items-center gap-1">
                    Department
                    {sortField === 'department' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center gap-1">
                    Role
                    {sortField === 'role' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Manager
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortField === 'status' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('zone')}
                >
                  <div className="flex items-center gap-1">
                    Zone
                    {sortField === 'zone' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                            employee.zone === 'red' && 'bg-red-500',
                            employee.zone === 'yellow' && 'bg-amber-500',
                            employee.zone === 'green' && 'bg-emerald-500',
                            !employee.zone && 'bg-gray-400'
                          )}
                        >
                          {employee.firstName[0]}
                          {employee.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {employee.jobTitle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {employee.email}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {employee.departmentName || employee.department}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-gray-600 dark:text-gray-300">
                        {employee.role || 'employee'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {employee.managerName || (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">Not assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusBadgeClasses(employee.employmentStatus)
                        )}
                      >
                        {formatStatus(employee.employmentStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {employee.zone && (
                        <span
                          className={clsx(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                            getZoneBadgeClasses(employee.zone)
                          )}
                        >
                          {employee.zone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionMenu(
                                showActionMenu === employee.id ? null : employee.id
                              );
                            }}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>

                          {showActionMenu === employee.id && (
                            <div
                              className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  router.push(`/dashboard/employee/${employee.id}`);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Eye className="w-4 h-4" />
                                View Profile
                              </button>
                              <button
                                onClick={() => {
                                  setShowRoleModal(employee);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <UserCog className="w-4 h-4" />
                                Edit Role
                              </button>
                              <button
                                onClick={() => {
                                  setShowStatusModal(employee);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Edit className="w-4 h-4" />
                                Change Status
                              </button>
                              <button
                                onClick={() => {
                                  setShowManagerModal(employee);
                                  setSelectedManagerId(employee.managerId || null);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <UserCheck className="w-4 h-4" />
                                Assign Manager
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} employees
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <BulkInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Edit Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRoleModal(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Role for {showRoleModal.firstName} {showRoleModal.lastName}
            </h2>
            <div className="space-y-3 mb-6">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    showRoleModal.role === role.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={showRoleModal.role === role.value}
                    onChange={(e) =>
                      setShowRoleModal({ ...showRoleModal, role: e.target.value as UserRole })
                    }
                    className="text-blue-600"
                  />
                  <span className="text-gray-900 dark:text-white">{role.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRoleModal(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showRoleModal.role) {
                    updateRoleMutation.mutate({
                      employeeId: showRoleModal.id,
                      role: showRoleModal.role,
                    });
                  }
                }}
                disabled={updateRoleMutation.isPending}
                className="btn btn-primary"
              >
                {updateRoleMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowStatusModal(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Status for {showStatusModal.firstName} {showStatusModal.lastName}
            </h2>
            <div className="space-y-3 mb-6">
              {STATUS_OPTIONS.filter((s) => s.value).map((status) => (
                <label
                  key={status.value}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    showStatusModal.employmentStatus === status.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={status.value}
                    checked={showStatusModal.employmentStatus === status.value}
                    onChange={(e) =>
                      setShowStatusModal({
                        ...showStatusModal,
                        employmentStatus: e.target.value as EmploymentStatus,
                      })
                    }
                    className="text-blue-600"
                  />
                  <span className="text-gray-900 dark:text-white">{status.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStatusModal(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showStatusModal.employmentStatus) {
                    updateStatusMutation.mutate({
                      employeeId: showStatusModal.id,
                      status: showStatusModal.employmentStatus,
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending}
                className="btn btn-primary"
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Manager Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowManagerModal(null);
              setSelectedManagerId(null);
            }}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Manager for {showManagerModal.firstName} {showManagerModal.lastName}
            </h2>
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              <label
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedManagerId === null
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                <input
                  type="radio"
                  name="manager"
                  checked={selectedManagerId === null}
                  onChange={() => setSelectedManagerId(null)}
                  className="text-blue-600"
                />
                <span className="text-gray-500 dark:text-gray-400 italic">No manager</span>
              </label>
              {managers
                ?.filter((m: Employee) => m.id !== showManagerModal.id)
                .map((manager: Employee) => (
                  <label
                    key={manager.id}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedManagerId === manager.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="manager"
                      value={manager.id}
                      checked={selectedManagerId === manager.id}
                      onChange={() => setSelectedManagerId(manager.id)}
                      className="text-blue-600"
                    />
                    <div>
                      <span className="text-gray-900 dark:text-white">
                        {manager.firstName} {manager.lastName}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        ({manager.departmentName || manager.department})
                      </span>
                    </div>
                  </label>
                ))}
              {(!managers || managers.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No managers found. Promote an employee to manager first.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowManagerModal(null);
                  setSelectedManagerId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateManagerMutation.mutate({
                    employeeId: showManagerModal.id,
                    managerId: selectedManagerId,
                  });
                }}
                disabled={updateManagerMutation.isPending}
                className="btn btn-primary"
              >
                {updateManagerMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
