/**
 * HR Sync Service
 *
 * Orchestrates the synchronization of employee data from HR systems.
 * Handles create, update, and deactivate operations with conflict resolution.
 */

const db = require('../../utils/db');
const EmployeeMapper = require('./employeeMapper');

class SyncService {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.organizationId = adapter.organizationId;
    this.integrationId = adapter.integration.id;
    this.options = {
      dryRun: false,           // If true, don't make actual changes
      syncDepartments: true,    // Whether to sync departments first
      createMissingDepts: true, // Create departments not found in system
      deactivateMissing: false, // Deactivate employees not in HR system
      ...options,
    };
  }

  /**
   * Run a full sync operation
   * @param {string} syncType - 'manual', 'scheduled', or 'webhook'
   * @param {string} triggeredBy - User ID who triggered (or 'system')
   * @returns {Promise<Object>} Sync results
   */
  async runSync(syncType = 'manual', triggeredBy = null) {
    const startedAt = new Date();
    let logId = null;

    try {
      // Create sync log entry
      const logResult = await db.query(
        `INSERT INTO hr_sync_logs (hr_integration_id, started_at, sync_type, status, triggered_by)
         VALUES ($1, $2, $3, 'running', $4)
         RETURNING id`,
        [this.integrationId, startedAt, syncType, triggeredBy]
      );
      logId = logResult.rows[0].id;

      // Build maps for lookups
      const mapper = new EmployeeMapper(this.organizationId, this.adapter.fieldMappings);
      const employeeIdMap = await mapper.buildEmployeeIdMap();
      let departmentMap = await mapper.buildDepartmentMap();

      // Track stats
      const stats = {
        employeesCreated: 0,
        employeesUpdated: 0,
        employeesDeactivated: 0,
        departmentsSynced: 0,
        errors: [],
      };

      // Step 1: Sync departments if enabled
      if (this.options.syncDepartments) {
        try {
          const deptResult = await this.syncDepartments(departmentMap);
          stats.departmentsSynced = deptResult.synced;
          departmentMap = deptResult.departmentMap;
        } catch (err) {
          stats.errors.push({ type: 'departments', error: err.message });
          console.error('Department sync error:', err);
        }
      }

      // Step 2: Fetch employees from HR system
      const hrEmployees = await this.adapter.fetchEmployees();

      // Step 3: Get all existing employees
      const existingResult = await db.query(
        `SELECT * FROM employees WHERE organization_id = $1`,
        [this.organizationId]
      );
      const existingByHrId = new Map();
      const existingByEmail = new Map();
      existingResult.rows.forEach(emp => {
        if (emp.hr_external_id) {
          existingByHrId.set(emp.hr_external_id, emp);
        }
        existingByEmail.set(emp.email.toLowerCase(), emp);
      });

      // Step 4: Process each HR employee
      const processedHrIds = new Set();

      for (const hrEmp of hrEmployees) {
        try {
          const transformed = this.adapter.transformEmployee(hrEmp);
          processedHrIds.add(transformed.externalId || hrEmp.id);

          // Find existing employee by HR ID or email
          let existing = existingByHrId.get(transformed.externalId || hrEmp.id);
          if (!existing && transformed.email) {
            existing = existingByEmail.get(transformed.email.toLowerCase());
          }

          const action = mapper.determineAction(transformed, existing);

          if (action === 'skip') continue;

          const mapped = mapper.mapEmployee(transformed, {
            existingEmployee: existing,
            departmentMap,
            employeeIdMap,
          });

          const validation = mapper.validateEmployee(mapped);
          if (!validation.valid) {
            stats.errors.push({
              type: 'validation',
              hrId: transformed.externalId,
              email: transformed.email,
              errors: validation.errors,
            });
            continue;
          }

          if (this.options.dryRun) {
            // Just count what would happen
            if (action === 'create') stats.employeesCreated++;
            else if (action === 'update') stats.employeesUpdated++;
            else if (action === 'deactivate') stats.employeesDeactivated++;
            continue;
          }

          // Execute the action
          if (action === 'create') {
            await this.createEmployee(mapped);
            stats.employeesCreated++;
          } else if (action === 'update') {
            await this.updateEmployee(existing.id, mapped);
            stats.employeesUpdated++;
          } else if (action === 'deactivate') {
            await this.deactivateEmployee(existing.id);
            stats.employeesDeactivated++;
          }
        } catch (err) {
          stats.errors.push({
            type: 'employee',
            hrId: hrEmp.id,
            email: hrEmp.email,
            error: err.message,
          });
          console.error(`Error processing employee ${hrEmp.id}:`, err);
        }
      }

      // Step 5: Handle employees not in HR system (optional deactivation)
      if (this.options.deactivateMissing && !this.options.dryRun) {
        for (const [hrId, existing] of existingByHrId) {
          if (!processedHrIds.has(hrId) && existing.employment_status !== 'terminated') {
            try {
              await this.deactivateEmployee(existing.id);
              stats.employeesDeactivated++;
            } catch (err) {
              stats.errors.push({
                type: 'deactivate',
                employeeId: existing.id,
                error: err.message,
              });
            }
          }
        }
      }

      // Step 6: Update manager references (second pass)
      // This handles circular dependencies where manager hasn't been created yet
      if (!this.options.dryRun) {
        await this.updateManagerReferences(hrEmployees, mapper);
      }

      // Step 7: Complete sync log
      const completedAt = new Date();
      const status = stats.errors.length > 0 ? 'partial' : 'completed';

      await db.query(
        `UPDATE hr_sync_logs
         SET completed_at = $1, status = $2,
             employees_created = $3, employees_updated = $4, employees_deactivated = $5,
             departments_synced = $6, errors = $7,
             summary = $8
         WHERE id = $9`,
        [
          completedAt,
          status,
          stats.employeesCreated,
          stats.employeesUpdated,
          stats.employeesDeactivated,
          stats.departmentsSynced,
          JSON.stringify(stats.errors),
          this.generateSummary(stats, startedAt, completedAt),
          logId,
        ]
      );

      // Update integration last sync time
      await db.query(
        `UPDATE hr_integrations SET last_sync_at = $1, consecutive_failures = 0 WHERE id = $2`,
        [completedAt, this.integrationId]
      );

      return {
        success: true,
        logId,
        stats,
        duration: completedAt - startedAt,
      };
    } catch (err) {
      console.error('Sync failed:', err);

      // Update sync log with failure
      if (logId) {
        await db.query(
          `UPDATE hr_sync_logs SET completed_at = NOW(), status = 'failed', errors = $1 WHERE id = $2`,
          [JSON.stringify([{ type: 'fatal', error: err.message }]), logId]
        );
      }

      // Increment failure counter
      await db.query(
        `UPDATE hr_integrations
         SET consecutive_failures = consecutive_failures + 1,
             last_error = $1, last_error_at = NOW()
         WHERE id = $2`,
        [err.message, this.integrationId]
      );

      throw err;
    }
  }

  /**
   * Sync departments from HR system
   */
  async syncDepartments(existingDeptMap) {
    const hrDepartments = await this.adapter.fetchDepartments();
    let synced = 0;
    const newDeptMap = { ...existingDeptMap };

    for (const hrDept of hrDepartments) {
      const name = hrDept.name;
      if (!name) continue;

      if (!newDeptMap[name] && this.options.createMissingDepts) {
        // Create new department
        const result = await db.query(
          `INSERT INTO departments (organization_id, name, code, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (organization_id, name, parent_department_id) DO UPDATE SET is_active = true
           RETURNING id`,
          [this.organizationId, name, hrDept.code || null]
        );
        newDeptMap[name] = result.rows[0].id;
        if (hrDept.id) newDeptMap[hrDept.id] = result.rows[0].id;
        synced++;
      }
    }

    return { synced, departmentMap: newDeptMap };
  }

  /**
   * Create a new employee
   */
  async createEmployee(data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`);

    const result = await db.query(
      `INSERT INTO employees (${fields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      values
    );

    // Create default baselines
    await db.query(
      `INSERT INTO employee_baselines (employee_id, baseline_sleep_hours, baseline_sleep_quality, baseline_hrv, baseline_resting_hr, baseline_hours_worked)
       VALUES ($1, 7, 70, 45, 65, 8)`,
      [result.rows[0].id]
    );

    return result.rows[0].id;
  }

  /**
   * Update an existing employee
   */
  async updateEmployee(employeeId, data) {
    // Don't update certain fields
    delete data.organization_id;
    delete data.user_id;

    const fields = Object.keys(data);
    const values = Object.values(data);

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(employeeId);

    await db.query(
      `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );
  }

  /**
   * Deactivate an employee
   */
  async deactivateEmployee(employeeId) {
    await db.query(
      `UPDATE employees SET employment_status = 'terminated', is_active = false, updated_at = NOW() WHERE id = $1`,
      [employeeId]
    );
  }

  /**
   * Second pass to update manager references after all employees exist
   */
  async updateManagerReferences(hrEmployees, mapper) {
    const employeeIdMap = await mapper.buildEmployeeIdMap();

    for (const hrEmp of hrEmployees) {
      const transformed = this.adapter.transformEmployee(hrEmp);
      if (!transformed.managerId) continue;

      const employeeId = employeeIdMap[transformed.externalId || hrEmp.id];
      const managerId = employeeIdMap[transformed.managerId];

      if (employeeId && managerId && employeeId !== managerId) {
        await db.query(
          `UPDATE employees SET reports_to_id = $1 WHERE id = $2 AND reports_to_id IS DISTINCT FROM $1`,
          [managerId, employeeId]
        );
      }
    }
  }

  /**
   * Generate a human-readable summary
   */
  generateSummary(stats, startedAt, completedAt) {
    const duration = Math.round((completedAt - startedAt) / 1000);
    const parts = [];

    if (stats.employeesCreated > 0) {
      parts.push(`${stats.employeesCreated} created`);
    }
    if (stats.employeesUpdated > 0) {
      parts.push(`${stats.employeesUpdated} updated`);
    }
    if (stats.employeesDeactivated > 0) {
      parts.push(`${stats.employeesDeactivated} deactivated`);
    }
    if (stats.departmentsSynced > 0) {
      parts.push(`${stats.departmentsSynced} departments synced`);
    }
    if (stats.errors.length > 0) {
      parts.push(`${stats.errors.length} errors`);
    }

    return `Completed in ${duration}s: ${parts.join(', ') || 'no changes'}`;
  }

  /**
   * Preview what a sync would do without making changes
   */
  async preview() {
    this.options.dryRun = true;
    const result = await this.runSync('manual', null);
    this.options.dryRun = false;
    return result;
  }
}

module.exports = SyncService;
