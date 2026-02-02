'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { AlertCard } from '@/components/AlertCard';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronLeft, Bell, CheckCheck, Filter } from 'lucide-react';

type AlertFilter = 'all' | 'unacknowledged' | 'acknowledged';
type AlertTypeFilter = 'all' | 'burnout' | 'opportunity';

export default function AlertsPage() {
  const { user, isLoading: authLoading } = useRequireAuth({ requiredRoles: ['manager', 'admin', 'super_admin'] });
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<AlertFilter>('unacknowledged');
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('all');

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: () => alertsApi.getAll({
      acknowledged: statusFilter === 'all' ? undefined : statusFilter === 'acknowledged',
    }),
    enabled: !!user,
  });

  const acknowledgeAlert = useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const acknowledgeAll = useMutation({
    mutationFn: async () => {
      const unacknowledged = alerts?.filter((a: any) => !a.isAcknowledged) || [];
      await Promise.all(unacknowledged.map((a: any) => alertsApi.acknowledge(a.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Filter alerts by type
  const filteredAlerts = alerts?.filter((alert: any) => {
    if (typeFilter === 'all') return true;
    return alert.type === typeFilter;
  }) || [];

  // Count stats
  const unacknowledgedCount = alerts?.filter((a: any) => !a.isAcknowledged).length || 0;
  const burnoutCount = alerts?.filter((a: any) => a.type === 'burnout').length || 0;
  const opportunityCount = alerts?.filter((a: any) => a.type === 'opportunity').length || 0;

  if (authLoading) {
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
            <Bell className="w-6 h-6" />
            Alerts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage team wellness alerts and notifications
          </p>
        </div>
        {unacknowledgedCount > 0 && (
          <button
            onClick={() => acknowledgeAll.mutate()}
            disabled={acknowledgeAll.isPending}
            className="btn btn-secondary flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            {acknowledgeAll.isPending ? 'Processing...' : `Acknowledge All (${unacknowledgedCount})`}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard
          label="Unacknowledged"
          value={unacknowledgedCount}
          color={unacknowledgedCount > 0 ? 'red' : 'green'}
          icon="🔔"
        />
        <StatCard
          label="Burnout Alerts"
          value={burnoutCount}
          color="red"
          icon="🔴"
        />
        <StatCard
          label="Opportunity Alerts"
          value={opportunityCount}
          color="green"
          icon="🟢"
        />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            <div className="flex gap-1">
              {(['unacknowledged', 'acknowledged', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={clsx(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    statusFilter === status
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-sm text-gray-600 dark:text-gray-400">Type:</span>
            <div className="flex gap-1">
              {(['all', 'burnout', 'opportunity'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={clsx(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    typeFilter === type
                      ? type === 'burnout'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : type === 'opportunity'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No alerts to show
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {statusFilter === 'unacknowledged'
              ? 'All alerts have been acknowledged. Great job!'
              : 'No alerts match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert: any) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'red' | 'green' | 'blue';
  icon: string;
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={clsx('text-3xl font-bold', colorClasses[color])}>{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}
