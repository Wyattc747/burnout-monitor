/**
 * Google Calendar Service
 * Handles OAuth and calendar event fetching
 */

const { google } = require('googleapis');
const db = require('../utils/db');

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google/callback'
);

// Scopes needed for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

/**
 * Generate OAuth authorization URL
 */
function getAuthUrl(userId) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId, // Pass user ID through OAuth flow
  });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Store tokens in database
 */
async function storeTokens(userId, tokens) {
  await db.query(
    `INSERT INTO integration_connections (user_id, provider, access_token, refresh_token, token_expires_at, connected_at)
     VALUES ($1, 'google_calendar', $2, $3, $4, NOW())
     ON CONFLICT (user_id, provider)
     DO UPDATE SET access_token = $2, refresh_token = COALESCE($3, integration_connections.refresh_token),
                   token_expires_at = $4, connected_at = NOW()`,
    [userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
  );
}

/**
 * Get stored tokens for a user
 */
async function getStoredTokens(userId) {
  const result = await db.query(
    `SELECT access_token, refresh_token, token_expires_at
     FROM integration_connections
     WHERE user_id = $1 AND provider = 'google_calendar'`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    access_token: result.rows[0].access_token,
    refresh_token: result.rows[0].refresh_token,
    expiry_date: result.rows[0].token_expires_at?.getTime(),
  };
}

/**
 * Get authenticated OAuth client for a user
 */
async function getAuthenticatedClient(userId) {
  const tokens = await getStoredTokens(userId);
  if (!tokens) {
    throw new Error('User not connected to Google Calendar');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  client.setCredentials(tokens);

  // Handle token refresh
  client.on('tokens', async (newTokens) => {
    await storeTokens(userId, { ...tokens, ...newTokens });
  });

  return client;
}

/**
 * Fetch calendar events for a date range
 */
async function getCalendarEvents(userId, startDate, endDate) {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  return response.data.items || [];
}

/**
 * Aggregate calendar data into daily metrics
 */
async function getDailyCalendarMetrics(userId, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await getCalendarEvents(userId, startDate, endDate);

  // Group events by date
  const dailyMetrics = {};

  for (const event of events) {
    if (!event.start?.dateTime) continue; // Skip all-day events for now

    const date = event.start.dateTime.split('T')[0];
    if (!dailyMetrics[date]) {
      dailyMetrics[date] = {
        date,
        totalMeetings: 0,
        totalMeetingMinutes: 0,
        meetings: [],
      };
    }

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end?.dateTime || event.start.dateTime);
    const durationMinutes = Math.round((end - start) / (1000 * 60));

    dailyMetrics[date].totalMeetings++;
    dailyMetrics[date].totalMeetingMinutes += durationMinutes;
    dailyMetrics[date].meetings.push({
      id: event.id,
      title: event.summary || 'Untitled',
      start: event.start.dateTime,
      end: event.end?.dateTime,
      duration: durationMinutes,
      attendees: (event.attendees || []).length,
      isRecurring: !!event.recurringEventId,
    });
  }

  // Convert to array and sort by date
  return Object.values(dailyMetrics).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get upcoming meetings
 */
async function getUpcomingMeetings(userId, limit = 10) {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Next 7 days

  const events = await getCalendarEvents(userId, now, endDate);

  return events
    .filter((event) => event.start?.dateTime)
    .slice(0, limit)
    .map((event) => {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end?.dateTime || event.start.dateTime);
      const durationMinutes = Math.round((end - start) / (1000 * 60));

      return {
        id: event.id,
        title: event.summary || 'Untitled',
        start: event.start.dateTime,
        end: event.end?.dateTime,
        duration: durationMinutes,
        attendees: (event.attendees || []).map((a) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus,
        })),
        location: event.location,
        meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      };
    });
}

/**
 * Disconnect Google Calendar
 */
async function disconnect(userId) {
  // Revoke tokens if possible
  try {
    const tokens = await getStoredTokens(userId);
    if (tokens?.access_token) {
      await oauth2Client.revokeToken(tokens.access_token);
    }
  } catch (err) {
    console.error('Error revoking Google token:', err.message);
  }

  // Remove from database
  await db.query(
    `DELETE FROM integration_connections WHERE user_id = $1 AND provider = 'google_calendar'`,
    [userId]
  );
}

/**
 * Check if user is connected
 */
async function isConnected(userId) {
  const result = await db.query(
    `SELECT id FROM integration_connections WHERE user_id = $1 AND provider = 'google_calendar'`,
    [userId]
  );
  return result.rows.length > 0;
}

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  storeTokens,
  getStoredTokens,
  getCalendarEvents,
  getDailyCalendarMetrics,
  getUpcomingMeetings,
  disconnect,
  isConnected,
};
