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
          ? 'bg-red-50 border-red-500'
          : 'bg-green-50 border-green-500'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                'text-lg',
                isBurnout ? 'text-red-600' : 'text-green-600'
              )}
            >
              {isBurnout ? '⚠️' : '✨'}
            </span>
            <h4 className="font-medium text-gray-900 truncate">{alert.title}</h4>
          </div>
          <p className="text-sm text-gray-600">{alert.message}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {showEmployee && <span>{alert.employeeName}</span>}
            <span>{new Date(alert.createdAt).toLocaleString()}</span>
            {alert.smsSent && (
              <span className="text-blue-600">SMS sent</span>
            )}
          </div>
        </div>

        {!alert.isAcknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Acknowledge
          </button>
        )}

        {alert.isAcknowledged && (
          <span className="shrink-0 px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-md">
            Acknowledged
          </span>
        )}
      </div>
    </div>
  );
}
