'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, adminApi } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import { DepartmentTree } from '@/components/admin/DepartmentTree';
import { clsx } from 'clsx';
import {
  Building2,
  Plus,
  Search,
  X,
  AlertCircle,
  Users,
  Layers,
} from 'lucide-react';
import type { Department, Employee } from '@/types';

type ModalMode = 'create' | 'edit' | null;

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  parentDepartmentId: string;
  managerEmployeeId: string;
}

const initialFormData: DepartmentFormData = {
  name: '',
  code: '',
  description: '',
  parentDepartmentId: '',
  managerEmployeeId: '',
};

export default function DepartmentsPage() {
  const { user, isLoading: authLoading } = useRequireAdmin();
  const queryClient = useQueryClient();

  // State
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null);
  const [draggedDepartment, setDraggedDepartment] = useState<Department | null>(null);

  // Queries
  const { data: departmentTree, isLoading: loadingTree } = useQuery({
    queryKey: ['departments-tree'],
    queryFn: departmentsApi.getTree,
    enabled: !!user,
  });

  const { data: allDepartments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: departmentsApi.getAll,
    enabled: !!user,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: () => adminApi.getEmployees({ limit: 500 }),
    enabled: !!user && modalMode !== null,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-tree'] });
      queryClient.invalidateQueries({ queryKey: ['departments-all'] });
      closeModal();
    },
    onError: (error: any) => {
      setFormError(error.message || 'Failed to create department');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof departmentsApi.update>[1] }) =>
      departmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-tree'] });
      queryClient.invalidateQueries({ queryKey: ['departments-all'] });
      closeModal();
    },
    onError: (error: any) => {
      setFormError(error.message || 'Failed to update department');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: departmentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-tree'] });
      queryClient.invalidateQueries({ queryKey: ['departments-all'] });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      setFormError(error.message || 'Failed to delete department');
    },
  });

  const setManagerMutation = useMutation({
    mutationFn: ({ id, employeeId }: { id: string; employeeId: string | null }) =>
      departmentsApi.setManager(id, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-tree'] });
      queryClient.invalidateQueries({ queryKey: ['departments-all'] });
    },
  });

  // Helpers
  const closeModal = () => {
    setModalMode(null);
    setSelectedDepartment(null);
    setFormData(initialFormData);
    setFormError(null);
  };

  const openCreateModal = () => {
    setFormData(initialFormData);
    setFormError(null);
    setModalMode('create');
  };

  const openEditModal = (department: Department) => {
    setSelectedDepartment(department);
    setFormData({
      name: department.name,
      code: department.code || '',
      description: department.description || '',
      parentDepartmentId: department.parentDepartmentId || '',
      managerEmployeeId: department.managerEmployeeId || '',
    });
    setFormError(null);
    setModalMode('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Department name is required');
      return;
    }

    if (modalMode === 'create') {
      createMutation.mutate({
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim() || undefined,
        parentDepartmentId: formData.parentDepartmentId || undefined,
      });
    } else if (modalMode === 'edit' && selectedDepartment) {
      // Check for circular reference
      if (formData.parentDepartmentId === selectedDepartment.id) {
        setFormError('A department cannot be its own parent');
        return;
      }

      updateMutation.mutate({
        id: selectedDepartment.id,
        data: {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
          parentDepartmentId: formData.parentDepartmentId || undefined,
        },
      });

      // Update manager if changed
      if (formData.managerEmployeeId !== (selectedDepartment.managerEmployeeId || '')) {
        setManagerMutation.mutate({
          id: selectedDepartment.id,
          employeeId: formData.managerEmployeeId || null,
        });
      }
    }
  };

  const handleDelete = (department: Department) => {
    setDeleteConfirm(department);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (department: Department) => {
    setDraggedDepartment(department);
  };

  const handleDrop = (targetDepartment: Department) => {
    if (draggedDepartment && draggedDepartment.id !== targetDepartment.id) {
      // Check if target is not a descendant of dragged department
      const isDescendant = (parent: Department, childId: string): boolean => {
        if (parent.id === childId) return true;
        if (parent.children) {
          return parent.children.some((c) => isDescendant(c, childId));
        }
        return false;
      };

      if (!isDescendant(draggedDepartment, targetDepartment.id)) {
        updateMutation.mutate({
          id: draggedDepartment.id,
          data: {
            parentDepartmentId: targetDepartment.id,
          },
        });
      }
    }
    setDraggedDepartment(null);
  };

  // Filter departments for search
  const filteredDepartments = useMemo(() => {
    if (!departmentTree || !searchQuery.trim()) {
      return departmentTree || [];
    }

    const query = searchQuery.toLowerCase();

    const filterTree = (departments: Department[]): Department[] => {
      return departments.reduce((acc: Department[], dept) => {
        const nameMatch = dept.name.toLowerCase().includes(query);
        const codeMatch = dept.code?.toLowerCase().includes(query);
        const managerMatch = dept.managerName?.toLowerCase().includes(query);

        const filteredChildren = dept.children ? filterTree(dept.children) : [];

        if (nameMatch || codeMatch || managerMatch || filteredChildren.length > 0) {
          acc.push({
            ...dept,
            children: filteredChildren,
          });
        }

        return acc;
      }, []);
    };

    return filterTree(departmentTree);
  }, [departmentTree, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!allDepartments) return { total: 0, active: 0, withManager: 0 };
    return {
      total: allDepartments.length,
      active: allDepartments.filter((d) => d.isActive).length,
      withManager: allDepartments.filter((d) => d.managerEmployeeId).length,
    };
  }, [allDepartments]);

  // Get available parent options (exclude self and descendants in edit mode)
  const parentOptions = useMemo(() => {
    if (!allDepartments) return [];

    if (modalMode === 'edit' && selectedDepartment) {
      const getDescendantIds = (dept: Department): string[] => {
        const ids = [dept.id];
        if (dept.children) {
          dept.children.forEach((c) => ids.push(...getDescendantIds(c)));
        }
        return ids;
      };

      const excludeIds = new Set(getDescendantIds(selectedDepartment));
      return allDepartments.filter((d) => !excludeIds.has(d.id));
    }

    return allDepartments;
  }, [allDepartments, modalMode, selectedDepartment]);

  if (authLoading || loadingTree) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            Departments
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your organization&apos;s department structure
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Departments</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Layers className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Departments</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.withManager}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">With Manager Assigned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments by name, code, or manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
        </div>

        {/* Department Tree */}
        <div className="p-4">
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No departments found' : 'No departments yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first department to get started'}
              </p>
              {!searchQuery && (
                <button onClick={openCreateModal} className="btn btn-primary">
                  Create Department
                </button>
              )}
            </div>
          ) : (
            <DepartmentTree
              departments={filteredDepartments}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              draggedDepartment={draggedDepartment}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {modalMode === 'create' ? 'Create Department' : 'Edit Department'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{formError}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Engineering"
                  className="input w-full"
                  autoFocus
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., ENG"
                  className="input w-full"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Optional short code for the department
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the department..."
                  className="input w-full"
                  rows={3}
                />
              </div>

              {/* Parent Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parent Department
                </label>
                <select
                  value={formData.parentDepartmentId}
                  onChange={(e) => setFormData({ ...formData, parentDepartmentId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">None (Top Level)</option>
                  {parentOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.hierarchyLevel > 0 && '\u00A0'.repeat(dept.hierarchyLevel * 2) + '- '}
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manager (Edit mode only) */}
              {modalMode === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Department Manager
                  </label>
                  <select
                    value={formData.managerEmployeeId}
                    onChange={(e) => setFormData({ ...formData, managerEmployeeId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">No Manager Assigned</option>
                    {employeesData?.employees.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : modalMode === 'create'
                    ? 'Create Department'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Department?
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Are you sure you want to delete <span className="font-medium">{deleteConfirm.name}</span>?
            </p>
            {deleteConfirm.employeeCount && deleteConfirm.employeeCount > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                This department has {deleteConfirm.employeeCount} employee(s) assigned.
                They will need to be reassigned.
              </p>
            )}
            {deleteConfirm.children && deleteConfirm.children.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                This department has {deleteConfirm.children.length} sub-department(s).
                They will become top-level departments.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
