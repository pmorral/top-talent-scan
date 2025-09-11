-- Add highlights and alerts columns to cv_evaluations table
ALTER TABLE public.cv_evaluations 
ADD COLUMN highlights TEXT[],
ADD COLUMN alerts TEXT[];