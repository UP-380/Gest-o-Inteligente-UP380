from django.apps import AppConfig


class WorkflowConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'workflow'
    verbose_name = 'Workflow e Tarefas'

    def ready(self):
        import workflow.signals  # Importa os signals quando o app estiver pronto