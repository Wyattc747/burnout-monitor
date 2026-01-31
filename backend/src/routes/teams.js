const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// TEAM MANAGEMENT (Manager only)
// ============================================

// GET /api/teams/members - Get manager's team members
router.get('/members', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;

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
      WHERE e.manager_id = $1 AND e.is_active = true
      ORDER BY e.last_name, e.first_name
    `, [managerEmployeeId]);

    const members = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      department: row.department,
      jobTitle: row.job_title,
      zone: row.zone || 'yellow',
      burnoutScore: row.burnout_score ? parseFloat(row.burnout_score) : null,
      readinessScore: row.readiness_score ? parseFloat(row.readiness_score) : null,
      statusDate: row.status_date,
    }));

    res.json(members);
  } catch (err) {
    console.error('Get team members error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get team members' });
  }
});

// GET /api/teams/available - Get employees not on any team
router.get('/available', requireRole('manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        e.id,
        e.first_name,
        e.last_name,
        e.email,
        e.department,
        e.job_title
      FROM employees e
      WHERE e.manager_id IS NULL
        AND e.is_active = true
        AND e.id != $1
      ORDER BY e.last_name, e.first_name
    `, [req.user.employeeId]);

    const employees = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      department: row.department,
      jobTitle: row.job_title,
    }));

    res.json(employees);
  } catch (err) {
    console.error('Get available employees error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get available employees' });
  }
});

// POST /api/teams/members/:employeeId - Add employee to team
router.post('/members/:employeeId', requireRole('manager'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const managerEmployeeId = req.user.employeeId;

    // Check if employee exists and isn't already on a team
    const employeeResult = await db.query(`
      SELECT id, manager_id FROM employees WHERE id = $1 AND is_active = true
    `, [employeeId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    if (employeeResult.rows[0].manager_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Employee is already on another team',
      });
    }

    // Add to team
    await db.query(`
      UPDATE employees SET manager_id = $1 WHERE id = $2
    `, [managerEmployeeId, employeeId]);

    res.json({ success: true, message: 'Employee added to team' });
  } catch (err) {
    console.error('Add team member error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to add team member' });
  }
});

// DELETE /api/teams/members/:employeeId - Remove employee from team
router.delete('/members/:employeeId', requireRole('manager'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const managerEmployeeId = req.user.employeeId;

    // Check if employee is on this manager's team
    const employeeResult = await db.query(`
      SELECT id FROM employees WHERE id = $1 AND manager_id = $2
    `, [employeeId, managerEmployeeId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not on your team',
      });
    }

    // Remove from team
    await db.query(`
      UPDATE employees SET manager_id = NULL WHERE id = $1
    `, [employeeId]);

    res.json({ success: true, message: 'Employee removed from team' });
  } catch (err) {
    console.error('Remove team member error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to remove team member' });
  }
});

// ============================================
// TEAM INVITATIONS
// ============================================

// GET /api/teams/invitations - Get pending invitations
router.get('/invitations', requireRole('manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, email, status, created_at, expires_at
      FROM team_invitations
      WHERE inviter_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [req.user.userId]);

    res.json(result.rows.map(row => ({
      id: row.id,
      email: row.email,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })));
  } catch (err) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get invitations' });
  }
});

// POST /api/teams/invitations - Send invitation
router.post('/invitations', requireRole('manager'), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
    }

    // Check if already invited
    const existingResult = await db.query(`
      SELECT id FROM team_invitations
      WHERE email = $1 AND status = 'pending' AND expires_at > NOW()
    `, [email]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invitation already pending for this email',
      });
    }

    // Check if user already exists
    const userResult = await db.query(`
      SELECT e.id, e.manager_id
      FROM users u
      JOIN employees e ON u.employee_id = e.id
      WHERE u.email = $1
    `, [email]);

    if (userResult.rows.length > 0) {
      const employee = userResult.rows[0];
      if (employee.manager_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User is already on a team',
        });
      }

      // Add directly to team if user exists
      await db.query(`
        UPDATE employees SET manager_id = $1 WHERE id = $2
      `, [req.user.employeeId, employee.id]);

      return res.json({
        success: true,
        message: 'Existing user added to team',
        addedDirectly: true,
      });
    }

    // Create invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.query(`
      INSERT INTO team_invitations (inviter_id, email, token, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [req.user.userId, email, token, expiresAt]);

    // TODO: Send invitation email

    res.status(201).json({
      success: true,
      message: 'Invitation sent',
      token, // In production, this would be sent via email
    });
  } catch (err) {
    console.error('Send invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to send invitation' });
  }
});

// DELETE /api/teams/invitations/:id - Cancel invitation
router.delete('/invitations/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE team_invitations
      SET status = 'expired'
      WHERE id = $1 AND inviter_id = $2 AND status = 'pending'
      RETURNING id
    `, [id, req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Invitation not found' });
    }

    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (err) {
    console.error('Cancel invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to cancel invitation' });
  }
});

// POST /api/teams/invitations/accept - Accept invitation (by new user)
router.post('/invitations/accept', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Bad Request', message: 'Token is required' });
    }

    const inviteResult = await db.query(`
      SELECT ti.*, u.employee_id as inviter_employee_id
      FROM team_invitations ti
      JOIN users u ON ti.inviter_id = u.id
      WHERE ti.token = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
    `, [token]);

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invalid or expired invitation',
      });
    }

    const invitation = inviteResult.rows[0];

    // If user is authenticated, add them to the team
    if (req.user && req.user.employeeId) {
      await db.query(`
        UPDATE employees SET manager_id = $1 WHERE id = $2
      `, [invitation.inviter_employee_id, req.user.employeeId]);

      await db.query(`
        UPDATE team_invitations SET status = 'accepted', accepted_at = NOW()
        WHERE id = $1
      `, [invitation.id]);

      return res.json({ success: true, message: 'You have been added to the team' });
    }

    // Otherwise, return invitation details for registration
    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        inviterEmployeeId: invitation.inviter_employee_id,
      },
    });
  } catch (err) {
    console.error('Accept invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to accept invitation' });
  }
});

// ============================================
// TEAM AGGREGATES (Anonymous data for managers)
// ============================================

// GET /api/teams/aggregates - Get anonymous team wellness aggregates
router.get('/aggregates', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;

    // Get aggregate zone distribution
    const zoneResult = await db.query(`
      SELECT
        COALESCE(zh.zone, 'yellow') as zone,
        COUNT(*) as count
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT zone
        FROM zone_history
        WHERE employee_id = e.id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE e.manager_id = $1 AND e.is_active = true
      GROUP BY zh.zone
    `, [managerEmployeeId]);

    // Get average scores
    const avgResult = await db.query(`
      SELECT
        AVG(zh.burnout_score) as avg_burnout,
        AVG(zh.readiness_score) as avg_readiness,
        COUNT(*) as total_employees
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = e.id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE e.manager_id = $1 AND e.is_active = true
    `, [managerEmployeeId]);

    // Get trend (compare last 7 days to previous 7 days)
    const trendResult = await db.query(`
      WITH recent AS (
        SELECT AVG(zh.burnout_score) as avg_burnout
        FROM employees e
        CROSS JOIN LATERAL (
          SELECT burnout_score
          FROM zone_history
          WHERE employee_id = e.id
            AND date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY date DESC
          LIMIT 1
        ) zh
        WHERE e.manager_id = $1 AND e.is_active = true
      ),
      previous AS (
        SELECT AVG(zh.burnout_score) as avg_burnout
        FROM employees e
        CROSS JOIN LATERAL (
          SELECT burnout_score
          FROM zone_history
          WHERE employee_id = e.id
            AND date >= CURRENT_DATE - INTERVAL '14 days'
            AND date < CURRENT_DATE - INTERVAL '7 days'
          ORDER BY date DESC
          LIMIT 1
        ) zh
        WHERE e.manager_id = $1 AND e.is_active = true
      )
      SELECT
        recent.avg_burnout as recent_avg,
        previous.avg_burnout as previous_avg
      FROM recent, previous
    `, [managerEmployeeId]);

    const zones = {};
    zoneResult.rows.forEach(row => {
      zones[row.zone] = parseInt(row.count);
    });

    const avg = avgResult.rows[0];
    const trend = trendResult.rows[0];

    res.json({
      zoneDistribution: {
        red: zones.red || 0,
        yellow: zones.yellow || 0,
        green: zones.green || 0,
      },
      averageScores: {
        burnout: avg.avg_burnout ? parseFloat(avg.avg_burnout).toFixed(1) : null,
        readiness: avg.avg_readiness ? parseFloat(avg.avg_readiness).toFixed(1) : null,
      },
      totalEmployees: parseInt(avg.total_employees),
      trend: trend.recent_avg && trend.previous_avg
        ? trend.recent_avg > trend.previous_avg ? 'worsening'
          : trend.recent_avg < trend.previous_avg ? 'improving'
          : 'stable'
        : 'insufficient_data',
    });
  } catch (err) {
    console.error('Get team aggregates error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get team aggregates' });
  }
});

// GET /api/teams/heatmap - Get team burnout heatmap data
router.get('/heatmap', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;
    const { days = 14 } = req.query;

    const result = await db.query(`
      SELECT
        e.id,
        e.first_name,
        e.last_name,
        zh.date,
        zh.zone,
        zh.burnout_score
      FROM employees e
      LEFT JOIN zone_history zh ON e.id = zh.employee_id
        AND zh.date >= CURRENT_DATE - INTERVAL '1 day' * $2
      WHERE e.manager_id = $1 AND e.is_active = true
      ORDER BY e.last_name, e.first_name, zh.date
    `, [managerEmployeeId, parseInt(days)]);

    // Group by employee
    const employeeData = {};
    result.rows.forEach(row => {
      if (!employeeData[row.id]) {
        employeeData[row.id] = {
          id: row.id,
          name: `${row.first_name} ${row.last_name}`,
          history: [],
        };
      }
      if (row.date) {
        employeeData[row.id].history.push({
          date: row.date,
          zone: row.zone,
          burnoutScore: row.burnout_score ? parseFloat(row.burnout_score) : null,
        });
      }
    });

    res.json(Object.values(employeeData));
  } catch (err) {
    console.error('Get team heatmap error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get heatmap data' });
  }
});

// ============================================
// 1:1 MEETING SUGGESTIONS
// ============================================

// GET /api/teams/meeting-suggestions - Get 1:1 meeting suggestions
router.get('/meeting-suggestions', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;

    // Find employees who might need a 1:1
    const result = await db.query(`
      SELECT
        e.id,
        e.first_name,
        e.last_name,
        zh.zone,
        zh.burnout_score,
        CASE
          WHEN zh.zone = 'red' THEN 'urgent'
          WHEN zh.zone = 'yellow' AND zh.burnout_score > 60 THEN 'high'
          WHEN zh.zone = 'green' AND zh.readiness_score > 80 THEN 'low'
          ELSE 'normal'
        END as urgency,
        CASE
          WHEN zh.zone = 'red' THEN 'Employee showing burnout indicators'
          WHEN zh.zone = 'yellow' AND zh.burnout_score > 60 THEN 'Rising stress levels detected'
          WHEN zh.zone = 'green' AND zh.readiness_score > 80 THEN 'Great time to discuss growth opportunities'
          ELSE 'Routine check-in recommended'
        END as reason
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT zone, burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = e.id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE e.manager_id = $1 AND e.is_active = true
      ORDER BY
        CASE zh.zone
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          ELSE 3
        END,
        zh.burnout_score DESC NULLS LAST
    `, [managerEmployeeId]);

    res.json(result.rows.map(row => ({
      employeeId: row.id,
      employeeName: `${row.first_name} ${row.last_name}`,
      zone: row.zone || 'yellow',
      urgency: row.urgency,
      reason: row.reason,
    })));
  } catch (err) {
    console.error('Get meeting suggestions error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get suggestions' });
  }
});

module.exports = router;
