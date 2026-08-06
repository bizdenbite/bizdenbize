-- ═══════════════════════════════════════════════════
-- BizdenBize — İşletme fotoğrafları için Storage bucket
-- Run ONCE in Supabase → SQL Editor. Mirrors the avatars bucket.
-- Public read; authenticated members can upload/replace.
-- ═══════════════════════════════════════════════════

-- Public bucket for business photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-photos', 'business-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view (public directory)
DROP POLICY IF EXISTS "Public read business-photos" ON storage.objects;
CREATE POLICY "Public read business-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'business-photos');

-- Logged-in members can upload
DROP POLICY IF EXISTS "Auth upload business-photos" ON storage.objects;
CREATE POLICY "Auth upload business-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'business-photos');

-- Logged-in members can replace (upsert)
DROP POLICY IF EXISTS "Auth update business-photos" ON storage.objects;
CREATE POLICY "Auth update business-photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'business-photos');

-- Note: this lets any approved member upload a business photo (fine for the
-- invite-only soft launch + admin moderation). We can tighten it to
-- owner-only later once ownership/claim is settled.
