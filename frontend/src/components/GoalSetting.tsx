'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi, wellnessApi } from '@/lib/api';
import type { Goal, GoalType, GoalSuggestion } from '@/types';
import { clsx } from 'clsx';

const GOAL_TYPE_CONFIG: Record<GoalType, {
  icon: JSX.Element;
  color: string;
  bgColor: string;
  defaultTitle: string;
  defaultUnit: string;
  description: string;
}> = {
  sleep_hours: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    defaultTitle: 'Sleep Goal',
    defaultUnit: 'hours',
    description: 'Target sleep hours per night',
  },
  exercise_minutes: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    defaultTitle: 'Exercise Goal',
    defaultUnit: 'minutes',
    description: 'Daily exercise minutes target',
  },
  green_zone: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    defaultTitle: 'Green Zone Streak',
    defaultUnit: 'days',
    description: 'Consecutive days in green zone',
  },
  checkin_streak: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    defaultTitle: 'Check-in Streak',
    defaultUnit: 'days',
    description: 'Consecutive days with check-ins',
  },
};

// Mock suggestions based on typical patterns
const DEFAULT_SUGGESTIONS: GoalSuggestion[] = [
  {
    type: 'sleep_hours',
    title: 'Improve Sleep Duration',
    suggestedTarget: 7.5,
    reason: 'Based on your patterns, 7.5hrs sleep would improve your wellness score',
    unit: 'hours',
  },
  {
    type: 'exercise_minutes',
    title: 'Increase Activity',
    suggestedTarget: 30,
    reason: 'Adding 30 minutes of daily exercise can boost your energy levels',
    unit: 'minutes',
  },
  {
    type: 'green_zone',
    title: 'Stay in Green Zone',
    suggestedTarget: 7,
    reason: 'Maintaining 7 consecutive green zone days builds positive momentum',
    unit: 'days',
  },
  {
    type: 'checkin_streak',
    title: 'Build Check-in Habit',
    suggestedTarget: 14,
    reason: 'Regular check-ins help us personalize your insights',
    unit: 'days',
  },
];

export function GoalSetting() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType | null>(null);

  const { data: goals, isLoading: loadingGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: goalsApi.getAll,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['goals', 'suggestions'],
    queryFn: async () => {
      try {
        return await goalsApi.getSuggestions();
      } catch {
        // Fall back to default suggestions if endpoint doesn't exist yet
        return DEFAULT_SUGGESTIONS;
      }
    },
  });

  const { data: streaks } = useQuery({
    queryKey: ['wellness-streaks'],
    queryFn: wellnessApi.getStreaks,
  });

  const deleteGoal = useMutation({
    mutationFn: goalsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof goalsApi.update>[1] }) =>
      goalsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const activeGoals = goals?.filter((g) => g.isActive) || [];
  const completedGoals = goals?.filter((g) => !g.isActive) || [];

  // Calculate current values from streaks data
  const getCurrentValue = (goal: Goal): number => {
    if (!streaks) return goal.currentValue;

    switch (goal.type) {
      case 'sleep_hours':
        return goal.currentValue; // Would come from health data
      case 'exercise_minutes':
        return goal.currentValue; // Would come from health data
      case 'green_zone':
        return (streaks as any).greenZoneStreak?.current || 0;
      case 'checkin_streak':
        return (streaks as any).checkinStreak?.current || 0;
      default:
        return goal.currentValue;
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Goals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Your Goals
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm"
          >
            Add Goal
          </button>
        </div>

        {loadingGoals ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : activeGoals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🎯</div>
            <p className="mb-2">No active goals yet</p>
            <p className="text-sm">
              Set goals to track your wellness progress and stay motivated.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-secondary text-sm mt-4"
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currentValue={getCurrentValue(goal)}
                onDelete={(id) => deleteGoal.mutate(id)}
                onComplete={(id) => updateGoal.mutate({ id, updates: { isActive: false } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      {suggestions && suggestions.length > 0 && activeGoals.length < 4 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Suggested Goals
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Based on your patterns, we recommend these goals:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {suggestions
              .filter((s) => !activeGoals.some((g) => g.type === s.type))
              .slice(0, 4)
              .map((suggestion) => (
                <SuggestionCard
                  key={suggestion.type}
                  suggestion={suggestion}
                  onAccept={() => {
                    setSelectedGoalType(suggestion.type);
                    setShowAddModal(true);
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Completed Goals
          </h3>
          <div className="space-y-3">
            {completedGoals.slice(0, 5).map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-emerald-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{goal.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {goal.targetValue} {goal.unit}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteGoal.mutate(goal.id)}
                  className="btn btn-ghost text-sm text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <AddGoalModal
          initialGoalType={selectedGoalType}
          suggestions={suggestions || DEFAULT_SUGGESTIONS}
          onClose={() => {
            setShowAddModal(false);
            setSelectedGoalType(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setSelectedGoalType(null);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  currentValue,
  onDelete,
  onComplete,
}: {
  goal: Goal;
  currentValue: number;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const config = GOAL_TYPE_CONFIG[goal.type];
  const progress = Math.min((currentValue / goal.targetValue) * 100, 100);
  const isComplete = currentValue >= goal.targetValue;

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border transition-all',
        isComplete
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={clsx('p-2 rounded-lg', config.bgColor, config.color)}>
            {config.icon}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {goal.title}
            </h4>
            {goal.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {goal.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isComplete && (
            <button
              onClick={() => onComplete(goal.id)}
              className="btn btn-ghost text-sm text-emerald-600 dark:text-emerald-400"
            >
              Mark Done
            </button>
          )}
          <button
            onClick={() => onDelete(goal.id)}
            className="btn btn-ghost text-sm text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {currentValue} / {goal.targetValue} {goal.unit}
          </span>
          <span className={clsx(
            'font-medium',
            isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
          )}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              isComplete ? 'bg-emerald-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isComplete && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Goal reached! Great work!
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
}: {
  suggestion: GoalSuggestion;
  onAccept: () => void;
}) {
  const config = GOAL_TYPE_CONFIG[suggestion.type];

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-gray-800 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className={clsx('p-2 rounded-lg', config.bgColor, config.color)}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {suggestion.title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Target: {suggestion.suggestedTarget} {suggestion.unit}
          </p>
        </div>
      </div>
      <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
        {suggestion.reason}
      </p>
      <button
        onClick={onAccept}
        className="w-full btn btn-secondary text-sm"
      >
        Add This Goal
      </button>
    </div>
  );
}

function AddGoalModal({
  initialGoalType,
  suggestions,
  onClose,
  onSuccess,
}: {
  initialGoalType: GoalType | null;
  suggestions: GoalSuggestion[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'select' | 'configure'>(initialGoalType ? 'configure' : 'select');
  const [goalType, setGoalType] = useState<GoalType | null>(initialGoalType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState<number>(0);

  // Set defaults based on suggestion when goal type changes
  const currentSuggestion = suggestions.find((s) => s.type === goalType);
  const config = goalType ? GOAL_TYPE_CONFIG[goalType] : null;

  const handleSelectType = (type: GoalType) => {
    setGoalType(type);
    const suggestion = suggestions.find((s) => s.type === type);
    const typeConfig = GOAL_TYPE_CONFIG[type];
    setTitle(suggestion?.title || typeConfig.defaultTitle);
    setTargetValue(suggestion?.suggestedTarget || getDefaultTarget(type));
    setDescription('');
    setStep('configure');
  };

  const createGoal = useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalType || !config) return;

    createGoal.mutate({
      type: goalType,
      title: title || config.defaultTitle,
      description: description || undefined,
      targetValue,
      unit: config.defaultUnit,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto animate-scale-in">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {step === 'select' ? 'Choose Goal Type' : 'Configure Goal'}
            </h3>
            <button
              onClick={onClose}
              className="btn btn-icon"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 'select' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(GOAL_TYPE_CONFIG) as GoalType[]).map((type) => {
                const typeConfig = GOAL_TYPE_CONFIG[type];
                const suggestion = suggestions.find((s) => s.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 text-left transition-all hover:shadow-md"
                  >
                    <div className={clsx('p-2 rounded-lg w-fit mb-3', typeConfig.bgColor, typeConfig.color)}>
                      {typeConfig.icon}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white block">
                      {typeConfig.defaultTitle}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {typeConfig.description}
                    </span>
                    {suggestion && (
                      <span className="block mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Suggested: {suggestion.suggestedTarget} {suggestion.unit}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {config && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-3">
                  <div className={clsx('p-2 rounded-lg', config.bgColor, config.color)}>
                    {config.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {config.defaultTitle}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {config.description}
                    </p>
                  </div>
                </div>
              )}

              {currentSuggestion && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {currentSuggestion.reason}
                  </p>
                </div>
              )}

              <div>
                <label className="label">Goal Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input w-full"
                  placeholder={config?.defaultTitle}
                />
              </div>

              <div>
                <label className="label">Target Value ({config?.defaultUnit})</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min="0"
                  step={goalType === 'sleep_hours' ? '0.5' : '1'}
                  required
                />
                {goalType === 'sleep_hours' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Recommended: 7-9 hours for adults
                  </p>
                )}
                {goalType === 'exercise_minutes' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Recommended: 30+ minutes per day
                  </p>
                )}
              </div>

              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Why this goal matters to you..."
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (initialGoalType) {
                      onClose();
                    } else {
                      setStep('select');
                      setGoalType(null);
                    }
                  }}
                  className="btn btn-secondary"
                >
                  {initialGoalType ? 'Cancel' : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={createGoal.isPending || targetValue <= 0}
                  className="btn btn-primary"
                >
                  {createGoal.isPending ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultTarget(type: GoalType): number {
  switch (type) {
    case 'sleep_hours':
      return 7.5;
    case 'exercise_minutes':
      return 30;
    case 'green_zone':
      return 7;
    case 'checkin_streak':
      return 7;
    default:
      return 0;
  }
}

export default GoalSetting;
