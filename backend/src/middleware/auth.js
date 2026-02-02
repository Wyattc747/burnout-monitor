const jwt = require('jsonwebtoken');
const db = require('../utils/db');

// SECURITY: JWT_SECRET must be set - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

// Valid roles in the system (ordered by privilege level)
const ROLES = ['super_admin', 'admin', 'manager', 'employee'];

// Permission definitions for fine-grained access control
const PERMISSIONS = {
  // Organization management
  'org:read': ['super_admin', 'admin', 'manager', 'employee'],
  'org:update': ['super_admin', 'admin'],
  'org:delete': ['super_admin'],

  // User/Employee management
  'users:read': ['super_admin', 'admin', 'manager'],
  'users:create': ['super_admin', 'admin'],
  'users:update': ['super_admin', 'admin'],
  'users:delete': ['super_admin', 'admin'],
  'users:invite': ['super_admin', 'admin'],
  'users:change_role': ['super_admin', 'admin'],

  // Department management
  'departments:read': ['super_admin', 'admin', 'manager', 'employee'],
  'departments:create': ['super_admin', 'admin'],
  'departments:update': ['super_admin', 'admin'],
  'departments:delete': ['super_admin', 'admin'],

  // HR Integration management
  'integrations:read': ['super_admin', 'admin'],
  'integrations:create': ['super_admin', 'admin'],
  'integrations:update': ['super_admin', 'admin'],
  'integrations:delete': ['super_admin', 'admin'],
  'integrations:sync': ['super_admin', 'admin'],

  // Billing management
  'billing:read': ['super_admin', 'admin'],
  'billing:update': ['super_admin'],

  // Audit logs
  'audit:read': ['super_admin', 'admin'],

  // Team management (for managers)
  'team:read': ['super_admin', 'admin', 'manager'],
  'team:manage': ['super_admin', 'admin', 'manager'],

  // Personal data
  'self:read': ['super_admin', 'admin', 'manager', 'employee'],
  'self:update': ['super_admin', 'admin', 'manager', 'employee'],
};

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      employeeId: decoded.employeeId || null,
      organizationId: decoded.organizationId || null,
      organizationSlug: decoded.organizationSlug || null,
      isDemoAccount: decoded.isDemoAccount || false,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

// Check for organization-specific roles (ensures user is in an organization)
function requireOrgRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!req.user.organizationId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This action requires organization membership',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

// Check for specific permission
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      console.error(`Unknown permission: ${permission}`);
      return res.status(500).json({ error: 'Server Error', message: 'Invalid permission configuration' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You do not have permission to perform this action (requires: ${permission})`,
      });
    }

    next();
  };
}

// Check if user is an admin (super_admin or admin)
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires admin privileges',
    });
  }

  next();
}

// Check if user is super admin only
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires super admin privileges',
    });
  }

  next();
}

async function canAccessEmployee(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const requestedEmployeeId = req.params.id;

  // Employees can only access their own data (fast path - no DB query needed)
  if (req.user.employeeId === requestedEmployeeId) {
    return next();
  }

  // SECURITY: For admins and managers, verify the requested employee
  // belongs to the SAME organization as the requesting user
  if (['super_admin', 'admin', 'manager'].includes(req.user.role)) {
    if (!req.user.organizationId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Organization membership required to access employee data',
      });
    }

    try {
      // Verify the target employee belongs to the same organization
      const result = await db.query(
        'SELECT organization_id FROM employees WHERE id = $1',
        [requestedEmployeeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Employee not found',
        });
      }

      const employeeOrgId = result.rows[0].organization_id;
      if (employeeOrgId !== req.user.organizationId) {
        // SECURITY: Don't reveal that the employee exists in another org
        return res.status(404).json({
          error: 'Not Found',
          message: 'Employee not found',
        });
      }

      return next();
    } catch (err) {
      console.error('Error checking employee organization:', err);
      return res.status(500).json({
        error: 'Server Error',
        message: 'Failed to verify employee access',
      });
    }
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only access your own data',
  });
}

// Health data is private - only the employee themselves can see it
async function canAccessHealthData(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const requestedEmployeeId = req.params.id;

  // Only employees can access their OWN health data - admins and managers cannot see health data
  if (req.user.employeeId === requestedEmployeeId) {
    // SECURITY: Also verify the employee belongs to user's organization
    if (req.user.organizationId) {
      try {
        const result = await db.query(
          'SELECT organization_id FROM employees WHERE id = $1',
          [requestedEmployeeId]
        );
        if (result.rows.length === 0 || result.rows[0].organization_id !== req.user.organizationId) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Employee not found',
          });
        }
      } catch (err) {
        console.error('Error checking employee organization:', err);
        return res.status(500).json({
          error: 'Server Error',
          message: 'Failed to verify employee access',
        });
      }
    }
    return next();
  }

  // Admins and managers cannot access health data
  if (['super_admin', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Health data is private. Only employees can view their own health information.',
    });
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only access your own health data',
  });
}

// Helper to check if user has a specific permission
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(user.role);
}

// Helper to check if user is admin level
function isAdmin(user) {
  return user && ['super_admin', 'admin'].includes(user.role);
}

// Helper to check if user can manage another user based on role hierarchy
function canManageUser(managerRole, targetRole) {
  const managerLevel = ROLES.indexOf(managerRole);
  const targetLevel = ROLES.indexOf(targetRole);

  // Can only manage users of lower privilege (higher index in ROLES array)
  // super_admin can manage everyone, admin can manage manager and employee, etc.
  return managerLevel >= 0 && targetLevel >= 0 && managerLevel < targetLevel;
}

function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId || null,
    organizationId: user.organizationId || null,
    organizationSlug: user.organizationSlug || null,
    isDemoAccount: user.isDemoAccount || false,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
}

module.exports = {
  authenticate,
  requireRole,
  requireOrgRole,
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  canAccessEmployee,
  canAccessHealthData,
  hasPermission,
  isAdmin,
  canManageUser,
  generateToken,
  JWT_SECRET,
  ROLES,
  PERMISSIONS,
};
