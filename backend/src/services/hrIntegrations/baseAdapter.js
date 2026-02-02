/**
 * Base HR Adapter - Abstract interface for HR system integrations
 *
 * All HR adapters must extend this class and implement the required methods.
 */

class BaseHRAdapter {
  constructor(integration) {
    if (this.constructor === BaseHRAdapter) {
      throw new Error('BaseHRAdapter is abstract and cannot be instantiated directly');
    }

    this.integration = integration;
    this.organizationId = integration.organization_id;
    this.credentials = integration.encrypted_credentials || {};
    this.providerSettings = integration.provider_settings || {};
    this.fieldMappings = integration.field_mappings || {};
  }

  /**
   * Get the provider name
   * @returns {string}
   */
  static get providerName() {
    throw new Error('providerName must be implemented');
  }

  /**
   * Test the connection to the HR system
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async testConnection() {
    throw new Error('testConnection must be implemented');
  }

  /**
   * Fetch all employees from the HR system
   * @returns {Promise<Array<Object>>} Raw employee data from HR system
   */
  async fetchEmployees() {
    throw new Error('fetchEmployees must be implemented');
  }

  /**
   * Fetch all departments from the HR system
   * @returns {Promise<Array<Object>>} Raw department data from HR system
   */
  async fetchDepartments() {
    throw new Error('fetchDepartments must be implemented');
  }

  /**
   * Fetch a single employee by their HR system ID
   * @param {string} externalId - The employee ID in the HR system
   * @returns {Promise<Object|null>} Raw employee data or null if not found
   */
  async fetchEmployee(externalId) {
    throw new Error('fetchEmployee must be implemented');
  }

  /**
   * Get the OAuth authorization URL (for OAuth-based integrations)
   * @param {string} redirectUri - The callback URL
   * @param {string} state - CSRF protection state
   * @returns {string|null} The authorization URL or null if not OAuth
   */
  getAuthorizationUrl(redirectUri, state) {
    return null; // Default: not OAuth-based
  }

  /**
   * Exchange OAuth code for tokens (for OAuth-based integrations)
   * @param {string} code - The authorization code
   * @param {string} redirectUri - The callback URL
   * @returns {Promise<Object|null>} Token data or null if not OAuth
   */
  async exchangeCodeForTokens(code, redirectUri) {
    return null; // Default: not OAuth-based
  }

  /**
   * Refresh OAuth tokens if expired (for OAuth-based integrations)
   * @returns {Promise<Object|null>} New token data or null if not needed
   */
  async refreshTokensIfNeeded() {
    return null; // Default: no token refresh needed
  }

  /**
   * Get required credentials/configuration fields
   * @returns {Array<{name: string, label: string, type: string, required: boolean, description?: string}>}
   */
  static getRequiredFields() {
    throw new Error('getRequiredFields must be implemented');
  }

  /**
   * Validate credentials before saving
   * @param {Object} credentials - The credentials to validate
   * @returns {{valid: boolean, errors?: Array<string>}}
   */
  static validateCredentials(credentials) {
    throw new Error('validateCredentials must be implemented');
  }

  /**
   * Get default field mappings for this provider
   * @returns {Object} Default mapping of HR fields to ShepHerd fields
   */
  static getDefaultFieldMappings() {
    return {
      externalId: 'id',
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      department: 'department',
      jobTitle: 'jobTitle',
      hireDate: 'hireDate',
      managerId: 'managerId',
      status: 'status',
      phone: 'phone',
    };
  }

  /**
   * Transform raw HR data using field mappings
   * @param {Object} rawData - Raw employee data from HR system
   * @returns {Object} Transformed employee data
   */
  transformEmployee(rawData) {
    const mappings = { ...this.constructor.getDefaultFieldMappings(), ...this.fieldMappings };
    const result = {};

    for (const [shepherdField, hrField] of Object.entries(mappings)) {
      if (hrField && rawData[hrField] !== undefined) {
        result[shepherdField] = rawData[hrField];
      } else if (hrField && hrField.includes('.')) {
        // Support nested fields like "department.name"
        const parts = hrField.split('.');
        let value = rawData;
        for (const part of parts) {
          value = value?.[part];
        }
        if (value !== undefined) {
          result[shepherdField] = value;
        }
      }
    }

    // Normalize status
    if (result.status) {
      result.status = this.normalizeStatus(result.status);
    }

    return result;
  }

  /**
   * Normalize employment status to ShepHerd values
   * @param {string} status - The status from the HR system
   * @returns {string} One of: 'pending', 'active', 'on_leave', 'terminated'
   */
  normalizeStatus(status) {
    if (!status) return 'active';

    const normalized = status.toLowerCase();

    // Active statuses
    if (['active', 'employed', 'full-time', 'part-time', 'contractor'].includes(normalized)) {
      return 'active';
    }

    // Pending statuses
    if (['pending', 'onboarding', 'hired', 'not_started'].includes(normalized)) {
      return 'pending';
    }

    // On leave statuses
    if (['leave', 'on_leave', 'parental_leave', 'medical_leave', 'sabbatical', 'suspended'].includes(normalized)) {
      return 'on_leave';
    }

    // Terminated statuses
    if (['terminated', 'resigned', 'retired', 'inactive', 'deleted', 'former'].includes(normalized)) {
      return 'terminated';
    }

    // Default to active
    return 'active';
  }

  /**
   * Make an authenticated HTTP request to the HR API
   * @param {string} method - HTTP method
   * @param {string} url - Full URL to request
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(method, url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HR API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Get authentication headers for API requests
   * Override in subclass for specific auth methods
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    return {};
  }
}

module.exports = BaseHRAdapter;
