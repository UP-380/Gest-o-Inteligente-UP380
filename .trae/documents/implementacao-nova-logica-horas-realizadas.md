# Implementação da Nova Lógica de Horas Realizadas

## 1. Objetivo da Mudança

A principal alteração consiste em **substituir o cálculo de tempo realizado** das tarefas, que anteriormente utilizava diretamente o campo `tempo_realizado` da tabela `tarefa`, por uma nova abordagem que:

* **Soma todos os registros de tempo** relacionados a cada tarefa

* **Converte milissegundos para horas decimais** com 2 casas decimais

* **Permite visualização detalhada** dos registros individuais por tarefa

* **Mantém o padrão decimal** já estabelecido no sistema

## 2. Endpoints Modificados e Novos

### 2.1 Endpoints Modificados

#### `/api/tarefas-detalhes/:clienteId`

**Mudanças implementadas:**

* Agora calcula o tempo realizado somando todos os registros da tabela `registro_tempo`

* Para cada tarefa, busca todos os registros com `tarefa_id` igual ao ID da tarefa

* Soma os valores de `tempo_realizado` (em milissegundos) de todos os registros

* Converte o total para horas decimais com 2 casas decimais

* Retorna o campo `tempo_realizado` já no formato decimal

**Exemplo de cálculo:**

```javascript
// Para cada tarefa
const registros = await supabase
  .from('registro_tempo')
  .select('tempo_realizado')
  .eq('tarefa_id', tarefa.id);

const totalMs = registros.reduce((sum, reg) => sum + (reg.tempo_realizado || 0), 0);
const tempoRealizadoDecimal = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));
```

### 2.2 Endpoints Novos

#### `/api/tarefa-registros-tempo/:tarefaId`

**Funcionalidade:** Retorna todos os registros de tempo de uma tarefa específica

**Parâmetros:**

* `tarefaId` (path parameter): ID da tarefa

**Retorno:**

```json
{
  "success": true,
  "registros": [
    {
      "id": "uuid-do-registro",
      "usuario_id": "id-do-usuario",
      "tempo_realizado": 3600000,
      "data_inicio": "2024-01-15T09:00:00Z",
      "data_fim": "2024-01-15T10:00:00Z",
      "tarefa_id": "id-da-tarefa"
    }
  ]
}
```

**Ordenação:** Por `data_inicio` descendente (mais recentes primeiro)

## 3. Formato de Exibição

### 3.1 Tempo Realizado nas Tarefas

* **Formato:** Decimal com 2 casas decimais

* **Exemplos:** `1.50h`, `0.75h`, `2.25h`

* **Padrão:** Sempre exibe 2 casas decimais, mesmo quando terminam em 0

### 3.2 Registros Individuais (Expandir)

Quando o usuário clica no botão "expandir" de uma tarefa:

* Lista todos os registros de tempo daquela tarefa

* Mostra duração de cada registro em formato decimal

* Exibe data/hora de início para referência

## 4. Implementação Frontend

### 4.1 Botão Expandir

Adicionado botão de expandir em cada tarefa que:

* Alterna entre mostrar/ocultar registros de tempo

* Busca registros via AJAX ao clicar

* Formata durações em decimal com 2 casas

### 4.2 Estrutura HTML

```html
<div class="colaborador-tarefa-item">
  <!-- Cabeçalho da tarefa -->
  <div class="colaborador-tarefa-header">
    <!-- ... -->
    <button class="expand-registros-btn" data-tarefa-id="${tarefa.id}">
      <i class="fas fa-chevron-down"></i>
    </button>
  </div>
  
  <!-- Detalhes com tempo realizado decimal -->
  <div class="colaborador-tarefa-details">
    <span>Estimado: ${tarefa.tempo_estimado.toFixed(2)}h</span>
    <span>Realizado: ${tarefa.tempo_realizado.toFixed(2)}h</span>
  </div>
  
  <!-- Registros de tempo (inicialmente oculto) -->
  <div class="registros-tempo-container" id="registros-${tarefa.id}" style="display: none;">
    <!-- Registros carregados via AJAX -->
  </div>
</div>
```

## 5. Testes Recomendados

### 5.1 Validação do Cálculo

1. **Criar múltiplos registros de tempo** para uma mesma tarefa
2. **Verificar soma correta** dos milissegundos
3. **Confirmar conversão decimal** com 2 casas
4. **Testar com valores zero** e registros vazios

### 5.2 Testes de Filtro

1. **Aplicar filtros por período** e verificar se registros respeitam o filtro
2. **Filtrar por colaborador** e confirmar que apenas registros do colaborador aparecem
3. **Testar combinações de filtros** (período + colaborador + status)

### 5.3 Testes de Interface

1. **Botão expandir** deve mostrar/ocultar registros
2. **Carregamento assíncrono** deve funcionar sem travar interface
3. **Formatação decimal** deve ser consistente em todos os lugares
4. **Responsividade** do layout com expansão de registros

### 5.4 Testes de Performance

1. **Tarefas com muitos registros** (50+) devem carregar rapidamente
2. **Múltiplas expansões simultâneas** não devem causar conflitos
3. **Cache de tarefas** deve ser atualizado corretamente

## 6. Exemplos de Cenários

### Cenário 1: Tarefa com 3 Registros

```
Registro 1: 1.5h (5400000ms)
Registro 2: 0.75h (2700000ms)  
Registro 3: 1.25h (4500000ms)
Total: 3.50h
```

### Cenário 2: Tarefa sem Registros

```
Total: 0.00h
```

### Cenário 3: Filtro por Período

```
Apenas registros dentro do período selecionado são considerados
```

## 7. Observações Importantes

* **Campos de milissegundos** na tabela `registro_tempo` devem ser validados (não null)

* **Conversão de timezone** não é aplicada (usa UTC do banco)

* **Arredondamento** sempre para 2 casas decimais (não trunca)

* **Performance** otimizada com índices na coluna `tarefa_id`

## 8. Próximos Passos

1. Monitorar performance em produção
2. Validar com usuários se o formato decimal atende necessidades
3. Considerar cache para registros de tempo frequentemente acessados
4. Avaliar necessidade de exportação dos registros detalhados

