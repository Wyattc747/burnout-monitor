const express = require('express');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/alerts - Get alerts (filtered by role)
router.get('/', async (req, res) => {
  try {
    const { acknowledged, type, limit = 50 } = req.query;

    let query = `
      SELECT
        a.id,
        a.employee_id,
        e.first_name || ' ' || e.last_name AS employee_name,
        a.type,
        a.zone,
        a.title,
        a.message,
        a.is_acknowledged,
        a.acknowledged_at,
        a.sms_sent,
        a.created_at
      FROM alerts a
      JOIN employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by role - employees can only see their own alerts
    if (req.user.role === 'employee' && req.user.employeeId) {
      query += ` AND a.employee_id = $${paramIndex}`;
      params.push(req.user.employeeId);
      paramIndex++;
    }

    // Filter by acknowledged status
    if (acknowledged !== undefined) {
      query += ` AND a.is_acknowledged = $${paramIndex}`;
      params.push(acknowledged === 'true');
      paramIndex++;
    }

    // Filter by type
    if (type) {
      query += ` AND a.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    const alerts = result.rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      type: row.type,
      zone: row.zone,
      title: row.title,
      message: row.message,
      isAcknowledged: row.is_acknowledged,
      acknowledgedAt: row.acknowledged_at,
      smsSent: row.sms_sent,
      createdAt: row.created_at,
    }));

    res.json(alerts);
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get alerts' });
  }
});

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alert exists and user has access
    const checkResult = await db.query(`
      SELECT a.id, a.employee_id
      FROM alerts a
      WHERE a.id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Alert not found' });
    }

    // Employees can only acknowledge their own alerts
    if (req.user.role === 'employee' && req.user.employeeId !== checkResult.rows[0].employee_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only acknowledge your own alerts' });
    }

    // Acknowledge the alert
    const result = await db.query(`
      UPDATE alerts
      SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = NOW()
      WHERE id = $2
      RETURNING id, employee_id, type, zone, title, message, is_acknowledged, acknowledged_at, created_at
    `, [req.user.userId, id]);

    // Get employee name
    const empResult = await db.query(`
      SELECT first_name || ' ' || last_name AS name FROM employees WHERE id = $1
    `, [result.rows[0].employee_id]);

    const row = result.rows[0];
    res.json({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: empResult.rows[0]?.name || 'Unknown',
      type: row.type,
      zone: row.zone,
      title: row.title,
      message: row.message,
      isAcknowledged: row.is_acknowledged,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Acknowledge alert error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to acknowledge alert' });
  }
});

module.exports = router;
