'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { challengesApi, type Challenge, type ChallengeType, type ChallengeStatus, type ChallengeParticipant } from '@/lib/api';
import { clsx } from 'clsx';
import {
  Trophy,
  Users,
  Calendar,
  Target,
  Plus,
  ChevronRight,
  X,
  Medal,
  Flame,
  Moon,
  Footprints,
  CheckCircle2,
  Heart,
  Clock,
  TrendingUp,
} from 'lucide-react';

// Challenge type configurations
const CHALLENGE_TYPE_CONFIG: Record<ChallengeType, {
  icon: JSX.Element;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  defaultUnit: string;
  description: string;
}> = {
  steps: {
    icon: <Footprints className="w-5 h-5" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Steps Challenge',
    defaultUnit: 'steps',
    description: 'Track daily steps and compete with teammates',
  },
  sleep: {
    icon: <Moon className="w-5 h-5" />,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    label: 'Sleep Challenge',
    defaultUnit: 'hours',
    description: 'Improve sleep habits as a team',
  },
  exercise: {
    icon: <Flame className="w-5 h-5" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'Exercise Challenge',
    defaultUnit: 'minutes',
    description: 'Accumulate exercise minutes together',
  },
  checkins: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    label: 'Check-in Streak',
    defaultUnit: 'days',
    description: 'Build consistent wellness check-in habits',
  },
  green_zone: {
    icon: <Heart className="w-5 h-5" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Green Zone Challenge',
    defaultUnit: 'days',
    description: 'Stay in the green wellness zone together',
  },
};

interface TeamChallengesProps {
  isManager?: boolean;
  compact?: boolean;
}

export function TeamChallenges({ isManager = false, compact = false }: TeamChallengesProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [filter, setFilter] = useState<ChallengeStatus | 'all'>('active');

  const { data: challenges, isLoading } = useQuery({
    queryKey: ['challenges', filter === 'all' ? undefined : filter],
    queryFn: () => challengesApi.getAll(filter === 'all' ? undefined : filter),
  });

  const joinChallenge = useMutation({
    mutationFn: challengesApi.join,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });

  const leaveChallenge = useMutation({
    mutationFn: challengesApi.leave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });

  // Separate active and other challenges
  const activeChallenges = challenges?.filter((c) => c.status === 'active') || [];
  const upcomingChallenges = challenges?.filter((c) => c.status === 'upcoming') || [];
  const completedChallenges = challenges?.filter((c) => c.status === 'completed') || [];

  // For compact mode, only show active challenges
  const displayChallenges = compact ? activeChallenges.slice(0, 2) : challenges;

  if (compact) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Team Challenges</h3>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-sm btn-ghost text-blue-600 dark:text-blue-400"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : displayChallenges && displayChallenges.length > 0 ? (
          <div className="space-y-3">
            {displayChallenges.map((challenge) => (
              <CompactChallengeCard
                key={challenge.id}
                challenge={challenge}
                onJoin={() => joinChallenge.mutate(challenge.id)}
                onViewDetails={() => setSelectedChallenge(challenge)}
                isJoining={joinChallenge.isPending}
              />
            ))}
            {activeChallenges.length > 2 && (
              <button
                onClick={() => setFilter('active')}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
              >
                View all {activeChallenges.length} active challenges
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active challenges</p>
            {isManager && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-secondary btn-sm mt-3"
              >
                Create Challenge
              </button>
            )}
          </div>
        )}

        {/* Create Challenge Modal */}
        {showCreateModal && (
          <CreateChallengeModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              queryClient.invalidateQueries({ queryKey: ['challenges'] });
            }}
          />
        )}

        {/* Challenge Details Modal */}
        {selectedChallenge && (
          <ChallengeDetailsModal
            challenge={selectedChallenge}
            onClose={() => setSelectedChallenge(null)}
            onJoin={() => joinChallenge.mutate(selectedChallenge.id)}
            onLeave={() => leaveChallenge.mutate(selectedChallenge.id)}
            isJoining={joinChallenge.isPending}
            isLeaving={leaveChallenge.isPending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Team Challenges
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Compete with your team to build healthy habits together
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['active', 'upcoming', 'completed', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                  filter === status
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {status}
              </button>
            ))}
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Challenge
            </button>
          )}
        </div>
      </div>

      {/* Challenges Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayChallenges && displayChallenges.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onJoin={() => joinChallenge.mutate(challenge.id)}
              onLeave={() => leaveChallenge.mutate(challenge.id)}
              onViewDetails={() => setSelectedChallenge(challenge)}
              isJoining={joinChallenge.isPending}
              isLeaving={leaveChallenge.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No {filter !== 'all' ? filter : ''} Challenges
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filter === 'active'
              ? 'There are no active challenges right now.'
              : filter === 'upcoming'
              ? 'No upcoming challenges scheduled.'
              : filter === 'completed'
              ? 'No completed challenges yet.'
              : 'No challenges found.'}
          </p>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Challenge
            </button>
          )}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <CreateChallengeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
          }}
        />
      )}

      {/* Challenge Details Modal */}
      {selectedChallenge && (
        <ChallengeDetailsModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onJoin={() => joinChallenge.mutate(selectedChallenge.id)}
          onLeave={() => leaveChallenge.mutate(selectedChallenge.id)}
          isJoining={joinChallenge.isPending}
          isLeaving={leaveChallenge.isPending}
        />
      )}
    </div>
  );
}

// Compact card for dashboard view
function CompactChallengeCard({
  challenge,
  onJoin,
  onViewDetails,
  isJoining,
}: {
  challenge: Challenge;
  onJoin: () => void;
  onViewDetails: () => void;
  isJoining: boolean;
}) {
  const config = CHALLENGE_TYPE_CONFIG[challenge.type];
  const progress = challenge.userProgress
    ? Math.min((challenge.userProgress / challenge.targetValue) * 100, 100)
    : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md',
        config.bgColor,
        config.borderColor
      )}
      onClick={onViewDetails}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={clsx('p-2 rounded-lg', config.bgColor, config.color)}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {challenge.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Users className="w-3 h-3" />
              <span>{challenge.participantCount} participants</span>
              <span>|</span>
              <Clock className="w-3 h-3" />
              <span>{daysLeft}d left</span>
            </div>
          </div>
        </div>
        {challenge.isParticipating ? (
          <div className="flex items-center gap-2">
            {challenge.userRank && challenge.userRank <= 3 && (
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                challenge.userRank === 1 ? 'bg-amber-500 text-white' :
                challenge.userRank === 2 ? 'bg-gray-400 text-white' :
                'bg-amber-700 text-white'
              )}>
                {challenge.userRank}
              </div>
            )}
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin();
            }}
            disabled={isJoining}
            className="btn btn-sm btn-primary"
          >
            Join
          </button>
        )}
      </div>

      {/* Progress bar for participants */}
      {challenge.isParticipating && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">Your progress</span>
            <span className={config.color}>
              {challenge.userProgress || 0}/{challenge.targetValue} {challenge.unit}
            </span>
          </div>
          <div className="h-2 bg-white/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Full challenge card
function ChallengeCard({
  challenge,
  onJoin,
  onLeave,
  onViewDetails,
  isJoining,
  isLeaving,
}: {
  challenge: Challenge;
  onJoin: () => void;
  onLeave: () => void;
  onViewDetails: () => void;
  isJoining: boolean;
  isLeaving: boolean;
}) {
  const config = CHALLENGE_TYPE_CONFIG[challenge.type];
  const progress = challenge.userProgress
    ? Math.min((challenge.userProgress / challenge.targetValue) * 100, 100)
    : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const isCompleted = challenge.status === 'completed';
  const isUpcoming = challenge.status === 'upcoming';

  return (
    <div
      className={clsx(
        'card border transition-all hover:shadow-lg cursor-pointer overflow-hidden',
        config.borderColor,
        isCompleted && 'opacity-75'
      )}
      onClick={onViewDetails}
    >
      {/* Header stripe */}
      <div className={clsx('h-1.5', config.bgColor.replace('bg-', 'bg-gradient-to-r from-').replace('/30', '/50'), 'to-transparent')} />

      <div className="p-4">
        {/* Type badge and status */}
        <div className="flex items-center justify-between mb-3">
          <div className={clsx('flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium', config.bgColor, config.color)}>
            {config.icon}
            <span>{config.label}</span>
          </div>
          {isCompleted && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
              Completed
            </span>
          )}
          {isUpcoming && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
              Upcoming
            </span>
          )}
        </div>

        {/* Challenge name and description */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
          {challenge.name}
        </h3>
        {challenge.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {challenge.description}
          </p>
        )}

        {/* Target */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <Target className="w-4 h-4" />
          <span>Goal: {challenge.targetValue.toLocaleString()} {challenge.unit}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{challenge.participantCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{daysLeft} days left</span>
          </div>
          {challenge.isParticipating && challenge.userRank && (
            <div className="flex items-center gap-1">
              <Medal className="w-4 h-4 text-amber-500" />
              <span>#{challenge.userRank}</span>
            </div>
          )}
        </div>

        {/* Progress bar for participants */}
        {challenge.isParticipating && !isUpcoming && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Your progress</span>
              <span className={clsx('font-medium', progress >= 100 ? 'text-emerald-600' : config.color)}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!challenge.isParticipating && !isCompleted ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin();
              }}
              disabled={isJoining}
              className="flex-1 btn btn-primary"
            >
              {isJoining ? 'Joining...' : 'Join Challenge'}
            </button>
          ) : challenge.isParticipating && !isCompleted ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
                className="flex-1 btn btn-secondary"
              >
                View Leaderboard
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLeave();
                }}
                disabled={isLeaving}
                className="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Leave
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              className="flex-1 btn btn-secondary"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Challenge Details Modal with Leaderboard
function ChallengeDetailsModal({
  challenge,
  onClose,
  onJoin,
  onLeave,
  isJoining,
  isLeaving,
}: {
  challenge: Challenge;
  onClose: () => void;
  onJoin: () => void;
  onLeave: () => void;
  isJoining: boolean;
  isLeaving: boolean;
}) {
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['challenge', challenge.id, 'leaderboard'],
    queryFn: () => challengesApi.getById(challenge.id),
  });

  const config = CHALLENGE_TYPE_CONFIG[challenge.type];
  const progress = challenge.userProgress
    ? Math.min((challenge.userProgress / challenge.targetValue) * 100, 100)
    : 0;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const totalDays = Math.ceil(
    (new Date(challenge.endDate).getTime() - new Date(challenge.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysPassed = totalDays - daysLeft;
  const timeProgress = Math.min((daysPassed / totalDays) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className={clsx('p-6 relative', config.bgColor)}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className={clsx('p-3 rounded-xl bg-white/50 dark:bg-gray-800/50', config.color)}>
              {config.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full bg-white/30', config.color)}>
                  {config.label}
                </span>
                {challenge.status === 'completed' && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    Completed
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {challenge.name}
              </h2>
              {challenge.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {challenge.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white/30 dark:bg-gray-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {challenge.targetValue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{challenge.unit} goal</div>
            </div>
            <div className="bg-white/30 dark:bg-gray-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {challenge.participantCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">participants</div>
            </div>
            <div className="bg-white/30 dark:bg-gray-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {daysLeft}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">days left</div>
            </div>
          </div>

          {/* Time progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{new Date(challenge.startDate).toLocaleDateString()}</span>
              <span>{new Date(challenge.endDate).toLocaleDateString()}</span>
            </div>
            <div className="h-1.5 bg-white/30 dark:bg-gray-700/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 dark:bg-gray-300/50 rounded-full transition-all"
                style={{ width: `${timeProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* User's progress (if participating) */}
          {challenge.isParticipating && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Your Progress</span>
                </div>
                {challenge.userRank && (
                  <div className="flex items-center gap-1.5">
                    <Medal className={clsx(
                      'w-5 h-5',
                      challenge.userRank === 1 ? 'text-amber-500' :
                      challenge.userRank === 2 ? 'text-gray-400' :
                      challenge.userRank === 3 ? 'text-amber-700' : 'text-gray-400'
                    )} />
                    <span className="font-bold text-gray-900 dark:text-white">
                      #{challenge.userRank}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {challenge.userProgress?.toLocaleString() || 0}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  / {challenge.targetValue.toLocaleString()} {challenge.unit}
                </span>
              </div>
              <div className="h-3 bg-white dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress >= 100 && (
                <div className="flex items-center gap-2 mt-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Goal achieved!</span>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Leaderboard
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leaderboardData?.participants && leaderboardData.participants.length > 0 ? (
              <div className="space-y-2">
                {leaderboardData.participants.map((participant, index) => (
                  <LeaderboardRow
                    key={participant.id}
                    participant={participant}
                    rank={index + 1}
                    targetValue={challenge.targetValue}
                    unit={challenge.unit}
                    config={config}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No participants yet</p>
                <p className="text-sm">Be the first to join!</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button onClick={onClose} className="btn btn-ghost">
            Close
          </button>
          {!challenge.isParticipating && challenge.status !== 'completed' ? (
            <button
              onClick={onJoin}
              disabled={isJoining}
              className="btn btn-primary"
            >
              {isJoining ? 'Joining...' : 'Join Challenge'}
            </button>
          ) : challenge.isParticipating && challenge.status !== 'completed' ? (
            <button
              onClick={onLeave}
              disabled={isLeaving}
              className="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {isLeaving ? 'Leaving...' : 'Leave Challenge'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Leaderboard row
function LeaderboardRow({
  participant,
  rank,
  targetValue,
  unit,
  config,
}: {
  participant: ChallengeParticipant;
  rank: number;
  targetValue: number;
  unit: string;
  config: typeof CHALLENGE_TYPE_CONFIG[ChallengeType];
}) {
  const progress = Math.min((participant.progress / targetValue) * 100, 100);
  const isTop3 = rank <= 3;

  const rankColors = {
    1: 'bg-amber-500 text-white',
    2: 'bg-gray-400 text-white',
    3: 'bg-amber-700 text-white',
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 p-3 rounded-lg transition-colors',
        isTop3 ? 'bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      )}
    >
      {/* Rank */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
          isTop3 ? rankColors[rank as 1 | 2 | 3] : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        )}
      >
        {rank}
      </div>

      {/* Name and progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {participant.name}
          </span>
          <span className={clsx('text-sm font-medium', config.color)}>
            {participant.progress.toLocaleString()} {unit}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              progress >= 100 ? 'bg-emerald-500' : isTop3 ? 'bg-amber-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Achievement badge for goal completion */}
      {progress >= 100 && (
        <div className="text-emerald-500">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

// Create Challenge Modal
function CreateChallengeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<ChallengeType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState<number>(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const createChallenge = useMutation({
    mutationFn: challengesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      onSuccess();
    },
  });

  const handleSelectType = (type: ChallengeType) => {
    const config = CHALLENGE_TYPE_CONFIG[type];
    setSelectedType(type);
    setName(config.label);
    setTargetValue(getDefaultTarget(type));
    setStep('details');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    const config = CHALLENGE_TYPE_CONFIG[selectedType];
    createChallenge.mutate({
      name,
      description: description || undefined,
      type: selectedType,
      targetValue,
      unit: config.defaultUnit,
      startDate,
      endDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {step === 'type' ? 'Create Team Challenge' : 'Challenge Details'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {step === 'type' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Choose a challenge type to motivate your team
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {step === 'type' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(CHALLENGE_TYPE_CONFIG) as ChallengeType[]).map((type) => {
                const config = CHALLENGE_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    className={clsx(
                      'p-4 rounded-lg border text-left transition-all hover:shadow-md',
                      config.borderColor,
                      'hover:border-blue-500 dark:hover:border-blue-500'
                    )}
                  >
                    <div className={clsx('p-2 rounded-lg w-fit mb-3', config.bgColor, config.color)}>
                      {config.icon}
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {config.label}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {config.description}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Selected type display */}
              {selectedType && (
                <div className={clsx('p-4 rounded-lg flex items-center gap-3', CHALLENGE_TYPE_CONFIG[selectedType].bgColor)}>
                  <div className={clsx('p-2 rounded-lg bg-white/50', CHALLENGE_TYPE_CONFIG[selectedType].color)}>
                    {CHALLENGE_TYPE_CONFIG[selectedType].icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {CHALLENGE_TYPE_CONFIG[selectedType].label}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {CHALLENGE_TYPE_CONFIG[selectedType].description}
                    </p>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="label">Challenge Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                  placeholder="Enter challenge name"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Describe the challenge and any rules..."
                />
              </div>

              {/* Target value */}
              <div>
                <label className="label">
                  Target ({selectedType ? CHALLENGE_TYPE_CONFIG[selectedType].defaultUnit : 'units'})
                </label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min="1"
                  required
                />
                {selectedType && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getTargetHint(selectedType)}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              {/* Duration hint */}
              {startDate && endDate && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Challenge duration:{' '}
                  {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}{' '}
                  days
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep('type');
                    setSelectedType(null);
                  }}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={createChallenge.isPending || !name || targetValue <= 0}
                  className="btn btn-primary"
                >
                  {createChallenge.isPending ? 'Creating...' : 'Create Challenge'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getDefaultTarget(type: ChallengeType): number {
  switch (type) {
    case 'steps':
      return 70000; // 10k steps/day for a week
    case 'sleep':
      return 56; // 8 hours/night for a week
    case 'exercise':
      return 210; // 30 min/day for a week
    case 'checkins':
      return 7; // daily check-ins for a week
    case 'green_zone':
      return 5; // 5 days in green zone
    default:
      return 100;
  }
}

function getTargetHint(type: ChallengeType): string {
  switch (type) {
    case 'steps':
      return 'Suggested: 70,000 steps (10k/day for a week)';
    case 'sleep':
      return 'Suggested: 56 hours (8 hours/night for a week)';
    case 'exercise':
      return 'Suggested: 210 minutes (30 min/day for a week)';
    case 'checkins':
      return 'Suggested: 7 days (daily check-ins for a week)';
    case 'green_zone':
      return 'Suggested: 5 days in green wellness zone';
    default:
      return '';
  }
}

export default TeamChallenges;
