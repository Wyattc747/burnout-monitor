/**
 * ADP Adapter
 *
 * ADP uses OAuth 2.0 with certificate-based authentication.
 * API Docs: https://developers.adp.com/
 */

const BaseHRAdapter = require('./baseAdapter');

class ADPAdapter extends BaseHRAdapter {
  constructor(integration) {
    super(integration);
    this.environment = this.providerSettings.environment || 'production'; // 'production' or 'sandbox'
    this.baseUrl =
      this.environment === 'sandbox'
        ? 'https://api.adp.com'
        : 'https://api.adp.com';

    // OAuth tokens
    this.accessToken = this.credentials.accessToken;
    this.tokenExpiresAt = this.credentials.tokenExpiresAt;
  }

  static get providerName() {
    return 'adp';
  }

  static getRequiredFields() {
    return [
      {
        name: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        description: 'OAuth Client ID from ADP Marketplace',
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        description: 'OAuth Client Secret',
      },
      {
        name: 'certificate',
        label: 'SSL Certificate',
        type: 'textarea',
        required: true,
        description: 'PEM-encoded SSL certificate for API authentication',
      },
      {
        name: 'privateKey',
        label: 'Private Key',
        type: 'textarea',
        required: true,
        description: 'PEM-encoded private key for SSL certificate',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'select',
        required: true,
        options: ['production', 'sandbox'],
        description: 'ADP environment to connect to',
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

    if (!credentials.certificate) {
      errors.push('SSL Certificate is required');
    }

    if (!credentials.privateKey) {
      errors.push('Private Key is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getDefaultFieldMappings() {
    return {
      externalId: 'associateOID',
      firstName: 'person.legalName.givenName',
      lastName: 'person.legalName.familyName1',
      email: 'businessCommunication.emails[0].emailUri',
      department: 'workAssignments[0].homeOrganizationalUnits[0].nameCode.codeValue',
      jobTitle: 'workAssignments[0].jobCode.shortName',
      hireDate: 'workAssignments[0].hireDate',
      managerId: 'workAssignments[0].reportsTo[0].associateOID',
      status: 'workerStatus.statusCode.codeValue',
      phone: 'businessCommunication.landlines[0].formattedNumber',
    };
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
    };
  }

  async getAccessToken() {
    // ADP uses client credentials flow with certificate auth
    const response = await fetch(`${this.baseUrl}/auth/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
      }),
      // In production, you'd configure the certificate/key here
      // This requires an HTTPS agent with the certificate
    });

    if (!response.ok) {
      throw new Error(`ADP token request failed: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshTokensIfNeeded() {
    if (!this.tokenExpiresAt || new Date(this.tokenExpiresAt) > new Date()) {
      return null;
    }

    return this.getAccessToken();
  }

  async testConnection() {
    try {
      await this.refreshTokensIfNeeded();

      // Test by fetching worker count
      const url = `${this.baseUrl}/hr/v2/workers?$top=1`;
      await this.makeRequest('GET', url);

      return {
        success: true,
        message: 'Successfully connected to ADP',
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
      let skip = 0;
      const top = 100;

      // Paginate through all workers
      while (true) {
        const url = `${this.baseUrl}/hr/v2/workers?$top=${top}&$skip=${skip}`;
        const response = await this.makeRequest('GET', url);

        const workers = response.workers || [];
        if (workers.length === 0) break;

        workers.forEach(worker => {
          const transformed = this.transformADPWorker(worker);
          employees.push(transformed);
        });

        skip += workers.length;
        if (workers.length < top) break;
      }

      return employees;
    } catch (error) {
      console.error('ADP fetchEmployees error:', error);
      throw error;
    }
  }

  transformADPWorker(worker) {
    const person = worker.person || {};
    const legalName = person.legalName || {};
    const workAssignment = (worker.workAssignments || [])[0] || {};
    const businessComm = worker.businessCommunication || {};

    // Get email
    let email = '';
    if (businessComm.emails && businessComm.emails.length > 0) {
      email = businessComm.emails[0].emailUri || '';
    }

    // Get phone
    let phone = '';
    if (businessComm.landlines && businessComm.landlines.length > 0) {
      phone = businessComm.landlines[0].formattedNumber || '';
    }

    // Get department
    let department = '';
    if (workAssignment.homeOrganizationalUnits && workAssignment.homeOrganizationalUnits.length > 0) {
      department = workAssignment.homeOrganizationalUnits[0].nameCode?.codeValue || '';
    }

    // Get manager
    let managerId = null;
    if (workAssignment.reportsTo && workAssignment.reportsTo.length > 0) {
      managerId = workAssignment.reportsTo[0].associateOID || null;
    }

    return {
      id: worker.associateOID,
      firstName: legalName.givenName || '',
      lastName: legalName.familyName1 || '',
      email,
      department,
      jobTitle: workAssignment.jobCode?.shortName || workAssignment.positionTitle || '',
      hireDate: workAssignment.hireDate || null,
      managerId,
      status: worker.workerStatus?.statusCode?.codeValue || 'Active',
      phone,
    };
  }

  async fetchDepartments() {
    try {
      await this.refreshTokensIfNeeded();

      // ADP organizational units
      const url = `${this.baseUrl}/core/v1/organization-departments`;
      const response = await this.makeRequest('GET', url);

      return (response.organizationDepartments || []).map(dept => ({
        id: dept.departmentCode?.codeValue || dept.itemID,
        name: dept.departmentCode?.shortName || dept.departmentCode?.longName || '',
        code: dept.departmentCode?.codeValue || '',
        parentId: dept.parentDepartment?.departmentCode?.codeValue || null,
      }));
    } catch (error) {
      console.error('ADP fetchDepartments error:', error);
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

      const url = `${this.baseUrl}/hr/v2/workers/${externalId}`;
      const response = await this.makeRequest('GET', url);
      return this.transformADPWorker(response.workers?.[0] || response);
    } catch (error) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }
}

module.exports = ADPAdapter;
