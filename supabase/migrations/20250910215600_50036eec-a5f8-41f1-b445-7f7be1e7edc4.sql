-- Update the superadmin function to include alexa.villegas@lapieza.io
CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email IN ('pol@lapieza.io', 'alexa.villegas@lapieza.io')
  );
END;
$function$;