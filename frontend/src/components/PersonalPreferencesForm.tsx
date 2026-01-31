'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';
import type { PersonalPreferences, Chronotype, SocialEnergyType, SleepFlexibility, WorkPattern, Importance } from '@/types';
import { clsx } from 'clsx';

interface PersonalPreferencesFormProps {
  onComplete?: () => void;
  isOnboarding?: boolean;
}

export function PersonalPreferencesForm({ onComplete, isOnboarding = false }: PersonalPreferencesFormProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: personalizationApi.getPreferences,
  });

  const [formData, setFormData] = useState<Partial<PersonalPreferences>>({});

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  const updatePreferences = useMutation({
    mutationFn: personalizationApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      onComplete?.();
    },
  });

  const handleChange = <K extends keyof PersonalPreferences>(key: K, value: PersonalPreferences[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    updatePreferences.mutate({
      ...formData,
      setupCompleted: true,
    });
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {isOnboarding && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Personalize Your Experience
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Help us understand what works best for you. This helps us provide more accurate insights.
          </p>
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'flex-1 h-2 rounded-full transition-colors',
                  i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Sleep Preferences */}
      {step === 1 && (
        <div className="animate-fade-in">
          <h3 className="section-header mb-4">Sleep Preferences</h3>

          <div className="space-y-6">
            <div>
              <label className="label">Ideal Hours of Sleep</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="10"
                  step="0.5"
                  value={formData.idealSleepHours || 7.5}
                  onChange={(e) => handleChange('idealSleepHours', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-white w-16 text-center">
                  {formData.idealSleepHours || 7.5}h
                </span>
              </div>
            </div>

            <div>
              <label className="label">Sleep Schedule Flexibility</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                How important is it to maintain a consistent sleep schedule?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'rigid', label: 'Rigid', desc: 'I need consistency' },
                  { value: 'moderate', label: 'Moderate', desc: 'Some flexibility is okay' },
                  { value: 'flexible', label: 'Flexible', desc: 'Very adaptable' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('sleepFlexibility', option.value as SleepFlexibility)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      formData.sleepFlexibility === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Chronotype</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                When do you naturally feel most alert and productive?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'early_bird', label: 'Early Bird', icon: '🌅', desc: 'Best in morning' },
                  { value: 'neutral', label: 'Neutral', icon: '☀️', desc: 'Steady throughout' },
                  { value: 'night_owl', label: 'Night Owl', icon: '🌙', desc: 'Best in evening' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('chronotype', option.value as Chronotype)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-center transition-all',
                      formData.chronotype === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="text-2xl block mb-1">{option.icon}</span>
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Work Preferences */}
      {step === 2 && (
        <div className="animate-fade-in">
          <h3 className="section-header mb-4">Work Preferences</h3>

          <div className="space-y-6">
            <div>
              <label className="label">Ideal Work Hours Per Day</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="0.5"
                  value={formData.idealWorkHours || 8}
                  onChange={(e) => handleChange('idealWorkHours', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-white w-16 text-center">
                  {formData.idealWorkHours || 8}h
                </span>
              </div>
            </div>

            <div>
              <label className="label">Maximum Meeting Hours Daily</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                How many hours of meetings feel manageable?
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={formData.maxMeetingHoursDaily || 4}
                  onChange={(e) => handleChange('maxMeetingHoursDaily', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-white w-16 text-center">
                  {formData.maxMeetingHoursDaily || 4}h
                </span>
              </div>
            </div>

            <div>
              <label className="label">Preferred Work Pattern</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'steady', label: 'Steady', desc: 'Consistent pace daily' },
                  { value: 'burst', label: 'Burst', desc: 'Intense focus periods' },
                  { value: 'flexible', label: 'Flexible', desc: 'Varies by need' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('preferredWorkPattern', option.value as WorkPattern)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      formData.preferredWorkPattern === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Energy & Exercise */}
      {step === 3 && (
        <div className="animate-fade-in">
          <h3 className="section-header mb-4">Energy & Exercise</h3>

          <div className="space-y-6">
            <div>
              <label className="label">Social Energy Type</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                How do you recharge?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'introvert', label: 'Introvert', icon: '🧘', desc: 'Recharge alone' },
                  { value: 'ambivert', label: 'Ambivert', icon: '⚖️', desc: 'Mix of both' },
                  { value: 'extrovert', label: 'Extrovert', icon: '🎉', desc: 'Recharge with others' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('socialEnergyType', option.value as SocialEnergyType)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-center transition-all',
                      formData.socialEnergyType === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="text-2xl block mb-1">{option.icon}</span>
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Ideal Daily Exercise (minutes)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={formData.idealExerciseMinutes || 30}
                  onChange={(e) => handleChange('idealExerciseMinutes', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-semibold text-gray-900 dark:text-white w-20 text-center">
                  {formData.idealExerciseMinutes || 30} min
                </span>
              </div>
            </div>

            <div>
              <label className="label">How Important is Exercise for Your Wellbeing?</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'low', label: 'Nice to have', desc: "It helps but isn't critical" },
                  { value: 'moderate', label: 'Important', desc: 'Noticeably affects my mood' },
                  { value: 'high', label: 'Essential', desc: 'Critical to my wellbeing' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('exerciseImportance', option.value as Importance)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      formData.exerciseImportance === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <span className="block font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Factor Weights */}
      {step === 4 && (
        <div className="animate-fade-in">
          <h3 className="section-header mb-4">What Matters Most to You?</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Adjust how much each factor should affect your wellness score.
          </p>

          <div className="space-y-6">
            {[
              { key: 'weightSleep', label: 'Sleep Quality', desc: 'Hours and quality of sleep' },
              { key: 'weightExercise', label: 'Physical Activity', desc: 'Exercise and movement' },
              { key: 'weightWorkload', label: 'Workload', desc: 'Hours worked and overtime' },
              { key: 'weightMeetings', label: 'Meeting Load', desc: 'Time spent in meetings' },
              { key: 'weightHeartMetrics', label: 'Heart Health', desc: 'HRV and resting heart rate' },
            ].map((factor) => (
              <div key={factor.key}>
                <div className="flex justify-between mb-2">
                  <div>
                    <label className="font-medium text-gray-900 dark:text-white">
                      {factor.label}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {factor.desc}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {formData[factor.key as keyof PersonalPreferences] || 50}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={(formData[factor.key as keyof PersonalPreferences] as number) || 50}
                  onChange={(e) => handleChange(factor.key as keyof PersonalPreferences, parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="btn btn-secondary"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            className="btn btn-primary"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={updatePreferences.isPending}
            className="btn btn-primary"
          >
            {updatePreferences.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
        )}
      </div>
    </div>
  );
}
