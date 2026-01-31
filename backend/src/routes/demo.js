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

module.exports = router;
