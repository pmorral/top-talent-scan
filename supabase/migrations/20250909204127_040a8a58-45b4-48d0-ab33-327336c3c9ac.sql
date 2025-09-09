-- ===== LIMPIEZA COMPLETA DE SUPABASE PARA CV EVALUATOR =====

-- 1. Limpiar storage buckets innecesarios
DELETE FROM storage.objects WHERE bucket_id IN ('article-images', 'article-media');
DELETE FROM storage.buckets WHERE id IN ('article-images', 'article-media');

-- 2. Limpiar datos existentes en las tablas
DELETE FROM public.cv_evaluations;
DELETE FROM public.invitations;

-- 3. Limpiar usuarios que no son de @lapieza.io
DELETE FROM public.profiles WHERE email NOT LIKE '%@lapieza.io';

-- 4. Recrear tabla profiles solo para CV evaluator con estructura limpia
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'evaluator' CHECK (role IN ('admin', 'evaluator')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_lapieza_email CHECK (email LIKE '%@lapieza.io')
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND email LIKE '%@lapieza.io');

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 5. Recrear tabla cv_evaluations con estructura optimizada
DROP TABLE IF EXISTS public.cv_evaluations CASCADE;

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

-- Habilitar RLS en cv_evaluations
ALTER TABLE public.cv_evaluations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cv_evaluations
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

-- 6. Mantener tabla invitations solo para @lapieza.io
DROP TABLE IF EXISTS public.invitations CASCADE;

CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invited_by UUID NOT NULL,
  email TEXT NOT NULL CHECK (email LIKE '%@lapieza.io'),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, used)
);

-- Habilitar RLS en invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para invitations (solo admins)
CREATE POLICY "Only admins can manage invitations" 
ON public.invitations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 7. Crear triggers para timestamps automáticos
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cv_evaluations_updated_at
BEFORE UPDATE ON public.cv_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Crear perfil para el usuario administrador principal
INSERT INTO public.profiles (user_id, email, full_name, role)
VALUES (
  '579c13b9-4914-4ff4-a949-3d0a9a8575a6',
  'pol@lapieza.io', 
  'Pol Morral Dauvergne',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;