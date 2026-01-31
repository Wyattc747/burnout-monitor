-- Migration: Add profile picture support
-- Adds profile_picture_url column to users table

-- Add profile picture column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);

-- Add comment
COMMENT ON COLUMN users.profile_picture_url IS 'URL or path to user profile picture';
