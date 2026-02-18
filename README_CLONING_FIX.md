# Restaurando Funcionalidade de Clonagem (Contas Bancárias)

Para que a funcionalidade de clonagem de contas bancárias (e Adquirentes/Sistemas) permita criar registros CÓPIA exata no banco de dados, é necessário ajustar as **restrições (constraints)** do banco.

Atualmente, o banco está configurado para **impedir** registros com os mesmos dados (ex: mesmo banco, agência e conta). Isso impede o "Salvar" direto na clonagem.

## Opção 1: Ajuste no Banco de Dados (Recomendado para permitir cópias exatas)

1. Conecte-se ao seu banco de dados (PGAdmin, DBeaver, ou console Supabase).
2. Execute o script SQL localizado em:
   `backEnd/src/scripts/fix_constraint.sql`

Isso removerá a restrição de "Chave Primária Composta" e permitirá inserir registros duplicados (exceto pelo ID único que é gerado automaticamente).

## Opção 2: Tratamento no Frontend (Já implementado)

Se você não puder alterar o banco de dados agora, o sistema foi atualizado para **exibir uma mensagem clara** de erro de duplicidade:

> "Duplicidade detectada: Já existe uma conta com estes dados. Altere algum campo (ex: observações) para salvar, ou verifique se este registro já existe."

Isso permite que você clone o registro, **altere algo pequeno** (como adicionar uma observação "Cópia") e salve com sucesso.

---

### Verificação
Após aplicar o script SQL ou usar a solução do Frontend, tente clicar no botão de clonar e salvar.
- Com SQL aplicado: Salvar deve funcionar imediatamente (cria duplicata).
- Sem SQL: Você verá o alerta vermelho no modal e precisará editar um campo antes de salvar.
