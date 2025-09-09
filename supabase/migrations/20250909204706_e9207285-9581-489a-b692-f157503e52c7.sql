-- ===== LIMPIEZA COMPLETA DE USUARIOS PARA PRUEBA DESDE CERO =====

-- 1. Eliminar todos los perfiles primero (por las foreign keys)
DELETE FROM public.profiles;

-- 2. Eliminar todos los usuarios de auth.users
DELETE FROM auth.users;

-- 3. Limpiar también cv_evaluations y invitations para empezar totalmente limpio
DELETE FROM public.cv_evaluations;
DELETE FROM public.invitations;

-- 4. Verificar que las funciones y triggers estén correctos para nuevos registros
-- (Ya están configurados en la migración anterior, solo confirmamos que estén activos)

-- Verificar que el trigger esté activo
SELECT tgname, tgenabled 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid  
WHERE c.relname = 'users' AND tgname = 'on_auth_user_created';