const jwt = require('jsonwebtoken');
const {
  authenticate,
  requireRole,
  canAccessEmployee,
  generateToken,
  JWT_SECRET,
} = require('../src/middleware/auth');

// Mock response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock next function
const mockNext = jest.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should reject requests without Authorization header', () => {
      const req = { headers: {} };
      const res = mockResponse();

      authenticate(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid Bearer format', () => {
      const req = { headers: { authorization: 'InvalidFormat token' } };
      const res = mockResponse();

      authenticate(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = mockResponse();

      authenticate(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid token' })
      );
    });

    it('should accept valid token and set req.user', () => {
      const token = generateToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'employee',
        employeeId: 'emp-456',
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();

      authenticate(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('user-123');
      expect(req.user.email).toBe('test@example.com');
      expect(req.user.role).toBe('employee');
      expect(req.user.employeeId).toBe('emp-456');
    });

    it('should reject expired tokens', () => {
      // Create a token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'employee' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = mockResponse();

      authenticate(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Token expired' })
      );
    });
  });

  describe('requireRole', () => {
    it('should reject if no user is set', () => {
      const middleware = requireRole('manager');
      const req = {};
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject if user does not have required role', () => {
      const middleware = requireRole('manager');
      const req = { user: { role: 'employee' } };
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Forbidden' })
      );
    });

    it('should allow if user has required role', () => {
      const middleware = requireRole('manager');
      const req = { user: { role: 'manager' } };
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow if user has one of multiple allowed roles', () => {
      const middleware = requireRole('manager', 'admin');
      const req = { user: { role: 'admin' } };
      const res = mockResponse();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('canAccessEmployee', () => {
    it('should allow managers to access any employee', () => {
      const req = {
        user: { role: 'manager', employeeId: 'emp-111' },
        params: { id: 'emp-999' },
      };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow employees to access their own data', () => {
      const req = {
        user: { role: 'employee', employeeId: 'emp-123' },
        params: { id: 'emp-123' },
      };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject employees accessing other employee data', () => {
      const req = {
        user: { role: 'employee', employeeId: 'emp-123' },
        params: { id: 'emp-456' },
      };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'You can only access your own data' })
      );
    });

    it('should reject if no user is set', () => {
      const req = { params: { id: 'emp-123' } };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'manager',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token is valid
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('manager');
    });

    it('should include employeeId when provided', () => {
      const token = generateToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'employee',
        employeeId: 'emp-456',
      });

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.employeeId).toBe('emp-456');
    });

    it('should set employeeId to null when not provided', () => {
      const token = generateToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'manager',
      });

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.employeeId).toBeNull();
    });

    it('should set token expiration', () => {
      const token = generateToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'employee',
      });

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});

describe('Role-Based Access Control', () => {
  describe('Manager permissions', () => {
    it('should allow manager to access all employees list', () => {
      const middleware = requireRole('manager');
      const req = { user: { role: 'manager' } };
      const res = mockResponse();

      middleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Employee permissions', () => {
    it('should allow employee to access own data only', () => {
      const req = {
        user: { role: 'employee', employeeId: 'emp-123' },
        params: { id: 'emp-123' },
      };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny employee access to other employees', () => {
      const req = {
        user: { role: 'employee', employeeId: 'emp-123' },
        params: { id: 'emp-456' },
      };
      const res = mockResponse();

      canAccessEmployee(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
