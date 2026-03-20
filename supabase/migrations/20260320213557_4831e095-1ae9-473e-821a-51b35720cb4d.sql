UPDATE storage.buckets 
SET allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream']
WHERE name = 'memories';