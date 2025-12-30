# Configuração do Supabase Storage para Avatares

Este documento descreve como configurar o Supabase Storage para armazenar avatares de usuários e clientes.

## Buckets Necessários

É necessário criar dois buckets públicos no Supabase Storage:

### 1. Bucket `avatars`
- **Nome**: `avatars`
- **Público**: Sim (para permitir acesso direto via URL)
- **Política RLS**: Permitir leitura pública
- **Uso**: Armazena avatares customizados de usuários
- **Formato de arquivo**: `user-{userId}-{timestamp}.{ext}`

### 2. Bucket `cliente-avatars`
- **Nome**: `cliente-avatars`
- **Público**: Sim (para permitir acesso direto via URL)
- **Política RLS**: Permitir leitura pública
- **Uso**: Armazena avatares customizados de clientes
- **Formato de arquivo**: `cliente-{clienteId}-{timestamp}.{ext}`

## Como Criar os Buckets

### Método Recomendado: Script SQL Automático

1. Acesse o dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral
4. Abra o arquivo `scripts/create_storage_buckets.sql` deste projeto
5. Copie todo o conteúdo do script
6. Cole no SQL Editor do Supabase
7. Clique em **Run** para executar o script

O script irá:
- ✅ Criar os buckets `avatars` e `cliente-avatars`
- ✅ Configurar como públicos
- ✅ Definir limite de tamanho (15MB)
- ✅ Definir tipos MIME permitidos (JPEG, JPG, PNG, GIF, WEBP)
- ✅ Criar políticas RLS para leitura pública
- ✅ Criar políticas para upload/update/delete (via service key)

**Nota**: O script usa `ON CONFLICT DO UPDATE`, então pode ser executado múltiplas vezes sem erro. Se os buckets já existirem, apenas atualizará as configurações.

### Via Dashboard do Supabase (alternativa manual)

1. Acesse o dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **Storage** no menu lateral
4. Clique em **New bucket**
5. Configure cada bucket:
   - **Name**: `avatars` (ou `cliente-avatars`)
   - **Public bucket**: ✅ Marque esta opção
   - Clique em **Create bucket**

## Políticas RLS (Row Level Security)

Para permitir acesso público de leitura, você pode configurar políticas RLS:

```sql
-- Política para leitura pública do bucket avatars
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Política para leitura pública do bucket cliente-avatars
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cliente-avatars');
```

## Políticas de Upload (Opcional)

Para permitir upload apenas de usuários autenticados (se necessário):

```sql
-- Política para upload no bucket avatars (requer autenticação)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Política para upload no bucket cliente-avatars (requer autenticação)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cliente-avatars' AND
  auth.role() = 'authenticated'
);
```

**Nota**: Como estamos usando `SUPABASE_SERVICE_KEY` no backend, as políticas de upload não são necessárias se você quiser permitir uploads apenas pelo backend. O service key tem permissões completas.

## Formato dos Arquivos

### Usuários
- **Bucket**: `avatars`
- **Formato**: `user-{userId}-{timestamp}.{ext}`
- **Exemplo**: `user-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

### Clientes
- **Bucket**: `cliente-avatars`
- **Formato**: `cliente-{clienteId}-{timestamp}.{ext}`
- **Exemplo**: `cliente-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

## URLs Públicas

As URLs públicas geradas pelo Supabase seguem o formato:

```
https://{supabase-project-id}.supabase.co/storage/v1/object/public/{bucket-name}/{file-name}
```

## Migração de Arquivos Existentes

Se você já tem avatares armazenados no sistema de arquivos local, será necessário migrá-los para o Supabase Storage. Isso pode ser feito através de um script de migração.

## Testando a Configuração

Após configurar os buckets, teste fazendo upload de um avatar:

1. Acesse a página de perfil do usuário
2. Faça upload de uma imagem
3. Verifique se a imagem aparece corretamente
4. Verifique no dashboard do Supabase Storage se o arquivo foi criado

