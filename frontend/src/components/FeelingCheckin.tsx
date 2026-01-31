'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';
import { clsx } from 'clsx';

interface FeelingCheckinProps {
  onComplete?: () => void;
  compact?: boolean;
}

const FEELING_LABELS = ['Struggling', 'Low', 'Okay', 'Good', 'Great'];
const FEELING_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
];

export function FeelingCheckin({ onComplete, compact = false }: FeelingCheckinProps) {
  const queryClient = useQueryClient();
  const [overallFeeling, setOverallFeeling] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [motivationLevel, setMotivationLevel] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const createCheckin = useMutation({
    mutationFn: personalizationApi.createCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
      resetForm();
      onComplete?.();
    },
  });

  const resetForm = () => {
    setOverallFeeling(null);
    setShowDetails(false);
    setEnergyLevel(null);
    setStressLevel(null);
    setMotivationLevel(null);
    setNotes('');
  };

  const handleSubmit = () => {
    if (overallFeeling === null) return;

    createCheckin.mutate({
      overallFeeling,
      energyLevel: energyLevel ?? undefined,
      stressLevel: stressLevel ?? undefined,
      motivationLevel: motivationLevel ?? undefined,
      notes: notes || undefined,
    });
  };

  if (compact && overallFeeling === null) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">How are you feeling?</p>
        <div className="flex gap-2 justify-between">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => setOverallFeeling(value)}
              className={clsx(
                'flex-1 py-3 rounded-lg transition-all hover:scale-105',
                FEELING_COLORS[value - 1],
                'text-white font-medium text-sm'
              )}
            >
              {FEELING_LABELS[value - 1]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="section-header mb-4">How are you feeling?</h3>

      {/* Main feeling selector */}
      <div className="mb-6">
        <div className="flex gap-2 justify-between">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => setOverallFeeling(value)}
              className={clsx(
                'flex-1 py-4 rounded-lg transition-all border-2',
                overallFeeling === value
                  ? `${FEELING_COLORS[value - 1]} text-white border-transparent scale-105`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <span className="text-2xl mb-1 block">
                {value === 1 ? '😔' : value === 2 ? '😕' : value === 3 ? '😐' : value === 4 ? '🙂' : '😊'}
              </span>
              <span className="text-sm font-medium">{FEELING_LABELS[value - 1]}</span>
            </button>
          ))}
        </div>
      </div>

      {overallFeeling !== null && (
        <>
          {/* Toggle for more details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            {showDetails ? 'Hide details' : 'Add more details (optional)'}
          </button>

          {showDetails && (
            <div className="space-y-4 mb-6 animate-fade-in">
              {/* Energy Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Energy Level
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setEnergyLevel(value)}
                      className={clsx(
                        'flex-1 py-2 rounded-md text-sm transition-all',
                        energyLevel === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Exhausted</span>
                  <span>Energized</span>
                </div>
              </div>

              {/* Stress Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stress Level
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setStressLevel(value)}
                      className={clsx(
                        'flex-1 py-2 rounded-md text-sm transition-all',
                        stressLevel === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Very stressed</span>
                  <span>Calm</span>
                </div>
              </div>

              {/* Motivation Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivation Level
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setMotivationLevel(value)}
                      className={clsx(
                        'flex-1 py-2 rounded-md text-sm transition-all',
                        motivationLevel === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Unmotivated</span>
                  <span>Very motivated</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Any thoughts on what's affecting how you feel?"
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={createCheckin.isPending}
              className="btn btn-primary flex-1"
            >
              {createCheckin.isPending ? 'Saving...' : 'Save Check-in'}
            </button>
            <button onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Compact inline check-in for dashboard
export function QuickCheckin({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createCheckin = useMutation({
    mutationFn: personalizationApi.createCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      onComplete?.();
    },
  });

  const handleQuickCheckin = async (feeling: number) => {
    setIsSubmitting(true);
    try {
      await createCheckin.mutateAsync({ overallFeeling: feeling });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400">Quick check-in:</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => handleQuickCheckin(value)}
            disabled={isSubmitting}
            className={clsx(
              'w-8 h-8 rounded-full transition-all hover:scale-110 disabled:opacity-50',
              FEELING_COLORS[value - 1],
              'text-white text-sm font-medium'
            )}
            title={FEELING_LABELS[value - 1]}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
