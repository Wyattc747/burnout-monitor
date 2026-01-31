'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { employeesApi } from '@/lib/api';
import { ZoneBadge } from './ZoneIndicator';
import { useAuth } from '@/lib/auth';
import type { Factor, Zone, UserRole } from '@/types';

interface ExplainabilityPanelProps {
  employeeId: string;
  viewerRole?: UserRole;
}

function FactorItem({ factor }: { factor: Factor }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div
        className={clsx(
          'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs',
          factor.impact === 'positive' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
          factor.impact === 'negative' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
          factor.impact === 'neutral' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        )}
      >
        {factor.impact === 'positive' && '↑'}
        {factor.impact === 'negative' && '↓'}
        {factor.impact === 'neutral' && '−'}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900 dark:text-white">{factor.name}</span>
          <span
            className={clsx(
              'text-sm font-medium',
              factor.impact === 'positive' && 'text-green-600 dark:text-green-400',
              factor.impact === 'negative' && 'text-red-600 dark:text-red-400',
              factor.impact === 'neutral' && 'text-gray-600 dark:text-gray-400'
            )}
          >
            {factor.value}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{factor.description}</p>
      </div>
    </div>
  );
}

function RecommendationItem({ recommendation, type }: { recommendation: string; type: 'personal' | 'leadership' }) {
  // Parse leadership recommendation categories
  const leadershipMatch = recommendation.match(/^([A-Z]+):\s*(.+)$/);

  if (type === 'leadership' && leadershipMatch) {
    const [, category, text] = leadershipMatch;
    const categoryColors: Record<string, string> = {
      'DIVERSION': 'bg-purple-100 text-purple-700',
      'SUPPORT': 'bg-blue-100 text-blue-700',
      'PROTECT': 'bg-orange-100 text-orange-700',
      'FLEXIBILITY': 'bg-green-100 text-green-700',
      'TIME OFF': 'bg-teal-100 text-teal-700',
      'OPPORTUNITY': 'bg-emerald-100 text-emerald-700',
      'GROWTH': 'bg-indigo-100 text-indigo-700',
      'MENTORSHIP': 'bg-cyan-100 text-cyan-700',
      'INNOVATION': 'bg-violet-100 text-violet-700',
      'RECOGNITION': 'bg-amber-100 text-amber-700',
      'MONITOR': 'bg-gray-100 text-gray-700',
      'BALANCE': 'bg-sky-100 text-sky-700',
      'CHECK-IN': 'bg-blue-100 text-blue-700',
      'PREVENT': 'bg-rose-100 text-rose-700',
    };

    return (
      <li className="flex items-start gap-2 text-sm text-gray-600">
        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium shrink-0', categoryColors[category] || 'bg-gray-100 text-gray-700')}>
          {category}
        </span>
        <span>{text}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 text-sm text-gray-600">
      <span className="text-blue-500 mt-0.5">•</span>
      {recommendation}
    </li>
  );
}

export function ExplainabilityPanel({ employeeId, viewerRole }: ExplainabilityPanelProps) {
  const { user } = useAuth();
  const role = viewerRole || user?.role || 'employee';

  const { data: explanation, isLoading, error } = useQuery({
    queryKey: ['explanation', employeeId],
    queryFn: () => employeesApi.getExplanation(employeeId),
  });

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !explanation) {
    return (
      <div className="card">
        <p className="text-gray-500">Unable to load explanation</p>
      </div>
    );
  }

  // Determine which recommendations to show based on role
  const personalRecs = explanation.recommendations?.personal || [];
  const leadershipRecs = explanation.recommendations?.leadership || [];
  const isManager = role === 'manager';
  const isViewingOwnData = user?.employee?.id === employeeId;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {isViewingOwnData ? 'Why am I in this zone?' : 'Zone Analysis'}
        </h3>
        <ZoneBadge zone={explanation.zone} />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <p className="text-sm text-gray-500 mb-1">Burnout Risk</p>
          <p className="text-2xl font-bold text-red-600">
            {explanation.burnoutScore}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">Readiness</p>
          <p className="text-2xl font-bold text-green-600">
            {explanation.readinessScore}
          </p>
        </div>
      </div>

      {/* Interaction Effects - Show compound stress factors */}
      {explanation.context?.interactionEffects && explanation.context.interactionEffects.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
            <span className="text-base">⚡</span>
            Compound Stress Factors
          </h4>
          <p className="text-xs text-orange-600 dark:text-orange-300 mb-3">
            When multiple factors are elevated, they amplify each other's impact
          </p>
          <div className="space-y-2">
            {explanation.context.interactionEffects.map((effect: { name: string; severity: string; description: string }, index: number) => (
              <div
                key={index}
                className={clsx(
                  'flex items-center gap-2 text-sm p-2 rounded',
                  effect.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                )}
              >
                <span className={clsx(
                  'text-xs font-medium px-1.5 py-0.5 rounded',
                  effect.severity === 'critical' ? 'bg-red-200 dark:bg-red-800' : 'bg-orange-200 dark:bg-orange-800'
                )}>
                  {effect.severity === 'critical' ? 'CRITICAL' : 'ELEVATED'}
                </span>
                <span>{effect.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vacation/Rest Alert */}
      {explanation.context?.vacationAlert && (
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-purple-600 dark:text-purple-400 text-lg">🏝️</span>
            <div>
              <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200">Rest Needed</h4>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                {explanation.context.vacationAlert.message}
              </p>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                {explanation.context.vacationAlert.daysSinceRest} days since last good recovery day
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calibration Info */}
      {explanation.context?.calibrationInfo?.applied && (
        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-600 dark:text-blue-400">🎯</span>
            <span className="text-blue-700 dark:text-blue-300">
              {explanation.context.calibrationInfo.message}
              <span className="ml-1 text-xs text-blue-500">
                ({explanation.context.calibrationInfo.discrepancy > 0 ? '+' : ''}{explanation.context.calibrationInfo.discrepancy} pts)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Active Life Events */}
      {explanation.context?.activeLifeEvents && explanation.context.activeLifeEvents.length > 0 && (
        <div className="mb-6 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
            <span className="text-base">📅</span>
            Active Life Events
          </h4>
          <div className="space-y-1">
            {explanation.context.activeLifeEvents.map((event: { label: string; impact: string }, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-indigo-700 dark:text-indigo-300">{event.label}</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">{event.impact}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Context */}
      {explanation.context?.dayContext && (
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span>📆</span>
          <span>{explanation.context.dayContext.label}: {explanation.context.dayContext.message}</span>
        </div>
      )}

      {/* Factors */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Contributing Factors
        </h4>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {explanation.factors.map((factor, index) => (
            <FactorItem key={index} factor={factor} />
          ))}
        </div>
      </div>

      {/* Personal Recommendations (for employees viewing their own data, or for all users) */}
      {personalRecs.length > 0 && (isViewingOwnData || !isManager) && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Personal Recommendations
          </h4>
          <ul className="space-y-2">
            {personalRecs.map((rec, index) => (
              <RecommendationItem key={index} recommendation={rec} type="personal" />
            ))}
          </ul>
        </div>
      )}

      {/* Leadership Recommendations (only for managers viewing team members) */}
      {leadershipRecs.length > 0 && isManager && !isViewingOwnData && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Leadership Actions
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Suggested actions to support this team member
          </p>
          <ul className="space-y-3">
            {leadershipRecs.map((rec, index) => (
              <RecommendationItem key={index} recommendation={rec} type="leadership" />
            ))}
          </ul>
        </div>
      )}

      {/* Show both for managers viewing their own data */}
      {isManager && isViewingOwnData && (
        <>
          {personalRecs.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Personal Recommendations
              </h4>
              <ul className="space-y-2">
                {personalRecs.map((rec, index) => (
                  <RecommendationItem key={index} recommendation={rec} type="personal" />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
