# Análise de Riscos - Página /atribuir-responsaveis

## 📋 Resumo Executivo

Esta análise identifica **riscos críticos** de múltiplas chamadas de API simultâneas que podem sobrecarregar a VPS em produção, mesmo que funcione normalmente no localhost.

---

## 🔴 RISCOS CRÍTICOS IDENTIFICADOS

### 1. **Múltiplos useEffects Disparando `loadRegistrosTempoEstimado` Simultaneamente**

**Localização:** Linhas 3624, 3665, 3814

**Problema:**
- **3 useEffects diferentes** podem disparar `loadRegistrosTempoEstimado` ao mesmo tempo
- Não há proteção contra chamadas simultâneas (sem `AbortController` ou flag de "em execução")
- Cada mudança de filtro dispara uma nova chamada imediatamente

**Cenário de Risco:**
```
Usuário muda filtro → useEffect linha 3665 dispara
Usuário muda período → useEffect linha 3814 dispara  
Usuário muda página → useEffect linha 3624 dispara
= 3 chamadas simultâneas para /api/tempo-estimado
```

**Impacto na VPS:**
- Em produção com múltiplos usuários, isso pode gerar dezenas de requisições simultâneas
- Cada requisição busca até 10.000 registros (limit: '10000')
- Pode causar timeout, 503 (Service Unavailable) ou sobrecarga do servidor

---

### 2. **Falta de Debounce/Throttle nas Mudanças de Filtros**

**Localização:** Linha 3665 - useEffect que atualiza automaticamente

**Problema:**
- Cada mudança em `filtroClienteSelecionado`, `filtroProdutoSelecionado`, etc. dispara imediatamente uma nova chamada
- Se o usuário selecionar múltiplos itens rapidamente, cada seleção gera uma nova requisição

**Cenário de Risco:**
```
Usuário seleciona Cliente 1 → API call
Usuário seleciona Cliente 2 → API call
Usuário seleciona Cliente 3 → API call
= 3 chamadas em menos de 1 segundo
```

**Impacto na VPS:**
- Em localhost, a latência é baixa e o servidor responde rápido
- Em produção (VPS), a latência é maior e múltiplas requisições simultâneas podem acumular
- Pode causar fila de requisições e eventual timeout

---

### 3. **`buscarOpcoesFiltroContextual` Pode Ser Chamada Múltiplas Vezes em Paralelo**

**Localização:** Linhas 1046-1292, 1313-1342, 3814-3877

**Problema:**
- A função `buscarOpcoesFiltroContextual` não tem proteção contra chamadas simultâneas
- Pode ser chamada para múltiplos tipos de filtro ao mesmo tempo (responsavel, cliente, produto, tarefa)
- Cada chamada faz uma requisição para `/api/tempo-estimado` com limit: 1000

**Cenário de Risco:**
```javascript
// useEffect linha 3814 pode disparar 4 chamadas simultâneas:
if (filtrosAdicionaisAtivos.tarefa) {
  buscarOpcoesFiltroContextual('tarefa'); // API call 1
}
if (filtrosAdicionaisAtivos.produto) {
  buscarOpcoesFiltroContextual('produto'); // API call 2
}
if (filtrosAdicionaisAtivos.cliente) {
  buscarOpcoesFiltroContextual('cliente'); // API call 3
}
if (filtroPaiAtual === 'responsavel') {
  buscarOpcoesFiltroContextual('responsavel'); // API call 4
}
// = 4 requisições simultâneas apenas para carregar opções de filtros
```

**Impacto na VPS:**
- Se houver 3 usuários simultâneos, pode gerar 12 requisições ao mesmo tempo
- Cada requisição busca 1000 registros
- Pode sobrecarregar o banco de dados e a VPS

---

### 4. **`loadRegistrosTempoEstimado` Não Tem Proteção Contra Race Conditions**

**Localização:** Linha 2128

**Problema:**
- A função não verifica se já está em execução antes de iniciar uma nova chamada
- Não usa `AbortController` para cancelar requisições anteriores
- Múltiplas chamadas simultâneas podem resultar em estados inconsistentes

**Cenário de Risco:**
```
Chamada 1 inicia → setLoading(true)
Chamada 2 inicia → setLoading(true) (sobrescreve)
Chamada 1 termina → setRegistrosAgrupados(dados1)
Chamada 2 termina → setRegistrosAgrupados(dados2) (sobrescreve dados1)
= Dados inconsistentes + requisições desnecessárias
```

**Impacto na VPS:**
- Requisições desnecessárias consomem recursos
- Estados inconsistentes podem causar bugs na UI
- Pode gerar confusão e mais cliques do usuário (mais requisições)

---

### 5. **RequestPool com Limite de 5, Mas Pode Acumular na Fila**

**Localização:** `frontEnd/src/utils/requestPool.js` (linha 57)

**Problema:**
- O `globalRequestPool` tem limite de 5 requisições simultâneas
- Mas se houver muitas chamadas, elas ficam na fila esperando
- Em produção, com múltiplos usuários, a fila pode crescer muito

**Cenário de Risco:**
```
Usuário 1: 10 requisições → 5 executando, 5 na fila
Usuário 2: 10 requisições → 5 executando, 5 na fila
Usuário 3: 10 requisições → 5 executando, 5 na fila
= 15 requisições na fila esperando
```

**Impacto na VPS:**
- A fila pode crescer indefinidamente se novas requisições chegarem mais rápido do que são processadas
- Requisições antigas podem ficar esperando muito tempo
- Pode causar timeout e experiência ruim para o usuário

---

## 🟡 RISCOS MODERADOS

### 6. **`carregarDadosEmLote` Adiciona Múltiplas Requisições ao Pool Simultaneamente**

**Localização:** Linha 1838

**Problema:**
- A função adiciona até 4 requisições diferentes ao `globalRequestPool` de uma vez:
  1. Tempo Estimado Total
  2. Tempo Realizado Total
  3. Horas Contratadas
  4. Custos

**Cenário de Risco:**
```
Se houver 10 grupos visíveis:
- 10 chamadas para tempo estimado
- 10 chamadas para tempo realizado
- 10 chamadas para horas contratadas
- 10 chamadas para custos
= 40 requisições adicionadas ao pool de uma vez
```

**Impacto na VPS:**
- Pode saturar o pool rapidamente
- Requisições podem ficar na fila por muito tempo

---

## ✅ PONTOS POSITIVOS (Otimizações Já Implementadas)

1. **RequestPool com limite de concorrência** (5 requisições simultâneas)
2. **Carregamento em lote** (`carregarDadosEmLote`) para reduzir requisições individuais
3. **Cache de nomes** para evitar requisições repetidas
4. **Fila de processamento sequencial** para dados individuais

---

## 🛠️ RECOMENDAÇÕES DE CORREÇÃO

### **PRIORIDADE ALTA (Crítico para Produção)**

#### 1. **Adicionar Debounce nas Mudanças de Filtros**

```javascript
// Criar hook useDebounce ou usar biblioteca (lodash)
import { debounce } from 'lodash';

// No useEffect linha 3665, adicionar debounce:
useEffect(() => {
  if (filtrosAplicados && periodoInicio && periodoFim && filtrosUltimosAplicados) {
    const debouncedLoad = debounce(() => {
      // ... código atual ...
      loadRegistrosTempoEstimado(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);
    }, 500); // Aguardar 500ms após última mudança
    
    debouncedLoad();
    
    return () => {
      debouncedLoad.cancel(); // Cancelar se componente desmontar ou filtros mudarem
    };
  }
}, [filtroClienteSelecionado, filtroProdutoSelecionado, ...]);
```

#### 2. **Adicionar Flag de "Em Execução" em `loadRegistrosTempoEstimado`**

```javascript
const [loadingRegistros, setLoadingRegistros] = useState(false);
const loadingRef = useRef(false);

const loadRegistrosTempoEstimado = useCallback(async (...) => {
  // Prevenir chamadas simultâneas
  if (loadingRef.current) {
    console.log('⏸️ [LOAD] Já existe uma requisição em andamento, ignorando...');
    return;
  }
  
  loadingRef.current = true;
  setLoadingRegistros(true);
  
  try {
    // ... código atual ...
  } finally {
    loadingRef.current = false;
    setLoadingRegistros(false);
  }
}, [...]);
```

#### 3. **Usar AbortController para Cancelar Requisições Anteriores**

```javascript
const abortControllerRef = useRef(null);

const loadRegistrosTempoEstimado = useCallback(async (...) => {
  // Cancelar requisição anterior se existir
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  
  const abortController = new AbortController();
  abortControllerRef.current = abortController;
  
  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      // ... outros parâmetros
    });
    // ... resto do código
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Requisição cancelada');
      return;
    }
    throw error;
  }
}, [...]);
```

#### 4. **Adicionar Debounce em `buscarOpcoesFiltroContextual`**

```javascript
// Criar um Map para rastrear chamadas pendentes por tipo
const opcoesPendentesRef = useRef(new Map());

const buscarOpcoesFiltroContextual = useCallback(
  debounce(async (tipoFiltro) => {
    // Verificar se já existe uma chamada pendente para este tipo
    if (opcoesPendentesRef.current.has(tipoFiltro)) {
      return opcoesPendentesRef.current.get(tipoFiltro);
    }
    
    const promise = (async () => {
      // ... código atual da função ...
    })();
    
    opcoesPendentesRef.current.set(tipoFiltro, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      opcoesPendentesRef.current.delete(tipoFiltro);
    }
  }, 300), // Debounce de 300ms
  [periodoInicio, periodoFim, ...]
);
```

### **PRIORIDADE MÉDIA**

#### 5. **Consolidar useEffects que Disparam `loadRegistrosTempoEstimado`**

```javascript
// Em vez de 3 useEffects separados, criar 1 useEffect consolidado
useEffect(() => {
  if (!filtrosAplicados || !periodoInicio || !periodoFim || !filtrosUltimosAplicados) {
    return;
  }
  
  // Debounce consolidado
  const debouncedLoad = debounce(() => {
    const valoresSelecionados = {
      cliente: filtroClienteSelecionado,
      produto: filtroProdutoSelecionado,
      tarefa: filtroTarefaSelecionado,
      responsavel: filtroResponsavelSelecionado
    };
    
    const filtrosAdicionais = {
      cliente: filtroAdicionalCliente,
      tarefa: filtroAdicionalTarefa,
      produto: filtroAdicionalProduto
    };
    
    const configuracaoPeriodo = {
      inicio: periodoInicio,
      fim: periodoFim
    };
    
    loadRegistrosTempoEstimado(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);
  }, 500);
  
  debouncedLoad();
  
  return () => {
    debouncedLoad.cancel();
  };
}, [
  currentPage,
  itemsPerPage,
  filtroClienteSelecionado,
  filtroProdutoSelecionado,
  filtroTarefaSelecionado,
  filtroResponsavelSelecionado,
  filtroAdicionalCliente,
  filtroAdicionalTarefa,
  filtroAdicionalProduto
]);
```

#### 6. **Aumentar o Limite do RequestPool ou Implementar Priorização**

```javascript
// Em requestPool.js, considerar aumentar o limite ou implementar priorização mais inteligente
export const globalRequestPool = new RequestPool(10); // Aumentar de 5 para 10

// Ou implementar priorização por tipo de requisição
// Requisições de "opções de filtro" podem ter prioridade menor que "carregar registros"
```

---

## 📊 ESTIMATIVA DE IMPACTO

### **Sem Correções:**
- **Risco Alto** de sobrecarga na VPS em produção
- Múltiplos usuários podem gerar 50+ requisições simultâneas
- Pode causar timeouts, erros 503 e experiência ruim

### **Com Correções:**
- **Risco Baixo** de sobrecarga
- Requisições serão limitadas e controladas
- Melhor experiência do usuário e estabilidade do sistema

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Implementar debounce** nas mudanças de filtros (Prioridade Alta)
2. ✅ **Adicionar flag de "em execução"** em `loadRegistrosTempoEstimado` (Prioridade Alta)
3. ✅ **Usar AbortController** para cancelar requisições anteriores (Prioridade Alta)
4. ✅ **Adicionar debounce** em `buscarOpcoesFiltroContextual` (Prioridade Alta)
5. ⚠️ **Consolidar useEffects** (Prioridade Média)
6. ⚠️ **Ajustar RequestPool** (Prioridade Média)

---

## 📝 NOTAS FINAIS

- **Localhost vs Produção:** No localhost, a latência é baixa e o servidor responde rápido, então os problemas podem não ser visíveis. Em produção (VPS), a latência é maior e múltiplas requisições simultâneas podem acumular e sobrecarregar o servidor.

- **Teste Recomendado:** Após implementar as correções, testar com múltiplos usuários simultâneos simulando o comportamento real em produção.

---

**Data da Análise:** $(date)
**Arquivo Analisado:** `frontEnd/src/pages/DelegarTarefas/DelegarTarefas.jsx`
