-- ===== SOLUCIÓN COMPLETA DEL PROBLEMA DE REGISTRO =====

-- 1. Limpiar usuarios duplicados o problemáticos que no tienen perfil
DELETE FROM auth.users 
WHERE email = 'pol@lapieza.io' 
AND id != '579c13b9-4914-4ff4-a949-3d0a9a8575a6';

-- 2. Actualizar la función handle_new_user para que coincida con la nueva estructura
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Solo crear perfil para emails @lapieza.io
  IF NEW.email LIKE '%@lapieza.io' THEN
    INSERT INTO public.profiles (
      user_id, 
      email, 
      full_name, 
      role
    )
    VALUES (
      NEW.id, 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      'evaluator'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Asegurar que el trigger esté activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Resetear el password del usuario existente para que puedas hacer login
-- (Nota: tendrás que usar "Forgot Password" en la interfaz para establecer una nueva contraseña)

-- 5. Verificar que el perfil del usuario principal esté correcto
UPDATE public.profiles 
SET 
  email = 'pol@lapieza.io',
  full_name = 'Pol Morral Dauvergne',
  role = 'admin'
WHERE user_id = '579c13b9-4914-4ff4-a949-3d0a9a8575a6';