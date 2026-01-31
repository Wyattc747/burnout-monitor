'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';
import type { LifeEvent, LifeEventTemplate } from '@/types';
import { clsx } from 'clsx';

const CATEGORY_ICONS: Record<string, string> = {
  family: '👨‍👩‍👧',
  work: '💼',
  health: '❤️',
  life_change: '🔄',
  recovery: '🌱',
};

export function LifeEventsManager() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<LifeEventTemplate | null>(null);

  const { data: lifeEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['life-events'],
    queryFn: () => personalizationApi.getLifeEvents(false),
  });

  const { data: templates } = useQuery({
    queryKey: ['life-event-templates'],
    queryFn: personalizationApi.getLifeEventTemplates,
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { isActive?: boolean; endDate?: string } }) =>
      personalizationApi.updateLifeEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['life-events'] });
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: personalizationApi.deleteLifeEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['life-events'] });
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
  });

  const activeEvents = lifeEvents?.filter((e) => e.isActive) || [];
  const pastEvents = lifeEvents?.filter((e) => !e.isActive) || [];

  // Group templates by category
  const templatesByCategory = templates?.reduce((acc, template) => {
    const category = template.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, LifeEventTemplate[]>);

  return (
    <div className="space-y-6">
      {/* Active Life Events */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-header">Active Life Events</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm"
          >
            Add Event
          </button>
        </div>

        {loadingEvents ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ) : activeEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="mb-2">No active life events</p>
            <p className="text-sm">
              Life events help adjust your wellness expectations during significant periods.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeEvents.map((event) => (
              <LifeEventCard
                key={event.id}
                event={event}
                onEnd={(id) => updateEvent.mutate({
                  id,
                  updates: { isActive: false, endDate: new Date().toISOString().split('T')[0] },
                })}
                onDelete={(id) => deleteEvent.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past Life Events */}
      {pastEvents.length > 0 && (
        <div className="card">
          <h3 className="section-header mb-4">Past Life Events</h3>
          <div className="space-y-3">
            {pastEvents.slice(0, 5).map((event) => (
              <LifeEventCard
                key={event.id}
                event={event}
                isPast
                onDelete={(id) => deleteEvent.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Life Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTemplate ? 'Add Life Event' : 'Select Event Type'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {selectedTemplate ? (
                <AddLifeEventForm
                  template={selectedTemplate}
                  onSuccess={() => {
                    setShowAddModal(false);
                    setSelectedTemplate(null);
                  }}
                  onBack={() => setSelectedTemplate(null)}
                />
              ) : (
                <div className="space-y-6">
                  {templatesByCategory && Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <span>{CATEGORY_ICONS[category] || '📌'}</span>
                        {category.replace('_', ' ')}
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 text-left transition-all hover:shadow-md"
                          >
                            <span className="font-medium text-gray-900 dark:text-white block">
                              {template.eventLabel}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {template.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LifeEventCard({
  event,
  isPast = false,
  onEnd,
  onDelete,
}: {
  event: LifeEvent;
  isPast?: boolean;
  onEnd?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border transition-all',
        isPast
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className={clsx(
            'font-medium',
            isPast ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'
          )}>
            {event.eventLabel}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(event.startDate)}
            {event.endDate ? ` - ${formatDate(event.endDate)}` : ' - Ongoing'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isPast && onEnd && (
            <button
              onClick={() => onEnd(event.id)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              End
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Adjustments display */}
      <div className="flex flex-wrap gap-2 mt-3">
        {event.sleepAdjustment !== 0 && (
          <AdjustmentBadge label="Sleep" value={event.sleepAdjustment} />
        )}
        {event.workAdjustment !== 0 && (
          <AdjustmentBadge label="Work" value={event.workAdjustment} />
        )}
        {event.exerciseAdjustment !== 0 && (
          <AdjustmentBadge label="Exercise" value={event.exerciseAdjustment} />
        )}
        {event.stressToleranceAdjustment !== 0 && (
          <AdjustmentBadge label="Stress" value={event.stressToleranceAdjustment} />
        )}
      </div>

      {event.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
          {event.notes}
        </p>
      )}
    </div>
  );
}

function AdjustmentBadge({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={clsx(
        'px-2 py-1 rounded text-xs font-medium',
        value < 0
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      )}
    >
      {label}: {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

function AddLifeEventForm({
  template,
  onSuccess,
  onBack,
}: {
  template: LifeEventTemplate;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    template.suggestedDurationDays
      ? new Date(Date.now() + template.suggestedDurationDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
      : ''
  );
  const [notes, setNotes] = useState('');
  const [sleepAdjustment, setSleepAdjustment] = useState(template.defaultSleepAdjustment);
  const [workAdjustment, setWorkAdjustment] = useState(template.defaultWorkAdjustment);
  const [exerciseAdjustment, setExerciseAdjustment] = useState(template.defaultExerciseAdjustment);
  const [stressAdjustment, setStressAdjustment] = useState(template.defaultStressToleranceAdjustment);

  const createEvent = useMutation({
    mutationFn: personalizationApi.createLifeEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['life-events'] });
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEvent.mutate({
      eventType: template.eventType,
      eventLabel: template.eventLabel,
      startDate,
      endDate: endDate || undefined,
      sleepAdjustment,
      workAdjustment,
      exerciseAdjustment,
      stressToleranceAdjustment: stressAdjustment,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white">{template.eventLabel}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
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
          <label className="label">End Date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input w-full"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty if ongoing</p>
        </div>
      </div>

      <div>
        <label className="label">Expectation Adjustments</label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          How should we adjust our expectations during this time?
        </p>

        <div className="space-y-4">
          {[
            { label: 'Sleep', value: sleepAdjustment, setter: setSleepAdjustment },
            { label: 'Work Capacity', value: workAdjustment, setter: setWorkAdjustment },
            { label: 'Exercise', value: exerciseAdjustment, setter: setExerciseAdjustment },
            { label: 'Stress Tolerance', value: stressAdjustment, setter: setStressAdjustment },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <span className="w-32 text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
              <input
                type="range"
                min="-50"
                max="50"
                value={item.value}
                onChange={(e) => item.setter(parseInt(e.target.value))}
                className="flex-1"
              />
              <span
                className={clsx(
                  'w-16 text-right text-sm font-medium',
                  item.value < 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : item.value > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {item.value > 0 ? '+' : ''}{item.value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Any additional context..."
        />
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <button
          type="submit"
          disabled={createEvent.isPending}
          className="btn btn-primary"
        >
          {createEvent.isPending ? 'Adding...' : 'Add Event'}
        </button>
      </div>
    </form>
  );
}
