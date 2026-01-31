'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DeviceConnection {
  provider: string;
  connected: boolean;
  lastSync?: string;
}

interface TerraStatus {
  configured: boolean;
  providers: {
    apple: { connected: boolean };
    fitbit: { connected: boolean };
    garmin: { connected: boolean };
    oura: { connected: boolean };
  };
}

async function fetchIntegrationStatus(): Promise<{ terra: TerraStatus }> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/integrations/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch integration status');
  return res.json();
}

async function connectDevice(): Promise<{ url: string }> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('http://localhost:3001/api/integrations/terra/widget', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providers: ['APPLE', 'FITBIT', 'GARMIN', 'OURA', 'WHOOP', 'POLAR'] }),
  });
  if (!res.ok) throw new Error('Failed to initialize device connection');
  return res.json();
}

const DEVICE_INFO: Record<string, { name: string; icon: string; color: string }> = {
  apple: {
    name: 'Apple Watch',
    icon: '',
    color: 'bg-gray-900 dark:bg-white',
  },
  fitbit: {
    name: 'Fitbit',
    icon: '',
    color: 'bg-[#00B0B9]',
  },
  garmin: {
    name: 'Garmin',
    icon: '',
    color: 'bg-blue-600',
  },
  oura: {
    name: 'Oura Ring',
    icon: '',
    color: 'bg-purple-600',
  },
};

function DeviceCard({ provider, connected, name, color }: {
  provider: string;
  connected: boolean;
  name: string;
  color: string;
}) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${
      connected
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white dark:text-gray-900`}>
          {provider === 'apple' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          )}
          {provider === 'fitbit' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
            </svg>
          )}
          {provider === 'garmin' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          )}
          {provider === 'oura' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{name}</p>
          <p className={`text-sm ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {connected ? 'Connected' : 'Not connected'}
          </p>
        </div>
      </div>
      {connected && (
        <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
}

export function DeviceConnection({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['integration-status'],
    queryFn: fetchIntegrationStatus,
    refetchInterval: connecting ? 3000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: connectDevice,
    onSuccess: (data) => {
      if (data.url) {
        setConnecting(true);
        window.open(data.url, '_blank', 'width=500,height=700');
      }
    },
  });

  const hasConnectedDevice = status?.terra?.providers && Object.values(status.terra.providers).some(p => p.connected);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connect Your Devices</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Connect your wearable devices to automatically track health metrics.
        </p>
      </div>

      {/* Device List */}
      <div className="space-y-3">
        {Object.entries(DEVICE_INFO).map(([provider, info]) => (
          <DeviceCard
            key={provider}
            provider={provider}
            connected={status?.terra?.providers?.[provider as keyof typeof status.terra.providers]?.connected || false}
            name={info.name}
            color={info.color}
          />
        ))}
      </div>

      {/* Connect Button */}
      <button
        onClick={() => connectMutation.mutate()}
        disabled={connectMutation.isPending}
        className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
      >
        {connectMutation.isPending ? 'Opening connection...' : 'Connect a Device'}
      </button>

      {connecting && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-emerald-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Waiting for connection... Complete the setup in the popup window.
          <button
            onClick={() => setConnecting(false)}
            className="block mx-auto mt-2 text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Done connecting
          </button>
        </div>
      )}

      {/* Skip/Continue */}
      {onComplete && (
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onComplete}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip for now
          </button>
          {hasConnectedDevice && (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DeviceConnection;
