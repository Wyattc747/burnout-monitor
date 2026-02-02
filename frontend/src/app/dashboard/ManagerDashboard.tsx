'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, alertsApi } from '@/lib/api';
import { EmployeeCard } from '@/components/EmployeeCard';
import { AlertCard } from '@/components/AlertCard';
import { DemoControls } from '@/components/DemoControls';
import { TeamChallenges } from '@/components/TeamChallenges';
import { clsx } from 'clsx';
import type { Employee } from '@/types';
import {
  Users,
  BarChart3,
  Calendar,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export function ManagerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamsApi.getMembers,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', 'unacknowledged'],
    queryFn: () => alertsApi.getAll({ acknowledged: false }),
  });

  const acknowledgeAlert = useMutation({
    mutationFn: alertsApi.acknowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Calculate team stats
  const zoneCounts = {
    red: employees?.filter((e: Employee) => e.zone === 'red').length || 0,
    yellow: employees?.filter((e: Employee) => e.zone === 'yellow').length || 0,
    green: employees?.filter((e: Employee) => e.zone === 'green').length || 0,
  };
  const totalEmployees = employees?.length || 0;
  const unacknowledgedAlerts = alerts?.filter((a: any) => !a.isAcknowledged) || [];

  // Get employees needing attention (red zone)
  const employeesNeedingAttention = employees?.filter((e: Employee) => e.zone === 'red') || [];

  // Calculate team health score (weighted: green=100, yellow=60, red=20)
  const teamHealthScore = totalEmployees > 0
    ? Math.round((zoneCounts.green * 100 + zoneCounts.yellow * 60 + zoneCounts.red * 20) / totalEmployees)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Overview of your team's wellness and performance
        </p>
      </div>

      {/* Top Stats Row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TeamHealthCard score={teamHealthScore} trend={0} />
        <ZoneSummaryCard
          zone="red"
          count={zoneCounts.red}
          label="Burnout Risk"
          total={totalEmployees}
        />
        <ZoneSummaryCard
          zone="yellow"
          count={zoneCounts.yellow}
          label="Moderate"
          total={totalEmployees}
        />
        <ZoneSummaryCard
          zone="green"
          count={zoneCounts.green}
          label="Peak Ready"
          total={totalEmployees}
        />
      </div>

      {/* Priority Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Priority Alerts ({unacknowledgedAlerts.length})
              </h2>
            </div>
            <Link
              href="/dashboard/alerts"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {unacknowledgedAlerts.slice(0, 3).map((alert: any) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Employees Needing Attention */}
      {employeesNeedingAttention.length > 0 && (
        <div className="card border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-white dark:from-red-900/10 dark:to-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Needs Attention
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {employeesNeedingAttention.length} team member{employeesNeedingAttention.length > 1 ? 's' : ''} at risk of burnout
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/team?filter=red"
              className="btn btn-ghost text-sm flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {employeesNeedingAttention.slice(0, 3).map((employee: Employee) => {
              const wellnessScore = 100 - (employee.burnoutScore || 0);
              return (
                <div
                  key={employee.id}
                  className="relative bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Top colored bar */}
                  <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />

                  <div className="p-4">
                    {/* Header with avatar and info */}
                    <div
                      className="flex items-start gap-3 cursor-pointer mb-4"
                      onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-semibold shadow-lg">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {employee.jobTitle}
                        </p>
                      </div>
                    </div>

                    {/* Wellness Score */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Wellness Score</span>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">{wellnessScore}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all"
                          style={{ width: `${wellnessScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/meetings?employee=${employee.id}`}
                        className="flex-1 btn btn-sm bg-red-600 hover:bg-red-700 text-white border-0 justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Calendar className="w-4 h-4 mr-1.5" />
                        Schedule 1:1
                      </Link>
                      <button
                        onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
                        className="btn btn-sm btn-ghost px-3"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Challenges */}
      <TeamChallenges isManager={true} compact={true} />

      {/* Navigation Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <NavigationCard
          href="/dashboard/team"
          icon={<Users className="w-6 h-6" />}
          title="Team Members"
          description={`${totalEmployees} employees`}
          color="blue"
        />
        <NavigationCard
          href="/dashboard/analytics"
          icon={<BarChart3 className="w-6 h-6" />}
          title="Analytics"
          description="Trends & insights"
          color="purple"
        />
        <NavigationCard
          href="/dashboard/meetings"
          icon={<Calendar className="w-6 h-6" />}
          title="Meetings"
          description="1:1 scheduling"
          color="green"
        />
      </div>

      {/* Quick Team Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Team Overview</h2>
          <Link
            href="/dashboard/team"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {loadingEmployees ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees?.slice(0, 6).map((employee: Employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Demo Controls */}
      {employees && <DemoControls employees={employees} />}
    </div>
  );
}

function TeamHealthCard({ score, trend }: { score: number; trend: number }) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  return (
    <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Team Health</p>
      <div className="flex items-baseline gap-2">
        <span className={clsx('text-3xl font-bold', getHealthColor(score))}>
          {score}
        </span>
        <span className="text-gray-400">/100</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={clsx('text-sm font-medium', getHealthColor(score))}>
          {getHealthLabel(score)}
        </span>
        {trend !== 0 && (
          <span className={clsx(
            'text-xs flex items-center gap-0.5',
            trend > 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
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

  const zoneConfig = {
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500',
    },
    yellow: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-500',
    },
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      badge: 'bg-emerald-500',
    },
  };

  const config = zoneConfig[zone];

  return (
    <div className={clsx('card border', config.bg, config.border)}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-center justify-between">
        <span className={clsx('text-3xl font-bold', config.text)}>{count}</span>
        <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold', config.badge)}>
          {percentage}%
        </div>
      </div>
    </div>
  );
}

function NavigationCard({
  href,
  icon,
  title,
  description,
  color,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'purple' | 'red' | 'green';
  badge?: number;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  };

  return (
    <Link
      href={href}
      className="card hover:shadow-lg transition-all duration-200 group border border-transparent hover:border-gray-200 dark:hover:border-gray-700 relative"
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <div className={clsx('p-3 rounded-lg w-fit mb-3', colorClasses[color])}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
    </Link>
  );
}
