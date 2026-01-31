'use client';

import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';

interface PredictiveTimelineProps {
  employeeId: string;
}

export function PredictiveTimeline({ employeeId }: PredictiveTimelineProps) {
  const { data: prediction, isLoading } = useQuery({
    queryKey: ['prediction', employeeId],
    queryFn: () => employeesApi.getPrediction(employeeId),
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!prediction?.hasPrediction) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Burnout Forecast</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Need more data to generate predictions. Check back after a few more days of tracking.
        </p>
      </div>
    );
  }

  const { trend, daysUntilRed, redZoneWarning, forecast, currentScore, currentZone } = prediction;

  const trendColors = {
    worsening: 'text-red-600 dark:text-red-400',
    improving: 'text-green-600 dark:text-green-400',
    stable: 'text-yellow-600 dark:text-yellow-400',
  };

  const trendIcons = {
    worsening: '↗',
    improving: '↘',
    stable: '→',
  };

  const zoneColors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Burnout Forecast</h3>
        <span className={`text-sm font-medium ${trendColors[trend.direction as keyof typeof trendColors]}`}>
          {trendIcons[trend.direction as keyof typeof trendIcons]} {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
        </span>
      </div>

      {/* Warning Banner */}
      {redZoneWarning && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400 text-lg">⚠️</span>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{redZoneWarning}</p>
          </div>
        </div>
      )}

      {/* Current State */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentScore}</p>
          </div>
          <div className={`w-3 h-3 rounded-full ${zoneColors[currentZone as keyof typeof zoneColors]}`}></div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{trend.description}</p>
      </div>

      {/* 7-Day Forecast */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">7-Day Forecast</p>
        <div className="flex gap-1">
          {forecast.map((day: any) => (
            <div
              key={day.day}
              className="flex-1 flex flex-col items-center"
              title={`Day ${day.day}: ${day.predictedScore} (${day.confidence}% confidence)`}
            >
              <div
                className={`w-full h-16 rounded-t ${zoneColors[day.predictedZone as keyof typeof zoneColors]} opacity-${Math.round(day.confidence / 10) * 10}`}
                style={{
                  height: `${Math.max(20, day.predictedScore * 0.6)}px`,
                  opacity: day.confidence / 100,
                }}
              ></div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">D{day.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Low Risk
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Moderate
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> High Risk
          </span>
        </div>
        <span>{prediction.daysAnalyzed} days analyzed</span>
      </div>
    </div>
  );
}

export default PredictiveTimeline;
