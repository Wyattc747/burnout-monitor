/**
 * Employee Mapper
 *
 * Maps HR system employee data to ShepHerd employee schema.
 * Handles field transformations, validation, and conflict resolution.
 */

const db = require('../../utils/db');

class EmployeeMapper {
  constructor(organizationId, fieldMappings = {}) {
    this.organizationId = organizationId;
    this.fieldMappings = fieldMappings;
  }

  /**
   * Map a single HR employee to ShepHerd employee format
   * @param {Object} hrEmployee - Transformed employee from HR adapter
   * @param {Object} options - Mapping options
   * @returns {Object} ShepHerd employee data
   */
  mapEmployee(hrEmployee, options = {}) {
    const { existingEmployee = null, departmentMap = {}, employeeIdMap = {} } = options;

    // Start with required fields
    const mapped = {
      hr_external_id: hrEmployee.externalId || hrEmployee.id,
      first_name: this.normalizeString(hrEmployee.firstName),
      last_name: this.normalizeString(hrEmployee.lastName),
      email: this.normalizeEmail(hrEmployee.email),
      organization_id: this.organizationId,
    };

    // Optional fields
    if (hrEmployee.phone) {
      mapped.phone = this.normalizePhone(hrEmployee.phone);
    }

    if (hrEmployee.jobTitle) {
      mapped.job_title = this.normalizeString(hrEmployee.jobTitle);
    }

    if (hrEmployee.department) {
      // Try to map to existing department
      const deptId = departmentMap[hrEmployee.department] || departmentMap[hrEmployee.departmentId];
      if (deptId) {
        mapped.department_id = deptId;
      }
      // Also store the text value for legacy field
      mapped.department = this.normalizeString(hrEmployee.department);
    }

    if (hrEmployee.hireDate) {
      mapped.hire_date = this.normalizeDate(hrEmployee.hireDate);
    }

    if (hrEmployee.managerId) {
      // Try to map manager ID to existing employee
      const managerId = employeeIdMap[hrEmployee.managerId];
      if (managerId) {
        mapped.reports_to_id = managerId;
      }
    }

    // Map status
    mapped.employment_status = this.normalizeStatus(hrEmployee.status);

    // If updating existing employee, preserve certain fields
    if (existingEmployee) {
      // Don't overwrite user_id if already set
      if (existingEmployee.user_id) {
        mapped.user_id = existingEmployee.user_id;
      }

      // Preserve onboarding status
      if (existingEmployee.onboarding_completed) {
        mapped.onboarding_completed = existingEmployee.onboarding_completed;
      }
    }

    return mapped;
  }

  /**
   * Validate mapped employee data
   * @param {Object} employee - Mapped employee data
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateEmployee(employee) {
    const errors = [];

    if (!employee.first_name) {
      errors.push('First name is required');
    }

    if (!employee.last_name) {
      errors.push('Last name is required');
    }

    if (!employee.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(employee.email)) {
      errors.push('Invalid email format');
    }

    if (!employee.hr_external_id) {
      errors.push('External ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Determine what action to take for an employee
   * @param {Object} hrEmployee - Employee from HR system
   * @param {Object|null} existingEmployee - Existing ShepHerd employee (if any)
   * @returns {'create'|'update'|'deactivate'|'skip'}
   */
  determineAction(hrEmployee, existingEmployee) {
    if (!existingEmployee) {
      // New employee
      const status = this.normalizeStatus(hrEmployee.status);
      if (status === 'terminated') {
        return 'skip'; // Don't create already-terminated employees
      }
      return 'create';
    }

    // Existing employee
    const newStatus = this.normalizeStatus(hrEmployee.status);

    if (newStatus === 'terminated' && existingEmployee.employment_status !== 'terminated') {
      return 'deactivate';
    }

    // Check if any fields have changed
    const mapped = this.mapEmployee(hrEmployee);
    const hasChanges = this.hasChanges(existingEmployee, mapped);

    return hasChanges ? 'update' : 'skip';
  }

  /**
   * Check if mapped data has changes compared to existing
   * @param {Object} existing - Existing employee
   * @param {Object} mapped - Newly mapped data
   * @returns {boolean}
   */
  hasChanges(existing, mapped) {
    const fieldsToCompare = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'job_title',
      'department',
      'department_id',
      'employment_status',
    ];

    for (const field of fieldsToCompare) {
      if (mapped[field] !== undefined && mapped[field] !== existing[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build a map of HR external IDs to ShepHerd employee IDs
   * @returns {Promise<Object>}
   */
  async buildEmployeeIdMap() {
    const result = await db.query(
      'SELECT id, hr_external_id FROM employees WHERE organization_id = $1 AND hr_external_id IS NOT NULL',
      [this.organizationId]
    );

    const map = {};
    result.rows.forEach(row => {
      map[row.hr_external_id] = row.id;
    });
    return map;
  }

  /**
   * Build a map of department names to IDs
   * @returns {Promise<Object>}
   */
  async buildDepartmentMap() {
    const result = await db.query(
      'SELECT id, name FROM departments WHERE organization_id = $1',
      [this.organizationId]
    );

    const map = {};
    result.rows.forEach(row => {
      map[row.name] = row.id;
      map[row.id] = row.id; // Also map by ID for direct lookups
    });
    return map;
  }

  /**
   * Get or create a department
   * @param {string} name - Department name
   * @returns {Promise<string>} Department ID
   */
  async getOrCreateDepartment(name) {
    if (!name) return null;

    // Check if exists
    const existing = await db.query(
      'SELECT id FROM departments WHERE organization_id = $1 AND name = $2',
      [this.organizationId, name]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    // Create new department
    const result = await db.query(
      `INSERT INTO departments (organization_id, name, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [this.organizationId, name]
    );

    return result.rows[0].id;
  }

  // Normalization helpers

  normalizeString(value) {
    if (!value) return null;
    return String(value).trim();
  }

  normalizeEmail(value) {
    if (!value) return null;
    return String(value).toLowerCase().trim();
  }

  normalizePhone(value) {
    if (!value) return null;
    // Remove non-numeric characters except +
    return String(value).replace(/[^\d+]/g, '');
  }

  normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  normalizeStatus(status) {
    if (!status) return 'active';

    const normalized = String(status).toLowerCase();

    // Active statuses
    if (['active', 'employed', 'full-time', 'part-time', 'contractor', 'full_time', 'part_time'].includes(normalized)) {
      return 'active';
    }

    // Pending statuses
    if (['pending', 'onboarding', 'hired', 'not_started', 'pre_start'].includes(normalized)) {
      return 'pending';
    }

    // On leave statuses
    if (['leave', 'on_leave', 'parental_leave', 'medical_leave', 'sabbatical', 'suspended'].includes(normalized)) {
      return 'on_leave';
    }

    // Terminated statuses
    if (['terminated', 'resigned', 'retired', 'inactive', 'deleted', 'former', 'offboarded'].includes(normalized)) {
      return 'terminated';
    }

    return 'active';
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = EmployeeMapper;
