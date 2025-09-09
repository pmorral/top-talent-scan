-- Drop existing tables that aren't needed for CV evaluation platform
DROP TABLE IF EXISTS trending_topics CASCADE;
DROP TABLE IF EXISTS newsletter_confirmations CASCADE;  
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS article_interactions CASCADE;
DROP TABLE IF EXISTS newsletter_analytics CASCADE;
DROP TABLE IF EXISTS newsletter_subscriptions CASCADE;
DROP TABLE IF EXISTS news_recommendations CASCADE;
DROP TABLE IF EXISTS page_views CASCADE;

-- Update profiles table for CV evaluation platform
ALTER TABLE profiles 
DROP COLUMN IF EXISTS display_name,
ALTER COLUMN role SET DEFAULT 'evaluator';

-- Add company domain validation
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create CV evaluations table
CREATE TABLE public.cv_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'error')),
  score INTEGER CHECK (score >= 1 AND score <= 10),
  feedback TEXT,
  criteria JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cv_evaluations
ALTER TABLE public.cv_evaluations ENABLE ROW LEVEL SECURITY;

-- Create policies for cv_evaluations
CREATE POLICY "Users can view their own evaluations" 
ON public.cv_evaluations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evaluations" 
ON public.cv_evaluations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evaluations" 
ON public.cv_evaluations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create storage bucket for CV files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cv-files', 'cv-files', false);

-- Create storage policies for CV uploads
CREATE POLICY "Users can upload their own CVs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own CVs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_cv_evaluations_updated_at
BEFORE UPDATE ON public.cv_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update invitations table to be specific to lapieza.io domain
ALTER TABLE public.invitations 
ADD CONSTRAINT check_lapieza_email 
CHECK (email LIKE '%@lapieza.io');