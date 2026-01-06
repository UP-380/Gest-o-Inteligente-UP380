#!/usr/bin/env python
"""
Script para executar o servidor Django com configurações otimizadas
"""
import os
import sys
import django
from django.core.management import execute_from_command_line

def main():
    """Executa o servidor Django"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')
    
    # Configurações para desenvolvimento
    if len(sys.argv) == 1:
        sys.argv.extend(['runserver', '0.0.0.0:8000'])
    
    django.setup()
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()









