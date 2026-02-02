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
  Goal,
  GoalType,
  GoalSuggestion,
  ConversationTemplate,
  Intervention,
  InterventionOutcome,
  InterventionType,
  OutcomeStatus,
  Zone,
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

// Custom error class for API errors
export class ApiError extends Error {
  status: number;
  code: string;
  data: unknown;

  constructor(message: string, status: number, code: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Handle API error responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message || error.message || 'An unexpected error occurred';

    // Log errors for debugging (except 401 which is expected during logout/session expiry)
    if (status !== 401) {
      console.error(`API Error [${status}]:`, message, data);
    }

    switch (status) {
      case 401:
        // Unauthorized - clear auth and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('employeeId');
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        break;

      case 403:
        // Forbidden - user doesn't have permission
        console.error('Access forbidden:', message);
        break;

      case 404:
        // Not found - resource doesn't exist
        console.error('Resource not found:', message);
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - log and let UI handle display
        console.error('Server error:', message);
        break;

      default:
        // Network errors or other issues
        if (error.code === 'ERR_NETWORK') {
          console.error('Network error - unable to connect to server');
        }
        break;
    }

    // Create a more informative error object
    const apiError = new ApiError(
      message,
      status || 0,
      error.code || 'UNKNOWN_ERROR',
      data
    );

    return Promise.reject(apiError);
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

// Chat API
export const chatApi = {
  sendMessage: async (message: string, conversationHistory: { type: string; content: string }[] = []): Promise<{
    response: string;
    zone: string;
    fallback?: boolean;
    action?: {
      type: string;
      result: Record<string, unknown>;
    };
  }> => {
    const { data } = await api.post('/chat', { message, conversationHistory });
    return data;
  },
};

// Team Challenges API
export type ChallengeType = 'steps' | 'sleep' | 'exercise' | 'checkins' | 'green_zone';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  createdBy: string;
  creatorName: string;
  participantCount: number;
  isParticipating: boolean;
  userProgress?: number;
  userRank?: number;
  createdAt: string;
}

export interface ChallengeParticipant {
  id: string;
  name: string;
  progress: number;
  rank: number;
  joinedAt: string;
}

export interface ChallengeLeaderboard {
  challenge: Challenge;
  participants: ChallengeParticipant[];
  totalParticipants: number;
}

export const challengesApi = {
  // Get all challenges (optionally filter by status)
  getAll: async (status?: ChallengeStatus): Promise<Challenge[]> => {
    const { data } = await api.get('/challenges', { params: { status } });
    return data;
  },

  // Get a specific challenge with leaderboard
  getById: async (id: string): Promise<ChallengeLeaderboard> => {
    const { data } = await api.get(`/challenges/${id}`);
    return data;
  },

  // Create a new challenge (managers only)
  create: async (challenge: {
    name: string;
    description?: string;
    type: ChallengeType;
    targetValue: number;
    unit: string;
    startDate: string;
    endDate: string;
  }): Promise<Challenge> => {
    const { data } = await api.post('/challenges', challenge);
    return data;
  },

  // Join a challenge
  join: async (id: string): Promise<{ message: string; challenge: Challenge }> => {
    const { data } = await api.post(`/challenges/${id}/join`);
    return data;
  },

  // Leave a challenge
  leave: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/challenges/${id}/leave`);
    return data;
  },

  // Update progress (usually done automatically, but can be manual)
  updateProgress: async (id: string, progress: number): Promise<{ progress: number }> => {
    const { data } = await api.put(`/challenges/${id}/progress`, { progress });
    return data;
  },

  // Delete a challenge (creator/manager only)
  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/challenges/${id}`);
    return data;
  },

  // Get leaderboard for a challenge
  getLeaderboard: async (id: string, limit = 10): Promise<ChallengeParticipant[]> => {
    const { data } = await api.get(`/challenges/${id}/leaderboard`, { params: { limit } });
    return data;
  },
};

// Goals API
export const goalsApi = {
  getAll: async (): Promise<Goal[]> => {
    const { data } = await api.get('/goals');
    return data;
  },

  create: async (goal: {
    type: GoalType;
    title: string;
    description?: string;
    targetValue: number;
    unit: string;
    endDate?: string;
  }): Promise<Goal> => {
    const { data } = await api.post('/goals', goal);
    return data;
  },

  update: async (id: string, updates: {
    title?: string;
    description?: string;
    targetValue?: number;
    currentValue?: number;
    endDate?: string;
    isActive?: boolean;
  }): Promise<Goal> => {
    const { data } = await api.put(`/goals/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/goals/${id}`);
  },

  getSuggestions: async (): Promise<GoalSuggestion[]> => {
    const { data } = await api.get('/goals/suggestions');
    return data;
  },
};

// Interventions API (for 1:1 meeting tracking)
export const interventionsApi = {
  // Get conversation templates
  getTemplates: async (zone?: Zone): Promise<ConversationTemplate[]> => {
    const { data } = await api.get('/interventions/templates', { params: { zone } });
    return data;
  },

  // Get all interventions for the manager's team
  getAll: async (params?: {
    employeeId?: string;
    limit?: number;
    includeOutcomes?: boolean;
  }): Promise<Intervention[]> => {
    const { data } = await api.get('/interventions', { params });
    return data;
  },

  // Get a specific intervention
  getById: async (id: string): Promise<Intervention> => {
    const { data } = await api.get(`/interventions/${id}`);
    return data;
  },

  // Create a new intervention (log a 1:1 meeting)
  create: async (intervention: {
    employeeId: string;
    type: InterventionType;
    meetingDate: string;
    notes?: string;
    templateUsed?: string;
    actionsTaken?: string[];
    followUpDate?: string;
  }): Promise<Intervention> => {
    const { data } = await api.post('/interventions', intervention);
    return data;
  },

  // Update an intervention
  update: async (
    id: string,
    updates: {
      notes?: string;
      actionsTaken?: string[];
      followUpDate?: string;
    }
  ): Promise<Intervention> => {
    const { data } = await api.put(`/interventions/${id}`, updates);
    return data;
  },

  // Record an outcome for an intervention
  recordOutcome: async (
    interventionId: string,
    outcome: {
      status: OutcomeStatus;
      notes?: string;
    }
  ): Promise<InterventionOutcome> => {
    const { data } = await api.post(`/interventions/${interventionId}/outcome`, outcome);
    return data;
  },

  // Get intervention history for a specific employee
  getEmployeeHistory: async (employeeId: string): Promise<{
    interventions: Intervention[];
    improvementRate: number;
    avgDaysToImprovement: number | null;
  }> => {
    const { data } = await api.get(`/interventions/employee/${employeeId}/history`);
    return data;
  },

  // Get team intervention statistics
  getTeamStats: async (): Promise<{
    totalInterventions: number;
    improvementRate: number;
    avgDaysToImprovement: number | null;
    byType: Record<InterventionType, number>;
    recentInterventions: Intervention[];
  }> => {
    const { data } = await api.get('/interventions/stats');
    return data;
  },
};

export default api;
