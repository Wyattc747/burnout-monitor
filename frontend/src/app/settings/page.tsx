'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { ProfilePictureUpload } from '@/components/ProfilePictureUpload';
import { PrivacySettings } from '@/components/PrivacySettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { DataExport } from '@/components/DataExport';
import { DeviceConnection } from '@/components/DeviceConnection';
import { DeleteAccount } from '@/components/DeleteAccount';
import { clsx } from 'clsx';

type SettingsTab = 'profile' | 'notifications' | 'privacy' | 'integrations' | 'data';

export default function SettingsPage() {
  const { user, isLoading: authLoading, refreshUser } = useRequireAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [onBurnout, setOnBurnout] = useState(true);
  const [onOpportunity, setOnOpportunity] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['smsConfig'],
    queryFn: notificationsApi.getSMSConfig,
    enabled: !authLoading,
  });

  const { data: twilioStatus } = useQuery({
    queryKey: ['twilioStatus'],
    queryFn: notificationsApi.getSMSStatus,
    enabled: !authLoading && user?.role === 'manager',
  });

  const { data: integrationStatus } = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/integrations/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !authLoading,
  });

  useEffect(() => {
    if (config) {
      setSmsEnabled(config.smsEnabled);
      setPhoneNumber(config.phoneNumber || '');
      setOnBurnout(config.onBurnout);
      setOnOpportunity(config.onOpportunity);
    }
  }, [config]);

  const updateConfig = useMutation({
    mutationFn: notificationsApi.updateSMSConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsConfig'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const sendTestSMS = useMutation({
    mutationFn: notificationsApi.sendTestSMS,
    onSuccess: (data) => {
      setTestResult({ success: true, message: data.message });
      setTimeout(() => setTestResult(null), 5000);
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Failed to send test SMS',
      });
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig.mutate({
      smsEnabled,
      phoneNumber: phoneNumber || null,
      onBurnout,
      onOpportunity,
    });
  };

  const handleTestSMS = () => {
    const phone = testPhone || phoneNumber;
    if (phone) {
      sendTestSMS.mutate(phone);
    }
  };

  const connectIntegration = async (provider: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3001/api/integrations/${provider}/auth`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const isManager = user?.role === 'manager';

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'data', label: 'Data', icon: '📊' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Profile Picture Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Profile Picture
              </h2>
              <ProfilePictureUpload
                currentUrl={user?.profilePictureUrl}
                name={user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email?.split('@')[0] || ''}
                onSuccess={() => refreshUser()}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                JPG, PNG, GIF or WebP. Max 5MB.
              </p>
            </div>

            {/* Account Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Account Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-gray-900 dark:text-white">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Role</p>
                  <p className="text-gray-900 dark:text-white capitalize">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <ReminderSettings />

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Twilio Status (Manager Only) */}
              {isManager && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    SMS Service Status
                  </h2>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={clsx(
                        'w-3 h-3 rounded-full',
                        twilioStatus?.configured ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {twilioStatus?.configured
                        ? `Twilio configured (***${twilioStatus.twilioNumber})`
                        : 'Twilio not configured'}
                    </span>
                  </div>

                  {!twilioStatus?.configured && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
                      <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">SMS is not enabled</p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        To enable SMS notifications, add your Twilio credentials to the backend .env file.
                      </p>
                    </div>
                  )}

                  {twilioStatus?.configured && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Send Test SMS</p>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder={phoneNumber || '+1 (555) 123-4567'}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleTestSMS}
                          disabled={sendTestSMS.isPending || (!testPhone && !phoneNumber)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                        >
                          {sendTestSMS.isPending ? 'Sending...' : 'Send Test'}
                        </button>
                      </div>
                      {testResult && (
                        <p className={clsx('text-sm mt-2', testResult.success ? 'text-green-600' : 'text-red-600')}>
                          {testResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SMS Notifications */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  SMS Notifications
                </h2>

                {isLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Enable SMS notifications</span>
                      <input
                        type="checkbox"
                        checked={smsEnabled}
                        onChange={(e) => setSmsEnabled(e.target.checked)}
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                    </label>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        disabled={!smsEnabled}
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Receive SMS for:</p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={onBurnout}
                            onChange={(e) => setOnBurnout(e.target.checked)}
                            disabled={!smsEnabled}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Burnout alerts</span>
                        </label>
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={onOpportunity}
                            onChange={(e) => setOnOpportunity(e.target.checked)}
                            disabled={!smsEnabled}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Opportunity alerts</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={updateConfig.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                {saved && <span className="text-green-600 text-sm">Settings saved!</span>}
              </div>
            </form>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <PrivacySettings />
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <DeviceConnection />

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Connected Services</h2>

              <div className="space-y-4">
                {/* Google Calendar */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Google Calendar</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {integrationStatus?.googleCalendar?.connected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => connectIntegration('google')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium',
                      integrationStatus?.googleCalendar?.connected
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    )}
                  >
                    {integrationStatus?.googleCalendar?.connected ? 'Reconnect' : 'Connect'}
                  </button>
                </div>

                {/* Gmail */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Gmail</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {integrationStatus?.gmail?.connected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => connectIntegration('gmail')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium',
                      integrationStatus?.gmail?.connected
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    )}
                  >
                    {integrationStatus?.gmail?.connected ? 'Reconnect' : 'Connect'}
                  </button>
                </div>

                {/* Slack */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 15a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2h2v2zm1 0a2 2 0 012-2 2 2 0 012 2v5a2 2 0 01-2 2 2 2 0 01-2-2v-5zm2-8a2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2v2H9zm0 1a2 2 0 012 2 2 2 0 01-2 2H4a2 2 0 01-2-2 2 2 0 012-2h5zm8 2a2 2 0 012-2 2 2 0 012 2 2 2 0 01-2 2h-2v-2zm-1 0a2 2 0 01-2 2 2 2 0 01-2-2V5a2 2 0 012-2 2 2 0 012 2v5zm-2 8a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2v-2h2zm0-1a2 2 0 01-2-2 2 2 0 012-2h5a2 2 0 012 2 2 2 0 01-2 2h-5z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Slack</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Not connected</p>
                    </div>
                  </div>
                  <button
                    onClick={() => connectIntegration('slack')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    Connect
                  </button>
                </div>

                {/* Jira */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.36 4.36 0 004.34 4.34h1.8v1.72a4.36 4.36 0 004.34 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.72c.01 2.39 1.95 4.33 4.34 4.33v-9.56a.84.84 0 00-.84-.84H2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Jira</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Not connected</p>
                    </div>
                  </div>
                  <button
                    onClick={() => connectIntegration('jira')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <DataExport />
            <DeleteAccount />
          </div>
        )}
      </main>
    </div>
  );
}
