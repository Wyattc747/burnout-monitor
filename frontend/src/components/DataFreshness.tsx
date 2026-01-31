'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

interface DataSource {
  id: string;
  name: string;
  lastSync: string | null;
  status: 'fresh' | 'stale' | 'outdated' | 'never';
  icon: string;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDataStatus(lastSync: string | null): 'fresh' | 'stale' | 'outdated' | 'never' {
  if (!lastSync) return 'never';

  const date = new Date(lastSync);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 6) return 'fresh';
  if (diffHours < 24) return 'stale';
  return 'outdated';
}

const STATUS_STYLES = {
  fresh: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
    label: 'Up to date',
  },
  stale: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-500',
    label: 'Slightly outdated',
  },
  outdated: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Needs sync',
  },
  never: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: 'Not connected',
  },
};

async function fetchDataSources(): Promise<DataSource[]> {
  const token = localStorage.getItem('token');
  const employeeId = localStorage.getItem('employeeId');

  if (!token || !employeeId) {
    return [];
  }

  // Get integration status
  const intRes = await fetch('http://localhost:3001/api/integrations/status', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  // Get latest health and work metrics timestamps using the employee ID
  const healthRes = await fetch(`http://localhost:3001/api/employees/${employeeId}/health?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  const workRes = await fetch(`http://localhost:3001/api/employees/${employeeId}/work?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  const integrations = intRes?.ok ? await intRes.json() : {};
  const health = healthRes?.ok ? await healthRes.json() : [];
  const work = workRes?.ok ? await workRes.json() : [];

  const sources: DataSource[] = [
    {
      id: 'health',
      name: 'Health Data',
      lastSync: health[0]?.date || null,
      status: getDataStatus(health[0]?.date || null),
      icon: '❤️',
    },
    {
      id: 'work',
      name: 'Work Metrics',
      lastSync: work[0]?.date || null,
      status: getDataStatus(work[0]?.date || null),
      icon: '💼',
    },
  ];

  // Add integration-specific sources
  if (integrations.terra?.connected) {
    sources.push({
      id: 'wearable',
      name: 'Wearable Device',
      lastSync: integrations.terra.lastSync || null,
      status: getDataStatus(integrations.terra.lastSync || null),
      icon: '⌚',
    });
  }

  if (integrations.google?.connected) {
    sources.push({
      id: 'calendar',
      name: 'Google Calendar',
      lastSync: integrations.google.lastSync || null,
      status: getDataStatus(integrations.google.lastSync || null),
      icon: '📅',
    });
  }

  if (integrations.salesforce?.connected) {
    sources.push({
      id: 'salesforce',
      name: 'Salesforce',
      lastSync: integrations.salesforce.lastSync || null,
      status: getDataStatus(integrations.salesforce.lastSync || null),
      icon: '☁️',
    });
  }

  return sources;
}

// Compact indicator for navbar/header
export function DataFreshnessIndicator() {
  const { data: sources, isLoading } = useQuery({
    queryKey: ['data-freshness'],
    queryFn: fetchDataSources,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !sources) {
    return null;
  }

  const overallStatus = sources.some(s => s.status === 'outdated')
    ? 'outdated'
    : sources.some(s => s.status === 'stale')
      ? 'stale'
      : sources.some(s => s.status === 'never')
        ? 'never'
        : 'fresh';

  const style = STATUS_STYLES[overallStatus];

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer',
        style.bg,
        style.text
      )}
      title={`Data status: ${style.label}`}
    >
      <span className={clsx('w-2 h-2 rounded-full animate-pulse', style.dot)}></span>
      <span className="hidden sm:inline">{style.label}</span>
    </div>
  );
}

// Full panel showing all data sources
export function DataFreshnessPanel() {
  const { data: sources, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['data-freshness'],
    queryFn: fetchDataSources,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Sync Status</h3>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
        >
          {isRefetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3">
        {sources.map((source) => {
          const style = STATUS_STYLES[source.status];
          return (
            <div
              key={source.id}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg',
                style.bg
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{source.icon}</span>
                <div>
                  <p className={clsx('font-medium text-sm', style.text)}>{source.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {source.lastSync ? `Last synced: ${getRelativeTime(new Date(source.lastSync))}` : 'Never synced'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full', style.dot)}></span>
                <span className={clsx('text-xs font-medium', style.text)}>{style.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {sources.some(s => s.status === 'outdated' || s.status === 'never') && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">Note:</span> Some data sources need attention.
            Connect your devices in Settings to ensure accurate wellness tracking.
          </p>
        </div>
      )}
    </div>
  );
}

// Inline status badge for specific data points
export function DataTimestamp({ date, label }: { date: string | null; label?: string }) {
  if (!date) return null;

  const status = getDataStatus(date);
  const style = STATUS_STYLES[status];
  const relativeTime = getRelativeTime(new Date(date));

  return (
    <span
      className={clsx('inline-flex items-center gap-1 text-xs', style.text)}
      title={`${label || 'Data'} from ${new Date(date).toLocaleString()}`}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', style.dot)}></span>
      {relativeTime}
    </span>
  );
}

export default DataFreshnessPanel;
