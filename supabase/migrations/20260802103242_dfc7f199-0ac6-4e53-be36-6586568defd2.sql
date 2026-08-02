CREATE POLICY "own bill files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own bill files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own bill files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]);