# Migração para Supabase Storage - Resumo das Alterações

## Resumo

O sistema foi migrado para usar o Supabase Storage ao invés do sistema de arquivos local para armazenar avatares de usuários e clientes.

## Arquivos Alterados

### Backend

1. **`backend/src/utils/storage.js`** (NOVO)
   - Utilitário para upload, delete e obtenção de URLs do Supabase Storage
   - Funções principais:
     - `uploadImageToStorage()`: Faz upload de imagem para o Supabase Storage
     - `deleteImageFromStorage()`: Remove imagem do Supabase Storage
     - `getPublicUrl()`: Obtém URL pública de uma imagem
     - `getCustomAvatarUrl()`: Obtém URL de avatar customizado a partir do ID

2. **`backend/src/controllers/clientes.controller.js`**
   - Alterado `uploadClienteFoto` para usar `multer.memoryStorage()` ao invés de `diskStorage`
   - Função `uploadClienteFotoPerfil` agora faz upload direto para Supabase Storage
   - Removidas referências ao filesystem local

3. **`backend/src/controllers/auth.controller.js`**
   - Alterado `upload` para usar `multer.memoryStorage()` ao invés de `diskStorage`
   - Função `uploadAvatar` agora faz upload direto para Supabase Storage
   - Função `getCustomAvatarPath` atualizada para buscar URL do Supabase Storage
   - Removidas referências ao filesystem local (getUploadPath, fs.readdirSync, etc.)

### Frontend

O frontend não precisa de alterações significativas, pois já está preparado para trabalhar com URLs. O componente `Avatar` continua funcionando normalmente, recebendo URLs do Supabase Storage através do campo `imagePath` retornado pelas APIs.

## Buckets Necessários

Você precisa criar dois buckets públicos no Supabase Storage:

1. **`avatars`** - Para avatares de usuários
2. **`cliente-avatars`** - Para avatares de clientes

Veja o arquivo `SUPABASE_STORAGE_SETUP.md` para instruções detalhadas de configuração.

## Formato dos Arquivos

### Usuários
- Bucket: `avatars`
- Formato: `user-{userId}-{timestamp}.{ext}`
- Exemplo: `user-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

### Clientes
- Bucket: `cliente-avatars`
- Formato: `cliente-{clienteId}-{timestamp}.{ext}`
- Exemplo: `cliente-550e8400-e29b-41d4-a716-446655440000-1699123456789.jpg`

## URLs Retornadas

As URLs públicas retornadas pelo Supabase Storage seguem o formato:

```
https://{supabase-project-id}.supabase.co/storage/v1/object/public/{bucket-name}/{file-name}
```

## Campo foto_perfil

O campo `foto_perfil` continua usando o formato `custom-{userId}` ou `custom-{clienteId}` para identificar avatares customizados. A URL completa do Supabase Storage é retornada através do campo `imagePath` nas respostas das APIs de upload.

## Próximos Passos

1. Criar os buckets no Supabase Storage (ver `SUPABASE_STORAGE_SETUP.md`)
2. Testar upload de avatares de usuários
3. Testar upload de avatares de clientes
4. (Opcional) Migrar avatares existentes do filesystem para o Supabase Storage

## Notas Importantes

- O sistema não precisa mais criar diretórios locais para armazenar avatares
- As imagens são armazenadas diretamente no Supabase Storage
- O backend usa `multer.memoryStorage()` para carregar o arquivo na memória e depois enviar para o Supabase Storage
- Todos os uploads usam a `SUPABASE_SERVICE_KEY` que tem permissões completas no Storage

