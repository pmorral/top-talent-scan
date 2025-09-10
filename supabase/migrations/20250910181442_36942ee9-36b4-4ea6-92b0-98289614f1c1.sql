-- Update RLS policy to allow superadmin to see all evaluations
DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.cv_evaluations;

CREATE POLICY "Users can view their own evaluations or superadmin can view all" 
ON public.cv_evaluations 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.email = 'pol@lapieza.io'
  )
);

-- Also update profiles policy to allow superadmin to see all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile or superadmin can view all" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles AS p 
    WHERE p.user_id = auth.uid() 
    AND p.email = 'pol@lapieza.io'
  )
);