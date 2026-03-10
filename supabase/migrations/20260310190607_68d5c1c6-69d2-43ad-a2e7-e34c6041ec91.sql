
-- Make the memories bucket private
UPDATE storage.buckets SET public = false WHERE id = 'memories';

-- Drop the existing public SELECT policy on storage.objects
DROP POLICY IF EXISTS "Memory images are publicly accessible" ON storage.objects;

-- Create authenticated-only SELECT policy: users can only read their own folder
CREATE POLICY "Users can view their own memory images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);
