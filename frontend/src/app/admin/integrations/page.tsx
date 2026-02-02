'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAdmin } from '@/lib/auth';
import { hrIntegrationsApi } from '@/lib/api';
import {
  Plug,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  AlertCircle,
  Users,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';

interface HRProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  employeeCount?: number;
}

const HR_PROVIDERS: Omit<HRProvider, 'status' | 'lastSync' | 'employeeCount'>[] = [
  {
    id: 'bamboohr',
    name: 'BambooHR',
    description: 'Sync employee data, departments, and org structure',
    icon: '🎋',
    features: ['Employee sync', 'Department mapping', 'Manager hierarchy'],
  },
  {
    id: 'workday',
    name: 'Workday',
    description: 'Enterprise HR integration with Workday HCM',
    icon: '☀️',
    features: ['Employee sync', 'Department mapping', 'Custom fields'],
  },
  {
    id: 'adp',
    name: 'ADP',
    description: 'Connect with ADP Workforce Now',
    icon: '📊',
    features: ['Employee sync', 'Department mapping', 'Employment status'],
  },
  {
    id: 'gusto',
    name: 'Gusto',
    description: 'Sync with Gusto for small business HR',
    icon: '💚',
    features: ['Employee sync', 'Department mapping', 'Hire dates'],
  },
  {
    id: 'rippling',
    name: 'Rippling',
    description: 'All-in-one HR platform integration',
    icon: '🌊',
    features: ['Employee sync', 'Department mapping', 'Full org chart'],
  },
];

export default function AdminIntegrationsPage() {
  const { isLoading: authLoading } = useRequireAdmin();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch all integrations (connected ones)
  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['hr-integrations'],
    queryFn: hrIntegrationsApi.getAll,
    enabled: !authLoading,
  });

  // Fetch available providers
  const { data: providersData } = useQuery({
    queryKey: ['hr-integrations-providers'],
    queryFn: hrIntegrationsApi.getProviders,
    enabled: !authLoading,
  });

  // Connected integrations are those returned from getAll
  const connectedIntegrations = integrations || [];

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: (data: { provider: string; config: Record<string, string> }) =>
      hrIntegrationsApi.connect(data.provider as any, data.config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-integrations'] });
      setConfiguring(null);
      setConfigForm({});
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to connect integration');
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (provider: string) => hrIntegrationsApi.sync(provider as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-integrations'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to sync integration');
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (provider: string) => hrIntegrationsApi.disconnect(provider as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-integrations'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to disconnect integration');
    },
  });

  const getProviderStatus = (providerId: string): 'connected' | 'disconnected' | 'error' => {
    const connected = connectedIntegrations?.find((i: any) => i.provider === providerId);
    if (!connected) return 'disconnected';
    if (connected.status === 'error') return 'error';
    return 'connected';
  };

  const getConnectedInfo = (providerId: string) => {
    return connectedIntegrations?.find((i: any) => i.provider === providerId);
  };

  const handleConnect = (providerId: string) => {
    setConfiguring(providerId);
    setConfigForm({});
    setError(null);
  };

  const handleSubmitConfig = () => {
    if (!configuring) return;
    connectMutation.mutate({ provider: configuring, config: configForm });
  };

  const getConfigFields = (providerId: string) => {
    switch (providerId) {
      case 'bamboohr':
        return [
          { key: 'subdomain', label: 'BambooHR Subdomain', placeholder: 'yourcompany' },
          { key: 'apiKey', label: 'API Key', placeholder: 'Enter your API key', type: 'password' },
        ];
      case 'workday':
        return [
          { key: 'tenant', label: 'Tenant ID', placeholder: 'your-tenant-id' },
          { key: 'clientId', label: 'Client ID', placeholder: 'Enter client ID' },
          { key: 'clientSecret', label: 'Client Secret', placeholder: 'Enter client secret', type: 'password' },
        ];
      case 'adp':
        return [
          { key: 'clientId', label: 'Client ID', placeholder: 'Enter client ID' },
          { key: 'clientSecret', label: 'Client Secret', placeholder: 'Enter client secret', type: 'password' },
        ];
      case 'gusto':
        return [
          { key: 'accessToken', label: 'Access Token', placeholder: 'Enter access token', type: 'password' },
          { key: 'companyId', label: 'Company ID', placeholder: 'Enter company ID' },
        ];
      case 'rippling':
        return [
          { key: 'apiKey', label: 'API Key', placeholder: 'Enter your API key', type: 'password' },
        ];
      default:
        return [];
    }
  };

  if (authLoading || integrationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plug className="w-6 h-6" />
          HR Integrations
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Connect your HR system to automatically sync employee data
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Connected Integrations */}
      {connectedIntegrations && connectedIntegrations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Connected Integrations
          </h2>
          <div className="space-y-4">
            {connectedIntegrations.map((integration: any) => {
              const provider = HR_PROVIDERS.find((p) => p.id === integration.provider);
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{provider?.icon || '🔌'}</span>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {provider?.name || integration.provider}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {integration.employeeCount || 0} employees synced
                        </span>
                        {integration.lastSyncAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => syncMutation.mutate(integration.provider)}
                      disabled={syncMutation.isPending}
                      className="btn btn-secondary text-sm flex items-center gap-2"
                    >
                      <RefreshCw className={clsx('w-4 h-4', syncMutation.isPending && 'animate-spin')} />
                      Sync Now
                    </button>
                    <button
                      onClick={() => disconnectMutation.mutate(integration.provider)}
                      disabled={disconnectMutation.isPending}
                      className="btn btn-ghost text-sm text-red-600 hover:text-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available HR Systems
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {HR_PROVIDERS.map((provider) => {
            const status = getProviderStatus(provider.id);
            const isConnected = status === 'connected';
            const isConfiguring = configuring === provider.id;

            return (
              <div
                key={provider.id}
                className={clsx(
                  'border rounded-lg p-4 transition-all',
                  isConnected
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {provider.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Connected
                    </span>
                  ) : status === 'error' ? (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                      <XCircle className="w-4 h-4" />
                      Error
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {provider.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {isConfiguring ? (
                  <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {getConfigFields(provider.id).map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {field.label}
                        </label>
                        <input
                          type={field.type || 'text'}
                          placeholder={field.placeholder}
                          value={configForm[field.key] || ''}
                          onChange={(e) =>
                            setConfigForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="input text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSubmitConfig}
                        disabled={connectMutation.isPending}
                        className="btn btn-primary text-sm flex-1"
                      >
                        {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => {
                          setConfiguring(null);
                          setConfigForm({});
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  !isConnected && (
                    <button
                      onClick={() => handleConnect(provider.id)}
                      className="btn btn-secondary text-sm w-full flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Configure
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          Need help setting up an integration?
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
          Each HR system requires specific credentials. Check your HR platform's admin settings to find API keys or create OAuth applications.
        </p>
        <a
          href="#"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          View integration documentation
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
