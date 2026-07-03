-- Banners bucket oluştur (zaten varsa atla)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: bucket'a tam erişim (güvenlik API route'da sağlanıyor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'banners_allow_all'
  ) THEN
    CREATE POLICY "banners_allow_all" ON storage.objects
    FOR ALL USING (bucket_id = 'banners')
    WITH CHECK (bucket_id = 'banners');
  END IF;
END $$;
