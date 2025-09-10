-- Remove job description file fields and keep only the text field
ALTER TABLE public.cv_evaluations 
DROP COLUMN IF EXISTS job_description_file_name,
DROP COLUMN IF EXISTS job_description_file_path;