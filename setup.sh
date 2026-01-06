#!/bin/bash

echo ""
echo "========================================"
echo "+Compliance - Sistema de Gestão de Gabinete"
echo "========================================"
echo ""

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "ERRO: Python 3 não encontrado. Instale Python 3.11+ primeiro."
    exit 1
fi

# Criar ambiente virtual se não existir
if [ ! -d ".venv" ]; then
    echo "Criando ambiente virtual..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "ERRO: Falha ao criar ambiente virtual"
        exit 1
    fi
fi

# Ativar ambiente virtual
echo "Ativando ambiente virtual..."
source .venv/bin/activate

# Instalar dependências
echo "Instalando dependências..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao instalar dependências"
    exit 1
fi

# Executar migrações
echo "Executando migrações..."
python manage.py migrate
if [ $? -ne 0 ]; then
    echo "ERRO: Falha nas migrações"
    exit 1
fi

# Carregar dados de exemplo
echo "Carregando dados de exemplo..."
python manage.py loaddata fixtures/seed.json
if [ $? -ne 0 ]; then
    echo "AVISO: Falha ao carregar dados de exemplo"
    echo "Você pode carregar manualmente depois"
fi

# Coletar arquivos estáticos
echo "Coletando arquivos estáticos..."
python manage.py collectstatic --noinput
if [ $? -ne 0 ]; then
    echo "AVISO: Falha ao coletar arquivos estáticos"
fi

echo ""
echo "========================================"
echo "CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
echo "========================================"
echo ""
echo "Próximos passos:"
echo "1. Execute: python manage.py runserver"
echo "2. Acesse: http://localhost:8000"
echo "3. Login: admin@vereadorxpto.com.br"
echo "4. Senha: admin123"
echo ""
echo "Pressione Enter para iniciar o servidor..."
read

# Iniciar servidor
echo "Iniciando servidor..."
python manage.py runserver









