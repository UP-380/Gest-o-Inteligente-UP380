# Instruções para Executar as Melhorias no Banco de Dados

## ⚠️ IMPORTANTE: Ordem de Execução

Execute os arquivos SQL **NESTA ORDEM** no Supabase SQL Editor:

### 1. Primeiro: Remover Duplicatas

Execute o arquivo: `remover_duplicatas_vinculados.sql`

**Passos:**
1. Execute o **PASSO 1** para verificar quantas duplicatas existem
2. Execute o **PASSO 2** para ver quantos registros serão removidos
3. Execute o **PASSO 3** para ver detalhes dos registros que serão removidos
4. Execute o **PASSO 4** para remover as duplicatas
5. Verifique se `duplicatas_restantes = 0`

### 2. Depois: Criar Índices

Execute o arquivo: `melhorar_vinculados.sql`

**Atenção:** Só execute este arquivo **APÓS** remover todas as duplicatas, caso contrário receberá erro 23505.

## 🔍 Verificação Rápida

Se você recebeu o erro:
```
ERROR: 23505: could not create unique index "idx_vinculados_unique"
DETAIL: Key (...) is duplicated.
```

Isso significa que há duplicatas na tabela. Execute primeiro `remover_duplicatas_vinculados.sql`.

## 📋 Query Rápida para Verificar Duplicatas

Execute esta query para ver quantas duplicatas existem:

```sql
SELECT COUNT(*) as total_duplicatas
FROM (
  SELECT 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL'),
    COUNT(*) as quantidade
  FROM up_gestaointeligente.vinculados
  GROUP BY 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL')
  HAVING COUNT(*) > 1
) duplicatas;
```

Se `total_duplicatas > 0`, execute `remover_duplicatas_vinculados.sql` primeiro.

