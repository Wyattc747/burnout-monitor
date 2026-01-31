'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { ProfilePictureUpload } from '@/components/ProfilePictureUpload';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const { user, isLoading: authLoading, refreshUser } = useRequireAuth();
  const queryClient = useQueryClient();

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your notification preferences</p>
        </div>

        {/* Profile Picture Section */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Profile Picture
          </h2>
          <ProfilePictureUpload
            currentUrl={user?.profilePictureUrl}
            name={user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email?.split('@')[0] || ''}
            onSuccess={() => refreshUser()}
          />
          <p className="mt-2 text-sm text-gray-500">
            JPG, PNG, GIF or WebP. Max 5MB.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Twilio Status (Manager Only) */}
          {isManager && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                SMS Service Status
              </h2>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={clsx(
                    'w-3 h-3 rounded-full',
                    twilioStatus?.configured ? 'bg-green-500' : 'bg-yellow-500'
                  )}
                />
                <span className="text-gray-700">
                  {twilioStatus?.configured
                    ? `Twilio configured (***${twilioStatus.twilioNumber})`
                    : 'Twilio not configured'}
                </span>
              </div>

              {!twilioStatus?.configured && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                  <p className="text-yellow-800 font-medium mb-2">SMS is not enabled</p>
                  <p className="text-yellow-700">
                    To enable SMS notifications, add your Twilio credentials to the backend .env file:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-yellow-700 space-y-1">
                    <li>TWILIO_ACCOUNT_SID</li>
                    <li>TWILIO_AUTH_TOKEN</li>
                    <li>TWILIO_PHONE_NUMBER</li>
                  </ul>
                </div>
              )}

              {twilioStatus?.configured && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Send Test SMS</p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder={phoneNumber || '+1 (555) 123-4567'}
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleTestSMS}
                      disabled={sendTestSMS.isPending || (!testPhone && !phoneNumber)}
                      className="btn btn-secondary"
                    >
                      {sendTestSMS.isPending ? 'Sending...' : 'Send Test'}
                    </button>
                  </div>
                  {testResult && (
                    <p
                      className={clsx(
                        'text-sm mt-2',
                        testResult.success ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SMS Notifications */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              SMS Notifications
            </h2>

            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Enable/Disable */}
                <label className="flex items-center justify-between">
                  <span className="text-gray-700">Enable SMS notifications</span>
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>

                {/* Phone Number */}
                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="input"
                    disabled={!smsEnabled}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include country code (e.g., +1 for US)
                  </p>
                </div>

                {/* Alert Types */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Receive SMS for:
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={onBurnout}
                        onChange={(e) => setOnBurnout(e.target.checked)}
                        disabled={!smsEnabled}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">
                        Burnout alerts (employee enters red zone)
                      </span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={onOpportunity}
                        onChange={(e) => setOnOpportunity(e.target.checked)}
                        disabled={!smsEnabled}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">
                        Opportunity alerts (employee enters green zone)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Account Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="text-gray-900 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={updateConfig.isPending}
              className="btn btn-primary"
            >
              {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-green-600 text-sm">
                Settings saved successfully!
              </span>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
