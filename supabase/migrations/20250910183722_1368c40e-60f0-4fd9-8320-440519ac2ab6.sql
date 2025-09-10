-- Add columns for role and company information that users provide during CV upload
ALTER TABLE public.cv_evaluations 
ADD COLUMN IF NOT EXISTS role_info TEXT,
ADD COLUMN IF NOT EXISTS company_info TEXT;