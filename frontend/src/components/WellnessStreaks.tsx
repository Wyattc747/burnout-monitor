'use client';

import { useQuery } from '@tanstack/react-query';

interface Badge {
  id: string;
  name: string;
  earnedAt: string;
}

interface StreakData {
  checkinStreak: {
    current: number;
    longest: number;
    lastDate: string | null;
  };
  sleepStreak: {
    current: number;
    longest: number;
  };
  exerciseStreak: {
    current: number;
    longest: number;
  };
  greenZoneStreak: {
    current: number;
    longest: number;
  };
  totalPoints: number;
  badges: Badge[];
}

async function fetchStreaks(): Promise<StreakData> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/wellness/streaks', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch streaks');
  return res.json();
}

const BADGE_ICONS: Record<string, { icon: string; color: string }> = {
  week_warrior: { icon: '7', color: 'bg-blue-500' },
  month_master: { icon: '30', color: 'bg-purple-500' },
  century_champion: { icon: '100', color: 'bg-amber-500' },
};

function StreakCard({ title, current, longest, icon }: {
  title: string;
  current: number;
  longest: number;
  icon: JSX.Element;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{current}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">days</span>
      </div>
      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Personal best: {longest} days
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min((current / Math.max(longest, 7)) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function WellnessStreaks() {
  const { data: streaks, isLoading } = useQuery({
    queryKey: ['wellness-streaks'],
    queryFn: fetchStreaks,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!streaks) return null;

  return (
    <div className="space-y-6">
      {/* Points Summary */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm">Total Wellness Points</p>
            <p className="text-4xl font-bold mt-1">{streaks.totalPoints.toLocaleString()}</p>
          </div>
          <div className="text-6xl opacity-20">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Streaks Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StreakCard
          title="Check-in Streak"
          current={streaks.checkinStreak.current}
          longest={streaks.checkinStreak.longest}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StreakCard
          title="Sleep Goal"
          current={streaks.sleepStreak.current}
          longest={streaks.sleepStreak.longest}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          }
        />
        <StreakCard
          title="Exercise"
          current={streaks.exerciseStreak.current}
          longest={streaks.exerciseStreak.longest}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StreakCard
          title="Green Zone"
          current={streaks.greenZoneStreak.current}
          longest={streaks.greenZoneStreak.longest}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
      </div>

      {/* Badges */}
      {streaks.badges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Earned Badges</h3>
          <div className="flex flex-wrap gap-3">
            {streaks.badges.map((badge) => {
              const badgeInfo = BADGE_ICONS[badge.id] || { icon: '?', color: 'bg-gray-500' };
              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-full"
                  title={`Earned ${new Date(badge.earnedAt).toLocaleDateString()}`}
                >
                  <div className={`w-8 h-8 ${badgeInfo.color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                    {badgeInfo.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{badge.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next Badge Preview */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Next Badge</p>
            {streaks.checkinStreak.current < 7 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {7 - streaks.checkinStreak.current} more check-ins to unlock "7-Day Warrior"
              </p>
            ) : streaks.checkinStreak.current < 30 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {30 - streaks.checkinStreak.current} more check-ins to unlock "30-Day Master"
              </p>
            ) : streaks.checkinStreak.current < 100 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {100 - streaks.checkinStreak.current} more check-ins to unlock "100-Day Champion"
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You've unlocked all current badges!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WellnessStreaks;
