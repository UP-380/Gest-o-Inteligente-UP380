-- =============================================================
-- Script para criar bucket e políticas do Supabase Storage para Documentos
-- Execute este script no SQL Editor do Supabase Dashboard
-- =============================================================

-- 1. Criar bucket 'cliente-documentos' para documentos de clientes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cliente-documentos',
  'cliente-documentos',
  false, -- Não público - acesso controlado via API
  52428800, -- 50MB em bytes (50 * 1024 * 1024)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif'
  ];

-- =============================================================
-- Políticas RLS (Row Level Security) para documentos
-- =============================================================

-- 2. Política para leitura de documentos (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can read cliente-documentos" ON storage.objects;

CREATE POLICY "Authenticated users can read cliente-documentos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cliente-documentos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 3. Política para upload de documentos (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can upload cliente-documentos" ON storage.objects;

CREATE POLICY "Authenticated users can upload cliente-documentos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cliente-documentos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 4. Política para atualização de documentos (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can update cliente-documentos" ON storage.objects;

CREATE POLICY "Authenticated users can update cliente-documentos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'cliente-documentos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 5. Política para exclusão de documentos (usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can delete cliente-documentos" ON storage.objects;

CREATE POLICY "Authenticated users can delete cliente-documentos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cliente-documentos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- =============================================================
-- Verificação - Listar bucket criado
-- =============================================================

SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'cliente-documentos';

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
  AND policyname LIKE '%cliente-documentos%'
ORDER BY policyname;
