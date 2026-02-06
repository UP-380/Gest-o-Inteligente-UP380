# Guia de Teste do Supabase Storage

## ✅ Buckets Criados

Após executar o script `create_storage_buckets.sql`, você deve ter:

1. ✅ Bucket `avatars` - Para avatares de usuários
2. ✅ Bucket `cliente-avatars` - Para avatares de clientes

## Como Verificar se Está Funcionando

### 1. Verificar no Dashboard do Supabase

1. Acesse o Supabase Dashboard
2. Vá para **Storage** no menu lateral
3. Você deve ver os dois buckets:
   - `avatars` (marcado como público)
   - `cliente-avatars` (marcado como público)

### 2. Testar Upload de Avatar de Usuário

1. Faça login no sistema
2. Vá para **Configurações de Perfil** (ou página de perfil)
3. Clique em **Alterar Foto** ou **Upload de Avatar**
4. Selecione uma imagem (JPEG, PNG, GIF ou WEBP)
5. Recorte a imagem se necessário
6. Clique em **Salvar** ou **Confirmar**
7. ✅ A imagem deve aparecer no perfil
8. Verifique no Supabase Dashboard > Storage > `avatars` se o arquivo foi criado

### 3. Testar Upload de Avatar de Cliente

1. Acesse a página de **Cadastro de Cliente** ou **Editar Cliente**
2. Clique no ícone de foto de perfil do cliente
3. Selecione uma imagem
4. Recorte se necessário
5. Clique em **Salvar Avatar**
6. ✅ A imagem deve aparecer no perfil do cliente
7. Verifique no Supabase Dashboard > Storage > `cliente-avatars` se o arquivo foi criado

### 4. Verificar URLs Geradas

Após fazer upload, as URLs devem seguir o formato:

```
https://{seu-projeto-id}.supabase.co/storage/v1/object/public/avatars/user-{userId}-{timestamp}.jpg
https://{seu-projeto-id}.supabase.co/storage/v1/object/public/cliente-avatars/cliente-{clienteId}-{timestamp}.jpg
```

Você pode verificar isso:
- No console do navegador (Network tab)
- Nos logs do backend
- No campo `imagePath` da resposta da API

## Possíveis Problemas e Soluções

### ❌ Erro: "Bucket not found"

**Solução**: 
- Verifique se executou o script completamente
- Confirme que os buckets aparecem no Dashboard do Supabase
- Verifique se os nomes estão exatamente como: `avatars` e `cliente-avatars`

### ❌ Erro: "Access denied" ou "Permission denied"

**Solução**:
- Verifique se os buckets estão marcados como **públicos**
- Verifique se as políticas RLS foram criadas (execute a query de verificação no script)
- Verifique se a `SUPABASE_SERVICE_KEY` está configurada corretamente no `.env` do backend

### ❌ Imagem não aparece após upload

**Solução**:
- Verifique o console do navegador para erros de CORS
- Verifique se a URL da imagem está correta (Network tab)
- Verifique se o arquivo foi realmente criado no Storage
- Limpe o cache do navegador e tente novamente

### ❌ Erro: "File size exceeds limit"

**Solução**:
- O limite é de 15MB por arquivo
- Reduza o tamanho da imagem
- Comprima a imagem antes de fazer upload

### ❌ Erro: "File type not allowed"

**Solução**:
- Apenas imagens são permitidas: JPEG, JPG, PNG, GIF, WEBP
- Verifique se o arquivo é realmente uma imagem
- Converta para um formato suportado

## Verificação de Políticas RLS

Execute esta query no SQL Editor do Supabase para verificar as políticas:

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

Você deve ver políticas para:
- `Public read access for avatars`
- `Public read access for cliente-avatars`
- `Authenticated users can upload avatars`
- `Authenticated users can upload cliente-avatars`
- E outras relacionadas a update/delete

## Próximos Passos

Após confirmar que está tudo funcionando:

1. ✅ Teste fazer upload de avatares de diferentes tamanhos
2. ✅ Teste fazer upload de diferentes formatos (JPEG, PNG, GIF, WEBP)
3. ✅ Verifique se as imagens aparecem corretamente em todas as telas
4. ✅ Teste fazer upload de avatar para usuário e cliente simultaneamente
5. ✅ (Opcional) Migre avatares antigos do filesystem para o Supabase Storage

## Migração de Avatares Existentes (Opcional)

Se você já tinha avatares no sistema de arquivos local, pode migrá-los:

1. Liste os arquivos no diretório local: `/frontEnd/public/assets/images/avatars/`
2. Para cada arquivo, faça upload para o Supabase Storage usando o mesmo formato
3. Atualize os registros no banco de dados para usar as novas URLs

**Nota**: Esta migração pode ser feita através de um script de migração separado, se necessário.

