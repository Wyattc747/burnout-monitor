'use client';

import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { TeamWellnessInsights } from '@/components/TeamWellnessInsights';
import { TeamHeatmap } from '@/components/TeamHeatmap';
import { TeamPatterns } from '@/components/TeamPatterns';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { Employee } from '@/types';
import { ChevronLeft, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useRequireAuth({ requiredRoles: ['manager', 'admin', 'super_admin'] });

  const { data: employees, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamsApi.getMembers,
    enabled: !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate team metrics
  const zoneCounts = {
    red: employees?.filter((e: Employee) => e.zone === 'red').length || 0,
    yellow: employees?.filter((e: Employee) => e.zone === 'yellow').length || 0,
    green: employees?.filter((e: Employee) => e.zone === 'green').length || 0,
  };

  const totalEmployees = employees?.length || 0;
  const avgWellness = totalEmployees > 0
    ? Math.round(employees!.reduce((sum: number, e: Employee) => sum + (100 - (e.burnoutScore || 0)), 0) / totalEmployees)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Team Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Insights and trends for your team's wellness
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Team Size"
          value={totalEmployees}
          icon="👥"
        />
        <MetricCard
          label="Avg Wellness"
          value={avgWellness}
          suffix="/100"
          trend={3}
          color={avgWellness >= 70 ? 'green' : avgWellness >= 40 ? 'yellow' : 'red'}
        />
        <MetricCard
          label="Peak Performers"
          value={zoneCounts.green}
          suffix={`/ ${totalEmployees}`}
          color="green"
        />
        <MetricCard
          label="At Risk"
          value={zoneCounts.red}
          suffix={`/ ${totalEmployees}`}
          color={zoneCounts.red > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Team Wellness Insights */}
      <TeamWellnessInsights />

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Team Heatmap */}
        <TeamHeatmap />

        {/* Zone Distribution Over Time */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Zone Distribution
          </h3>
          <div className="space-y-4">
            <ZoneBar label="Peak Ready" count={zoneCounts.green} total={totalEmployees} color="green" />
            <ZoneBar label="Moderate" count={zoneCounts.yellow} total={totalEmployees} color="yellow" />
            <ZoneBar label="Burnout Risk" count={zoneCounts.red} total={totalEmployees} color="red" />
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Department Breakdown
            </h4>
            <DepartmentBreakdown employees={employees || []} />
          </div>
        </div>
      </div>

      {/* Team Patterns */}
      <TeamPatterns />

      {/* Recommendations */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Team Recommendations
        </h3>
        <div className="space-y-3">
          {zoneCounts.red > 0 && (
            <RecommendationItem
              type="urgent"
              title={`${zoneCounts.red} team member${zoneCounts.red > 1 ? 's' : ''} need attention`}
              description="Schedule 1:1 meetings to discuss workload and support options."
              action="View Team Members"
              actionHref="/dashboard/team?filter=red"
            />
          )}
          {avgWellness < 50 && (
            <RecommendationItem
              type="warning"
              title="Team wellness needs attention"
              description="Consider reviewing project deadlines and workload distribution."
              action="View Analytics"
              actionHref="/dashboard/analytics"
            />
          )}
          {zoneCounts.green > totalEmployees * 0.6 && (
            <RecommendationItem
              type="positive"
              title="Team wellness is strong"
              description="Great job! Most of your team is in the peak ready zone."
            />
          )}
          <RecommendationItem
            type="info"
            title="Regular check-ins help"
            description="Weekly 1:1 meetings with team members can help identify issues early."
            action="Schedule Meetings"
            actionHref="/dashboard/meetings"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  trend,
  color,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  trend?: number;
  color?: 'red' | 'yellow' | 'green';
  icon?: string;
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-amber-600 dark:text-amber-400',
    green: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={clsx('text-3xl font-bold', color && colorClasses[color], !color && 'text-gray-900 dark:text-white')}>
          {value}
        </span>
        {suffix && <span className="text-gray-400 text-sm">{suffix}</span>}
      </div>
      {trend !== undefined && trend !== 0 && (
        <div className={clsx(
          'flex items-center gap-1 mt-1 text-xs',
          trend > 0 ? 'text-emerald-600' : 'text-red-600'
        )}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}% vs last week
        </div>
      )}
    </div>
  );
}

function ZoneBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'red' | 'yellow' | 'green';
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-amber-500',
    green: 'bg-emerald-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {count} ({Math.round(percentage)}%)
        </span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DepartmentBreakdown({ employees }: { employees: Employee[] }) {
  const departments = employees.reduce((acc: Record<string, { total: number; red: number; yellow: number; green: number }>, emp) => {
    if (!acc[emp.department]) {
      acc[emp.department] = { total: 0, red: 0, yellow: 0, green: 0 };
    }
    acc[emp.department].total++;
    if (emp.zone) acc[emp.department][emp.zone]++;
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {Object.entries(departments).map(([dept, counts]) => (
        <div key={dept} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400 w-24 truncate">{dept}</span>
          <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            {counts.green > 0 && (
              <div
                className="bg-emerald-500"
                style={{ width: `${(counts.green / counts.total) * 100}%` }}
              />
            )}
            {counts.yellow > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${(counts.yellow / counts.total) * 100}%` }}
              />
            )}
            {counts.red > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${(counts.red / counts.total) * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs text-gray-500 w-8">{counts.total}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendationItem({
  type,
  title,
  description,
  action,
  actionHref,
}: {
  type: 'urgent' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}) {
  const typeConfig = {
    urgent: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: '🚨',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: '⚠️',
    },
    positive: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: '✅',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: '💡',
    },
  };

  const config = typeConfig[type];

  return (
    <div className={clsx('p-4 rounded-lg border', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{config.icon}</span>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          {action && actionHref && (
            <Link
              href={actionHref}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              {action} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
