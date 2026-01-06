from django.urls import path
from . import views

app_name = 'workflow'

urlpatterns = [
    # Dashboard
    path('', views.dashboard_workflow, name='dashboard'),
    
    # Processos
    path('processos/', views.listar_processos, name='listar_processos'),
    path('processos/criar/', views.criar_processo, name='criar_processo'),
    path('processos/<int:processo_id>/', views.detalhar_processo, name='detalhar_processo'),
    path('processos/<int:processo_id>/editar/', views.editar_processo, name='editar_processo'),
    path('processos/<int:processo_id>/cancelar/', views.cancelar_processo, name='cancelar_processo'),
    
    # Etapas
    path('etapas/<int:etapa_id>/executar/', views.executar_etapa, name='executar_etapa'),
    
    # Tarefas do usuário
    path('minhas-tarefas/', views.minhas_tarefas, name='minhas_tarefas'),
    
    # Tarefas/Kanban
    path('tarefas/', views.lista_tarefas, name='lista_tarefas'),
    path('tarefas/kanban/', views.kanban_tarefas, name='kanban_tarefas'),
    path('tarefas/criar/', views.criar_tarefa, name='criar_tarefa'),
    path('tarefas/<int:tarefa_id>/', views.detalhe_tarefa, name='detalhe_tarefa'),
    path('tarefas/<int:tarefa_id>/editar/', views.editar_tarefa, name='editar_tarefa'),
    path('tarefas/<int:tarefa_id>/deletar/', views.deletar_tarefa, name='deletar_tarefa'),
    path('tarefas/<int:tarefa_id>/iniciar/', views.iniciar_tarefa, name='iniciar_tarefa'),
    path('tarefas/<int:tarefa_id>/concluir/', views.concluir_tarefa, name='concluir_tarefa'),
    path('tarefas/<int:tarefa_id>/cancelar/', views.cancelar_tarefa, name='cancelar_tarefa'),
    
    # Relatórios
    path('relatorios/', views.relatorios_workflow, name='relatorios'),
    
    # APIs
    path('api/processos-chart/', views.api_processos_chart, name='api_processos_chart'),
]