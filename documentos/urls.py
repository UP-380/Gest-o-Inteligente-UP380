from django.urls import path
from . import views

app_name = 'documentos'

urlpatterns = [
    # Ofícios
    path('oficios/', views.OficioListView.as_view(), name='oficio_list'),
    path('oficios/novo/', views.OficioCreateView.as_view(), name='oficio_create'),
    path('oficios/<int:pk>/', views.OficioDetailView.as_view(), name='oficio_detail'),
    path('oficios/<int:pk>/editar/', views.OficioUpdateView.as_view(), name='oficio_update'),
    path('oficios/<int:pk>/status/', views.OficioStatusUpdateView.as_view(), name='oficio_status'),
    
    # Memorandos
    path('memorandos/', views.MemorandoListView.as_view(), name='memorando_list'),
    path('memorandos/novo/', views.MemorandoCreateView.as_view(), name='memorando_create'),
    path('memorandos/<int:pk>/', views.MemorandoDetailView.as_view(), name='memorando_detail'),
    path('memorandos/<int:pk>/editar/', views.MemorandoUpdateView.as_view(), name='memorando_update'),
    path('memorandos/<int:pk>/status/', views.MemorandoStatusUpdateView.as_view(), name='memorando_status'),
    
    # Destinatários Padrões
    path('destinatarios/', views.DestinatarioListView.as_view(), name='destinatario_list'),
    path('destinatarios/novo/', views.DestinatarioCreateView.as_view(), name='destinatario_create'),
    path('destinatarios/<int:pk>/editar/', views.DestinatarioUpdateView.as_view(), name='destinatario_update'),
    path('destinatarios/<int:pk>/deletar/', views.DestinatarioDeleteView.as_view(), name='destinatario_delete'),
    
    # Tipos de Órgão
    path('tipos-orgao/', views.TipoOrgaoListView.as_view(), name='tipo_orgao_list'),
    path('tipos-orgao/novo/', views.TipoOrgaoCreateView.as_view(), name='tipo_orgao_create'),
    path('tipos-orgao/<int:pk>/editar/', views.TipoOrgaoUpdateView.as_view(), name='tipo_orgao_update'),
    path('tipos-orgao/<int:pk>/deletar/', views.TipoOrgaoDeleteView.as_view(), name='tipo_orgao_delete'),
    
    # Requerimentos - NOVO
    path('requerimentos/', views.RequerimentoListView.as_view(), name='requerimento_list'),
    path('requerimentos/novo/', views.RequerimentoCreateView.as_view(), name='requerimento_create'),
    path('requerimentos/<int:pk>/', views.RequerimentoDetailView.as_view(), name='requerimento_detail'),
    path('requerimentos/<int:pk>/editar/', views.RequerimentoUpdateView.as_view(), name='requerimento_update'),
    path('requerimentos/<int:pk>/status/', views.RequerimentoStatusUpdateView.as_view(), name='requerimento_status'),
    
    # Indicações - NOVO
    path('indicacoes/', views.IndicacaoListView.as_view(), name='indicacao_list'),
    path('indicacoes/novo/', views.IndicacaoCreateView.as_view(), name='indicacao_create'),
    path('indicacoes/<int:pk>/', views.IndicacaoDetailView.as_view(), name='indicacao_detail'),
    path('indicacoes/<int:pk>/editar/', views.IndicacaoUpdateView.as_view(), name='indicacao_update'),
    path('indicacoes/<int:pk>/status/', views.IndicacaoStatusUpdateView.as_view(), name='indicacao_status'),
]



