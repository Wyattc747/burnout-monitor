const express = require('express');
const db = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { forceZoneTransition } = require('../services/alertService');
const { sendAlertNotification } = require('../services/smsService');

const router = express.Router();

// All routes require authentication and manager role
router.use(authenticate);
router.use(requireRole('manager'));

// POST /api/demo/trigger-alert - Force a zone transition
router.post('/trigger-alert', async (req, res) => {
  try {
    const { employeeId, targetZone } = req.body;

    if (!employeeId || !targetZone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'employeeId and targetZone are required',
      });
    }

    if (!['red', 'green'].includes(targetZone)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'targetZone must be "red" or "green"',
      });
    }

    // Verify employee exists
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1', [employeeId]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    // Force the zone transition and create alert
    const alert = await forceZoneTransition(employeeId, targetZone);

    // Send SMS notifications
    await sendAlertNotification(alert);

    res.json(alert);
  } catch (err) {
    console.error('Trigger alert error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to trigger alert' });
  }
});

// POST /api/demo/advance-time - Fast-forward simulation time
router.post('/advance-time', async (req, res) => {
  try {
    const { days = 1 } = req.body;

    // Get current demo state
    const stateResult = await db.query('SELECT * FROM demo_state WHERE id = 1');
    let virtualTime = stateResult.rows[0]?.virtual_time || new Date();

    // Advance time
    virtualTime = new Date(virtualTime);
    virtualTime.setDate(virtualTime.getDate() + days);

    // Update demo state
    await db.query(`
      UPDATE demo_state
      SET virtual_time = $1, is_active = true, updated_at = NOW()
      WHERE id = 1
    `, [virtualTime]);

    // Check all employees for zone transitions at the new time
    const employees = await db.query('SELECT id FROM employees WHERE is_active = true');
    let alertsGenerated = 0;

    for (const emp of employees.rows) {
      // Get data for the simulated date
      const dateStr = virtualTime.toISOString().split('T')[0];

      const healthResult = await db.query(`
        SELECT * FROM health_metrics
        WHERE employee_id = $1 AND date <= $2
        ORDER BY date DESC
        LIMIT 1
      `, [emp.id, dateStr]);

      const workResult = await db.query(`
        SELECT * FROM work_metrics
        WHERE employee_id = $1 AND date <= $2
        ORDER BY date DESC
        LIMIT 1
      `, [emp.id, dateStr]);

      if (healthResult.rows.length > 0 && workResult.rows.length > 0) {
        // Import here to avoid circular dependency
        const { checkAndCreateAlerts } = require('../services/alertService');
        const alert = await checkAndCreateAlerts(emp.id);
        if (alert) {
          await sendAlertNotification(alert);
          alertsGenerated++;
        }
      }
    }

    res.json({
      virtualTime: virtualTime.toISOString(),
      alertsGenerated,
    });
  } catch (err) {
    console.error('Advance time error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to advance time' });
  }
});

// POST /api/demo/reset - Reset demo to initial state
router.post('/reset', async (req, res) => {
  try {
    // Reset demo state
    await db.query(`
      UPDATE demo_state
      SET is_active = false, virtual_time = NULL, updated_at = NOW()
      WHERE id = 1
    `);

    // Delete all alerts
    await db.query('DELETE FROM alerts');

    // Delete all SMS logs
    await db.query('DELETE FROM sms_logs');

    // Reset zone history to just today's data
    const today = new Date().toISOString().split('T')[0];
    await db.query('DELETE FROM zone_history WHERE date != $1', [today]);

    // Get employee count for response
    const empResult = await db.query('SELECT COUNT(*) FROM employees WHERE is_active = true');

    res.json({
      message: 'Demo reset complete',
      employeesReset: parseInt(empResult.rows[0].count),
    });
  } catch (err) {
    console.error('Demo reset error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to reset demo' });
  }
});

// GET /api/demo/state - Get current demo state
router.get('/state', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM demo_state WHERE id = 1');

    if (result.rows.length === 0) {
      return res.json({
        isActive: false,
        virtualTime: null,
      });
    }

    const row = result.rows[0];
    res.json({
      isActive: row.is_active,
      virtualTime: row.virtual_time,
    });
  } catch (err) {
    console.error('Get demo state error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get demo state' });
  }
});

// POST /api/demo/seed-features - Seed all new feature demo data
router.post('/seed-features', async (req, res) => {
  try {
    // Get all employees
    const employees = await db.query('SELECT id FROM employees WHERE is_active = true');

    for (const emp of employees.rows) {
      const employeeId = emp.id;

      // Seed wellness streaks
      const streakDays = Math.floor(Math.random() * 30) + 1;
      await db.query(`
        INSERT INTO wellness_streaks (
          employee_id,
          current_checkin_streak, longest_checkin_streak, last_checkin_date,
          current_sleep_streak, longest_sleep_streak,
          current_exercise_streak, longest_exercise_streak,
          current_green_streak, longest_green_streak,
          total_points, badges
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (employee_id) DO UPDATE SET
          current_checkin_streak = $2,
          longest_checkin_streak = $3,
          last_checkin_date = CURRENT_DATE,
          current_sleep_streak = $4,
          longest_sleep_streak = $5,
          current_exercise_streak = $6,
          longest_exercise_streak = $7,
          current_green_streak = $8,
          longest_green_streak = $9,
          total_points = $10,
          badges = $11,
          updated_at = CURRENT_TIMESTAMP
      `, [
        employeeId,
        streakDays,
        Math.max(streakDays, Math.floor(Math.random() * 45) + 5),
        Math.floor(Math.random() * 20),
        Math.floor(Math.random() * 30) + 10,
        Math.floor(Math.random() * 15),
        Math.floor(Math.random() * 25) + 5,
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 20) + 3,
        streakDays * 10 + Math.floor(Math.random() * 500),
        JSON.stringify(streakDays >= 7 ? [{ id: 'week_warrior', name: '7-Day Warrior', earnedAt: new Date().toISOString() }] : [])
      ]);

      // Seed email metrics for last 14 days
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const emailsSent = Math.floor(Math.random() * 30) + 5;
        const emailsReceived = Math.floor(Math.random() * 50) + 10;
        const outsideHours = Math.floor(Math.random() * 5);

        await db.query(`
          INSERT INTO email_metrics (
            employee_id, date, emails_received, emails_sent, emails_read,
            emails_outside_hours, earliest_email_time, latest_email_time, active_threads
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (employee_id, date) DO UPDATE SET
            emails_received = $3,
            emails_sent = $4,
            emails_read = $5,
            emails_outside_hours = $6,
            updated_at = CURRENT_TIMESTAMP
        `, [
          employeeId, dateStr, emailsReceived, emailsSent,
          Math.floor(emailsReceived * 0.8), outsideHours,
          '08:' + String(Math.floor(Math.random() * 30)).padStart(2, '0'),
          '18:' + String(Math.floor(Math.random() * 60)).padStart(2, '0'),
          emailsSent + emailsReceived
        ]);
      }

      // Seed detected patterns
      const patterns = [
        { type: 'correlation', title: 'Sleep impacts your productivity', desc: 'When you sleep 7+ hours, your task completion rate increases by 23%', impact: 'positive', confidence: 87 },
        { type: 'trend', title: 'Meeting load increasing', desc: 'Your meeting hours have increased 15% over the past 2 weeks', impact: 'negative', confidence: 92 },
        { type: 'anomaly', title: 'Unusual work pattern detected', desc: 'You worked 3 hours past your normal end time on Tuesday', impact: 'negative', confidence: 95 },
        { type: 'prediction', title: 'Recovery opportunity ahead', desc: 'Your calendar shows lighter meetings next week - great time to catch up on focus work', impact: 'positive', confidence: 78 },
      ];

      // Add 1-2 random patterns per employee
      const numPatterns = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numPatterns; i++) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        await db.query(`
          INSERT INTO detected_patterns (
            employee_id, pattern_type, title, description,
            confidence, impact, time_period, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, 'weekly', true)
        `, [employeeId, pattern.type, pattern.title, pattern.desc, pattern.confidence, pattern.impact]);
      }

      // Seed predictive alerts (only for some employees)
      if (Math.random() > 0.5) {
        const alertTypes = [
          { type: 'burnout_risk', severity: 'medium', title: 'Burnout risk detected', message: 'Based on your recent patterns, you may be at risk of burnout in the next 2 weeks. Consider taking breaks and reducing overtime.', days: 14 },
          { type: 'declining_trend', severity: 'low', title: 'Sleep quality declining', message: 'Your sleep quality has decreased 15% this week. Try to maintain consistent sleep times.', days: 7 },
          { type: 'recovery_opportunity', severity: 'low', title: 'Great recovery week ahead', message: 'Your schedule looks lighter next week. This is a good opportunity to focus on wellness.', days: 5 },
        ];

        const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        await db.query(`
          INSERT INTO predictive_alerts (
            employee_id, alert_type, severity, title, message,
            confidence, days_until_predicted, recommendations
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          employeeId, alert.type, alert.severity, alert.title, alert.message,
          Math.floor(Math.random() * 20) + 70, alert.days,
          JSON.stringify(['Take regular breaks', 'Prioritize sleep', 'Schedule focus time'])
        ]);
      }
    }

    // Seed meeting suggestions for managers
    const managers = await db.query(`
      SELECT e.id FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE u.role = 'manager' AND e.is_active = true
    `);

    for (const manager of managers.rows) {
      // Get team members
      const teamMembers = await db.query(`
        SELECT id, first_name, last_name FROM employees
        WHERE manager_id = $1 AND is_active = true
        LIMIT 3
      `, [manager.id]);

      for (const member of teamMembers.rows) {
        const reasons = ['declining_wellness', 'needs_support', 'celebrate_success', 'routine_checkin'];
        const urgencies = ['low', 'normal', 'high'];

        // Create suggested meeting times
        const suggestedTimes = [];
        for (let i = 0; i < 3; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i + 1);
          date.setHours(10 + i * 2, 0, 0, 0);
          suggestedTimes.push({
            start: date.toISOString(),
            end: new Date(date.getTime() + 30 * 60000).toISOString()
          });
        }

        await db.query(`
          INSERT INTO meeting_suggestions (
            manager_id, employee_id, suggested_reason, urgency, suggested_times, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [
          manager.id, member.id,
          reasons[Math.floor(Math.random() * reasons.length)],
          urgencies[Math.floor(Math.random() * urgencies.length)],
          JSON.stringify(suggestedTimes)
        ]);
      }
    }

    // Seed team heatmap data (zone_history for past 30 days if not exists)
    for (const emp of employees.rows) {
      for (let i = 1; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const zones = ['green', 'green', 'green', 'yellow', 'yellow', 'red'];
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const burnoutScore = zone === 'red' ? 70 + Math.random() * 30 : zone === 'yellow' ? 40 + Math.random() * 30 : 10 + Math.random() * 30;
        const readinessScore = 100 - burnoutScore + (Math.random() * 20 - 10);

        await db.query(`
          INSERT INTO zone_history (employee_id, date, zone, burnout_score, readiness_score)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [emp.id, dateStr, zone, burnoutScore, Math.max(0, Math.min(100, readinessScore))]);
      }
    }

    res.json({
      success: true,
      message: 'Demo data seeded for all features',
      employeesProcessed: employees.rows.length,
      managersProcessed: managers.rows.length,
    });
  } catch (err) {
    console.error('Seed features error:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

module.exports = router;
