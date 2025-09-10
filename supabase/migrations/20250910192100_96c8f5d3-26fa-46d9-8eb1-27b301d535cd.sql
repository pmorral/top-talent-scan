-- Check current storage policies for cv-files bucket
-- and ensure superadmins can download files

-- Create policy for superadmins to view all files in cv-files bucket
CREATE POLICY "Superadmins can download all CV files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'cv-files' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = 'pol@lapieza.io'
  )
);