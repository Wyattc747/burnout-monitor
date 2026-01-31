const db = require('../utils/db');
const { calculateEmployeeScores } = require('./scoringEngine');

async function checkAndCreateAlerts(employeeId) {
  try {
    // Get latest health metrics
    const healthResult = await db.query(`
      SELECT * FROM health_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    // Get latest work metrics
    const workResult = await db.query(`
      SELECT * FROM work_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    // Get baselines
    const baselineResult = await db.query(`
      SELECT * FROM employee_baselines
      WHERE employee_id = $1
    `, [employeeId]);

    // Get previous zone
    const prevZoneResult = await db.query(`
      SELECT zone FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    if (healthResult.rows.length === 0 || workResult.rows.length === 0) {
      return null;
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

    const scores = calculateEmployeeScores(health, work, baselines);
    const currentZone = scores.zone;
    const previousZone = prevZoneResult.rows.length > 0 ? prevZoneResult.rows[0].zone : 'yellow';

    // Store zone history
    const today = new Date().toISOString().split('T')[0];
    await db.query(`
      INSERT INTO zone_history (employee_id, date, burnout_score, readiness_score, zone, previous_zone, zone_changed, explanation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (employee_id, date)
      DO UPDATE SET burnout_score = $3, readiness_score = $4, zone = $5, previous_zone = $6, zone_changed = $7, explanation = $8
    `, [employeeId, today, scores.burnoutScore, scores.readinessScore, currentZone, previousZone, currentZone !== previousZone, JSON.stringify(scores.explanation)]);

    // Create alert if zone changed to red or green
    if (currentZone !== previousZone && (currentZone === 'red' || currentZone === 'green')) {
      const alert = await createAlert(employeeId, currentZone);
      return alert;
    }

    return null;
  } catch (err) {
    console.error('Check and create alerts error:', err);
    throw err;
  }
}

async function createAlert(employeeId, zone) {
  try {
    // Get employee info
    const empResult = await db.query(`
      SELECT first_name, last_name FROM employees WHERE id = $1
    `, [employeeId]);

    if (empResult.rows.length === 0) {
      throw new Error('Employee not found');
    }

    const employeeName = `${empResult.rows[0].first_name} ${empResult.rows[0].last_name}`;

    const alertType = zone === 'red' ? 'burnout' : 'opportunity';
    const title = zone === 'red'
      ? `${employeeName} has entered burnout risk zone`
      : `${employeeName} is in peak performance condition`;
    const message = zone === 'red'
      ? `${employeeName} is showing signs of burnout and may need workload reduction. Check the dashboard for details.`
      : `${employeeName} is well-rested and in optimal condition for challenging work. Consider assigning stretch projects.`;

    const result = await db.query(`
      INSERT INTO alerts (employee_id, type, zone, title, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, employee_id, type, zone, title, message, is_acknowledged, created_at
    `, [employeeId, alertType, zone, title, message]);

    return {
      id: result.rows[0].id,
      employeeId: result.rows[0].employee_id,
      employeeName,
      type: result.rows[0].type,
      zone: result.rows[0].zone,
      title: result.rows[0].title,
      message: result.rows[0].message,
      isAcknowledged: result.rows[0].is_acknowledged,
      createdAt: result.rows[0].created_at,
    };
  } catch (err) {
    console.error('Create alert error:', err);
    throw err;
  }
}

async function forceZoneTransition(employeeId, targetZone) {
  try {
    // Get employee info
    const empResult = await db.query(`
      SELECT first_name, last_name FROM employees WHERE id = $1
    `, [employeeId]);

    if (empResult.rows.length === 0) {
      throw new Error('Employee not found');
    }

    // Get current zone
    const zoneResult = await db.query(`
      SELECT zone FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    const previousZone = zoneResult.rows.length > 0 ? zoneResult.rows[0].zone : 'yellow';

    // Create zone history entry for the transition
    const today = new Date().toISOString().split('T')[0];
    const burnoutScore = targetZone === 'red' ? 85 : targetZone === 'green' ? 25 : 50;
    const readinessScore = targetZone === 'green' ? 85 : targetZone === 'red' ? 25 : 50;

    await db.query(`
      INSERT INTO zone_history (employee_id, date, burnout_score, readiness_score, zone, previous_zone, zone_changed, explanation)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      ON CONFLICT (employee_id, date)
      DO UPDATE SET burnout_score = $3, readiness_score = $4, zone = $5, previous_zone = $6, zone_changed = true, explanation = $7
    `, [employeeId, today, burnoutScore, readinessScore, targetZone, previousZone, JSON.stringify({
      zone: targetZone,
      burnoutScore,
      readinessScore,
      factors: [{
        name: 'Demo Triggered',
        impact: targetZone === 'red' ? 'negative' : 'positive',
        value: 'Manual transition',
        description: 'Zone was manually triggered for demo purposes',
        weight: 1,
      }],
      recommendations: targetZone === 'red'
        ? ['This is a demo alert - in real usage, consider workload reduction']
        : ['This is a demo alert - in real usage, consider assigning challenging work'],
    })]);

    // Create the alert
    const alert = await createAlert(employeeId, targetZone);

    return alert;
  } catch (err) {
    console.error('Force zone transition error:', err);
    throw err;
  }
}

module.exports = {
  checkAndCreateAlerts,
  createAlert,
  forceZoneTransition,
};
