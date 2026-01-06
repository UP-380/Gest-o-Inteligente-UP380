import os
import django
from django.urls import reverse


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')
    django.setup()

    tests = [
        ('agenda:lista', None),
        ('agenda:editar', [1]),
        ('crm:pessoa_list', None),
        ('documentos:memorando_list', None),
        ('documentos:requerimento_list', None),
        ('documentos:indicacao_list', None),
        ('atendimento:atendimento_list', None),
        ('atendimento:atendimento_detail', [1]),
    ]

    for name, args in tests:
        try:
            url = reverse(name, args=args) if args else reverse(name)
            print(f"OK {name} -> {url}")
        except Exception as e:
            print(f"ERR {name} -> {e}")


if __name__ == '__main__':
    main()