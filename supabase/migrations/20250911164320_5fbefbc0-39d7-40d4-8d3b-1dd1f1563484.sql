-- Update the score constraint to allow values from 1 to 12
ALTER TABLE public.cv_evaluations 
DROP CONSTRAINT IF EXISTS cv_evaluations_score_check;

ALTER TABLE public.cv_evaluations 
ADD CONSTRAINT cv_evaluations_score_check 
CHECK (score >= 1 AND score <= 12);