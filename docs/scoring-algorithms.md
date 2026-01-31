# Burnout & Readiness Scoring Algorithms

## Overview

The system calculates two primary scores for each employee:
1. **Burnout Score (0-100)**: Higher = More at risk for burnout
2. **Readiness Score (0-100)**: Higher = More ready for challenging work

These scores determine the employee's **zone**:
- **RED** (Burnout Risk): burnout_score >= burnout_threshold (default: 70)
- **GREEN** (Peak Ready): burnout_score < burnout_threshold AND readiness_score >= readiness_threshold (default: 70)
- **YELLOW** (Moderate): All other cases

## Enhanced Scoring Features (v2.0)

The scoring engine now includes:
1. **Non-linear Interaction Effects**: Combined stressors compound each other
2. **Configurable Thresholds**: Per-organization and per-employee threshold overrides
3. **Context Awareness**: Day-of-week adjustments and vacation fatigue detection
4. **Self-Report Calibration**: Algorithmic scores calibrated against feeling check-ins
5. **Privacy-Preserving Aggregates**: Team views with minimum size requirements

## Input Metrics

### Health Metrics (from Apple Watch)
| Metric | Unit | Baseline Comparison |
|--------|------|---------------------|
| Resting Heart Rate | bpm | Higher = stress indicator |
| Heart Rate Variability (HRV) | ms | Lower = stress indicator |
| Sleep Hours | hours | Less than baseline = negative |
| Sleep Quality Score | 0-100 | Lower = negative |
| Deep Sleep Hours | hours | Less = poor recovery |
| Steps | count | Context-dependent |
| Exercise Minutes | minutes | Context-dependent |

### Work Metrics
| Metric | Unit | Impact |
|--------|------|--------|
| Hours Worked | hours/day | Above baseline = stress |
| Overtime Hours | hours | Always negative |
| Tasks Completed | count | Below baseline = struggle indicator |
| Meetings | count | High count = drain |
| Email Response Time | minutes | Higher = overload indicator |

## Burnout Score Calculation

```typescript
function calculateBurnoutScore(
  health: HealthMetrics,
  work: WorkMetrics,
  baselines: EmployeeBaselines
): number {
  // Factor 1: Sleep Deficit (25% weight)
  const sleepDeficit = calculateSleepDeficitFactor(health, baselines);

  // Factor 2: HRV Stress (25% weight)
  const hrvStress = calculateHRVStressFactor(health, baselines);

  // Factor 3: Work Hours (25% weight)
  const workOverload = calculateWorkOverloadFactor(work, baselines);

  // Factor 4: Recovery Deficit (25% weight)
  const recoveryDeficit = calculateRecoveryDeficitFactor(health, work, baselines);

  return (
    sleepDeficit * 0.25 +
    hrvStress * 0.25 +
    workOverload * 0.25 +
    recoveryDeficit * 0.25
  );
}
```

### Factor Calculations

#### Sleep Deficit Factor (0-100)
```typescript
function calculateSleepDeficitFactor(health: HealthMetrics, baselines: EmployeeBaselines): number {
  const sleepRatio = health.sleepHours / baselines.baselineSleepHours;
  const qualityRatio = health.sleepQualityScore / baselines.baselineSleepQuality;

  // Combine sleep duration and quality
  const combinedRatio = (sleepRatio * 0.6) + (qualityRatio * 0.4);

  // Convert to 0-100 scale (inverse - less sleep = higher score)
  if (combinedRatio >= 1.0) return 0;  // At or above baseline
  if (combinedRatio <= 0.6) return 100; // 40%+ deficit

  // Linear interpolation between
  return (1 - combinedRatio) * 250; // Scale to 0-100
}
```

#### HRV Stress Factor (0-100)
```typescript
function calculateHRVStressFactor(health: HealthMetrics, baselines: EmployeeBaselines): number {
  // Lower HRV indicates stress
  const hrvRatio = health.heartRateVariability / baselines.baselineHrv;

  // Also consider resting heart rate (higher = more stress)
  const hrRatio = health.restingHeartRate / baselines.baselineRestingHr;

  if (hrvRatio >= 1.0 && hrRatio <= 1.0) return 0; // Normal or better
  if (hrvRatio <= 0.7 || hrRatio >= 1.2) return 100; // Significant stress

  // Combine HRV (60%) and HR (40%)
  const hrvScore = Math.max(0, (1 - hrvRatio) * 166);
  const hrScore = Math.max(0, (hrRatio - 1) * 500);

  return Math.min(100, hrvScore * 0.6 + hrScore * 0.4);
}
```

#### Work Overload Factor (0-100)
```typescript
function calculateWorkOverloadFactor(work: WorkMetrics, baselines: EmployeeBaselines): number {
  // Hours worked vs baseline
  const hoursRatio = work.hoursWorked / baselines.baselineHoursWorked;

  // Overtime is always negative
  const overtimePenalty = work.overtimeHours * 10;

  // Meeting overload
  const meetingPenalty = Math.max(0, work.meetingsAttended - 4) * 5;

  const baseScore = Math.max(0, (hoursRatio - 1) * 100);

  return Math.min(100, baseScore + overtimePenalty + meetingPenalty);
}
```

#### Recovery Deficit Factor (0-100)
```typescript
function calculateRecoveryDeficitFactor(
  health: HealthMetrics,
  work: WorkMetrics,
  baselines: EmployeeBaselines
): number {
  // Deep sleep is critical for recovery
  const deepSleepRatio = health.deepSleepHours / (baselines.baselineSleepHours * 0.2);

  // Recovery score if available from watch
  const recoveryScore = health.recoveryScore || estimateRecoveryScore(health);

  // Exercise can aid recovery (moderate amounts)
  const exerciseBalance = calculateExerciseBalance(health.exerciseMinutes);

  const deepSleepDeficit = Math.max(0, (1 - deepSleepRatio) * 50);
  const recoveryDeficit = Math.max(0, (100 - recoveryScore) * 0.5);

  return Math.min(100, deepSleepDeficit + recoveryDeficit - exerciseBalance);
}
```

## Readiness Score Calculation

```typescript
function calculateReadinessScore(
  health: HealthMetrics,
  work: WorkMetrics,
  baselines: EmployeeBaselines
): number {
  // Factor 1: Sleep Quality (30% weight)
  const sleepQuality = calculateSleepQualityFactor(health, baselines);

  // Factor 2: HRV Recovery (30% weight)
  const hrvRecovery = calculateHRVRecoveryFactor(health, baselines);

  // Factor 3: Work Balance (20% weight)
  const workBalance = calculateWorkBalanceFactor(work, baselines);

  // Factor 4: Trend (20% weight)
  const trend = calculateTrendFactor(health, work);

  return (
    sleepQuality * 0.30 +
    hrvRecovery * 0.30 +
    workBalance * 0.20 +
    trend * 0.20
  );
}
```

### Factor Calculations

#### Sleep Quality Factor (0-100)
```typescript
function calculateSleepQualityFactor(health: HealthMetrics, baselines: EmployeeBaselines): number {
  const hoursRatio = health.sleepHours / baselines.baselineSleepHours;
  const qualityScore = health.sleepQualityScore;
  const deepSleepRatio = health.deepSleepHours / (health.sleepHours * 0.2);

  // Need both adequate duration AND quality
  if (hoursRatio < 0.85) return Math.min(50, qualityScore * 0.5);

  // Bonus for above-average sleep
  const bonus = hoursRatio > 1.1 ? 10 : 0;

  return Math.min(100, qualityScore * deepSleepRatio + bonus);
}
```

#### HRV Recovery Factor (0-100)
```typescript
function calculateHRVRecoveryFactor(health: HealthMetrics, baselines: EmployeeBaselines): number {
  const hrvRatio = health.heartRateVariability / baselines.baselineHrv;
  const hrRatio = baselines.baselineRestingHr / health.restingHeartRate; // Inverse

  // High HRV + low resting HR = good recovery
  if (hrvRatio >= 1.1 && hrRatio >= 1.0) return 100;
  if (hrvRatio < 0.8 || hrRatio < 0.9) return Math.max(0, hrvRatio * 50);

  return Math.min(100, (hrvRatio * 50) + (hrRatio * 50));
}
```

#### Work Balance Factor (0-100)
```typescript
function calculateWorkBalanceFactor(work: WorkMetrics, baselines: EmployeeBaselines): number {
  // Ideal: at or slightly below baseline hours
  const hoursRatio = work.hoursWorked / baselines.baselineHoursWorked;

  // No overtime = bonus
  const noOvertimeBonus = work.overtimeHours === 0 ? 20 : 0;

  // Task completion efficiency
  const efficiency = work.tasksCompleted / work.tasksAssigned;

  if (hoursRatio > 1.1) return Math.max(0, 50 - (hoursRatio - 1.1) * 200);

  const baseScore = 60 + noOvertimeBonus;
  return Math.min(100, baseScore + (efficiency * 20));
}
```

#### Trend Factor (0-100)
```typescript
function calculateTrendFactor(
  healthHistory: HealthMetrics[], // Last 7 days
  workHistory: WorkMetrics[]
): number {
  // Calculate 7-day moving averages
  const hrvTrend = calculateTrend(healthHistory.map(h => h.heartRateVariability));
  const sleepTrend = calculateTrend(healthHistory.map(h => h.sleepHours));
  const workTrend = calculateTrend(workHistory.map(w => w.hoursWorked));

  // Positive HRV trend + positive sleep trend + stable/negative work hours = high readiness
  let score = 50;

  if (hrvTrend > 0) score += 20;
  if (sleepTrend > 0) score += 15;
  if (workTrend <= 0) score += 15;

  return Math.min(100, Math.max(0, score));
}
```

## Explainability System

When calculating scores, track each factor's contribution:

```typescript
interface FactorContribution {
  name: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  explanation: string;
}

function generateExplanation(
  burnoutScore: number,
  readinessScore: number,
  factors: FactorContribution[]
): Explanation {
  const zone = determineZone(burnoutScore, readinessScore);

  // Sort factors by absolute impact
  const sortedFactors = factors
    .map(f => ({
      ...f,
      absoluteImpact: Math.abs(f.normalizedScore - 50) * f.weight
    }))
    .sort((a, b) => b.absoluteImpact - a.absoluteImpact);

  // Generate human-readable explanations
  const humanFactors = sortedFactors.slice(0, 4).map(f => ({
    name: f.name,
    impact: f.impact,
    value: formatValue(f),
    description: generateDescription(f, zone),
    weight: f.weight
  }));

  // Generate recommendations based on zone and factors
  const recommendations = generateRecommendations(zone, sortedFactors);

  return { zone, factors: humanFactors, recommendations };
}
```

### Explanation Templates

#### For RED Zone (Burnout Risk)
```typescript
const burnoutExplanations = {
  sleepDeficit: (value: number) =>
    `Your sleep has been ${value}% below your usual average for the past week`,

  hrvStress: (value: number) =>
    `Your heart rate variability shows elevated stress levels (${value}% below baseline)`,

  workOverload: (value: number) =>
    `You've worked ${value}% more hours than your typical week`,

  recoveryDeficit: (value: number) =>
    `Your recovery metrics indicate insufficient rest between work days`
};

const burnoutRecommendations = [
  "Consider taking a mental health day if possible",
  "Try to get 8+ hours of sleep tonight",
  "Take short breaks every 90 minutes during work",
  "Consider delegating non-critical tasks",
  "Limit after-hours email checking"
];
```

#### For GREEN Zone (Peak Ready)
```typescript
const readinessExplanations = {
  sleepQuality: (value: number) =>
    `Your sleep quality has been excellent (${value}% above baseline)`,

  hrvRecovery: (value: number) =>
    `Your HRV indicates strong recovery and low stress`,

  workBalance: (value: number) =>
    `You've maintained a healthy work-life balance this week`,

  positiveTrend: () =>
    `Your metrics have been improving over the past several days`
};

const readinessRecommendations = [
  "This is a great time to tackle challenging projects",
  "Consider taking on stretch assignments",
  "Your focus and energy levels are optimal for deep work",
  "Great time for important meetings or presentations"
];
```

## Zone Transition Detection

```typescript
function detectZoneTransition(
  currentZone: Zone,
  previousZone: Zone
): ZoneTransition | null {
  if (currentZone === previousZone) return null;

  return {
    from: previousZone,
    to: currentZone,
    timestamp: new Date(),
    shouldAlert: currentZone === 'red' || currentZone === 'green',
    alertType: currentZone === 'red' ? 'burnout' : 'opportunity'
  };
}
```

---

## Non-Linear Interaction Effects

### Problem
The linear model (`score = f1*0.25 + f2*0.25 + ...`) doesn't capture synergy where combined stressors are worse than their sum.

### Solution
The `calculateInteractionEffects()` function applies penalties when multiple factors exceed thresholds simultaneously.

```javascript
const interactionPairs = [
  { factors: ['sleepDeficit', 'workOverload'], multiplier: 1.3, name: 'Sleep-Work Stress' },
  { factors: ['hrvStress', 'workOverload'], multiplier: 1.25, name: 'Physiological-Work Stress' },
  { factors: ['sleepDeficit', 'hrvStress'], multiplier: 1.2, name: 'Sleep-Physiological Stress' },
  { factors: ['sleepDeficit', 'recoveryDeficit'], multiplier: 1.35, name: 'Cumulative Recovery Deficit' },
];
```

When both factors in a pair exceed the `high` threshold (default: 50), a synergy penalty is calculated:

```javascript
synergy = sqrt((factor1 - threshold) * (factor2 - threshold)) * (multiplier - 1)
```

The total interaction penalty is capped at 30 points to prevent runaway scores.

### Example
If sleepDeficit = 65 and workOverload = 70, both exceed threshold 50:
- excess1 = 65 - 50 = 15
- excess2 = 70 - 50 = 20
- synergy = sqrt(15 * 20) * 0.3 = 5.2 points added to burnout score

---

## Configurable Thresholds

### Database Tables

```sql
-- Organization-level defaults
CREATE TABLE organization_thresholds (
  organization_id UUID,
  burnout_red_threshold INTEGER DEFAULT 70,
  readiness_green_threshold INTEGER DEFAULT 70,
  threshold_type VARCHAR(20) DEFAULT 'absolute',  -- 'absolute' or 'percentile'
  interaction_high_threshold INTEGER DEFAULT 50,
  enable_interaction_effects BOOLEAN DEFAULT true,
  weekend_adjustment_enabled BOOLEAN DEFAULT true
);

-- Individual overrides
CREATE TABLE employee_threshold_overrides (
  employee_id UUID,
  burnout_red_threshold INTEGER,
  readiness_green_threshold INTEGER,
  override_reason TEXT,
  start_date DATE,
  end_date DATE  -- NULL for permanent
);
```

### Threshold Resolution Order
1. Active employee override (if exists and within date range)
2. Organization threshold (if employee belongs to organization)
3. System default (70/70)

### Percentile-Based Thresholds
When `threshold_type = 'percentile'`, thresholds are calculated dynamically based on the organization's historical score distribution.

---

## Context Awareness

### Day-of-Week Adjustments

```javascript
const dayPatterns = {
  0: { workloadExpectation: 0.3, label: 'Weekend Recovery' },   // Sunday
  1: { workloadExpectation: 1.1, label: 'Monday Transition' },
  5: { workloadExpectation: 0.85, label: 'Friday Wind-Down' },
  6: { workloadExpectation: 0.3, label: 'Weekend Recovery' },   // Saturday
  // 2,3,4 default to 1.0
};
```

On weekends/Fridays, work overload penalties are reduced proportionally.

### Vacation Fatigue Factor

Fatigue accumulates progressively when an employee hasn't had a "good recovery day" (green zone with readiness >= 80):

| Days Since Rest | Fatigue Penalty | Level |
|-----------------|-----------------|-------|
| 0-14 | 0 | Normal |
| 15-21 | +5 | Moderate |
| 22-30 | +10 | Elevated |
| 31+ | +15 | High |

A `needsBreak` flag is set when days since rest exceeds 21.

---

## Self-Report Calibration

### Purpose
Adjust algorithmic scores based on the employee's subjective experience from feeling check-ins.

### Calculation

1. Gather last 14 days of check-ins (minimum 3 required)
2. Convert self-reported feelings to burnout scale:
   - `selfReportedBurnout = (5 - avgFeeling) * 20 + (avgStress - 1) * 10`
3. Compare with algorithmic scores at check-in time
4. Calculate calibration factor:
   - `factor = 1 + (selfReportedBurnout - avgAlgorithmic) / 100`
   - Bounded to 0.8 - 1.2 (±20% adjustment)

### Example
- Average feeling: 2.5 (out of 5)
- Average stress: 4.0 (out of 5)
- Self-reported burnout: (5 - 2.5) * 20 + (4 - 1) * 10 = 50 + 30 = 80
- Algorithmic average: 65
- Discrepancy: 80 - 65 = 15
- Calibration factor: 1 + 15/100 = 1.15 (scores adjusted up by 15%)

---

## Privacy-Preserving Team Aggregates

### Minimum Team Size
Aggregate views require at least **5 team members** to protect individual privacy.

### Available Aggregates

```javascript
{
  teamHealthScore: 75,        // Weighted score (0-100)
  zoneDistribution: { red: 1, yellow: 3, green: 6 },
  burnoutDistribution: { low: 5, moderate: 3, high: 2 },  // Bucketed
  weeklyTrend: [...],         // Last 4 weeks
  trendDirection: 'improving' | 'stable' | 'worsening',
  actionItems: [...]          // Prioritized recommendations
}
```

### Consent Management
Employees can opt out of aggregate contribution via `scoring_consent.allow_aggregate_contribution`.

---

## API Endpoints

### Consent Management
- `GET /api/personalization/consent` - Get consent settings
- `PUT /api/personalization/consent` - Update consent settings

### Team Aggregates
- `GET /api/teams/wellness-overview` - Privacy-preserving aggregate view
- `GET /api/teams/aggregates-consented` - Aggregates respecting consent

### Validated Self-Report
- `GET /api/personalization/burnout-questions` - Get assessment questions
- `POST /api/personalization/checkins/validated` - Create check-in with validated responses

## Demo Data Generation

For synthetic individuals, generate data that demonstrates the algorithms:

```typescript
const profiles = {
  peakPerformer: {
    sleepHours: { mean: 7.8, stdDev: 0.3 },
    sleepQuality: { mean: 85, stdDev: 5 },
    hrv: { mean: 55, stdDev: 5 },
    hoursWorked: { mean: 7.5, stdDev: 0.5 },
    // Results in: high readiness, low burnout → GREEN
  },

  moderateStress: {
    sleepHours: { mean: 6.5, stdDev: 0.5 },
    sleepQuality: { mean: 65, stdDev: 10 },
    hrv: { mean: 42, stdDev: 8 },
    hoursWorked: { mean: 8.5, stdDev: 1 },
    // Results in: moderate both → YELLOW
  },

  highBurnout: {
    sleepHours: { mean: 5.5, stdDev: 0.8 },
    sleepQuality: { mean: 50, stdDev: 15 },
    hrv: { mean: 32, stdDev: 10 },
    hoursWorked: { mean: 10, stdDev: 1.5 },
    // Results in: high burnout → RED
  },

  recovery: {
    // Start with burnout profile, gradually improve
    trajectory: 'improving',
    startDay: 'highBurnout',
    endDay: 'peakPerformer',
    transitionDays: 14
  },

  variable: {
    // Oscillate between profiles
    pattern: ['moderateStress', 'peakPerformer', 'moderateStress', 'highBurnout'],
    cycleDays: 7
  }
};
```
