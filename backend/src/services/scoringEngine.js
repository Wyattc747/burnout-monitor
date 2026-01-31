/**
 * Burnout & Readiness Scoring Engine
 * Calculates employee wellness scores with personalization support
 */

const db = require('../utils/db');

/**
 * Get personalized settings for an employee
 */
async function getPersonalizedSettings(employeeId) {
  // Get personal preferences
  const prefResult = await db.query(`
    SELECT * FROM personal_preferences WHERE employee_id = $1
  `, [employeeId]);

  // Get active life events
  const eventsResult = await db.query(`
    SELECT * FROM life_events
    WHERE employee_id = $1
      AND is_active = true
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  `, [employeeId]);

  const preferences = prefResult.rows[0] || null;
  const activeEvents = eventsResult.rows || [];

  // Calculate combined life event adjustments
  const lifeEventAdjustments = {
    sleep: 0,
    work: 0,
    exercise: 0,
    stressTolerance: 0,
  };

  for (const event of activeEvents) {
    lifeEventAdjustments.sleep += event.sleep_adjustment || 0;
    lifeEventAdjustments.work += event.work_adjustment || 0;
    lifeEventAdjustments.exercise += event.exercise_adjustment || 0;
    lifeEventAdjustments.stressTolerance += event.stress_tolerance_adjustment || 0;
  }

  return {
    preferences,
    activeEvents,
    adjustments: lifeEventAdjustments,
  };
}

/**
 * Apply personalization to baselines
 */
function applyPersonalization(baselines, preferences, adjustments) {
  const personalized = { ...baselines };

  if (preferences) {
    // Use personal ideal values instead of generic baselines
    personalized.baselineSleepHours = preferences.ideal_sleep_hours || baselines.baselineSleepHours;
    personalized.baselineHoursWorked = preferences.ideal_work_hours || baselines.baselineHoursWorked;
    personalized.idealExerciseMinutes = preferences.ideal_exercise_minutes || 30;
    personalized.maxMeetingHours = preferences.max_meeting_hours_daily || 4;

    // Factor weights
    personalized.weightSleep = (preferences.weight_sleep || 50) / 100;
    personalized.weightExercise = (preferences.weight_exercise || 30) / 100;
    personalized.weightWorkload = (preferences.weight_workload || 50) / 100;
    personalized.weightMeetings = (preferences.weight_meetings || 40) / 100;
    personalized.weightHeartMetrics = (preferences.weight_heart_metrics || 30) / 100;

    // Chronotype affects when we expect peak performance
    personalized.chronotype = preferences.chronotype;

    // Social energy type affects meeting tolerance
    if (preferences.social_energy_type === 'introvert') {
      personalized.maxMeetingHours *= 0.75; // Introverts need fewer meetings
    } else if (preferences.social_energy_type === 'extrovert') {
      personalized.maxMeetingHours *= 1.25; // Extroverts handle more meetings
    }

    // Sleep flexibility affects tolerance for variation
    personalized.sleepFlexibility = preferences.sleep_flexibility;
  }

  // Apply life event adjustments
  if (adjustments) {
    // Negative adjustments mean we expect less (reduce baseline)
    personalized.adjustedSleepExpectation = personalized.baselineSleepHours * (1 + adjustments.sleep / 100);
    personalized.adjustedWorkExpectation = personalized.baselineHoursWorked * (1 + adjustments.work / 100);
    personalized.adjustedExerciseExpectation = (personalized.idealExerciseMinutes || 30) * (1 + adjustments.exercise / 100);
    personalized.stressToleranceAdjustment = adjustments.stressTolerance;
  } else {
    personalized.adjustedSleepExpectation = personalized.baselineSleepHours;
    personalized.adjustedWorkExpectation = personalized.baselineHoursWorked;
    personalized.adjustedExerciseExpectation = personalized.idealExerciseMinutes || 30;
    personalized.stressToleranceAdjustment = 0;
  }

  return personalized;
}

/**
 * Calculate burnout score (0-100, higher = more risk)
 */
function calculateBurnoutScore(health, work, baselines, personalized = null) {
  const settings = personalized || baselines;
  const factors = [];

  // Get personalized weights or use defaults
  const weights = {
    sleep: settings.weightSleep || 0.25,
    hrv: settings.weightHeartMetrics || 0.25,
    work: settings.weightWorkload || 0.25,
    recovery: 0.25, // Always include recovery
  };

  // Normalize weights to sum to 1
  const totalWeight = weights.sleep + weights.hrv + weights.work + weights.recovery;
  Object.keys(weights).forEach(k => weights[k] /= totalWeight);

  // Factor 1: Sleep Deficit
  const sleepDeficit = calculateSleepDeficitFactor(health, settings);
  factors.push({
    name: 'Sleep Quality',
    rawValue: health.sleepHours,
    normalizedScore: sleepDeficit,
    weight: weights.sleep,
    impact: sleepDeficit > 50 ? 'negative' : sleepDeficit < 30 ? 'positive' : 'neutral',
    category: 'burnout',
    personalized: !!personalized,
  });

  // Factor 2: HRV Stress
  const hrvStress = calculateHRVStressFactor(health, settings);
  factors.push({
    name: 'Stress Level (HRV)',
    rawValue: health.heartRateVariability,
    normalizedScore: hrvStress,
    weight: weights.hrv,
    impact: hrvStress > 50 ? 'negative' : hrvStress < 30 ? 'positive' : 'neutral',
    category: 'burnout',
  });

  // Factor 3: Work Overload
  const workOverload = calculateWorkOverloadFactor(work, settings);
  factors.push({
    name: 'Work Hours',
    rawValue: work.hoursWorked,
    normalizedScore: workOverload,
    weight: weights.work,
    impact: workOverload > 50 ? 'negative' : workOverload < 30 ? 'positive' : 'neutral',
    category: 'burnout',
  });

  // Factor 4: Recovery Deficit
  const recoveryDeficit = calculateRecoveryDeficitFactor(health, settings);
  factors.push({
    name: 'Recovery',
    rawValue: health.deepSleepHours,
    normalizedScore: recoveryDeficit,
    weight: weights.recovery,
    impact: recoveryDeficit > 50 ? 'negative' : recoveryDeficit < 30 ? 'positive' : 'neutral',
    category: 'burnout',
  });

  const score =
    sleepDeficit * weights.sleep +
    hrvStress * weights.hrv +
    workOverload * weights.work +
    recoveryDeficit * weights.recovery;

  return { score: Math.min(100, Math.max(0, score)), factors };
}

/**
 * Calculate readiness score (0-100, higher = more ready)
 */
function calculateReadinessScore(health, work, baselines, personalized = null) {
  const settings = personalized || baselines;
  const factors = [];

  // Get personalized weights
  const weights = {
    sleepQuality: settings.weightSleep || 0.30,
    hrv: settings.weightHeartMetrics || 0.30,
    work: settings.weightWorkload || 0.20,
    activity: settings.weightExercise || 0.20,
  };

  // Normalize weights
  const totalWeight = weights.sleepQuality + weights.hrv + weights.work + weights.activity;
  Object.keys(weights).forEach(k => weights[k] /= totalWeight);

  // Factor 1: Sleep Quality
  const sleepQuality = calculateSleepQualityFactor(health, settings);
  factors.push({
    name: 'Sleep Quality',
    rawValue: health.sleepQualityScore,
    normalizedScore: sleepQuality,
    weight: weights.sleepQuality,
    impact: sleepQuality > 70 ? 'positive' : sleepQuality < 40 ? 'negative' : 'neutral',
    category: 'readiness',
  });

  // Factor 2: HRV Recovery
  const hrvRecovery = calculateHRVRecoveryFactor(health, settings);
  factors.push({
    name: 'HRV Recovery',
    rawValue: health.heartRateVariability,
    normalizedScore: hrvRecovery,
    weight: weights.hrv,
    impact: hrvRecovery > 70 ? 'positive' : hrvRecovery < 40 ? 'negative' : 'neutral',
    category: 'readiness',
  });

  // Factor 3: Work Balance
  const workBalance = calculateWorkBalanceFactor(work, settings);
  factors.push({
    name: 'Work-Life Balance',
    rawValue: work.hoursWorked,
    normalizedScore: workBalance,
    weight: weights.work,
    impact: workBalance > 70 ? 'positive' : workBalance < 40 ? 'negative' : 'neutral',
    category: 'readiness',
  });

  // Factor 4: Activity Balance
  const activityBalance = calculateActivityBalanceFactor(health, settings);
  factors.push({
    name: 'Activity Level',
    rawValue: health.exerciseMinutes,
    normalizedScore: activityBalance,
    weight: weights.activity,
    impact: activityBalance > 70 ? 'positive' : activityBalance < 40 ? 'negative' : 'neutral',
    category: 'readiness',
  });

  const score =
    sleepQuality * weights.sleepQuality +
    hrvRecovery * weights.hrv +
    workBalance * weights.work +
    activityBalance * weights.activity;

  return { score: Math.min(100, Math.max(0, score)), factors };
}

// === Burnout Factor Calculations ===

function calculateSleepDeficitFactor(health, settings) {
  const baselineSleep = settings.adjustedSleepExpectation || settings.baselineSleepHours || 7;

  const sleepRatio = health.sleepHours / baselineSleep;
  const qualityRatio = health.sleepQualityScore / (settings.baselineSleepQuality || 70);

  const combinedRatio = sleepRatio * 0.6 + qualityRatio * 0.4;

  // Apply flexibility factor
  let tolerance = 0.1; // 10% tolerance by default
  if (settings.sleepFlexibility === 'rigid') tolerance = 0.05;
  if (settings.sleepFlexibility === 'flexible') tolerance = 0.15;

  if (combinedRatio >= 1.0 - tolerance) return 0;
  if (combinedRatio <= 0.6) return 100;

  return (1 - combinedRatio) * 250;
}

function calculateHRVStressFactor(health, settings) {
  if (!settings.baselineHrv) return 50;

  const hrvRatio = health.heartRateVariability / settings.baselineHrv;
  const hrRatio = health.restingHeartRate / (settings.baselineRestingHr || 65);

  // Apply stress tolerance adjustment from life events
  const toleranceBonus = (settings.stressToleranceAdjustment || 0) / 100;

  if (hrvRatio >= (1.0 - toleranceBonus) && hrRatio <= (1.0 + toleranceBonus)) return 0;
  if (hrvRatio <= 0.7 || hrRatio >= 1.2) return 100;

  const hrvScore = Math.max(0, (1 - hrvRatio) * 166);
  const hrScore = Math.max(0, (hrRatio - 1) * 500);

  return Math.min(100, hrvScore * 0.6 + hrScore * 0.4);
}

function calculateWorkOverloadFactor(work, settings) {
  const baselineHours = settings.adjustedWorkExpectation || settings.baselineHoursWorked || 8;
  const maxMeetings = settings.maxMeetingHours || 4;

  const hoursRatio = work.hoursWorked / baselineHours;
  const overtimePenalty = (work.overtimeHours || 0) * 10;

  // Meeting penalty based on personalized max
  const meetingHours = work.meetingHours || (work.meetingsAttended || 0) * 0.75;
  const meetingPenalty = Math.max(0, meetingHours - maxMeetings) * 10;

  const baseScore = Math.max(0, (hoursRatio - 1) * 100);

  return Math.min(100, baseScore + overtimePenalty + meetingPenalty);
}

function calculateRecoveryDeficitFactor(health, settings) {
  const baselineSleep = settings.adjustedSleepExpectation || settings.baselineSleepHours || 7;
  const expectedDeepSleep = baselineSleep * 0.2;
  const deepSleepRatio = (health.deepSleepHours || 1.4) / expectedDeepSleep;

  const recoveryScore = health.recoveryScore || 50;

  const deepSleepDeficit = Math.max(0, (1 - deepSleepRatio) * 50);
  const recoveryDeficit = Math.max(0, (100 - recoveryScore) * 0.5);

  return Math.min(100, deepSleepDeficit + recoveryDeficit);
}

// === Readiness Factor Calculations ===

function calculateSleepQualityFactor(health, settings) {
  const baselineSleep = settings.adjustedSleepExpectation || settings.baselineSleepHours || 7;
  const hoursRatio = health.sleepHours / baselineSleep;
  const qualityScore = health.sleepQualityScore || 70;
  const deepSleepRatio = (health.deepSleepHours || 1.4) / (health.sleepHours * 0.2 || 1.4);

  if (hoursRatio < 0.85) return Math.min(50, qualityScore * 0.5);

  const bonus = hoursRatio > 1.1 ? 10 : 0;

  return Math.min(100, qualityScore * Math.min(1.2, deepSleepRatio) + bonus);
}

function calculateHRVRecoveryFactor(health, settings) {
  if (!settings.baselineHrv) return 50;

  const hrvRatio = health.heartRateVariability / settings.baselineHrv;
  const hrRatio = (settings.baselineRestingHr || 65) / health.restingHeartRate;

  if (hrvRatio >= 1.1 && hrRatio >= 1.0) return 100;
  if (hrvRatio < 0.8 || hrRatio < 0.9) return Math.max(0, hrvRatio * 50);

  return Math.min(100, hrvRatio * 50 + hrRatio * 50);
}

function calculateWorkBalanceFactor(work, settings) {
  const baselineHours = settings.adjustedWorkExpectation || settings.baselineHoursWorked || 8;
  const hoursRatio = work.hoursWorked / baselineHours;
  const noOvertimeBonus = (work.overtimeHours || 0) === 0 ? 20 : 0;
  const efficiency =
    work.tasksAssigned > 0 ? work.tasksCompleted / work.tasksAssigned : 1;

  if (hoursRatio > 1.1) return Math.max(0, 50 - (hoursRatio - 1.1) * 200);

  const baseScore = 60 + noOvertimeBonus;
  return Math.min(100, baseScore + efficiency * 20);
}

function calculateActivityBalanceFactor(health, settings) {
  const exerciseMinutes = health.exerciseMinutes || 0;
  const idealMinutes = settings.adjustedExerciseExpectation || settings.idealExerciseMinutes || 30;
  const importance = settings.exerciseImportance || 'moderate';

  // Scale sensitivity based on importance
  let sensitivity = 1;
  if (importance === 'low') sensitivity = 0.5;
  if (importance === 'high') sensitivity = 1.5;

  // Optimal range based on ideal
  const minOptimal = idealMinutes * 0.8;
  const maxOptimal = idealMinutes * 1.5;

  if (exerciseMinutes >= minOptimal && exerciseMinutes <= maxOptimal) return 100;
  if (exerciseMinutes < idealMinutes * 0.3) return 40 * sensitivity;
  if (exerciseMinutes > idealMinutes * 2.5) return 60; // Over-exercise

  if (exerciseMinutes < minOptimal) {
    const ratio = exerciseMinutes / minOptimal;
    return 40 + (ratio * 60);
  }

  return 100 - ((exerciseMinutes - maxOptimal) / idealMinutes) * 40;
}

/**
 * Determine zone based on scores
 */
function determineZone(burnoutScore, readinessScore) {
  if (burnoutScore >= 70) return 'red';
  if (readinessScore >= 70) return 'green';
  return 'yellow';
}

/**
 * Generate human-readable explanation for current zone
 */
function generateExplanation(burnoutScore, readinessScore, burnoutFactors, readinessFactors, settings, personalization = null) {
  const zone = determineZone(burnoutScore, readinessScore);

  // Combine and sort factors by impact
  const allFactors = [...burnoutFactors, ...readinessFactors];
  const sortedFactors = allFactors
    .map((f) => ({
      ...f,
      absoluteImpact: Math.abs(f.normalizedScore - 50) * f.weight,
    }))
    .sort((a, b) => b.absoluteImpact - a.absoluteImpact);

  // Generate human-readable explanations for top factors
  const humanFactors = sortedFactors.slice(0, 4).map((f) => ({
    name: f.name,
    impact: f.impact,
    value: formatFactorValue(f, settings),
    description: generateFactorDescription(f, zone, settings, personalization),
    weight: f.weight,
  }));

  // Generate recommendations
  const recommendations = generateRecommendations(zone, sortedFactors, personalization);

  // Add personalization context to explanation
  const context = {};
  if (personalization) {
    if (personalization.activeEvents && personalization.activeEvents.length > 0) {
      context.activeLifeEvents = personalization.activeEvents.map(e => ({
        label: e.event_label,
        impact: 'Expectations adjusted for this period',
      }));
    }
    if (personalization.preferences) {
      context.usingPersonalBaselines = true;
      context.chronotype = personalization.preferences.chronotype;
    }
  }

  return {
    zone,
    burnoutScore: Math.round(burnoutScore),
    readinessScore: Math.round(readinessScore),
    factors: humanFactors,
    recommendations,
    context: Object.keys(context).length > 0 ? context : undefined,
  };
}

function formatFactorValue(factor, settings) {
  switch (factor.name) {
    case 'Sleep Quality':
      const sleepBaseline = settings.adjustedSleepExpectation || settings.baselineSleepHours || 7;
      const sleepDiff = ((factor.rawValue - sleepBaseline) / sleepBaseline) * 100;
      const sleepLabel = settings.adjustedSleepExpectation !== settings.baselineSleepHours
        ? ' (adjusted)'
        : '';
      return `${sleepDiff >= 0 ? '+' : ''}${Math.round(sleepDiff)}% vs your ideal${sleepLabel}`;

    case 'Stress Level (HRV)':
    case 'HRV Recovery':
      const hrvBaseline = settings.baselineHrv || 45;
      const hrvDiff = ((factor.rawValue - hrvBaseline) / hrvBaseline) * 100;
      return `${hrvDiff >= 0 ? '+' : ''}${Math.round(hrvDiff)}% vs baseline`;

    case 'Work Hours':
    case 'Work-Life Balance':
      const workBaseline = settings.adjustedWorkExpectation || settings.baselineHoursWorked || 8;
      const workDiff = ((factor.rawValue - workBaseline) / workBaseline) * 100;
      return `${workDiff >= 0 ? '+' : ''}${Math.round(workDiff)}% vs your ideal`;

    case 'Activity Level':
      const idealExercise = settings.idealExerciseMinutes || 30;
      const exerciseDiff = factor.rawValue - idealExercise;
      if (Math.abs(exerciseDiff) < 5) return `${factor.rawValue} min (on target)`;
      return `${factor.rawValue} min (${exerciseDiff > 0 ? '+' : ''}${exerciseDiff} from ideal)`;

    default:
      return `Score: ${Math.round(factor.normalizedScore)}`;
  }
}

function generateFactorDescription(factor, zone, settings, personalization) {
  // Add personalized context to descriptions
  const hasLifeEvent = personalization?.activeEvents?.length > 0;
  const eventLabel = hasLifeEvent ? personalization.activeEvents[0].event_label : null;

  const templates = {
    'Sleep Quality': {
      negative: hasLifeEvent
        ? `Your sleep is below your adjusted expectation during ${eventLabel}`
        : 'Your sleep has been below your personal ideal recently',
      positive: 'Your sleep quality has been excellent for you',
      neutral: 'Your sleep is consistent with your personal baseline',
    },
    'Stress Level (HRV)': {
      negative: hasLifeEvent
        ? `Your HRV indicates elevated stress, which is expected during ${eventLabel}`
        : 'Your HRV indicates elevated stress levels',
      positive: 'Your HRV shows good recovery and low stress',
      neutral: 'Your stress indicators are within your normal range',
    },
    'HRV Recovery': {
      negative: 'Your recovery metrics indicate you need more rest',
      positive: 'Your body is showing strong recovery signals',
      neutral: 'Your recovery is at your baseline levels',
    },
    'Work Hours': {
      negative: hasLifeEvent
        ? `Working more than adjusted expectations for ${eventLabel}`
        : "You've been working more than your ideal hours",
      positive: "You've maintained your ideal work hours",
      neutral: 'Your work hours are consistent with your preferences',
    },
    'Work-Life Balance': {
      negative: 'Your work-life balance may need attention based on your preferences',
      positive: "You've maintained a healthy work-life balance",
      neutral: 'Your work-life balance is stable',
    },
    'Recovery': {
      negative: 'Your deep sleep and recovery time has been lower than your needs',
      positive: "You're getting quality restorative sleep",
      neutral: 'Your recovery metrics are meeting your needs',
    },
    'Activity Level': {
      negative: `Your activity level is below your ${settings.idealExerciseMinutes || 30} minute goal`,
      positive: "You're hitting your personal activity goals",
      neutral: 'Your activity is within your target range',
    },
  };

  const template = templates[factor.name] || {
    negative: 'This factor is affecting you negatively',
    positive: 'This factor is contributing positively',
    neutral: 'This factor is within normal range',
  };

  return template[factor.impact];
}

function generateRecommendations(zone, factors, personalization) {
  const personalRecommendations = [];
  const leadershipRecommendations = [];

  const hasLifeEvent = personalization?.activeEvents?.length > 0;
  const chronotype = personalization?.preferences?.chronotype;
  const socialType = personalization?.preferences?.social_energy_type;

  if (zone === 'red') {
    // Personalized recommendations based on profile
    if (hasLifeEvent) {
      personalRecommendations.push(`During this time, focus on essentials and be gentle with yourself`);
    }

    personalRecommendations.push('Take short breaks every 90 minutes to prevent mental fatigue');

    if (chronotype === 'night_owl') {
      personalRecommendations.push('As a night owl, try to protect your evening productivity hours');
    } else if (chronotype === 'early_bird') {
      personalRecommendations.push('As an early bird, prioritize your most important work in the morning');
    }

    if (socialType === 'introvert') {
      personalRecommendations.push('Block quiet time on your calendar to recharge between meetings');
    }

    const sleepFactor = factors.find((f) => f.name === 'Sleep Quality');
    if (sleepFactor && sleepFactor.impact === 'negative') {
      personalRecommendations.push('Prioritize getting your ideal sleep hours - set a bedtime alarm');
    }

    personalRecommendations.push('Consider using the wellness resources in the app');

    // Leadership recommendations
    leadershipRecommendations.push('DIVERSION: Reassign non-critical tasks to reduce workload by 20-30%');

    if (hasLifeEvent) {
      const eventLabel = personalization.activeEvents[0].event_label;
      leadershipRecommendations.push(`CONTEXT: Employee is experiencing "${eventLabel}" - expectations adjusted`);
    }

    leadershipRecommendations.push('SUPPORT: Schedule a 1:1 check-in to discuss priorities');
    leadershipRecommendations.push('PROTECT: Shield from new project requests until recovery');

    if (socialType === 'introvert') {
      leadershipRecommendations.push('MEETINGS: Reduce meeting load - this person recharges with alone time');
    }

  } else if (zone === 'green') {
    personalRecommendations.push('This is a great time to tackle challenging projects');

    if (chronotype === 'night_owl') {
      personalRecommendations.push('Schedule your creative work in the evening when you peak');
    } else if (chronotype === 'early_bird') {
      personalRecommendations.push('Tackle your hardest problems in the morning');
    }

    if (socialType === 'extrovert') {
      personalRecommendations.push('Great time for collaborative work and team projects');
    }

    personalRecommendations.push("Maintain your current wellness routine - it's working!");

    // Leadership recommendations
    leadershipRecommendations.push('OPPORTUNITY: Assign high-impact, challenging projects');
    leadershipRecommendations.push('GROWTH: Offer stretch assignments or leadership opportunities');

    if (socialType === 'extrovert') {
      leadershipRecommendations.push('MENTORSHIP: Leverage their energy to support struggling teammates');
    }

    leadershipRecommendations.push('RECOGNITION: Acknowledge their peak performance state');

  } else {
    // Yellow zone
    personalRecommendations.push('Maintain your current routine and monitor trends');

    if (hasLifeEvent) {
      personalRecommendations.push(`You're managing ${personalization.activeEvents[0].event_label} well`);
    }

    personalRecommendations.push('Focus on consistent sleep schedule this week');

    // Leadership recommendations
    leadershipRecommendations.push('MONITOR: Keep standard workload, watch for trend changes');
    leadershipRecommendations.push('BALANCE: Ensure mix of challenging and routine tasks');
    leadershipRecommendations.push('CHECK-IN: Brief weekly sync to gauge wellbeing');
  }

  return {
    personal: personalRecommendations.slice(0, 6),
    leadership: leadershipRecommendations.slice(0, 6),
  };
}

/**
 * Calculate all scores for an employee with personalization
 */
async function calculateEmployeeScoresPersonalized(employeeId, health, work, baselines) {
  // Get personalized settings
  const personalization = await getPersonalizedSettings(employeeId);

  // Apply personalization to baselines
  const personalizedSettings = applyPersonalization(baselines, personalization.preferences, personalization.adjustments);

  // Calculate scores with personalized settings
  const burnout = calculateBurnoutScore(health, work, baselines, personalizedSettings);
  const readiness = calculateReadinessScore(health, work, baselines, personalizedSettings);
  const zone = determineZone(burnout.score, readiness.score);

  const explanation = generateExplanation(
    burnout.score,
    readiness.score,
    burnout.factors,
    readiness.factors,
    personalizedSettings,
    personalization
  );

  return {
    burnoutScore: Math.round(burnout.score),
    readinessScore: Math.round(readiness.score),
    zone,
    explanation,
    personalized: !!personalization.preferences,
  };
}

/**
 * Calculate all scores for an employee (backward compatible)
 */
function calculateEmployeeScores(health, work, baselines) {
  const burnout = calculateBurnoutScore(health, work, baselines);
  const readiness = calculateReadinessScore(health, work, baselines);
  const zone = determineZone(burnout.score, readiness.score);

  const explanation = generateExplanation(
    burnout.score,
    readiness.score,
    burnout.factors,
    readiness.factors,
    baselines
  );

  return {
    burnoutScore: Math.round(burnout.score),
    readinessScore: Math.round(readiness.score),
    zone,
    explanation,
  };
}

module.exports = {
  calculateBurnoutScore,
  calculateReadinessScore,
  determineZone,
  generateExplanation,
  calculateEmployeeScores,
  calculateEmployeeScoresPersonalized,
  getPersonalizedSettings,
  applyPersonalization,
};
