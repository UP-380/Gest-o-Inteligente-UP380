#!/usr/bin/env python
"""
Script para configuração inicial do sistema
"""
import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')
django.setup()

from accounts.models import User, Gabinete

def setup_inicial():
    """Configuração inicial do sistema"""
    print("\n" + "="*60)
    print("CONFIGURAÇÃO INICIAL - +Compliance")
    print("="*60 + "\n")
    
    try:
        # 1. Criar ou buscar gabinete
        gabinete, created = Gabinete.objects.get_or_create(
            id=1,
            defaults={
                'nome': 'Gabinete Principal',
                'vereador_nome': 'Vereador',
                'email': 'gabinete@email.com.br',
                'telefone': '(00) 00000-0000',
                'endereco': 'Endereço do Gabinete',
                'ativo': True
            }
        )
        
        if created:
            print("✅ Gabinete criado com sucesso!")
        else:
            print("✅ Gabinete já existe!")
        
        print(f"   Nome: {gabinete.nome}")
        print(f"   Vereador: {gabinete.vereador_nome}\n")
        
        # 2. Criar usuário administrador
        email = 'luiz.marcelo@up380.com.br'
        
        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            # Garantir que tem gabinete associado
            if user.gabinete is None:
                user.gabinete = gabinete
                user.save()
                print("✅ Gabinete associado ao usuário existente!")
            else:
                print("✅ Usuário já existe e está configurado!")
        else:
            user = User.objects.create_user(
                username='luiz.marcelo',
                email=email,
                password='Finance.@2',
                first_name='Luiz Marcelo',
                last_name='Alencar',
                gabinete=gabinete,
                papel='ADMIN',
                is_staff=True,
                is_superuser=True
            )
            print("✅ Usuário administrador criado com sucesso!")
        
        print(f"\n📧 Email: {user.email}")
        print(f"🔑 Senha: Finance.@2")
        print(f"👤 Nome: {user.get_full_name()}")
        print(f"🏛️  Gabinete: {user.gabinete.nome}")
        print(f"🎭 Papel: {user.get_papel_display()}")
        
        print("\n" + "="*60)
        print("✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!")
        print("="*60)
        print("\n📋 Próximos passos:")
        print("1. Execute: python manage.py runserver")
        print("2. Acesse: http://localhost:8000")
        print("3. Faça login com as credenciais acima")
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Erro na configuração: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    setup_inicial()

