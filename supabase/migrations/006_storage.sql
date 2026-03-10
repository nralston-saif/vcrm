-- ============================================
-- VCRM Storage Buckets
-- ============================================

-- Avatar uploads bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Company logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public read of avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated uploads to logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Allow public read of logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Allow users to update/delete their own uploads
CREATE POLICY "Allow users to manage their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow users to delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
