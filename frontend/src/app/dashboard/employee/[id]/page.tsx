'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, alertsApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { ZoneBadge } from '@/components/ZoneIndicator';
import { ExplainabilityPanel } from '@/components/ExplainabilityPanel';
import { AlertCard } from '@/components/AlertCard';
import { DualScoreChart, WorkMetricsChart, WorkBreakdownChart } from '@/components/Charts';
import { SupportBot, SupportBotButton } from '@/components/SupportBot';
import { CommunicationMetrics, WorkPatterns, WellnessIndicators, WeeklyTrends } from '@/components/EmployeeMetrics';
import { clsx } from 'clsx';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const employeeId = params.id as string;
  const [metricsTab, setMetricsTab] = useState<'hours' | 'tasks' | 'breakdown'>('hours');
  const [isBotOpen, setIsBotOpen] = useState(false);

  // Only managers can access this page
  const { user, isLoading: authLoading } = useRequireAuth('manager');

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesApi.getById(employeeId),
    enabled: !!employeeId && user?.role === 'manager',
  });

  const { data: burnoutData } = useQuery({
    queryKey: ['burnout', employeeId],
    queryFn: () => employeesApi.getBurnout(employeeId),
    enabled: !!employeeId,
  });

  // Managers can only see work metrics, not health metrics
  const { data: workMetrics } = useQuery({
    queryKey: ['work', employeeId],
    queryFn: () => employeesApi.getWork(employeeId),
    enabled: !!employeeId,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', 'employee', employeeId],
    queryFn: () => alertsApi.getAll({ limit: 20 }),
    enabled: !!employeeId,
  });

  const acknowledgeAlert = useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Filter alerts for this employee
  const employeeAlerts = alerts?.filter((a) => a.employeeId === employeeId) || [];

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Employee not found</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="btn btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-gray-600">
              {employee.jobTitle} • {employee.department}
            </p>
          </div>
        </div>
        <ZoneBadge zone={employee.zone} />
      </div>

      {/* Status Summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={clsx(
            'card',
            employee.zone === 'red' && 'ring-2 ring-red-200',
            employee.zone === 'green' && 'ring-2 ring-green-200'
          )}
        >
          <p className="text-sm text-gray-600 mb-1">Current Zone</p>
          <p
            className={clsx(
              'text-2xl font-bold',
              employee.zone === 'red' && 'text-red-600',
              employee.zone === 'yellow' && 'text-yellow-600',
              employee.zone === 'green' && 'text-green-600'
            )}
          >
            {employee.zone === 'red'
              ? 'Burnout Risk'
              : employee.zone === 'green'
              ? 'Peak Ready'
              : 'Moderate'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Burnout Score</p>
          <p className="text-2xl font-bold text-red-600">
            {employee.burnoutScore ?? '-'}
            <span className="text-gray-400 text-base font-normal">/100</span>
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Readiness Score</p>
          <p className="text-2xl font-bold text-green-600">
            {employee.readinessScore ?? '-'}
            <span className="text-gray-400 text-base font-normal">/100</span>
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 mb-1">Email</p>
          <p className="text-lg font-medium text-gray-900 truncate">
            {employee.email}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Explainability */}
        <ExplainabilityPanel employeeId={employeeId} />

        {/* Score Trends */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Score History
          </h3>
          {burnoutData?.history && burnoutData.history.length > 0 ? (
            <DualScoreChart data={burnoutData.history} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No history available
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Metrics Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Communication Patterns */}
        <CommunicationMetrics employeeId={employeeId} />

        {/* Work Patterns */}
        <WorkPatterns employeeId={employeeId} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Wellness Indicators (Privacy-respecting) */}
        <WellnessIndicators employeeId={employeeId} zone={employee.zone} />

        {/* Weekly Summary */}
        <WeeklyTrends employeeId={employeeId} />
      </div>

      {/* Work Metrics - Managers only see work data, not health data */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Work Metrics</h3>
          <div className="flex gap-1">
            {(['hours', 'tasks', 'breakdown'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMetricsTab(tab)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  metricsTab === tab
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {tab === 'hours' ? 'Hours' : tab === 'tasks' ? 'Tasks' : 'Breakdown'}
              </button>
            ))}
          </div>
        </div>

        {workMetrics && workMetrics.length > 0 ? (
          metricsTab === 'breakdown' ? (
            <WorkBreakdownChart data={workMetrics} />
          ) : (
            <WorkMetricsChart data={workMetrics} view={metricsTab} />
          )
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-500">
            No work metrics available
          </div>
        )}
      </div>

      {/* Alert History */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Alert History
        </h3>
        {employeeAlerts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No alerts for this employee</p>
        ) : (
          <div className="space-y-3">
            {employeeAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                showEmployee={false}
                onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Support Bot for Managers */}
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
