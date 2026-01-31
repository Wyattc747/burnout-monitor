const express = require('express');
const db = require('../utils/db');
const { authenticate, requireRole, canAccessEmployee } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// WELLNESS RESOURCES
// ============================================

// GET /api/wellness/resources - Get all wellness resources
router.get('/resources', async (req, res) => {
  try {
    const { category, contentType, difficulty } = req.query;

    let query = `
      SELECT id, title, description, content_type, category, url, content,
             duration_minutes, difficulty, tags, view_count
      FROM wellness_resources
      WHERE is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (contentType) {
      query += ` AND content_type = $${paramIndex}`;
      params.push(contentType);
      paramIndex++;
    }

    if (difficulty) {
      query += ` AND difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    query += ' ORDER BY view_count DESC, created_at DESC';

    const result = await db.query(query, params);

    const resources = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      contentType: row.content_type,
      category: row.category,
      url: row.url,
      content: row.content,
      durationMinutes: row.duration_minutes,
      difficulty: row.difficulty,
      tags: row.tags || [],
      viewCount: row.view_count,
    }));

    res.json(resources);
  } catch (err) {
    console.error('Get wellness resources error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get wellness resources' });
  }
});

// GET /api/wellness/resources/:id - Get a specific resource
router.get('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Increment view count
    await db.query(`
      UPDATE wellness_resources
      SET view_count = view_count + 1
      WHERE id = $1
    `, [id]);

    const result = await db.query(`
      SELECT id, title, description, content_type, category, url, content,
             duration_minutes, difficulty, tags, view_count
      FROM wellness_resources
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Resource not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      contentType: row.content_type,
      category: row.category,
      url: row.url,
      content: row.content,
      durationMinutes: row.duration_minutes,
      difficulty: row.difficulty,
      tags: row.tags || [],
      viewCount: row.view_count,
    });
  } catch (err) {
    console.error('Get wellness resource error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get wellness resource' });
  }
});

// ============================================
// WELLNESS STREAKS
// ============================================

// GET /api/wellness/streaks - Get current user's streaks
router.get('/streaks', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    let result = await db.query(`
      SELECT * FROM wellness_streaks
      WHERE employee_id = $1
    `, [employeeId]);

    // Create default streaks if not exists
    if (result.rows.length === 0) {
      await db.query(`
        INSERT INTO wellness_streaks (employee_id)
        VALUES ($1)
        ON CONFLICT (employee_id) DO NOTHING
      `, [employeeId]);

      result = await db.query(`
        SELECT * FROM wellness_streaks
        WHERE employee_id = $1
      `, [employeeId]);
    }

    const row = result.rows[0];
    res.json({
      checkinStreak: {
        current: row.current_checkin_streak,
        longest: row.longest_checkin_streak,
        lastDate: row.last_checkin_date,
      },
      sleepStreak: {
        current: row.current_sleep_streak,
        longest: row.longest_sleep_streak,
      },
      exerciseStreak: {
        current: row.current_exercise_streak,
        longest: row.longest_exercise_streak,
      },
      greenZoneStreak: {
        current: row.current_green_streak,
        longest: row.longest_green_streak,
      },
      totalPoints: row.total_points,
      badges: row.badges || [],
    });
  } catch (err) {
    console.error('Get wellness streaks error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get wellness streaks' });
  }
});

// POST /api/wellness/streaks/update - Update streaks after check-in
router.post('/streaks/update', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const today = new Date().toISOString().split('T')[0];

    // Get current streaks
    const streakResult = await db.query(`
      SELECT * FROM wellness_streaks
      WHERE employee_id = $1
    `, [employeeId]);

    let currentStreak = 0;
    let longestStreak = 0;
    let lastCheckinDate = null;
    let totalPoints = 0;

    if (streakResult.rows.length > 0) {
      currentStreak = streakResult.rows[0].current_checkin_streak;
      longestStreak = streakResult.rows[0].longest_checkin_streak;
      lastCheckinDate = streakResult.rows[0].last_checkin_date;
      totalPoints = streakResult.rows[0].total_points;
    }

    // Calculate new streak
    let newStreak = 1;
    if (lastCheckinDate) {
      const lastDate = new Date(lastCheckinDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = currentStreak + 1;
      } else if (diffDays === 0) {
        newStreak = currentStreak; // Same day, no change
      }
    }

    const newLongest = Math.max(longestStreak, newStreak);
    const pointsEarned = newStreak > currentStreak ? 10 : 0;

    // Update streaks
    await db.query(`
      INSERT INTO wellness_streaks (employee_id, current_checkin_streak, longest_checkin_streak, last_checkin_date, total_points)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id) DO UPDATE SET
        current_checkin_streak = $2,
        longest_checkin_streak = $3,
        last_checkin_date = $4,
        total_points = wellness_streaks.total_points + $6,
        updated_at = CURRENT_TIMESTAMP
    `, [employeeId, newStreak, newLongest, today, totalPoints + pointsEarned, pointsEarned]);

    // Check for badge achievements
    const badges = [];
    if (newStreak === 7) badges.push({ id: 'week_warrior', name: '7-Day Warrior', earnedAt: today });
    if (newStreak === 30) badges.push({ id: 'month_master', name: '30-Day Master', earnedAt: today });
    if (newStreak === 100) badges.push({ id: 'century_champion', name: '100-Day Champion', earnedAt: today });

    if (badges.length > 0) {
      await db.query(`
        UPDATE wellness_streaks
        SET badges = badges || $1::jsonb
        WHERE employee_id = $2
      `, [JSON.stringify(badges), employeeId]);
    }

    res.json({
      currentStreak: newStreak,
      longestStreak: newLongest,
      pointsEarned,
      totalPoints: totalPoints + pointsEarned,
      newBadges: badges,
    });
  } catch (err) {
    console.error('Update wellness streaks error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update wellness streaks' });
  }
});

// ============================================
// REMINDER SETTINGS
// ============================================

// GET /api/wellness/reminders - Get reminder settings
router.get('/reminders', async (req, res) => {
  try {
    const userId = req.user.userId;

    let result = await db.query(`
      SELECT * FROM reminder_settings
      WHERE user_id = $1
    `, [userId]);

    // Create default settings if not exists
    if (result.rows.length === 0) {
      await db.query(`
        INSERT INTO reminder_settings (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);

      result = await db.query(`
        SELECT * FROM reminder_settings
        WHERE user_id = $1
      `, [userId]);
    }

    const row = result.rows[0];
    res.json({
      checkinReminder: {
        enabled: row.checkin_reminder_enabled,
        time: row.checkin_reminder_time,
        days: row.checkin_reminder_days,
      },
      weeklySummary: {
        enabled: row.weekly_summary_enabled,
        day: row.weekly_summary_day,
        time: row.weekly_summary_time,
      },
      push: {
        enabled: row.push_enabled,
        subscription: row.push_subscription,
      },
      emailEnabled: row.email_enabled,
    });
  } catch (err) {
    console.error('Get reminder settings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get reminder settings' });
  }
});

// PUT /api/wellness/reminders - Update reminder settings
router.put('/reminders', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { checkinReminder, weeklySummary, push, emailEnabled } = req.body;

    await db.query(`
      INSERT INTO reminder_settings (
        user_id,
        checkin_reminder_enabled,
        checkin_reminder_time,
        checkin_reminder_days,
        weekly_summary_enabled,
        weekly_summary_day,
        weekly_summary_time,
        push_enabled,
        push_subscription,
        email_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO UPDATE SET
        checkin_reminder_enabled = COALESCE($2, reminder_settings.checkin_reminder_enabled),
        checkin_reminder_time = COALESCE($3, reminder_settings.checkin_reminder_time),
        checkin_reminder_days = COALESCE($4, reminder_settings.checkin_reminder_days),
        weekly_summary_enabled = COALESCE($5, reminder_settings.weekly_summary_enabled),
        weekly_summary_day = COALESCE($6, reminder_settings.weekly_summary_day),
        weekly_summary_time = COALESCE($7, reminder_settings.weekly_summary_time),
        push_enabled = COALESCE($8, reminder_settings.push_enabled),
        push_subscription = COALESCE($9, reminder_settings.push_subscription),
        email_enabled = COALESCE($10, reminder_settings.email_enabled),
        updated_at = CURRENT_TIMESTAMP
    `, [
      userId,
      checkinReminder?.enabled,
      checkinReminder?.time,
      checkinReminder?.days,
      weeklySummary?.enabled,
      weeklySummary?.day,
      weeklySummary?.time,
      push?.enabled,
      push?.subscription ? JSON.stringify(push.subscription) : null,
      emailEnabled,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Update reminder settings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update reminder settings' });
  }
});

// ============================================
// DETECTED PATTERNS
// ============================================

// GET /api/wellness/patterns - Get detected patterns for user
router.get('/patterns', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const result = await db.query(`
      SELECT id, pattern_type, title, description, factors, confidence, impact,
             time_period, detected_at, is_active, acknowledged_at, dismissed_at
      FROM detected_patterns
      WHERE employee_id = $1 AND is_active = true
      ORDER BY detected_at DESC
      LIMIT 20
    `, [employeeId]);

    const patterns = result.rows.map(row => ({
      id: row.id,
      patternType: row.pattern_type,
      title: row.title,
      description: row.description,
      factors: row.factors,
      confidence: row.confidence ? parseFloat(row.confidence) : null,
      impact: row.impact,
      timePeriod: row.time_period,
      detectedAt: row.detected_at,
      acknowledgedAt: row.acknowledged_at,
      dismissedAt: row.dismissed_at,
    }));

    res.json(patterns);
  } catch (err) {
    console.error('Get detected patterns error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get detected patterns' });
  }
});

// POST /api/wellness/patterns/:id/acknowledge - Acknowledge a pattern
router.post('/patterns/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    await db.query(`
      UPDATE detected_patterns
      SET acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND employee_id = $2
    `, [id, employeeId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Acknowledge pattern error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to acknowledge pattern' });
  }
});

// POST /api/wellness/patterns/:id/dismiss - Dismiss a pattern
router.post('/patterns/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employeeId;

    await db.query(`
      UPDATE detected_patterns
      SET is_active = false, dismissed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND employee_id = $2
    `, [id, employeeId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Dismiss pattern error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to dismiss pattern' });
  }
});

// ============================================
// PREDICTIVE ALERTS
// ============================================

// GET /api/wellness/alerts - Get predictive alerts for user
router.get('/alerts', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const result = await db.query(`
      SELECT id, alert_type, severity, title, message, predicted_outcome,
             confidence, days_until_predicted, recommendations, is_acknowledged, created_at
      FROM predictive_alerts
      WHERE employee_id = $1 AND is_acknowledged = false
      ORDER BY
        CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 10
    `, [employeeId]);

    const alerts = result.rows.map(row => ({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      predictedOutcome: row.predicted_outcome,
      confidence: row.confidence ? parseFloat(row.confidence) : null,
      daysUntilPredicted: row.days_until_predicted,
      recommendations: row.recommendations,
      createdAt: row.created_at,
    }));

    res.json(alerts);
  } catch (err) {
    console.error('Get predictive alerts error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get predictive alerts' });
  }
});

// POST /api/wellness/alerts/:id/acknowledge - Acknowledge an alert
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await db.query(`
      UPDATE predictive_alerts
      SET is_acknowledged = true, acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = $1
      WHERE id = $2
    `, [userId, id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Acknowledge alert error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to acknowledge alert' });
  }
});

// ============================================
// PRIVACY SETTINGS
// ============================================

// GET /api/wellness/privacy - Get privacy settings
router.get('/privacy', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    let result = await db.query(`
      SELECT * FROM privacy_settings
      WHERE employee_id = $1
    `, [employeeId]);

    // Create default settings if not exists
    if (result.rows.length === 0) {
      await db.query(`
        INSERT INTO privacy_settings (employee_id)
        VALUES ($1)
        ON CONFLICT (employee_id) DO NOTHING
      `, [employeeId]);

      result = await db.query(`
        SELECT * FROM privacy_settings
        WHERE employee_id = $1
      `, [employeeId]);
    }

    const row = result.rows[0];
    res.json({
      showHealthToManager: row.show_health_to_manager,
      showSleepToManager: row.show_sleep_to_manager,
      showHeartToManager: row.show_heart_to_manager,
      showExerciseToManager: row.show_exercise_to_manager,
      showWorkToManager: row.show_work_to_manager,
      showEmailToManager: row.show_email_to_manager,
      showCalendarToManager: row.show_calendar_to_manager,
      managerViewLevel: row.manager_view_level,
      retainDetailedDataDays: row.retain_detailed_data_days,
    });
  } catch (err) {
    console.error('Get privacy settings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get privacy settings' });
  }
});

// PUT /api/wellness/privacy - Update privacy settings
router.put('/privacy', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      showHealthToManager,
      showSleepToManager,
      showHeartToManager,
      showExerciseToManager,
      showWorkToManager,
      showEmailToManager,
      showCalendarToManager,
      managerViewLevel,
      retainDetailedDataDays,
    } = req.body;

    await db.query(`
      INSERT INTO privacy_settings (
        employee_id,
        show_health_to_manager,
        show_sleep_to_manager,
        show_heart_to_manager,
        show_exercise_to_manager,
        show_work_to_manager,
        show_email_to_manager,
        show_calendar_to_manager,
        manager_view_level,
        retain_detailed_data_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (employee_id) DO UPDATE SET
        show_health_to_manager = COALESCE($2, privacy_settings.show_health_to_manager),
        show_sleep_to_manager = COALESCE($3, privacy_settings.show_sleep_to_manager),
        show_heart_to_manager = COALESCE($4, privacy_settings.show_heart_to_manager),
        show_exercise_to_manager = COALESCE($5, privacy_settings.show_exercise_to_manager),
        show_work_to_manager = COALESCE($6, privacy_settings.show_work_to_manager),
        show_email_to_manager = COALESCE($7, privacy_settings.show_email_to_manager),
        show_calendar_to_manager = COALESCE($8, privacy_settings.show_calendar_to_manager),
        manager_view_level = COALESCE($9, privacy_settings.manager_view_level),
        retain_detailed_data_days = COALESCE($10, privacy_settings.retain_detailed_data_days),
        updated_at = CURRENT_TIMESTAMP
    `, [
      employeeId,
      showHealthToManager,
      showSleepToManager,
      showHeartToManager,
      showExerciseToManager,
      showWorkToManager,
      showEmailToManager,
      showCalendarToManager,
      managerViewLevel,
      retainDetailedDataDays,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Update privacy settings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update privacy settings' });
  }
});

// ============================================
// DATA EXPORT
// ============================================

// GET /api/wellness/export - Export user's data
router.get('/export', async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const userId = req.user.userId;

    // Get all user data
    const [
      employeeResult,
      healthResult,
      workResult,
      zoneResult,
      checkinsResult,
      preferencesResult,
      lifeEventsResult,
    ] = await Promise.all([
      db.query('SELECT * FROM employees WHERE id = $1', [employeeId]),
      db.query('SELECT * FROM health_metrics WHERE employee_id = $1 ORDER BY date DESC', [employeeId]),
      db.query('SELECT * FROM work_metrics WHERE employee_id = $1 ORDER BY date DESC', [employeeId]),
      db.query('SELECT * FROM zone_history WHERE employee_id = $1 ORDER BY date DESC', [employeeId]),
      db.query('SELECT * FROM feeling_checkins WHERE employee_id = $1 ORDER BY created_at DESC', [employeeId]),
      db.query('SELECT * FROM personal_preferences WHERE employee_id = $1', [employeeId]),
      db.query('SELECT * FROM life_events WHERE employee_id = $1 ORDER BY start_date DESC', [employeeId]),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: employeeResult.rows[0] || null,
      healthMetrics: healthResult.rows,
      workMetrics: workResult.rows,
      zoneHistory: zoneResult.rows,
      feelingCheckins: checkinsResult.rows,
      preferences: preferencesResult.rows[0] || null,
      lifeEvents: lifeEventsResult.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=wellness-data-${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  } catch (err) {
    console.error('Export data error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to export data' });
  }
});

module.exports = router;
