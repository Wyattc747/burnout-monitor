'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ReminderSettingsData {
  checkinReminder: {
    enabled: boolean;
    time: string;
    days: number[];
  };
  weeklySummary: {
    enabled: boolean;
    day: number;
    time: string;
  };
  push: {
    enabled: boolean;
    subscription: unknown | null;
  };
  emailEnabled: boolean;
}

async function fetchReminderSettings(): Promise<ReminderSettingsData> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/wellness/reminders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch reminder settings');
  return res.json();
}

async function updateReminderSettings(settings: Partial<ReminderSettingsData>): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/wellness/reminders`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update reminder settings');
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
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
  );
}

export function ReminderSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<ReminderSettingsData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: fetchReminderSettings,
  });

  const mutation = useMutation({
    mutationFn: updateReminderSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-settings'] });
      setHasChanges(false);
    },
  });

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
  }, [settings, localSettings]);

  const handleCheckinChange = (key: keyof ReminderSettingsData['checkinReminder'], value: boolean | string | number[]) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        checkinReminder: { ...localSettings.checkinReminder, [key]: value },
      });
      setHasChanges(true);
    }
  };

  const handleSummaryChange = (key: keyof ReminderSettingsData['weeklySummary'], value: boolean | string | number) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        weeklySummary: { ...localSettings.weeklySummary, [key]: value },
      });
      setHasChanges(true);
    }
  };

  const toggleDay = (day: number) => {
    if (localSettings) {
      const days = localSettings.checkinReminder.days;
      const newDays = days.includes(day)
        ? days.filter(d => d !== day)
        : [...days, day].sort();
      handleCheckinChange('days', newDays);
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Reminders & Notifications</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure when and how you want to be reminded</p>
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

      {/* Daily Check-in Reminder */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Daily Check-in Reminder</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get reminded to do your daily wellness check-in</p>
          </div>
          <Toggle
            enabled={localSettings.checkinReminder.enabled}
            onChange={(v) => handleCheckinChange('enabled', v)}
          />
        </div>

        {localSettings.checkinReminder.enabled && (
          <div className="space-y-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
            {/* Time picker */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Reminder time</label>
              <input
                type="time"
                value={localSettings.checkinReminder.time}
                onChange={(e) => handleCheckinChange('time', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Day selector */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Days</label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      localSettings.checkinReminder.days.includes(day.value)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Summary */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Weekly Summary Email</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Receive a weekly wellness report via email</p>
          </div>
          <Toggle
            enabled={localSettings.weeklySummary.enabled}
            onChange={(v) => handleSummaryChange('enabled', v)}
          />
        </div>

        {localSettings.weeklySummary.enabled && (
          <div className="space-y-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
            <div className="flex gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Day</label>
                <select
                  value={localSettings.weeklySummary.day}
                  onChange={(e) => handleSummaryChange('day', parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label === 'Sun' ? 'Sunday' :
                       day.label === 'Mon' ? 'Monday' :
                       day.label === 'Tue' ? 'Tuesday' :
                       day.label === 'Wed' ? 'Wednesday' :
                       day.label === 'Thu' ? 'Thursday' :
                       day.label === 'Fri' ? 'Friday' : 'Saturday'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Time</label>
                <input
                  type="time"
                  value={localSettings.weeklySummary.time}
                  onChange={(e) => handleSummaryChange('time', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Receive important alerts via email</p>
        </div>
        <Toggle
          enabled={localSettings.emailEnabled}
          onChange={(v) => {
            setLocalSettings({ ...localSettings, emailEnabled: v });
            setHasChanges(true);
          }}
        />
      </div>
    </div>
  );
}

export default ReminderSettings;
