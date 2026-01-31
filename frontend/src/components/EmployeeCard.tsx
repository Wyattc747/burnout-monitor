'use client';

import { clsx } from 'clsx';
import { ZoneIndicator } from './ZoneIndicator';
import type { Employee } from '@/types';

interface EmployeeCardProps {
  employee: Employee;
  onClick?: () => void;
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card cursor-pointer hover:shadow-md transition-shadow',
        employee.zone === 'red' && 'ring-2 ring-red-200 dark:ring-red-800',
        employee.zone === 'green' && 'ring-2 ring-green-200 dark:ring-green-800'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold',
            employee.zone === 'red' && 'bg-red-500',
            employee.zone === 'yellow' && 'bg-yellow-500',
            employee.zone === 'green' && 'bg-green-500'
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {employee.firstName} {employee.lastName}
            </h3>
            <ZoneIndicator zone={employee.zone} size="sm" animated={employee.zone !== 'yellow'} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{employee.jobTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{employee.department}</p>
        </div>
      </div>

      {/* Scores */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Burnout Risk</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${employee.burnoutScore ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-8">
              {employee.burnoutScore ?? '-'}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Readiness</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${employee.readinessScore ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-8">
              {employee.readinessScore ?? '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
