import axios from 'axios';
import type {
  AuthResponse,
  LoginCredentials,
  Employee,
  HealthMetrics,
  WorkMetrics,
  ZoneStatus,
  Explanation,
  Alert,
  SMSConfig,
  DemoState,
  FeelingCheckin,
  CheckinStats,
  PersonalPreferences,
  LifeEvent,
  LifeEventTemplate,
  PersonalizationSummary,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
  },

  register: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department?: string;
    jobTitle?: string;
  }): Promise<AuthResponse & { message: string }> => {
    const { data } = await api.post('/auth/register', userData);
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  refresh: async (): Promise<{ token: string }> => {
    const { data } = await api.post('/auth/refresh');
    return data;
  },
};

// Employees
export const employeesApi = {
  getAll: async (): Promise<Employee[]> => {
    const { data } = await api.get('/employees');
    return data;
  },

  getById: async (id: string): Promise<Employee> => {
    const { data } = await api.get(`/employees/${id}`);
    return data;
  },

  getHealth: async (id: string, limit = 30): Promise<HealthMetrics[]> => {
    const { data } = await api.get(`/employees/${id}/health`, { params: { limit } });
    return data;
  },

  getWork: async (id: string, limit = 30): Promise<WorkMetrics[]> => {
    const { data } = await api.get(`/employees/${id}/work`, { params: { limit } });
    return data;
  },

  getBurnout: async (id: string, limit = 30): Promise<{ current: ZoneStatus | null; history: ZoneStatus[] }> => {
    const { data } = await api.get(`/employees/${id}/burnout`, { params: { limit } });
    return data;
  },

  getReadiness: async (id: string, limit = 30): Promise<{ current: ZoneStatus | null; history: ZoneStatus[] }> => {
    const { data } = await api.get(`/employees/${id}/readiness`, { params: { limit } });
    return data;
  },

  getExplanation: async (id: string): Promise<Explanation> => {
    const { data } = await api.get(`/employees/${id}/explanation`);
    return data;
  },

  getPrediction: async (id: string) => {
    const { data } = await api.get(`/employees/${id}/prediction`);
    return data;
  },

  getRecommendedResources: async (id: string) => {
    const { data } = await api.get(`/employees/${id}/recommended-resources`);
    return data;
  },
};

// Alerts
export const alertsApi = {
  getAll: async (params?: { acknowledged?: boolean; type?: string; limit?: number }): Promise<Alert[]> => {
    const { data } = await api.get('/alerts', { params });
    return data;
  },

  acknowledge: async (id: string): Promise<Alert> => {
    const { data } = await api.put(`/alerts/${id}/acknowledge`);
    return data;
  },
};

// Notifications
export const notificationsApi = {
  getSMSConfig: async (): Promise<SMSConfig> => {
    const { data } = await api.get('/notifications/sms/config');
    return data;
  },

  updateSMSConfig: async (config: Partial<SMSConfig>): Promise<SMSConfig> => {
    const { data } = await api.post('/notifications/sms/config', config);
    return data;
  },

  getSMSLogs: async (limit = 50) => {
    const { data } = await api.get('/notifications/sms/logs', { params: { limit } });
    return data;
  },

  getSMSStatus: async (): Promise<{ configured: boolean; twilioNumber: string | null }> => {
    const { data } = await api.get('/notifications/sms/status');
    return data;
  },

  sendTestSMS: async (phoneNumber: string): Promise<{ success: boolean; message: string; sid?: string }> => {
    const { data } = await api.post('/notifications/sms/test', { phoneNumber });
    return data;
  },
};

// Demo
export const demoApi = {
  getState: async (): Promise<DemoState> => {
    const { data } = await api.get('/demo/state');
    return data;
  },

  triggerAlert: async (employeeId: string, targetZone: 'red' | 'green'): Promise<Alert> => {
    const { data } = await api.post('/demo/trigger-alert', { employeeId, targetZone });
    return data;
  },

  advanceTime: async (days: number): Promise<{ virtualTime: string; alertsGenerated: number }> => {
    const { data } = await api.post('/demo/advance-time', { days });
    return data;
  },

  reset: async (): Promise<{ message: string; employeesReset: number }> => {
    const { data } = await api.post('/demo/reset');
    return data;
  },
};

// Integrations
export const integrationsApi = {
  // Get all integration statuses
  getStatus: async () => {
    const { data } = await api.get('/integrations/status');
    return data;
  },

  // Salesforce
  getSalesforceAuthUrl: async (): Promise<{ url: string }> => {
    const { data } = await api.get('/integrations/salesforce/auth');
    return data;
  },

  disconnectSalesforce: async () => {
    const { data } = await api.delete('/integrations/salesforce');
    return data;
  },

  syncSalesforce: async (startDate?: string, endDate?: string) => {
    const { data } = await api.get('/integrations/salesforce/sync', {
      params: { startDate, endDate },
    });
    return data;
  },

  // Terra (Health Devices)
  getTerraWidgetSession: async (providers?: string[]): Promise<{ sessionId: string; url: string }> => {
    const { data } = await api.post('/integrations/terra/widget', { providers });
    return data;
  },

  getTerraConnections: async () => {
    const { data } = await api.get('/integrations/terra/connections');
    return data;
  },

  disconnectTerraProvider: async (provider: string) => {
    const { data } = await api.delete(`/integrations/terra/${provider}`);
    return data;
  },

  // Google Calendar
  getGoogleAuthUrl: async (): Promise<{ url: string }> => {
    const { data } = await api.get('/integrations/google/auth');
    return data;
  },

  disconnectGoogle: async () => {
    const { data } = await api.delete('/integrations/google');
    return data;
  },

  getGoogleEvents: async (days = 30) => {
    const { data } = await api.get('/integrations/google/events', { params: { days } });
    return data;
  },

  getGoogleUpcoming: async (limit = 10) => {
    const { data } = await api.get('/integrations/google/upcoming', { params: { limit } });
    return data;
  },
};

// Profile
export const profileApi = {
  get: async () => {
    const { data } = await api.get('/profile');
    return data;
  },

  uploadAvatar: async (file: File): Promise<{ profilePictureUrl: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  removeAvatar: async (): Promise<{ message: string }> => {
    const { data } = await api.delete('/profile/avatar');
    return data;
  },
};

// Personalization
export const personalizationApi = {
  // Check-ins
  getCheckins: async (limit = 30): Promise<FeelingCheckin[]> => {
    const { data } = await api.get('/personalization/checkins', { params: { limit } });
    return data;
  },

  createCheckin: async (checkin: {
    overallFeeling: number;
    energyLevel?: number;
    stressLevel?: number;
    motivationLevel?: number;
    notes?: string;
  }): Promise<FeelingCheckin> => {
    const { data } = await api.post('/personalization/checkins', checkin);
    return data;
  },

  getCheckinStats: async (): Promise<CheckinStats> => {
    const { data } = await api.get('/personalization/checkins/stats');
    return data;
  },

  // Preferences
  getPreferences: async (): Promise<PersonalPreferences> => {
    const { data } = await api.get('/personalization/preferences');
    return data;
  },

  updatePreferences: async (preferences: Partial<PersonalPreferences>): Promise<PersonalPreferences> => {
    const { data } = await api.put('/personalization/preferences', preferences);
    return data;
  },

  // Life Events
  getLifeEvents: async (activeOnly = true): Promise<LifeEvent[]> => {
    const { data } = await api.get('/personalization/life-events', { params: { activeOnly } });
    return data;
  },

  createLifeEvent: async (event: {
    eventType: string;
    eventLabel: string;
    startDate: string;
    endDate?: string;
    sleepAdjustment?: number;
    workAdjustment?: number;
    exerciseAdjustment?: number;
    stressToleranceAdjustment?: number;
    notes?: string;
  }): Promise<LifeEvent> => {
    const { data } = await api.post('/personalization/life-events', event);
    return data;
  },

  updateLifeEvent: async (id: string, updates: {
    endDate?: string;
    isActive?: boolean;
    notes?: string;
  }): Promise<LifeEvent> => {
    const { data } = await api.put(`/personalization/life-events/${id}`, updates);
    return data;
  },

  deleteLifeEvent: async (id: string): Promise<void> => {
    await api.delete(`/personalization/life-events/${id}`);
  },

  // Templates
  getLifeEventTemplates: async (): Promise<LifeEventTemplate[]> => {
    const { data } = await api.get('/personalization/life-event-templates');
    return data;
  },

  // Summary
  getSummary: async (): Promise<PersonalizationSummary> => {
    const { data } = await api.get('/personalization/summary');
    return data;
  },
};

// Teams API (for managers)
export const teamsApi = {
  // Get team members
  getMembers: async () => {
    const { data } = await api.get('/teams/members');
    return data;
  },

  // Get available employees (not on any team)
  getAvailable: async () => {
    const { data } = await api.get('/teams/available');
    return data;
  },

  // Add member to team
  addMember: async (employeeId: string) => {
    const { data } = await api.post(`/teams/members/${employeeId}`);
    return data;
  },

  // Remove member from team
  removeMember: async (employeeId: string) => {
    const { data } = await api.delete(`/teams/members/${employeeId}`);
    return data;
  },

  // Get team aggregates (anonymous wellness data)
  getAggregates: async () => {
    const { data } = await api.get('/teams/aggregates');
    return data;
  },

  // Get team heatmap data
  getHeatmap: async (days = 14) => {
    const { data } = await api.get('/teams/heatmap', { params: { days } });
    return data;
  },

  // Get 1:1 meeting suggestions
  getMeetingSuggestions: async () => {
    const { data } = await api.get('/teams/meeting-suggestions');
    return data;
  },

  // Invitations
  getInvitations: async () => {
    const { data } = await api.get('/teams/invitations');
    return data;
  },

  sendInvitation: async (email: string) => {
    const { data } = await api.post('/teams/invitations', { email });
    return data;
  },

  cancelInvitation: async (id: string) => {
    const { data } = await api.delete(`/teams/invitations/${id}`);
    return data;
  },
};

// Wellness API
export const wellnessApi = {
  // Resources
  getResources: async (params?: { category?: string; contentType?: string; difficulty?: string }) => {
    const { data } = await api.get('/wellness/resources', { params });
    return data;
  },

  getResource: async (id: string) => {
    const { data } = await api.get(`/wellness/resources/${id}`);
    return data;
  },

  // Streaks
  getStreaks: async () => {
    const { data } = await api.get('/wellness/streaks');
    return data;
  },

  updateStreaks: async () => {
    const { data } = await api.post('/wellness/streaks/update');
    return data;
  },

  // Reminders
  getReminders: async () => {
    const { data } = await api.get('/wellness/reminders');
    return data;
  },

  updateReminders: async (settings: {
    checkinReminder?: { enabled?: boolean; time?: string; days?: number[] };
    weeklySummary?: { enabled?: boolean; day?: number; time?: string };
    push?: { enabled?: boolean; subscription?: object };
    emailEnabled?: boolean;
  }) => {
    const { data } = await api.put('/wellness/reminders', settings);
    return data;
  },

  // Patterns
  getPatterns: async () => {
    const { data } = await api.get('/wellness/patterns');
    return data;
  },

  acknowledgePattern: async (id: string) => {
    const { data } = await api.post(`/wellness/patterns/${id}/acknowledge`);
    return data;
  },

  dismissPattern: async (id: string) => {
    const { data } = await api.post(`/wellness/patterns/${id}/dismiss`);
    return data;
  },

  // Predictive Alerts
  getPredictiveAlerts: async () => {
    const { data } = await api.get('/wellness/alerts');
    return data;
  },

  acknowledgePredictiveAlert: async (id: string) => {
    const { data } = await api.post(`/wellness/alerts/${id}/acknowledge`);
    return data;
  },

  // Privacy
  getPrivacy: async () => {
    const { data } = await api.get('/wellness/privacy');
    return data;
  },

  updatePrivacy: async (settings: {
    showHealthToManager?: boolean;
    showSleepToManager?: boolean;
    showHeartToManager?: boolean;
    showExerciseToManager?: boolean;
    showWorkToManager?: boolean;
    showEmailToManager?: boolean;
    showCalendarToManager?: boolean;
    managerViewLevel?: 'full' | 'summary' | 'zone_only';
    retainDetailedDataDays?: number;
  }) => {
    const { data } = await api.put('/wellness/privacy', settings);
    return data;
  },

  // Export
  exportData: async () => {
    const { data } = await api.get('/wellness/export');
    return data;
  },
};

// Email Metrics API
export const emailMetricsApi = {
  getMetrics: async (days = 14) => {
    const { data } = await api.get('/integrations/gmail/metrics', { params: { days } });
    return data;
  },
};

export default api;
