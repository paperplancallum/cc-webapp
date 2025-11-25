-- ============================================
-- Mold Testing Companion App - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- KITS TABLE (Core State Machine)
-- ============================================
CREATE TABLE kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  kit_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  location_name TEXT NOT NULL,

  -- State Machine
  status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK (
    status IN (
      'REGISTERED',
      'EXPOSING',
      'EXPOSURE_COMPLETE',
      'INCUBATING',
      'AWAITING_48HR_PHOTO',
      'AWAITING_72HR_PHOTO',
      'COMPLETED'
    )
  ),

  -- Timer Logic (Timestamp-Based)
  exposure_started_at TIMESTAMPTZ,
  exposure_duration_minutes INTEGER DEFAULT 60,
  exposure_completed_at TIMESTAMPTZ,

  -- Incubation Phase
  lid_sealed_at TIMESTAMPTZ,

  -- Email Reminder Tracking
  reminder_48hr_sent_at TIMESTAMPTZ,
  reminder_72hr_sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE NOT NULL,

  photo_type TEXT NOT NULL CHECK (photo_type IN ('48HR', '72HR')),
  storage_path TEXT NOT NULL,

  -- Photo Metadata
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,

  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one photo per type per kit
  UNIQUE(kit_id, photo_type)
);

-- ============================================
-- MAGIC_TOKENS TABLE (Deep Linking)
-- ============================================
CREATE TABLE magic_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE NOT NULL,

  token TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('UPLOAD_48HR_PHOTO', 'UPLOAD_72HR_PHOTO')
  ),

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_kits_user_id ON kits(user_id);
CREATE INDEX idx_kits_status ON kits(status);
CREATE INDEX idx_kits_lid_sealed_at ON kits(lid_sealed_at)
  WHERE status IN ('INCUBATING', 'AWAITING_48HR_PHOTO');
CREATE INDEX idx_photos_kit_id ON photos(kit_id);
CREATE INDEX idx_magic_tokens_token ON magic_tokens(token)
  WHERE used_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_tokens ENABLE ROW LEVEL SECURITY;

-- Kits: Users can only see their own kits
CREATE POLICY "Users can view their own kits"
  ON kits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own kits"
  ON kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kits"
  ON kits FOR UPDATE
  USING (auth.uid() = user_id);

-- Photos: Users can only access photos for their kits
CREATE POLICY "Users can view photos for their kits"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = photos.kit_id
      AND kits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photos for their kits"
  ON photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = photos.kit_id
      AND kits.user_id = auth.uid()
    )
  );

-- Magic Tokens: Readable by owner
CREATE POLICY "Users can view their own magic tokens"
  ON magic_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kits
      WHERE kits.id = magic_tokens.kit_id
      AND kits.user_id = auth.uid()
    )
  );

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kits_updated_at
  BEFORE UPDATE ON kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET FOR PHOTOS
-- ============================================

-- Note: This needs to be run in Supabase dashboard or via supabase CLI
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('photos', 'photos', false);

-- Storage RLS policies (run these in Supabase dashboard)
-- CREATE POLICY "Users can upload photos for their kits"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'photos' AND
--   auth.uid() IN (
--     SELECT user_id FROM kits
--     WHERE kit_id = (storage.foldername(name))[2]
--   )
-- );

-- CREATE POLICY "Users can view photos for their kits"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'photos' AND
--   auth.uid() IN (
--     SELECT user_id FROM kits
--     WHERE kit_id = (storage.foldername(name))[2]
--   )
-- );
