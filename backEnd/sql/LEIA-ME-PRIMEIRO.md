# 🚨 CORREÇÃO URGENTE - Índice Único Vinculados

## Problema Identificado

O índice único da tabela `vinculados` **NÃO inclui `subtarefa_id`**, causando erro de duplicata ao tentar vincular múltiplas subtarefas à mesma tarefa.

### Erro que ocorre:
```
duplicate key value violates unique constraint "idx_vinculados_unique"
Key (tarefa_id, tarefa_tipo_id, produto_id, cliente_id)=(86, NULL, NULL, NULL) already exists.
```

## Solução

Execute o arquivo `corrigir_indice_vinculados.sql` no **Supabase SQL Editor**:

1. Acesse: Supabase → SQL Editor
2. Copie e cole o conteúdo de `corrigir_indice_vinculados.sql`
3. Execute (RUN)

## O que o script faz:

1. ✅ Remove o índice antigo (incompleto)
2. ✅ Cria novo índice que **INCLUI subtarefa_id**
3. ✅ Adiciona índice de performance para subtarefas
4. ✅ Adiciona documentação

## Após executar:

- ✅ Será possível vincular múltiplas subtarefas à mesma tarefa
- ✅ Não haverá mais erro de duplicata falso-positivo
- ✅ O sistema continuará prevenindo duplicatas reais

## Verificar se funcionou:

Execute no SQL Editor:
```sql
SELECT 
  indexname, 
  indexdef 
FROM 
  pg_indexes 
WHERE 
  schemaname = 'up_gestaointeligente' 
  AND tablename = 'vinculados'
  AND indexname = 'idx_vinculados_unique';
```

Deve retornar um índice que inclui `subtarefa_id`.

