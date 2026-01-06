@echo off
echo.
echo ========================================
echo +Compliance - Sistema de Gestao de Gabinete
echo ========================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado. Instale Python 3.11+ primeiro.
    pause
    exit /b 1
)

REM Criar ambiente virtual se não existir
if not exist ".venv" (
    echo Criando ambiente virtual...
    python -m venv .venv
    if errorlevel 1 (
        echo ERRO: Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
)

REM Ativar ambiente virtual
echo Ativando ambiente virtual...
call .venv\Scripts\activate.bat

REM Instalar dependências
echo Instalando dependencias...
pip install -r requirements.txt
if errorlevel 1 (
    echo AVISO: Falha ao instalar dependencias principais
    echo Tentando instalar sem PostgreSQL...
    pip install Django==5.0.6 djangorestframework==3.15.2 django-filter==24.3 python-dotenv==1.0.1
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias
        pause
        exit /b 1
    )
)

REM Executar migrações
echo Executando migracoes...
python manage.py migrate
if errorlevel 1 (
    echo ERRO: Falha nas migracoes
    pause
    exit /b 1
)

REM Carregar dados de exemplo
echo Carregando dados de exemplo...
python manage.py loaddata fixtures/seed.json
if errorlevel 1 (
    echo AVISO: Falha ao carregar dados de exemplo
    echo Voce pode carregar manualmente depois
)

REM Coletar arquivos estáticos
echo Coletando arquivos estaticos...
python manage.py collectstatic --noinput
if errorlevel 1 (
    echo AVISO: Falha ao coletar arquivos estaticos
)

echo.
echo ========================================
echo CONFIGURACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo Proximos passos:
echo 1. Execute: python manage.py runserver
echo 2. Acesse: http://localhost:8000
echo 3. Login: admin@vereadorxpto.com.br
echo 4. Senha: admin123
echo.
echo Pressione qualquer tecla para iniciar o servidor...
pause >nul

REM Iniciar servidor
echo Iniciando servidor...
python manage.py runserver
