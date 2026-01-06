#!/usr/bin/env python
"""
Script para fazer upload de logo personalizada
"""
import os
import sys
import django
from django.core.files import File

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')
django.setup()

from accounts.models import Gabinete

def upload_logo_personalizada():
    """Upload de logo personalizada"""
    
    # Buscar o gabinete principal
    gabinete = Gabinete.objects.get(id=1)
    
    print(f"Gabinete atual:")
    print(f"  Nome: {gabinete.nome}")
    print(f"  Parlamentar: {gabinete.parlamentar_nome}")
    print(f"  Logo atual: {gabinete.logo}")
    print()
    
    # Verificar se existe arquivo de logo na pasta
    logo_paths = [
        'logo.png',
        'logo.jpg', 
        'logo.jpeg',
        'logo.gif',
        'logo.svg',
        'gabinete_logo.png',
        'gabinete_logo.jpg'
    ]
    
    logo_encontrada = None
    for logo_path in logo_paths:
        if os.path.exists(logo_path):
            logo_encontrada = logo_path
            break
    
    if logo_encontrada:
        print(f"✅ Logo encontrada: {logo_encontrada}")
        
        # Fazer upload
        with open(logo_encontrada, 'rb') as f:
            gabinete.logo.save(f'logo_{gabinete.id}.{logo_encontrada.split(".")[-1]}', File(f), save=True)
        
        print(f"✅ Logo uploadada com sucesso!")
        print(f"🔗 Caminho: {gabinete.logo.url}")
        
    else:
        print("❌ Nenhuma logo encontrada!")
        print()
        print("📋 Para adicionar uma logo:")
        print("1. Coloque sua imagem na pasta do projeto com um destes nomes:")
        for nome in logo_paths:
            print(f"   - {nome}")
        print()
        print("2. Execute este script novamente")
        print()
        print("💡 Formatos suportados: PNG, JPG, JPEG, GIF, SVG")

if __name__ == "__main__":
    upload_logo_personalizada()






