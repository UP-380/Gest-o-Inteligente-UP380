-- =============================================================
-- Script para criar buckets e políticas do Supabase Storage
-- Execute este script no SQL Editor do Supabase Dashboard
-- =============================================================

-- 1. Criar bucket 'avatars' para avatares de usuários
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  15728640, -- 15MB em bytes (15 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- 2. Criar bucket 'cliente-avatars' para avatares de clientes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cliente-avatars',
  'cliente-avatars',
  true,
  15728640, -- 15MB em bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- =============================================================
-- Políticas RLS (Row Level Security) para leitura pública
-- =============================================================

-- 3. Política para leitura pública do bucket 'avatars'
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;

CREATE POLICY "Public read access for avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- 4. Política para leitura pública do bucket 'cliente-avatars'
DROP POLICY IF EXISTS "Public read access for cliente-avatars" ON storage.objects;

CREATE POLICY "Public read access for cliente-avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cliente-avatars');

-- =============================================================
-- Políticas para upload (usando service key do backend)
-- Nota: Como estamos usando SUPABASE_SERVICE_KEY no backend,
-- essas políticas são opcionais. O service key tem permissões completas.
-- Mas deixamos aqui para referência e caso queira usar autenticação.
-- =============================================================

-- 5. Política para upload no bucket 'avatars' (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 6. Política para upload no bucket 'cliente-avatars' (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can upload cliente-avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload cliente-avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cliente-avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 7. Política para atualização no bucket 'avatars'
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;

CREATE POLICY "Authenticated users can update avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 8. Política para atualização no bucket 'cliente-avatars'
DROP POLICY IF EXISTS "Authenticated users can update cliente-avatars" ON storage.objects;

CREATE POLICY "Authenticated users can update cliente-avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'cliente-avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 9. Política para exclusão no bucket 'avatars'
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 10. Política para exclusão no bucket 'cliente-avatars'
DROP POLICY IF EXISTS "Authenticated users can delete cliente-avatars" ON storage.objects;

CREATE POLICY "Authenticated users can delete cliente-avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cliente-avatars' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- =============================================================
-- Verificação - Listar buckets criados
-- =============================================================

SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN ('avatars', 'cliente-avatars')
ORDER BY id;

-- =============================================================
-- Verificação - Listar políticas criadas
-- =============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;

