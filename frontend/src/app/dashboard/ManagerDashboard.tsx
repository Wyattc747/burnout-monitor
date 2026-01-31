'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, alertsApi } from '@/lib/api';
import { EmployeeCard } from '@/components/EmployeeCard';
import { AlertCard } from '@/components/AlertCard';
import { DemoControls } from '@/components/DemoControls';
import { UpcomingMeetings } from '@/components/UpcomingMeetings';
import { clsx } from 'clsx';

export function ManagerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [alertFilter, setAlertFilter] = useState<'all' | 'unacknowledged'>('unacknowledged');

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: employeesApi.getAll,
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ['alerts', alertFilter],
    queryFn: () =>
      alertsApi.getAll({
        acknowledged: alertFilter === 'unacknowledged' ? false : undefined,
      }),
  });

  const acknowledgeAlert = useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Group employees by zone for summary
  const zoneCounts = {
    red: employees?.filter((e) => e.zone === 'red').length || 0,
    yellow: employees?.filter((e) => e.zone === 'yellow').length || 0,
    green: employees?.filter((e) => e.zone === 'green').length || 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor employee wellness and performance</p>
      </div>

      {/* Zone Summary */}
      <div className="grid grid-cols-3 gap-4">
        <ZoneSummaryCard
          zone="red"
          count={zoneCounts.red}
          label="Burnout Risk"
          total={employees?.length || 0}
        />
        <ZoneSummaryCard
          zone="yellow"
          count={zoneCounts.yellow}
          label="Moderate"
          total={employees?.length || 0}
        />
        <ZoneSummaryCard
          zone="green"
          count={zoneCounts.green}
          label="Peak Ready"
          total={employees?.length || 0}
        />
      </div>

      {/* Your Upcoming Meetings */}
      <UpcomingMeetings />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Employee Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="section-header">Team Members</h2>
          {loadingEmployees ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {employees?.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Alerts Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-header">Alerts</h2>
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as typeof alertFilter)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="unacknowledged">Unacknowledged</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {loadingAlerts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-24 rounded-lg" />
                ))}
              </div>
            ) : alerts?.length === 0 ? (
              <div className="card text-center text-gray-500 dark:text-gray-400 py-8">
                <p>No alerts to show</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Demo Controls */}
      {employees && <DemoControls employees={employees} />}
    </div>
  );
}

function ZoneSummaryCard({
  zone,
  count,
  label,
  total,
}: {
  zone: 'red' | 'yellow' | 'green';
  count: number;
  label: string;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div
      className={clsx(
        'card',
        zone === 'red' && 'border-l-4 border-red-500',
        zone === 'yellow' && 'border-l-4 border-yellow-500',
        zone === 'green' && 'border-l-4 border-green-500'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
        </div>
        <div
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold',
            zone === 'red' && 'bg-red-500',
            zone === 'yellow' && 'bg-yellow-500',
            zone === 'green' && 'bg-green-500'
          )}
        >
          {percentage}%
        </div>
      </div>
    </div>
  );
}
