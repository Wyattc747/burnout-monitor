const express = require('express');
const db = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Valid challenge types
const VALID_CHALLENGE_TYPES = ['steps', 'sleep_hours', 'checkins', 'green_zone_days'];
const VALID_COMPETITION_TYPES = ['individual', 'team'];
const VALID_STATUSES = ['active', 'completed', 'cancelled'];

// All routes require authentication
router.use(authenticate);

// ============================================
// CHALLENGE MANAGEMENT
// ============================================

// GET /api/challenges - List active challenges
router.get('/', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { status = 'active', includeCompleted } = req.query;

    // Build query to get challenges the user can see
    // Users can see challenges they're participating in or challenges created for their team
    let query = `
      SELECT
        c.id,
        c.title,
        c.description,
        c.challenge_type,
        c.competition_type,
        c.target_value,
        c.start_date,
        c.end_date,
        c.status,
        c.created_by,
        c.team_id,
        c.created_at,
        c.updated_at,
        e.first_name as creator_first_name,
        e.last_name as creator_last_name,
        (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
        EXISTS(SELECT 1 FROM challenge_participants WHERE challenge_id = c.id AND employee_id = $1) as is_participating
      FROM challenges c
      LEFT JOIN employees e ON c.created_by = e.id
      WHERE 1=1
    `;
    const params = [employeeId];
    let paramIndex = 2;

    // Filter by status
    if (status && status !== 'all') {
      if (!VALID_STATUSES.includes(status) && status !== 'upcoming') {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}, upcoming, all`,
        });
      }

      if (status === 'upcoming') {
        query += ` AND c.start_date > CURRENT_DATE AND c.status = 'active'`;
      } else {
        query += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    // Include completed challenges if requested
    if (includeCompleted === 'true' && status !== 'all') {
      query = query.replace(`AND c.status = $${paramIndex - 1}`, `AND (c.status = $${paramIndex - 1} OR c.status = 'completed')`);
    }

    // Filter to challenges the user can see (participating or team challenges)
    query += `
      AND (
        EXISTS(SELECT 1 FROM challenge_participants WHERE challenge_id = c.id AND employee_id = $1)
        OR c.team_id IN (
          SELECT COALESCE(manager_id, id) FROM employees WHERE id = $1
          UNION
          SELECT id FROM employees WHERE manager_id = (SELECT manager_id FROM employees WHERE id = $1)
        )
        OR c.team_id IS NULL
      )
    `;

    query += ' ORDER BY c.start_date DESC, c.created_at DESC';

    const result = await db.query(query, params);

    const challenges = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      challengeType: row.challenge_type,
      competitionType: row.competition_type,
      targetValue: row.target_value,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdBy: row.created_by,
      creatorName: row.creator_first_name && row.creator_last_name
        ? `${row.creator_first_name} ${row.creator_last_name}`
        : null,
      teamId: row.team_id,
      participantCount: parseInt(row.participant_count),
      isParticipating: row.is_participating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(challenges);
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get challenges' });
  }
});

// GET /api/challenges/:id - Get a specific challenge with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    const result = await db.query(`
      SELECT
        c.*,
        e.first_name as creator_first_name,
        e.last_name as creator_last_name,
        (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id) as participant_count,
        EXISTS(SELECT 1 FROM challenge_participants WHERE challenge_id = c.id AND employee_id = $2) as is_participating
      FROM challenges c
      LEFT JOIN employees e ON c.created_by = e.id
      WHERE c.id = $1
    `, [id, employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      challengeType: row.challenge_type,
      competitionType: row.competition_type,
      targetValue: row.target_value,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdBy: row.created_by,
      creatorName: row.creator_first_name && row.creator_last_name
        ? `${row.creator_first_name} ${row.creator_last_name}`
        : null,
      teamId: row.team_id,
      participantCount: parseInt(row.participant_count),
      isParticipating: row.is_participating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Get challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get challenge' });
  }
});

// POST /api/challenges - Create challenge (managers only)
router.post('/', requireRole('manager'), async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      title,
      description,
      challengeType,
      competitionType,
      targetValue,
      startDate,
      endDate,
      teamId,
    } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Title is required' });
    }

    if (!challengeType) {
      return res.status(400).json({ error: 'Validation Error', message: 'Challenge type is required' });
    }

    if (!VALID_CHALLENGE_TYPES.includes(challengeType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid challenge type. Must be one of: ${VALID_CHALLENGE_TYPES.join(', ')}`,
      });
    }

    if (!competitionType) {
      return res.status(400).json({ error: 'Validation Error', message: 'Competition type is required' });
    }

    if (!VALID_COMPETITION_TYPES.includes(competitionType)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid competition type. Must be one of: ${VALID_COMPETITION_TYPES.join(', ')}`,
      });
    }

    if (targetValue === undefined || targetValue === null) {
      return res.status(400).json({ error: 'Validation Error', message: 'Target value is required' });
    }

    if (typeof targetValue !== 'number' || targetValue <= 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Target value must be a positive number' });
    }

    if (!startDate) {
      return res.status(400).json({ error: 'Validation Error', message: 'Start date is required' });
    }

    if (!endDate) {
      return res.status(400).json({ error: 'Validation Error', message: 'End date is required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid start date format' });
    }

    if (isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid end date format' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'Validation Error', message: 'End date must be after start date' });
    }

    // For team competitions, verify the teamId belongs to the manager's team
    if (competitionType === 'team' && teamId) {
      const teamCheck = await db.query(`
        SELECT id FROM employees
        WHERE id = $1 AND manager_id = $2
      `, [teamId, employeeId]);

      if (teamCheck.rows.length === 0) {
        // Check if the teamId is the manager's own employee id
        const selfCheck = await db.query(`
          SELECT id FROM employees WHERE id = $1 AND id = $2
        `, [teamId, employeeId]);

        if (selfCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only create challenges for your own team',
          });
        }
      }
    }

    const result = await db.query(`
      INSERT INTO challenges (
        title, description, challenge_type, competition_type,
        target_value, start_date, end_date, status, created_by, team_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)
      RETURNING *
    `, [
      title.trim(),
      description?.trim() || null,
      challengeType,
      competitionType,
      targetValue,
      start,
      end,
      employeeId,
      teamId || null,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      challengeType: row.challenge_type,
      competitionType: row.competition_type,
      targetValue: row.target_value,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdBy: row.created_by,
      teamId: row.team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create challenge' });
  }
});

// PUT /api/challenges/:id - Update a challenge (creator only)
router.put('/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;
    const { title, description, targetValue, status, endDate } = req.body;

    // Check if challenge exists and belongs to this manager
    const existingResult = await db.query(`
      SELECT * FROM challenges WHERE id = $1
    `, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    const challenge = existingResult.rows[0];

    if (challenge.created_by !== employeeId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update challenges you created',
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      if (title.trim().length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Title cannot be empty' });
      }
      updates.push(`title = $${paramIndex}`);
      params.push(title.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description?.trim() || null);
      paramIndex++;
    }

    if (targetValue !== undefined) {
      if (typeof targetValue !== 'number' || targetValue <= 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Target value must be a positive number' });
      }
      updates.push(`target_value = $${paramIndex}`);
      params.push(targetValue);
      paramIndex++;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid end date format' });
      }
      if (end <= new Date(challenge.start_date)) {
        return res.status(400).json({ error: 'Validation Error', message: 'End date must be after start date' });
      }
      updates.push(`end_date = $${paramIndex}`);
      params.push(end);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await db.query(`
      UPDATE challenges
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      challengeType: row.challenge_type,
      competitionType: row.competition_type,
      targetValue: row.target_value,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      createdBy: row.created_by,
      teamId: row.team_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Update challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update challenge' });
  }
});

// DELETE /api/challenges/:id - Delete a challenge (creator only)
router.delete('/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    // Check if challenge exists and belongs to this manager
    const existingResult = await db.query(`
      SELECT created_by FROM challenges WHERE id = $1
    `, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    if (existingResult.rows[0].created_by !== employeeId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete challenges you created',
      });
    }

    // Delete participants first (cascade would handle this, but being explicit)
    await db.query('DELETE FROM challenge_participants WHERE challenge_id = $1', [id]);
    await db.query('DELETE FROM challenges WHERE id = $1', [id]);

    res.json({ success: true, message: 'Challenge deleted successfully' });
  } catch (err) {
    console.error('Delete challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete challenge' });
  }
});

// ============================================
// CHALLENGE PARTICIPATION
// ============================================

// POST /api/challenges/:id/join - Join a challenge
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;
    const { teamName } = req.body; // For team competitions

    if (!employeeId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Employee ID is required' });
    }

    // Check if challenge exists and is active
    const challengeResult = await db.query(`
      SELECT * FROM challenges WHERE id = $1
    `, [id]);

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    const challenge = challengeResult.rows[0];

    if (challenge.status !== 'active') {
      return res.status(400).json({ error: 'Bad Request', message: 'This challenge is not active' });
    }

    // Check if challenge has already ended
    if (new Date(challenge.end_date) < new Date()) {
      return res.status(400).json({ error: 'Bad Request', message: 'This challenge has already ended' });
    }

    // Check if already participating
    const existingResult = await db.query(`
      SELECT id FROM challenge_participants
      WHERE challenge_id = $1 AND employee_id = $2
    `, [id, employeeId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'You are already participating in this challenge' });
    }

    // Join the challenge
    await db.query(`
      INSERT INTO challenge_participants (challenge_id, employee_id, team_name, progress, joined_at)
      VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
    `, [id, employeeId, teamName || null]);

    res.status(201).json({
      success: true,
      message: 'Successfully joined the challenge',
      challengeId: id,
      challengeType: challenge.challenge_type,
      targetValue: challenge.target_value,
    });
  } catch (err) {
    console.error('Join challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to join challenge' });
  }
});

// POST /api/challenges/:id/leave - Leave a challenge
router.post('/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    // Check if participating
    const existingResult = await db.query(`
      SELECT id FROM challenge_participants
      WHERE challenge_id = $1 AND employee_id = $2
    `, [id, employeeId]);

    if (existingResult.rows.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'You are not participating in this challenge' });
    }

    await db.query(`
      DELETE FROM challenge_participants
      WHERE challenge_id = $1 AND employee_id = $2
    `, [id, employeeId]);

    res.json({ success: true, message: 'Successfully left the challenge' });
  } catch (err) {
    console.error('Leave challenge error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to leave challenge' });
  }
});

// ============================================
// CHALLENGE LEADERBOARD & PROGRESS
// ============================================

// GET /api/challenges/:id/leaderboard - Get challenge rankings
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    // Get challenge details
    const challengeResult = await db.query(`
      SELECT * FROM challenges WHERE id = $1
    `, [id]);

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    const challenge = challengeResult.rows[0];
    const challengeType = challenge.challenge_type;
    const startDate = challenge.start_date;
    const endDate = challenge.end_date;
    const competitionType = challenge.competition_type;

    // Calculate progress for each participant based on challenge type
    let progressQuery;

    switch (challengeType) {
      case 'steps':
        progressQuery = `
          SELECT
            cp.employee_id,
            e.first_name,
            e.last_name,
            cp.team_name,
            cp.joined_at,
            COALESCE(SUM(hm.steps), 0) as calculated_progress
          FROM challenge_participants cp
          JOIN employees e ON cp.employee_id = e.id
          LEFT JOIN health_metrics hm ON cp.employee_id = hm.employee_id
            AND hm.date >= $2::date
            AND hm.date <= $3::date
          WHERE cp.challenge_id = $1
          GROUP BY cp.employee_id, e.first_name, e.last_name, cp.team_name, cp.joined_at
        `;
        break;

      case 'sleep_hours':
        progressQuery = `
          SELECT
            cp.employee_id,
            e.first_name,
            e.last_name,
            cp.team_name,
            cp.joined_at,
            COALESCE(SUM(hm.sleep_hours), 0) as calculated_progress
          FROM challenge_participants cp
          JOIN employees e ON cp.employee_id = e.id
          LEFT JOIN health_metrics hm ON cp.employee_id = hm.employee_id
            AND hm.date >= $2::date
            AND hm.date <= $3::date
          WHERE cp.challenge_id = $1
          GROUP BY cp.employee_id, e.first_name, e.last_name, cp.team_name, cp.joined_at
        `;
        break;

      case 'checkins':
        progressQuery = `
          SELECT
            cp.employee_id,
            e.first_name,
            e.last_name,
            cp.team_name,
            cp.joined_at,
            COALESCE(COUNT(fc.id), 0) as calculated_progress
          FROM challenge_participants cp
          JOIN employees e ON cp.employee_id = e.id
          LEFT JOIN feeling_checkins fc ON cp.employee_id = fc.employee_id
            AND fc.created_at >= $2::timestamp
            AND fc.created_at <= $3::timestamp
          WHERE cp.challenge_id = $1
          GROUP BY cp.employee_id, e.first_name, e.last_name, cp.team_name, cp.joined_at
        `;
        break;

      case 'green_zone_days':
        progressQuery = `
          SELECT
            cp.employee_id,
            e.first_name,
            e.last_name,
            cp.team_name,
            cp.joined_at,
            COALESCE(COUNT(CASE WHEN zh.zone = 'green' THEN 1 END), 0) as calculated_progress
          FROM challenge_participants cp
          JOIN employees e ON cp.employee_id = e.id
          LEFT JOIN zone_history zh ON cp.employee_id = zh.employee_id
            AND zh.date >= $2::date
            AND zh.date <= $3::date
          WHERE cp.challenge_id = $1
          GROUP BY cp.employee_id, e.first_name, e.last_name, cp.team_name, cp.joined_at
        `;
        break;

      default:
        return res.status(400).json({ error: 'Bad Request', message: 'Unknown challenge type' });
    }

    const progressResult = await db.query(progressQuery, [id, startDate, endDate]);

    // Update progress in challenge_participants
    for (const row of progressResult.rows) {
      await db.query(`
        UPDATE challenge_participants
        SET progress = $1, updated_at = CURRENT_TIMESTAMP
        WHERE challenge_id = $2 AND employee_id = $3
      `, [row.calculated_progress, id, row.employee_id]);
    }

    // Build leaderboard based on competition type
    let leaderboard;

    if (competitionType === 'team') {
      // Aggregate by team_name
      const teamAggregates = {};
      for (const row of progressResult.rows) {
        const team = row.team_name || 'Individual';
        if (!teamAggregates[team]) {
          teamAggregates[team] = {
            teamName: team,
            totalProgress: 0,
            memberCount: 0,
            members: [],
          };
        }
        teamAggregates[team].totalProgress += parseFloat(row.calculated_progress) || 0;
        teamAggregates[team].memberCount++;
        teamAggregates[team].members.push({
          employeeId: row.employee_id,
          name: `${row.first_name} ${row.last_name}`,
          progress: parseFloat(row.calculated_progress) || 0,
        });
      }

      leaderboard = Object.values(teamAggregates)
        .map((team, idx) => ({
          rank: 0, // Will be set after sorting
          teamName: team.teamName,
          progress: team.totalProgress,
          averageProgress: team.memberCount > 0 ? team.totalProgress / team.memberCount : 0,
          memberCount: team.memberCount,
          members: team.members.sort((a, b) => b.progress - a.progress),
          percentComplete: Math.min(100, (team.totalProgress / challenge.target_value) * 100),
        }))
        .sort((a, b) => b.progress - a.progress)
        .map((team, idx) => ({ ...team, rank: idx + 1 }));
    } else {
      // Individual competition
      leaderboard = progressResult.rows
        .map(row => ({
          rank: 0, // Will be set after sorting
          employeeId: row.employee_id,
          name: `${row.first_name} ${row.last_name}`,
          teamName: row.team_name,
          progress: parseFloat(row.calculated_progress) || 0,
          percentComplete: Math.min(100, ((parseFloat(row.calculated_progress) || 0) / challenge.target_value) * 100),
          joinedAt: row.joined_at,
        }))
        .sort((a, b) => b.progress - a.progress)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    }

    // Find current user's position
    const currentUserEntry = leaderboard.find(entry =>
      competitionType === 'team'
        ? entry.members?.some(m => m.employeeId === employeeId)
        : entry.employeeId === employeeId
    );

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        challengeType: challenge.challenge_type,
        competitionType: challenge.competition_type,
        targetValue: challenge.target_value,
        startDate: challenge.start_date,
        endDate: challenge.end_date,
        status: challenge.status,
        daysRemaining: Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24))),
      },
      leaderboard,
      currentUser: currentUserEntry || null,
      totalParticipants: progressResult.rows.length,
    });
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get leaderboard' });
  }
});

// GET /api/challenges/:id/my-progress - Get current user's progress in a challenge
router.get('/:id/my-progress', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    // Get challenge details
    const challengeResult = await db.query(`
      SELECT * FROM challenges WHERE id = $1
    `, [id]);

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Challenge not found' });
    }

    const challenge = challengeResult.rows[0];

    // Check if participating
    const participantResult = await db.query(`
      SELECT * FROM challenge_participants
      WHERE challenge_id = $1 AND employee_id = $2
    `, [id, employeeId]);

    if (participantResult.rows.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'You are not participating in this challenge' });
    }

    const participant = participantResult.rows[0];

    // Calculate current progress
    let progress = 0;
    const startDate = challenge.start_date;
    const endDate = challenge.end_date;

    switch (challenge.challenge_type) {
      case 'steps':
        const stepsResult = await db.query(`
          SELECT COALESCE(SUM(steps), 0) as total
          FROM health_metrics
          WHERE employee_id = $1 AND date >= $2::date AND date <= $3::date
        `, [employeeId, startDate, endDate]);
        progress = parseInt(stepsResult.rows[0].total);
        break;

      case 'sleep_hours':
        const sleepResult = await db.query(`
          SELECT COALESCE(SUM(sleep_hours), 0) as total
          FROM health_metrics
          WHERE employee_id = $1 AND date >= $2::date AND date <= $3::date
        `, [employeeId, startDate, endDate]);
        progress = parseFloat(sleepResult.rows[0].total);
        break;

      case 'checkins':
        const checkinsResult = await db.query(`
          SELECT COUNT(*) as total
          FROM feeling_checkins
          WHERE employee_id = $1 AND created_at >= $2::timestamp AND created_at <= $3::timestamp
        `, [employeeId, startDate, endDate]);
        progress = parseInt(checkinsResult.rows[0].total);
        break;

      case 'green_zone_days':
        const greenZoneResult = await db.query(`
          SELECT COUNT(*) as total
          FROM zone_history
          WHERE employee_id = $1 AND zone = 'green' AND date >= $2::date AND date <= $3::date
        `, [employeeId, startDate, endDate]);
        progress = parseInt(greenZoneResult.rows[0].total);
        break;
    }

    // Update progress
    await db.query(`
      UPDATE challenge_participants
      SET progress = $1, updated_at = CURRENT_TIMESTAMP
      WHERE challenge_id = $2 AND employee_id = $3
    `, [progress, id, employeeId]);

    res.json({
      challengeId: id,
      challengeType: challenge.challenge_type,
      targetValue: challenge.target_value,
      progress,
      percentComplete: Math.min(100, (progress / challenge.target_value) * 100),
      teamName: participant.team_name,
      joinedAt: participant.joined_at,
      startDate: challenge.start_date,
      endDate: challenge.end_date,
      daysRemaining: Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24))),
      completed: progress >= challenge.target_value,
    });
  } catch (err) {
    console.error('Get my progress error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get progress' });
  }
});

module.exports = router;
