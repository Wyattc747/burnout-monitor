'use client';

import { useQuery } from '@tanstack/react-query';

interface HeatmapEntry {
  date: string;
  avgBurnoutScore: number;
  avgReadinessScore: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  totalEmployees: number;
}

interface TeamAggregates {
  teamSize: number;
  zoneDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
  avgBurnoutScore: number;
  avgReadinessScore: number;
  trends: {
    burnoutTrend: 'improving' | 'stable' | 'declining';
    readinessTrend: 'improving' | 'stable' | 'declining';
  };
}

async function fetchTeamHeatmap(): Promise<HeatmapEntry[]> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/teams/heatmap', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch heatmap');
  return res.json();
}

async function fetchTeamAggregates(): Promise<TeamAggregates> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/teams/aggregates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch aggregates');
  return res.json();
}

function getColorForScore(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTrendIcon(trend: string) {
  if (trend === 'improving') {
    return (
      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  if (trend === 'declining') {
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  );
}

export function TeamAggregatesCard() {
  const { data: aggregates, isLoading } = useQuery({
    queryKey: ['team-aggregates'],
    queryFn: fetchTeamAggregates,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!aggregates) return null;

  const total = aggregates.zoneDistribution.green + aggregates.zoneDistribution.yellow + aggregates.zoneDistribution.red;
  const greenPct = total > 0 ? (aggregates.zoneDistribution.green / total) * 100 : 0;
  const yellowPct = total > 0 ? (aggregates.zoneDistribution.yellow / total) * 100 : 0;
  const redPct = total > 0 ? (aggregates.zoneDistribution.red / total) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Team Wellness Overview</h2>

      {/* Zone Distribution Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>Zone Distribution</span>
          <span>{aggregates.teamSize} team members</span>
        </div>
        <div className="h-4 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
          {greenPct > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${greenPct}%` }}
              title={`Green: ${aggregates.zoneDistribution.green}`}
            />
          )}
          {yellowPct > 0 && (
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${yellowPct}%` }}
              title={`Yellow: ${aggregates.zoneDistribution.yellow}`}
            />
          )}
          {redPct > 0 && (
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${redPct}%` }}
              title={`Red: ${aggregates.zoneDistribution.red}`}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Thriving ({aggregates.zoneDistribution.green})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            At Risk ({aggregates.zoneDistribution.yellow})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Burnout ({aggregates.zoneDistribution.red})
          </span>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Avg Readiness</span>
            {getTrendIcon(aggregates.trends.readinessTrend)}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {aggregates.avgReadinessScore.toFixed(0)}%
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Avg Burnout Risk</span>
            {getTrendIcon(aggregates.trends.burnoutTrend === 'improving' ? 'declining' : aggregates.trends.burnoutTrend === 'declining' ? 'improving' : 'stable')}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {aggregates.avgBurnoutScore.toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamHeatmap() {
  const { data: heatmap, isLoading } = useQuery({
    queryKey: ['team-heatmap'],
    queryFn: fetchTeamHeatmap,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!heatmap || heatmap.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Team Wellness Heatmap</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          Not enough data to display the heatmap yet.
        </p>
      </div>
    );
  }

  // Group by weeks
  const weeks: HeatmapEntry[][] = [];
  let currentWeek: HeatmapEntry[] = [];

  heatmap.slice().reverse().forEach((entry, index) => {
    currentWeek.push(entry);
    if (currentWeek.length === 7 || index === heatmap.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Team Wellness Heatmap</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Average readiness scores over the past {heatmap.length} days
      </p>

      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-2">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-10 h-10 rounded-lg ${getColorForScore(day.avgReadinessScore)} flex items-center justify-center cursor-pointer transition-transform hover:scale-110`}
                title={`${new Date(day.date).toLocaleDateString()}: ${day.avgReadinessScore.toFixed(0)}% readiness`}
              >
                <span className="text-white text-xs font-medium">{day.avgReadinessScore.toFixed(0)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Less Ready</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <div className="w-4 h-4 rounded bg-amber-500"></div>
          <div className="w-4 h-4 rounded bg-emerald-500"></div>
        </div>
        <span>More Ready</span>
      </div>
    </div>
  );
}

export default TeamHeatmap;
