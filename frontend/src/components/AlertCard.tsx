'use client';

import { clsx } from 'clsx';
import type { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  showEmployee?: boolean;
}

export function AlertCard({ alert, onAcknowledge, showEmployee = true }: AlertCardProps) {
  const isBurnout = alert.type === 'burnout';

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border-l-4',
        isBurnout
          ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
          : 'bg-green-50 dark:bg-green-900/20 border-green-500'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                'text-lg',
                isBurnout ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              )}
            >
              {isBurnout ? '⚠️' : '✨'}
            </span>
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{alert.title}</h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{alert.message}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {showEmployee && <span>{alert.employeeName}</span>}
            <span>{new Date(alert.createdAt).toLocaleString()}</span>
            {alert.smsSent && (
              <span className="text-blue-600 dark:text-blue-400">SMS sent</span>
            )}
          </div>
        </div>

        {!alert.isAcknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Acknowledge
          </button>
        )}

        {alert.isAcknowledged && (
          <span className="shrink-0 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md">
            Acknowledged
          </span>
        )}
      </div>
    </div>
  );
}
