'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Navbar } from '@/components/Navbar';
import { integrationsApi } from '@/lib/api';
import { LogoIcon } from '@/components/Logo';

type OnboardingStep = 'welcome' | 'health-devices' | 'work-systems' | 'complete';

const steps: { id: OnboardingStep; title: string; description: string }[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with ShepHerd' },
  { id: 'health-devices', title: 'Health Devices', description: 'Connect your wearables' },
  { id: 'work-systems', title: 'Work Systems', description: 'Link productivity tools' },
  { id: 'complete', title: 'All Set', description: 'You\'re ready to go' },
];

interface DeviceConnection {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'connected' | 'disconnected' | 'connecting';
  provider: string;
}

interface WorkSystemConnection {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'connected' | 'disconnected' | 'connecting';
  provider: string;
  requiresOAuth: boolean;
}

export default function OnboardingPage() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for OAuth callback status
  const callbackStatus = searchParams?.get('status');
  const callbackStep = searchParams?.get('step');
  const callbackProvider = searchParams?.get('provider');

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [healthDevices, setHealthDevices] = useState<DeviceConnection[]>([
    {
      id: 'apple-watch',
      name: 'Apple Watch',
      icon: '⌚',
      description: 'Sync heart rate, HRV, sleep, and activity data',
      status: 'disconnected',
      provider: 'APPLE',
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      icon: '📱',
      description: 'Import health and fitness metrics',
      status: 'disconnected',
      provider: 'FITBIT',
    },
    {
      id: 'oura',
      name: 'Oura Ring',
      icon: '💍',
      description: 'Track sleep quality and readiness',
      status: 'disconnected',
      provider: 'OURA',
    },
    {
      id: 'garmin',
      name: 'Garmin',
      icon: '🏃',
      description: 'Sync training and recovery data',
      status: 'disconnected',
      provider: 'GARMIN',
    },
  ]);

  const [workSystems, setWorkSystems] = useState<WorkSystemConnection[]>([
    {
      id: 'salesforce',
      name: 'Salesforce',
      icon: '☁️',
      description: 'Track tasks, calls, meetings, and activity',
      status: 'disconnected',
      provider: 'salesforce',
      requiresOAuth: true,
    },
    {
      id: 'jira',
      name: 'Jira',
      icon: '📋',
      description: 'Track tasks and project assignments',
      status: 'disconnected',
      provider: 'jira',
      requiresOAuth: true,
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: '💬',
      description: 'Monitor communication patterns',
      status: 'disconnected',
      provider: 'slack',
      requiresOAuth: true,
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      icon: '📅',
      description: 'Analyze meeting load and focus time',
      status: 'disconnected',
      provider: 'google',
      requiresOAuth: true,
    },
  ]);

  // Fetch integration status
  const { data: integrationStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['integrationStatus'],
    queryFn: integrationsApi.getStatus,
    enabled: !isLoading,
  });

  // Update connection status from API
  useEffect(() => {
    if (integrationStatus) {
      // Update health device statuses
      setHealthDevices(prev => prev.map(device => {
        const terraProvider = device.provider.toLowerCase();
        const isConnected = integrationStatus.terra?.providers?.[terraProvider]?.connected;
        return {
          ...device,
          status: isConnected ? 'connected' : 'disconnected',
        };
      }));

      // Update work system statuses
      setWorkSystems(prev => prev.map(system => {
        if (system.provider === 'salesforce') {
          return {
            ...system,
            status: integrationStatus.salesforce?.connected ? 'connected' : 'disconnected',
          };
        }
        return system;
      }));
    }
  }, [integrationStatus]);

  // Handle OAuth callback
  useEffect(() => {
    if (callbackStatus && callbackStep) {
      if (callbackStep === 'health-devices') {
        setCurrentStep('health-devices');
        refetchStatus();
      } else if (callbackStep === 'work-systems') {
        setCurrentStep('work-systems');
        refetchStatus();
      }
      // Clear URL params
      window.history.replaceState({}, '', '/onboarding');
    }
  }, [callbackStatus, callbackStep, refetchStatus]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // Terra widget mutation for health devices
  const terraWidget = useMutation({
    mutationFn: (providers: string[]) => integrationsApi.getTerraWidgetSession(providers),
    onSuccess: (data) => {
      // Open Terra widget in a new window
      window.open(data.url, '_blank', 'width=500,height=700');
    },
  });

  // Salesforce OAuth mutation
  const salesforceAuth = useMutation({
    mutationFn: integrationsApi.getSalesforceAuthUrl,
    onSuccess: (data) => {
      // Redirect to Salesforce OAuth
      window.location.href = data.url;
    },
  });

  const handleHealthDeviceConnect = async (device: DeviceConnection) => {
    setHealthDevices(prev =>
      prev.map(d => d.id === device.id ? { ...d, status: 'connecting' } : d)
    );

    try {
      // Use Terra widget for real connection
      if (integrationStatus?.terra?.configured) {
        terraWidget.mutate([device.provider]);
      } else {
        // Simulate for demo
        await new Promise(resolve => setTimeout(resolve, 1500));
        setHealthDevices(prev =>
          prev.map(d => d.id === device.id ? { ...d, status: 'connected' } : d)
        );
      }
    } catch (error) {
      setHealthDevices(prev =>
        prev.map(d => d.id === device.id ? { ...d, status: 'disconnected' } : d)
      );
    }
  };

  const handleHealthDeviceDisconnect = async (deviceId: string) => {
    const device = healthDevices.find(d => d.id === deviceId);
    if (device && integrationStatus?.terra?.configured) {
      await integrationsApi.disconnectTerraProvider(device.provider.toLowerCase());
    }
    setHealthDevices(prev =>
      prev.map(d => d.id === deviceId ? { ...d, status: 'disconnected' } : d)
    );
    refetchStatus();
  };

  const handleWorkSystemConnect = async (system: WorkSystemConnection) => {
    setWorkSystems(prev =>
      prev.map(s => s.id === system.id ? { ...s, status: 'connecting' } : s)
    );

    try {
      if (system.provider === 'salesforce' && integrationStatus?.salesforce?.configured) {
        // Use real Salesforce OAuth
        salesforceAuth.mutate();
        return;
      }

      // Simulate for other systems (not yet implemented)
      await new Promise(resolve => setTimeout(resolve, 1500));
      setWorkSystems(prev =>
        prev.map(s => s.id === system.id ? { ...s, status: 'connected' } : s)
      );
    } catch (error) {
      setWorkSystems(prev =>
        prev.map(s => s.id === system.id ? { ...s, status: 'disconnected' } : s)
      );
    }
  };

  const handleWorkSystemDisconnect = async (systemId: string) => {
    const system = workSystems.find(s => s.id === systemId);
    if (system?.provider === 'salesforce') {
      await integrationsApi.disconnectSalesforce();
    }
    setWorkSystems(prev =>
      prev.map(s => s.id === systemId ? { ...s, status: 'disconnected' } : s)
    );
    refetchStatus();
  };

  const goToNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('onboarding_complete', 'true');
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={clsx(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium',
                    index < currentStepIndex && 'bg-indigo-600 border-indigo-600 text-white',
                    index === currentStepIndex && 'border-indigo-600 text-indigo-600',
                    index > currentStepIndex && 'border-gray-300 text-gray-400'
                  )}
                >
                  {index < currentStepIndex ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={clsx(
                      'w-24 h-1 mx-2',
                      index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <div key={step.id} className="text-center" style={{ width: '80px' }}>
                <p className={clsx(
                  'text-xs font-medium',
                  step.id === currentStep ? 'text-indigo-600' : 'text-gray-500'
                )}>
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="card">
          {currentStep === 'welcome' && (
            <WelcomeStep user={user} onContinue={goToNext} />
          )}

          {currentStep === 'health-devices' && (
            <HealthDevicesStep
              devices={healthDevices}
              isConfigured={integrationStatus?.terra?.configured || false}
              onConnect={handleHealthDeviceConnect}
              onDisconnect={handleHealthDeviceDisconnect}
              onBack={goToPrevious}
              onContinue={goToNext}
            />
          )}

          {currentStep === 'work-systems' && (
            <WorkSystemsStep
              systems={workSystems}
              salesforceConfigured={integrationStatus?.salesforce?.configured || false}
              onConnect={handleWorkSystemConnect}
              onDisconnect={handleWorkSystemDisconnect}
              onBack={goToPrevious}
              onContinue={goToNext}
            />
          )}

          {currentStep === 'complete' && (
            <CompleteStep
              healthDevices={healthDevices}
              workSystems={workSystems}
              onBack={goToPrevious}
              onFinish={finishOnboarding}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function WelcomeStep({ user, onContinue }: { user: any; onContinue: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 bg-indigo-100 rounded-full flex items-center justify-center">
        <LogoIcon size={48} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome to ShepHerd, {user?.email?.split('@')[0]}!
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        We're here to help you maintain peak performance while protecting your wellbeing.
        Let's get you set up in just a few steps.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left max-w-2xl mx-auto">
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-2xl mb-2">🌿</div>
          <h3 className="font-semibold text-gray-900">Private Health Data</h3>
          <p className="text-sm text-gray-600">Your health metrics are visible only to you - not your manager.</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold text-gray-900">Smart Insights</h3>
          <p className="text-sm text-gray-600">Get personalized recommendations based on your unique patterns.</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl mb-2">🛡️</div>
          <h3 className="font-semibold text-gray-900">Burnout Prevention</h3>
          <p className="text-sm text-gray-600">Early alerts help you take action before burnout happens.</p>
        </div>
      </div>

      <button onClick={onContinue} className="btn btn-primary px-8">
        Get Started
      </button>
    </div>
  );
}

function HealthDevicesStep({
  devices,
  isConfigured,
  onConnect,
  onDisconnect,
  onBack,
  onContinue,
}: {
  devices: DeviceConnection[];
  isConfigured: boolean;
  onConnect: (device: DeviceConnection) => void;
  onDisconnect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const connectedCount = devices.filter((d) => d.status === 'connected').length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Connect Your Health Devices</h2>
        <p className="text-gray-600 mt-1">
          Link your wearables to automatically sync health metrics. Your data stays private.
        </p>
      </div>

      {!isConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-blue-500 text-lg">ℹ️</span>
            <div>
              <h4 className="font-medium text-blue-800">Demo Mode</h4>
              <p className="text-sm text-blue-700">
                Health device integration is not configured. Connections will be simulated for demo purposes.
                To enable real connections, configure Terra API credentials.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-amber-500 text-lg">🔒</span>
          <div>
            <h4 className="font-medium text-amber-800">Privacy First</h4>
            <p className="text-sm text-amber-700">
              Your raw health data (heart rate, sleep details, etc.) is never shared with your manager.
              Only aggregated wellness scores are visible to leadership.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{device.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900">{device.name}</h3>
                <p className="text-sm text-gray-500">{device.description}</p>
              </div>
            </div>
            <div>
              {device.status === 'connected' ? (
                <div className="flex items-center gap-3">
                  <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                  <button
                    onClick={() => onDisconnect(device.id)}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    Disconnect
                  </button>
                </div>
              ) : device.status === 'connecting' ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-sm">Connecting...</span>
                </div>
              ) : (
                <button
                  onClick={() => onConnect(device)}
                  className="btn btn-secondary text-sm"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {connectedCount > 0 ? `${connectedCount} device(s) connected` : 'You can skip this step'}
          </span>
          <button onClick={onContinue} className="btn btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkSystemsStep({
  systems,
  salesforceConfigured,
  onConnect,
  onDisconnect,
  onBack,
  onContinue,
}: {
  systems: WorkSystemConnection[];
  salesforceConfigured: boolean;
  onConnect: (system: WorkSystemConnection) => void;
  onDisconnect: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const connectedCount = systems.filter((s) => s.status === 'connected').length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Connect Work Systems</h2>
        <p className="text-gray-600 mt-1">
          Link your productivity tools to track workload and identify potential stress points.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-lg">📊</span>
          <div>
            <h4 className="font-medium text-blue-800">What We Track</h4>
            <p className="text-sm text-blue-700">
              We analyze patterns like hours worked, meeting load, and task completion rates -
              not the content of your messages or code. This helps identify when workload
              may be affecting your wellbeing.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {systems.map((system) => {
          const isConfigured = system.provider === 'salesforce' ? salesforceConfigured : false;

          return (
            <div
              key={system.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{system.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{system.name}</h3>
                    {isConfigured && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Ready
                      </span>
                    )}
                    {!isConfigured && system.provider === 'salesforce' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{system.description}</p>
                </div>
              </div>
              <div>
                {system.status === 'connected' ? (
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Connected
                    </span>
                    <button
                      onClick={() => onDisconnect(system.id)}
                      className="text-sm text-gray-500 hover:text-red-600"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : system.status === 'connecting' ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm">Connecting...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onConnect(system)}
                    className="btn btn-secondary text-sm"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {connectedCount > 0 ? `${connectedCount} system(s) connected` : 'You can skip this step'}
          </span>
          <button onClick={onContinue} className="btn btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteStep({
  healthDevices,
  workSystems,
  onBack,
  onFinish,
}: {
  healthDevices: DeviceConnection[];
  workSystems: WorkSystemConnection[];
  onBack: () => void;
  onFinish: () => void;
}) {
  const connectedHealthDevices = healthDevices.filter((d) => d.status === 'connected');
  const connectedWorkSystems = workSystems.filter((s) => s.status === 'connected');

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Your ShepHerd account is ready. Here's a summary of your setup:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left max-w-xl mx-auto">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span>⌚</span> Health Devices
          </h3>
          {connectedHealthDevices.length > 0 ? (
            <ul className="space-y-1">
              {connectedHealthDevices.map((d) => (
                <li key={d.id} className="text-sm text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {d.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No devices connected yet</p>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span>💼</span> Work Systems
          </h3>
          {connectedWorkSystems.length > 0 ? (
            <ul className="space-y-1">
              {connectedWorkSystems.map((s) => (
                <li key={s.id} className="text-sm text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {s.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No systems connected yet</p>
          )}
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-8 max-w-md mx-auto">
        <p className="text-sm text-indigo-700">
          You can always connect more devices or systems later from your Settings page.
        </p>
      </div>

      <div className="flex justify-center gap-4">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <button onClick={onFinish} className="btn btn-primary px-8">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
