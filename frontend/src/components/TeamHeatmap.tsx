'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface EmployeeHeatmapData {
  id: string;
  name: string;
  history: {
    date: string;
    zone: 'green' | 'yellow' | 'red';
    burnoutScore: number | null;
  }[];
}

interface TeamAggregates {
  zoneDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
  averageScores: {
    burnout: string | null;
    readiness: string | null;
  };
  totalEmployees: number;
  trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
}

async function fetchTeamHeatmap(): Promise<EmployeeHeatmapData[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/heatmap`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch heatmap');
  return res.json();
}

async function fetchTeamAggregates(): Promise<TeamAggregates> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/aggregates`, {
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

  // Map API trend values to display values
  const trendDisplay = aggregates.trend === 'worsening' ? 'declining' :
                       aggregates.trend === 'insufficient_data' ? 'stable' : aggregates.trend;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Team Wellness Overview</h2>

      {/* Zone Distribution Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>Zone Distribution</span>
          <span>{aggregates.totalEmployees} team members</span>
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
            Peak ({aggregates.zoneDistribution.green})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Moderate ({aggregates.zoneDistribution.yellow})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            At Risk ({aggregates.zoneDistribution.red})
          </span>
        </div>
      </div>

      {/* Wellness Score Card */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Avg Wellness Score</span>
          {getTrendIcon(trendDisplay === 'declining' ? 'improving' : trendDisplay)}
        </div>
        {(() => {
          const avgBurnout = parseFloat(aggregates.averageScores.burnout || '50');
          const avgWellness = Math.round(100 - avgBurnout);
          const scoreColor = avgWellness >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                            avgWellness >= 40 ? 'text-amber-600 dark:text-amber-400' :
                            'text-red-600 dark:text-red-400';
          const barColor = avgWellness >= 70 ? 'bg-emerald-500' :
                          avgWellness >= 40 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <>
              <div className={`text-2xl font-bold ${scoreColor}`}>
                {avgWellness}%
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${avgWellness}%` }}
                />
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function getZoneColor(zone: string): string {
  if (zone === 'green') return 'bg-emerald-500';
  if (zone === 'yellow') return 'bg-amber-500';
  return 'bg-red-500';
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
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex gap-1 flex-1">
                {Array.from({ length: 14 }).map((_, j) => (
                  <div key={j} className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
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

  // Get all unique dates across all employees
  const allDates = new Set<string>();
  heatmap.forEach(emp => {
    emp.history.forEach(h => allDates.add(h.date));
  });
  const sortedDates = Array.from(allDates).sort().slice(-14); // Last 14 days

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Team Wellness Heatmap</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Team member wellness zones over the past {sortedDates.length} days
      </p>

      <div className="overflow-x-auto">
        <div className="space-y-2 min-w-max">
          {/* Date headers */}
          <div className="flex gap-1 items-center">
            <div className="w-28 text-xs text-gray-400"></div>
            {sortedDates.map(date => (
              <div key={date} className="w-6 text-center text-xs text-gray-400" title={date}>
                {new Date(date).getDate()}
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {heatmap.map(employee => {
            const historyByDate = new Map(employee.history.map(h => [h.date, h]));

            return (
              <div key={employee.id} className="flex gap-1 items-center">
                <div className="w-28 text-sm text-gray-700 dark:text-gray-300 truncate" title={employee.name}>
                  {employee.name}
                </div>
                {sortedDates.map(date => {
                  const dayData = historyByDate.get(date);
                  if (!dayData) {
                    return (
                      <div
                        key={date}
                        className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700"
                        title={`${date}: No data`}
                      />
                    );
                  }
                  const wellnessScore = dayData.burnoutScore ? Math.round(100 - dayData.burnoutScore) : null;
                  return (
                    <div
                      key={date}
                      className={`w-6 h-6 rounded ${getZoneColor(dayData.zone)} cursor-pointer transition-transform hover:scale-110`}
                      title={`${new Date(date).toLocaleDateString()}: ${dayData.zone === 'green' ? 'Peak' : dayData.zone === 'yellow' ? 'Moderate' : 'At Risk'}${wellnessScore ? `, wellness: ${wellnessScore}%` : ''}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500"></span>
          Peak (70%+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500"></span>
          Moderate (40-69%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          At Risk (&lt;40%)
        </span>
      </div>
    </div>
  );
}

export default TeamHeatmap;
