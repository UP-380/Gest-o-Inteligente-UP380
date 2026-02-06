# Estrutura de dados, tempo e regras de negócio – Respostas

Documento gerado a partir da análise do código (backend + frontend) para suportar decisões de arquitetura e bloqueio de datas.

---

## 🧱 Estrutura de dados

### Como uma tarefa é identificada como "igual" a outra?

- **No contexto de tempo estimado (lista “Minhas Tarefas”):** a identidade é a combinação **cliente + produto + tarefa + responsável + data**. O frontend usa `tempo_estimado_id` (ID virtual do registro expandido por dia) como chave de linha.
- **No contexto de tarefa base (cp_tarefa):** a tarefa é identificada por `id` (e opcionalmente `clickup_id`). O tipo/categoria vem da tabela **vinculados** (`tarefa_tipo_id`, `tarefa_id`, `produto_id`, `cliente_id`, `subtarefa_id`).

### Quais campos definem a configuração da tarefa?

- **Tempo estimado (regra):** `cliente_id`, `produto_id`, `tarefa_id`, `responsavel_id`, `tipo_tarefa_id`, `data_inicio`, `data_fim`, `tempo_estimado_dia`, `incluir_finais_semana`, `incluir_feriados`.
- **Registro de tempo realizado:** `tarefa_id`, `cliente_id`, `usuario_id`, `produto_id`, `tipo_tarefa_id`, `data_inicio`, `data_fim`, `tempo_realizado`.
- **Tarefa base (cp_tarefa):** `id`, `nome`, `clickup_id`, `descricao`. Tipo e vínculos: tabela **vinculados**.

Não existe campo `atividade_id` nem `data_execucao`/`data_atribuicao` no código; a “data da tarefa” no painel é a **data do registro virtual** (campo `data`) gerada a partir da regra de tempo estimado.

### Existe ID único de tarefa base + variações por data, ou cada tarefa por dia é um registro totalmente independente?

- **Tarefa base:** uma linha em `cp_tarefa` (ID único).
- **Tempo estimado:** existem **regras** em `tempo_estimado_regra` (por período `data_inicio`–`data_fim`). O backend **expande** cada regra em “registros virtuais” por dia (um por dia no período). Cada um ganha um `id`/`tempo_estimado_id` virtual. Ou seja: há **uma regra** e várias “variações por data” **calculadas**, não uma linha por dia no banco.
- **Tempo realizado:** cada início/parada de timer vira **um registro** em `registro_tempo` (ou `registro_tempo_pendente` para Plug Rápido). Não há “ID de tarefa base + data” único; a relação com a regra é lógica (mesmo tarefa_id, cliente_id, usuario, período).

### A data da tarefa é data_execucao, data_atribuicao ou outro campo?

- Não existem `data_execucao` nem `data_atribuicao` no código.
- **Tempo estimado:** a “data da tarefa” é o campo **`data`** do registro virtual (cada dia entre `data_inicio` e `data_fim` da regra).
- **Registro de tempo:** a “data do registro” é inferida de **`data_inicio`** (e `data_fim`) em `registro_tempo` – ou seja, quando o timer foi iniciado/parado.

---

## ⏱️ Sistema de tempo / play

### O botão ▶️ (play) faz exatamente o quê no backend?

1. **Encerra** qualquer registro ativo do usuário em `registro_tempo` e em `registro_tempo_pendente` (um único timer ativo por usuário).
2. **Cria um novo registro** em `registro_tempo` com:
   - `tarefa_id`, `cliente_id`, `usuario_id`, `produto_id` (e `tipo_tarefa_id` buscado por tarefa);
   - `data_inicio = now()`, `data_fim = null`, `tempo_realizado = null`.
3. **Não** cria/atualiza “status da tarefa” em outra tabela; não é “só timer em memória” – persiste em `registro_tempo`.

Endpoint: `POST /api/registro-tempo/iniciar` (body: `tarefa_id`, `cliente_id`, `usuario_id`, `produto_id`). Não envia `data` nem `tempo_estimado_id`; o backend **sempre** usa `data_inicio = new Date().toISOString()`.

### Onde ocorre o bloqueio atual de datas?

- **Somente no frontend (React),** em `PainelUsuario.jsx`:
  - `checkDataHoje()` compara `reg.data` (data do registro virtual) com a data local do browser (`hoje`).
  - Se `!isHoje` → `isBloqueado = true` → botão Play desabilitado e tooltip: *“Não é possível plugar em tarefas de outra data”*.
- **Backend:** não valida se a tarefa é “do dia”; aceita qualquer `tarefa_id`/`cliente_id`/`usuario_id` e grava `data_inicio = now()`.
- **Banco:** não há trigger/constraint que restrinja a data do registro.

### O sistema valida data de execução em qual ponto?

- **Ao iniciar o timer:** não. O backend não recebe nem valida “data da tarefa”; só grava o instante atual.
- **Ao salvar/editar tempo:** em `atualizarRegistroTempo` há validação de **não-futuro** e de ordem/duração (`data_inicio` < `data_fim`, duração ≥ 1s). Não há checagem de “só editar registro do dia”.
- **Ao criar registro:** a única “data” é o `now()` do servidor; não há validação de “tarefa do dia”.

Conclusão: a regra “só pode plugar em tarefa do dia atual” existe **apenas na UI**, não na API nem no banco.

---

## 📅 Lógica atual de datas

### Como o sistema define “tarefa do dia”?

- **Frontend:** `hoje` = `new Date()` no cliente (timezone do browser). Comparação com `reg.data` (string `YYYY-MM-DD` ou objeto Date).
- **Backend (tempo estimado):** gera registros virtuais por dia a partir de `data_inicio`/`data_fim` da regra (e feriados/fins de semana conforme configuração). Não usa “hoje” fixo; o “dia” é cada dia do período.
- Não há uso explícito de timezone específico do servidor para “hoje”; no frontend depende do relógio do usuário.

### Hoje é possível plugar manualmente em tarefas de outro dia via API?

- **Sim.** O backend **não** valida a data da tarefa ao criar o registro: qualquer `tarefa_id`/`cliente_id` é aceito e `data_inicio` é sempre “agora”.
- Além disso, **editar** um registro (`PUT` com `data_inicio`/`data_fim`) permite alterar as datas para outro dia (respeitando apenas: não futuro, início < fim, duração ≥ 1s). Ou seja, é possível “plugar” em outro dia via API (criar + editar datas, ou futuramente enviar data no body se a API for alterada).

---

## ⚙️ Tarefas estimadas vs tempo real

### Existe vínculo direto entre tempo_estimado e tempo_realizado?

- **No insert de `registro_tempo`:** o controller **não** preenche `tempo_estimado_id`. O insert usa apenas: `tarefa_id`, `cliente_id`, `usuario_id`, `data_inicio`, `data_fim`, `tempo_realizado`, `produto_id`, `tipo_tarefa_id`.
- Em outras partes do código (ex.: tempo-estimado.controller, dashboards) há **leitura** de `tempo_estimado_id` em `registro_tempo` (view/select), então a coluna pode existir e ser preenchida em outro fluxo ou ficar opcional. O vínculo **na criação do registro pelo play** é apenas lógico (mesma tarefa/cliente/usuário/período).

### Uma tarefa pode ter múltiplos registros de tempo? Apenas um ativo por vez?

- **Múltiplos registros:** sim. Vários `registro_tempo` podem existir para a mesma tarefa/cliente/usuário (dias ou sessões diferentes).
- **Um ativo por vez:** sim, por usuário. Ao iniciar um novo registro, o backend finaliza todos os registros em `registro_tempo` e `registro_tempo_pendente` com `data_fim = null` para aquele `usuario_id`.

---

## 🔁 Regras de duplicidade

### O sistema permite a mesma tarefa (mesma config) em múltiplos dias?

- **Sim.** Várias regras em `tempo_estimado_regra` podem cobrir a mesma combinação cliente/produto/tarefa/responsável em períodos diferentes; os registros virtuais são um por dia em cada período.
- Não há bloqueio de “esta tarefa já existe nesse dia” na criação de regras nem no play.

### Existe regra atual de deduplicação, merge ou bloqueio lógico?

- **Deduplicação/merge:** não há rotina de merge ou deduplicação de tarefas/regras.
- **Bloqueio:** apenas o bloqueio de UI (“tarefa de outra data” no Painel). Na edição de registro há tratamento de **sobreposição** (ajuste em cascata de outros registros do mesmo usuário), mas não “um registro por tarefa por dia”.

---

## 🧠 Regra de negócio atual

### Qual é a regra formal hoje?

- Na prática: **“Só pode plugar em tarefa do dia atual”** é aplicada **somente no frontend**, desabilitando o botão Play quando `reg.data !== hoje`.
- Não está documentada em backend nem em banco; não há validação na API.

### Onde está documentada / implementada?

- **Frontend:** `PainelUsuario.jsx` (função `checkDataHoje`, `isBloqueado = !isHoje`, tooltip e `disabled` no botão).
- **Backend:** não há checagem de “data da tarefa” em `POST /api/registro-tempo/iniciar` nem em `PUT` de edição.

### O conceito de “Plug Rápido” é:

- **Atribuição pendente de aprovação:** criação em `atribuicoes_pendentes` (e opcionalmente `registro_tempo_pendente` se `iniciar_timer`). Após aprovação vira histórico em `historico_atribuicoes` com `is_plug_rapido: true` e pode gerar regras de tempo estimado.
- **Pode ser “sem tarefa definida”** (`sem_tarefa_definida` + `comentario_colaborador`).
- **Timer:** se iniciar timer, usa `registro_tempo_pendente` (separado de `registro_tempo` até aprovação).
- Ou seja: tarefa/atribuição criada fora do fluxo normal de planejamento, com aprovação e possivelmente sem tarefa pré-definida; não é “só sem estimativa” – pode ter estimativa após aprovação.

---

## 📊 Impacto no sistema

### O tempo realizado impacta:

- **Dashboards:** sim. O controller de dashboard usa `v_registro_tempo_vinculado` e `registro_tempo` (e `tempo_realizado` calculado ou armazenado).
- **Indicadores / metas / relatórios financeiros / produtividade / SLA:** o código não foi rastreado função a função, mas como os dashboards consomem `registro_tempo` e `tempo_realizado`, qualquer métrica que use essas fontes é impactada. Qualquer mudança em regras de data ou de “o que é uma tarefa do dia” deve considerar esses consumidores.

---

## 🧬 Arquitetura

### Onde está a lógica de “Minhas Tarefas”?

- **Frontend:** `PainelUsuario.jsx` monta a lista chamando `GET /api/tempo-estimado` com `responsavel_id`, `data_inicio`, `data_fim` (mesmo dia), `page`, `limit`. O backend retorna registros virtuais (um por dia) das regras. Em seguida o frontend injeta tarefas pendentes (Plug Rápido) de `GET /api/atribuicoes-pendentes/minhas` filtradas pela data selecionada.
- **Backend:** controller **tempo-estimado.controller.js** (`getTempoEstimado` e funções que expandem regras em registros por dia). Não existe um “Minhas Tarefas service” único; é essa API + combinação no frontend.

### O backend hoje aceita data_execucao != today() no registro de tempo?

- **Na criação:** não recebe `data_execucao`; sempre usa “agora” para `data_inicio`. Então o registro criado é sempre “do dia” do servidor no momento do request.
- **Na edição:** aceita `data_inicio` e `data_fim` no body e **permite** alterar para outras datas (passadas), desde que não futuras e com duração ≥ 1s. Ou seja, **sim**, indiretamente o backend aceita “registro com data de execução diferente de hoje” via edição.

---

## 🔐 Regras de permissão

- Não foi encontrada permissão específica para:
  - “plug rápido”,
  - “override de data”,
  - “ajuste manual”.
- O controle de “quem pode editar registro” e “quem pode criar Plug Rápido” depende de `requireAuth` e da sessão; não há roles ou flags específicos para essas ações no código analisado.

---

## 🎯 Resumo para o objetivo do diff

| Aspecto | Situação atual |
|--------|-----------------|
| Onde aplicar regra “só plugar no dia” | Só frontend hoje; para garantir integridade, implementar também no **backend** (ex.: validar que a “data da tarefa” do tempo estimado ou da atribuição = data do request ou data permitida). |
| Bloqueio inteligente | Pode manter bloqueio de UI e adicionar validação na API (ex.: em `POST /api/registro-tempo/iniciar` receber opcionalmente `data` e rejeitar se não for “hoje” ou política definida). |
| Integridade tempo estimado vs realizado | Hoje o vínculo é lógico; opcionalmente persistir `tempo_estimado_id` no insert de `registro_tempo` e validar que a data do registro está dentro do período da regra. |
| Plug rápido | Manter fluxo atual (pendente → aprovação → histórico/regras); definir se “plug rápido” pode ou não ser em data passada e aplicar mesma regra de data no backend. |
| Rastreabilidade e métricas | Garantir que qualquer regra de data (ex.: “só hoje”) seja aplicada de forma consistente na criação e na edição, para não quebrar dashboards e relatórios que usam `registro_tempo` e `tempo_realizado`. |

Documento gerado a partir do repositório (branch atual). Para alterações futuras, buscar por “checkDataHoje”, “registro-tempo/iniciar”, “atualizarRegistroTempo” e “tempo_estimado_regra”.
