'use client';

import { clsx } from 'clsx';
import { ZoneIndicator } from './ZoneIndicator';
import type { Employee } from '@/types';

interface EmployeeCardProps {
  employee: Employee;
  onClick?: () => void;
  compact?: boolean;
}

// Calculate wellness score from burnout score (inverted)
function getWellnessScore(burnoutScore: number | null | undefined): number {
  return 100 - (burnoutScore ?? 50);
}

// Get color based on wellness score
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

export function EmployeeCard({ employee, onClick, compact = false }: EmployeeCardProps) {
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;
  const wellnessScore = getWellnessScore(employee.burnoutScore);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all',
          'bg-white dark:bg-gray-800',
          employee.zone === 'red' && 'border-red-200 dark:border-red-800 hover:border-red-300',
          employee.zone === 'yellow' && 'border-amber-200 dark:border-amber-800 hover:border-amber-300',
          employee.zone === 'green' && 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-300',
          !employee.zone && 'border-gray-200 dark:border-gray-700'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0',
              employee.zone === 'red' && 'bg-red-500',
              employee.zone === 'yellow' && 'bg-amber-500',
              employee.zone === 'green' && 'bg-emerald-500',
              !employee.zone && 'bg-gray-400'
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {employee.firstName} {employee.lastName}
              </h3>
              <ZoneIndicator zone={employee.zone} size="sm" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {employee.jobTitle}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={clsx('text-lg font-bold', getScoreColor(wellnessScore))}>
              {Math.round(wellnessScore)}%
            </p>
            <p className="text-xs text-gray-400">wellness</p>
          </div>
        </div>
      </div>
    );
  }

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
            employee.zone === 'yellow' && 'bg-amber-500',
            employee.zone === 'green' && 'bg-emerald-500'
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

      {/* Single Wellness Score */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Wellness Score</p>
          <span className={clsx('text-lg font-bold', getScoreColor(wellnessScore))}>
            {Math.round(wellnessScore)}%
          </span>
        </div>
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', getBarColor(wellnessScore))}
            style={{ width: `${wellnessScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
          <span>At Risk</span>
          <span>Moderate</span>
          <span>Peak</span>
        </div>
      </div>
    </div>
  );
}
