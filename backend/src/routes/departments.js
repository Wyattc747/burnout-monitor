const express = require('express');
const db = require('../utils/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireOrganization, logAuditAction } = require('../middleware/tenant');

const router = express.Router();

// All routes require authentication and organization membership
router.use(authenticate);
router.use(requireOrganization);

// GET /api/departments - List all departments with hierarchy
router.get('/', async (req, res) => {
  try {
    const { flat = false, includeInactive = false } = req.query;

    let query = `
      SELECT d.id, d.name, d.code, d.description, d.parent_department_id,
             d.hierarchy_level, d.hierarchy_path, d.manager_employee_id,
             d.is_active, d.sort_order, d.created_at, d.updated_at,
             e.first_name as manager_first_name, e.last_name as manager_last_name,
             (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.manager_employee_id = e.id
      WHERE d.organization_id = $1
    `;

    if (!includeInactive || includeInactive === 'false') {
      query += ' AND d.is_active = true';
    }

    query += ' ORDER BY d.hierarchy_level, d.sort_order, d.name';

    const result = await db.query(query, [req.user.organizationId]);

    const departments = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      parentDepartmentId: row.parent_department_id,
      hierarchyLevel: row.hierarchy_level,
      hierarchyPath: row.hierarchy_path,
      managerEmployeeId: row.manager_employee_id,
      managerName: row.manager_first_name
        ? `${row.manager_first_name} ${row.manager_last_name}`
        : null,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      employeeCount: parseInt(row.employee_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // If not flat, build tree structure
    if (flat !== 'true') {
      const buildTree = (items, parentId = null) => {
        return items
          .filter(item => item.parentDepartmentId === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id),
          }));
      };
      return res.json(buildTree(departments));
    }

    res.json(departments);
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get departments' });
  }
});

// GET /api/departments/tree - Get full org chart tree structure
router.get('/tree', async (req, res) => {
  try {
    // Get all departments
    const deptResult = await db.query(
      `SELECT d.id, d.name, d.code, d.parent_department_id, d.hierarchy_level,
              d.manager_employee_id, d.is_active,
              e.first_name as manager_first_name, e.last_name as manager_last_name,
              e.job_title as manager_title
       FROM departments d
       LEFT JOIN employees e ON d.manager_employee_id = e.id
       WHERE d.organization_id = $1 AND d.is_active = true
       ORDER BY d.hierarchy_level, d.sort_order, d.name`,
      [req.user.organizationId]
    );

    // Get employee counts per department
    const countResult = await db.query(
      `SELECT department_id, COUNT(*) as count
       FROM employees
       WHERE organization_id = $1 AND employment_status = 'active'
       GROUP BY department_id`,
      [req.user.organizationId]
    );

    const employeeCounts = {};
    countResult.rows.forEach(row => {
      employeeCounts[row.department_id] = parseInt(row.count);
    });

    const departments = deptResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      parentDepartmentId: row.parent_department_id,
      hierarchyLevel: row.hierarchy_level,
      manager: row.manager_employee_id
        ? {
            id: row.manager_employee_id,
            name: `${row.manager_first_name} ${row.manager_last_name}`,
            title: row.manager_title,
          }
        : null,
      employeeCount: employeeCounts[row.id] || 0,
    }));

    // Build tree
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parentDepartmentId === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id),
        }));
    };

    res.json(buildTree(departments));
  } catch (err) {
    console.error('Get org tree error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get organization tree' });
  }
});

// GET /api/departments/:id - Get single department
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, e.first_name as manager_first_name, e.last_name as manager_last_name,
              (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
       FROM departments d
       LEFT JOIN employees e ON d.manager_employee_id = e.id
       WHERE d.id = $1 AND d.organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Department not found' });
    }

    const dept = result.rows[0];

    res.json({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      parentDepartmentId: dept.parent_department_id,
      hierarchyLevel: dept.hierarchy_level,
      hierarchyPath: dept.hierarchy_path,
      managerEmployeeId: dept.manager_employee_id,
      managerName: dept.manager_first_name
        ? `${dept.manager_first_name} ${dept.manager_last_name}`
        : null,
      isActive: dept.is_active,
      sortOrder: dept.sort_order,
      employeeCount: parseInt(dept.employee_count),
      createdAt: dept.created_at,
      updatedAt: dept.updated_at,
    });
  } catch (err) {
    console.error('Get department error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get department' });
  }
});

// POST /api/departments - Create new department
router.post('/', requirePermission('departments:create'), async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      parentDepartmentId,
      managerEmployeeId,
      sortOrder = 0,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Validation Error', message: 'Department name is required' });
    }

    // Validate parent department if provided
    if (parentDepartmentId) {
      const parentCheck = await db.query(
        'SELECT id FROM departments WHERE id = $1 AND organization_id = $2',
        [parentDepartmentId, req.user.organizationId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Parent department not found' });
      }
    }

    // Validate manager if provided
    if (managerEmployeeId) {
      const managerCheck = await db.query(
        'SELECT id FROM employees WHERE id = $1 AND organization_id = $2',
        [managerEmployeeId, req.user.organizationId]
      );
      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Manager employee not found' });
      }
    }

    const result = await db.query(
      `INSERT INTO departments (organization_id, name, code, description, parent_department_id, manager_employee_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.organizationId,
        name.trim(),
        code ? code.toUpperCase().trim() : null,
        description || null,
        parentDepartmentId || null,
        managerEmployeeId || null,
        sortOrder,
      ]
    );

    const dept = result.rows[0];

    // Log audit action
    await logAuditAction(req, 'department.created', 'department', dept.id, null, {
      name: dept.name,
      code: dept.code,
      parentDepartmentId,
      managerEmployeeId,
    });

    res.status(201).json({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      parentDepartmentId: dept.parent_department_id,
      hierarchyLevel: dept.hierarchy_level,
      hierarchyPath: dept.hierarchy_path,
      managerEmployeeId: dept.manager_employee_id,
      isActive: dept.is_active,
      sortOrder: dept.sort_order,
      createdAt: dept.created_at,
    });
  } catch (err) {
    if (err.constraint === 'departments_organization_id_name_parent_department_id_key') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A department with this name already exists at this level',
      });
    }
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create department' });
  }
});

// PUT /api/departments/:id - Update department
router.put('/:id', requirePermission('departments:update'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { name, code, description, parentDepartmentId, managerEmployeeId, isActive, sortOrder } = req.body;

    // Get current department
    const currentResult = await client.query(
      'SELECT * FROM departments WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (currentResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Not Found', message: 'Department not found' });
    }

    const currentDept = currentResult.rows[0];

    // Prevent circular hierarchy
    if (parentDepartmentId) {
      // Check if the new parent is a descendant of this department
      const descendantCheck = await client.query(
        `SELECT id FROM departments WHERE hierarchy_path LIKE $1 || '/%'`,
        [currentDept.hierarchy_path]
      );
      const descendantIds = descendantCheck.rows.map(r => r.id);
      if (descendantIds.includes(parentDepartmentId)) {
        client.release();
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Cannot set parent to a descendant department',
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      values.push(code ? code.toUpperCase().trim() : null);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (parentDepartmentId !== undefined) {
      updates.push(`parent_department_id = $${paramIndex++}`);
      values.push(parentDepartmentId);
    }
    if (managerEmployeeId !== undefined) {
      updates.push(`manager_employee_id = $${paramIndex++}`);
      values.push(managerEmployeeId);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    if (sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(sortOrder);
    }

    if (updates.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Validation Error', message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE departments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const dept = result.rows[0];

    // Log audit action
    await logAuditAction(req, 'department.updated', 'department', dept.id, currentDept, req.body);

    client.release();

    res.json({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      parentDepartmentId: dept.parent_department_id,
      hierarchyLevel: dept.hierarchy_level,
      hierarchyPath: dept.hierarchy_path,
      managerEmployeeId: dept.manager_employee_id,
      isActive: dept.is_active,
      sortOrder: dept.sort_order,
      updatedAt: dept.updated_at,
    });
  } catch (err) {
    client.release();
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id - Delete department
router.delete('/:id', requirePermission('departments:delete'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { reassignTo } = req.query; // Optional department to reassign employees to

    // Get current department
    const currentResult = await client.query(
      'SELECT * FROM departments WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (currentResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Not Found', message: 'Department not found' });
    }

    const dept = currentResult.rows[0];

    // Check for child departments
    const childCheck = await client.query(
      'SELECT COUNT(*) FROM departments WHERE parent_department_id = $1',
      [id]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      client.release();
      return res.status(400).json({
        error: 'Cannot Delete',
        message: 'Cannot delete department with child departments. Delete or move child departments first.',
      });
    }

    // Check for employees
    const employeeCheck = await client.query(
      'SELECT COUNT(*) FROM employees WHERE department_id = $1',
      [id]
    );

    const employeeCount = parseInt(employeeCheck.rows[0].count);

    if (employeeCount > 0 && !reassignTo) {
      client.release();
      return res.status(400).json({
        error: 'Cannot Delete',
        message: `Department has ${employeeCount} employees. Provide a reassignTo department ID or move employees first.`,
        employeeCount,
      });
    }

    await client.query('BEGIN');

    // Reassign employees if specified
    if (reassignTo && employeeCount > 0) {
      // Verify reassign department exists
      const reassignCheck = await client.query(
        'SELECT id FROM departments WHERE id = $1 AND organization_id = $2',
        [reassignTo, req.user.organizationId]
      );

      if (reassignCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Validation Error', message: 'Reassign department not found' });
      }

      await client.query(
        'UPDATE employees SET department_id = $1 WHERE department_id = $2',
        [reassignTo, id]
      );
    }

    // Delete department
    await client.query('DELETE FROM departments WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Log audit action
    await logAuditAction(req, 'department.deleted', 'department', id, dept, null);

    client.release();

    res.json({ message: 'Department deleted successfully', reassignedEmployees: employeeCount });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete department' });
  }
});

// GET /api/departments/:id/employees - Get employees in department
router.get('/:id/employees', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeDescendants = false, status = 'active' } = req.query;

    // Verify department exists and belongs to org
    const deptCheck = await db.query(
      'SELECT id, hierarchy_path FROM departments WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Department not found' });
    }

    const dept = deptCheck.rows[0];

    let query = `
      SELECT e.id, e.first_name, e.last_name, e.email, e.job_title,
             e.department_id, e.employment_status, e.hierarchy_level,
             e.reports_to_id, d.name as department_name,
             u.role
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.organization_id = $1
    `;

    const params = [req.user.organizationId];
    let paramIndex = 2;

    if (includeDescendants === 'true') {
      // Get employees in this department and all descendant departments
      query += ` AND (e.department_id = $${paramIndex} OR e.department_id IN (
        SELECT id FROM departments WHERE hierarchy_path LIKE $${paramIndex + 1}
      ))`;
      params.push(id, dept.hierarchy_path + '/%');
      paramIndex += 2;
    } else {
      query += ` AND e.department_id = $${paramIndex}`;
      params.push(id);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND e.employment_status = $${paramIndex}`;
      params.push(status);
    }

    query += ' ORDER BY e.hierarchy_level, e.last_name, e.first_name';

    const result = await db.query(query, params);

    res.json(
      result.rows.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        jobTitle: row.job_title,
        departmentId: row.department_id,
        departmentName: row.department_name,
        employmentStatus: row.employment_status,
        hierarchyLevel: row.hierarchy_level,
        reportsToId: row.reports_to_id,
        role: row.role,
      }))
    );
  } catch (err) {
    console.error('Get department employees error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get department employees' });
  }
});

// PUT /api/departments/:id/manager - Assign department manager
router.put('/:id/manager', requirePermission('departments:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { managerEmployeeId } = req.body;

    // Verify department exists
    const deptResult = await db.query(
      'SELECT * FROM departments WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (deptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Department not found' });
    }

    const currentDept = deptResult.rows[0];

    // Verify manager exists if provided
    if (managerEmployeeId) {
      const managerCheck = await db.query(
        'SELECT id, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2',
        [managerEmployeeId, req.user.organizationId]
      );

      if (managerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Employee not found' });
      }
    }

    const result = await db.query(
      `UPDATE departments SET manager_employee_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [managerEmployeeId || null, id]
    );

    // Log audit action
    await logAuditAction(
      req,
      'department.manager_changed',
      'department',
      id,
      { managerEmployeeId: currentDept.manager_employee_id },
      { managerEmployeeId }
    );

    const dept = result.rows[0];

    // Get manager name if set
    let managerName = null;
    if (dept.manager_employee_id) {
      const managerResult = await db.query(
        'SELECT first_name, last_name FROM employees WHERE id = $1',
        [dept.manager_employee_id]
      );
      if (managerResult.rows.length > 0) {
        managerName = `${managerResult.rows[0].first_name} ${managerResult.rows[0].last_name}`;
      }
    }

    res.json({
      id: dept.id,
      name: dept.name,
      managerEmployeeId: dept.manager_employee_id,
      managerName,
      updatedAt: dept.updated_at,
    });
  } catch (err) {
    console.error('Update department manager error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update department manager' });
  }
});

module.exports = router;
