'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { EmployeeCard } from '@/components/EmployeeCard';
import { clsx } from 'clsx';
import Link from 'next/link';
import type { Employee } from '@/types';
import { Search, ArrowUpDown, Users, ChevronLeft, UserPlus, X, Trash2 } from 'lucide-react';

type SortField = 'name' | 'burnout' | 'readiness' | 'department';
type SortOrder = 'asc' | 'desc';
type ZoneFilter = 'all' | 'red' | 'yellow' | 'green';

export default function TeamPage() {
  const { user, isLoading: authLoading } = useRequireAuth('manager');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialFilter = (searchParams?.get('filter') as ZoneFilter) || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>(initialFilter);
  const [sortField, setSortField] = useState<SortField>('burnout');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamsApi.getMembers,
    enabled: !!user,
  });

  const { data: availableEmployees } = useQuery({
    queryKey: ['available-employees'],
    queryFn: teamsApi.getAvailable,
    enabled: !!user && showAddModal,
  });

  const addMember = useMutation({
    mutationFn: teamsApi.addMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
      setShowAddModal(false);
    },
  });

  const removeMember = useMutation({
    mutationFn: teamsApi.removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
      setShowRemoveConfirm(null);
    },
  });

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];

    let result = [...employees];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((e: Employee) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
        e.email.toLowerCase().includes(query) ||
        e.department.toLowerCase().includes(query) ||
        e.jobTitle.toLowerCase().includes(query)
      );
    }

    // Zone filter
    if (zoneFilter !== 'all') {
      result = result.filter((e: Employee) => e.zone === zoneFilter);
    }

    // Sort
    result.sort((a: Employee, b: Employee) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'burnout':
          comparison = (a.burnoutScore ?? 0) - (b.burnoutScore ?? 0);
          break;
        case 'readiness':
          comparison = (a.readinessScore ?? 0) - (b.readinessScore ?? 0);
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [employees, searchQuery, zoneFilter, sortField, sortOrder]);

  // Zone counts
  const zoneCounts = useMemo(() => {
    if (!employees) return { all: 0, red: 0, yellow: 0, green: 0 };
    return {
      all: employees.length,
      red: employees.filter((e: Employee) => e.zone === 'red').length,
      yellow: employees.filter((e: Employee) => e.zone === 'yellow').length,
      green: employees.filter((e: Employee) => e.zone === 'green').length,
    };
  }, [employees]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team Members
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredEmployees.length} of {employees?.length || 0} employees
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
              className="input py-2"
            >
              <option value="burnout-desc">Highest Burnout Risk</option>
              <option value="burnout-asc">Lowest Burnout Risk</option>
              <option value="readiness-desc">Highest Readiness</option>
              <option value="readiness-asc">Lowest Readiness</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="department-asc">Department (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Zone Filter Tabs */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'red', 'yellow', 'green'] as const).map((zone) => (
            <button
              key={zone}
              onClick={() => setZoneFilter(zone)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                zoneFilter === zone
                  ? zone === 'all'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : zone === 'red'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : zone === 'yellow'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {zone === 'all' && `All (${zoneCounts.all})`}
              {zone === 'red' && `Burnout Risk (${zoneCounts.red})`}
              {zone === 'yellow' && `Moderate (${zoneCounts.yellow})`}
              {zone === 'green' && `Peak Ready (${zoneCounts.green})`}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filteredEmployees.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || zoneFilter !== 'all'
              ? 'No employees match your filters'
              : 'No team members found'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary mt-4"
          >
            Add Team Member
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee: Employee) => (
            <div key={employee.id} className="relative group">
              <EmployeeCard
                employee={employee}
                onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRemoveConfirm(employee.id);
                }}
                className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Remove from team"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Team Member
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {!availableEmployees || availableEmployees.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No available employees to add
                </p>
              ) : (
                <div className="space-y-2">
                  {availableEmployees.map((employee: Employee) => (
                    <button
                      key={employee.id}
                      onClick={() => addMember.mutate(employee.id)}
                      disabled={addMember.isPending}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {employee.jobTitle} - {employee.department}
                        </p>
                      </div>
                      <UserPlus className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowRemoveConfirm(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Remove Team Member?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will remove the employee from your team. They can be added back later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMember.mutate(showRemoveConfirm)}
                disabled={removeMember.isPending}
                className="btn bg-red-600 hover:bg-red-700 text-white"
              >
                {removeMember.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
