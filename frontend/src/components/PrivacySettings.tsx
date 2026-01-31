'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PrivacySettingsData {
  showHealthToManager: boolean;
  showSleepToManager: boolean;
  showHeartToManager: boolean;
  showExerciseToManager: boolean;
  showWorkToManager: boolean;
  showEmailToManager: boolean;
  showCalendarToManager: boolean;
  managerViewLevel: 'detailed' | 'summary' | 'zone_only';
  retainDetailedDataDays: number;
}

async function fetchPrivacySettings(): Promise<PrivacySettingsData> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/wellness/privacy', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch privacy settings');
  return res.json();
}

async function updatePrivacySettings(settings: Partial<PrivacySettingsData>): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/wellness/privacy', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update privacy settings');
}

function Toggle({ enabled, onChange, label, description }: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function PrivacySettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<PrivacySettingsData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: fetchPrivacySettings,
  });

  const mutation = useMutation({
    mutationFn: updatePrivacySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privacy-settings'] });
      setHasChanges(false);
    },
  });

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
  }, [settings, localSettings]);

  const handleChange = (key: keyof PrivacySettingsData, value: boolean | string | number) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [key]: value });
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    if (localSettings) {
      mutation.mutate(localSettings);
    }
  };

  if (isLoading || !localSettings) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Privacy Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Control what data your manager can see</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Manager View Level */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          What level of detail can your manager see?
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'zone_only', label: 'Zone Only', desc: 'Only your current zone status' },
            { value: 'summary', label: 'Summary', desc: 'Zone + general trends' },
            { value: 'detailed', label: 'Detailed', desc: 'Full metrics and scores' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleChange('managerViewLevel', option.value as 'detailed' | 'summary' | 'zone_only')}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                localSettings.managerViewLevel === option.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{option.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Visibility Toggles */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Health Data
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            enabled={localSettings.showSleepToManager}
            onChange={(v) => handleChange('showSleepToManager', v)}
            label="Sleep Data"
            description="Sleep hours, quality, and patterns"
          />
          <Toggle
            enabled={localSettings.showHeartToManager}
            onChange={(v) => handleChange('showHeartToManager', v)}
            label="Heart Rate Data"
            description="Resting heart rate and HRV"
          />
          <Toggle
            enabled={localSettings.showExerciseToManager}
            onChange={(v) => handleChange('showExerciseToManager', v)}
            label="Exercise Data"
            description="Steps and activity minutes"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Work Data
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Toggle
            enabled={localSettings.showWorkToManager}
            onChange={(v) => handleChange('showWorkToManager', v)}
            label="Work Metrics"
            description="Hours worked, tasks, and productivity"
          />
          <Toggle
            enabled={localSettings.showEmailToManager}
            onChange={(v) => handleChange('showEmailToManager', v)}
            label="Email Metrics"
            description="Email volume and patterns"
          />
          <Toggle
            enabled={localSettings.showCalendarToManager}
            onChange={(v) => handleChange('showCalendarToManager', v)}
            label="Calendar Data"
            description="Meeting hours and schedule density"
          />
        </div>
      </div>

      {/* Data Retention */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Data Retention
        </h3>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Keep detailed data for
          </label>
          <select
            value={localSettings.retainDetailedDataDays}
            onChange={(e) => handleChange('retainDetailedDataDays', parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>6 months</option>
            <option value={365}>1 year</option>
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          After this period, detailed data is automatically deleted. Aggregate statistics are kept.
        </p>
      </div>
    </div>
  );
}

export default PrivacySettings;
