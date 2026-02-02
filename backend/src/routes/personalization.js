const express = require('express');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const { validate, checkinSchema, preferencesSchema } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// FEELING CHECK-INS
// ============================================

// GET /api/personalization/checkins - Get user's feeling check-ins
router.get('/checkins', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { limit = 30 } = req.query;

    const result = await db.query(`
      SELECT
        id,
        overall_feeling,
        energy_level,
        stress_level,
        motivation_level,
        notes,
        context_snapshot,
        created_at
      FROM feeling_checkins
      WHERE employee_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [employeeId, parseInt(limit)]);

    const checkins = result.rows.map(row => ({
      id: row.id,
      overallFeeling: row.overall_feeling,
      energyLevel: row.energy_level,
      stressLevel: row.stress_level,
      motivationLevel: row.motivation_level,
      notes: row.notes,
      contextSnapshot: row.context_snapshot,
      createdAt: row.created_at,
    }));

    res.json(checkins);
  } catch (err) {
    console.error('Get check-ins error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get check-ins' });
  }
});

// POST /api/personalization/checkins - Create a new feeling check-in
router.post('/checkins', validate(checkinSchema), async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      overallFeeling,
      energyLevel,
      stressLevel,
      motivationLevel,
      notes,
    } = req.body;

    // Get current context snapshot (latest metrics)
    const healthResult = await db.query(`
      SELECT sleep_hours, sleep_quality_score, heart_rate_variability, exercise_minutes
      FROM health_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    const workResult = await db.query(`
      SELECT hours_worked, meetings_attended, meeting_hours
      FROM work_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    const contextSnapshot = {
      health: healthResult.rows[0] || null,
      work: workResult.rows[0] || null,
      timestamp: new Date().toISOString(),
    };

    const result = await db.query(`
      INSERT INTO feeling_checkins (
        employee_id,
        overall_feeling,
        energy_level,
        stress_level,
        motivation_level,
        notes,
        context_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      employeeId,
      overallFeeling,
      energyLevel || null,
      stressLevel || null,
      motivationLevel || null,
      notes || null,
      contextSnapshot,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      overallFeeling: row.overall_feeling,
      energyLevel: row.energy_level,
      stressLevel: row.stress_level,
      motivationLevel: row.motivation_level,
      notes: row.notes,
      contextSnapshot: row.context_snapshot,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Create check-in error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create check-in' });
  }
});

// GET /api/personalization/checkins/stats - Get check-in statistics and patterns
router.get('/checkins/stats', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    // Get average feelings over last 30 days
    const avgResult = await db.query(`
      SELECT
        AVG(overall_feeling) as avg_feeling,
        AVG(energy_level) as avg_energy,
        AVG(stress_level) as avg_stress,
        AVG(motivation_level) as avg_motivation,
        COUNT(*) as total_checkins
      FROM feeling_checkins
      WHERE employee_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [employeeId]);

    // Get trend (compare last 7 days to previous 7 days)
    const trendResult = await db.query(`
      SELECT
        (SELECT AVG(overall_feeling) FROM feeling_checkins
         WHERE employee_id = $1 AND created_at >= NOW() - INTERVAL '7 days') as recent_avg,
        (SELECT AVG(overall_feeling) FROM feeling_checkins
         WHERE employee_id = $1 AND created_at >= NOW() - INTERVAL '14 days'
         AND created_at < NOW() - INTERVAL '7 days') as previous_avg
    `, [employeeId]);

    const avg = avgResult.rows[0];
    const trend = trendResult.rows[0];
    const trendDirection = trend.recent_avg && trend.previous_avg
      ? trend.recent_avg > trend.previous_avg ? 'improving'
        : trend.recent_avg < trend.previous_avg ? 'declining'
        : 'stable'
      : 'insufficient_data';

    res.json({
      averages: {
        feeling: avg.avg_feeling ? parseFloat(avg.avg_feeling).toFixed(1) : null,
        energy: avg.avg_energy ? parseFloat(avg.avg_energy).toFixed(1) : null,
        stress: avg.avg_stress ? parseFloat(avg.avg_stress).toFixed(1) : null,
        motivation: avg.avg_motivation ? parseFloat(avg.avg_motivation).toFixed(1) : null,
      },
      totalCheckins: parseInt(avg.total_checkins),
      trend: trendDirection,
      recentAvg: trend.recent_avg ? parseFloat(trend.recent_avg).toFixed(1) : null,
      previousAvg: trend.previous_avg ? parseFloat(trend.previous_avg).toFixed(1) : null,
    });
  } catch (err) {
    console.error('Get check-in stats error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get check-in stats' });
  }
});

// ============================================
// PERSONAL PREFERENCES
// ============================================

// GET /api/personalization/preferences - Get user's preferences
router.get('/preferences', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const result = await db.query(`
      SELECT *
      FROM personal_preferences
      WHERE employee_id = $1
    `, [employeeId]);

    if (result.rows.length === 0) {
      // Return defaults if no preferences set
      return res.json({
        idealSleepHours: 7.5,
        sleepFlexibility: 'moderate',
        chronotype: 'neutral',
        idealWorkHours: 8.0,
        preferredWorkPattern: 'steady',
        maxMeetingHoursDaily: 4.0,
        socialEnergyType: 'ambivert',
        idealExerciseMinutes: 30,
        exerciseImportance: 'moderate',
        weightSleep: 50,
        weightExercise: 30,
        weightWorkload: 50,
        weightMeetings: 40,
        weightHeartMetrics: 30,
        setupCompleted: false,
      });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      idealSleepHours: parseFloat(row.ideal_sleep_hours),
      sleepFlexibility: row.sleep_flexibility,
      chronotype: row.chronotype,
      idealWorkHours: parseFloat(row.ideal_work_hours),
      preferredWorkPattern: row.preferred_work_pattern,
      maxMeetingHoursDaily: parseFloat(row.max_meeting_hours_daily),
      socialEnergyType: row.social_energy_type,
      idealExerciseMinutes: row.ideal_exercise_minutes,
      exerciseImportance: row.exercise_importance,
      weightSleep: row.weight_sleep,
      weightExercise: row.weight_exercise,
      weightWorkload: row.weight_workload,
      weightMeetings: row.weight_meetings,
      weightHeartMetrics: row.weight_heart_metrics,
      setupCompleted: row.setup_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get preferences' });
  }
});

// PUT /api/personalization/preferences - Update user's preferences
router.put('/preferences', validate(preferencesSchema), async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      idealSleepHours,
      sleepFlexibility,
      chronotype,
      idealWorkHours,
      preferredWorkPattern,
      maxMeetingHoursDaily,
      socialEnergyType,
      idealExerciseMinutes,
      exerciseImportance,
      weightSleep,
      weightExercise,
      weightWorkload,
      weightMeetings,
      weightHeartMetrics,
      setupCompleted,
    } = req.body;

    // Upsert preferences
    const result = await db.query(`
      INSERT INTO personal_preferences (
        employee_id,
        ideal_sleep_hours,
        sleep_flexibility,
        chronotype,
        ideal_work_hours,
        preferred_work_pattern,
        max_meeting_hours_daily,
        social_energy_type,
        ideal_exercise_minutes,
        exercise_importance,
        weight_sleep,
        weight_exercise,
        weight_workload,
        weight_meetings,
        weight_heart_metrics,
        setup_completed,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (employee_id)
      DO UPDATE SET
        ideal_sleep_hours = COALESCE($2, personal_preferences.ideal_sleep_hours),
        sleep_flexibility = COALESCE($3, personal_preferences.sleep_flexibility),
        chronotype = COALESCE($4, personal_preferences.chronotype),
        ideal_work_hours = COALESCE($5, personal_preferences.ideal_work_hours),
        preferred_work_pattern = COALESCE($6, personal_preferences.preferred_work_pattern),
        max_meeting_hours_daily = COALESCE($7, personal_preferences.max_meeting_hours_daily),
        social_energy_type = COALESCE($8, personal_preferences.social_energy_type),
        ideal_exercise_minutes = COALESCE($9, personal_preferences.ideal_exercise_minutes),
        exercise_importance = COALESCE($10, personal_preferences.exercise_importance),
        weight_sleep = COALESCE($11, personal_preferences.weight_sleep),
        weight_exercise = COALESCE($12, personal_preferences.weight_exercise),
        weight_workload = COALESCE($13, personal_preferences.weight_workload),
        weight_meetings = COALESCE($14, personal_preferences.weight_meetings),
        weight_heart_metrics = COALESCE($15, personal_preferences.weight_heart_metrics),
        setup_completed = COALESCE($16, personal_preferences.setup_completed),
        updated_at = NOW()
      RETURNING *
    `, [
      employeeId,
      idealSleepHours,
      sleepFlexibility,
      chronotype,
      idealWorkHours,
      preferredWorkPattern,
      maxMeetingHoursDaily,
      socialEnergyType,
      idealExerciseMinutes,
      exerciseImportance,
      weightSleep,
      weightExercise,
      weightWorkload,
      weightMeetings,
      weightHeartMetrics,
      setupCompleted,
    ]);

    const row = result.rows[0];
    res.json({
      id: row.id,
      idealSleepHours: parseFloat(row.ideal_sleep_hours),
      sleepFlexibility: row.sleep_flexibility,
      chronotype: row.chronotype,
      idealWorkHours: parseFloat(row.ideal_work_hours),
      preferredWorkPattern: row.preferred_work_pattern,
      maxMeetingHoursDaily: parseFloat(row.max_meeting_hours_daily),
      socialEnergyType: row.social_energy_type,
      idealExerciseMinutes: row.ideal_exercise_minutes,
      exerciseImportance: row.exercise_importance,
      weightSleep: row.weight_sleep,
      weightExercise: row.weight_exercise,
      weightWorkload: row.weight_workload,
      weightMeetings: row.weight_meetings,
      weightHeartMetrics: row.weight_heart_metrics,
      setupCompleted: row.setup_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update preferences' });
  }
});

// ============================================
// LIFE EVENTS
// ============================================

// GET /api/personalization/life-events - Get user's life events
router.get('/life-events', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { activeOnly = 'true' } = req.query;

    let query = `
      SELECT
        id,
        event_type,
        event_label,
        start_date,
        end_date,
        sleep_adjustment,
        work_adjustment,
        exercise_adjustment,
        stress_tolerance_adjustment,
        notes,
        is_active,
        created_at
      FROM life_events
      WHERE employee_id = $1
    `;

    if (activeOnly === 'true') {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY start_date DESC`;

    const result = await db.query(query, [employeeId]);

    const events = result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      eventLabel: row.event_label,
      startDate: row.start_date,
      endDate: row.end_date,
      sleepAdjustment: row.sleep_adjustment,
      workAdjustment: row.work_adjustment,
      exerciseAdjustment: row.exercise_adjustment,
      stressToleranceAdjustment: row.stress_tolerance_adjustment,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    res.json(events);
  } catch (err) {
    console.error('Get life events error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get life events' });
  }
});

// POST /api/personalization/life-events - Create a new life event
router.post('/life-events', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      eventType,
      eventLabel,
      startDate,
      endDate,
      sleepAdjustment,
      workAdjustment,
      exerciseAdjustment,
      stressToleranceAdjustment,
      notes,
    } = req.body;

    // Validate required fields
    if (!eventType || !eventLabel || !startDate) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Event type, label, and start date are required',
      });
    }

    const result = await db.query(`
      INSERT INTO life_events (
        employee_id,
        event_type,
        event_label,
        start_date,
        end_date,
        sleep_adjustment,
        work_adjustment,
        exercise_adjustment,
        stress_tolerance_adjustment,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      employeeId,
      eventType,
      eventLabel,
      startDate,
      endDate || null,
      sleepAdjustment || 0,
      workAdjustment || 0,
      exerciseAdjustment || 0,
      stressToleranceAdjustment || 0,
      notes || null,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      eventType: row.event_type,
      eventLabel: row.event_label,
      startDate: row.start_date,
      endDate: row.end_date,
      sleepAdjustment: row.sleep_adjustment,
      workAdjustment: row.work_adjustment,
      exerciseAdjustment: row.exercise_adjustment,
      stressToleranceAdjustment: row.stress_tolerance_adjustment,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Create life event error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create life event' });
  }
});

// PUT /api/personalization/life-events/:id - Update a life event
router.put('/life-events/:id', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { id } = req.params;
    const { endDate, isActive, notes } = req.body;

    const result = await db.query(`
      UPDATE life_events
      SET
        end_date = COALESCE($3, end_date),
        is_active = COALESCE($4, is_active),
        notes = COALESCE($5, notes)
      WHERE id = $1 AND employee_id = $2
      RETURNING *
    `, [id, employeeId, endDate, isActive, notes]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Life event not found',
      });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      eventType: row.event_type,
      eventLabel: row.event_label,
      startDate: row.start_date,
      endDate: row.end_date,
      sleepAdjustment: row.sleep_adjustment,
      workAdjustment: row.work_adjustment,
      exerciseAdjustment: row.exercise_adjustment,
      stressToleranceAdjustment: row.stress_tolerance_adjustment,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Update life event error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update life event' });
  }
});

// DELETE /api/personalization/life-events/:id - Delete a life event
router.delete('/life-events/:id', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM life_events
      WHERE id = $1 AND employee_id = $2
      RETURNING id
    `, [id, employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Life event not found',
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete life event error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete life event' });
  }
});

// ============================================
// LIFE EVENT TEMPLATES
// ============================================

// GET /api/personalization/life-event-templates - Get all life event templates
router.get('/life-event-templates', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        event_type,
        event_label,
        description,
        default_sleep_adjustment,
        default_work_adjustment,
        default_exercise_adjustment,
        default_stress_tolerance_adjustment,
        suggested_duration_days,
        icon,
        category
      FROM life_event_templates
      ORDER BY category, event_label
    `);

    const templates = result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      eventLabel: row.event_label,
      description: row.description,
      defaultSleepAdjustment: row.default_sleep_adjustment,
      defaultWorkAdjustment: row.default_work_adjustment,
      defaultExerciseAdjustment: row.default_exercise_adjustment,
      defaultStressToleranceAdjustment: row.default_stress_tolerance_adjustment,
      suggestedDurationDays: row.suggested_duration_days,
      icon: row.icon,
      category: row.category,
    }));

    res.json(templates);
  } catch (err) {
    console.error('Get life event templates error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get templates' });
  }
});

// ============================================
// COMBINED PERSONALIZATION DATA
// ============================================

// GET /api/personalization/summary - Get all personalization data in one call
router.get('/summary', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    // Get preferences
    const prefResult = await db.query(`
      SELECT * FROM personal_preferences WHERE employee_id = $1
    `, [employeeId]);

    // Get active life events
    const eventsResult = await db.query(`
      SELECT * FROM life_events
      WHERE employee_id = $1 AND is_active = true
      ORDER BY start_date DESC
    `, [employeeId]);

    // Get recent check-ins
    const checkinsResult = await db.query(`
      SELECT * FROM feeling_checkins
      WHERE employee_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [employeeId]);

    // Get check-in stats
    const statsResult = await db.query(`
      SELECT
        AVG(overall_feeling) as avg_feeling,
        COUNT(*) as total
      FROM feeling_checkins
      WHERE employee_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [employeeId]);

    const preferences = prefResult.rows[0];
    const stats = statsResult.rows[0];

    res.json({
      preferences: preferences ? {
        idealSleepHours: parseFloat(preferences.ideal_sleep_hours),
        chronotype: preferences.chronotype,
        socialEnergyType: preferences.social_energy_type,
        setupCompleted: preferences.setup_completed,
      } : null,
      activeLifeEvents: eventsResult.rows.map(row => ({
        id: row.id,
        eventType: row.event_type,
        eventLabel: row.event_label,
        startDate: row.start_date,
        endDate: row.end_date,
      })),
      recentCheckins: checkinsResult.rows.map(row => ({
        overallFeeling: row.overall_feeling,
        createdAt: row.created_at,
      })),
      checkinStats: {
        averageFeeling: stats.avg_feeling ? parseFloat(stats.avg_feeling).toFixed(1) : null,
        totalCheckins: parseInt(stats.total),
      },
      needsSetup: !preferences || !preferences.setup_completed,
    });
  } catch (err) {
    console.error('Get personalization summary error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get summary' });
  }
});

// ============================================
// CONSENT MANAGEMENT
// ============================================

// GET /api/personalization/consent - Get user's consent settings
router.get('/consent', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const result = await db.query(`
      SELECT
        use_health_data,
        use_work_data,
        use_checkin_data,
        allow_aggregate_contribution,
        consent_updated_at
      FROM scoring_consent
      WHERE employee_id = $1
    `, [employeeId]);

    if (result.rows.length === 0) {
      // Return defaults if no consent record exists
      return res.json({
        useHealthData: true,
        useWorkData: true,
        useCheckinData: true,
        allowAggregateContribution: true,
        consentUpdatedAt: null,
        isDefault: true,
      });
    }

    const row = result.rows[0];
    res.json({
      useHealthData: row.use_health_data,
      useWorkData: row.use_work_data,
      useCheckinData: row.use_checkin_data,
      allowAggregateContribution: row.allow_aggregate_contribution,
      consentUpdatedAt: row.consent_updated_at,
      isDefault: false,
    });
  } catch (err) {
    console.error('Get consent error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get consent settings' });
  }
});

// PUT /api/personalization/consent - Update user's consent settings
router.put('/consent', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      useHealthData,
      useWorkData,
      useCheckinData,
      allowAggregateContribution,
    } = req.body;

    const result = await db.query(`
      INSERT INTO scoring_consent (
        employee_id,
        use_health_data,
        use_work_data,
        use_checkin_data,
        allow_aggregate_contribution,
        consent_updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (employee_id)
      DO UPDATE SET
        use_health_data = COALESCE($2, scoring_consent.use_health_data),
        use_work_data = COALESCE($3, scoring_consent.use_work_data),
        use_checkin_data = COALESCE($4, scoring_consent.use_checkin_data),
        allow_aggregate_contribution = COALESCE($5, scoring_consent.allow_aggregate_contribution),
        consent_updated_at = NOW()
      RETURNING *
    `, [
      employeeId,
      useHealthData,
      useWorkData,
      useCheckinData,
      allowAggregateContribution,
    ]);

    const row = result.rows[0];
    res.json({
      useHealthData: row.use_health_data,
      useWorkData: row.use_work_data,
      useCheckinData: row.use_checkin_data,
      allowAggregateContribution: row.allow_aggregate_contribution,
      consentUpdatedAt: row.consent_updated_at,
      message: 'Consent settings updated successfully',
    });
  } catch (err) {
    console.error('Update consent error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update consent settings' });
  }
});

// ============================================
// VALIDATED INSTRUMENT QUESTIONS
// ============================================

// GET /api/personalization/burnout-questions - Get burnout assessment questions
router.get('/burnout-questions', async (req, res) => {
  try {
    const { type = 'quick' } = req.query;

    const result = await db.query(`
      SELECT
        id,
        question_text,
        question_order,
        scale_min,
        scale_max,
        weight
      FROM burnout_instrument_questions
      WHERE instrument_type = $1 AND is_active = true
      ORDER BY question_order
    `, [type]);

    res.json({
      instrumentType: type,
      questions: result.rows.map(row => ({
        id: row.id,
        text: row.question_text,
        order: row.question_order,
        scaleMin: row.scale_min,
        scaleMax: row.scale_max,
        weight: parseFloat(row.weight),
      })),
    });
  } catch (err) {
    console.error('Get burnout questions error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get questions' });
  }
});

// POST /api/personalization/checkins/validated - Create check-in with validated responses
router.post('/checkins/validated', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      overallFeeling,
      energyLevel,
      stressLevel,
      motivationLevel,
      notes,
      validatedResponses, // Array of { questionId, response }
    } = req.body;

    // Validate required field
    if (!overallFeeling || overallFeeling < 1 || overallFeeling > 5) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Overall feeling is required and must be between 1 and 5',
      });
    }

    // Get current context snapshot and burnout score
    const healthResult = await db.query(`
      SELECT sleep_hours, sleep_quality_score, heart_rate_variability, exercise_minutes
      FROM health_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    const workResult = await db.query(`
      SELECT hours_worked, meetings_attended, meeting_hours
      FROM work_metrics
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    // Get current burnout score for calibration
    const zoneResult = await db.query(`
      SELECT burnout_score
      FROM zone_history
      WHERE employee_id = $1
      ORDER BY date DESC
      LIMIT 1
    `, [employeeId]);

    const contextSnapshot = {
      health: healthResult.rows[0] || null,
      work: workResult.rows[0] || null,
      timestamp: new Date().toISOString(),
    };

    const burnoutScoreAtCheckin = zoneResult.rows[0]?.burnout_score || null;

    const result = await db.query(`
      INSERT INTO feeling_checkins (
        employee_id,
        overall_feeling,
        energy_level,
        stress_level,
        motivation_level,
        notes,
        context_snapshot,
        validated_responses,
        burnout_score_at_checkin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      employeeId,
      overallFeeling,
      energyLevel || null,
      stressLevel || null,
      motivationLevel || null,
      notes || null,
      contextSnapshot,
      validatedResponses ? JSON.stringify(validatedResponses) : null,
      burnoutScoreAtCheckin,
    ]);

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      overallFeeling: row.overall_feeling,
      energyLevel: row.energy_level,
      stressLevel: row.stress_level,
      motivationLevel: row.motivation_level,
      notes: row.notes,
      validatedResponses: row.validated_responses,
      burnoutScoreAtCheckin: row.burnout_score_at_checkin,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('Create validated check-in error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create check-in' });
  }
});

module.exports = router;
