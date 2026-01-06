"""
ASGI config for mais_compliance project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')

application = get_asgi_application()

