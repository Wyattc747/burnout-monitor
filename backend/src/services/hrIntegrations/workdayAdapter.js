/**
 * Workday Adapter
 *
 * Workday uses OAuth 2.0 authentication.
 * API Docs: https://community.workday.com/sites/default/files/file-hosting/restapi/index.html
 */

const BaseHRAdapter = require('./baseAdapter');

class WorkdayAdapter extends BaseHRAdapter {
  constructor(integration) {
    super(integration);
    this.tenant = this.providerSettings.tenant;
    this.apiVersion = this.providerSettings.apiVersion || 'v1';
    this.baseUrl = `https://${this.tenant}.workday.com/ccx/api/${this.apiVersion}`;

    // OAuth tokens
    this.accessToken = this.credentials.accessToken;
    this.refreshToken = this.credentials.refreshToken;
    this.tokenExpiresAt = this.credentials.tokenExpiresAt;
  }

  static get providerName() {
    return 'workday';
  }

  static getRequiredFields() {
    return [
      {
        name: 'tenant',
        label: 'Tenant ID',
        type: 'text',
        required: true,
        description: 'Your Workday tenant ID (from your Workday URL)',
      },
      {
        name: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        description: 'OAuth Client ID from your Workday API client',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        description: 'OAuth Client Secret',
      },
      {
        name: 'refreshToken',
        label: 'Refresh Token',
        type: 'password',
        required: false,
        description: 'Will be obtained during OAuth flow',
      },
    ];
  }

  static validateCredentials(credentials) {
    const errors = [];

    if (!credentials.tenant) {
      errors.push('Tenant ID is required');
    }

    if (!credentials.clientId) {
      errors.push('Client ID is required');
    }

    if (!credentials.clientSecret) {
      errors.push('Client Secret is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getDefaultFieldMappings() {
    return {
      externalId: 'id',
      firstName: 'descriptor', // Workday uses descriptor for full name, needs parsing
      lastName: '',
      email: 'primaryWorkEmail',
      department: 'supervisoryOrganization.descriptor',
      jobTitle: 'businessTitle',
      hireDate: 'hireDate',
      managerId: 'manager.id',
      status: 'workerStatus.descriptor',
      phone: 'primaryWorkPhone',
    };
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };
  }

  getAuthorizationUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'Human_Resources',
    });

    return `https://${this.tenant}.workday.com/oauth2/${this.tenant}/authorize?${params}`;
  }

  async exchangeCodeForTokens(code, redirectUri) {
    const response = await fetch(`https://${this.tenant}.workday.com/oauth2/${this.tenant}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshTokensIfNeeded() {
    if (!this.tokenExpiresAt || new Date(this.tokenExpiresAt) > new Date()) {
      return null; // Token still valid
    }

    const response = await fetch(`https://${this.tenant}.workday.com/oauth2/${this.tenant}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async testConnection() {
    try {
      await this.refreshTokensIfNeeded();

      // Test by fetching workers with limit 1
      const url = `${this.baseUrl}/workers?limit=1`;
      await this.makeRequest('GET', url);

      return {
        success: true,
        message: 'Successfully connected to Workday',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async fetchEmployees() {
    try {
      await this.refreshTokensIfNeeded();

      const employees = [];
      let offset = 0;
      const limit = 100;

      // Paginate through all workers
      while (true) {
        const url = `${this.baseUrl}/workers?limit=${limit}&offset=${offset}`;
        const response = await this.makeRequest('GET', url);

        const workers = response.data || [];
        if (workers.length === 0) break;

        // Transform Workday format to our expected format
        workers.forEach(worker => {
          const transformed = this.transformWorkdayWorker(worker);
          employees.push(transformed);
        });

        offset += workers.length;
        if (workers.length < limit) break;
      }

      return employees;
    } catch (error) {
      console.error('Workday fetchEmployees error:', error);
      throw error;
    }
  }

  transformWorkdayWorker(worker) {
    // Workday has a complex nested structure, extract key fields
    const personalData = worker.workerData?.personalData || {};
    const employmentData = worker.workerData?.employmentData || {};

    // Parse name from descriptor or legalName
    let firstName = '';
    let lastName = '';
    if (personalData.legalName) {
      firstName = personalData.legalName.givenName || '';
      lastName = personalData.legalName.familyName || '';
    } else if (worker.descriptor) {
      const parts = worker.descriptor.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    return {
      id: worker.id,
      firstName,
      lastName,
      workEmail: personalData.contactInformation?.emailAddress || '',
      department: employmentData.workerJobData?.[0]?.supervisoryOrganization?.descriptor || '',
      jobTitle: employmentData.workerJobData?.[0]?.businessTitle || '',
      hireDate: employmentData.workerJobData?.[0]?.hireDate || null,
      managerId: employmentData.workerJobData?.[0]?.manager?.id || null,
      status: worker.workerStatus?.descriptor || 'Active',
      workPhone: personalData.contactInformation?.phoneNumber || '',
    };
  }

  async fetchDepartments() {
    try {
      await this.refreshTokensIfNeeded();

      // Workday calls departments "Supervisory Organizations"
      const url = `${this.baseUrl}/supervisoryOrganizations?limit=200`;
      const response = await this.makeRequest('GET', url);

      return (response.data || []).map(org => ({
        id: org.id,
        name: org.descriptor,
        code: org.organizationCode,
        parentId: org.superior?.id || null,
        managerId: org.manager?.id || null,
      }));
    } catch (error) {
      console.error('Workday fetchDepartments error:', error);
      throw error;
    }
  }

  async fetchEmployee(externalId) {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/workers/${externalId}`;
      const response = await this.makeRequest('GET', url);
      return this.transformWorkdayWorker(response);
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
}

module.exports = WorkdayAdapter;
