"""
Comando para gerar slugs para gabinetes existentes
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from accounts.models import Gabinete


class Command(BaseCommand):
    help = 'Gera slugs únicos para todos os gabinetes que não possuem slug'

    def handle(self, *args, **options):
        gabinetes_sem_slug = Gabinete.objects.filter(slug__isnull=True) | Gabinete.objects.filter(slug='')
        total = gabinetes_sem_slug.count()
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('✅ Todos os gabinetes já possuem slug!'))
            return
        
        self.stdout.write(f'📋 Encontrados {total} gabinetes sem slug.')
        self.stdout.write('🔄 Gerando slugs...\n')
        
        contador = 0
        for gabinete in gabinetes_sem_slug:
            # Gera slug baseado no nome do parlamentar
            base_slug = slugify(gabinete.parlamentar_nome)
            slug = base_slug
            counter = 1
            
            # Garante que o slug seja único
            while Gabinete.objects.filter(slug=slug).exclude(pk=gabinete.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            gabinete.slug = slug
            gabinete.save()
            contador += 1
            
            self.stdout.write(
                self.style.SUCCESS(f'  ✅ {gabinete.parlamentar_nome} → slug: "{slug}"')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'\n🎉 {contador} slug(s) gerado(s) com sucesso!')
        )


