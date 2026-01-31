'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';
import { clsx } from 'clsx';
import { Plus, X, Calendar, Heart, Briefcase, Home, Plane, Baby, GraduationCap, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LifeEvent {
  id: string;
  eventType: string;
  eventLabel: string;
  startDate: string;
  endDate?: string | null;
  impactLevel?: 'low' | 'medium' | 'high';
  notes?: string;
}

const LIFE_EVENT_TYPES = [
  { type: 'new_job', label: 'Started New Job', icon: Briefcase, impact: 'high' as const },
  { type: 'promotion', label: 'Got Promoted', icon: Briefcase, impact: 'medium' as const },
  { type: 'vacation', label: 'On Vacation', icon: Plane, impact: 'low' as const },
  { type: 'moving', label: 'Moving/Relocated', icon: Home, impact: 'high' as const },
  { type: 'new_baby', label: 'New Baby', icon: Baby, impact: 'high' as const },
  { type: 'wedding', label: 'Getting Married', icon: Heart, impact: 'high' as const },
  { type: 'health_issue', label: 'Health Issue', icon: AlertCircle, impact: 'high' as const },
  { type: 'family_issue', label: 'Family Matter', icon: Home, impact: 'medium' as const },
  { type: 'education', label: 'Taking Classes', icon: GraduationCap, impact: 'medium' as const },
  { type: 'other', label: 'Other Event', icon: Calendar, impact: 'medium' as const },
];

export function LifeEventsSection() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const queryClient = useQueryClient();

  const { data: personalization } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
  });

  const addLifeEvent = useMutation({
    mutationFn: async (event: any) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/personalization/life-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) throw new Error('Failed to add life event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
      setShowAddModal(false);
      setSelectedType(null);
      setNotes('');
      setEndDate('');
    },
  });

  const removeLifeEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/personalization/life-events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove life event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
  });

  const activeEvents = personalization?.activeLifeEvents || [];
  const selectedEventType = LIFE_EVENT_TYPES.find(e => e.type === selectedType);

  const handleSubmit = () => {
    if (!selectedType) return;
    const eventType = LIFE_EVENT_TYPES.find(e => e.type === selectedType);

    addLifeEvent.mutate({
      eventType: selectedType,
      eventLabel: eventType?.label || selectedType,
      startDate,
      endDate: endDate || null,
      impactLevel: eventType?.impact || 'medium',
      notes: notes || null,
    });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Life Events
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Help us understand what's happening in your life
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {/* Active Events */}
      {activeEvents.length > 0 ? (
        <div className="space-y-2">
          {activeEvents.map((event: LifeEvent) => {
            const eventConfig = LIFE_EVENT_TYPES.find(e => e.type === event.eventType);
            const Icon = eventConfig?.icon || Calendar;
            return (
              <div
                key={event.id}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  event.impactLevel === 'high' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' :
                  event.impactLevel === 'medium' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                  'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded-lg',
                    event.impactLevel === 'high' ? 'bg-purple-100 dark:bg-purple-800' :
                    event.impactLevel === 'medium' ? 'bg-blue-100 dark:bg-blue-800' :
                    'bg-gray-100 dark:bg-gray-600'
                  )}>
                    <Icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {event.eventLabel}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Since {new Date(event.startDate).toLocaleDateString()}
                      {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeLifeEvent.mutate(event.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Remove event"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active life events</p>
          <p className="text-xs mt-1">Add events to help personalize your wellness predictions</p>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Life Event
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-96">
              {!selectedType ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    What's happening in your life?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {LIFE_EVENT_TYPES.map((event) => {
                      const Icon = event.icon;
                      return (
                        <button
                          key={event.type}
                          onClick={() => setSelectedType(event.type)}
                          className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <Icon className="w-5 h-5 text-blue-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {event.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    {selectedEventType && <selectedEventType.icon className="w-5 h-5 text-blue-500" />}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedEventType?.label}
                    </span>
                    <button
                      onClick={() => setSelectedType(null)}
                      className="ml-auto text-xs text-blue-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional context..."
                      className="input w-full h-20 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={addLifeEvent.isPending}
                    className="btn btn-primary w-full"
                  >
                    {addLifeEvent.isPending ? 'Adding...' : 'Add Event'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LifeEventsSection;
