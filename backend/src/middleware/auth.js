const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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

function canAccessEmployee(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const requestedEmployeeId = req.params.id;

  // Managers can access any employee (but not health data - see canAccessHealthData)
  if (req.user.role === 'manager') {
    return next();
  }

  // Employees can only access their own data
  if (req.user.employeeId === requestedEmployeeId) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'You can only access your own data',
  });
}

// Health data is private - only the employee themselves can see it
function canAccessHealthData(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const requestedEmployeeId = req.params.id;

  // Only employees can access their OWN health data - managers cannot see health data
  if (req.user.role === 'employee' && req.user.employeeId === requestedEmployeeId) {
    return next();
  }

  // Managers cannot access health data
  if (req.user.role === 'manager') {
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

function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId || null,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
}

module.exports = {
  authenticate,
  requireRole,
  canAccessEmployee,
  canAccessHealthData,
  generateToken,
  JWT_SECRET,
};
