'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { demoApi } from '@/lib/api';
import type { Employee } from '@/types';

interface DemoControlsProps {
  employees: Employee[];
}

export function DemoControls({ employees }: DemoControlsProps) {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [targetZone, setTargetZone] = useState<'red' | 'green'>('red');
  const [advanceDays, setAdvanceDays] = useState(1);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const triggerAlert = useMutation({
    mutationFn: () => demoApi.triggerAlert(selectedEmployee, targetZone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const advanceTime = useMutation({
    mutationFn: () => demoApi.advanceTime(advanceDays),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      alert(`Time advanced. ${data.alertsGenerated} alerts generated.`);
    },
  });

  const resetDemo = useMutation({
    mutationFn: () => demoApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowConfirmReset(false);
      alert('Demo reset complete');
    },
  });

  return (
    <div className="card bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🎮</span>
        <h3 className="font-semibold text-gray-900">Demo Controls</h3>
      </div>

      {/* Trigger Alert */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Trigger Alert</h4>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="input flex-1 min-w-[150px]"
          >
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
          <select
            value={targetZone}
            onChange={(e) => setTargetZone(e.target.value as 'red' | 'green')}
            className="input w-32"
          >
            <option value="red">Burnout (Red)</option>
            <option value="green">Peak (Green)</option>
          </select>
          <button
            onClick={() => triggerAlert.mutate()}
            disabled={!selectedEmployee || triggerAlert.isPending}
            className="btn btn-primary"
          >
            {triggerAlert.isPending ? 'Triggering...' : 'Trigger'}
          </button>
        </div>
      </div>

      {/* Advance Time */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Time Simulation</h4>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="7"
            value={advanceDays}
            onChange={(e) => setAdvanceDays(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 w-16">{advanceDays} day{advanceDays > 1 ? 's' : ''}</span>
          <button
            onClick={() => advanceTime.mutate()}
            disabled={advanceTime.isPending}
            className="btn btn-secondary"
          >
            {advanceTime.isPending ? 'Advancing...' : 'Advance'}
          </button>
        </div>
      </div>

      {/* Reset */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Reset Demo</h4>
        {showConfirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Are you sure?</span>
            <button
              onClick={() => resetDemo.mutate()}
              disabled={resetDemo.isPending}
              className="btn btn-danger text-sm"
            >
              {resetDemo.isPending ? 'Resetting...' : 'Yes, Reset'}
            </button>
            <button
              onClick={() => setShowConfirmReset(false)}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="btn btn-secondary"
          >
            Reset to Initial State
          </button>
        )}
      </div>
    </div>
  );
}
