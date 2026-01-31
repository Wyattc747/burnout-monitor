/**
 * End-to-End Verification Tests
 *
 * These tests verify the demo scenario works correctly.
 * Run after database is seeded: npm run seed
 *
 * To run: DATABASE_URL=postgresql://localhost:5432/burnout_monitor npm test -- e2e-verification
 */

const { calculateEmployeeScores } = require('../src/services/scoringEngine');
const { generateAllDemoData, EMPLOYEE_PROFILES } = require('../src/services/syntheticDataGenerator');

describe('E2E Demo Verification', () => {
  describe('Demo Employee Profiles', () => {
    it('should have 7 distinct employee profiles', () => {
      const profiles = Object.keys(EMPLOYEE_PROFILES);
      expect(profiles).toHaveLength(7);
      expect(profiles).toEqual([
        'peakPerformer',
        'moderateStress',
        'highBurnout',
        'recovery',
        'variable',
        'newHire',
        'remoteSenior',
      ]);
    });

    it('Wyatt Cooper (peakPerformer) should be in GREEN zone', () => {
      const profile = EMPLOYEE_PROFILES.peakPerformer;
      expect(profile.firstName).toBe('Wyatt');
      expect(profile.expectedZone).toBe('green');

      // Verify scoring produces green zone with typical values
      const health = {
        sleepHours: 7.8,
        sleepQualityScore: 85,
        heartRateVariability: 55,
        restingHeartRate: 58,
        deepSleepHours: 1.6,
        exerciseMinutes: 45,
        recoveryScore: 80,
      };
      const work = {
        hoursWorked: 7.5,
        overtimeHours: 0,
        tasksCompleted: 8,
        tasksAssigned: 7,
        meetingsAttended: 3,
      };
      const baselines = {
        baselineSleepHours: 7.8,
        baselineSleepQuality: 85,
        baselineHrv: 55,
        baselineRestingHr: 58,
        baselineHoursWorked: 7.5,
      };

      const scores = calculateEmployeeScores(health, work, baselines);
      expect(scores.zone).toBe('green');
    });

    it('Woody Klemetson (moderateStress) should be in YELLOW zone', () => {
      const profile = EMPLOYEE_PROFILES.moderateStress;
      expect(profile.firstName).toBe('Woody');
      expect(profile.expectedZone).toBe('yellow');

      const health = {
        sleepHours: 6.0,
        sleepQualityScore: 58,
        heartRateVariability: 38,
        restingHeartRate: 72,
        deepSleepHours: 1.0,
        exerciseMinutes: 15,
        recoveryScore: 50,
      };
      const work = {
        hoursWorked: 9.0,
        overtimeHours: 1.0,
        tasksCompleted: 5,
        tasksAssigned: 8,
        meetingsAttended: 6,
      };
      // Baselines set higher than actuals to show deficit
      const baselines = {
        baselineSleepHours: 7.0,
        baselineSleepQuality: 70,
        baselineHrv: 45,
        baselineRestingHr: 65,
        baselineHoursWorked: 8.0,
      };

      const scores = calculateEmployeeScores(health, work, baselines);
      expect(scores.zone).toBe('yellow');
    });

    it('Robert Henderson (highBurnout) should be in RED zone', () => {
      const profile = EMPLOYEE_PROFILES.highBurnout;
      expect(profile.firstName).toBe('Robert');
      expect(profile.expectedZone).toBe('red');

      const health = {
        sleepHours: 5.5,
        sleepQualityScore: 50,
        heartRateVariability: 32,
        restingHeartRate: 75,
        deepSleepHours: 0.8,
        exerciseMinutes: 10,
        recoveryScore: 40,
      };
      const work = {
        hoursWorked: 10.5,
        overtimeHours: 2.5,
        tasksCompleted: 5,
        tasksAssigned: 10,
        meetingsAttended: 7,
      };
      const baselines = {
        baselineSleepHours: 7,
        baselineSleepQuality: 70,
        baselineHrv: 45,
        baselineRestingHr: 65,
        baselineHoursWorked: 8,
      };

      const scores = calculateEmployeeScores(health, work, baselines);
      expect(scores.zone).toBe('red');
      expect(scores.burnoutScore).toBeGreaterThan(70);
    });

    it('Ben Harrison (recovery) should show improving trend', () => {
      const profile = EMPLOYEE_PROFILES.recovery;
      expect(profile.firstName).toBe('Ben');
      expect(profile.trajectory).toBe('improving');
    });

    it('Andrew Brown (variable) should oscillate between states', () => {
      const profile = EMPLOYEE_PROFILES.variable;
      expect(profile.firstName).toBe('Andrew');
      expect(profile.pattern).toBeDefined();
      expect(profile.pattern.length).toBeGreaterThan(1);
    });
  });

  describe('Demo Data Generation', () => {
    it('should generate 30 days of data for all employees', () => {
      const allData = generateAllDemoData(30);

      expect(allData).toHaveLength(7);

      allData.forEach(emp => {
        expect(emp.healthData).toHaveLength(30);
        expect(emp.workData).toHaveLength(30);
        expect(emp.baselines).toBeDefined();
      });
    });

    it('should generate unique IDs for each employee', () => {
      const allData = generateAllDemoData();
      const ids = allData.map(e => e.profile.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(7);
    });

    it('should generate consistent profile data', () => {
      const allData = generateAllDemoData();

      const wyatt = allData.find(e => e.profile.firstName === 'Wyatt');
      expect(wyatt).toBeDefined();
      expect(wyatt.profile.email).toBe('wyatt@demo.com');
      expect(wyatt.profile.department).toBe('Engineering');

      const robert = allData.find(e => e.profile.firstName === 'Robert');
      expect(robert).toBeDefined();
      expect(robert.profile.email).toBe('robert@demo.com');
      expect(robert.profile.jobTitle).toBe('Tech Lead');
    });
  });

  describe('Explainability System', () => {
    it('should provide factors for red zone', () => {
      const health = {
        sleepHours: 5,
        sleepQualityScore: 45,
        heartRateVariability: 30,
        restingHeartRate: 78,
        deepSleepHours: 0.7,
        exerciseMinutes: 5,
        recoveryScore: 40,
      };
      const work = {
        hoursWorked: 11,
        overtimeHours: 3,
        tasksCompleted: 4,
        tasksAssigned: 10,
        meetingsAttended: 8,
      };
      const baselines = {
        baselineSleepHours: 7,
        baselineSleepQuality: 70,
        baselineHrv: 45,
        baselineRestingHr: 65,
        baselineHoursWorked: 8,
      };

      const scores = calculateEmployeeScores(health, work, baselines);

      expect(scores.explanation.zone).toBe('red');
      expect(scores.explanation.factors.length).toBeGreaterThan(0);

      // Should have negative impact factors
      const negativeFactors = scores.explanation.factors.filter(f => f.impact === 'negative');
      expect(negativeFactors.length).toBeGreaterThan(0);

      // Should have recommendations
      expect(scores.explanation.recommendations.personal.length).toBeGreaterThan(0);
    });

    it('should provide factors for green zone', () => {
      const health = {
        sleepHours: 8,
        sleepQualityScore: 90,
        heartRateVariability: 60,
        restingHeartRate: 55,
        deepSleepHours: 1.8,
        exerciseMinutes: 45,
        recoveryScore: 85,
      };
      const work = {
        hoursWorked: 7,
        overtimeHours: 0,
        tasksCompleted: 9,
        tasksAssigned: 8,
        meetingsAttended: 2,
      };
      const baselines = {
        baselineSleepHours: 7,
        baselineSleepQuality: 70,
        baselineHrv: 45,
        baselineRestingHr: 65,
        baselineHoursWorked: 8,
      };

      const scores = calculateEmployeeScores(health, work, baselines);

      expect(scores.explanation.zone).toBe('green');

      // Should have positive impact factors
      const positiveFactors = scores.explanation.factors.filter(f => f.impact === 'positive');
      expect(positiveFactors.length).toBeGreaterThan(0);

      // Should have opportunity-focused recommendations
      expect(scores.explanation.recommendations.personal.length).toBeGreaterThan(0);
    });

    it('should include factor descriptions and values', () => {
      const health = {
        sleepHours: 6,
        sleepQualityScore: 60,
        heartRateVariability: 40,
        restingHeartRate: 70,
        deepSleepHours: 1.1,
        exerciseMinutes: 25,
        recoveryScore: 55,
      };
      const work = {
        hoursWorked: 9,
        overtimeHours: 1,
        tasksCompleted: 5,
        tasksAssigned: 6,
        meetingsAttended: 4,
      };
      const baselines = {
        baselineSleepHours: 7,
        baselineSleepQuality: 70,
        baselineHrv: 45,
        baselineRestingHr: 65,
        baselineHoursWorked: 8,
      };

      const scores = calculateEmployeeScores(health, work, baselines);

      scores.explanation.factors.forEach(factor => {
        expect(factor.name).toBeDefined();
        expect(typeof factor.name).toBe('string');

        expect(factor.impact).toBeDefined();
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);

        expect(factor.value).toBeDefined();
        expect(typeof factor.value).toBe('string');

        expect(factor.description).toBeDefined();
        expect(typeof factor.description).toBe('string');

        expect(factor.weight).toBeDefined();
        expect(typeof factor.weight).toBe('number');
      });
    });
  });

  describe('Demo Accounts', () => {
    it('should have correct demo account configuration', () => {
      const demoAccounts = [
        { email: 'manager@demo.com', role: 'manager' },
        { email: 'wyatt@demo.com', role: 'employee', profile: 'peakPerformer' },
        { email: 'woody@demo.com', role: 'employee', profile: 'moderateStress' },
        { email: 'robert@demo.com', role: 'employee', profile: 'highBurnout' },
        { email: 'ben@demo.com', role: 'employee', profile: 'recovery' },
        { email: 'andrew@demo.com', role: 'employee', profile: 'variable' },
        { email: 'emily@demo.com', role: 'employee', profile: 'newHire' },
        { email: 'marcus@demo.com', role: 'employee', profile: 'remoteSenior' },
      ];

      expect(demoAccounts).toHaveLength(8); // 1 manager + 7 employees

      // Verify employee emails match profiles
      Object.values(EMPLOYEE_PROFILES).forEach(profile => {
        const account = demoAccounts.find(a => a.email === profile.email);
        expect(account).toBeDefined();
      });
    });
  });
});
