'use client';

import { useState } from 'react';

const DEVICES = [
  {
    id: 'apple',
    name: 'Apple Watch',
    color: 'bg-gray-900 dark:bg-gray-100',
    textColor: 'text-white dark:text-gray-900',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    color: 'bg-[#00B0B9]',
    textColor: 'text-white',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      </svg>
    ),
  },
  {
    id: 'garmin',
    name: 'Garmin',
    color: 'bg-blue-600',
    textColor: 'text-white',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    color: 'bg-purple-600',
    textColor: 'text-white',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="2"/>
      </svg>
    ),
  },
];

export function DeviceConnection({ onComplete }: { onComplete?: () => void }) {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleConnect = (deviceId: string, deviceName: string) => {
    setConnectingId(deviceId);
    setMessage(null);

    // Simulate connection attempt then show message
    setTimeout(() => {
      setConnectingId(null);
      setMessage(`${deviceName} integration requires Terra API configuration. Contact your administrator to enable device connections.`);
    }, 1000);
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Wearable Devices</h2>

      {message && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {DEVICES.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${device.color} rounded-lg flex items-center justify-center ${device.textColor}`}>
                {device.icon}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Not connected</p>
              </div>
            </div>
            <button
              onClick={() => handleConnect(device.id, device.name)}
              disabled={connectingId === device.id}
              className="btn btn-primary"
            >
              {connectingId === device.id ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      {/* Skip/Continue for onboarding */}
      {onComplete && (
        <div className="flex justify-between pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onComplete}
            className="btn btn-ghost"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

export default DeviceConnection;
