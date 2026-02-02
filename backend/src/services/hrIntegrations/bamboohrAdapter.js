/**
 * BambooHR Adapter
 *
 * BambooHR uses API key + subdomain authentication.
 * API Docs: https://documentation.bamboohr.com/reference
 */

const BaseHRAdapter = require('./baseAdapter');

class BambooHRAdapter extends BaseHRAdapter {
  constructor(integration) {
    super(integration);
    this.subdomain = this.providerSettings.subdomain || this.credentials.subdomain;
    this.apiKey = this.credentials.apiKey;
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.subdomain}/v1`;
  }

  static get providerName() {
    return 'bamboohr';
  }

  static getRequiredFields() {
    return [
      {
        name: 'subdomain',
        label: 'Company Subdomain',
        type: 'text',
        required: true,
        description: 'Your BambooHR subdomain (e.g., "acme" from acme.bamboohr.com)',
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        description: 'Generate an API key from Settings > API Keys in BambooHR',
      },
    ];
  }

  static validateCredentials(credentials) {
    const errors = [];

    if (!credentials.subdomain) {
      errors.push('Subdomain is required');
    } else if (!/^[a-z0-9-]+$/i.test(credentials.subdomain)) {
      errors.push('Invalid subdomain format');
    }

    if (!credentials.apiKey) {
      errors.push('API key is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getDefaultFieldMappings() {
    return {
      externalId: 'id',
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'workEmail',
      department: 'department',
      jobTitle: 'jobTitle',
      hireDate: 'hireDate',
      managerId: 'supervisorId',
      status: 'status',
      phone: 'workPhone',
      division: 'division',
      location: 'location',
    };
  }

  getAuthHeaders() {
    // BambooHR uses HTTP Basic Auth with API key as username, any value for password
    const auth = Buffer.from(`${this.apiKey}:x`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    };
  }

  async testConnection() {
    try {
      // Test by fetching company info
      const url = `${this.baseUrl}/employees/directory`;
      await this.makeRequest('GET', url);

      return {
        success: true,
        message: 'Successfully connected to BambooHR',
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
      // Fetch employee directory (basic info)
      const directory = await this.makeRequest('GET', `${this.baseUrl}/employees/directory`);

      // The directory returns employees array
      const employees = directory.employees || [];

      // Optionally fetch additional fields for each employee
      // This is rate-limited, so only do for specific needs
      const detailedEmployees = await Promise.all(
        employees.map(async emp => {
          try {
            // Fetch full employee details
            const fields =
              'firstName,lastName,workEmail,department,jobTitle,hireDate,supervisorId,status,workPhone,division,location,employeeNumber';
            const details = await this.makeRequest(
              'GET',
              `${this.baseUrl}/employees/${emp.id}?fields=${fields}`
            );
            return { ...emp, ...details };
          } catch (err) {
            // If detail fetch fails, use directory data
            console.warn(`Failed to fetch details for employee ${emp.id}:`, err.message);
            return emp;
          }
        })
      );

      return detailedEmployees;
    } catch (error) {
      console.error('BambooHR fetchEmployees error:', error);
      throw error;
    }
  }

  async fetchDepartments() {
    try {
      // BambooHR doesn't have a dedicated departments endpoint
      // We need to extract unique departments from employees
      const employees = await this.fetchEmployees();

      const departmentsMap = new Map();
      employees.forEach(emp => {
        if (emp.department && !departmentsMap.has(emp.department)) {
          departmentsMap.set(emp.department, {
            id: emp.department, // Use name as ID since BambooHR doesn't have dept IDs
            name: emp.department,
            division: emp.division || null,
          });
        }
      });

      return Array.from(departmentsMap.values());
    } catch (error) {
      console.error('BambooHR fetchDepartments error:', error);
      throw error;
    }
  }

  async fetchEmployee(externalId) {
    try {
      const fields =
        'firstName,lastName,workEmail,department,jobTitle,hireDate,supervisorId,status,workPhone,division,location,employeeNumber';
      const employee = await this.makeRequest(
        'GET',
        `${this.baseUrl}/employees/${externalId}?fields=${fields}`
      );
      return employee;
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch time off requests (useful for on_leave status)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  async fetchTimeOff(startDate, endDate) {
    try {
      const url = `${this.baseUrl}/time_off/requests?start=${startDate}&end=${endDate}&status=approved`;
      const response = await this.makeRequest('GET', url);
      return response;
    } catch (error) {
      console.error('BambooHR fetchTimeOff error:', error);
      throw error;
    }
  }
}

module.exports = BambooHRAdapter;
