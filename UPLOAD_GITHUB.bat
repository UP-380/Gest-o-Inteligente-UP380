@echo off
chcp 65001 >nul
echo ========================================
echo  UPLOAD PARA GITHUB - GESTAO GABINETE
echo ========================================
echo.

cd /d "%~dp0"

echo [1/6] Verificando diretorio...
if not exist "manage.py" (
    echo ERRO: manage.py nao encontrado!
    echo Certifique-se de executar este script na pasta do projeto.
    pause
    exit /b 1
)
echo OK! Diretorio correto.
echo.

echo [2/6] Inicializando Git...
if exist ".git" (
    echo Git ja inicializado.
) else (
    git init
)
echo.

echo [3/6] Configurando remote...
git remote remove origin 2>nul
git remote add origin https://github.com/NebulumTechAssociation/Gest-o_Gabinete.git
echo OK! Remote configurado.
echo.

echo [4/6] Adicionando arquivos...
git add .
echo OK! Arquivos adicionados.
echo.

echo [5/6] Fazendo commit...
git commit -m "Sistema de Gestao de Gabinete - Upload inicial" 2>nul
if errorlevel 1 (
    echo AVISO: Nenhuma mudanca para commitar ou commit ja existe.
) else (
    echo OK! Commit realizado.
)
echo.

echo [6/6] Enviando para GitHub (branch master)...
echo.
echo ATENCAO: Quando pedir autenticacao:
echo - Username: Seu usuario do GitHub
echo - Password: Cole o TOKEN (nao a senha!)
echo.
git push -u origin master
if errorlevel 1 (
    echo.
    echo ERRO ao fazer push!
    echo Verifique suas credenciais e tente novamente.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo  SUCESSO! Codigo enviado para GitHub!
    echo ========================================
    echo.
    echo Repositorio: https://github.com/NebulumTechAssociation/Gest-o_Gabinete
    echo Branch: master
    echo.
)

pause

