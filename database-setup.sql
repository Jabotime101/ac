-- Run this in Supabase SQL Editor to create the transcriptions table
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  filename TEXT,
  transcript TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create an index on user_id for faster queries
CREATE INDEX idx_transcriptions_user_id ON transcriptions(user_id);

-- Create an index on created_at for sorting
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at DESC); 