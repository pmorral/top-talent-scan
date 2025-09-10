-- Add job description file fields to cv_evaluations table
ALTER TABLE public.cv_evaluations 
ADD COLUMN job_description_file_name TEXT,
ADD COLUMN job_description_file_path TEXT,
ADD COLUMN job_description_text TEXT;