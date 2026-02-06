-- =============================================================
-- REMOVER TABELA E OBJETOS DE DOCUMENTOS (BASE DE CONHECIMENTO)
-- =============================================================
-- Schema: up_gestaointeligente
-- Execute no Supabase SQL Editor após aplicar as alterações do backend/frontend
-- =============================================================

-- 1. Remover trigger de updated_at
DROP TRIGGER IF EXISTS trigger_update_cp_documento_updated_at ON up_gestaointeligente.cp_documento;

-- 2. Remover função de validação de documentos obrigatórios
DROP FUNCTION IF EXISTS up_gestaointeligente.validar_documentos_obrigatorios(TEXT);

-- 3. Remover tabela (índices são removidos automaticamente)
DROP TABLE IF EXISTS up_gestaointeligente.cp_documento;

-- 4. Remover tipo enum
DROP TYPE IF EXISTS up_gestaointeligente.tipo_documento_enum;
