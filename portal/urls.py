from django.urls import path
from . import views

app_name = 'portal'

urlpatterns = [
    # ==================== URLs PÚBLICAS (COM SLUG DO GABINETE) ====================
    path('<slug:slug>/', views.portal_index, name='index'),
    path('<slug:slug>/noticias/', views.noticias_lista, name='noticias'),
    path('<slug:slug>/noticias/<int:pk>/', views.noticia_detalhe, name='noticia_detalhe'),
    path('<slug:slug>/solicitar/', views.solicitar_atendimento, name='solicitar'),
    path('<slug:slug>/consultar/', views.consultar_protocolo, name='consultar'),
    path('<slug:slug>/agendar-visita/', views.agendar_visita, name='agendar_visita'),
    path('<slug:slug>/sucesso/<str:protocolo>/', views.sucesso_solicitacao, name='sucesso_solicitacao'),
    
    # ==================== URLs ADMINISTRATIVAS ====================
    path('admin-portal/', views.portal_admin_dashboard, name='portal_admin_dashboard'),
    
    # Publicações
    path('admin-portal/publicacoes/', views.publicacoes_lista, name='publicacoes_lista'),
    path('admin-portal/publicacoes/nova/', views.publicacao_form, name='publicacao_nova'),
    path('admin-portal/publicacoes/<int:pk>/editar/', views.publicacao_form, name='publicacao_editar'),
    path('admin-portal/publicacoes/<int:pk>/publicar/', views.publicar_publicacao, name='publicar_publicacao'),
    path('admin-portal/publicacoes/<int:pk>/excluir/', views.excluir_publicacao, name='excluir_publicacao'),
    
    # Solicitações Públicas
    path('admin-portal/solicitacoes/', views.solicitacoes_admin, name='solicitacoes_admin'),
    path('admin-portal/solicitacoes/<int:pk>/responder/', views.responder_solicitacao, name='responder_solicitacao'),
    
    # Agendamentos de Visitas
    path('admin-portal/visitas/', views.visitas_admin, name='visitas_admin'),
    path('admin-portal/visitas/<int:pk>/confirmar/', views.confirmar_visita, name='confirmar_visita'),
]
