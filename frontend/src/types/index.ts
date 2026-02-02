// ============================================
// CORE TYPES
// ============================================

export type Zone = 'red' | 'yellow' | 'green';
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'employee';
export type AlertType = 'burnout' | 'opportunity';
export type Impact = 'positive' | 'negative' | 'neutral';

// ============================================
// ORGANIZATION TYPES (B2B)
// ============================================

export type SubscriptionTier = 'trial' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type EmploymentStatus = 'pending' | 'active' | 'on_leave' | 'terminated';
export type HRProvider = 'bamboohr' | 'workday' | 'adp' | 'gusto' | 'rippling';
export type IntegrationStatus = 'pending' | 'connected' | 'error' | 'disconnected';
export type SyncFrequency = 'manual' | 'hourly' | 'daily' | 'weekly';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logoUrl?: string;
  primaryColor?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  maxEmployees: number;
  settings?: Record<string, unknown>;
  industry?: string;
  companySize?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string;
  hierarchyLevel: number;
  hierarchyPath?: string;
  managerEmployeeId?: string;
  managerName?: string;
  isActive: boolean;
  sortOrder: number;
  employeeCount?: number;
  children?: Department[];
  createdAt: string;
  updatedAt: string;
}

export interface HRIntegration {
  id: string;
  organizationId: string;
  provider: HRProvider;
  status: IntegrationStatus;
  syncFrequency: SyncFrequency;
  autoSyncEnabled: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  lastError?: string;
  lastErrorAt?: string;
  consecutiveFailures: number;
  fieldMappings?: Record<string, string>;
  providerSettings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HRSyncLog {
  id: string;
  startedAt: string;
  completedAt?: string;
  syncType: 'manual' | 'scheduled' | 'webhook';
  status: 'running' | 'completed' | 'failed' | 'partial';
  employeesCreated: number;
  employeesUpdated: number;
  employeesDeactivated: number;
  departmentsSynced: number;
  errors?: Array<{ type: string; error: string; email?: string }>;
  summary?: string;
}

export interface EmployeeInvitation {
  id: string;
  organizationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  status: InvitationStatus;
  expiresAt: string;
  invitedBy?: string;
  createdAt: string;
  acceptedAt?: string;
  inviteUrl?: string;
}

export interface OrganizationStats {
  employees: {
    total: number;
    active: number;
    pending: number;
    onLeave: number;
  };
  departments: number;
  pendingInvitations: number;
  zones: {
    red: number;
    yellow: number;
    green: number;
  };
  unacknowledgedAlerts: number;
  activeChallenges: number;
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    maxEmployees: number;
    trialEndsAt?: string;
  };
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// ============================================
// BILLING TYPES
// ============================================

export interface SubscriptionTierInfo {
  id: SubscriptionTier;
  name: string;
  pricePerEmployee?: number;
  maxEmployees: number;
  features: string[];
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  tierInfo: SubscriptionTierInfo;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  maxEmployees: number;
  currentEmployees: number;
  stripeCustomerId?: string;
  subscription?: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    cancelAt?: string;
  };
}

export interface Invoice {
  id: string;
  number?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: string;
  periodStart: string;
  periodEnd: string;
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
}

export interface UsageStats {
  employees: {
    active: number;
    pending: number;
    onLeave: number;
    total: number;
  };
  pendingInvitations: number;
  limits: {
    maxEmployees: number;
    remainingSlots: number;
  };
  tier: SubscriptionTier;
}

// ============================================
// USER & EMPLOYEE TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  profilePictureUrl?: string;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  organizationLogo?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  isDemoAccount?: boolean;
  employee?: Employee;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle: string;
  hireDate?: string;
  zone: Zone;
  burnoutScore: number | null;
  readinessScore: number | null;
  statusDate?: string;
  employmentStatus?: EmploymentStatus;
  reportsToId?: string;
  reportsToName?: string;
  managerId?: string;
  managerName?: string;
  hierarchyLevel?: number;
  hrExternalId?: string;
  onboardingCompleted?: boolean;
  role?: UserRole;
  userId?: string;
}

// ============================================
// HEALTH & WORK METRICS
// ============================================

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
  context?: {
    interactionEffects?: Array<{
      name: string;
      impact?: string;
      description: string;
      severity: string;
    }>;
    daysSinceVacation?: number;
    restDeficit?: boolean;
    vacationAlert?: {
      daysSince: number;
      daysSinceRest: number;
      message: string;
    };
    calibrationInfo?: {
      applied: boolean;
      message: string;
      discrepancy: number;
    };
    activeLifeEvents?: Array<{
      label: string;
      impact: string;
    }>;
    dayContext?: {
      label: string;
      message: string;
    };
    calibration?: {
      personalPreferences: boolean;
      lifeEvents: Array<{
        eventType: string;
        eventLabel: string;
      }>;
    };
  };
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

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

export interface SMSConfig {
  smsEnabled: boolean;
  phoneNumber: string | null;
  onBurnout: boolean;
  onOpportunity: boolean;
}

// ============================================
// AUTHENTICATION
// ============================================

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
    organizationId?: string;
    organizationSlug?: string;
    organizationName?: string;
    isDemoAccount?: boolean;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: SubscriptionTier;
    trialEndsAt?: string;
  };
  employeeId: string | null;
}

export interface RegisterOrganizationData {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  industry?: string;
  companySize?: string;
  subdomain?: string;
}

export interface AcceptInvitationData {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface InvitationDetails {
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  jobTitle?: string;
  organizationName: string;
  organizationLogo?: string;
  departmentName?: string;
  expiresAt: string;
}

// ============================================
// DEMO & MISCELLANEOUS
// ============================================

export interface DemoState {
  isActive: boolean;
  virtualTime: string | null;
}

// ============================================
// PERSONALIZATION TYPES
// ============================================

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
  contextSnapshot: unknown;
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

// ============================================
// GOAL TYPES
// ============================================

export type GoalType = 'sleep_hours' | 'exercise_minutes' | 'green_zone' | 'checkin_streak';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalSuggestion {
  type: GoalType;
  title: string;
  suggestedTarget: number;
  reason: string;
  unit: string;
}

// ============================================
// INTERVENTION AND 1:1 MEETING TYPES
// ============================================

export type InterventionType = 'check_in' | 'workload_adjustment' | 'time_off' | 'resource_referral' | 'recognition' | 'goal_setting' | 'other';
export type OutcomeStatus = 'improved' | 'stable' | 'declined' | 'pending';

export interface ConversationTemplate {
  id: string;
  name: string;
  category: 'wellness_check' | 'performance' | 'recognition' | 'support' | 'general';
  description: string;
  openingQuestions: string[];
  followUpQuestions: string[];
  suggestedActions: string[];
  applicableZones: Zone[];
}

export interface Intervention {
  id: string;
  employeeId: string;
  employeeName: string;
  managerId: string;
  type: InterventionType;
  meetingDate: string;
  notes: string | null;
  templateUsed: string | null;
  actionsTaken: string[];
  followUpDate: string | null;
  zoneBefore: Zone;
  burnoutScoreBefore: number;
  createdAt: string;
  updatedAt: string;
  outcome?: InterventionOutcome;
}

export interface InterventionOutcome {
  id: string;
  interventionId: string;
  status: OutcomeStatus;
  zoneAfter: Zone | null;
  burnoutScoreAfter: number | null;
  notes: string | null;
  daysToImprovement: number | null;
  recordedAt: string;
}

// ============================================
// CHALLENGE TYPES
// ============================================

export type ChallengeType = 'steps' | 'sleep_hours' | 'checkins' | 'green_zone_days';
export type CompetitionType = 'individual' | 'team';

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  challengeType: ChallengeType;
  competitionType: CompetitionType;
  targetValue: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  teamId?: string;
  createdAt: string;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  employeeId: string;
  teamName?: string;
  progress: number;
  joinedAt: string;
}

export interface ChallengeLeaderboard {
  rank: number;
  employeeId: string;
  employeeName: string;
  teamName?: string;
  progress: number;
  percentComplete: number;
}
