# Análise da Tabela cp_vinculacao

## Situação Atual

A tabela `cp_vinculacao` armazena apenas flags booleanos:
- `cp_atividade` (boolean)
- `cp_produto` (boolean)
- `cp_atividade_tipo` (boolean)

## Problemas Identificados

1. **Redundância**: A informação real está na tabela `vinculados` que armazena os IDs específicos
2. **Sem IDs específicos**: A tabela não armazena quais produtos, tarefas ou tipos foram vinculados, apenas indica que "existe algum" vinculado
3. **Uso limitado**: Não há evidência de uso desses flags no sistema
4. **Manutenção desnecessária**: Duas tabelas para manter sincronizadas

## Recomendação

### Opção 1: Manter (Recomendado por enquanto)
- **Vantagem**: Não quebra código existente
- **Desvantagem**: Mantém redundância
- **Ação**: Adicionar comentários no código indicando que pode ser removida no futuro

### Opção 2: Remover
- **Vantagem**: Simplifica estrutura, remove redundância
- **Desvantagem**: Requer refatoração do código que usa essa tabela
- **Ação**: 
  1. Verificar se há código que depende dessa tabela
  2. Remover chamadas à API `/api/vinculacoes`
  3. Remover a tabela do banco
  4. Atualizar frontend para não salvar nessa tabela

## Decisão

**Manter por enquanto** com comentários indicando que pode ser removida no futuro.

A tabela `vinculados` é suficiente para todas as necessidades do sistema. A tabela `cp_vinculacao` pode ser removida em uma futura refatoração se não houver dependências.

