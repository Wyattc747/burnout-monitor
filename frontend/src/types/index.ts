export type Zone = 'red' | 'yellow' | 'green';
export type UserRole = 'manager' | 'employee';
export type AlertType = 'burnout' | 'opportunity';
export type Impact = 'positive' | 'negative' | 'neutral';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  profilePictureUrl?: string;
  employee?: Employee;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  jobTitle: string;
  hireDate?: string;
  zone: Zone;
  burnoutScore: number | null;
  readinessScore: number | null;
  statusDate?: string;
}

export interface HealthMetrics {
  date: string;
  restingHeartRate: number | null;
  avgHeartRate: number | null;
  heartRateVariability: number | null;
  sleepHours: number | null;
  sleepQualityScore: number | null;
  deepSleepHours: number | null;
  remSleepHours: number | null;
  coreSleepHours: number | null;
  awakeSleepHours: number | null;
  steps: number | null;
  exerciseMinutes: number | null;
  stressLevel: number | null;
  recoveryScore: number | null;
}

export interface WorkMetrics {
  date: string;
  hoursWorked: number | null;
  overtimeHours: number | null;
  tasksCompleted: number | null;
  tasksAssigned: number | null;
  meetingsAttended: number | null;
  meetingHours: number | null;
  emailsSent: number | null;
  avgResponseTimeMinutes: number | null;
  focusTimeHours: number | null;
}

export interface ZoneStatus {
  zone: Zone;
  burnoutScore: number;
  readinessScore: number;
  date: string;
}

export interface Factor {
  name: string;
  impact: Impact;
  value: string;
  description: string;
  weight: number;
}

export interface Recommendations {
  personal: string[];
  leadership: string[];
}

export interface Explanation {
  zone: Zone;
  burnoutScore: number;
  readinessScore: number;
  factors: Factor[];
  recommendations: Recommendations;
}

export interface Alert {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AlertType;
  zone: Zone;
  title: string;
  message: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  smsSent: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  employeeId: string | null;
}

export interface SMSConfig {
  smsEnabled: boolean;
  phoneNumber: string | null;
  onBurnout: boolean;
  onOpportunity: boolean;
}

export interface DemoState {
  isActive: boolean;
  virtualTime: string | null;
}

// Personalization Types
export type Chronotype = 'early_bird' | 'neutral' | 'night_owl';
export type SocialEnergyType = 'introvert' | 'ambivert' | 'extrovert';
export type SleepFlexibility = 'rigid' | 'moderate' | 'flexible';
export type WorkPattern = 'steady' | 'burst' | 'flexible';
export type Importance = 'low' | 'moderate' | 'high';

export interface FeelingCheckin {
  id: string;
  overallFeeling: number;
  energyLevel: number | null;
  stressLevel: number | null;
  motivationLevel: number | null;
  notes: string | null;
  contextSnapshot: any;
  createdAt: string;
}

export interface CheckinStats {
  averages: {
    feeling: string | null;
    energy: string | null;
    stress: string | null;
    motivation: string | null;
  };
  totalCheckins: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  recentAvg: string | null;
  previousAvg: string | null;
}

export interface PersonalPreferences {
  id?: string;
  idealSleepHours: number;
  sleepFlexibility: SleepFlexibility;
  chronotype: Chronotype;
  idealWorkHours: number;
  preferredWorkPattern: WorkPattern;
  maxMeetingHoursDaily: number;
  socialEnergyType: SocialEnergyType;
  idealExerciseMinutes: number;
  exerciseImportance: Importance;
  weightSleep: number;
  weightExercise: number;
  weightWorkload: number;
  weightMeetings: number;
  weightHeartMetrics: number;
  setupCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LifeEvent {
  id: string;
  eventType: string;
  eventLabel: string;
  startDate: string;
  endDate: string | null;
  sleepAdjustment: number;
  workAdjustment: number;
  exerciseAdjustment: number;
  stressToleranceAdjustment: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LifeEventTemplate {
  id: string;
  eventType: string;
  eventLabel: string;
  description: string;
  defaultSleepAdjustment: number;
  defaultWorkAdjustment: number;
  defaultExerciseAdjustment: number;
  defaultStressToleranceAdjustment: number;
  suggestedDurationDays: number | null;
  icon: string;
  category: string;
}

export interface PersonalizationSummary {
  preferences: {
    idealSleepHours: number;
    chronotype: Chronotype;
    socialEnergyType: SocialEnergyType;
    setupCompleted: boolean;
  } | null;
  activeLifeEvents: {
    id: string;
    eventType: string;
    eventLabel: string;
    startDate: string;
    endDate: string | null;
  }[];
  recentCheckins: {
    overallFeeling: number;
    createdAt: string;
  }[];
  checkinStats: {
    averageFeeling: string | null;
    totalCheckins: number;
  };
  needsSetup: boolean;
}
