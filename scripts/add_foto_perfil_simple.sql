-- =============================================================
-- Script SQL SIMPLES para adicionar campo foto_perfil na tabela cp_cliente
-- =============================================================
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Adicionar coluna foto_perfil (se já existir, dará erro - ignore se necessário)
ALTER TABLE up_gestaointeligente.cp_cliente
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN up_gestaointeligente.cp_cliente.foto_perfil IS 
'Foto de perfil do cliente. Pode ser um ID de avatar padrão (ex: "image-1", "color-1") ou um ID customizado (ex: "custom-{clienteId}")';

