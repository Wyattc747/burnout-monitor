'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/wellness/streaks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch streaks');
  return res.json();
}

const BADGE_ICONS: Record<string, { icon: string; emoji: string; color: string; description: string }> = {
  // Streak badges
  week_warrior: { icon: '7', emoji: '🔥', color: 'bg-blue-500', description: '7-day check-in streak' },
  month_master: { icon: '30', emoji: '🌟', color: 'bg-purple-500', description: '30-day check-in streak' },
  century_champion: { icon: '💯', emoji: '👑', color: 'bg-amber-500', description: '100-day check-in streak' },
  // Sleep badges
  sleep_consistent: { icon: '😴', emoji: '😴', color: 'bg-indigo-500', description: '7 days of consistent sleep' },
  sleep_master: { icon: '🛏️', emoji: '🛏️', color: 'bg-indigo-600', description: '30 days of quality sleep' },
  // Exercise badges
  active_week: { icon: '🏃', emoji: '🏃', color: 'bg-green-500', description: '7 days of exercise' },
  fitness_warrior: { icon: '💪', emoji: '💪', color: 'bg-green-600', description: '30 days of exercise' },
  // Green zone badges
  zen_beginner: { icon: '🧘', emoji: '🧘', color: 'bg-emerald-500', description: '7 days in green zone' },
  zen_master: { icon: '☯️', emoji: '☯️', color: 'bg-emerald-600', description: '30 days in green zone' },
  // Points badges
  point_collector: { icon: '💎', emoji: '💎', color: 'bg-cyan-500', description: 'Earned 500 points' },
  point_hoarder: { icon: '🏆', emoji: '🏆', color: 'bg-cyan-600', description: 'Earned 2000 points' },
  // Special
  early_bird: { icon: '🐦', emoji: '🐦', color: 'bg-orange-500', description: 'Checked in before 8am' },
  comeback_king: { icon: '🦁', emoji: '🦁', color: 'bg-red-500', description: 'Recovered from red zone' },
};

// Milestones for level progression
const MILESTONES = [
  { points: 0, level: 1, title: 'Wellness Novice', color: 'from-gray-400 to-gray-500' },
  { points: 100, level: 2, title: 'Health Seeker', color: 'from-green-400 to-green-500' },
  { points: 300, level: 3, title: 'Balance Keeper', color: 'from-blue-400 to-blue-500' },
  { points: 600, level: 4, title: 'Energy Guardian', color: 'from-purple-400 to-purple-500' },
  { points: 1000, level: 5, title: 'Wellness Champion', color: 'from-amber-400 to-amber-500' },
  { points: 2000, level: 6, title: 'Peak Performer', color: 'from-rose-400 to-rose-500' },
  { points: 5000, level: 7, title: 'Legendary', color: 'from-yellow-400 to-yellow-500' },
];

function getCurrentLevel(points: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (points >= MILESTONES[i].points) {
      return {
        current: MILESTONES[i],
        next: MILESTONES[i + 1] || null,
        progress: MILESTONES[i + 1]
          ? ((points - MILESTONES[i].points) / (MILESTONES[i + 1].points - MILESTONES[i].points)) * 100
          : 100,
      };
    }
  }
  return { current: MILESTONES[0], next: MILESTONES[1], progress: 0 };
}

function MilestonePreview({ icon, title, current, target, category }: {
  icon: string;
  title: string;
  current: number;
  target: number;
  category: string;
}) {
  const progress = (current / target) * 100;
  const remaining = target - current;

  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-xl">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{category}</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {remaining} more day{remaining !== 1 ? 's' : ''} to go
        </p>
      </div>
    </div>
  );
}

function getDailyTip(streaks: StreakData): string {
  const tips = [
    'A 5-minute walk can boost your energy and mood for hours.',
    'Try the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds.',
    'Staying hydrated improves focus and reduces fatigue.',
    'A consistent sleep schedule is more important than total sleep time.',
    'Taking breaks actually increases productivity, not decreases it.',
    'Deep breathing for 2 minutes can reduce stress hormones.',
    'Morning sunlight helps regulate your circadian rhythm.',
    'Regular exercise improves both physical and mental resilience.',
  ];

  // Pick a tip based on current date and streak data
  const tipIndex = (new Date().getDate() + streaks.totalPoints) % tips.length;
  return tips[tipIndex];
}

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

  const levelInfo = getCurrentLevel(streaks.totalPoints);

  return (
    <div className="space-y-6">
      {/* Level & Points Summary */}
      <div className={`bg-gradient-to-r ${levelInfo.current.color} rounded-xl p-6 text-white relative overflow-hidden`}>
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">
                  Level {levelInfo.current.level}
                </span>
                <span className="text-white/80 text-sm">{levelInfo.current.title}</span>
              </div>
              <p className="text-4xl font-bold">{streaks.totalPoints.toLocaleString()}</p>
              <p className="text-white/70 text-sm mt-1">Wellness Points</p>
            </div>
            <div className="text-6xl">
              {levelInfo.current.level >= 5 ? '👑' : levelInfo.current.level >= 3 ? '⭐' : '🌱'}
            </div>
          </div>

          {/* Level Progress Bar */}
          {levelInfo.next && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Progress to {levelInfo.next.title}</span>
                <span>{streaks.totalPoints}/{levelInfo.next.points}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(levelInfo.progress, 100)}%` }}
                />
              </div>
            </div>
          )}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Badges
            {streaks.badges.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({streaks.badges.length} earned)
              </span>
            )}
          </h3>
        </div>

        {streaks.badges.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {streaks.badges.map((badge) => {
              const badgeInfo = BADGE_ICONS[badge.id] || { icon: '?', emoji: '🏅', color: 'bg-gray-500', description: badge.name };
              return (
                <div
                  key={badge.id}
                  className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  title={`${badgeInfo.description}\nEarned ${new Date(badge.earnedAt).toLocaleDateString()}`}
                >
                  <div className={`w-12 h-12 ${badgeInfo.color} rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-2 shadow-lg group-hover:scale-110 transition-transform`}>
                    {badgeInfo.emoji}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block truncate">
                    {badge.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(badge.earnedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm">Complete streaks to earn badges!</p>
          </div>
        )}
      </div>

      {/* Upcoming Milestones */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Milestones</h3>
        <div className="space-y-4">
          {/* Check-in milestone */}
          {streaks.checkinStreak.current < 100 && (
            <MilestonePreview
              icon="🔥"
              title={streaks.checkinStreak.current < 7 ? '7-Day Warrior' : streaks.checkinStreak.current < 30 ? '30-Day Master' : '100-Day Champion'}
              current={streaks.checkinStreak.current}
              target={streaks.checkinStreak.current < 7 ? 7 : streaks.checkinStreak.current < 30 ? 30 : 100}
              category="Check-in Streak"
            />
          )}

          {/* Sleep milestone */}
          {streaks.sleepStreak.current < 30 && (
            <MilestonePreview
              icon="😴"
              title={streaks.sleepStreak.current < 7 ? 'Sleep Consistent' : 'Sleep Master'}
              current={streaks.sleepStreak.current}
              target={streaks.sleepStreak.current < 7 ? 7 : 30}
              category="Sleep Goal"
            />
          )}

          {/* Exercise milestone */}
          {streaks.exerciseStreak.current < 30 && (
            <MilestonePreview
              icon="💪"
              title={streaks.exerciseStreak.current < 7 ? 'Active Week' : 'Fitness Warrior'}
              current={streaks.exerciseStreak.current}
              target={streaks.exerciseStreak.current < 7 ? 7 : 30}
              category="Exercise"
            />
          )}

          {/* Green zone milestone */}
          {streaks.greenZoneStreak.current < 30 && (
            <MilestonePreview
              icon="🧘"
              title={streaks.greenZoneStreak.current < 7 ? 'Zen Beginner' : 'Zen Master'}
              current={streaks.greenZoneStreak.current}
              target={streaks.greenZoneStreak.current < 7 ? 7 : 30}
              category="Green Zone"
            />
          )}
        </div>
      </div>

      {/* Daily Tip */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Daily Tip</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {getDailyTip(streaks)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WellnessStreaks;
