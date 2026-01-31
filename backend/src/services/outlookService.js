const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const db = require('../utils/db');

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/integrations/outlook/callback';

const SCOPES = ['Calendars.Read', 'User.Read', 'offline_access'];

let msalClient = null;

/**
 * Initialize MSAL client
 */
function getMsalClient() {
  if (!msalClient && isConfigured()) {
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: MICROSOFT_CLIENT_ID,
        clientSecret: MICROSOFT_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
      },
    });
  }
  return msalClient;
}

/**
 * Check if Outlook is configured
 */
function isConfigured() {
  return !!(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}

/**
 * Get OAuth URL for Outlook
 */
async function getAuthUrl(userId) {
  const client = getMsalClient();
  if (!client) return null;

  const authCodeUrl = await client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    state: userId,
  });

  return authCodeUrl;
}

/**
 * Exchange code for tokens
 */
async function exchangeCodeForTokens(code) {
  const client = getMsalClient();
  if (!client) throw new Error('Outlook not configured');

  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresOn,
    account: result.account,
  };
}

/**
 * Store Outlook connection
 */
async function storeConnection(userId, tokens) {
  await db.query(`
    INSERT INTO integration_connections (employee_id, provider, status, credentials)
    SELECT e.id, 'outlook', 'active', $2
    FROM employees e
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1
    ON CONFLICT (employee_id, provider) DO UPDATE SET
      status = 'active',
      credentials = $2,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, JSON.stringify(tokens)]);
}

/**
 * Check if Outlook is connected for user
 */
async function isConnected(userId) {
  const result = await db.query(`
    SELECT ic.status
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'outlook' AND ic.status = 'active'
  `, [userId]);

  return result.rows.length > 0;
}

/**
 * Get Graph client for user
 */
async function getGraphClient(userId) {
  const result = await db.query(`
    SELECT ic.credentials
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'outlook' AND ic.status = 'active'
  `, [userId]);

  if (result.rows.length === 0) return null;

  const credentials = result.rows[0].credentials;

  // Refresh token if needed
  if (new Date(credentials.expiresAt) < new Date()) {
    const client = getMsalClient();
    if (client && credentials.account) {
      try {
        const newTokens = await client.acquireTokenSilent({
          scopes: SCOPES,
          account: credentials.account,
        });

        credentials.accessToken = newTokens.accessToken;
        credentials.expiresAt = newTokens.expiresOn;

        await storeConnection(userId, credentials);
      } catch (err) {
        console.error('Failed to refresh Outlook token:', err);
        return null;
      }
    }
  }

  return Client.init({
    authProvider: (done) => {
      done(null, credentials.accessToken);
    },
  });
}

/**
 * Get calendar events for a time period
 */
async function getCalendarEvents(userId, startDate, endDate) {
  const client = await getGraphClient(userId);
  if (!client) return null;

  try {
    const result = await client
      .api('/me/calendarview')
      .query({
        startDateTime: startDate,
        endDateTime: endDate,
        $select: 'subject,start,end,isAllDay,showAs,organizer,attendees',
        $orderby: 'start/dateTime',
        $top: 100,
      })
      .get();

    return result.value.map((event) => ({
      id: event.id,
      subject: event.subject,
      start: event.start.dateTime,
      end: event.end.dateTime,
      isAllDay: event.isAllDay,
      showAs: event.showAs,
      organizer: event.organizer?.emailAddress?.name,
      attendeeCount: event.attendees?.length || 0,
    }));
  } catch (err) {
    console.error('Failed to fetch Outlook events:', err);
    throw err;
  }
}

/**
 * Get daily calendar metrics
 */
async function getDailyCalendarMetrics(userId, days = 30) {
  const metrics = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const startDate = `${dateStr}T00:00:00`;
    const endDate = `${dateStr}T23:59:59`;

    try {
      const events = await getCalendarEvents(userId, startDate, endDate);
      if (!events) continue;

      let totalMeetingMinutes = 0;
      let meetingCount = 0;

      for (const event of events) {
        if (event.isAllDay) continue;

        const start = new Date(event.start);
        const end = new Date(event.end);
        const duration = (end - start) / (1000 * 60);

        totalMeetingMinutes += duration;
        meetingCount++;
      }

      metrics.push({
        date: dateStr,
        meetingCount,
        meetingHours: parseFloat((totalMeetingMinutes / 60).toFixed(1)),
        focusTimeHours: Math.max(0, 8 - totalMeetingMinutes / 60),
      });
    } catch (err) {
      console.error(`Failed to get metrics for ${dateStr}:`, err);
    }
  }

  return metrics;
}

/**
 * Disconnect Outlook
 */
async function disconnect(userId) {
  await db.query(`
    UPDATE integration_connections ic
    SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP
    FROM employees e, users u
    WHERE ic.employee_id = e.id
      AND e.user_id = u.id
      AND u.id = $1
      AND ic.provider = 'outlook'
  `, [userId]);
}

module.exports = {
  isConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  storeConnection,
  isConnected,
  getCalendarEvents,
  getDailyCalendarMetrics,
  disconnect,
};
