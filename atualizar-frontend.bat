@echo off
REM Script para Fazer Build e Atualizar Frontend
REM UP Gestão Inteligente

echo ========================================
echo   ATUALIZAR FRONTEND
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Fazendo build do frontend...
cd frontEnd

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

call npm run build

if errorlevel 1 (
    echo [ERRO] Falha ao fazer build do frontend!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [2/3] Verificando se build foi criado...
if not exist "frontEnd\dist\index.html" (
    echo [ERRO] Build nao foi criado corretamente!
    pause
    exit /b 1
)

echo [OK] Build criado com sucesso!

echo.
echo [3/3] Reiniciando Nginx para aplicar mudancas...
docker compose -f docker-compose.local.yml restart nginx
if errorlevel 1 (
    echo Tentando com docker-compose (com hifen)...
    docker-compose -f docker-compose.local.yml restart nginx
)

echo.
echo ========================================
echo   FRONTEND ATUALIZADO!
echo ========================================
echo.
echo FrontEnd: http://localhost:8080
echo.
echo O novo build foi aplicado e o Nginx foi reiniciado.
echo.
pause

