from django.core.management.base import BaseCommand
from accounts.models import User, Gabinete


class Command(BaseCommand):
    help = 'Configuração inicial do sistema - cria gabinete e usuário admin'

    def handle(self, *args, **options):
        self.stdout.write("\n" + "="*60)
        self.stdout.write("CONFIGURAÇÃO INICIAL - +Compliance")
        self.stdout.write("="*60 + "\n")
        
        try:
            # 1. Criar ou buscar gabinete
            gabinete, created = Gabinete.objects.get_or_create(
                id=1,
                defaults={
                    'nome': 'Gabinete Principal',
                    'parlamentar_nome': 'Parlamentar',
                    'cargo': 'VEREADOR',
                    'esfera': 'MUNICIPAL',
                    'municipio': 'São Paulo',
                    'estado': 'SP',
                    'email': 'gabinete@email.com.br',
                    'telefone': '(00) 00000-0000',
                    'endereco': 'Endereço do Gabinete',
                    'ativo': True
                }
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS("✅ Gabinete criado com sucesso!"))
            else:
                self.stdout.write(self.style.SUCCESS("✅ Gabinete já existe!"))
            
            self.stdout.write(f"   Nome: {gabinete.nome}")
            self.stdout.write(f"   Parlamentar: {gabinete.parlamentar_nome}")
            self.stdout.write(f"   Cargo: {gabinete.get_cargo_display()}\n")
            
            # 2. Criar usuário administrador
            email = 'luiz.marcelo@up380.com.br'
            
            if User.objects.filter(email=email).exists():
                user = User.objects.get(email=email)
                # Garantir que tem gabinete associado
                if user.gabinete is None:
                    user.gabinete = gabinete
                    user.save()
                    self.stdout.write(self.style.SUCCESS("✅ Gabinete associado ao usuário existente!"))
                else:
                    self.stdout.write(self.style.SUCCESS("✅ Usuário já existe e está configurado!"))
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
                self.stdout.write(self.style.SUCCESS("✅ Usuário administrador criado com sucesso!"))
            
            self.stdout.write(f"\n📧 Email: {user.email}")
            self.stdout.write(f"🔑 Senha: Finance.@2")
            self.stdout.write(f"👤 Nome: {user.get_full_name()}")
            self.stdout.write(f"🏛️  Gabinete: {user.gabinete.nome}")
            self.stdout.write(f"🎭 Papel: {user.get_papel_display()}")
            
            self.stdout.write("\n" + "="*60)
            self.stdout.write(self.style.SUCCESS("✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"))
            self.stdout.write("="*60)
            self.stdout.write("\n📋 Agora você pode:")
            self.stdout.write("1. Fazer login em: http://localhost:8000")
            self.stdout.write("2. Email: luiz.marcelo@up380.com.br")
            self.stdout.write("3. Senha: Finance.@2")
            self.stdout.write("\n")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n❌ Erro na configuração: {e}"))
            import traceback
            traceback.print_exc()

