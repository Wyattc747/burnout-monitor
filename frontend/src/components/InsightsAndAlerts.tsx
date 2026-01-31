'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DetectedPattern {
  id: string;
  patternType: 'correlation' | 'trend' | 'anomaly' | 'prediction';
  title: string;
  description: string;
  factors: Record<string, unknown> | null;
  confidence: number | null;
  impact: 'positive' | 'negative' | 'neutral';
  timePeriod: string;
  detectedAt: string;
  acknowledgedAt: string | null;
}

interface PredictiveAlert {
  id: string;
  alertType: 'burnout_risk' | 'declining_trend' | 'pattern_warning' | 'recovery_opportunity';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  predictedOutcome: string | null;
  confidence: number | null;
  daysUntilPredicted: number | null;
  recommendations: string[] | null;
  createdAt: string;
}

async function fetchPatterns(): Promise<DetectedPattern[]> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/wellness/patterns', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch patterns');
  return res.json();
}

async function fetchAlerts(): Promise<PredictiveAlert[]> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/wellness/alerts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

async function acknowledgeAlert(id: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`http://localhost:3001/api/wellness/alerts/${id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to acknowledge alert');
}

async function dismissPattern(id: string): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`http://localhost:3001/api/wellness/patterns/${id}/dismiss`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to dismiss pattern');
}

const SEVERITY_STYLES = {
  low: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
  },
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
  },
};

const IMPACT_STYLES = {
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function AlertCard({ alert, onAcknowledge }: { alert: PredictiveAlert; onAcknowledge: () => void }) {
  const styles = SEVERITY_STYLES[alert.severity];

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${styles.icon} bg-white dark:bg-gray-800`}>
          {alert.severity === 'high' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-white">{alert.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              alert.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
              alert.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
            }`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.message}</p>

          {alert.daysUntilPredicted && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Predicted in {alert.daysUntilPredicted} days
              {alert.confidence && ` (${alert.confidence}% confidence)`}
            </p>
          )}

          {alert.recommendations && alert.recommendations.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recommendations:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                {alert.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={onAcknowledge}
            className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ pattern, onDismiss }: { pattern: DetectedPattern; onDismiss: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${IMPACT_STYLES[pattern.impact]}`}>
            {pattern.impact}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{pattern.timePeriod}</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <h4 className="font-medium text-gray-900 dark:text-white mt-2">{pattern.title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{pattern.description}</p>
      {pattern.confidence && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${pattern.confidence}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{pattern.confidence}% confident</span>
        </div>
      )}
    </div>
  );
}

export function PredictiveAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['predictive-alerts'],
    queryFn: fetchAlerts,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictive-alerts'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-emerald-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-medium text-emerald-900 dark:text-emerald-100">All Clear!</h3>
        <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">No predictive alerts at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Predictive Alerts</h3>
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
        />
      ))}
    </div>
  );
}

export function DetectedPatterns() {
  const queryClient = useQueryClient();

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['detected-patterns'],
    queryFn: fetchPatterns,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-patterns'] });
    },
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="font-medium text-gray-700 dark:text-gray-300">No Patterns Detected Yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We're analyzing your data to find helpful insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detected Patterns</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {patterns.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            onDismiss={() => dismissMutation.mutate(pattern.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function InsightsAndAlerts() {
  return (
    <div className="space-y-8">
      <PredictiveAlerts />
      <DetectedPatterns />
    </div>
  );
}

export default InsightsAndAlerts;
