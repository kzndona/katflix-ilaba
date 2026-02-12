-- Add FCM device token column to existing staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS fcm_device_token TEXT;