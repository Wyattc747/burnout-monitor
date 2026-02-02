const express = require('express');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Valid goal types
const VALID_GOAL_TYPES = ['sleep', 'exercise', 'green_zone', 'checkin_streak'];
const VALID_STATUSES = ['active', 'completed', 'abandoned'];

// All routes require authentication
router.use(authenticate);

// GET /api/goals - Get user's goals
router.get('/', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    if (!employeeId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Employee ID is required' });
    }

    const { status, goal_type } = req.query;

    let query = `
      SELECT id, employee_id, goal_type, target_value, current_value,
             deadline, status, created_at, updated_at
      FROM goals
      WHERE employee_id = $1
    `;
    const params = [employeeId];
    let paramIndex = 2;

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (goal_type) {
      if (!VALID_GOAL_TYPES.includes(goal_type)) {
        return res.status(400).json({ error: 'Validation Error', message: `Invalid goal_type. Must be one of: ${VALID_GOAL_TYPES.join(', ')}` });
      }
      query += ` AND goal_type = $${paramIndex}`;
      params.push(goal_type);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    const goals = result.rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      goalType: row.goal_type,
      targetValue: row.target_value,
      currentValue: row.current_value,
      deadline: row.deadline,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(goals);
  } catch (err) {
    console.error('Get goals error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get goals' });
  }
});

// POST /api/goals - Create a new goal
router.post('/', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    if (!employeeId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Employee ID is required' });
    }

    const { goalType, targetValue, deadline } = req.body;

    // Validate required fields
    if (!goalType) {
      return res.status(400).json({ error: 'Validation Error', message: 'goalType is required' });
    }

    if (!VALID_GOAL_TYPES.includes(goalType)) {
      return res.status(400).json({ error: 'Validation Error', message: `Invalid goalType. Must be one of: ${VALID_GOAL_TYPES.join(', ')}` });
    }

    if (targetValue === undefined || targetValue === null) {
      return res.status(400).json({ error: 'Validation Error', message: 'targetValue is required' });
    }

    if (typeof targetValue !== 'number' || targetValue <= 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'targetValue must be a positive number' });
    }

    // Validate deadline if provided
    let deadlineDate = null;
    if (deadline) {
      deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid deadline format' });
      }
      if (deadlineDate <= new Date()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Deadline must be in the future' });
      }
    }

    const result = await db.query(`
      INSERT INTO goals (employee_id, goal_type, target_value, current_value, deadline, status)
      VALUES ($1, $2, $3, 0, $4, 'active')
      RETURNING id, employee_id, goal_type, target_value, current_value, deadline, status, created_at, updated_at
    `, [employeeId, goalType, targetValue, deadlineDate]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      employeeId: row.employee_id,
      goalType: row.goal_type,
      targetValue: row.target_value,
      currentValue: row.current_value,
      deadline: row.deadline,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id - Update goal progress
router.put('/:id', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { id } = req.params;

    if (!employeeId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Employee ID is required' });
    }

    // Check if goal exists and belongs to user
    const existingResult = await db.query(`
      SELECT * FROM goals WHERE id = $1 AND employee_id = $2
    `, [id, employeeId]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Goal not found' });
    }

    const existingGoal = existingResult.rows[0];
    const { currentValue, status, targetValue, deadline } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (currentValue !== undefined) {
      if (typeof currentValue !== 'number' || currentValue < 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'currentValue must be a non-negative number' });
      }
      updates.push(`current_value = $${paramIndex}`);
      params.push(currentValue);
      paramIndex++;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (targetValue !== undefined) {
      if (typeof targetValue !== 'number' || targetValue <= 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'targetValue must be a positive number' });
      }
      updates.push(`target_value = $${paramIndex}`);
      params.push(targetValue);
      paramIndex++;
    }

    if (deadline !== undefined) {
      if (deadline === null) {
        updates.push(`deadline = NULL`);
      } else {
        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime())) {
          return res.status(400).json({ error: 'Validation Error', message: 'Invalid deadline format' });
        }
        updates.push(`deadline = $${paramIndex}`);
        params.push(deadlineDate);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'No valid fields to update' });
    }

    // Add updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Add WHERE clause params
    params.push(id);
    params.push(employeeId);

    const result = await db.query(`
      UPDATE goals
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND employee_id = $${paramIndex + 1}
      RETURNING id, employee_id, goal_type, target_value, current_value, deadline, status, created_at, updated_at
    `, params);

    const row = result.rows[0];

    // Auto-complete goal if current_value >= target_value
    if (row.current_value >= row.target_value && row.status === 'active') {
      await db.query(`
        UPDATE goals SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
      row.status = 'completed';
    }

    res.json({
      id: row.id,
      employeeId: row.employee_id,
      goalType: row.goal_type,
      targetValue: row.target_value,
      currentValue: row.current_value,
      deadline: row.deadline,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Update goal error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id - Delete a goal
router.delete('/:id', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { id } = req.params;

    if (!employeeId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Employee ID is required' });
    }

    // Check if goal exists and belongs to user
    const existingResult = await db.query(`
      SELECT id FROM goals WHERE id = $1 AND employee_id = $2
    `, [id, employeeId]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Goal not found' });
    }

    await db.query(`
      DELETE FROM goals WHERE id = $1 AND employee_id = $2
    `, [id, employeeId]);

    res.json({ success: true, message: 'Goal deleted successfully' });
  } catch (err) {
    console.error('Delete goal error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete goal' });
  }
});

module.exports = router;
