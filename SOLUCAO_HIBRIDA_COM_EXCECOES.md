# ✅ Solução Híbrida com Suporte a Exceções

## 🎯 Requisitos

**Garantir que é possível:**
1. ✅ Adicionar tarefa diferente para cliente específico (exceção)
2. ✅ Remover tarefa de cliente específico (exceção)
3. ✅ Manter herança como padrão (produto → cliente)

---

## 💡 Estratégia: Herança + Exceções Explícitas

### Princípio

**Regra de Ouro:**
- **Se existe registro `cliente_id + produto_id + tarefa_id`** → É EXCEÇÃO (não herda)
- **Se NÃO existe registro** → HERDA do produto (busca na query)

**Lógica:**
```
1. Buscar tarefas do produto (padrão)
2. Buscar tarefas gravadas do cliente (exceções)
3. Combinar: Herdadas + Exceções
4. Remover tarefas excluídas explicitamente
```

---

## 📊 Estrutura de Dados

### Tabela `vinculados`

```sql
-- Herança padrão (não gravar)
-- Cliente herda tarefas do produto automaticamente

-- Exceções (gravar explicitamente)
cliente_id + produto_id + tarefa_id = EXCEÇÃO
  → Cliente tem esta tarefa (mesmo que produto não tenha)
  → Cliente NÃO herda esta tarefa do produto

-- Exclusões (gravar com flag)
cliente_id + produto_id + tarefa_id + excluida = true
  → Cliente NÃO deve ter esta tarefa (mesmo que produto tenha)
```

---

## 🔧 Implementação

### Opção 1: Flag `eh_excecao` (RECOMENDADO)

```sql
ALTER TABLE vinculados
ADD COLUMN eh_excecao BOOLEAN DEFAULT false;

-- Exceção: Cliente tem tarefa diferente
cliente_id=1, produto_id=2, tarefa_id=99, eh_excecao=true
  → Cliente tem tarefa 99 (produto não tem)

-- Herança normal (não gravar)
-- Buscar tarefas do produto na query
```

**Vantagens:**
- ✅ Flag explícita
- ✅ Fácil identificar exceções
- ✅ Permite queries otimizadas

**Desvantagens:**
- ❌ Requer migration
- ❌ Mais um campo

---

### Opção 2: Detectar por Existência (SEM FLAG)

**Lógica:**
- Se existe `cliente_id + produto_id + tarefa_id` → É exceção
- Se não existe → Herda do produto

**Implementação:**
```javascript
// Buscar tarefas do produto (herança)
const tarefasProduto = await buscarTarefasDoProduto(produtoId);

// Buscar tarefas gravadas do cliente (exceções)
const tarefasCliente = await buscarTarefasDoCliente(clienteId, produtoId);

// Combinar
const todasTarefas = [
  ...tarefasProduto.filter(t => !tarefasCliente.includes(t)), // Herdadas
  ...tarefasCliente // Exceções
];
```

**Vantagens:**
- ✅ Não precisa flag
- ✅ Funciona com estrutura atual
- ✅ Simples de implementar

**Desvantagens:**
- ❌ Difícil distinguir exceção de herança gravada
- ❌ Pode confundir

---

### Opção 3: Tabela de Exclusões (MAIS FLEXÍVEL)

```sql
-- Tabela separada para exceções
cliente_tarefa_excecoes (
  cliente_id,
  produto_id,
  tarefa_id,
  tipo: 'adicionar' | 'remover'
)
```

**Vantagens:**
- ✅ Separação clara
- ✅ Fácil gerenciar
- ✅ Permite histórico

**Desvantagens:**
- ❌ Mais complexo
- ❌ Requer refatoração maior

---

## ✅ Recomendação: Opção 2 (Detectar por Existência)

**Por quê:**
- ✅ Funciona com estrutura atual
- ✅ Não precisa migration
- ✅ Implementação simples
- ✅ Flexível

**Como funciona:**

### 1. Adicionar Tarefa Diferente (Exceção)

```javascript
// Criar registro explícito
POST /api/vinculados
{
  cliente_id: 1,
  produto_id: 2,
  tarefa_id: 99,  // Tarefa diferente do produto
  tipo_relacionamento: 'cliente_produto_tarefa'
}

// Na busca, esta tarefa aparece como exceção
```

### 2. Remover Tarefa do Cliente (Exceção)

```javascript
// Opção A: Deletar registro se existir
DELETE /api/vinculados/{id}
// Remove tarefa específica do cliente

// Opção B: Criar registro de exclusão
POST /api/vinculados
{
  cliente_id: 1,
  produto_id: 2,
  tarefa_id: 10,
  excluida: true  // Flag de exclusão
}
```

### 3. Buscar Tarefas do Cliente

```javascript
async function getTarefasPorCliente(clienteId, produtoId) {
  // 1. Buscar tarefas do produto (herança)
  const tarefasProduto = await buscarTarefasDoProduto(produtoId);
  
  // 2. Buscar tarefas gravadas do cliente (exceções)
  const tarefasCliente = await buscarTarefasGravadasDoCliente(clienteId, produtoId);
  
  // 3. Buscar exclusões (se usar flag)
  const exclusoes = await buscarExclusoes(clienteId, produtoId);
  
  // 4. Combinar
  const todasTarefas = [
    ...tarefasProduto
      .filter(t => !exclusoes.includes(t.id)), // Remover excluídas
    ...tarefasCliente // Adicionar exceções
  ];
  
  return todasTarefas;
}
```

---

## 🔄 Fluxo Completo

### Cenário 1: Cliente Herda Tarefas do Produto

```
Produto "Website" tem:
- Tarefa "Desenvolvimento"
- Tarefa "Design"

Cliente "ABC" → Produto "Website"
→ Herda automaticamente: "Desenvolvimento" e "Design"
→ Não precisa gravar nada
```

### Cenário 2: Cliente Adiciona Tarefa Extra

```
Cliente "ABC" precisa de tarefa extra "Suporte"

Ação:
POST /api/vinculados
{
  cliente_id: "ABC",
  produto_id: 2,
  tarefa_id: 99  // Tarefa "Suporte"
}

Resultado:
- Cliente tem: "Desenvolvimento", "Design" (herdadas) + "Suporte" (exceção)
```

### Cenário 3: Cliente Remove Tarefa

```
Cliente "ABC" não precisa de "Design"

Ação:
DELETE /api/vinculados
// Deletar registro cliente_id + produto_id + tarefa_id="Design"

OU

POST /api/vinculados
{
  cliente_id: "ABC",
  produto_id: 2,
  tarefa_id: 10,  // "Design"
  excluida: true
}

Resultado:
- Cliente tem: "Desenvolvimento" (herdada) + "Suporte" (exceção)
- NÃO tem: "Design" (removida)
```

---

## 📝 Implementação no Código

### Função: `getTarefasPorClienteEProdutos`

```javascript
async function getTarefasPorClienteEProdutos(clienteId, produtoIds) {
  const resultado = [];
  
  for (const produtoId of produtoIds) {
    // 1. Buscar tarefas do produto (herança)
    const tarefasProduto = await buscarTarefasDoProduto(produtoId);
    
    // 2. Buscar tarefas gravadas do cliente para este produto (exceções)
    const { data: excecoes } = await supabase
      .from('vinculados')
      .select('tarefa_id')
      .eq('cliente_id', clienteId)
      .eq('produto_id', produtoId)
      .not('tarefa_id', 'is', null);
    
    const tarefaIdsExcecoes = excecoes.map(e => e.tarefa_id);
    
    // 3. Combinar: Herdadas + Exceções
    const todasTarefas = [
      ...tarefasProduto.filter(t => !tarefaIdsExcecoes.includes(t.id)), // Herdadas (não são exceções)
      ...await buscarTarefasPorIds(tarefaIdsExcecoes) // Exceções
    ];
    
    resultado.push({
      produtoId,
      tarefas: todasTarefas
    });
  }
  
  return resultado;
}
```

---

## ✅ Garantias

### 1. Adicionar Tarefa Diferente ✅

**Como:**
```javascript
// Criar registro explícito
POST /api/vinculados
{
  cliente_id: 1,
  produto_id: 2,
  tarefa_id: 99
}
```

**Resultado:**
- ✅ Tarefa aparece na busca do cliente
- ✅ Mesmo que produto não tenha esta tarefa
- ✅ Funciona como exceção

---

### 2. Remover Tarefa do Cliente ✅

**Opção A: Deletar registro**
```javascript
// Se existe registro cliente + produto + tarefa
DELETE /api/vinculados/{id}
```

**Opção B: Flag de exclusão**
```javascript
// Criar registro com flag
POST /api/vinculados
{
  cliente_id: 1,
  produto_id: 2,
  tarefa_id: 10,
  excluida: true
}

// Na busca, filtrar excluídas
```

**Resultado:**
- ✅ Tarefa não aparece na busca do cliente
- ✅ Mesmo que produto tenha esta tarefa
- ✅ Funciona como exclusão

---

## 🎯 Conclusão

**Solução Híbrida com Exceções:**

1. **Herança Padrão:** Cliente herda tarefas do produto (busca na query)
2. **Exceções Explícitas:** Gravar registros `cliente_id + produto_id + tarefa_id`
3. **Remoções:** Deletar registro ou usar flag `excluida`

**Garantias:**
- ✅ Pode adicionar tarefa diferente
- ✅ Pode remover tarefa específica
- ✅ Mantém herança como padrão
- ✅ Funciona com estrutura atual

**Próximo passo:** Implementar função de busca que combina herança + exceções

