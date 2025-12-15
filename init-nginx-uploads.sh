#!/bin/sh
# Script de inicialização para garantir permissões corretas no volume de uploads

# Criar diretório se não existir
mkdir -p /usr/share/nginx/html/assets/images/avatars/custom

# Ajustar permissões para que nginx possa ler
chmod -R 755 /usr/share/nginx/html/assets/images/avatars/custom

# Executar nginx
exec nginx -g 'daemon off;'




