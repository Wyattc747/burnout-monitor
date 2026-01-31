'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';
import { PersonalPreferencesForm } from '@/components/PersonalPreferencesForm';
import { LifeEventsManager } from '@/components/LifeEventsManager';
import { FeelingCheckin } from '@/components/FeelingCheckin';
import { clsx } from 'clsx';

type Tab = 'preferences' | 'life-events' | 'checkins';

export default function PersonalizationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('preferences');

  const { data: summary } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
  });

  const { data: checkinStats } = useQuery({
    queryKey: ['checkin-stats'],
    queryFn: personalizationApi.getCheckinStats,
  });

  const { data: checkins } = useQuery({
    queryKey: ['checkins'],
    queryFn: () => personalizationApi.getCheckins(10),
  });

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'life-events', label: 'Life Events', icon: '📅' },
    { id: 'checkins', label: 'Check-ins', icon: '💭' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Personalization
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize how Herd Shepherd understands your unique needs and circumstances.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          title="Setup Status"
          value={summary?.preferences?.setupCompleted ? 'Complete' : 'Incomplete'}
          color={summary?.preferences?.setupCompleted ? 'green' : 'yellow'}
          subtitle={summary?.preferences?.setupCompleted ? 'Your preferences are configured' : 'Set up your preferences'}
        />
        <SummaryCard
          title="Active Life Events"
          value={summary?.activeLifeEvents?.length?.toString() || '0'}
          color="blue"
          subtitle={summary?.activeLifeEvents?.[0]?.eventLabel || 'No active events'}
        />
        <SummaryCard
          title="Check-ins (30 days)"
          value={checkinStats?.totalCheckins?.toString() || '0'}
          color="purple"
          subtitle={
            checkinStats?.averages?.feeling
              ? `Avg feeling: ${checkinStats.averages.feeling}/5`
              : 'Start checking in'
          }
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'pb-4 px-1 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'preferences' && (
          <PersonalPreferencesForm />
        )}

        {activeTab === 'life-events' && (
          <LifeEventsManager />
        )}

        {activeTab === 'checkins' && (
          <div className="space-y-6">
            <FeelingCheckin />

            {/* Check-in History */}
            {checkins && checkins.length > 0 && (
              <div className="card">
                <h3 className="section-header mb-4">Recent Check-ins</h3>
                <div className="space-y-3">
                  {checkins.map((checkin) => (
                    <div
                      key={checkin.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {checkin.overallFeeling === 1
                            ? '😔'
                            : checkin.overallFeeling === 2
                            ? '😕'
                            : checkin.overallFeeling === 3
                            ? '😐'
                            : checkin.overallFeeling === 4
                            ? '🙂'
                            : '😊'}
                        </span>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {['Struggling', 'Low', 'Okay', 'Good', 'Great'][checkin.overallFeeling - 1]}
                          </span>
                          {checkin.notes && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {checkin.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(checkin.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {checkinStats && checkinStats.totalCheckins > 0 && (
              <div className="card">
                <h3 className="section-header mb-4">Your Patterns</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trend</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {checkinStats.trend === 'insufficient_data'
                        ? 'Needs more data'
                        : checkinStats.trend}
                    </p>
                  </div>
                  {checkinStats.averages.energy && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Energy</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {checkinStats.averages.energy}/5
                      </p>
                    </div>
                  )}
                  {checkinStats.averages.stress && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Stress</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {checkinStats.averages.stress}/5
                      </p>
                    </div>
                  )}
                  {checkinStats.averages.motivation && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Motivation</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {checkinStats.averages.motivation}/5
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'green' | 'yellow' | 'blue' | 'purple';
}) {
  const colorClasses = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="card">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className={clsx('text-2xl font-bold', colorClasses[color])}>{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{subtitle}</p>
    </div>
  );
}
