const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');
const aggregateService = require('../services/aggregateService');

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
// TEAM WELLNESS OVERVIEW (Privacy-preserving)
// ============================================

// GET /api/teams/wellness-overview - Get privacy-preserving aggregate view
router.get('/wellness-overview', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;
    const overview = await aggregateService.getWellnessOverview(managerEmployeeId);

    if (overview.error) {
      return res.status(403).json(overview);
    }

    res.json(overview);
  } catch (err) {
    console.error('Get wellness overview error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get wellness overview' });
  }
});

// GET /api/teams/aggregates-consented - Get aggregates respecting consent settings
router.get('/aggregates-consented', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;
    const aggregates = await aggregateService.getConsentedTeamAggregates(managerEmployeeId);

    if (aggregates.error) {
      return res.status(403).json(aggregates);
    }

    res.json(aggregates);
  } catch (err) {
    console.error('Get consented aggregates error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get aggregates' });
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

// POST /api/teams/meeting-suggestions/:id/schedule - Mark suggestion as scheduled
router.post('/meeting-suggestions/:id/schedule', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    const managerEmployeeId = req.user.employeeId;

    // Verify the meeting suggestion belongs to this manager
    const suggestionResult = await db.query(`
      SELECT ms.*, e.first_name, e.last_name, zh.zone, zh.burnout_score, zh.readiness_score
      FROM meeting_suggestions ms
      JOIN employees e ON ms.employee_id = e.id
      LEFT JOIN LATERAL (
        SELECT zone, burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = ms.employee_id
        ORDER BY date DESC
        LIMIT 1
      ) zh ON true
      WHERE ms.id = $1 AND ms.manager_id = $2
    `, [id, managerEmployeeId]);

    if (suggestionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Meeting suggestion not found' });
    }

    const suggestion = suggestionResult.rows[0];

    // Create an intervention record
    const interventionResult = await db.query(`
      INSERT INTO manager_interventions (
        manager_id, employee_id, meeting_suggestion_id, meeting_type,
        scheduled_at, employee_zone_before, burnout_score_before, readiness_score_before, status
      )
      VALUES ($1, $2, $3, '1:1', $4, $5, $6, $7, 'scheduled')
      RETURNING id
    `, [
      managerEmployeeId,
      suggestion.employee_id,
      id,
      scheduledAt || new Date(),
      suggestion.zone,
      suggestion.burnout_score,
      suggestion.readiness_score,
    ]);

    const interventionId = interventionResult.rows[0].id;

    // Update the meeting suggestion
    await db.query(`
      UPDATE meeting_suggestions
      SET status = 'scheduled', scheduled_at = $1, intervention_id = $2
      WHERE id = $3
    `, [scheduledAt || new Date(), interventionId, id]);

    res.json({
      success: true,
      message: 'Meeting scheduled successfully',
      interventionId,
    });
  } catch (err) {
    console.error('Schedule meeting error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to schedule meeting' });
  }
});

// POST /api/teams/meeting-suggestions/:id/complete - Log meeting outcome
router.post('/meeting-suggestions/:id/complete', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      outcomeRating,
      outcomeNotes,
      topicsDiscussed,
      actionItems,
      followUpNeeded,
      followUpDate,
      durationMinutes,
    } = req.body;
    const managerEmployeeId = req.user.employeeId;

    // Get the meeting suggestion and associated intervention
    const suggestionResult = await db.query(`
      SELECT ms.*, mi.id as intervention_id
      FROM meeting_suggestions ms
      LEFT JOIN manager_interventions mi ON ms.intervention_id = mi.id
      WHERE ms.id = $1 AND ms.manager_id = $2
    `, [id, managerEmployeeId]);

    if (suggestionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Meeting suggestion not found' });
    }

    const suggestion = suggestionResult.rows[0];
    let interventionId = suggestion.intervention_id;

    // If no intervention exists yet, create one (for meetings that weren't formally scheduled)
    if (!interventionId) {
      // Get employee's current zone
      const zoneResult = await db.query(`
        SELECT zone, burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = $1
        ORDER BY date DESC
        LIMIT 1
      `, [suggestion.employee_id]);

      const currentZone = zoneResult.rows[0];

      const interventionResult = await db.query(`
        INSERT INTO manager_interventions (
          manager_id, employee_id, meeting_suggestion_id, meeting_type,
          scheduled_at, completed_at, employee_zone_before, burnout_score_before,
          readiness_score_before, status, outcome_rating, outcome_notes,
          topics_discussed, action_items, follow_up_needed, follow_up_date, duration_minutes
        )
        VALUES ($1, $2, $3, '1:1', NOW(), NOW(), $4, $5, $6, 'completed', $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        managerEmployeeId,
        suggestion.employee_id,
        id,
        currentZone?.zone,
        currentZone?.burnout_score,
        currentZone?.readiness_score,
        outcomeRating,
        outcomeNotes,
        JSON.stringify(topicsDiscussed || []),
        JSON.stringify(actionItems || []),
        followUpNeeded || false,
        followUpDate,
        durationMinutes,
      ]);

      interventionId = interventionResult.rows[0].id;
    } else {
      // Update existing intervention
      await db.query(`
        UPDATE manager_interventions
        SET completed_at = NOW(), status = 'completed', outcome_rating = $1,
            outcome_notes = $2, topics_discussed = $3, action_items = $4,
            follow_up_needed = $5, follow_up_date = $6, duration_minutes = $7,
            updated_at = NOW()
        WHERE id = $8
      `, [
        outcomeRating,
        outcomeNotes,
        JSON.stringify(topicsDiscussed || []),
        JSON.stringify(actionItems || []),
        followUpNeeded || false,
        followUpDate,
        durationMinutes,
        interventionId,
      ]);
    }

    // Update meeting suggestion status
    await db.query(`
      UPDATE meeting_suggestions
      SET status = 'completed', intervention_id = $1
      WHERE id = $2
    `, [interventionId, id]);

    res.json({
      success: true,
      message: 'Meeting outcome logged successfully',
      interventionId,
    });
  } catch (err) {
    console.error('Complete meeting error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to log meeting outcome' });
  }
});

// ============================================
// INTERVENTION HISTORY & EFFECTIVENESS
// ============================================

// GET /api/teams/interventions - Get intervention history with effectiveness tracking
router.get('/interventions', requireRole('manager'), async (req, res) => {
  try {
    const managerEmployeeId = req.user.employeeId;
    const { employeeId, status, limit = 50 } = req.query;

    let query = `
      SELECT
        mi.*,
        e.first_name,
        e.last_name,
        e.email,
        zh_after.zone as current_zone,
        zh_after.burnout_score as current_burnout_score,
        zh_after.readiness_score as current_readiness_score
      FROM manager_interventions mi
      JOIN employees e ON mi.employee_id = e.id
      LEFT JOIN LATERAL (
        SELECT zone, burnout_score, readiness_score
        FROM zone_history
        WHERE employee_id = mi.employee_id
        ORDER BY date DESC
        LIMIT 1
      ) zh_after ON true
      WHERE mi.manager_id = $1
    `;

    const params = [managerEmployeeId];
    let paramIndex = 2;

    if (employeeId) {
      query += ` AND mi.employee_id = $${paramIndex}`;
      params.push(employeeId);
      paramIndex++;
    }

    if (status) {
      query += ` AND mi.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY mi.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    // Calculate effectiveness for completed interventions that haven't been calculated yet
    const interventions = await Promise.all(result.rows.map(async (row) => {
      // If completed and 7+ days have passed, calculate effectiveness if not already done
      if (row.status === 'completed' && !row.effectiveness_calculated_at && row.completed_at) {
        const daysSinceCompletion = Math.floor(
          (new Date() - new Date(row.completed_at)) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceCompletion >= 7) {
          // Get the employee's zone from 7 days after the meeting
          const afterResult = await db.query(`
            SELECT zone, burnout_score, readiness_score
            FROM zone_history
            WHERE employee_id = $1
              AND date >= ($2::date + INTERVAL '7 days')
            ORDER BY date ASC
            LIMIT 1
          `, [row.employee_id, row.completed_at]);

          if (afterResult.rows.length > 0) {
            const afterData = afterResult.rows[0];
            const burnoutBefore = parseFloat(row.burnout_score_before) || 50;
            const burnoutAfter = parseFloat(afterData.burnout_score) || 50;
            const improvementScore = burnoutBefore - burnoutAfter; // Positive = improved

            await db.query(`
              UPDATE manager_interventions
              SET employee_zone_after = $1, burnout_score_after = $2,
                  readiness_score_after = $3, improvement_score = $4,
                  effectiveness_calculated_at = NOW()
              WHERE id = $5
            `, [
              afterData.zone,
              afterData.burnout_score,
              afterData.readiness_score,
              improvementScore,
              row.id,
            ]);

            row.employee_zone_after = afterData.zone;
            row.burnout_score_after = afterData.burnout_score;
            row.readiness_score_after = afterData.readiness_score;
            row.improvement_score = improvementScore;
          }
        }
      }

      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: `${row.first_name} ${row.last_name}`,
        employeeEmail: row.email,
        meetingType: row.meeting_type,
        scheduledAt: row.scheduled_at,
        completedAt: row.completed_at,
        durationMinutes: row.duration_minutes,
        status: row.status,
        // Before metrics
        zoneBefore: row.employee_zone_before,
        burnoutScoreBefore: row.burnout_score_before ? parseFloat(row.burnout_score_before) : null,
        readinessScoreBefore: row.readiness_score_before ? parseFloat(row.readiness_score_before) : null,
        // Outcome
        outcomeRating: row.outcome_rating,
        outcomeNotes: row.outcome_notes,
        topicsDiscussed: row.topics_discussed,
        actionItems: row.action_items,
        followUpNeeded: row.follow_up_needed,
        followUpDate: row.follow_up_date,
        // Effectiveness tracking
        zoneAfter: row.employee_zone_after,
        burnoutScoreAfter: row.burnout_score_after ? parseFloat(row.burnout_score_after) : null,
        readinessScoreAfter: row.readiness_score_after ? parseFloat(row.readiness_score_after) : null,
        improvementScore: row.improvement_score ? parseFloat(row.improvement_score) : null,
        effectivenessCalculated: !!row.effectiveness_calculated_at,
        // Current status
        currentZone: row.current_zone,
        currentBurnoutScore: row.current_burnout_score ? parseFloat(row.current_burnout_score) : null,
        createdAt: row.created_at,
      };
    }));

    // Calculate aggregate effectiveness stats
    const completedWithEffectiveness = interventions.filter(i => i.improvementScore !== null);
    const stats = {
      totalInterventions: interventions.length,
      completedInterventions: interventions.filter(i => i.status === 'completed').length,
      averageOutcomeRating: interventions
        .filter(i => i.outcomeRating)
        .reduce((sum, i, _, arr) => sum + i.outcomeRating / arr.length, 0) || null,
      averageImprovement: completedWithEffectiveness.length > 0
        ? completedWithEffectiveness.reduce((sum, i) => sum + i.improvementScore, 0) / completedWithEffectiveness.length
        : null,
      effectiveInterventions: completedWithEffectiveness.filter(i => i.improvementScore > 0).length,
    };

    res.json({
      interventions,
      stats,
    });
  } catch (err) {
    console.error('Get interventions error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get interventions' });
  }
});

// ============================================
// CONVERSATION TEMPLATES
// ============================================

// GET /api/teams/conversation-templates - Get conversation templates by zone
router.get('/conversation-templates', requireRole('manager'), async (req, res) => {
  try {
    const { zone, category, urgency } = req.query;

    let query = `
      SELECT *
      FROM conversation_templates
      WHERE is_active = true
    `;

    const params = [];
    let paramIndex = 1;

    if (zone) {
      query += ` AND zone = $${paramIndex}`;
      params.push(zone);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (urgency) {
      query += ` AND urgency = $${paramIndex}`;
      params.push(urgency);
      paramIndex++;
    }

    query += ` ORDER BY zone, display_order, title`;

    const result = await db.query(query, params);

    const templates = result.rows.map(row => ({
      id: row.id,
      zone: row.zone,
      urgency: row.urgency,
      title: row.title,
      description: row.description,
      openingQuestions: row.opening_questions,
      talkingPoints: row.talking_points,
      actionsToSuggest: row.actions_to_suggest,
      category: row.category,
    }));

    res.json(templates);
  } catch (err) {
    console.error('Get conversation templates error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get templates' });
  }
});

module.exports = router;
