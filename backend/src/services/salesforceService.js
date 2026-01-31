/**
 * Salesforce Integration Service
 * Pulls work activity data from Salesforce
 */

const axios = require('axios');
const db = require('../utils/db');

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SALESFORCE_REDIRECT_URI = process.env.SALESFORCE_REDIRECT_URI || 'http://localhost:3001/api/integrations/salesforce/callback';

/**
 * Generate Salesforce OAuth URL for user authorization
 */
function getAuthUrl(state) {
  const baseUrl = 'https://login.salesforce.com/services/oauth2/authorize';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SALESFORCE_CLIENT_ID,
    redirect_uri: SALESFORCE_REDIRECT_URI,
    scope: 'api refresh_token',
    state: state,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForTokens(code) {
  const response = await axios.post(
    'https://login.salesforce.com/services/oauth2/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      redirect_uri: SALESFORCE_REDIRECT_URI,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  const response = await axios.post(
    'https://login.salesforce.com/services/oauth2/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data;
}

/**
 * Store user's Salesforce connection
 */
async function storeConnection(employeeId, tokens) {
  await db.query(`
    INSERT INTO integration_connections (employee_id, provider, access_token, refresh_token, instance_url, expires_at)
    VALUES ($1, 'salesforce', $2, $3, $4, NOW() + INTERVAL '2 hours')
    ON CONFLICT (employee_id, provider)
    DO UPDATE SET
      access_token = $2,
      refresh_token = COALESCE($3, integration_connections.refresh_token),
      instance_url = $4,
      expires_at = NOW() + INTERVAL '2 hours',
      updated_at = NOW()
  `, [employeeId, tokens.access_token, tokens.refresh_token, tokens.instance_url]);
}

/**
 * Get user's Salesforce connection
 */
async function getConnection(employeeId) {
  const result = await db.query(`
    SELECT access_token, refresh_token, instance_url, expires_at
    FROM integration_connections
    WHERE employee_id = $1 AND provider = 'salesforce'
  `, [employeeId]);

  if (result.rows.length === 0) {
    return null;
  }

  const connection = result.rows[0];

  // Check if token needs refresh
  if (new Date(connection.expires_at) < new Date()) {
    try {
      const newTokens = await refreshAccessToken(connection.refresh_token);
      await storeConnection(employeeId, {
        ...newTokens,
        instance_url: connection.instance_url,
      });
      return {
        accessToken: newTokens.access_token,
        instanceUrl: connection.instance_url,
      };
    } catch (err) {
      console.error('Failed to refresh Salesforce token:', err);
      return null;
    }
  }

  return {
    accessToken: connection.access_token,
    instanceUrl: connection.instance_url,
  };
}

/**
 * Make authenticated Salesforce API request
 */
async function salesforceRequest(employeeId, endpoint, method = 'GET', data = null) {
  const connection = await getConnection(employeeId);
  if (!connection) {
    throw new Error('Salesforce not connected');
  }

  const response = await axios({
    method,
    url: `${connection.instanceUrl}${endpoint}`,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    data,
  });

  return response.data;
}

/**
 * Fetch work activity metrics from Salesforce
 */
async function fetchWorkMetrics(employeeId, startDate, endDate) {
  const connection = await getConnection(employeeId);
  if (!connection) {
    return null;
  }

  try {
    // Get the Salesforce User ID
    const identity = await salesforceRequest(employeeId, '/services/oauth2/userinfo');
    const sfUserId = identity.user_id;

    // Query tasks completed
    const tasksQuery = `
      SELECT COUNT(Id) total, Status
      FROM Task
      WHERE OwnerId = '${sfUserId}'
        AND CreatedDate >= ${startDate}T00:00:00Z
        AND CreatedDate <= ${endDate}T23:59:59Z
      GROUP BY Status
    `;
    const tasksResult = await salesforceRequest(
      employeeId,
      `/services/data/v59.0/query?q=${encodeURIComponent(tasksQuery)}`
    );

    // Query events/meetings
    const eventsQuery = `
      SELECT COUNT(Id) total, DurationInMinutes
      FROM Event
      WHERE OwnerId = '${sfUserId}'
        AND StartDateTime >= ${startDate}T00:00:00Z
        AND StartDateTime <= ${endDate}T23:59:59Z
    `;
    const eventsResult = await salesforceRequest(
      employeeId,
      `/services/data/v59.0/query?q=${encodeURIComponent(eventsQuery)}`
    );

    // Query calls logged
    const callsQuery = `
      SELECT COUNT(Id) total
      FROM Task
      WHERE OwnerId = '${sfUserId}'
        AND Type = 'Call'
        AND CreatedDate >= ${startDate}T00:00:00Z
        AND CreatedDate <= ${endDate}T23:59:59Z
    `;
    const callsResult = await salesforceRequest(
      employeeId,
      `/services/data/v59.0/query?q=${encodeURIComponent(callsQuery)}`
    );

    // Query emails sent
    const emailsQuery = `
      SELECT COUNT(Id) total
      FROM EmailMessage
      WHERE CreatedById = '${sfUserId}'
        AND Status = '3'
        AND CreatedDate >= ${startDate}T00:00:00Z
        AND CreatedDate <= ${endDate}T23:59:59Z
    `;

    let emailsTotal = 0;
    try {
      const emailsResult = await salesforceRequest(
        employeeId,
        `/services/data/v59.0/query?q=${encodeURIComponent(emailsQuery)}`
      );
      emailsTotal = emailsResult.records?.[0]?.total || 0;
    } catch (e) {
      // EmailMessage might not be available in all orgs
    }

    // Calculate metrics
    const tasksCompleted = tasksResult.records
      ?.filter(r => r.Status === 'Completed')
      ?.reduce((sum, r) => sum + r.total, 0) || 0;
    const tasksAssigned = tasksResult.records
      ?.reduce((sum, r) => sum + r.total, 0) || 0;
    const meetingsAttended = eventsResult.totalSize || 0;
    const callsMade = callsResult.records?.[0]?.total || 0;

    return {
      tasksCompleted,
      tasksAssigned,
      meetingsAttended,
      emailsSent: emailsTotal,
      callsMade,
      source: 'salesforce',
    };
  } catch (err) {
    console.error('Salesforce fetch error:', err);
    throw err;
  }
}

/**
 * Disconnect Salesforce
 */
async function disconnect(employeeId) {
  await db.query(`
    DELETE FROM integration_connections
    WHERE employee_id = $1 AND provider = 'salesforce'
  `, [employeeId]);
}

/**
 * Check if Salesforce is configured
 */
function isConfigured() {
  return !!(SALESFORCE_CLIENT_ID && SALESFORCE_CLIENT_SECRET);
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  storeConnection,
  getConnection,
  fetchWorkMetrics,
  disconnect,
  isConfigured,
};
