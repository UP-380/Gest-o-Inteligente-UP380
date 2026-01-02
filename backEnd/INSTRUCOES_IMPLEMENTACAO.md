# Instruções de Implementação - Sistema de Vinculações

## ✅ Implementações Concluídas

### Frontend
1. ✅ Migração de modal para páginas (`/vinculacoes/nova` e `/vinculacoes/editar/:id`)
2. ✅ Suporte para todos os tipos (Produto, Tarefa, Tipo Tarefa, Cliente)
3. ✅ Remoção de regras restritivas de combinação
4. ✅ Preview visual de combinações antes de salvar
5. ✅ Melhorias de UX e feedback

### Backend
1. ✅ Função de validação de duplicatas implementada
2. ✅ Tratamento de erros melhorado (código 409 para duplicatas)
3. ✅ Script de análise criado (`analisar-vinculacoes.js`)
4. ✅ Queries SQL para índices e constraints criadas

## 📋 Próximos Passos (Executar Manualmente)

### 1. Executar Script de Análise

```bash
cd backEnd
node analisar-vinculacoes.js
```

**Requisitos**: Arquivo `.env` configurado com:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`

### 2. Executar Queries SQL no Supabase

Acesse o Supabase SQL Editor e execute as queries do arquivo:
`backEnd/sql/melhorar_vinculados.sql`

**IMPORTANTE**: 
1. Primeiro verifique se há duplicatas existentes usando a query de verificação no arquivo SQL
2. Se houver duplicatas, remova-as antes de criar o índice único
3. Depois execute as queries de criação de índices

### 3. Testar Funcionalidades

Após executar as queries SQL:
- Testar criação de vinculação com todos os tipos
- Verificar se duplicatas são bloqueadas
- Testar edição de vinculações
- Verificar performance das queries

## 📊 Estrutura de Dados

### Tabela `vinculados`
- Campos: `cp_atividade`, `cp_atividade_tipo`, `cp_produto`, `cp_cliente`
- Todos os campos podem ser NULL
- Índice único criado para prevenir duplicatas

### Tabela `cp_vinculacao`
- Mantida por compatibilidade
- Pode ser removida no futuro (ver `ANALISE_CP_VINCULACAO.md`)

## 🔍 Validação de Duplicatas

A validação funciona em dois níveis:
1. **Backend**: Função `verificarDuplicata()` verifica antes de inserir
2. **Banco de Dados**: Índice único garante integridade mesmo se a validação do backend falhar

## 📝 Notas

- O índice único usa `COALESCE` para tratar NULLs corretamente
- Os índices parciais melhoram performance sem ocupar espaço desnecessário
- A validação no backend retorna erro 409 (Conflict) para duplicatas

