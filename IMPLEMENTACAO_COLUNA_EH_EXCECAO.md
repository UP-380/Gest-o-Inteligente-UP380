# Implementação da Coluna `eh_excecao` na Tabela `vinculados`

## 📋 Resumo

Foi adicionada uma coluna `eh_excecao` (BOOLEAN) na tabela `vinculados` para tornar explícito se um vínculo é uma "exceção" (específico para um cliente) ou "padrão" (herdado do produto).

## 🎯 Problema Anterior

Anteriormente, o sistema determinava se uma tarefa era "padrão" ou "exceção" através de lógica complexa:
- **Padrão**: Tarefa vinculada ao produto (`Produto → Tarefa`), sem cliente específico
- **Exceção**: Tarefa vinculada especificamente ao cliente (`Cliente → Produto → Tarefa`)

Isso exigia queries complexas e cálculos em tempo de execução, tornando o código mais difícil de manter e menos eficiente.

## ✅ Solução Implementada

### 1. Coluna `eh_excecao` no Banco de Dados

A coluna `eh_excecao` é um BOOLEAN que indica:
- **`true`**: Exceção - Vínculo específico para um cliente (`Cliente → Produto → Tarefa`)
- **`false`**: Padrão - Vínculo padrão do produto (`Produto → Tarefa`, sem cliente)
- **`NULL`**: Não se aplica - Outros tipos de vínculos (Seção 1, Seção 2, etc.)

### 2. Script SQL de Migração

O script `adicionar_eh_excecao.sql`:
1. Adiciona a coluna `eh_excecao` na tabela `vinculados`
2. Popula os dados existentes baseado na lógica atual
3. Cria um índice para melhorar performance
4. Inclui comentários explicativos

### 3. Atualização do Código

O código foi atualizado para:
- **Definir automaticamente** `eh_excecao` ao criar novos vínculos
- **Usar a coluna do banco** ao invés de calcular via lógica
- **Manter compatibilidade** com o código existente

## 📝 Como Executar

### Passo 1: Executar o Script SQL

Execute o script SQL no banco de dados:

```sql
-- Executar o arquivo:
-- Gest-o-Inteligente-UP380/backEnd/sql/adicionar_eh_excecao.sql
```

### Passo 2: Verificar os Dados

Após executar o script, verifique se os dados foram populados corretamente:

```sql
SELECT 
  eh_excecao,
  COUNT(*) as total,
  tipo_relacionamento
FROM up_gestaointeligente.vinculados
WHERE eh_excecao IS NOT NULL
GROUP BY eh_excecao, tipo_relacionamento
ORDER BY eh_excecao, tipo_relacionamento;
```

### Passo 3: Reiniciar o Backend

Reinicie o servidor backend para que as mudanças no código sejam aplicadas.

## 🔄 Comportamento Automático

A partir de agora, ao criar vínculos:

1. **`Cliente → Produto → Tarefa`**: `eh_excecao = true` (exceção)
2. **`Produto → Tarefa`**: `eh_excecao = false` (padrão)
3. **Outros vínculos**: `eh_excecao = NULL` (não se aplica)

## 📊 Benefícios

1. **Clareza**: O status de exceção/padrão está explícito no banco
2. **Performance**: Não precisa calcular via queries complexas
3. **Manutenibilidade**: Código mais simples e fácil de entender
4. **Consistência**: Dados sempre corretos, mesmo após migrações

## ⚠️ Notas Importantes

- A coluna `eh_excecao` é definida automaticamente pelo código ao criar vínculos
- Não é necessário definir manualmente ao inserir dados
- O script SQL popula os dados existentes baseado na lógica atual
- Novos vínculos terão `eh_excecao` definido automaticamente

