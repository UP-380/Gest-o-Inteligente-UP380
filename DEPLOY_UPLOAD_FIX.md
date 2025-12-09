# 🚀 Sequência de Deploy - Correção Upload Avatar

## 📋 Comandos para Atualizar Produção

```bash
# 1. Ir para o diretório do projeto
cd /var/www/up380-GestaoInteligente

# 2. Atualizar o código do Git
git pull origin main

# 3. Se houver mudanças no frontend, fazer build ANTES de subir os containers
cd frontEnd
npm install  # Se necessário
npm run build
cd ..

# 4. Parar e remover containers antigos (incluindo volumes para recriar o volume de uploads)
docker compose -f docker-compose.prod.yml down --volumes --remove-orphans

# 5. Remover o volume de uploads antigo (se existir) para garantir permissões corretas
docker volume rm gest-o-inteligente-up380_upgi-uploads 2>/dev/null || true
docker volume rm up380-gestaointeligente_upgi-uploads 2>/dev/null || true

# 6. Reconstruir as imagens (sem cache) - IMPORTANTE para aplicar mudanças do Dockerfile
docker compose -f docker-compose.prod.yml build --no-cache upgi-app

# 7. Subir os containers em background
docker compose -f docker-compose.prod.yml up -d

# 8. Aguardar alguns segundos para os containers iniciarem
sleep 5

# 9. Ajustar permissões do diretório de uploads (executar como root no container)
docker exec -u root upgi-prod chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars/custom 2>/dev/null || true
docker exec -u root upgi-prod chmod -R 755 /app/frontEnd/public/assets/images/avatars/custom 2>/dev/null || true

# 10. Verificar se os containers estão rodando
docker ps

# 11. Verificar logs do backend para confirmar que o diretório foi criado corretamente
docker logs upgi-prod | grep -i "upload\|diretório" | tail -10

# 12. Verificar se o diretório de uploads existe e tem permissões corretas
docker exec upgi-prod ls -la /app/frontEnd/public/assets/images/avatars/custom 2>/dev/null || echo "⚠️ Diretório ainda não existe, será criado no primeiro upload"
```

---

## ✅ Verificação Pós-Deploy

```bash
# Verificar logs do backend
docker logs upgi-prod --tail 50

# Verificar se o diretório foi criado (deve mostrar permissões nodejs:nodejs)
docker exec upgi-prod ls -ld /app/frontEnd/public/assets/images/avatars/custom

# Verificar saúde do backend
docker exec upgi-prod node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" && echo "✅ Backend saudável" || echo "❌ Backend com problemas"
```

---

## 🔧 Se Ainda Der Erro de Permissão

Se após o deploy ainda houver erro de permissão, execute:

```bash
# Ajustar permissões manualmente (executar como root)
docker exec -u root upgi-prod sh -c "
  mkdir -p /app/frontEnd/public/assets/images/avatars/custom && \
  chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars/custom && \
  chmod -R 755 /app/frontEnd/public/assets/images/avatars/custom && \
  ls -la /app/frontEnd/public/assets/images/avatars/custom
"

# Reiniciar o container para aplicar
docker compose -f docker-compose.prod.yml restart upgi-app
```

---

## 📝 Notas Importantes

1. **Volume de Uploads**: O volume `upgi-uploads` será criado automaticamente pelo Docker na primeira execução
2. **Permissões**: O usuário `nodejs` (UID 1001) precisa ter permissão de escrita no diretório
3. **Logs**: Os logs agora mostram mensagens detalhadas sobre criação e permissões do diretório
4. **Nginx**: O nginx também precisa ter acesso ao volume para servir os arquivos estáticos

---

## 🐛 Troubleshooting

### Erro: "EACCES: permission denied"
```bash
# Verificar permissões atuais
docker exec upgi-prod ls -la /app/frontEnd/public/assets/images/avatars/

# Ajustar permissões
docker exec -u root upgi-prod chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars
```

### Erro: "Diretório não encontrado"
```bash
# Criar diretório manualmente
docker exec -u root upgi-prod mkdir -p /app/frontEnd/public/assets/images/avatars/custom
docker exec -u root upgi-prod chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars/custom
```

### Ver logs em tempo real
```bash
# Backend
docker logs -f upgi-prod

# Nginx
docker logs -f upgi-nginx
```

