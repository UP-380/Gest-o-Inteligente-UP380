# Validação da Tabela tempo_estimado

Este documento descreve o script de validação criado para verificar os dados da tabela `tempo_estimado` no Supabase e comparar com o que é retornado pela API.

## Script de Validação

O script `validar-tempo-estimado.js` foi criado para validar os dados da tabela `tempo_estimado` e identificar problemas comuns.

### Como Usar

```bash
cd backEnd
node validar-tempo-estimado.js [data_inicio] [data_fim] [cliente_id] [responsavel_id] [tarefa_id] [produto_id]
```

### Exemplos

```bash
# Validar todos os registros
node validar-tempo-estimado.js

# Validar registros de um período específico
node validar-tempo-estimado.js 2026-02-01 2026-02-28

# Validar registros de um período e cliente específico
node validar-tempo-estimado.js 2026-02-01 2026-02-28 "cliente-uuid-123"

# Validar registros de um período, cliente e responsável específicos
node validar-tempo-estimado.js 2026-02-01 2026-02-28 "cliente-uuid-123" "123"
```

### O que o Script Valida

1. **Total de registros encontrados** - Conta quantos registros atendem aos filtros aplicados
2. **Agrupamento por agrupador_id** - Agrupa registros por `agrupador_id` e calcula períodos
3. **Estatísticas dos agrupadores** - Mostra detalhes dos primeiros 10 agrupadores
4. **Problemas comuns**:
   - Registros sem `agrupador_id`
   - Registros com `tempo_estimado_dia` inválido (null, 0 ou negativo)
   - Registros sem data
   - Registros duplicados (mesmo agrupador_id, mesma data, mesma tarefa)

### Saída do Script

O script exibe:
- Filtros aplicados
- Total de registros encontrados
- Total de agrupadores únicos
- Detalhes dos primeiros 10 agrupadores (cliente, responsável, produto, tarefa, período, tempo estimado)
- Lista de problemas encontrados (se houver)

## Correções Implementadas

### 1. Correção no Controller de Tempo Estimado

**Problema**: O código estava tentando acessar `grupo.registros` mas o objeto grupo não tinha essa propriedade, causando erro ao verificar dias úteis.

**Solução**: Adicionada a propriedade `registros: []` ao objeto grupo durante o agrupamento, permitindo que o código verifique corretamente se há dias úteis no grupo.

**Arquivo**: `backEnd/src/controllers/tempo-estimado.controller.js`

**Linha**: ~930

```javascript
// ANTES
grupos.set(agrupadorId, {
  agrupador_id: agrupadorId,
  dataMinima: null,
  dataMaxima: null
});

// DEPOIS
grupos.set(agrupadorId, {
  agrupador_id: agrupadorId,
  dataMinima: null,
  dataMaxima: null,
  registros: [] // Adicionado para poder verificar dias úteis
});
```

### 2. Script de Validação

Criado script completo de validação que:
- Conecta ao Supabase
- Aplica os mesmos filtros que a API
- Agrupa registros por `agrupador_id`
- Verifica sobreposição de períodos
- Identifica problemas comuns nos dados

## Próximos Passos

1. **Executar o script de validação** com os filtros que estão falhando na tela
2. **Comparar os resultados** do script com o que é exibido na tela
3. **Identificar discrepâncias** e ajustar conforme necessário
4. **Verificar o componente DetailSideCard** para garantir que está exibindo os dados corretos

## Troubleshooting

### O script não encontra registros

- Verifique se as datas estão no formato correto (YYYY-MM-DD)
- Verifique se os IDs estão corretos (cliente_id pode ser UUID, responsavel_id é número)
- Verifique se há registros na tabela `tempo_estimado` no Supabase

### O script encontra registros mas a tela não mostra

- Verifique os logs do backend ao aplicar os filtros
- Verifique se o período está sendo aplicado corretamente
- Verifique se há problemas de timezone nas datas

### O script encontra problemas

- Registros sem `agrupador_id`: Verifique se foram criados corretamente
- Registros com `tempo_estimado_dia` inválido: Verifique se o valor está em milissegundos
- Registros duplicados: Verifique se há lógica de deduplicação no backend

