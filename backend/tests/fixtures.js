// Test fixtures for consistent test data

const healthMetricsGood = {
  sleepHours: 8,
  sleepQualityScore: 85,
  heartRateVariability: 55,
  restingHeartRate: 58,
  deepSleepHours: 1.6,
  exerciseMinutes: 45,
  recoveryScore: 80,
};

const healthMetricsPoor = {
  sleepHours: 5,
  sleepQualityScore: 45,
  heartRateVariability: 30,
  restingHeartRate: 78,
  deepSleepHours: 0.7,
  exerciseMinutes: 5,
  recoveryScore: 40,
};

const healthMetricsModerate = {
  sleepHours: 6.5,
  sleepQualityScore: 65,
  heartRateVariability: 42,
  restingHeartRate: 68,
  deepSleepHours: 1.2,
  exerciseMinutes: 20,
  recoveryScore: 60,
};

const workMetricsGood = {
  hoursWorked: 7.5,
  overtimeHours: 0,
  tasksCompleted: 8,
  tasksAssigned: 7,
  meetingsAttended: 3,
};

const workMetricsPoor = {
  hoursWorked: 11,
  overtimeHours: 3,
  tasksCompleted: 4,
  tasksAssigned: 10,
  meetingsAttended: 8,
};

const workMetricsModerate = {
  hoursWorked: 8.5,
  overtimeHours: 0.5,
  tasksCompleted: 6,
  tasksAssigned: 7,
  meetingsAttended: 5,
};

const baselines = {
  baselineSleepHours: 7,
  baselineSleepQuality: 70,
  baselineHrv: 45,
  baselineRestingHr: 65,
  baselineHoursWorked: 8,
};

const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  role: 'employee',
};

const testManager = {
  email: 'manager@test.com',
  password: 'managerpass123',
  role: 'manager',
};

const testEmployee = {
  firstName: 'Test',
  lastName: 'Employee',
  email: 'test.employee@example.com',
  department: 'Engineering',
  jobTitle: 'Developer',
};

module.exports = {
  healthMetricsGood,
  healthMetricsPoor,
  healthMetricsModerate,
  workMetricsGood,
  workMetricsPoor,
  workMetricsModerate,
  baselines,
  testUser,
  testManager,
  testEmployee,
};
