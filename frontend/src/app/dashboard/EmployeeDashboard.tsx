'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, alertsApi } from '@/lib/api';
import { ZoneBadge } from '@/components/ZoneIndicator';
import { ExplainabilityPanel } from '@/components/ExplainabilityPanel';
import { AlertCard } from '@/components/AlertCard';
import { DualScoreChart, HealthMetricsChart, WorkMetricsChart } from '@/components/Charts';
import { SupportBot, SupportBotButton } from '@/components/SupportBot';
import { UpcomingMeetings } from '@/components/UpcomingMeetings';
import { QuickCheckin } from '@/components/FeelingCheckin';
import { PersonalizationPrompt } from '@/components/PersonalizationPrompt';
import { WellnessStreaks } from '@/components/WellnessStreaks';
import { InsightsAndAlerts } from '@/components/InsightsAndAlerts';
import { EmailMetrics } from '@/components/EmailMetrics';
import { personalizationApi } from '@/lib/api';
import { clsx } from 'clsx';

interface EmployeeDashboardProps {
  employeeId: string;
}

export function EmployeeDashboard({ employeeId }: EmployeeDashboardProps) {
  const queryClient = useQueryClient();
  const [metricsTab, setMetricsTab] = useState<'sleep' | 'heart' | 'activity' | 'work'>('sleep');
  const [isBotOpen, setIsBotOpen] = useState(false);

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesApi.getById(employeeId),
  });

  const { data: burnoutData } = useQuery({
    queryKey: ['burnout', employeeId],
    queryFn: () => employeesApi.getBurnout(employeeId),
  });

  const { data: healthMetrics } = useQuery({
    queryKey: ['health', employeeId],
    queryFn: () => employeesApi.getHealth(employeeId),
  });

  const { data: workMetrics } = useQuery({
    queryKey: ['work', employeeId],
    queryFn: () => employeesApi.getWork(employeeId),
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', 'employee', employeeId],
    queryFn: () => alertsApi.getAll({ limit: 10 }),
  });

  const { data: personalization } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
  });

  const acknowledgeAlert = useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  if (loadingEmployee) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12 text-gray-500">
        Employee data not found
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {employee.firstName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Here's your wellness overview</p>
        </div>
        <ZoneBadge zone={employee.zone} />
      </div>

      {/* Personalization Setup Prompt */}
      <PersonalizationPrompt />

      {/* Quick Check-in */}
      <div className="card flex items-center justify-between">
        <QuickCheckin />
        {personalization?.activeLifeEvents && personalization.activeLifeEvents.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span>Active:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {personalization.activeLifeEvents[0].eventLabel}
            </span>
          </div>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          label="Current Zone"
          value={employee.zone === 'red' ? 'Burnout Risk' : employee.zone === 'green' ? 'Peak Ready' : 'Moderate'}
          zone={employee.zone}
        />
        <StatusCard
          label="Burnout Score"
          value={employee.burnoutScore?.toString() ?? '-'}
          subValue="/100"
          color="red"
        />
        <StatusCard
          label="Readiness Score"
          value={employee.readinessScore?.toString() ?? '-'}
          subValue="/100"
          color="green"
        />
        <StatusCard
          label="Status Date"
          value={employee.statusDate ? new Date(employee.statusDate).toLocaleDateString() : 'Today'}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Explainability Panel */}
        <ExplainabilityPanel employeeId={employeeId} />

        {/* Score Trends */}
        <div className="card">
          <h3 className="section-header mb-4">
            Score Trends
          </h3>
          {burnoutData?.history && burnoutData.history.length > 0 ? (
            <DualScoreChart data={burnoutData.history} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Meetings */}
      <UpcomingMeetings />

      {/* Metrics */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-header">
            Your Metrics
          </h3>
          <div className="flex gap-1">
            {(['sleep', 'heart', 'activity', 'work'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMetricsTab(tab)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  metricsTab === tab
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {metricsTab === 'work' ? (
          workMetrics && workMetrics.length > 0 ? (
            <WorkMetricsChart data={workMetrics} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No work metrics available
            </div>
          )
        ) : healthMetrics && healthMetrics.length > 0 ? (
          <HealthMetricsChart data={healthMetrics} metric={metricsTab} />
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-500">
            No health metrics available
          </div>
        )}
      </div>

      {/* Email Metrics */}
      <EmailMetrics />

      {/* Wellness Streaks */}
      <WellnessStreaks />

      {/* Insights & Predictive Alerts */}
      <InsightsAndAlerts />

      {/* Recent Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                showEmployee={false}
                onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Support Bot */}
      {isBotOpen ? (
        <SupportBot
          employeeId={employeeId}
          isOpen={isBotOpen}
          onClose={() => setIsBotOpen(false)}
        />
      ) : (
        <SupportBotButton onClick={() => setIsBotOpen(true)} />
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  subValue,
  zone,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  zone?: 'red' | 'yellow' | 'green';
  color?: 'red' | 'green';
}) {
  return (
    <div className="card">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span
          className={clsx(
            'text-2xl font-bold',
            zone === 'red' && 'text-red-600 dark:text-red-400',
            zone === 'yellow' && 'text-yellow-600 dark:text-yellow-400',
            zone === 'green' && 'text-green-600 dark:text-green-400',
            color === 'red' && 'text-red-600 dark:text-red-400',
            color === 'green' && 'text-green-600 dark:text-green-400',
            !zone && !color && 'text-gray-900 dark:text-white'
          )}
        >
          {value}
        </span>
        {subValue && <span className="text-gray-500 dark:text-gray-400">{subValue}</span>}
      </div>
    </div>
  );
}
