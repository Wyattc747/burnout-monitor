const db = require('../utils/db');

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/integrations/slack/callback';

const SCOPES = ['chat:write', 'users:read', 'channels:read', 'channels:history'].join(',');

/**
 * Check if Slack is configured
 */
function isConfigured() {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}

/**
 * Get OAuth URL for Slack
 */
function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: SLACK_REDIRECT_URI,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange code for tokens
 */
async function exchangeCodeForTokens(code) {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Failed to exchange code for tokens');
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    botUserId: data.bot_user_id,
    scope: data.scope,
  };
}

/**
 * Store Slack connection
 */
async function storeConnection(userId, tokens) {
  await db.query(`
    INSERT INTO integration_connections (employee_id, provider, status, credentials)
    SELECT e.id, 'slack', 'active', $2
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
 * Check if Slack is connected for user
 */
async function isConnected(userId) {
  const result = await db.query(`
    SELECT ic.status
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'slack' AND ic.status = 'active'
  `, [userId]);

  return result.rows.length > 0;
}

/**
 * Send a Slack message
 */
async function sendMessage(userId, channel, text, blocks = null) {
  const result = await db.query(`
    SELECT ic.credentials
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'slack' AND ic.status = 'active'
  `, [userId]);

  if (result.rows.length === 0) {
    throw new Error('Slack not connected');
  }

  const credentials = result.rows[0].credentials;

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.accessToken}`,
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Failed to send message');
  }

  return data;
}

/**
 * Send a wellness check-in reminder via Slack
 */
async function sendCheckinReminder(userId, slackUserId) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Time for your daily wellness check-in!* :wave:\n\nHow are you feeling today?',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Check In Now' },
          style: 'primary',
          url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
        },
      ],
    },
  ];

  return sendMessage(userId, slackUserId, 'Time for your daily wellness check-in!', blocks);
}

/**
 * Send a zone change alert via Slack
 */
async function sendZoneAlert(userId, slackUserId, zone, previousZone) {
  const zoneEmoji = {
    green: ':green_circle:',
    yellow: ':large_yellow_circle:',
    red: ':red_circle:',
  };

  const zoneText = {
    green: 'Thriving',
    yellow: 'At Risk',
    red: 'Burnout Zone',
  };

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${zoneEmoji[zone]} Your wellness zone has changed to *${zoneText[zone]}*`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Previous zone: ${zoneEmoji[previousZone]} ${zoneText[previousZone]}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details' },
          url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
        },
      ],
    },
  ];

  return sendMessage(userId, slackUserId, `Your wellness zone changed to ${zoneText[zone]}`, blocks);
}

/**
 * Disconnect Slack
 */
async function disconnect(userId) {
  await db.query(`
    UPDATE integration_connections ic
    SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP
    FROM employees e, users u
    WHERE ic.employee_id = e.id
      AND e.user_id = u.id
      AND u.id = $1
      AND ic.provider = 'slack'
  `, [userId]);
}

module.exports = {
  isConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  storeConnection,
  isConnected,
  sendMessage,
  sendCheckinReminder,
  sendZoneAlert,
  disconnect,
};
