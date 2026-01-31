'use client';

import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/lib/auth';
import { employeesApi, personalizationApi } from '@/lib/api';
import { PredictiveTimeline } from '@/components/PredictiveTimeline';
import { ExplainabilityPanel } from '@/components/ExplainabilityPanel';
import { InsightsAndAlerts } from '@/components/InsightsAndAlerts';
import { ZoneBadge } from '@/components/ZoneIndicator';
import Link from 'next/link';

export default function InsightsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const employeeId = user?.employee?.id;

  const { data: employee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesApi.getById(employeeId!),
    enabled: !!employeeId,
  });

  const { data: burnoutData } = useQuery({
    queryKey: ['burnout', employeeId],
    queryFn: () => employeesApi.getBurnout(employeeId!),
    enabled: !!employeeId,
  });

  const { data: personalization } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
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
      <div className="text-center py-12 text-gray-500">
        Unable to load insights
      </div>
    );
  }

  // Calculate zone history for calendar
  const zoneHistory = burnoutData?.history || [];
  const last30Days = zoneHistory.slice(0, 30);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Understand your patterns and predictions
          </p>
        </div>
        {employee && <ZoneBadge zone={employee.zone} />}
      </div>

      {/* Quick Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Current Burnout Risk"
          value={employee?.burnoutScore ?? '-'}
          subtext="/100"
          trend={(() => {
            const yesterday = burnoutData?.history?.[1] as any;
            const score = yesterday?.burnout_score ?? yesterday?.burnoutScore;
            return score ? (employee?.burnoutScore || 0) - score : 0;
          })()}
          trendLabel="vs yesterday"
          color="red"
        />
        <SummaryCard
          label="Readiness Score"
          value={employee?.readinessScore ?? '-'}
          subtext="/100"
          trend={(() => {
            const yesterday = burnoutData?.history?.[1] as any;
            const score = yesterday?.readiness_score ?? yesterday?.readinessScore;
            return score ? (employee?.readinessScore || 0) - score : 0;
          })()}
          trendLabel="vs yesterday"
          color="green"
          invertTrend
        />
        <SummaryCard
          label="Days in Current Zone"
          value={calculateDaysInZone(zoneHistory, employee?.zone)}
          subtext="days"
          color="blue"
        />
      </div>

      {/* Predictive Timeline */}
      <PredictiveTimeline employeeId={employeeId} />

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Factor Breakdown */}
        <ExplainabilityPanel employeeId={employeeId} />

        {/* Zone History Calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Zone History (Last 30 Days)
          </h3>
          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1">
                {day}
              </div>
            ))}
            {generateCalendarDays(last30Days).map((day, i) => (
              <div
                key={i}
                className={`aspect-square rounded-md flex items-center justify-center text-xs ${
                  day.zone === 'green' ? 'bg-emerald-500 text-white' :
                  day.zone === 'yellow' ? 'bg-amber-500 text-white' :
                  day.zone === 'red' ? 'bg-red-500 text-white' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}
                title={day.date ? `${day.date}: ${day.zone || 'No data'}` : 'No data'}
              >
                {day.dayOfMonth}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500"></span> Green
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-500"></span> Yellow
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500"></span> Red
            </span>
          </div>
        </div>
      </div>

      {/* Detected Patterns & Alerts */}
      <InsightsAndAlerts />

      {/* Active Life Events */}
      {personalization?.activeLifeEvents && personalization.activeLifeEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Life Events
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These events are adjusting your wellness expectations
          </p>
          <div className="space-y-3">
            {personalization.activeLifeEvents.map((event: any) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{event.eventLabel}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Started {new Date(event.startDate).toLocaleDateString()}
                      {event.endDate && ` • Ends ${new Date(event.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings/personalization"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Manage
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back to Dashboard */}
      <div className="text-center">
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

function SummaryCard({
  label,
  value,
  subtext,
  trend,
  trendLabel,
  color,
  invertTrend = false,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  trend?: number;
  trendLabel?: string;
  color: 'red' | 'green' | 'blue';
  invertTrend?: boolean;
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  const isPositive = invertTrend ? (trend || 0) > 0 : (trend || 0) < 0;
  const isNegative = invertTrend ? (trend || 0) < 0 : (trend || 0) > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</span>
        {subtext && <span className="text-gray-400 dark:text-gray-500">{subtext}</span>}
      </div>
      {trend !== undefined && trend !== 0 && (
        <p className={`text-xs mt-1 ${
          isPositive ? 'text-emerald-600 dark:text-emerald-400' :
          isNegative ? 'text-red-600 dark:text-red-400' :
          'text-gray-500'
        }`}>
          {trend > 0 ? '+' : ''}{trend.toFixed(0)} {trendLabel}
        </p>
      )}
    </div>
  );
}

function calculateDaysInZone(history: any[], currentZone?: string): number {
  if (!history || history.length === 0 || !currentZone) return 0;

  let count = 0;
  for (const day of history) {
    if (day.zone === currentZone) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function generateCalendarDays(history: any[]): { date?: string; zone?: string; dayOfMonth?: number }[] {
  const days: { date?: string; zone?: string; dayOfMonth?: number }[] = [];
  const today = new Date();

  // Create a map of dates to zones
  const zoneByDate = new Map<string, string>();
  history.forEach((h: any) => {
    zoneByDate.set(h.date, h.zone);
  });

  // Generate last 35 days (5 weeks) for calendar grid
  for (let i = 34; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    days.push({
      date: dateStr,
      zone: zoneByDate.get(dateStr),
      dayOfMonth: date.getDate(),
    });
  }

  return days;
}
