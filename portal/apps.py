from django.apps import AppConfig


class PortalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'portal'
    verbose_name = 'Portal do Cidadão'

    def ready(self):
        import portal.signals  # Importa os signals quando o app estiver pronto


