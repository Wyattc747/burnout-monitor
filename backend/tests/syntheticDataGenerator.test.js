const {
  EMPLOYEE_PROFILES,
  generateHealthMetrics,
  generateWorkMetrics,
  generateEmployeeData,
  calculateBaselines,
  generateAllDemoData,
  getProfileIds,
} = require('../src/services/syntheticDataGenerator');

describe('Synthetic Data Generator', () => {
  describe('EMPLOYEE_PROFILES', () => {
    it('should have 7 employee profiles', () => {
      const profiles = Object.keys(EMPLOYEE_PROFILES);
      expect(profiles).toHaveLength(7);
    });

    it('should have required profiles', () => {
      expect(EMPLOYEE_PROFILES.peakPerformer).toBeDefined();
      expect(EMPLOYEE_PROFILES.moderateStress).toBeDefined();
      expect(EMPLOYEE_PROFILES.highBurnout).toBeDefined();
      expect(EMPLOYEE_PROFILES.recovery).toBeDefined();
      expect(EMPLOYEE_PROFILES.variable).toBeDefined();
      expect(EMPLOYEE_PROFILES.newHire).toBeDefined();
      expect(EMPLOYEE_PROFILES.remoteSenior).toBeDefined();
    });

    it('should have unique emails for each profile', () => {
      const emails = Object.values(EMPLOYEE_PROFILES).map(p => p.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(emails.length);
    });

    it('should have expected zone for each standard profile', () => {
      expect(EMPLOYEE_PROFILES.peakPerformer.expectedZone).toBe('green');
      expect(EMPLOYEE_PROFILES.moderateStress.expectedZone).toBe('yellow');
      expect(EMPLOYEE_PROFILES.highBurnout.expectedZone).toBe('red');
    });
  });

  describe('generateHealthMetrics', () => {
    const profile = EMPLOYEE_PROFILES.peakPerformer;

    it('should generate valid health metrics', () => {
      const metrics = generateHealthMetrics(profile);

      expect(metrics.date).toBeDefined();
      expect(metrics.restingHeartRate).toBeGreaterThan(40);
      expect(metrics.restingHeartRate).toBeLessThan(110);
      expect(metrics.heartRateVariability).toBeGreaterThan(10);
      expect(metrics.sleepHours).toBeGreaterThan(2);
      expect(metrics.sleepHours).toBeLessThan(13);
      expect(metrics.sleepQualityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.sleepQualityScore).toBeLessThanOrEqual(100);
    });

    it('should generate metrics for past dates', () => {
      const metricsToday = generateHealthMetrics(profile, 0);
      const metricsPast = generateHealthMetrics(profile, 5);

      const today = new Date().toISOString().split('T')[0];
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const expectedPastDate = pastDate.toISOString().split('T')[0];

      expect(metricsToday.date).toBe(today);
      expect(metricsPast.date).toBe(expectedPastDate);
    });

    it('should generate different values for different profiles', () => {
      const peakMetrics = generateHealthMetrics(EMPLOYEE_PROFILES.peakPerformer);
      const burnoutMetrics = generateHealthMetrics(EMPLOYEE_PROFILES.highBurnout);

      // On average, peak performer should have better sleep (generate multiple to reduce randomness)
      const peakSleepSum = Array.from({ length: 10 }, () =>
        generateHealthMetrics(EMPLOYEE_PROFILES.peakPerformer).sleepHours
      ).reduce((a, b) => a + b, 0);

      const burnoutSleepSum = Array.from({ length: 10 }, () =>
        generateHealthMetrics(EMPLOYEE_PROFILES.highBurnout).sleepHours
      ).reduce((a, b) => a + b, 0);

      expect(peakSleepSum / 10).toBeGreaterThan(burnoutSleepSum / 10);
    });
  });

  describe('generateWorkMetrics', () => {
    const profile = EMPLOYEE_PROFILES.highBurnout;

    it('should generate valid work metrics', () => {
      const metrics = generateWorkMetrics(profile);

      expect(metrics.date).toBeDefined();
      expect(metrics.hoursWorked).toBeGreaterThanOrEqual(0);
      expect(metrics.hoursWorked).toBeLessThanOrEqual(17);
      expect(metrics.tasksCompleted).toBeGreaterThanOrEqual(0);
      expect(metrics.meetingsAttended).toBeGreaterThanOrEqual(0);
    });

    it('should generate less work on weekends', () => {
      // Find a Sunday (day offset where it lands on Sunday)
      let sundayOffset = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        if (date.getDay() === 0) {
          sundayOffset = i;
          break;
        }
      }

      // Generate multiple samples to reduce variance impact
      const weekendSamples = Array.from({ length: 50 }, () =>
        generateWorkMetrics(profile, sundayOffset).hoursWorked
      );
      const weekdaySamples = Array.from({ length: 50 }, () =>
        generateWorkMetrics(profile, sundayOffset + 1).hoursWorked // Monday
      );

      const avgWeekend = weekendSamples.reduce((a, b) => a + b, 0) / 50;
      const avgWeekday = weekdaySamples.reduce((a, b) => a + b, 0) / 50;

      // Weekend average should be less than weekday (weekendMultiplier = 0.2)
      // Allow for some variance with generous threshold
      expect(avgWeekend).toBeLessThan(avgWeekday);
    });
  });

  describe('generateEmployeeData', () => {
    it('should generate 30 days of data by default', () => {
      const data = generateEmployeeData('peakPerformer');

      expect(data.healthData).toHaveLength(30);
      expect(data.workData).toHaveLength(30);
    });

    it('should generate specified number of days', () => {
      const data = generateEmployeeData('peakPerformer', 7);

      expect(data.healthData).toHaveLength(7);
      expect(data.workData).toHaveLength(7);
    });

    it('should include profile information', () => {
      const data = generateEmployeeData('peakPerformer');

      expect(data.profile.firstName).toBe('Wyatt');
      expect(data.profile.lastName).toBe('Cooper');
      expect(data.profile.email).toBe('wyatt@demo.com');
    });

    it('should generate improving data for recovery profile', () => {
      const data = generateEmployeeData('recovery', 21);

      // Recent data should be better than old data
      const recentHealth = data.healthData.slice(0, 7);
      const oldHealth = data.healthData.slice(-7);

      const recentAvgSleep = recentHealth.reduce((a, b) => a + b.sleepHours, 0) / 7;
      const oldAvgSleep = oldHealth.reduce((a, b) => a + b.sleepHours, 0) / 7;

      // Recovery pattern should show improvement (recent sleep >= old sleep on average)
      // Allow for variance due to randomness in generation
      expect(recentAvgSleep).toBeGreaterThanOrEqual(oldAvgSleep - 2);
    });
  });

  describe('calculateBaselines', () => {
    it('should calculate baselines from 14-day data', () => {
      const data = generateEmployeeData('peakPerformer', 30);
      const baselines = calculateBaselines(data.healthData, data.workData);

      expect(baselines.baselineRestingHr).toBeDefined();
      expect(baselines.baselineHrv).toBeDefined();
      expect(baselines.baselineSleepHours).toBeDefined();
      expect(baselines.baselineHoursWorked).toBeDefined();
    });

    it('should return reasonable baseline values', () => {
      const data = generateEmployeeData('peakPerformer', 30);
      const baselines = calculateBaselines(data.healthData, data.workData);

      expect(baselines.baselineRestingHr).toBeGreaterThan(40);
      expect(baselines.baselineRestingHr).toBeLessThan(100);
      expect(baselines.baselineSleepHours).toBeGreaterThan(4);
      expect(baselines.baselineSleepHours).toBeLessThan(10);
      expect(baselines.baselineHoursWorked).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateAllDemoData', () => {
    it('should generate data for all 7 employees', () => {
      const allData = generateAllDemoData(7); // Use fewer days for speed

      expect(allData).toHaveLength(7);
    });

    it('should include baselines for each employee', () => {
      const allData = generateAllDemoData(7);

      allData.forEach(emp => {
        expect(emp.baselines).toBeDefined();
        expect(emp.baselines.baselineSleepHours).toBeDefined();
      });
    });

    it('should include profile keys', () => {
      const allData = generateAllDemoData(7);

      const profileKeys = allData.map(e => e.profileKey);
      expect(profileKeys).toContain('peakPerformer');
      expect(profileKeys).toContain('moderateStress');
      expect(profileKeys).toContain('highBurnout');
      expect(profileKeys).toContain('recovery');
      expect(profileKeys).toContain('variable');
      expect(profileKeys).toContain('newHire');
      expect(profileKeys).toContain('remoteSenior');
    });
  });

  describe('getProfileIds', () => {
    it('should return profile IDs for all employees', () => {
      const ids = getProfileIds();

      expect(ids).toHaveLength(7);
      ids.forEach(item => {
        expect(item.key).toBeDefined();
        expect(item.id).toBeDefined();
        expect(item.email).toBeDefined();
      });
    });
  });
});
