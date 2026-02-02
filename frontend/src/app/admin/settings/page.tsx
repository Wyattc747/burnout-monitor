'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAdmin, useAuth } from '@/lib/auth';
import {
  Settings,
  Building2,
  Bell,
  Shield,
  Globe,
  Mail,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

interface OrganizationSettings {
  name: string;
  slug: string;
  logoUrl?: string;
  timezone: string;
  defaultNotifications: {
    emailAlerts: boolean;
    slackIntegration: boolean;
    weeklyReports: boolean;
  };
  privacySettings: {
    anonymizeData: boolean;
    dataRetentionDays: number;
  };
}

type SettingsTab = 'general' | 'notifications' | 'privacy' | 'security';

export default function AdminSettingsPage() {
  const { isLoading: authLoading, user } = useRequireAdmin();
  const { organization, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [anonymizeData, setAnonymizeData] = useState(false);
  const [dataRetention, setDataRetention] = useState(365);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: <Building2 className="w-4 h-4" /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'privacy' as const, label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
    { id: 'security' as const, label: 'Security', icon: <Globe className="w-4 h-4" /> },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save - in production this would call an API
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    setSuccessMessage('Settings saved successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (authLoading) {
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
          <Settings className="w-6 h-6" />
          Organization Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your organization's preferences and configurations
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
          <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  General Settings
                </h2>
              </div>

              {/* Organization Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {organization?.logoUrl ? (
                      <img src={organization.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <button className="btn btn-secondary text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Logo
                    </button>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>
              </div>

              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName || organization?.name || ''}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input max-w-md"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="input max-w-md"
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Notification Settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure how and when your organization receives notifications
                </p>
              </div>

              <div className="space-y-4">
                {/* Email Alerts */}
                <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Email Alerts</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Send email notifications for high-risk alerts
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="toggle"
                  />
                </label>

                {/* Weekly Reports */}
                <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Weekly Reports</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Send weekly wellness summary to admins
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={weeklyReports}
                    onChange={(e) => setWeeklyReports(e.target.checked)}
                    className="toggle"
                  />
                </label>

                {/* Slack Integration */}
                <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 text-gray-400">#</div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Slack Integration</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Coming soon - Connect Slack for real-time alerts
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={slackEnabled}
                    onChange={(e) => setSlackEnabled(e.target.checked)}
                    className="toggle"
                    disabled
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Privacy Settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Control how employee data is handled and stored
                </p>
              </div>

              <div className="space-y-4">
                {/* Anonymize Data */}
                <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Anonymize Manager View</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Hide individual names from managers (show only aggregate data)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={anonymizeData}
                    onChange={(e) => setAnonymizeData(e.target.checked)}
                    className="toggle"
                  />
                </label>

                {/* Data Retention */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Data Retention Period</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        How long to keep historical wellness data
                      </p>
                    </div>
                  </div>
                  <select
                    value={dataRetention}
                    onChange={(e) => setDataRetention(Number(e.target.value))}
                    className="input max-w-xs"
                  >
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>1 year</option>
                    <option value={730}>2 years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Security Settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Configure security options for your organization
                </p>
              </div>

              <div className="space-y-4">
                {/* SSO Configuration */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Single Sign-On (SSO)</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Configure SAML or OAuth SSO for your organization
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                      Enterprise
                    </span>
                  </div>
                  <button className="btn btn-secondary text-sm mt-3" disabled>
                    Configure SSO
                  </button>
                </div>

                {/* 2FA Requirement */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Require 2FA for all users in your organization
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                      Coming Soon
                    </span>
                  </div>
                </div>

                {/* Audit Log */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Audit Log</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        View all administrative actions in your organization
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-secondary text-sm mt-3">
                    View Audit Log
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
