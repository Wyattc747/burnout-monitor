/**
 * Gusto Adapter
 *
 * Gusto uses OAuth 2.0 authentication.
 * API Docs: https://docs.gusto.com/
 */

const BaseHRAdapter = require('./baseAdapter');

class GustoAdapter extends BaseHRAdapter {
  constructor(integration) {
    super(integration);
    this.environment = this.providerSettings.environment || 'production';
    this.baseUrl =
      this.environment === 'sandbox'
        ? 'https://api.gusto-demo.com/v1'
        : 'https://api.gusto.com/v1';

    this.companyId = this.providerSettings.companyId;

    // OAuth tokens
    this.accessToken = this.credentials.accessToken;
    this.refreshToken = this.credentials.refreshToken;
    this.tokenExpiresAt = this.credentials.tokenExpiresAt;
  }

  static get providerName() {
    return 'gusto';
  }

  static getRequiredFields() {
    return [
      {
        name: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        description: 'OAuth Client ID from Gusto Developer Portal',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        description: 'OAuth Client Secret',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'select',
        required: true,
        options: ['production', 'sandbox'],
        description: 'Gusto environment to connect to',
      },
    ];
  }

  static validateCredentials(credentials) {
    const errors = [];

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
      externalId: 'uuid',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      department: 'department',
      jobTitle: 'jobs[0].title',
      hireDate: 'jobs[0].hire_date',
      managerId: 'manager_uuid',
      status: 'onboarded',
      phone: 'phone',
    };
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };
  }

  getAuthorizationUrl(redirectUri, state) {
    const baseAuthUrl =
      this.environment === 'sandbox'
        ? 'https://api.gusto-demo.com/oauth/authorize'
        : 'https://api.gusto.com/oauth/authorize';

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });

    return `${baseAuthUrl}?${params}`;
  }

  async exchangeCodeForTokens(code, redirectUri) {
    const tokenUrl =
      this.environment === 'sandbox'
        ? 'https://api.gusto-demo.com/oauth/token'
        : 'https://api.gusto.com/oauth/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      return null;
    }

    const tokenUrl =
      this.environment === 'sandbox'
        ? 'https://api.gusto-demo.com/oauth/token'
        : 'https://api.gusto.com/oauth/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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

      // Test by fetching current user info and company
      const meUrl = `${this.baseUrl}/me`;
      const meResponse = await this.makeRequest('GET', meUrl);

      // Get first company if not set
      if (!this.companyId && meResponse.roles?.payroll_admin?.companies?.length > 0) {
        this.companyId = meResponse.roles.payroll_admin.companies[0].uuid;
      }

      return {
        success: true,
        message: 'Successfully connected to Gusto',
        companyId: this.companyId,
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

      if (!this.companyId) {
        // Get company ID first
        const meResponse = await this.makeRequest('GET', `${this.baseUrl}/me`);
        if (meResponse.roles?.payroll_admin?.companies?.length > 0) {
          this.companyId = meResponse.roles.payroll_admin.companies[0].uuid;
        } else {
          throw new Error('No company found for this account');
        }
      }

      const url = `${this.baseUrl}/companies/${this.companyId}/employees`;
      const response = await this.makeRequest('GET', url);

      return (response || []).map(emp => this.transformGustoEmployee(emp));
    } catch (error) {
      console.error('Gusto fetchEmployees error:', error);
      throw error;
    }
  }

  transformGustoEmployee(employee) {
    const job = (employee.jobs || [])[0] || {};

    return {
      id: employee.uuid,
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      email: employee.email || '',
      department: employee.department || '',
      jobTitle: job.title || '',
      hireDate: job.hire_date || null,
      managerId: employee.manager_uuid || null,
      status: employee.onboarded ? 'Active' : 'Pending',
      phone: employee.phone || '',
      middleInitial: employee.middle_initial || '',
      dateOfBirth: employee.date_of_birth || null,
    };
  }

  async fetchDepartments() {
    try {
      await this.refreshTokensIfNeeded();

      if (!this.companyId) {
        const meResponse = await this.makeRequest('GET', `${this.baseUrl}/me`);
        if (meResponse.roles?.payroll_admin?.companies?.length > 0) {
          this.companyId = meResponse.roles.payroll_admin.companies[0].uuid;
        }
      }

      // Gusto has a departments endpoint
      const url = `${this.baseUrl}/companies/${this.companyId}/departments`;
      const response = await this.makeRequest('GET', url);

      return (response || []).map(dept => ({
        id: dept.uuid,
        name: dept.title,
        code: dept.uuid,
        employeeCount: dept.employees?.length || 0,
      }));
    } catch (error) {
      console.error('Gusto fetchDepartments error:', error);
      // Fallback: extract from employees
      const employees = await this.fetchEmployees();
      const deptMap = new Map();
      employees.forEach(emp => {
        if (emp.department && !deptMap.has(emp.department)) {
          deptMap.set(emp.department, { id: emp.department, name: emp.department });
        }
      });
      return Array.from(deptMap.values());
    }
  }

  async fetchEmployee(externalId) {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/employees/${externalId}`;
      const response = await this.makeRequest('GET', url);
      return this.transformGustoEmployee(response);
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch time off requests
   */
  async fetchTimeOff() {
    try {
      await this.refreshTokensIfNeeded();

      if (!this.companyId) {
        throw new Error('Company ID required');
      }

      const url = `${this.baseUrl}/companies/${this.companyId}/time_off_requests`;
      return this.makeRequest('GET', url);
    } catch (error) {
      console.error('Gusto fetchTimeOff error:', error);
      throw error;
    }
  }
}

module.exports = GustoAdapter;
