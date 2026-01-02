# Scripts de Configuração do Supabase Storage

## Como Usar

### 1. Script Principal: `create_storage_buckets.sql`

Este script cria automaticamente todos os buckets e políticas necessárias para o sistema de avatares.

**Como executar:**

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **SQL Editor** (menu lateral)
4. Clique em **New query**
5. Abra o arquivo `scripts/create_storage_buckets.sql`
6. Copie todo o conteúdo
7. Cole no SQL Editor
8. Clique em **Run** (ou pressione `Ctrl+Enter`)

**O que o script faz:**

- ✅ Cria bucket `avatars` (avatares de usuários)
- ✅ Cria bucket `cliente-avatars` (avatares de clientes)
- ✅ Configura buckets como públicos
- ✅ Define limite de 15MB por arquivo
- ✅ Permite apenas imagens (JPEG, JPG, PNG, GIF, WEBP)
- ✅ Cria políticas RLS para leitura pública
- ✅ Cria políticas para upload/update/delete

**Segurança:**

O script é seguro para executar múltiplas vezes. Ele usa `ON CONFLICT DO UPDATE`, então:
- Se os buckets não existirem, serão criados
- Se já existirem, apenas atualizará as configurações
- As políticas serão recriadas (DROP + CREATE)

### 2. Verificação

Após executar o script, você pode verificar se tudo foi criado corretamente:

1. Vá para **Storage** no menu lateral
2. Você deve ver dois buckets:
   - `avatars` (público)
   - `cliente-avatars` (público)

Ou execute esta query no SQL Editor:

```sql
SELECT id, name, public, file_size_limit, created_at
FROM storage.buckets
WHERE id IN ('avatars', 'cliente-avatars');
```

## Estrutura dos Buckets

### Bucket: `avatars`
- **Uso**: Avatares de usuários
- **Formato de arquivo**: `user-{userId}-{timestamp}.{ext}`
- **Exemplo**: `user-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

### Bucket: `cliente-avatars`
- **Uso**: Avatares de clientes
- **Formato de arquivo**: `cliente-{clienteId}-{timestamp}.{ext}`
- **Exemplo**: `cliente-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

## Políticas RLS Criadas

### Leitura Pública
- Qualquer pessoa pode visualizar as imagens (necessário para URLs públicas)
- Aplicado aos buckets `avatars` e `cliente-avatars`

### Upload/Update/Delete
- Apenas usuários autenticados ou service_role podem fazer upload/update/delete
- Como o backend usa `SUPABASE_SERVICE_KEY`, ele tem permissões completas

## Troubleshooting

### Erro: "bucket already exists"
✅ Isso é normal! O script usa `ON CONFLICT DO UPDATE`, então apenas atualiza as configurações.

### Erro: "permission denied"
- Verifique se você está usando uma conta com permissões de administrador no projeto
- Certifique-se de estar executando no SQL Editor (não no Query Editor do Dashboard)

### Buckets não aparecem no Dashboard
- Aguarde alguns segundos e recarregue a página
- Verifique se executou o script completamente (até o final)
- Execute a query de verificação no SQL Editor

### Imagens não aparecem após upload
- Verifique se os buckets estão marcados como **públicos**
- Verifique as políticas RLS (devem permitir SELECT público)
- Verifique a URL gerada (deve começar com `https://` e incluir `/storage/v1/object/public/`)

## Próximos Passos

Após executar o script:

1. ✅ Teste fazer upload de um avatar de usuário
2. ✅ Teste fazer upload de um avatar de cliente
3. ✅ Verifique se as imagens aparecem corretamente no frontend

## Suporte

Se encontrar problemas:
1. Verifique os logs do backend para erros de upload
2. Verifique o console do navegador para erros de carregamento de imagens
3. Verifique se a `SUPABASE_SERVICE_KEY` está configurada corretamente no `.env`

