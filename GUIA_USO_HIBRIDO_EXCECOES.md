# 📖 Guia: Como Usar Herança Híbrida com Exceções

## ✅ Garantias

**Você PODE:**
1. ✅ Adicionar tarefa diferente para cliente específico
2. ✅ Remover tarefa de cliente específico
3. ✅ Manter herança automática como padrão

---

## 🎯 Como Funciona

### Regra de Ouro

**Se existe registro `cliente_id + produto_id + tarefa_id`** → É **EXCEÇÃO** (não herda)
**Se NÃO existe registro** → **HERDA** do produto (busca na query)

---

## 📝 Exemplos Práticos

### Cenário 1: Cliente Herda Tarefas do Produto (Padrão)

**Situação:**
```
Produto "Website" tem:
- Tarefa "Desenvolvimento" (ID: 10)
- Tarefa "Design" (ID: 11)

Cliente "ABC" → Produto "Website"
```

**Ação:**
- ✅ **NÃO precisa fazer nada!**
- ✅ Cliente herda automaticamente as tarefas do produto

**Resultado:**
```
Cliente "ABC" tem:
- Tarefa "Desenvolvimento" (herdada)
- Tarefa "Design" (herdada)
```

**Como verificar:**
```javascript
GET /api/tarefas-por-cliente-produtos?clienteId=ABC&produtoIds=2

Resposta:
{
  "produtoId": 2,
  "tarefas": [
    { "id": 10, "nome": "Desenvolvimento", "ehExcecao": false },
    { "id": 11, "nome": "Design", "ehExcecao": false }
  ]
}
```

---

### Cenário 2: Adicionar Tarefa Diferente para Cliente

**Situação:**
```
Cliente "ABC" precisa de tarefa extra "Suporte" (ID: 99)
que o produto "Website" não tem
```

**Ação:**
```javascript
POST /api/vinculados
{
  "cp_cliente": "ABC",
  "cp_produto": 2,
  "cp_tarefa": 99  // Tarefa "Suporte"
}
```

**Resultado:**
```
Cliente "ABC" tem:
- Tarefa "Desenvolvimento" (herdada do produto)
- Tarefa "Design" (herdada do produto)
- Tarefa "Suporte" (EXCEÇÃO - adicionada manualmente)
```

**Como verificar:**
```javascript
GET /api/tarefas-por-cliente-produtos?clienteId=ABC&produtoIds=2

Resposta:
{
  "produtoId": 2,
  "tarefas": [
    { "id": 10, "nome": "Desenvolvimento", "ehExcecao": false },
    { "id": 11, "nome": "Design", "ehExcecao": false },
    { "id": 99, "nome": "Suporte", "ehExcecao": true }  // ← Exceção!
  ]
}
```

---

### Cenário 3: Remover Tarefa do Cliente

**Situação:**
```
Cliente "ABC" NÃO precisa de "Design" (ID: 11)
mesmo que o produto "Website" tenha esta tarefa
```

**Opção A: Criar Exceção (Substituir Herança)**

**Ação:**
```javascript
POST /api/vinculados
{
  "cp_cliente": "ABC",
  "cp_produto": 2,
  "cp_tarefa": 11  // Tarefa "Design"
}
```

**Como funciona:**
- Criar registro `cliente_id + produto_id + tarefa_id` faz com que esta tarefa seja tratada como exceção
- Se você criar o registro e depois deletar, a tarefa não aparece mais (não herda)

**Opção B: Deletar Registro Existente**

**Ação:**
```javascript
// 1. Buscar ID do registro
GET /api/vinculados?cliente_id=ABC&produto_id=2&tarefa_id=11

// 2. Deletar
DELETE /api/vinculados/{id}
```

**Resultado:**
```
Cliente "ABC" tem:
- Tarefa "Desenvolvimento" (herdada do produto)
- Tarefa "Suporte" (exceção)
- NÃO tem: "Design" (removida)
```

**Como verificar:**
```javascript
GET /api/tarefas-por-cliente-produtos?clienteId=ABC&produtoIds=2

Resposta:
{
  "produtoId": 2,
  "tarefas": [
    { "id": 10, "nome": "Desenvolvimento", "ehExcecao": false },
    { "id": 99, "nome": "Suporte", "ehExcecao": true }
    // "Design" não aparece mais!
  ]
}
```

---

## 🔧 API Endpoints

### 1. Buscar Tarefas do Cliente

```javascript
GET /api/tarefas-por-cliente-produtos?clienteId={clienteId}&produtoIds={produtoIds}

// Exemplo
GET /api/tarefas-por-cliente-produtos?clienteId=ABC&produtoIds=2,3

Resposta:
{
  "success": true,
  "data": [
    {
      "produtoId": 2,
      "tarefas": [
        {
          "id": 10,
          "nome": "Desenvolvimento",
          "tipoTarefa": { "id": 5, "nome": "Web" },
          "subtarefas": [
            { "id": 20, "nome": "Backend" }
          ],
          "ehExcecao": false  // ← Herdada do produto
        },
        {
          "id": 99,
          "nome": "Suporte",
          "ehExcecao": true  // ← Exceção (adicionada manualmente)
        }
      ]
    }
  ]
}
```

### 2. Adicionar Exceção (Tarefa Diferente)

```javascript
POST /api/vinculados
{
  "cp_cliente": "ABC",
  "cp_produto": 2,
  "cp_tarefa": 99  // Tarefa que o produto não tem
}

// Resultado: Tarefa aparece como exceção (ehExcecao: true)
```

### 3. Remover Tarefa (Criar Exceção que Substitui)

```javascript
// Método 1: Criar registro e depois deletar
POST /api/vinculados
{
  "cp_cliente": "ABC",
  "cp_produto": 2,
  "cp_tarefa": 11  // Tarefa que quer remover
}

DELETE /api/vinculados/{id}  // Deletar o registro criado

// Método 2: Se já existe registro, apenas deletar
DELETE /api/vinculados/{id}
```

---

## 🎯 Lógica de Busca

### Como a Função `getTarefasPorClienteEProdutos` Funciona

```javascript
Para cada produto:
  1. Buscar tarefas do produto (herança)
     → SELECT tarefa_id FROM vinculados 
        WHERE produto_id = X AND cliente_id IS NULL
  
  2. Buscar tarefas gravadas do cliente (exceções)
     → SELECT tarefa_id FROM vinculados 
        WHERE cliente_id = Y AND produto_id = X
  
  3. Combinar:
     - Herdadas: tarefas do produto que NÃO são exceções
     - Exceções: tarefas gravadas do cliente
  
  4. Retornar: Herdadas + Exceções
```

**Exemplo:**
```
Produto tem: [10, 11, 12]
Cliente tem gravado: [11, 99]

Resultado:
- Herdadas: [10, 12]  (produto tem, cliente não gravou)
- Exceções: [11, 99]  (cliente gravou)
- Total: [10, 12, 11, 99]
```

---

## ✅ Checklist de Uso

### Adicionar Tarefa Diferente
- [ ] Criar registro `cliente_id + produto_id + tarefa_id`
- [ ] Verificar que `ehExcecao: true` na resposta
- [ ] Tarefa aparece mesmo que produto não tenha

### Remover Tarefa
- [ ] Buscar ID do registro `cliente_id + produto_id + tarefa_id`
- [ ] Deletar o registro
- [ ] Verificar que tarefa não aparece mais na busca

### Verificar Herança
- [ ] Buscar tarefas do cliente
- [ ] Verificar que `ehExcecao: false` para tarefas herdadas
- [ ] Tarefas do produto aparecem automaticamente

---

## 🚨 Importante

### ⚠️ Atenção: Criar e Deletar Remove Herança

**Cenário:**
```
1. Cliente herda tarefa "Design" do produto (não tem registro)
2. Você cria registro: cliente + produto + tarefa "Design"
3. Você deleta o registro

Resultado: Tarefa "Design" NÃO aparece mais!
```

**Por quê:**
- Criar registro marca como exceção
- Deletar exceção não restaura herança
- Herança só funciona se NÃO existe registro

**Solução:**
- Se quer remover temporariamente, use flag `excluida` (futuro)
- Ou não crie o registro se não quiser quebrar herança

---

## 💡 Dicas

1. **Use `ehExcecao` para identificar:**
   - `false` = Herdada do produto
   - `true` = Adicionada manualmente

2. **Para adicionar tarefa:**
   - Crie registro normalmente
   - Aparece como exceção automaticamente

3. **Para remover tarefa:**
   - Deletar registro existente
   - Ou criar e deletar (remove herança)

4. **Para verificar herança:**
   - Busque tarefas do cliente
   - Compare com tarefas do produto
   - Diferenças são exceções

---

## 📞 Suporte

**Dúvidas?**
- Consulte: `SOLUCAO_HIBRIDA_COM_EXCECOES.md`
- Verifique logs do backend para debug
- Flag `ehExcecao` indica origem da tarefa

