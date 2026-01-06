# Correções na Gestão de Capacidade

Este documento descreve as correções implementadas para resolver os problemas na tela de Gestão de Capacidade.

## Problemas Identificados

1. **Filtros de período não retornavam dados corretos**: Ao aplicar filtros de período (ex: 01/02/2026 - 28/02/2026), os dados não eram retornados corretamente do Supabase.

2. **Erro no backend ao verificar dias úteis**: O código tentava acessar `grupo.registros` mas o objeto grupo não tinha essa propriedade, causando erro ao verificar se há dias úteis no grupo.

3. **Componente DetailSideCard com informações incorretas**: O card de detalhes das tarefas estava exibindo informações incorretas.

## Correções Implementadas

### 1. Correção no Controller de Tempo Estimado

**Arquivo**: `backEnd/src/controllers/tempo-estimado.controller.js`

**Problema**: O código estava tentando acessar `grupo.registros` mas o objeto grupo não tinha essa propriedade, causando erro ao verificar dias úteis.

**Solução**: Adicionada a propriedade `registros: []` ao objeto grupo durante o agrupamento, permitindo que o código verifique corretamente se há dias úteis no grupo.

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

**Arquivo**: `backEnd/validar-tempo-estimado.js`

Criado script completo de validação que:
- Conecta ao Supabase
- Aplica os mesmos filtros que a API
- Agrupa registros por `agrupador_id`
- Verifica sobreposição de períodos
- Identifica problemas comuns nos dados

**Como usar**:
```bash
cd backEnd
node validar-tempo-estimado.js [data_inicio] [data_fim] [cliente_id] [responsavel_id] [tarefa_id] [produto_id]
```

**Exemplo**:
```bash
# Validar registros do período 01/02/2026 até 28/02/2026
node validar-tempo-estimado.js 2026-02-01 2026-02-28
```

### 3. Documentação

**Arquivo**: `backEnd/README_VALIDACAO_TEMPO_ESTIMADO.md`

Criada documentação completa explicando:
- Como usar o script de validação
- O que o script valida
- Como interpretar os resultados
- Troubleshooting de problemas comuns

## Como Testar

### 1. Testar o Script de Validação

Execute o script com os mesmos filtros que estão falhando na tela:

```bash
cd backEnd
node validar-tempo-estimado.js 2026-02-01 2026-02-28
```

Compare os resultados do script com o que é exibido na tela.

### 2. Testar na Tela

1. Acesse a tela de Gestão de Capacidade
2. Selecione um período (ex: 01/02/2026 - 28/02/2026)
3. Selecione um filtro (Cliente, Produto, Tarefa ou Responsável)
4. Clique em "Aplicar Filtros"
5. Verifique se os dados são exibidos corretamente

### 3. Verificar o DetailSideCard

1. Clique em um dos cards de tempo disponível
2. Verifique se o DetailSideCard abre corretamente
3. Verifique se as informações exibidas estão corretas:
   - Tempo estimado
   - Tempo realizado
   - Custo estimado
   - Custo realizado

### 4. Verificar a Barra de Progresso

1. Verifique se a barra de progresso mostra:
   - Tempo estimado (cor laranja)
   - Tempo realizado (cor verde)
   - Tempo contratado
   - Tempo disponível

## Próximos Passos

Se ainda houver problemas:

1. **Execute o script de validação** com os filtros que estão falhando
2. **Compare os resultados** do script com o que é exibido na tela
3. **Verifique os logs do backend** ao aplicar os filtros
4. **Verifique se há problemas de timezone** nas datas

## Troubleshooting

### Os dados ainda não aparecem corretamente

1. Verifique se o período está no formato correto (YYYY-MM-DD)
2. Verifique se há registros na tabela `tempo_estimado` no Supabase para o período selecionado
3. Execute o script de validação para verificar os dados diretamente no banco
4. Verifique os logs do backend no console

### O DetailSideCard mostra informações incorretas

1. Verifique se os dados estão sendo calculados corretamente na função `buscarDetalhesTarefas`
2. Verifique se o tempo realizado está sendo buscado corretamente
3. Verifique se os custos estão sendo calculados corretamente

### A barra de progresso mostra valores incorretos

1. Verifique se o tempo disponível está sendo calculado corretamente
2. Verifique se as horas contratadas estão sendo buscadas corretamente
3. Verifique se o tempo estimado está sendo somado corretamente

## Arquivos Modificados

1. `backEnd/src/controllers/tempo-estimado.controller.js` - Correção na lógica de agrupamento
2. `backEnd/validar-tempo-estimado.js` - Script de validação (novo)
3. `backEnd/README_VALIDACAO_TEMPO_ESTIMADO.md` - Documentação (novo)
4. `CORRECOES_GESTAO_CAPACIDADE.md` - Este arquivo (novo)

