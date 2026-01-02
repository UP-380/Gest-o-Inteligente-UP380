# Correção: Herança de Subtarefas na Seção 3

## 🐛 Problema Identificado

Na **Seção 3: Produto → Tarefas**, ao selecionar uma tarefa e salvar, o sistema estava gravando apenas `tarefa_id`, mas **não estava gravando as `subtarefa_id` vinculadas à tarefa selecionada**. A Seção 3 precisa funcionar com a mesma lógica da Seção 2, aplicando herança automática das subtarefas, criando um relacionamento muitos-para-muitos.

## 📋 Requisitos

A Seção 3 deve funcionar da seguinte forma:
1. Quando uma tarefa é selecionada para um produto, o sistema deve **automaticamente buscar todas as subtarefas** dessa tarefa
2. Deve criar **um registro para cada subtarefa** com:
   - `cp_tarefa_tipo`: ID do tipo de tarefa
   - `cp_tarefa`: ID da tarefa
   - `cp_subtarefa`: ID da subtarefa
   - `cp_produto`: ID do produto
   - `cp_cliente`: null
3. Deve manter a consistência: se uma tarefa tem subtarefas, **sempre** deve criar registros para todas as subtarefas

## ✅ Correções Implementadas

### 1. Lógica de Remoção (✅ Corrigido)

**Antes:**
- Removia apenas vinculações que correspondiam exatamente ao filtro
- Não garantia remoção de todas as subtarefas relacionadas

**Depois:**
- Quando uma tarefa é desmarcada, **remove TODAS as vinculações relacionadas**, incluindo:
  - Vinculações da tarefa sem subtarefa
  - Vinculações de todas as subtarefas da tarefa
- Usa `Map` para melhor performance e correspondência correta de tipos de tarefa

```javascript
// Extrair IDs das tarefas removidas (com seus tipos)
const tarefasRemovidasMap = new Map();
tarefasRemovidas.forEach(chave => {
  const [tarefaIdStr, tipoTarefaIdStr] = chave.split('-');
  const tarefaId = parseInt(tarefaIdStr, 10);
  const tipoTarefaId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
  tarefasRemovidasMap.set(tarefaId, tipoTarefaId);
});

// Buscar e remover todas as vinculações relacionadas (incluindo subtarefas)
const vinculadosParaDeletar = resultBuscar.data.filter(v => {
  // ... lógica de filtro que inclui subtarefas
});
```

### 2. Lógica de Atualização (✅ Corrigido)

**Antes:**
- Lógica complexa e confusa com código duplicado
- Não aplicava herança corretamente
- Tentava atualizar vinculações existentes de forma complicada

**Depois:**
- **Lógica simplificada e clara**
- Quando uma tarefa já existe (está selecionada novamente):
  1. Busca todas as subtarefas da tarefa
  2. Identifica quais subtarefas já estão vinculadas
  3. **Cria vinculações apenas para subtarefas que ainda não estão vinculadas**
  4. Remove vinculações sem subtarefa (se a tarefa tem subtarefas, todas devem ter)
  5. Se a tarefa não tem subtarefas, garante que há pelo menos uma vinculação sem subtarefa

```javascript
// Se a tarefa tem subtarefas, aplicar herança (muitos-para-muitos)
if (subtarefasDaTarefa.length > 0) {
  // Identificar subtarefas que ainda não estão vinculadas
  const subtarefasParaCriar = subtarefasDaTarefa.filter(
    stId => !subtarefasJaVinculadas.has(stId)
  );
  
  // Criar vinculações para subtarefas que ainda não estão vinculadas
  if (subtarefasParaCriar.length > 0) {
    const novasVinculacoes = subtarefasParaCriar.map(subtarefaId => ({
      cp_tarefa_tipo: tipoTarefaId,
      cp_tarefa: tarefaId,
      cp_subtarefa: subtarefaId,
      cp_produto: produtoSelecionado,
      cp_cliente: null
    }));
    // ... criar vinculações
  }
  
  // Remover vinculações sem subtarefa (devem ter subtarefa)
  // ...
}
```

### 3. Lógica de Criação (✅ Já estava correta)

A lógica de criação já estava implementada corretamente:

```javascript
// Para cada tarefa nova selecionada
for (const chaveComposta of tarefasNovas) {
  // Buscar subtarefas da tarefa
  let subtarefasDaTarefa = [];
  // ... buscar subtarefas
  
  if (subtarefasDaTarefa.length > 0) {
    // Criar um registro para cada subtarefa
    subtarefasDaTarefa.forEach(subtarefaId => {
      novasCombinacoes.push({
        cp_tarefa_tipo: tipoTarefaId,
        cp_tarefa: tarefaId,
        cp_subtarefa: subtarefaId,
        cp_produto: produtoSelecionado,
        cp_cliente: null
      });
    });
  } else {
    // Se não tem subtarefas, criar um registro sem subtarefa
    novasCombinacoes.push({
      cp_tarefa_tipo: tipoTarefaId,
      cp_tarefa: tarefaId,
      cp_subtarefa: null,
      cp_produto: produtoSelecionado,
      cp_cliente: null
    });
  }
}
```

## 📊 Fluxo Completo

### Cenário 1: Criar Nova Vinculação

```
1. Usuário seleciona produto "X"
2. Usuário seleciona tarefa "Tarefa A" (que tem 3 subtarefas)
3. Usuário clica em "Salvar Seção 3"
   ↓
4. Sistema busca subtarefas da "Tarefa A" → [Sub1, Sub2, Sub3]
   ↓
5. Sistema cria 3 registros:
   - Registro 1: { tarefa_tipo: X, tarefa: A, subtarefa: Sub1, produto: X }
   - Registro 2: { tarefa_tipo: X, tarefa: A, subtarefa: Sub2, produto: X }
   - Registro 3: { tarefa_tipo: X, tarefa: A, subtarefa: Sub3, produto: X }
```

### Cenário 2: Atualizar Vinculação Existente

```
1. Tarefa "Tarefa A" já está vinculada ao produto "X"
2. Inicialmente tinha 2 subtarefas vinculadas (Sub1, Sub2)
3. Usuário abre a tela novamente (tarefa ainda selecionada)
4. Tarefa "Tarefa A" agora tem 3 subtarefas (Sub1, Sub2, Sub3)
5. Usuário clica em "Salvar Seção 3"
   ↓
6. Sistema verifica:
   - Subtarefas já vinculadas: [Sub1, Sub2]
   - Subtarefas disponíveis: [Sub1, Sub2, Sub3]
   - Subtarefas para criar: [Sub3]
   ↓
7. Sistema cria 1 novo registro:
   - Registro: { tarefa_tipo: X, tarefa: A, subtarefa: Sub3, produto: X }
```

### Cenário 3: Remover Vinculação

```
1. Tarefa "Tarefa A" está vinculada ao produto "X"
2. Tem 3 subtarefas vinculadas (Sub1, Sub2, Sub3)
3. Usuário desmarca a tarefa "Tarefa A"
4. Usuário clica em "Salvar Seção 3"
   ↓
5. Sistema busca todas as vinculações relacionadas:
   - { tarefa: A, subtarefa: Sub1, produto: X }
   - { tarefa: A, subtarefa: Sub2, produto: X }
   - { tarefa: A, subtarefa: Sub3, produto: X }
   ↓
6. Sistema remove TODAS as 3 vinculações
```

## 🔍 Relacionamento Muitos-para-Muitos

A Seção 3 agora implementa corretamente um relacionamento muitos-para-muitos:

- **1 Produto** pode ter **Múltiplas Tarefas**
- **1 Tarefa** pode ter **Múltiplas Subtarefas**
- **Resultado**: 1 Produto → Múltiplas Tarefas → Múltiplas Subtarefas

Cada combinação é armazenada como um registro separado na tabela `vinculados`:
```
Produto X + Tarefa A + Subtarefa 1 → Registro 1
Produto X + Tarefa A + Subtarefa 2 → Registro 2
Produto X + Tarefa A + Subtarefa 3 → Registro 3
Produto X + Tarefa B + Subtarefa 1 → Registro 4
...
```

## ✅ Resultado

Agora a Seção 3:
- ✅ Aplica herança automática de subtarefas ao criar novas vinculações
- ✅ Mantém consistência ao atualizar vinculações existentes (garante que todas as subtarefas estão vinculadas)
- ✅ Remove completamente todas as vinculações relacionadas (incluindo subtarefas) ao desmarcar uma tarefa
- ✅ Funciona como muitos-para-muitos: Produto → Tarefas → Subtarefas
- ✅ Mantém a mesma lógica da Seção 2, mas aplicada ao nível de Produto

## 🔗 Arquivos Modificados

- `Gest-o-Inteligente-UP380/frontEnd/src/components/vinculacoes/VinculacaoForm.jsx`
  - Função `handleSaveSecao3`:
    - Lógica de remoção (linhas ~1164-1205)
    - Lógica de atualização (linhas ~1207-1305)
    - Lógica de criação (já estava correta, linhas ~1432-1502)

