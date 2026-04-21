-- Migration: 0014_add_user_role
-- Add role column to users table for admin distinction
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin'));
