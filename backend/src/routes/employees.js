const express = require('express');
const db = require('../utils/db');
const { authenticate, requireRole, canAccessEmployee, canAccessHealthData } = require('../middleware/auth');
const { calculateEmployeeScores, calculateEmployeeScoresPersonalized } = require('../services/scoringEngine');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/employees - List all employees (manager only)
router.get('/', requireRole('manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        e.id,
        e.first_name,
        e.last_name,
        e.email,
        e.department,
        e.job_title,
        zh.zone,
        zh.burnout_score,
        zh.readiness_score
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT zone, burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = e.id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE e.is_active = true
      ORDER BY e.last_name, e.first_name
    `);

    const employees = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      department: row.department,
      jobTitle: row.job_title,
      zone: row.zone || 'yellow',
      burnoutScore: row.burnout_score ? parseFloat(row.burnout_score) : null,
      readinessScore: row.readiness_score ? parseFloat(row.readiness_score) : null,
    }));

    res.json(employees);
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get employees' });
  }
});

// GET /api/employees/:id - Get employee details
router.get('/:id', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        e.id,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.department,
        e.job_title,
        e.hire_date,
        zh.zone,
        zh.burnout_score,
        zh.readiness_score,
        zh.date as status_date
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT zone, burnout_score, readiness_score, date
        FROM zone_history
        WHERE employee_id = e.id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE e.id = $1 AND e.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      department: row.department,
      jobTitle: row.job_title,
      hireDate: row.hire_date,
      zone: row.zone || 'yellow',
      burnoutScore: row.burnout_score ? parseFloat(row.burnout_score) : null,
      readinessScore: row.readiness_score ? parseFloat(row.readiness_score) : null,
      statusDate: row.status_date,
    });
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get employee' });
  }
});

// GET /api/employees/:id/health - Get health metrics (PRIVATE - employee only)
router.get('/:id/health', canAccessHealthData, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    let query = `
      SELECT
        date,
        resting_heart_rate,
        avg_heart_rate,
        heart_rate_variability,
        sleep_hours,
        sleep_quality_score,
        deep_sleep_hours,
        rem_sleep_hours,
        core_sleep_hours,
        awake_sleep_hours,
        steps,
        exercise_minutes,
        stress_level,
        recovery_score
      FROM health_metrics
      WHERE employee_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    const metrics = result.rows.map(row => ({
      date: row.date,
      restingHeartRate: row.resting_heart_rate,
      avgHeartRate: row.avg_heart_rate,
      heartRateVariability: row.heart_rate_variability ? parseFloat(row.heart_rate_variability) : null,
      sleepHours: row.sleep_hours ? parseFloat(row.sleep_hours) : null,
      sleepQualityScore: row.sleep_quality_score,
      deepSleepHours: row.deep_sleep_hours ? parseFloat(row.deep_sleep_hours) : null,
      remSleepHours: row.rem_sleep_hours ? parseFloat(row.rem_sleep_hours) : null,
      coreSleepHours: row.core_sleep_hours ? parseFloat(row.core_sleep_hours) : null,
      awakeSleepHours: row.awake_sleep_hours ? parseFloat(row.awake_sleep_hours) : null,
      steps: row.steps,
      exerciseMinutes: row.exercise_minutes,
      stressLevel: row.stress_level,
      recoveryScore: row.recovery_score,
    }));

    res.json(metrics);
  } catch (err) {
    console.error('Get health metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get health metrics' });
  }
});

// GET /api/employees/:id/work - Get work metrics
router.get('/:id/work', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    let query = `
      SELECT
        date,
        hours_worked,
        overtime_hours,
        tasks_completed,
        tasks_assigned,
        meetings_attended,
        meeting_hours,
        emails_sent,
        emails_received,
        avg_response_time_minutes,
        focus_time_hours,
        context_switches
      FROM work_metrics
      WHERE employee_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    const metrics = result.rows.map(row => ({
      date: row.date,
      hoursWorked: row.hours_worked ? parseFloat(row.hours_worked) : null,
      overtimeHours: row.overtime_hours ? parseFloat(row.overtime_hours) : null,
      tasksCompleted: row.tasks_completed,
      tasksAssigned: row.tasks_assigned,
      meetingsAttended: row.meetings_attended,
      meetingHours: row.meeting_hours ? parseFloat(row.meeting_hours) : null,
      emailsSent: row.emails_sent,
      emailsReceived: row.emails_received,
      avgResponseTimeMinutes: row.avg_response_time_minutes,
      focusTimeHours: row.focus_time_hours ? parseFloat(row.focus_time_hours) : null,
      contextSwitches: row.context_switches,
    }));

    res.json(metrics);
  } catch (err) {
    console.error('Get work metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get work metrics' });
  }
});

// GET /api/employees/:id/email-metrics - Get email metrics (for managers)
router.get('/:id/email-metrics', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 14 } = req.query;

    const result = await db.query(`
      SELECT
        date,
        emails_received,
        emails_sent,
        emails_read,
        emails_outside_hours,
        earliest_email_time,
        latest_email_time
      FROM email_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT $2
    `, [id, parseInt(limit)]);

    const metrics = result.rows.map(row => ({
      date: row.date,
      emailsReceived: row.emails_received || 0,
      emailsSent: row.emails_sent || 0,
      emailsRead: row.emails_read || 0,
      emailsOutsideHours: row.emails_outside_hours || 0,
      earliestEmailTime: row.earliest_email_time,
      latestEmailTime: row.latest_email_time,
    }));

    res.json(metrics);
  } catch (err) {
    console.error('Get email metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get email metrics' });
  }
});

// GET /api/employees/:id/burnout - Get burnout score history
router.get('/:id/burnout', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;

    const result = await db.query(`
      SELECT date, burnout_score, readiness_score, zone
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT $2
    `, [id, parseInt(limit)]);

    if (result.rows.length === 0) {
      return res.json({ current: null, history: [] });
    }

    const current = {
      zone: result.rows[0].zone,
      burnoutScore: parseFloat(result.rows[0].burnout_score),
      readinessScore: parseFloat(result.rows[0].readiness_score),
      date: result.rows[0].date,
    };

    const history = result.rows.map(row => ({
      zone: row.zone,
      burnoutScore: parseFloat(row.burnout_score),
      readinessScore: parseFloat(row.readiness_score),
      date: row.date,
    }));

    res.json({ current, history });
  } catch (err) {
    console.error('Get burnout history error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get burnout history' });
  }
});

// GET /api/employees/:id/readiness - Get readiness score history
router.get('/:id/readiness', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;

    const result = await db.query(`
      SELECT date, burnout_score, readiness_score, zone
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT $2
    `, [id, parseInt(limit)]);

    if (result.rows.length === 0) {
      return res.json({ current: null, history: [] });
    }

    const current = {
      zone: result.rows[0].zone,
      burnoutScore: parseFloat(result.rows[0].burnout_score),
      readinessScore: parseFloat(result.rows[0].readiness_score),
      date: result.rows[0].date,
    };

    const history = result.rows.map(row => ({
      zone: row.zone,
      burnoutScore: parseFloat(row.burnout_score),
      readinessScore: parseFloat(row.readiness_score),
      date: row.date,
    }));

    res.json({ current, history });
  } catch (err) {
    console.error('Get readiness history error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get readiness history' });
  }
});

// GET /api/employees/:id/explanation - Get zone explanation
router.get('/:id/explanation', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;

    // Get latest zone history with explanation
    const zoneResult = await db.query(`
      SELECT zone, burnout_score, readiness_score, explanation, date
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [id]);

    if (zoneResult.rows.length > 0 && zoneResult.rows[0].explanation) {
      // Return stored explanation
      const row = zoneResult.rows[0];
      return res.json({
        zone: row.zone,
        burnoutScore: parseFloat(row.burnout_score),
        readinessScore: parseFloat(row.readiness_score),
        ...row.explanation,
      });
    }

    // Calculate fresh explanation if no stored one
    const healthResult = await db.query(`
      SELECT * FROM health_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [id]);

    const workResult = await db.query(`
      SELECT * FROM work_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [id]);

    const baselineResult = await db.query(`
      SELECT * FROM employee_baselines
      WHERE employee_id = $1
    `, [id]);

    if (healthResult.rows.length === 0 || workResult.rows.length === 0) {
      return res.json({
        zone: 'yellow',
        burnoutScore: 50,
        readinessScore: 50,
        factors: [],
        recommendations: ['Insufficient data to provide detailed analysis'],
      });
    }

    const health = {
      sleepHours: parseFloat(healthResult.rows[0].sleep_hours) || 7,
      sleepQualityScore: healthResult.rows[0].sleep_quality_score || 70,
      heartRateVariability: parseFloat(healthResult.rows[0].heart_rate_variability) || 45,
      restingHeartRate: healthResult.rows[0].resting_heart_rate || 65,
      deepSleepHours: parseFloat(healthResult.rows[0].deep_sleep_hours) || 1.4,
      exerciseMinutes: healthResult.rows[0].exercise_minutes || 30,
      recoveryScore: healthResult.rows[0].recovery_score || 70,
    };

    const work = {
      hoursWorked: parseFloat(workResult.rows[0].hours_worked) || 8,
      overtimeHours: parseFloat(workResult.rows[0].overtime_hours) || 0,
      tasksCompleted: workResult.rows[0].tasks_completed || 5,
      tasksAssigned: workResult.rows[0].tasks_assigned || 5,
      meetingsAttended: workResult.rows[0].meetings_attended || 3,
    };

    const baselines = baselineResult.rows.length > 0 ? {
      baselineSleepHours: parseFloat(baselineResult.rows[0].baseline_sleep_hours) || 7,
      baselineSleepQuality: parseFloat(baselineResult.rows[0].baseline_sleep_quality) || 70,
      baselineHrv: parseFloat(baselineResult.rows[0].baseline_hrv) || 45,
      baselineRestingHr: parseFloat(baselineResult.rows[0].baseline_resting_hr) || 65,
      baselineHoursWorked: parseFloat(baselineResult.rows[0].baseline_hours_worked) || 8,
    } : {
      baselineSleepHours: 7,
      baselineSleepQuality: 70,
      baselineHrv: 45,
      baselineRestingHr: 65,
      baselineHoursWorked: 8,
    };

    // Use personalized scoring if available
    const scores = await calculateEmployeeScoresPersonalized(id, health, work, baselines);

    res.json(scores.explanation);
  } catch (err) {
    console.error('Get explanation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get explanation' });
  }
});

// GET /api/employees/:id/prediction - Get burnout trajectory prediction
router.get('/:id/prediction', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;

    // Get last 14 days of zone history for trend analysis
    const historyResult = await db.query(`
      SELECT date, burnout_score, readiness_score, zone
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 14
    `, [id]);

    if (historyResult.rows.length < 3) {
      return res.json({
        hasPrediction: false,
        message: 'Insufficient data for prediction',
        daysOfData: historyResult.rows.length,
      });
    }

    const history = historyResult.rows.reverse(); // Oldest first
    const currentScore = parseFloat(history[history.length - 1].burnout_score);
    const currentZone = history[history.length - 1].zone;

    // Calculate trend using linear regression
    const n = history.length;
    const scores = history.map(h => parseFloat(h.burnout_score));
    const xSum = (n * (n - 1)) / 2;
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    const ySum = scores.reduce((a, b) => a + b, 0);
    const xySum = scores.reduce((sum, y, x) => sum + x * y, 0);

    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    const dailyChange = slope;

    // Predict days until RED zone (burnout_score >= 70)
    const redThreshold = 70;
    let daysUntilRed = null;
    let predictedTrajectory = [];

    if (dailyChange > 0 && currentScore < redThreshold) {
      daysUntilRed = Math.ceil((redThreshold - currentScore) / dailyChange);
      if (daysUntilRed > 30) daysUntilRed = null; // Don't predict beyond 30 days
    }

    // Generate 7-day forecast
    for (let i = 1; i <= 7; i++) {
      const predictedScore = Math.min(100, Math.max(0, currentScore + dailyChange * i));
      const predictedZone = predictedScore >= 70 ? 'red' : predictedScore <= 30 ? 'green' : 'yellow';
      predictedTrajectory.push({
        day: i,
        predictedScore: Math.round(predictedScore),
        predictedZone,
        confidence: Math.max(50, 95 - i * 5), // Confidence decreases over time
      });
    }

    // Determine trend direction and severity
    let trendDirection = 'stable';
    let trendSeverity = 'low';

    if (dailyChange > 2) {
      trendDirection = 'worsening';
      trendSeverity = dailyChange > 4 ? 'high' : 'medium';
    } else if (dailyChange < -2) {
      trendDirection = 'improving';
      trendSeverity = dailyChange < -4 ? 'high' : 'medium';
    }

    res.json({
      hasPrediction: true,
      currentScore: Math.round(currentScore),
      currentZone,
      trend: {
        direction: trendDirection,
        severity: trendSeverity,
        dailyChange: Math.round(dailyChange * 10) / 10,
        description: trendDirection === 'worsening'
          ? `Burnout risk increasing by ~${Math.abs(Math.round(dailyChange))} points/day`
          : trendDirection === 'improving'
            ? `Burnout risk decreasing by ~${Math.abs(Math.round(dailyChange))} points/day`
            : 'Burnout risk is stable',
      },
      daysUntilRed: daysUntilRed,
      redZoneWarning: daysUntilRed !== null && daysUntilRed <= 7
        ? `At current pace, you may reach burnout risk in ${daysUntilRed} day${daysUntilRed === 1 ? '' : 's'}`
        : null,
      forecast: predictedTrajectory,
      daysAnalyzed: n,
    });
  } catch (err) {
    console.error('Get prediction error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get prediction' });
  }
});

// GET /api/employees/:id/recommended-resources - Get personalized wellness resource recommendations
router.get('/:id/recommended-resources', canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;

    // Get current zone and explanation factors
    const zoneResult = await db.query(`
      SELECT zone, burnout_score, readiness_score, explanation
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [id]);

    if (zoneResult.rows.length === 0) {
      return res.json({ recommendations: [] });
    }

    const { zone, burnout_score, explanation } = zoneResult.rows[0];
    const factors = explanation?.factors || [];

    // Map factors to resource categories
    const categoryMapping = {
      'Sleep Quality': ['sleep', 'mindfulness'],
      'Stress Level (HRV)': ['stress', 'mindfulness'],
      'Work Hours': ['productivity', 'stress'],
      'Recovery': ['sleep', 'exercise'],
      'Activity Level': ['exercise'],
      'Work-Life Balance': ['productivity', 'mindfulness'],
    };

    // Find negative factors and map to categories
    const neededCategories = new Set();
    factors.forEach(f => {
      if (f.impact === 'negative' && categoryMapping[f.name]) {
        categoryMapping[f.name].forEach(cat => neededCategories.add(cat));
      }
    });

    // If in red zone, always include stress resources
    if (zone === 'red') {
      neededCategories.add('stress');
      neededCategories.add('mindfulness');
    }

    // Default categories if none identified
    if (neededCategories.size === 0) {
      neededCategories.add('mindfulness');
      neededCategories.add('productivity');
    }

    // Fetch matching resources
    const resourcesResult = await db.query(`
      SELECT id, title, description, content_type, category, duration_minutes, difficulty
      FROM wellness_resources
      WHERE category = ANY($1) AND is_active = true
      ORDER BY
        CASE WHEN category = 'stress' THEN 0 ELSE 1 END,
        view_count DESC NULLS LAST
      LIMIT 6
    `, [Array.from(neededCategories)]);

    const recommendations = resourcesResult.rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      contentType: r.content_type,
      category: r.category,
      durationMinutes: r.duration_minutes,
      difficulty: r.difficulty,
      reason: getRecommendationReason(r.category, zone, factors),
    }));

    res.json({
      zone,
      burnoutScore: parseFloat(burnout_score),
      targetedCategories: Array.from(neededCategories),
      recommendations,
    });
  } catch (err) {
    console.error('Get recommended resources error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get recommendations' });
  }
});

function getRecommendationReason(category, zone, factors) {
  const reasons = {
    stress: zone === 'red'
      ? 'Recommended to help manage your elevated stress levels'
      : 'Good for maintaining low stress',
    sleep: 'Can help improve your sleep quality',
    mindfulness: 'Helps with mental clarity and stress reduction',
    exercise: 'Physical activity can boost energy and mood',
    productivity: 'Tips to work smarter, not harder',
    nutrition: 'Fuel your body for better performance',
  };
  return reasons[category] || 'Recommended for your wellness';
}

module.exports = router;
