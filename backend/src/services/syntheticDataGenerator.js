/**
 * Synthetic Data Generator
 * Creates realistic health and work metrics for 5 demo employees
 */

const { v4: uuidv4 } = require('uuid');

// Employee profiles with different wellness patterns
const EMPLOYEE_PROFILES = {
  peakPerformer: {
    id: uuidv4(),
    firstName: 'Wyatt',
    lastName: 'Cooper',
    email: 'wyatt@demo.com',
    department: 'Engineering',
    jobTitle: 'Senior Developer',
    description: 'Consistently well-rested with good work-life balance',
    health: {
      restingHeartRate: { mean: 58, stdDev: 3 },
      heartRateVariability: { mean: 55, stdDev: 5 },
      sleepHours: { mean: 7.8, stdDev: 0.3 },
      sleepQualityScore: { mean: 85, stdDev: 5 },
      deepSleepHours: { mean: 1.6, stdDev: 0.2 },
      remSleepHours: { mean: 1.8, stdDev: 0.2 },
      steps: { mean: 9000, stdDev: 1500 },
      exerciseMinutes: { mean: 45, stdDev: 15 },
    },
    work: {
      hoursWorked: { mean: 7.5, stdDev: 0.5 },
      overtimeHours: { mean: 0, stdDev: 0.2 },
      tasksCompleted: { mean: 8, stdDev: 2 },
      tasksAssigned: { mean: 7, stdDev: 1 },
      meetingsAttended: { mean: 3, stdDev: 1 },
      emailsSent: { mean: 15, stdDev: 5 },
    },
    expectedZone: 'green',
  },

  moderateStress: {
    id: uuidv4(),
    firstName: 'Woody',
    lastName: 'Klemetson',
    email: 'woody@demo.com',
    department: 'Product',
    jobTitle: 'Product Manager',
    description: 'Moderate stress with irregular patterns',
    health: {
      restingHeartRate: { mean: 68, stdDev: 5 },
      heartRateVariability: { mean: 42, stdDev: 8 },
      sleepHours: { mean: 6.5, stdDev: 0.7 },
      sleepQualityScore: { mean: 65, stdDev: 10 },
      deepSleepHours: { mean: 1.2, stdDev: 0.3 },
      remSleepHours: { mean: 1.4, stdDev: 0.3 },
      steps: { mean: 6000, stdDev: 2000 },
      exerciseMinutes: { mean: 20, stdDev: 15 },
    },
    work: {
      hoursWorked: { mean: 8.5, stdDev: 1 },
      overtimeHours: { mean: 0.5, stdDev: 0.5 },
      tasksCompleted: { mean: 6, stdDev: 2 },
      tasksAssigned: { mean: 7, stdDev: 2 },
      meetingsAttended: { mean: 5, stdDev: 2 },
      emailsSent: { mean: 25, stdDev: 10 },
    },
    expectedZone: 'yellow',
  },

  highBurnout: {
    id: uuidv4(),
    firstName: 'Robert',
    lastName: 'Henderson',
    email: 'robert@demo.com',
    department: 'Engineering',
    jobTitle: 'Tech Lead',
    description: 'High burnout risk with declining metrics',
    health: {
      restingHeartRate: { mean: 75, stdDev: 5 },
      heartRateVariability: { mean: 32, stdDev: 6 },
      sleepHours: { mean: 5.5, stdDev: 0.8 },
      sleepQualityScore: { mean: 50, stdDev: 15 },
      deepSleepHours: { mean: 0.8, stdDev: 0.3 },
      remSleepHours: { mean: 1.0, stdDev: 0.3 },
      steps: { mean: 4000, stdDev: 1500 },
      exerciseMinutes: { mean: 10, stdDev: 10 },
    },
    work: {
      hoursWorked: { mean: 10.5, stdDev: 1.5 },
      overtimeHours: { mean: 2.5, stdDev: 1 },
      tasksCompleted: { mean: 5, stdDev: 2 },
      tasksAssigned: { mean: 10, stdDev: 2 },
      meetingsAttended: { mean: 7, stdDev: 2 },
      emailsSent: { mean: 40, stdDev: 15 },
    },
    expectedZone: 'red',
  },

  recovery: {
    id: uuidv4(),
    firstName: 'Ben',
    lastName: 'Harrison',
    email: 'ben@demo.com',
    department: 'Design',
    jobTitle: 'UX Designer',
    description: 'Recovering from burnout, improving over time',
    // This profile uses trajectory-based generation
    trajectory: 'improving',
    startProfile: 'highBurnout',
    endProfile: 'peakPerformer',
    transitionDays: 21,
    expectedZone: 'yellow', // Currently in recovery
  },

  variable: {
    id: uuidv4(),
    firstName: 'Andrew',
    lastName: 'Brown',
    email: 'andrew@demo.com',
    department: 'Sales',
    jobTitle: 'Account Executive',
    description: 'Erratic patterns, fluctuates between states',
    // This profile oscillates between different states
    pattern: ['moderateStress', 'peakPerformer', 'moderateStress', 'highBurnout'],
    cycleDays: 7,
    expectedZone: 'variable',
  },
};

/**
 * Generate a random value from a normal distribution
 */
function randomNormal(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate health metrics for a single day based on profile
 */
function generateHealthMetrics(profile, dayOffset = 0) {
  const h = profile.health;

  // Add some day-of-week variation (weekends slightly better)
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const weekendBonus = isWeekend ? 0.1 : 0;

  // Calculate sleep stage breakdown
  const totalSleep = Math.round(clamp(randomNormal(h.sleepHours.mean * (1 + weekendBonus), h.sleepHours.stdDev), 3, 12) * 10) / 10;
  const deepSleep = Math.round(clamp(randomNormal(h.deepSleepHours.mean, h.deepSleepHours.stdDev), 0.3, 3) * 10) / 10;
  const remSleep = Math.round(clamp(randomNormal(h.remSleepHours.mean, h.remSleepHours.stdDev), 0.3, 3) * 10) / 10;
  const awakeSleep = Math.round(clamp(randomNormal(0.3, 0.15), 0.1, 1) * 10) / 10; // Typical awake time during night
  // Core sleep is the remainder
  const coreSleep = Math.round(Math.max(0, totalSleep - deepSleep - remSleep - awakeSleep) * 10) / 10;

  return {
    date: date.toISOString().split('T')[0],
    restingHeartRate: Math.round(clamp(randomNormal(h.restingHeartRate.mean, h.restingHeartRate.stdDev), 45, 100)),
    avgHeartRate: Math.round(clamp(randomNormal(h.restingHeartRate.mean + 15, 5), 55, 120)),
    maxHeartRate: Math.round(clamp(randomNormal(h.restingHeartRate.mean + 80, 20), 100, 180)),
    heartRateVariability: Math.round(clamp(randomNormal(h.heartRateVariability.mean, h.heartRateVariability.stdDev), 15, 80) * 10) / 10,
    sleepHours: totalSleep,
    sleepQualityScore: Math.round(clamp(randomNormal(h.sleepQualityScore.mean * (1 + weekendBonus * 0.5), h.sleepQualityScore.stdDev), 20, 100)),
    deepSleepHours: deepSleep,
    remSleepHours: remSleep,
    coreSleepHours: coreSleep,
    awakeSleepHours: awakeSleep,
    steps: Math.round(clamp(randomNormal(h.steps.mean * (isWeekend ? 1.2 : 1), h.steps.stdDev), 1000, 20000)),
    activeCalories: Math.round(clamp(randomNormal(h.steps.mean * 0.05, 50), 100, 1000)),
    exerciseMinutes: Math.round(clamp(randomNormal(h.exerciseMinutes.mean * (isWeekend ? 1.3 : 1), h.exerciseMinutes.stdDev), 0, 120)),
    standingHours: Math.round(clamp(randomNormal(isWeekend ? 6 : 10, 2), 2, 16)),
    stressLevel: null, // Calculated from other metrics
    recoveryScore: null, // Calculated from other metrics
  };
}

/**
 * Generate work metrics for a single day based on profile
 */
function generateWorkMetrics(profile, dayOffset = 0) {
  const w = profile.work;

  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Much less work on weekends
  const weekendMultiplier = isWeekend ? 0.2 : 1;

  return {
    date: date.toISOString().split('T')[0],
    hoursWorked: Math.round(clamp(randomNormal(w.hoursWorked.mean * weekendMultiplier, w.hoursWorked.stdDev), 0, 16) * 10) / 10,
    overtimeHours: Math.round(clamp(randomNormal(w.overtimeHours.mean * weekendMultiplier, w.overtimeHours.stdDev), 0, 6) * 10) / 10,
    breakMinutes: Math.round(clamp(randomNormal(45, 15), 0, 120)),
    firstLoginTime: isWeekend ? null : '09:00',
    lastLogoutTime: isWeekend ? null : '17:30',
    tasksCompleted: Math.round(clamp(randomNormal(w.tasksCompleted.mean * weekendMultiplier, w.tasksCompleted.stdDev), 0, 20)),
    tasksAssigned: Math.round(clamp(randomNormal(w.tasksAssigned.mean * weekendMultiplier, w.tasksAssigned.stdDev), 0, 20)),
    meetingsAttended: Math.round(clamp(randomNormal(w.meetingsAttended.mean * weekendMultiplier, w.meetingsAttended.stdDev), 0, 12)),
    meetingHours: Math.round(clamp(randomNormal(w.meetingsAttended.mean * 0.5 * weekendMultiplier, 0.5), 0, 8) * 10) / 10,
    emailsSent: Math.round(clamp(randomNormal(w.emailsSent.mean * weekendMultiplier, w.emailsSent.stdDev), 0, 100)),
    emailsReceived: Math.round(clamp(randomNormal(w.emailsSent.mean * 2 * weekendMultiplier, w.emailsSent.stdDev * 2), 0, 200)),
    avgResponseTimeMinutes: Math.round(clamp(randomNormal(30, 15), 5, 180)),
    messagesSent: Math.round(clamp(randomNormal(w.emailsSent.mean * 0.8 * weekendMultiplier, w.emailsSent.stdDev), 0, 100)),
    focusTimeHours: Math.round(clamp(randomNormal(3 * weekendMultiplier, 1), 0, 8) * 10) / 10,
    contextSwitches: Math.round(clamp(randomNormal(15 * weekendMultiplier, 5), 0, 50)),
  };
}

/**
 * Interpolate between two profiles based on progress (0-1)
 */
function interpolateProfiles(startProfile, endProfile, progress) {
  const interpolated = { health: {}, work: {} };

  // Interpolate health metrics
  for (const key of Object.keys(startProfile.health)) {
    const start = startProfile.health[key];
    const end = endProfile.health[key];
    interpolated.health[key] = {
      mean: start.mean + (end.mean - start.mean) * progress,
      stdDev: start.stdDev + (end.stdDev - start.stdDev) * progress,
    };
  }

  // Interpolate work metrics
  for (const key of Object.keys(startProfile.work)) {
    const start = startProfile.work[key];
    const end = endProfile.work[key];
    interpolated.work[key] = {
      mean: start.mean + (end.mean - start.mean) * progress,
      stdDev: start.stdDev + (end.stdDev - start.stdDev) * progress,
    };
  }

  return interpolated;
}

/**
 * Generate 30 days of data for an employee
 */
function generateEmployeeData(profileKey, days = 30) {
  const profile = EMPLOYEE_PROFILES[profileKey];
  const healthData = [];
  const workData = [];

  for (let day = 0; day < days; day++) {
    let effectiveProfile;

    if (profile.trajectory) {
      // Trajectory-based profile (recovery pattern)
      const startProfile = EMPLOYEE_PROFILES[profile.startProfile];
      const endProfile = EMPLOYEE_PROFILES[profile.endProfile];
      const progress = Math.min(1, (days - day) / profile.transitionDays);
      // Reverse progress since we're going backwards in time
      const actualProgress = 1 - progress;
      effectiveProfile = interpolateProfiles(startProfile, endProfile, actualProgress);
    } else if (profile.pattern) {
      // Oscillating pattern
      const cyclePosition = Math.floor(day / profile.cycleDays) % profile.pattern.length;
      const patternKey = profile.pattern[cyclePosition];
      effectiveProfile = EMPLOYEE_PROFILES[patternKey];
    } else {
      // Static profile
      effectiveProfile = profile;
    }

    healthData.push(generateHealthMetrics(effectiveProfile, day));
    workData.push(generateWorkMetrics(effectiveProfile, day));
  }

  return {
    profile: {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      department: profile.department,
      jobTitle: profile.jobTitle,
    },
    healthData,
    workData,
  };
}

/**
 * Generate baselines from historical data
 */
function calculateBaselines(healthData, workData) {
  const recentHealth = healthData.slice(0, 14); // Last 2 weeks
  const recentWork = workData.slice(0, 14);

  const avg = (arr, key) => {
    const values = arr.map((d) => d[key]).filter((v) => v != null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  return {
    baselineRestingHr: Math.round(avg(recentHealth, 'restingHeartRate')),
    baselineHrv: Math.round(avg(recentHealth, 'heartRateVariability') * 10) / 10,
    baselineSleepHours: Math.round(avg(recentHealth, 'sleepHours') * 10) / 10,
    baselineSleepQuality: Math.round(avg(recentHealth, 'sleepQualityScore')),
    baselineSteps: Math.round(avg(recentHealth, 'steps')),
    baselineHoursWorked: Math.round(avg(recentWork, 'hoursWorked') * 10) / 10,
    baselineTasksCompleted: Math.round(avg(recentWork, 'tasksCompleted') * 10) / 10,
    baselineResponseTime: Math.round(avg(recentWork, 'avgResponseTimeMinutes')),
  };
}

/**
 * Generate all demo data
 */
function generateAllDemoData(days = 30) {
  const employees = [];

  for (const [key, profile] of Object.entries(EMPLOYEE_PROFILES)) {
    const data = generateEmployeeData(key, days);
    const baselines = calculateBaselines(data.healthData, data.workData);

    employees.push({
      ...data,
      baselines,
      profileKey: key,
    });
  }

  return employees;
}

/**
 * Get profile IDs for seeding
 */
function getProfileIds() {
  return Object.entries(EMPLOYEE_PROFILES).map(([key, profile]) => ({
    key,
    id: profile.id,
    email: profile.email,
  }));
}

module.exports = {
  EMPLOYEE_PROFILES,
  generateHealthMetrics,
  generateWorkMetrics,
  generateEmployeeData,
  calculateBaselines,
  generateAllDemoData,
  getProfileIds,
};
