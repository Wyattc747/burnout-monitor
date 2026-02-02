/**
 * Rippling Adapter
 *
 * Rippling uses OAuth 2.0 + API key authentication.
 * API Docs: https://developer.rippling.com/docs
 */

const BaseHRAdapter = require('./baseAdapter');

class RipplingAdapter extends BaseHRAdapter {
  constructor(integration) {
    super(integration);
    this.baseUrl = 'https://api.rippling.com';
    this.apiKey = this.credentials.apiKey;

    // OAuth tokens (if using OAuth flow instead of API key)
    this.accessToken = this.credentials.accessToken;
    this.refreshToken = this.credentials.refreshToken;
    this.tokenExpiresAt = this.credentials.tokenExpiresAt;
  }

  static get providerName() {
    return 'rippling';
  }

  static getRequiredFields() {
    return [
      {
        name: 'authMethod',
        label: 'Authentication Method',
        type: 'select',
        required: true,
        options: ['api_key', 'oauth'],
        description: 'Choose API Key for simple setup or OAuth for managed apps',
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: false,
        description: 'Required if using API Key auth. Generate from Rippling Admin > API Access',
      },
      {
        name: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: false,
        description: 'Required if using OAuth auth',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: false,
        description: 'Required if using OAuth auth',
      },
    ];
  }

  static validateCredentials(credentials) {
    const errors = [];

    if (credentials.authMethod === 'api_key') {
      if (!credentials.apiKey) {
        errors.push('API Key is required for API Key authentication');
      }
    } else if (credentials.authMethod === 'oauth') {
      if (!credentials.clientId) {
        errors.push('Client ID is required for OAuth authentication');
      }
      if (!credentials.clientSecret) {
        errors.push('Client Secret is required for OAuth authentication');
      }
    } else {
      errors.push('Authentication method must be either api_key or oauth');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getDefaultFieldMappings() {
    return {
      externalId: 'id',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'work_email',
      department: 'department.name',
      jobTitle: 'title',
      hireDate: 'start_date',
      managerId: 'manager_id',
      status: 'employment_status',
      phone: 'phone_number',
      personalEmail: 'personal_email',
      employeeNumber: 'employee_number',
    };
  }

  getAuthHeaders() {
    if (this.apiKey) {
      return {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      };
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };
  }

  getAuthorizationUrl(redirectUri, state) {
    if (this.apiKey) {
      return null; // Not using OAuth
    }

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'employees:read departments:read',
    });

    return `https://api.rippling.com/oauth2/authorize?${params}`;
  }

  async exchangeCodeForTokens(code, redirectUri) {
    const response = await fetch('https://api.rippling.com/oauth2/token', {
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
    if (this.apiKey) {
      return null; // API key doesn't expire
    }

    if (!this.tokenExpiresAt || new Date(this.tokenExpiresAt) > new Date()) {
      return null;
    }

    const response = await fetch('https://api.rippling.com/oauth2/token', {
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

      // Test by fetching company info
      const url = `${this.baseUrl}/platform/api/companies/current`;
      await this.makeRequest('GET', url);

      return {
        success: true,
        message: 'Successfully connected to Rippling',
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
      let cursor = null;

      // Paginate through all employees
      while (true) {
        let url = `${this.baseUrl}/platform/api/employees?limit=100`;
        if (cursor) {
          url += `&cursor=${cursor}`;
        }

        const response = await this.makeRequest('GET', url);

        const data = response.data || response;
        if (!Array.isArray(data) || data.length === 0) break;

        data.forEach(emp => {
          employees.push(this.transformRipplingEmployee(emp));
        });

        // Check for next page
        cursor = response.next_cursor;
        if (!cursor) break;
      }

      return employees;
    } catch (error) {
      console.error('Rippling fetchEmployees error:', error);
      throw error;
    }
  }

  transformRipplingEmployee(employee) {
    return {
      id: employee.id,
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      email: employee.work_email || employee.personal_email || '',
      department: employee.department?.name || '',
      departmentId: employee.department?.id || null,
      jobTitle: employee.title || '',
      hireDate: employee.start_date || null,
      managerId: employee.manager_id || null,
      status: employee.employment_status || 'ACTIVE',
      phone: employee.phone_number || '',
      employeeNumber: employee.employee_number || '',
      location: employee.work_location?.name || '',
      team: employee.team?.name || '',
      customFields: employee.custom_fields || {},
    };
  }

  async fetchDepartments() {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/platform/api/departments`;
      const response = await this.makeRequest('GET', url);

      const data = response.data || response;

      return (Array.isArray(data) ? data : []).map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.external_id || dept.id,
        parentId: dept.parent_id || null,
        managerId: dept.manager_id || null,
      }));
    } catch (error) {
      console.error('Rippling fetchDepartments error:', error);
      // Fallback: extract from employees
      const employees = await this.fetchEmployees();
      const deptMap = new Map();
      employees.forEach(emp => {
        if (emp.departmentId && !deptMap.has(emp.departmentId)) {
          deptMap.set(emp.departmentId, {
            id: emp.departmentId,
            name: emp.department,
          });
        }
      });
      return Array.from(deptMap.values());
    }
  }

  async fetchEmployee(externalId) {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/platform/api/employees/${externalId}`;
      const response = await this.makeRequest('GET', url);
      return this.transformRipplingEmployee(response);
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch teams (Rippling-specific)
   */
  async fetchTeams() {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/platform/api/teams`;
      const response = await this.makeRequest('GET', url);

      const data = response.data || response;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Rippling fetchTeams error:', error);
      return [];
    }
  }

  /**
   * Fetch custom fields definitions
   */
  async fetchCustomFields() {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/platform/api/custom_fields`;
      const response = await this.makeRequest('GET', url);

      const data = response.data || response;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Rippling fetchCustomFields error:', error);
      return [];
    }
  }

  /**
   * Fetch time off policies and requests
   */
  async fetchTimeOff() {
    try {
      await this.refreshTokensIfNeeded();

      const url = `${this.baseUrl}/platform/api/time_off_requests`;
      return this.makeRequest('GET', url);
    } catch (error) {
      console.error('Rippling fetchTimeOff error:', error);
      throw error;
    }
  }
}

module.exports = RipplingAdapter;
