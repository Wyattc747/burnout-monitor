'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/lib/auth';
import { employeesApi } from '@/lib/api';
import { HealthMetricsChart, WorkMetricsChart, DualScoreChart } from '@/components/Charts';
import { EmailMetrics } from '@/components/EmailMetrics';
import Link from 'next/link';
import { clsx } from 'clsx';

type MetricTab = 'overview' | 'sleep' | 'heart' | 'activity' | 'work' | 'email';

export default function MetricsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [activeTab, setActiveTab] = useState<MetricTab>('overview');
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);
  const employeeId = user?.employee?.id;

  const { data: healthMetrics, isLoading: loadingHealth } = useQuery({
    queryKey: ['health', employeeId, timeRange],
    queryFn: () => employeesApi.getHealth(employeeId!, timeRange),
    enabled: !!employeeId,
  });

  const { data: workMetrics, isLoading: loadingWork } = useQuery({
    queryKey: ['work', employeeId, timeRange],
    queryFn: () => employeesApi.getWork(employeeId!, timeRange),
    enabled: !!employeeId,
  });

  const { data: burnoutData } = useQuery({
    queryKey: ['burnout', employeeId, timeRange],
    queryFn: () => employeesApi.getBurnout(employeeId!, timeRange),
    enabled: !!employeeId,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Unable to load metrics
      </div>
    );
  }

  const tabs: { id: MetricTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'sleep', label: 'Sleep', icon: '😴' },
    { id: 'heart', label: 'Heart & Stress', icon: '❤️' },
    { id: 'activity', label: 'Activity', icon: '🏃' },
    { id: 'work', label: 'Work', icon: '💼' },
    { id: 'email', label: 'Email', icon: '📧' },
  ];

  // Calculate averages for summary cards
  const avgSleep = healthMetrics && healthMetrics.length > 0
    ? healthMetrics.reduce((sum, m) => sum + (m.sleepHours || 0), 0) / healthMetrics.length
    : 0;
  const avgHRV = healthMetrics && healthMetrics.length > 0
    ? healthMetrics.reduce((sum, m) => sum + (m.heartRateVariability || 0), 0) / healthMetrics.length
    : 0;
  const avgExercise = healthMetrics && healthMetrics.length > 0
    ? healthMetrics.reduce((sum, m) => sum + (m.exerciseMinutes || 0), 0) / healthMetrics.length
    : 0;
  const avgWorkHours = workMetrics && workMetrics.length > 0
    ? workMetrics.reduce((sum, m) => sum + (m.hoursWorked || 0), 0) / workMetrics.length
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metrics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Deep dive into your wellness data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days as 7 | 14 | 30)}
              className={clsx(
                'px-3 py-1 text-sm rounded-lg transition-colors',
                timeRange === days
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon="😴"
              label="Avg Sleep"
              value={avgSleep.toFixed(1)}
              unit="hrs"
              target={7}
              color="indigo"
            />
            <MetricCard
              icon="❤️"
              label="Avg HRV"
              value={avgHRV.toFixed(0)}
              unit="ms"
              color="red"
            />
            <MetricCard
              icon="🏃"
              label="Avg Activity"
              value={avgExercise.toFixed(0)}
              unit="min"
              target={30}
              color="green"
            />
            <MetricCard
              icon="💼"
              label="Avg Work"
              value={avgWorkHours.toFixed(1)}
              unit="hrs"
              target={8}
              color="blue"
            />
          </div>

          {/* Score Trends */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Score Trends
            </h3>
            {burnoutData?.history && burnoutData.history.length > 0 ? (
              <DualScoreChart data={burnoutData.history} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No trend data available
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tabs.slice(1).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <span className="text-2xl">{tab.icon}</span>
                <p className="font-medium text-gray-900 dark:text-white mt-2">{tab.label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">View details →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sleep' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <MetricCard icon="😴" label="Avg Sleep" value={avgSleep.toFixed(1)} unit="hrs" target={7} color="indigo" />
            <MetricCard
              icon="🌙"
              label="Avg Deep Sleep"
              value={healthMetrics ? (healthMetrics.reduce((sum, m) => sum + (m.deepSleepHours || 0), 0) / healthMetrics.length).toFixed(1) : '0'}
              unit="hrs"
              color="purple"
            />
            <MetricCard
              icon="⭐"
              label="Avg Quality"
              value={healthMetrics ? (healthMetrics.reduce((sum, m) => sum + (m.sleepQualityScore || 0), 0) / healthMetrics.length).toFixed(0) : '0'}
              unit="/100"
              color="yellow"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sleep Over Time
            </h3>
            {healthMetrics && healthMetrics.length > 0 ? (
              <HealthMetricsChart data={healthMetrics} metric="sleep" />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No sleep data available
              </div>
            )}
          </div>

          <SleepInsights data={healthMetrics || []} />
        </div>
      )}

      {activeTab === 'heart' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <MetricCard icon="💓" label="Avg HRV" value={avgHRV.toFixed(0)} unit="ms" color="red" />
            <MetricCard
              icon="❤️"
              label="Avg Resting HR"
              value={healthMetrics ? (healthMetrics.reduce((sum, m) => sum + (m.restingHeartRate || 0), 0) / healthMetrics.length).toFixed(0) : '0'}
              unit="bpm"
              color="pink"
            />
            <MetricCard
              icon="🔋"
              label="Avg Recovery"
              value={healthMetrics ? (healthMetrics.reduce((sum, m) => sum + (m.recoveryScore || 0), 0) / healthMetrics.length).toFixed(0) : '0'}
              unit="/100"
              color="green"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Heart Rate Variability
            </h3>
            {healthMetrics && healthMetrics.length > 0 ? (
              <HealthMetricsChart data={healthMetrics} metric="heart" />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No heart data available
              </div>
            )}
          </div>

          <HeartInsights data={healthMetrics || []} />
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <MetricCard icon="🏃" label="Avg Exercise" value={avgExercise.toFixed(0)} unit="min" target={30} color="green" />
            <MetricCard
              icon="👣"
              label="Avg Steps"
              value={healthMetrics ? (healthMetrics.reduce((sum, m) => sum + (m.steps || 0), 0) / healthMetrics.length / 1000).toFixed(1) : '0'}
              unit="k"
              target={10}
              color="orange"
            />
            <MetricCard
              icon="🔥"
              label="Active Days"
              value={healthMetrics ? healthMetrics.filter(m => (m.exerciseMinutes || 0) >= 20).length.toString() : '0'}
              unit={`/${timeRange}`}
              color="red"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Activity Over Time
            </h3>
            {healthMetrics && healthMetrics.length > 0 ? (
              <HealthMetricsChart data={healthMetrics} metric="activity" />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No activity data available
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-4 gap-4">
            <MetricCard icon="💼" label="Avg Hours" value={avgWorkHours.toFixed(1)} unit="hrs" target={8} color="blue" />
            <MetricCard
              icon="⏰"
              label="Avg Overtime"
              value={workMetrics ? (workMetrics.reduce((sum, m) => sum + (m.overtimeHours || 0), 0) / workMetrics.length).toFixed(1) : '0'}
              unit="hrs"
              color="red"
            />
            <MetricCard
              icon="📅"
              label="Avg Meetings"
              value={workMetrics ? (workMetrics.reduce((sum, m) => sum + (m.meetingsAttended || 0), 0) / workMetrics.length).toFixed(1) : '0'}
              unit="/day"
              color="purple"
            />
            <MetricCard
              icon="✅"
              label="Task Completion"
              value={workMetrics ? (
                (workMetrics.reduce((sum, m) => sum + (m.tasksCompleted || 0), 0) /
                Math.max(1, workMetrics.reduce((sum, m) => sum + (m.tasksAssigned || 0), 0))) * 100
              ).toFixed(0) : '0'}
              unit="%"
              color="green"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Work Hours Over Time
            </h3>
            {workMetrics && workMetrics.length > 0 ? (
              <WorkMetricsChart data={workMetrics} />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No work data available
              </div>
            )}
          </div>

          <WorkInsights data={workMetrics || []} />
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-6">
          <EmailMetrics />
        </div>
      )}

      {/* Back to Dashboard */}
      <div className="text-center pt-4">
        <Link
          href="/dashboard"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  target,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  target?: number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  };

  const numValue = parseFloat(value);
  const atTarget = target ? numValue >= target : true;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg p-2 rounded-lg ${colorClasses[color]}`}>{icon}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        <span className="text-gray-400 dark:text-gray-500 text-sm">{unit}</span>
      </div>
      {target && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Target: {target}</span>
            <span className={atTarget ? 'text-green-500' : 'text-amber-500'}>
              {atTarget ? '✓ On track' : 'Below target'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${atTarget ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, (numValue / target) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SleepInsights({ data }: { data: any[] }) {
  if (data.length < 3) return null;

  const avgSleep = data.reduce((sum, m) => sum + (m.sleepHours || 0), 0) / data.length;
  const bestDay = data.reduce((best, m) => (m.sleepHours || 0) > (best.sleepHours || 0) ? m : best, data[0]);
  const worstDay = data.reduce((worst, m) => (m.sleepHours || 0) < (worst.sleepHours || 0) ? m : worst, data[0]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sleep Insights</h3>
      <div className="space-y-3">
        <InsightItem
          icon="📊"
          text={`Your average sleep is ${avgSleep.toFixed(1)} hours${avgSleep >= 7 ? ' - great job!' : ' - try to get more rest'}`}
        />
        <InsightItem
          icon="🌟"
          text={`Best night: ${bestDay.sleepHours?.toFixed(1) || 0} hours on ${new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' })}`}
        />
        <InsightItem
          icon="💡"
          text={`Tip: Consistent bedtimes improve sleep quality more than total hours`}
        />
      </div>
    </div>
  );
}

function HeartInsights({ data }: { data: any[] }) {
  if (data.length < 3) return null;

  const avgHRV = data.reduce((sum, m) => sum + (m.heartRateVariability || 0), 0) / data.length;
  const trend = data.length >= 7
    ? data.slice(0, 3).reduce((sum, m) => sum + (m.heartRateVariability || 0), 0) / 3 -
      data.slice(-3).reduce((sum, m) => sum + (m.heartRateVariability || 0), 0) / 3
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Heart & Stress Insights</h3>
      <div className="space-y-3">
        <InsightItem
          icon="❤️"
          text={`Average HRV: ${avgHRV.toFixed(0)}ms - ${avgHRV > 50 ? 'good recovery capacity' : 'moderate stress levels'}`}
        />
        {trend !== 0 && (
          <InsightItem
            icon={trend > 0 ? '📈' : '📉'}
            text={`Your HRV is ${trend > 0 ? 'improving' : 'declining'} - ${trend > 0 ? 'keep it up!' : 'consider more recovery time'}`}
          />
        )}
        <InsightItem
          icon="💡"
          text="Higher HRV generally indicates better stress resilience and recovery"
        />
      </div>
    </div>
  );
}

function WorkInsights({ data }: { data: any[] }) {
  if (data.length < 3) return null;

  const avgHours = data.reduce((sum, m) => sum + (m.hoursWorked || 0), 0) / data.length;
  const avgOvertime = data.reduce((sum, m) => sum + (m.overtimeHours || 0), 0) / data.length;
  const avgMeetings = data.reduce((sum, m) => sum + (m.meetingsAttended || 0), 0) / data.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Work Insights</h3>
      <div className="space-y-3">
        <InsightItem
          icon="⏰"
          text={`Average ${avgHours.toFixed(1)} hours/day with ${avgOvertime.toFixed(1)} hours overtime`}
        />
        <InsightItem
          icon="📅"
          text={`~${avgMeetings.toFixed(0)} meetings per day${avgMeetings > 5 ? ' - consider protecting focus time' : ''}`}
        />
        {avgOvertime > 1 && (
          <InsightItem
            icon="⚠️"
            text="Consistent overtime can lead to burnout - try to maintain boundaries"
          />
        )}
      </div>
    </div>
  );
}

function InsightItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="text-lg">{icon}</span>
      <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
    </div>
  );
}
