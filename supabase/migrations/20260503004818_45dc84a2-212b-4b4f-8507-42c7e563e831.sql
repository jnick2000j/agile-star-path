-- Create public bucket for LMS cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-covers', 'lms-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "LMS covers are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'lms-covers');

-- Authenticated users in same org context can upload/update/delete
CREATE POLICY "Authenticated can upload LMS covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lms-covers');

CREATE POLICY "Authenticated can update LMS covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lms-covers');

CREATE POLICY "Authenticated can delete LMS covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lms-covers');