# 🚀 Comandos de Deploy - Produção

## Sequência Completa (Com Correção de Upload)

```bash
# 1. Ir para o diretório do projeto
cd /var/www/up380-GestaoInteligente

# 2. Atualizar o código do Git
git pull origin main

# 3. Se houver mudanças no frontend, fazer build
cd frontEnd
npm install  # Se necessário
npm run build
cd ..

# 4. Parar e remover containers antigos (incluindo volumes)
docker compose -f docker-compose.prod.yml down --volumes --remove-orphans

# 5. Remover volume de uploads antigo (para garantir permissões corretas)
docker volume rm gest-o-inteligente-up380_upgi-uploads 2>/dev/null || true
docker volume rm up380-gestaointeligente_upgi-uploads 2>/dev/null || true

# 6. Reconstruir as imagens (sem cache)
docker compose -f docker-compose.prod.yml build --no-cache

# 7. Subir os containers em background
docker compose -f docker-compose.prod.yml up -d

# 8. Aguardar containers iniciarem
sleep 5

# 9. Ajustar permissões do diretório de uploads (CRÍTICO para upload de avatar)
# Backend - garantir que nodejs pode escrever
docker exec -u root upgi-prod chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars/custom 2>/dev/null || true
docker exec -u root upgi-prod chmod -R 755 /app/frontEnd/public/assets/images/avatars/custom 2>/dev/null || true

# Nginx - garantir que nginx pode ler (importante para servir os arquivos)
docker exec -u root upgi-nginx chmod -R 755 /usr/share/nginx/html/assets/images/avatars/custom 2>/dev/null || true

# 10. Verificar se os containers estão rodando
docker ps

# 11. Verificar logs do backend
docker logs upgi-prod | grep -i "upload\|diretório" | tail -10

# 12. Verificar se os arquivos estão acessíveis no nginx
docker exec upgi-nginx ls -la /usr/share/nginx/html/assets/images/avatars/custom/ 2>/dev/null || echo "⚠️ Diretório ainda vazio ou sem permissão"
```

---

## ⚠️ Se Apenas o Frontend For Atualizado

```bash
# 1. Ir para o diretório do frontend
cd /var/www/up380-GestaoInteligente/frontEnd

# 2. Fazer build do frontend
npm run build

# 3. Voltar para o diretório raiz
cd /var/www/up380-GestaoInteligente

# 4. Reiniciar o nginx para carregar os novos arquivos
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 🔧 Comando Rápido de Correção (Se Der Erro de Permissão)

```bash
# Ajustar permissões do diretório de uploads
docker exec -u root upgi-prod sh -c "
  mkdir -p /app/frontEnd/public/assets/images/avatars/custom && \
  chown -R nodejs:nodejs /app/frontEnd/public/assets/images/avatars/custom && \
  chmod -R 755 /app/frontEnd/public/assets/images/avatars/custom
"

# Reiniciar o container
docker compose -f docker-compose.prod.yml restart upgi-app
```

---

## ✅ Verificação Rápida

```bash
# Verificar se o diretório existe e tem permissões corretas
docker exec upgi-prod ls -ld /app/frontEnd/public/assets/images/avatars/custom

# Ver logs do backend
docker logs upgi-prod --tail 20
```

