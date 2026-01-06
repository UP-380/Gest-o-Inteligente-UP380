#!/usr/bin/env python
"""
Script de configuração inicial do projeto +Compliance
"""
import os
import sys
import subprocess
import django
from django.core.management import execute_from_command_line

def run_command(command, description):
    """Executa um comando e exibe o resultado"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} - Concluído!")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro em {description}:")
        print(e.stderr)
        return False

def main():
    """Executa a configuração inicial"""
    print("🚀 Configurando +Compliance - Sistema de Gestão de Gabinete Político")
    print("=" * 70)
    
    # Verificar se estamos no diretório correto
    if not os.path.exists('manage.py'):
        print("❌ Erro: Execute este script no diretório raiz do projeto")
        sys.exit(1)
    
    # Configurar Django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')
    
    try:
        django.setup()
    except Exception as e:
        print(f"❌ Erro ao configurar Django: {e}")
        sys.exit(1)
    
    # Executar migrações
    print("\n📊 Executando migrações do banco de dados...")
    try:
        execute_from_command_line(['manage.py', 'migrate'])
        print("✅ Migrações executadas com sucesso!")
    except Exception as e:
        print(f"❌ Erro nas migrações: {e}")
        sys.exit(1)
    
    # Carregar dados de exemplo
    print("\n📦 Carregando dados de exemplo...")
    try:
        execute_from_command_line(['manage.py', 'loaddata', 'fixtures/seed.json'])
        print("✅ Dados de exemplo carregados com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao carregar dados: {e}")
        print("ℹ️  Você pode carregar os dados manualmente com: python manage.py loaddata fixtures/seed.json")
    
    # Coletar arquivos estáticos
    print("\n🎨 Coletando arquivos estáticos...")
    try:
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput'])
        print("✅ Arquivos estáticos coletados!")
    except Exception as e:
        print(f"❌ Erro ao coletar estáticos: {e}")
    
    print("\n" + "=" * 70)
    print("🎉 Configuração concluída com sucesso!")
    print("\n📋 Próximos passos:")
    print("1. Execute: python manage.py runserver")
    print("2. Acesse: http://localhost:8000")
    print("3. Faça login com:")
    print("   - Email: admin@vereadorxpto.com.br")
    print("   - Senha: admin123")
    print("\n📚 Documentação completa no arquivo README.md")
    print("=" * 70)

if __name__ == '__main__':
    main()









