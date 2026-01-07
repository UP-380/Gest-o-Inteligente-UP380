# Instruções para Configurar o Arquivo .env

Este guia explica passo a passo como configurar o arquivo `.env` necessário para executar o script de validação.

## Passo 1: Verificar se o arquivo .env existe

1. Abra o explorador de arquivos
2. Navegue até a pasta: `Gest-o-Inteligente-UP380\backEnd`
3. Verifique se existe um arquivo chamado `.env` (pode estar oculto)

## Passo 2: Se o arquivo .env NÃO existe

### Opção A: Criar manualmente

1. Na pasta `backEnd`, clique com o botão direito
2. Selecione "Novo" > "Documento de Texto"
3. Renomeie o arquivo para `.env` (sem extensão)
4. Se o Windows avisar sobre mudar a extensão, clique em "Sim"

### Opção B: Criar via PowerShell

1. Abra o PowerShell
2. Navegue até a pasta backEnd:
```powershell
cd "C:\Aplicacao\Gest-o-Inteligente-UP380\backEnd"
```

3. Crie o arquivo .env:
```powershell
New-Item -Path .env -ItemType File
```

## Passo 3: Adicionar as variáveis de ambiente

Abra o arquivo `.env` em um editor de texto (Notepad, VS Code, etc.) e adicione as seguintes linhas:

```env
SUPABASE_URL=sua_url_do_supabase_aqui
SUPABASE_SERVICE_KEY=sua_service_key_aqui
```

**IMPORTANTE**: Substitua `sua_url_do_supabase_aqui` e `sua_service_key_aqui` pelos valores reais do seu Supabase.

## Passo 4: Onde encontrar as credenciais do Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com/)
2. Selecione seu projeto
3. Vá em **Settings** (Configurações) > **API**
4. Você encontrará:
   - **Project URL** → Use como `SUPABASE_URL`
   - **service_role key** → Use como `SUPABASE_SERVICE_KEY`

**ATENÇÃO**: Use a `service_role` key (não a `anon` key), pois ela tem permissões completas.

## Passo 5: Exemplo de arquivo .env completo

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldS1wcm9qZXRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTIzNDU2NywiZXhwIjoxOTYwODEwNTY3fQ.exemplo_exemplo_exemplo
```

## Passo 6: Verificar se está funcionando

1. Abra o PowerShell
2. Navegue até a pasta backEnd:
```powershell
cd "C:\Aplicacao\Gest-o-Inteligente-UP380\backEnd"
```

3. Execute o script de validação:
```powershell
node validar-tempo-estimado.js
```

Se aparecer a mensagem de validação (sem erro de variáveis de ambiente), está funcionando! ✅

## Problemas Comuns

### Erro: "SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar definidas"

**Solução**: 
- Verifique se o arquivo `.env` está na pasta `backEnd` (não em outra pasta)
- Verifique se as variáveis estão escritas corretamente (sem espaços antes ou depois do `=`)
- Verifique se não há aspas desnecessárias nos valores

### Erro: "Cannot find module 'dotenv'"

**Solução**: Instale o pacote dotenv:
```powershell
cd "C:\Aplicacao\Gest-o-Inteligente-UP380\backEnd"
npm install dotenv
```

### O arquivo .env não aparece no explorador

**Solução**: 
- Arquivos que começam com `.` podem estar ocultos
- No explorador do Windows, vá em "Exibir" > "Mostrar" > "Itens ocultos"
- Ou use o PowerShell para verificar:
```powershell
Get-ChildItem -Force | Where-Object { $_.Name -eq ".env" }
```

## Segurança

⚠️ **IMPORTANTE**: 
- NUNCA compartilhe o arquivo `.env`
- NUNCA faça commit do arquivo `.env` no Git
- O arquivo `.env` já deve estar no `.gitignore`

Se precisar compartilhar configurações, use um arquivo `.env.example` sem os valores reais.


