'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { interventionsApi } from '@/lib/api';
import type { Intervention, OutcomeStatus, Zone } from '@/types';

interface InterventionTrackerProps {
  employeeId?: string;
  compact?: boolean;
}

const OUTCOME_STYLES: Record<OutcomeStatus, { bg: string; text: string; icon: string }> = {
  improved: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'M5 13l4 4L19 7',
  },
  stable: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'M5 12h14',
  },
  declined: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: 'M19 13l-4 4-10-10',
  },
  pending: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const ZONE_COLORS: Record<Zone, string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  green: 'bg-emerald-500',
};

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  check_in: 'Check-in',
  workload_adjustment: 'Workload Adjustment',
  time_off: 'Time Off Discussion',
  resource_referral: 'Resource Referral',
  recognition: 'Recognition',
  goal_setting: 'Goal Setting',
  other: 'Other',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

function InterventionCard({ intervention }: { intervention: Intervention }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const outcome = intervention.outcome;
  const outcomeStyle = outcome ? OUTCOME_STYLES[outcome.status] : OUTCOME_STYLES.pending;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <Avatar name={intervention.employeeName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {intervention.employeeName}
            </h4>
            <span className={`w-2 h-2 rounded-full ${ZONE_COLORS[intervention.zoneBefore]}`} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {INTERVENTION_TYPE_LABELS[intervention.type]} - {formatRelativeDate(intervention.meetingDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${outcomeStyle.bg} ${outcomeStyle.text}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={outcomeStyle.icon} />
            </svg>
            {outcome ? outcome.status.charAt(0).toUpperCase() + outcome.status.slice(1) : 'Pending'}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Meeting Date</p>
              <p className="text-gray-900 dark:text-white">{formatDate(intervention.meetingDate)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Zone at Meeting</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${ZONE_COLORS[intervention.zoneBefore]}`} />
                <span className="text-gray-900 dark:text-white capitalize">{intervention.zoneBefore}</span>
                {outcome?.zoneAfter && outcome.zoneAfter !== intervention.zoneBefore && (
                  <>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className={`w-2.5 h-2.5 rounded-full ${ZONE_COLORS[outcome.zoneAfter]}`} />
                    <span className="text-gray-900 dark:text-white capitalize">{outcome.zoneAfter}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {intervention.actionsTaken && intervention.actionsTaken.length > 0 && (
            <div className="mt-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Actions Taken</p>
              <ul className="space-y-1">
                {intervention.actionsTaken.map((action, i) => (
                  <li key={i} className="text-sm text-gray-900 dark:text-white flex items-start gap-2">
                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intervention.notes && (
            <div className="mt-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Notes</p>
              <p className="text-sm text-gray-900 dark:text-white">{intervention.notes}</p>
            </div>
          )}

          {intervention.followUpDate && (
            <div className="mt-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Follow-up Scheduled</p>
              <p className="text-sm text-gray-900 dark:text-white">{formatDate(intervention.followUpDate)}</p>
            </div>
          )}

          {outcome && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Outcome</p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${outcomeStyle.bg} ${outcomeStyle.text}`}>
                  {outcome.status.charAt(0).toUpperCase() + outcome.status.slice(1)}
                </span>
                {outcome.daysToImprovement && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    in {outcome.daysToImprovement} days
                  </span>
                )}
              </div>
              {outcome.notes && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{outcome.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InterventionTracker({ employeeId, compact = false }: InterventionTrackerProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'improved'>('all');

  const { data: interventions = [], isLoading } = useQuery({
    queryKey: ['interventions', employeeId],
    queryFn: () => interventionsApi.getAll({ employeeId, includeOutcomes: true, limit: 50 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['intervention-stats'],
    queryFn: interventionsApi.getTeamStats,
    enabled: !employeeId,
  });

  const filteredInterventions = interventions.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !i.outcome || i.outcome.status === 'pending';
    if (filter === 'improved') return i.outcome?.status === 'improved';
    return true;
  });

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {employeeId ? 'Intervention History' : '1:1 Intervention Tracker'}
          </h2>
          {stats && !employeeId && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats.improvementRate.toFixed(0)}% improvement rate
              {stats.avgDaysToImprovement && ` | ~${stats.avgDaysToImprovement.toFixed(0)} days avg`}
            </p>
          )}
        </div>
        {!compact && (
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['all', 'pending', 'improved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards (for team view) */}
      {stats && !employeeId && !compact && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalInterventions}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total 1:1s</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.improvementRate.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Improved</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.avgDaysToImprovement ? `${stats.avgDaysToImprovement.toFixed(0)}d` : '-'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Time</p>
          </div>
        </div>
      )}

      {filteredInterventions.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No interventions recorded yet.' : `No ${filter} interventions.`}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Schedule a 1:1 and log the outcome to track progress.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredInterventions.slice(0, compact ? 5 : undefined).map((intervention) => (
            <InterventionCard key={intervention.id} intervention={intervention} />
          ))}
        </div>
      )}

      {compact && filteredInterventions.length > 5 && (
        <button className="btn btn-ghost w-full mt-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          View all {filteredInterventions.length} interventions
        </button>
      )}
    </div>
  );
}

export default InterventionTracker;
