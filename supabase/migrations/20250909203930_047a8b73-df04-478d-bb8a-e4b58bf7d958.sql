-- Create profile for existing user pol@lapieza.io
INSERT INTO public.profiles (user_id, email, name, role)
VALUES (
  '579c13b9-4914-4ff4-a949-3d0a9a8575a6',
  'pol@lapieza.io', 
  'Pol Morral Dauvergne',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role;