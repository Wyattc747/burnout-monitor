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

// Compact inline check-in for dashboard - Mobile optimized
export function QuickCheckin({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<number | null>(null);

  const createCheckin = useMutation({
    mutationFn: personalizationApi.createCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      queryClient.invalidateQueries({ queryKey: ['wellness-streaks'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedFeeling(null);
        onComplete?.();
      }, 2000);
    },
  });

  const handleQuickCheckin = async (feeling: number) => {
    setSelectedFeeling(feeling);
    setIsSubmitting(true);
    try {
      await createCheckin.mutateAsync({ overallFeeling: feeling });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FEELING_EMOJIS = ['😔', '😕', '😐', '🙂', '😊'];
  const SUCCESS_MESSAGES = [
    'Thanks for checking in 💜',
    'Got it! Take care 💙',
    'Noted! Have a good day 💚',
    'Awesome, keep it up! 🌟',
    'That\'s great to hear! 🎉',
  ];

  if (showSuccess && selectedFeeling) {
    return (
      <div className="flex items-center gap-3 animate-fade-in">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <span className="text-2xl animate-bounce">{FEELING_EMOJIS[selectedFeeling - 1]}</span>
          <span className="text-sm font-medium">{SUCCESS_MESSAGES[selectedFeeling - 1]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">How are you feeling?</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => handleQuickCheckin(value)}
            disabled={isSubmitting}
            className={clsx(
              // Larger touch targets for mobile
              'w-12 h-12 sm:w-10 sm:h-10 rounded-full transition-all duration-200 disabled:opacity-50',
              'flex items-center justify-center text-xl sm:text-lg',
              // Active state
              selectedFeeling === value
                ? 'ring-4 ring-offset-2 ring-emerald-400 scale-110'
                : 'hover:scale-110 active:scale-95',
              FEELING_COLORS[value - 1],
              'text-white shadow-md'
            )}
            title={FEELING_LABELS[value - 1]}
          >
            {FEELING_EMOJIS[value - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Full-screen mobile check-in modal
export function MobileCheckinModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'feeling' | 'details' | 'success'>('feeling');
  const [overallFeeling, setOverallFeeling] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [stressLevel, setStressLevel] = useState<number>(3);

  const createCheckin = useMutation({
    mutationFn: personalizationApi.createCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      queryClient.invalidateQueries({ queryKey: ['wellness-streaks'] });
      setStep('success');
      setTimeout(() => {
        onClose();
        setStep('feeling');
        setOverallFeeling(null);
      }, 2500);
    },
  });

  const handleSelectFeeling = (feeling: number) => {
    setOverallFeeling(feeling);
    setStep('details');
  };

  const handleSubmit = () => {
    if (overallFeeling) {
      createCheckin.mutate({
        overallFeeling,
        energyLevel,
        stressLevel,
      });
    }
  };

  const handleQuickSubmit = () => {
    if (overallFeeling) {
      createCheckin.mutate({ overallFeeling });
    }
  };

  if (!isOpen) return null;

  const FEELING_EMOJIS = ['😔', '😕', '😐', '🙂', '😊'];
  const FEELING_DESCRIPTIONS = [
    'Not doing well today',
    'Could be better',
    'Just okay',
    'Feeling good',
    'Feeling great!',
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-gray-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">Daily Check-in</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {step === 'feeling' && (
          <div className="text-center animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-2">How are you feeling?</h3>
            <p className="text-gray-300 mb-8">Tap to check in</p>
            <div className="flex flex-wrap justify-center gap-4">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => handleSelectFeeling(value)}
                  className={clsx(
                    'w-20 h-20 rounded-2xl flex flex-col items-center justify-center transition-all',
                    'hover:scale-110 active:scale-95',
                    FEELING_COLORS[value - 1],
                    'text-white shadow-lg'
                  )}
                >
                  <span className="text-3xl">{FEELING_EMOJIS[value - 1]}</span>
                  <span className="text-xs mt-1 font-medium">{FEELING_LABELS[value - 1]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'details' && overallFeeling && (
          <div className="w-full max-w-sm animate-fade-in">
            <div className="text-center mb-8">
              <span className="text-6xl mb-4 block">{FEELING_EMOJIS[overallFeeling - 1]}</span>
              <h3 className="text-xl font-bold text-white">{FEELING_DESCRIPTIONS[overallFeeling - 1]}</h3>
            </div>

            <div className="space-y-6 mb-8">
              {/* Energy slider */}
              <div>
                <label className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>Energy Level</span>
                  <span>{energyLevel}/5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>😴 Exhausted</span>
                  <span>⚡ Energized</span>
                </div>
              </div>

              {/* Stress slider */}
              <div>
                <label className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>Stress Level</span>
                  <span>{stressLevel}/5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={stressLevel}
                  onChange={(e) => setStressLevel(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>😰 Very stressed</span>
                  <span>😌 Calm</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleQuickSubmit}
                className="flex-1 py-3 text-gray-300 border border-gray-600 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Skip details
              </button>
              <button
                onClick={handleSubmit}
                disabled={createCheckin.isPending}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {createCheckin.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>

            <button
              onClick={() => setStep('feeling')}
              className="w-full py-2 mt-3 text-gray-400 text-sm hover:text-white"
            >
              ← Change feeling
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center animate-fade-in">
            <div className="text-8xl mb-4 animate-bounce">🎉</div>
            <h3 className="text-2xl font-bold text-white mb-2">Check-in Complete!</h3>
            <p className="text-gray-300">Keep up the great work</p>
            <div className="mt-6 text-emerald-400 font-medium">+10 points earned</div>
          </div>
        )}
      </div>
    </div>
  );
}
