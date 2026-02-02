'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adminApi, departmentsApi } from '@/lib/api';
import { clsx } from 'clsx';
import { X, Plus, Trash2, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import type { UserRole, Department } from '@/types';

interface InviteEntry {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId: string;
  jobTitle: string;
}

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyEntry(): InviteEntry {
  return {
    id: generateId(),
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee',
    departmentId: '',
    jobTitle: '',
  };
}

export function BulkInviteModal({ isOpen, onClose, onSuccess }: BulkInviteModalProps) {
  const [entries, setEntries] = useState<InviteEntry[]>([createEmptyEntry()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{
    sent: number;
    failed: Array<{ email: string; error: string }>;
  } | null>(null);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.getAll,
    enabled: isOpen,
  });

  const inviteMutation = useMutation({
    mutationFn: adminApi.inviteEmployees,
    onSuccess: (data) => {
      setResult({ sent: data.sent, failed: data.failed });
      if (data.sent > 0 && data.failed.length === 0) {
        // All successful, close after a delay
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    },
  });

  const handleClose = () => {
    setEntries([createEmptyEntry()]);
    setErrors({});
    setResult(null);
    inviteMutation.reset();
    onClose();
  };

  const addEntry = () => {
    setEntries([...entries, createEmptyEntry()]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
      const newErrors = { ...errors };
      delete newErrors[id];
      setErrors(newErrors);
    }
  };

  const updateEntry = (id: string, field: keyof InviteEntry, value: string) => {
    setEntries(
      entries.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    // Clear error for this field
    if (errors[id]) {
      const newFieldErrors = errors[id].filter(
        (err) => !err.toLowerCase().includes(field.toLowerCase())
      );
      setErrors({ ...errors, [id]: newFieldErrors });
    }
  };

  const validateEntries = (): boolean => {
    const newErrors: Record<string, string[]> = {};
    let isValid = true;

    entries.forEach((entry) => {
      const entryErrors: string[] = [];

      if (!entry.email) {
        entryErrors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) {
        entryErrors.push('Invalid email format');
      }

      if (entryErrors.length > 0) {
        newErrors[entry.id] = entryErrors;
        isValid = false;
      }
    });

    // Check for duplicate emails
    const emails = entries.map((e) => e.email.toLowerCase()).filter(Boolean);
    const duplicates = emails.filter(
      (email, index) => emails.indexOf(email) !== index
    );
    if (duplicates.length > 0) {
      entries.forEach((entry) => {
        if (duplicates.includes(entry.email.toLowerCase())) {
          newErrors[entry.id] = [
            ...(newErrors[entry.id] || []),
            'Duplicate email',
          ];
          isValid = false;
        }
      });
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!validateEntries()) {
      return;
    }

    const invitations = entries
      .filter((e) => e.email)
      .map((e) => ({
        email: e.email,
        firstName: e.firstName || undefined,
        lastName: e.lastName || undefined,
        role: e.role,
        departmentId: e.departmentId || undefined,
        jobTitle: e.jobTitle || undefined,
      }));

    inviteMutation.mutate(invitations);
  };

  const handleBulkPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length === 0) return;

    const newEntries: InviteEntry[] = lines.map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      return {
        id: generateId(),
        email: parts[0] || '',
        firstName: parts[1] || '',
        lastName: parts[2] || '',
        role: 'employee' as UserRole,
        departmentId: '',
        jobTitle: parts[3] || '',
      };
    });

    // Replace single empty entry or append to existing
    if (entries.length === 1 && !entries[0].email) {
      setEntries(newEntries);
    } else {
      setEntries([...entries, ...newEntries]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Invite Employees
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add email addresses to send invitations
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Result Banner */}
        {result && (
          <div
            className={clsx(
              'px-4 py-3 flex items-center gap-3',
              result.failed.length === 0
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-amber-50 dark:bg-amber-900/20'
            )}
          >
            {result.failed.length === 0 ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-green-800 dark:text-green-200">
                  Successfully sent {result.sent} invitation{result.sent !== 1 ? 's' : ''}!
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div className="text-amber-800 dark:text-amber-200">
                  <span>Sent {result.sent} invitation{result.sent !== 1 ? 's' : ''}. </span>
                  <span>{result.failed.length} failed:</span>
                  <ul className="mt-1 text-sm list-disc list-inside">
                    {result.failed.map((f, i) => (
                      <li key={i}>
                        {f.email}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bulk Paste Helper */}
        <div className="px-4 pt-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Bulk Add
              </span>
            </div>
            <textarea
              placeholder="Paste emails (one per line) or CSV data: email, first name, last name, job title"
              className="w-full h-16 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onPaste={handleBulkPaste}
            />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="col-span-3">Email *</div>
              <div className="col-span-2">First Name</div>
              <div className="col-span-2">Last Name</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-1"></div>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={clsx(
                    'grid grid-cols-12 gap-2 items-start',
                    errors[entry.id] && 'pb-4'
                  )}
                >
                  <div className="col-span-3">
                    <input
                      type="email"
                      value={entry.email}
                      onChange={(e) => updateEntry(entry.id, 'email', e.target.value)}
                      placeholder="email@company.com"
                      className={clsx(
                        'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700',
                        'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                        errors[entry.id]
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                    />
                    {errors[entry.id] && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {errors[entry.id].join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={entry.firstName}
                      onChange={(e) => updateEntry(entry.id, 'firstName', e.target.value)}
                      placeholder="First"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={entry.lastName}
                      onChange={(e) => updateEntry(entry.id, 'lastName', e.target.value)}
                      placeholder="Last"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={entry.role}
                      onChange={(e) => updateEntry(entry.id, 'role', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={entry.departmentId}
                      onChange={(e) => updateEntry(entry.id, 'departmentId', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      {departments?.map((dept: Department) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      disabled={entries.length === 1}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        entries.length === 1
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Row Button */}
            <button
              type="button"
              onClick={addEntry}
              className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <Plus className="w-4 h-4" />
              Add another
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {entries.filter((e) => e.email).length} invitation{entries.filter((e) => e.email).length !== 1 ? 's' : ''} ready to send
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteMutation.isPending || entries.every((e) => !e.email)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviteMutation.isPending ? 'Sending...' : 'Send Invitations'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
