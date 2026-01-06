# ✅ Implementação: Seleção de Tarefas por Produto

## 🎯 Funcionalidade Implementada

Ao vincular produto ao cliente, agora é possível:
1. ✅ Ver todas as tarefas vinculadas a cada produto
2. ✅ Marcar/desmarcar tarefas específicas por produto
3. ✅ Salvar apenas as tarefas selecionadas como exceções

---

## 📋 Como Funciona

### Fluxo do Usuário

1. **Selecionar Produtos**
   - Usuário seleciona produtos no select
   - Componente `SelecaoTarefasPorProduto` aparece automaticamente

2. **Ver Tarefas dos Produtos**
   - Lista todas as tarefas de cada produto selecionado
   - Mostra tipo de tarefa e subtarefas (herança na query)
   - Todas as tarefas vêm marcadas por padrão (herança)

3. **Selecionar/Desselecionar Tarefas**
   - Usuário pode marcar/desmarcar tarefas por produto
   - Botão "Marcar todas" / "Desmarcar todas" por produto
   - Interface expansível por produto

4. **Salvar**
   - Cria vínculos apenas para tarefas selecionadas
   - Tarefas desmarcadas não são vinculadas (cliente não herda)

---

## 🔧 Componentes Criados

### 1. `SelecaoTarefasPorProduto.jsx`

**Localização:** `frontEnd/src/components/clients/SelecaoTarefasPorProduto.jsx`

**Funcionalidades:**
- Carrega tarefas de cada produto selecionado
- Mostra interface de seleção por produto
- Permite marcar/desmarcar tarefas
- Notifica componente pai sobre mudanças

**Props:**
```javascript
{
  clienteId: string,
  produtos: Array<{ id, nome }>,
  onTarefasChange: (tarefasPorProduto) => void
}
```

**Estado Interno:**
```javascript
{
  tarefasPorProduto: { produtoId: [{ id, nome, selecionada, tipoTarefa, subtarefas }] },
  loading: boolean,
  expandedProdutos: { produtoId: boolean }
}
```

---

### 2. Integração em `ClienteVinculacao.jsx`

**Mudanças:**
- Importa `SelecaoTarefasPorProduto`
- Adiciona estado `tarefasSelecionadasPorProduto`
- Substitui `TarefasVinculadasCliente` por `SelecaoTarefasPorProduto`
- Modifica `handleSave` para incluir tarefas selecionadas

---

## 💾 Lógica de Salvamento

### Estrutura de Dados

```javascript
tarefasSelecionadasPorProduto = {
  produtoId1: {
    tarefaId1: true,   // Selecionada (criar vínculo)
    tarefaId2: false   // Desmarcada (não criar vínculo)
  },
  produtoId2: {
    tarefaId3: true
  }
}
```

### Ao Salvar

```javascript
Para cada produto selecionado:
  Para cada tarefa selecionada:
    Criar vínculo: Cliente → Produto → Tarefa (exceção)
  
  Se nenhuma tarefa selecionada:
    Criar vínculo: Cliente → Produto (herança padrão)
```

**Exemplo:**
```
Produto "Website" tem: [Tarefa 10, Tarefa 11, Tarefa 12]
Usuário seleciona: [Tarefa 10, Tarefa 12] (desmarca Tarefa 11)

Resultado ao salvar:
- Cliente → Produto "Website" → Tarefa 10 ✅
- Cliente → Produto "Website" → Tarefa 12 ✅
- Tarefa 11 não é vinculada (cliente não herda)
```

---

## 🎨 Interface

### Visualização por Produto

```
┌─────────────────────────────────────────┐
│ Produto: Website                        │
│ 2 de 3 tarefa(s) selecionada(s)        │
│ [Marcar todas] [▼]                      │
├─────────────────────────────────────────┤
│ ☑ Tarefa: Desenvolvimento               │
│   Tipo: Web                             │
│   2 subtarefa(s)                        │
│                                         │
│ ☑ Tarefa: Design                        │
│                                         │
│ ☐ Tarefa: Testes                        │
└─────────────────────────────────────────┘
```

### Características

- ✅ Expansível/colapsável por produto
- ✅ Checkbox para cada tarefa
- ✅ Mostra tipo de tarefa e subtarefas
- ✅ Botão "Marcar todas" / "Desmarcar todas"
- ✅ Contador de tarefas selecionadas
- ✅ Destaque visual para tarefas selecionadas

---

## 🔄 Fluxo Completo

### 1. Seleção de Produtos

```javascript
Usuário seleciona: Produto "Website", Produto "App"
→ Componente SelecaoTarefasPorProduto aparece
→ Carrega tarefas de ambos os produtos
```

### 2. Seleção de Tarefas

```javascript
Produto "Website":
  ☑ Desenvolvimento
  ☑ Design
  ☐ Testes

Produto "App":
  ☑ Desenvolvimento
  ☐ Design
```

### 3. Salvamento

```javascript
Cria vínculos:
- Cliente → Produto "Website" → Tarefa "Desenvolvimento"
- Cliente → Produto "Website" → Tarefa "Design"
- Cliente → Produto "App" → Tarefa "Desenvolvimento"
```

### 4. Resultado

```javascript
Cliente herda:
- Produto "Website": Desenvolvimento, Design (exceções gravadas)
- Produto "App": Desenvolvimento (exceção gravada)

Cliente NÃO herda:
- Produto "Website": Testes (não foi selecionado)
- Produto "App": Design (não foi selecionado)
```

---

## ✅ Garantias

### 1. Adicionar Tarefa ✅

**Como:**
- Marcar checkbox da tarefa
- Salvar vinculação

**Resultado:**
- Tarefa aparece como exceção (`ehExcecao: true`)
- Cliente tem esta tarefa mesmo que produto não tenha

---

### 2. Remover Tarefa ✅

**Como:**
- Desmarcar checkbox da tarefa
- Salvar vinculação

**Resultado:**
- Tarefa não é vinculada
- Cliente não herda esta tarefa do produto

---

### 3. Herança Padrão ✅

**Como:**
- Deixar todas as tarefas marcadas (padrão)
- Salvar vinculação

**Resultado:**
- Todas as tarefas do produto são vinculadas
- Cliente herda todas as tarefas

---

## 📝 Exemplo de Uso

### Cenário: Cliente precisa de algumas tarefas

```
1. Selecionar Produto "Website"
2. Ver tarefas: [Desenvolvimento, Design, Testes]
3. Desmarcar "Testes" (cliente não precisa)
4. Salvar

Resultado:
- Cliente tem: Desenvolvimento, Design
- Cliente NÃO tem: Testes
```

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras

1. **Adicionar Tarefa Externa**
   - Permitir adicionar tarefa que produto não tem
   - Campo de busca para todas as tarefas

2. **Visualização de Herança**
   - Mostrar quais tarefas são herdadas vs exceções
   - Diferenciação visual

3. **Bulk Actions**
   - Selecionar/desselecionar todas as tarefas de todos os produtos
   - Aplicar seleção de um produto a outros

---

## ✅ Status

**Implementado:**
- ✅ Componente de seleção de tarefas
- ✅ Integração com ClienteVinculacao
- ✅ Lógica de salvamento com exceções
- ✅ Interface expansível por produto

**Funcionando:**
- ✅ Carregar tarefas dos produtos
- ✅ Marcar/desmarcar tarefas
- ✅ Salvar apenas tarefas selecionadas
- ✅ Manter herança padrão quando todas selecionadas

