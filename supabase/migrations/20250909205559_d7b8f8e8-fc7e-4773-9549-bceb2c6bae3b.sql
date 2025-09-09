-- ===== SEGUNDA LIMPIEZA COMPLETA PARA NUEVA PRUEBA =====

-- 1. Eliminar todos los perfiles primero (por las foreign keys)
DELETE FROM public.profiles;

-- 2. Eliminar todos los usuarios de auth.users
DELETE FROM auth.users;

-- 3. Limpiar también cv_evaluations y invitations para empezar totalmente limpio
DELETE FROM public.cv_evaluations;
DELETE FROM public.invitations;

-- 4. Limpiar archivos del storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'cv-files';