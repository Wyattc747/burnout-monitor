/**
 * Terra API Integration Service
 * Pulls health data from Apple Health, Fitbit, Garmin, Oura, etc.
 *
 * Terra acts as a unified API for wearable health data.
 * Users connect via Terra's widget, and we receive data via webhooks.
 *
 * Setup:
 * 1. Create account at https://tryterra.co
 * 2. Get API Key and Dev ID from dashboard
 * 3. Configure webhook URL in Terra dashboard
 */

const axios = require('axios');
const db = require('../utils/db');

const TERRA_API_KEY = process.env.TERRA_API_KEY;
const TERRA_DEV_ID = process.env.TERRA_DEV_ID;
const TERRA_WEBHOOK_SECRET = process.env.TERRA_WEBHOOK_SECRET;

const terraApi = axios.create({
  baseURL: 'https://api.tryterra.co/v2',
  headers: {
    'x-api-key': TERRA_API_KEY,
    'dev-id': TERRA_DEV_ID,
    'Content-Type': 'application/json',
  },
});

/**
 * Generate a Terra widget session for user to connect their device
 */
async function generateWidgetSession(employeeId, providers = ['APPLE', 'FITBIT', 'GARMIN', 'OURA']) {
  try {
    const response = await terraApi.post('/auth/generateWidgetSession', {
      reference_id: employeeId,
      providers: providers.join(','),
      auth_success_redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?step=health-devices&status=success`,
      auth_failure_redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?step=health-devices&status=error`,
    });

    return {
      sessionId: response.data.session_id,
      url: response.data.url,
    };
  } catch (err) {
    console.error('Terra widget session error:', err.response?.data || err.message);
    throw new Error('Failed to generate health device connection');
  }
}

/**
 * Store Terra user connection after successful auth
 */
async function storeConnection(employeeId, terraUserId, provider) {
  await db.query(`
    INSERT INTO integration_connections (employee_id, provider, external_user_id, status)
    VALUES ($1, $2, $3, 'active')
    ON CONFLICT (employee_id, provider)
    DO UPDATE SET
      external_user_id = $3,
      status = 'active',
      updated_at = NOW()
  `, [employeeId, provider.toLowerCase(), terraUserId]);
}

/**
 * Get connected health providers for an employee
 */
async function getConnections(employeeId) {
  const result = await db.query(`
    SELECT provider, external_user_id, status, updated_at
    FROM integration_connections
    WHERE employee_id = $1
      AND provider IN ('apple', 'fitbit', 'garmin', 'oura', 'whoop', 'polar')
  `, [employeeId]);

  return result.rows.map(row => ({
    provider: row.provider,
    terraUserId: row.external_user_id,
    status: row.status,
    lastSync: row.updated_at,
  }));
}

/**
 * Fetch health data for a user from Terra
 */
async function fetchHealthData(terraUserId, startDate, endDate) {
  try {
    // Get sleep data
    const sleepResponse = await terraApi.get(`/sleep`, {
      params: {
        user_id: terraUserId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    // Get activity data
    const activityResponse = await terraApi.get(`/activity`, {
      params: {
        user_id: terraUserId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    // Get body data (HRV, resting HR)
    const bodyResponse = await terraApi.get(`/body`, {
      params: {
        user_id: terraUserId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    return {
      sleep: sleepResponse.data.data || [],
      activity: activityResponse.data.data || [],
      body: bodyResponse.data.data || [],
    };
  } catch (err) {
    console.error('Terra fetch error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Process Terra webhook data and store health metrics
 */
async function processWebhook(webhookData) {
  const { type, user, data } = webhookData;

  // Find employee by Terra reference_id
  const connectionResult = await db.query(`
    SELECT employee_id FROM integration_connections
    WHERE external_user_id = $1
  `, [user?.user_id]);

  if (connectionResult.rows.length === 0) {
    console.log('No employee found for Terra user:', user?.user_id);
    return;
  }

  const employeeId = connectionResult.rows[0].employee_id;

  switch (type) {
    case 'sleep':
      await processSleepData(employeeId, data);
      break;
    case 'activity':
      await processActivityData(employeeId, data);
      break;
    case 'body':
      await processBodyData(employeeId, data);
      break;
    case 'auth':
      // User connected/disconnected
      if (webhookData.status === 'success') {
        await storeConnection(employeeId, user.user_id, user.provider);
      }
      break;
    default:
      console.log('Unknown webhook type:', type);
  }
}

/**
 * Process and store sleep data
 */
async function processSleepData(employeeId, sleepData) {
  for (const sleep of sleepData) {
    const date = sleep.metadata?.start_time?.split('T')[0];
    if (!date) continue;

    const sleepHours = (sleep.sleep_durations_data?.asleep?.duration_asleep_state_seconds || 0) / 3600;
    const deepSleepHours = (sleep.sleep_durations_data?.asleep?.duration_deep_sleep_state_seconds || 0) / 3600;
    const remSleepHours = (sleep.sleep_durations_data?.asleep?.duration_REM_sleep_state_seconds || 0) / 3600;
    const sleepQuality = sleep.sleep_durations_data?.sleep_efficiency || null;

    await db.query(`
      INSERT INTO health_metrics (employee_id, date, sleep_hours, deep_sleep_hours, sleep_quality_score, source)
      VALUES ($1, $2, $3, $4, $5, 'terra')
      ON CONFLICT (employee_id, date)
      DO UPDATE SET
        sleep_hours = COALESCE($3, health_metrics.sleep_hours),
        deep_sleep_hours = COALESCE($4, health_metrics.deep_sleep_hours),
        sleep_quality_score = COALESCE($5, health_metrics.sleep_quality_score),
        source = 'terra',
        updated_at = NOW()
    `, [employeeId, date, sleepHours || null, deepSleepHours || null, sleepQuality ? Math.round(sleepQuality * 100) : null]);
  }
}

/**
 * Process and store activity data
 */
async function processActivityData(employeeId, activityData) {
  for (const activity of activityData) {
    const date = activity.metadata?.start_time?.split('T')[0];
    if (!date) continue;

    const steps = activity.distance_data?.steps || null;
    const exerciseMinutes = Math.round((activity.active_durations_data?.activity_seconds || 0) / 60);
    const activeCalories = activity.calories_data?.net_activity_calories || null;

    await db.query(`
      INSERT INTO health_metrics (employee_id, date, steps, exercise_minutes, source)
      VALUES ($1, $2, $3, $4, 'terra')
      ON CONFLICT (employee_id, date)
      DO UPDATE SET
        steps = COALESCE($3, health_metrics.steps),
        exercise_minutes = COALESCE($4, health_metrics.exercise_minutes),
        source = 'terra',
        updated_at = NOW()
    `, [employeeId, date, steps, exerciseMinutes]);
  }
}

/**
 * Process and store body/vitals data
 */
async function processBodyData(employeeId, bodyData) {
  for (const body of bodyData) {
    const date = body.metadata?.start_time?.split('T')[0];
    if (!date) continue;

    const restingHr = body.heart_data?.resting_hr_bpm || null;
    const avgHr = body.heart_data?.avg_hr_bpm || null;
    const hrv = body.heart_data?.avg_hrv_rmssd || body.heart_data?.avg_hrv_sdnn || null;

    await db.query(`
      INSERT INTO health_metrics (employee_id, date, resting_heart_rate, avg_heart_rate, heart_rate_variability, source)
      VALUES ($1, $2, $3, $4, $5, 'terra')
      ON CONFLICT (employee_id, date)
      DO UPDATE SET
        resting_heart_rate = COALESCE($3, health_metrics.resting_heart_rate),
        avg_heart_rate = COALESCE($4, health_metrics.avg_heart_rate),
        heart_rate_variability = COALESCE($5, health_metrics.heart_rate_variability),
        source = 'terra',
        updated_at = NOW()
    `, [employeeId, date, restingHr, avgHr, hrv]);
  }
}

/**
 * Disconnect a user's health device
 */
async function disconnect(employeeId, provider) {
  // Get Terra user ID
  const result = await db.query(`
    SELECT external_user_id FROM integration_connections
    WHERE employee_id = $1 AND provider = $2
  `, [employeeId, provider.toLowerCase()]);

  if (result.rows.length > 0) {
    try {
      // Deauthenticate from Terra
      await terraApi.delete(`/auth/deauthenticate`, {
        data: { user_id: result.rows[0].external_user_id },
      });
    } catch (err) {
      console.error('Terra deauth error:', err.response?.data || err.message);
    }
  }

  // Remove from our database
  await db.query(`
    DELETE FROM integration_connections
    WHERE employee_id = $1 AND provider = $2
  `, [employeeId, provider.toLowerCase()]);
}

/**
 * Verify Terra webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!TERRA_WEBHOOK_SECRET) return true; // Skip if not configured

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', TERRA_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Check if Terra is configured
 */
function isConfigured() {
  return !!(TERRA_API_KEY && TERRA_DEV_ID);
}

module.exports = {
  generateWidgetSession,
  storeConnection,
  getConnections,
  fetchHealthData,
  processWebhook,
  disconnect,
  verifyWebhookSignature,
  isConfigured,
};
