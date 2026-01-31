const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use user ID and timestamp for unique filename
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${req.user.userId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// GET /api/profile - Get current user profile
router.get('/', async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, role, profile_picture_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get employee details if applicable
    let employee = null;
    if (req.user.employeeId) {
      const empResult = await db.query(
        'SELECT id, first_name, last_name, email, department, job_title FROM employees WHERE id = $1',
        [req.user.employeeId]
      );
      if (empResult.rows.length > 0) {
        employee = {
          id: empResult.rows[0].id,
          firstName: empResult.rows[0].first_name,
          lastName: empResult.rows[0].last_name,
          email: empResult.rows[0].email,
          department: empResult.rows[0].department,
          jobTitle: empResult.rows[0].job_title,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      profilePictureUrl: user.profile_picture_url,
      employee,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get profile' });
  }
});

// POST /api/profile/avatar - Upload profile picture
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Validation Error', message: 'No file uploaded' });
    }

    // Generate URL for the uploaded file
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Get old avatar to delete
    const oldResult = await db.query(
      'SELECT profile_picture_url FROM users WHERE id = $1',
      [req.user.userId]
    );
    const oldAvatarUrl = oldResult.rows[0]?.profile_picture_url;

    // Update user profile picture URL
    await db.query(
      'UPDATE users SET profile_picture_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, req.user.userId]
    );

    // Delete old avatar file if exists
    if (oldAvatarUrl) {
      const oldFilePath = path.join(__dirname, '../../', oldAvatarUrl);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePictureUrl: avatarUrl,
    });
  } catch (err) {
    console.error('Upload avatar error:', err);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Server Error', message: 'Failed to upload profile picture' });
  }
});

// DELETE /api/profile/avatar - Remove profile picture
router.delete('/avatar', async (req, res) => {
  try {
    // Get current avatar
    const result = await db.query(
      'SELECT profile_picture_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    const avatarUrl = result.rows[0]?.profile_picture_url;

    if (avatarUrl) {
      // Delete file
      const filePath = path.join(__dirname, '../../', avatarUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Clear database field
      await db.query(
        'UPDATE users SET profile_picture_url = NULL, updated_at = NOW() WHERE id = $1',
        [req.user.userId]
      );
    }

    res.json({ message: 'Profile picture removed' });
  } catch (err) {
    console.error('Delete avatar error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to remove profile picture' });
  }
});

module.exports = router;
