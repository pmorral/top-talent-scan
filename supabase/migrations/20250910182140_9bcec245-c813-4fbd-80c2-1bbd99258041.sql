-- Create a security definer function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = 'pol@lapieza.io'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Fix the RLS policies to use the security definer function
DROP POLICY IF EXISTS "Users can view their own evaluations or superadmin can view all" ON public.cv_evaluations;
DROP POLICY IF EXISTS "Users can view their own profile or superadmin can view all" ON public.profiles;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view their own evaluations or superadmin can view all" 
ON public.cv_evaluations 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  public.is_superadmin()
);

CREATE POLICY "Users can view their own profile or superadmin can view all" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  public.is_superadmin()
);