const {
  calculateBurnoutScore,
  calculateReadinessScore,
  determineZone,
  generateExplanation,
  calculateEmployeeScores,
} = require('../src/services/scoringEngine');

const {
  healthMetricsGood,
  healthMetricsPoor,
  healthMetricsModerate,
  workMetricsGood,
  workMetricsPoor,
  workMetricsModerate,
  baselines,
} = require('./fixtures');

describe('Scoring Engine', () => {
  describe('calculateBurnoutScore', () => {
    it('should return low burnout score for good health and work metrics', () => {
      const result = calculateBurnoutScore(healthMetricsGood, workMetricsGood, baselines);

      expect(result.score).toBeLessThan(40);
      expect(result.factors).toHaveLength(4);
      expect(result.factors.every(f => f.category === 'burnout')).toBe(true);
    });

    it('should return high burnout score for poor health and work metrics', () => {
      const result = calculateBurnoutScore(healthMetricsPoor, workMetricsPoor, baselines);

      expect(result.score).toBeGreaterThan(60);
    });

    it('should return moderate burnout score for moderate metrics', () => {
      const result = calculateBurnoutScore(healthMetricsModerate, workMetricsModerate, baselines);

      expect(result.score).toBeGreaterThan(30);
      expect(result.score).toBeLessThan(70);
    });

    it('should correctly identify negative impact factors', () => {
      const result = calculateBurnoutScore(healthMetricsPoor, workMetricsPoor, baselines);

      const negativeFactors = result.factors.filter(f => f.impact === 'negative');
      expect(negativeFactors.length).toBeGreaterThan(0);
    });

    it('should handle missing baseline values gracefully', () => {
      const result = calculateBurnoutScore(healthMetricsGood, workMetricsGood, {});

      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
    });
  });

  describe('calculateReadinessScore', () => {
    it('should return high readiness score for good health and work metrics', () => {
      const result = calculateReadinessScore(healthMetricsGood, workMetricsGood, baselines);

      expect(result.score).toBeGreaterThan(60);
      expect(result.factors).toHaveLength(4);
      expect(result.factors.every(f => f.category === 'readiness')).toBe(true);
    });

    it('should return low readiness score for poor health and work metrics', () => {
      const result = calculateReadinessScore(healthMetricsPoor, workMetricsPoor, baselines);

      expect(result.score).toBeLessThan(50);
    });

    it('should correctly identify positive impact factors', () => {
      const result = calculateReadinessScore(healthMetricsGood, workMetricsGood, baselines);

      const positiveFactors = result.factors.filter(f => f.impact === 'positive');
      expect(positiveFactors.length).toBeGreaterThan(0);
    });
  });

  describe('determineZone', () => {
    it('should return red zone when burnout score is >= 70', () => {
      expect(determineZone(75, 50)).toBe('red');
      expect(determineZone(70, 80)).toBe('red'); // Burnout takes priority
      expect(determineZone(85, 30)).toBe('red');
    });

    it('should return green zone when readiness score is >= 70 and burnout < 70', () => {
      expect(determineZone(50, 75)).toBe('green');
      expect(determineZone(30, 80)).toBe('green');
      expect(determineZone(69, 70)).toBe('green');
    });

    it('should return yellow zone for moderate scores', () => {
      expect(determineZone(50, 50)).toBe('yellow');
      expect(determineZone(40, 60)).toBe('yellow');
      expect(determineZone(69, 69)).toBe('yellow');
    });

    it('should handle edge cases at boundaries', () => {
      expect(determineZone(70, 70)).toBe('red'); // Burnout priority at boundary
      expect(determineZone(69, 70)).toBe('green');
      expect(determineZone(69, 69)).toBe('yellow');
    });
  });

  describe('generateExplanation', () => {
    it('should generate explanation with correct zone', () => {
      const burnout = calculateBurnoutScore(healthMetricsPoor, workMetricsPoor, baselines);
      const readiness = calculateReadinessScore(healthMetricsPoor, workMetricsPoor, baselines);

      const explanation = generateExplanation(
        burnout.score,
        readiness.score,
        burnout.factors,
        readiness.factors,
        baselines
      );

      expect(explanation.zone).toBeDefined();
      expect(['red', 'yellow', 'green']).toContain(explanation.zone);
    });

    it('should include burnout and readiness scores', () => {
      const burnout = calculateBurnoutScore(healthMetricsGood, workMetricsGood, baselines);
      const readiness = calculateReadinessScore(healthMetricsGood, workMetricsGood, baselines);

      const explanation = generateExplanation(
        burnout.score,
        readiness.score,
        burnout.factors,
        readiness.factors,
        baselines
      );

      expect(explanation.burnoutScore).toBeDefined();
      expect(explanation.readinessScore).toBeDefined();
      expect(typeof explanation.burnoutScore).toBe('number');
      expect(typeof explanation.readinessScore).toBe('number');
    });

    it('should include top contributing factors', () => {
      const burnout = calculateBurnoutScore(healthMetricsGood, workMetricsGood, baselines);
      const readiness = calculateReadinessScore(healthMetricsGood, workMetricsGood, baselines);

      const explanation = generateExplanation(
        burnout.score,
        readiness.score,
        burnout.factors,
        readiness.factors,
        baselines
      );

      expect(explanation.factors).toBeDefined();
      expect(Array.isArray(explanation.factors)).toBe(true);
      expect(explanation.factors.length).toBeLessThanOrEqual(4);

      explanation.factors.forEach(factor => {
        expect(factor.name).toBeDefined();
        expect(factor.impact).toBeDefined();
        expect(factor.value).toBeDefined();
        expect(factor.description).toBeDefined();
      });
    });

    it('should include recommendations based on zone', () => {
      const burnout = calculateBurnoutScore(healthMetricsPoor, workMetricsPoor, baselines);
      const readiness = calculateReadinessScore(healthMetricsPoor, workMetricsPoor, baselines);

      const explanation = generateExplanation(
        burnout.score,
        readiness.score,
        burnout.factors,
        readiness.factors,
        baselines
      );

      expect(explanation.recommendations).toBeDefined();
      expect(Array.isArray(explanation.recommendations)).toBe(true);
      expect(explanation.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide different recommendations for different zones', () => {
      // Red zone
      const burnoutPoor = calculateBurnoutScore(healthMetricsPoor, workMetricsPoor, baselines);
      const readinessPoor = calculateReadinessScore(healthMetricsPoor, workMetricsPoor, baselines);
      const redExplanation = generateExplanation(
        burnoutPoor.score,
        readinessPoor.score,
        burnoutPoor.factors,
        readinessPoor.factors,
        baselines
      );

      // Green zone
      const burnoutGood = calculateBurnoutScore(healthMetricsGood, workMetricsGood, baselines);
      const readinessGood = calculateReadinessScore(healthMetricsGood, workMetricsGood, baselines);
      const greenExplanation = generateExplanation(
        burnoutGood.score,
        readinessGood.score,
        burnoutGood.factors,
        readinessGood.factors,
        baselines
      );

      // Recommendations should be different
      if (redExplanation.zone !== greenExplanation.zone) {
        expect(redExplanation.recommendations).not.toEqual(greenExplanation.recommendations);
      }
    });
  });

  describe('calculateEmployeeScores', () => {
    it('should return complete score object', () => {
      const result = calculateEmployeeScores(healthMetricsGood, workMetricsGood, baselines);

      expect(result).toHaveProperty('burnoutScore');
      expect(result).toHaveProperty('readinessScore');
      expect(result).toHaveProperty('zone');
      expect(result).toHaveProperty('explanation');
    });

    it('should return green zone for peak performer metrics', () => {
      const result = calculateEmployeeScores(healthMetricsGood, workMetricsGood, baselines);

      expect(result.zone).toBe('green');
      expect(result.burnoutScore).toBeLessThan(50);
      expect(result.readinessScore).toBeGreaterThan(60);
    });

    it('should return red zone for burnout-risk metrics', () => {
      const result = calculateEmployeeScores(healthMetricsPoor, workMetricsPoor, baselines);

      expect(result.zone).toBe('red');
      expect(result.burnoutScore).toBeGreaterThan(60);
    });

    it('should return yellow zone for moderate metrics', () => {
      const result = calculateEmployeeScores(healthMetricsModerate, workMetricsModerate, baselines);

      expect(result.zone).toBe('yellow');
    });

    it('should include explanation matching the calculated zone', () => {
      const result = calculateEmployeeScores(healthMetricsGood, workMetricsGood, baselines);

      expect(result.explanation.zone).toBe(result.zone);
    });

    it('should return integer scores', () => {
      const result = calculateEmployeeScores(healthMetricsGood, workMetricsGood, baselines);

      expect(Number.isInteger(result.burnoutScore)).toBe(true);
      expect(Number.isInteger(result.readinessScore)).toBe(true);
    });
  });
});
