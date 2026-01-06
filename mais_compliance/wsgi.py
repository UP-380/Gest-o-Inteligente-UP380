"""
WSGI config for mais_compliance project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mais_compliance.settings')

application = get_wsgi_application()

