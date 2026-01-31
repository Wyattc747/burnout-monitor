'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, personalizationApi, alertsApi } from '@/lib/api';
import { ZoneBadge } from '@/components/ZoneIndicator';
import { QuickCheckin } from '@/components/FeelingCheckin';
import { PersonalizationPrompt } from '@/components/PersonalizationPrompt';
import { SupportBot, SupportBotButton } from '@/components/SupportBot';
import { SmartRecommendations } from '@/components/SmartRecommendations';
import { clsx } from 'clsx';
import {
  TrendingUp,
  BarChart3,
  Heart,
  Lightbulb,
  ChevronRight,
  Calendar,
  AlertCircle,
  Zap
} from 'lucide-react';

interface EmployeeDashboardProps {
  employeeId: string;
}

export function EmployeeDashboard({ employeeId }: EmployeeDashboardProps) {
  const [isBotOpen, setIsBotOpen] = useState(false);

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeesApi.getById(employeeId),
  });

  const { data: burnoutData } = useQuery({
    queryKey: ['burnout', employeeId],
    queryFn: () => employeesApi.getBurnout(employeeId),
  });

  const { data: personalization } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', 'employee', employeeId],
    queryFn: () => alertsApi.getAll({ limit: 5 }),
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

  // Calculate trend from yesterday
  const yesterdayScore = (burnoutData?.history?.[1] as any)?.burnout_score ?? (burnoutData?.history?.[1] as any)?.burnoutScore;
  const burnoutTrend = yesterdayScore
    ? (employee.burnoutScore || 0) - yesterdayScore
    : 0;

  // Get top insight
  const topInsight = getTopInsight(employee, burnoutData);

  // Unread alerts count
  const unreadAlerts = alerts?.filter(a => !a.isAcknowledged).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {employee.firstName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {getGreeting()} Here's your wellness snapshot.
          </p>
        </div>
        <ZoneBadge zone={employee.zone} size="lg" />
      </div>

      {/* Personalization Setup Prompt */}
      <PersonalizationPrompt />

      {/* Quick Check-in - Prominent */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
              How are you feeling today?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quick check-in helps improve your predictions
            </p>
          </div>
          <QuickCheckin />
        </div>
        {personalization?.activeLifeEvents && personalization.activeLifeEvents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Active event:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {personalization.activeLifeEvents[0].eventLabel}
            </span>
          </div>
        )}
      </div>

      {/* Score Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <ScoreCard
          label="Burnout Risk"
          score={employee.burnoutScore ?? 0}
          trend={burnoutTrend}
          color="red"
          invertTrend
        />
        <ScoreCard
          label="Readiness"
          score={employee.readinessScore ?? 0}
          trend={(() => {
            const yesterday = burnoutData?.history?.[1] as any;
            const yesterdayReadiness = yesterday?.readiness_score ?? yesterday?.readinessScore;
            return yesterdayReadiness ? (employee.readinessScore || 0) - yesterdayReadiness : 0;
          })()}
          color="green"
        />
        <ZoneCard zone={employee.zone} />
      </div>

      {/* Today's Key Insight */}
      {topInsight && (
        <div className="card border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Today's Insight
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mt-1">
                {topInsight}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Summary */}
      {unreadAlerts > 0 && (
        <Link href="/dashboard/insights" className="block card border-l-4 border-red-400 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {unreadAlerts} Unread Alert{unreadAlerts > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Review your alerts and recommendations
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>
      )}

      {/* Smart Recommendations */}
      <SmartRecommendations employeeId={employeeId} compact />

      {/* Navigation Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <NavigationCard
          href="/dashboard/insights"
          icon={<TrendingUp className="w-6 h-6" />}
          title="Insights"
          description="Predictions, patterns & factor breakdown"
          color="indigo"
        />
        <NavigationCard
          href="/dashboard/metrics"
          icon={<BarChart3 className="w-6 h-6" />}
          title="Metrics"
          description="Sleep, heart, activity & work data"
          color="emerald"
        />
        <NavigationCard
          href="/wellness"
          icon={<Heart className="w-6 h-6" />}
          title="Wellness"
          description="Streaks, achievements & resources"
          color="rose"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/settings/personalization"
          className="btn btn-ghost text-sm"
        >
          <Zap className="w-4 h-4 mr-1" />
          Personalize
        </Link>
        <Link
          href="/profile"
          className="btn btn-ghost text-sm"
        >
          View Profile
        </Link>
      </div>

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

function ScoreCard({
  label,
  score,
  trend,
  color,
  invertTrend = false,
}: {
  label: string;
  score: number;
  trend: number;
  color: 'red' | 'green';
  invertTrend?: boolean;
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-emerald-600 dark:text-emerald-400',
  };

  const isPositive = invertTrend ? trend < 0 : trend > 0;
  const isNegative = invertTrend ? trend > 0 : trend < 0;

  return (
    <div className="card">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={clsx('text-3xl font-bold', colorClasses[color])}>
          {score}
        </span>
        <span className="text-gray-400 dark:text-gray-500">/100</span>
      </div>
      {trend !== 0 && (
        <p className={clsx(
          'text-xs mt-1',
          isPositive && 'text-emerald-600 dark:text-emerald-400',
          isNegative && 'text-red-600 dark:text-red-400',
          !isPositive && !isNegative && 'text-gray-500'
        )}>
          {trend > 0 ? '+' : ''}{trend.toFixed(0)} from yesterday
        </p>
      )}
    </div>
  );
}

function ZoneCard({ zone }: { zone: 'red' | 'yellow' | 'green' }) {
  const config = {
    red: {
      label: 'Burnout Risk',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: '🔴',
    },
    yellow: {
      label: 'Moderate',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      icon: '🟡',
    },
    green: {
      label: 'Peak Ready',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: '🟢',
    },
  };

  const c = config[zone];

  return (
    <div className={clsx('card border', c.bg, c.border)}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Zone</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{c.icon}</span>
        <span className={clsx('text-xl font-bold', c.text)}>{c.label}</span>
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
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'indigo' | 'emerald' | 'rose';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  };

  return (
    <Link
      href={href}
      className="card hover:shadow-lg transition-all duration-200 group border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
    >
      <div className={clsx('p-3 rounded-lg w-fit mb-3', colorClasses[color])}>
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
      <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Explore <ChevronRight className="w-4 h-4" />
      </div>
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}

function getTopInsight(employee: any, burnoutData: any): string | null {
  // Generate a relevant insight based on current data
  if (!employee) return null;

  const zone = employee.zone;
  const burnoutScore = employee.burnoutScore || 0;
  const readinessScore = employee.readinessScore || 0;

  // Check for recent trend
  const history = burnoutData?.history || [];
  if (history.length >= 3) {
    const recent = history.slice(0, 3);
    const avgRecent = recent.reduce((sum: number, d: any) => sum + (d.burnout_score || 0), 0) / 3;
    const older = history.slice(3, 7);
    if (older.length > 0) {
      const avgOlder = older.reduce((sum: number, d: any) => sum + (d.burnout_score || 0), 0) / older.length;
      if (avgRecent > avgOlder + 5) {
        return "Your burnout risk has been trending upward. Consider taking some time to rest and recharge.";
      }
      if (avgRecent < avgOlder - 5) {
        return "Great progress! Your burnout risk has been decreasing over the past few days.";
      }
    }
  }

  // Zone-based insights
  if (zone === 'red') {
    return "You're showing signs of elevated stress. Check your Insights page for personalized recommendations.";
  }
  if (zone === 'yellow' && burnoutScore > 50) {
    return "You're in the moderate zone but trending toward burnout. Small breaks throughout the day can help.";
  }
  if (zone === 'green' && readinessScore > 75) {
    return "You're in peak condition! This is a great time for challenging tasks and important projects.";
  }
  if (readinessScore < 50) {
    return "Your readiness is lower than usual. Prioritize sleep and recovery today.";
  }

  return "Your wellness metrics look stable. Keep maintaining your healthy routines!";
}
