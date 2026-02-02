'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  Building2,
  AlertCircle,
  Trophy,
  UserPlus,
  Plus,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { organizationsApi } from '@/lib/api';
import type { OrganizationStats, AuditLogEntry } from '@/types';
import { formatDistanceToNow } from 'date-fns';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  href?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  const content = (
    <div className={`card ${href ? 'card-hover' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function ZoneDistributionCard({ zones }: { zones: { red: number; yellow: number; green: number } }) {
  const total = zones.red + zones.yellow + zones.green;
  const getPercentage = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        Zone Distribution
      </h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-green-600 dark:text-green-400 font-medium">Green Zone</span>
            <span className="text-gray-600 dark:text-gray-400">
              {zones.green} ({getPercentage(zones.green)}%)
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(zones.green)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">Yellow Zone</span>
            <span className="text-gray-600 dark:text-gray-400">
              {zones.yellow} ({getPercentage(zones.yellow)}%)
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(zones.yellow)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-red-600 dark:text-red-400 font-medium">Red Zone</span>
            <span className="text-gray-600 dark:text-gray-400">
              {zones.red} ({getPercentage(zones.red)}%)
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(zones.red)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ entry }: { entry: AuditLogEntry }) {
  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('invite')) {
      return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    }
    if (action.includes('delete') || action.includes('revoke')) {
      return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    }
    return <Clock className="w-4 h-4 text-blue-500" />;
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5">{getActionIcon(entry.action)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-white">
          <span className="font-medium">{entry.userEmail}</span>{' '}
          <span className="text-gray-600 dark:text-gray-400">
            {formatAction(entry.action).toLowerCase()}
          </span>
          {entry.resourceType && (
            <span className="text-gray-600 dark:text-gray-400">
              {' '}
              {entry.resourceType.replace(/_/g, ' ')}
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/admin/employees?action=invite"
          className="btn btn-primary flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Invite Employees
        </Link>
        <Link
          href="/admin/departments?action=create"
          className="btn btn-secondary flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </Link>
        <Link
          href="/admin/employees"
          className="btn btn-ghost flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          View Reports
        </Link>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<OrganizationStats>({
    queryKey: ['organization-stats'],
    queryFn: organizationsApi.getStats,
  });

  const { data: activity, isLoading: activityLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['organization-activity'],
    queryFn: () => organizationsApi.getActivity(10),
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton h-4 w-24 mb-4" />
              <div className="skeleton h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of your organization's wellness metrics and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Employees"
          value={stats?.employees.total || 0}
          subtitle={`${stats?.employees.active || 0} active, ${stats?.employees.pending || 0} pending`}
          icon={Users}
          color="blue"
          href="/admin/employees"
        />
        <StatCard
          title="Departments"
          value={stats?.departments || 0}
          icon={Building2}
          color="purple"
          href="/admin/departments"
        />
        <StatCard
          title="Pending Invitations"
          value={stats?.pendingInvitations || 0}
          icon={UserPlus}
          color="yellow"
          href="/admin/employees?tab=invitations"
        />
        <StatCard
          title="Active Challenges"
          value={stats?.activeChallenges || 0}
          icon={Trophy}
          color="green"
        />
      </div>

      {/* Zone Distribution & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats?.zones && <ZoneDistributionCard zones={stats.zones} />}
        <QuickActions />
      </div>

      {/* Alerts Banner */}
      {stats && stats.unacknowledgedAlerts > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-200">
              <span className="font-semibold">{stats.unacknowledgedAlerts}</span> unacknowledged{' '}
              {stats.unacknowledgedAlerts === 1 ? 'alert' : 'alerts'} requiring attention
            </p>
          </div>
          <Link
            href="/dashboard/alerts"
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            View all
          </Link>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h3>
          <Link
            href="/admin/settings?tab=audit-log"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all
          </Link>
        </div>
        {activityLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="skeleton h-4 w-4 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-full max-w-md" />
                  <div className="skeleton h-3 w-24 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {activity.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No recent activity to display
          </p>
        )}
      </div>

      {/* Subscription Info */}
      {stats?.subscription && (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {stats.subscription.tier} Plan
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stats.employees.total} of {stats.subscription.maxEmployees} employee seats used
              </p>
              {stats.subscription.trialEndsAt && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  Trial ends{' '}
                  {formatDistanceToNow(new Date(stats.subscription.trialEndsAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
            <Link href="/admin/billing" className="btn btn-primary">
              Manage Subscription
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
