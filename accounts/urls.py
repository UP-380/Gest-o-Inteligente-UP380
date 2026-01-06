from django.urls import path
from django.contrib.auth.views import LoginView, LogoutView
from . import views

app_name = 'accounts'

urlpatterns = [
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.CustomLogoutView.as_view(), name='logout'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    
    # Assuntos/Categorias
    path('assuntos/', views.AssuntoListView.as_view(), name='assunto_list'),
    path('assuntos/novo/', views.AssuntoCreateView.as_view(), name='assunto_create'),
    path('assuntos/<int:pk>/editar/', views.AssuntoUpdateView.as_view(), name='assunto_update'),
    path('assuntos/<int:pk>/deletar/', views.AssuntoDeleteView.as_view(), name='assunto_delete'),
    
    # Modelos de Documento
    path('modelos/', views.ModeloDocumentoListView.as_view(), name='modelo_list'),
    path('modelos/novo/', views.ModeloDocumentoCreateView.as_view(), name='modelo_create'),
    path('modelos/<int:pk>/editar/', views.ModeloDocumentoUpdateView.as_view(), name='modelo_update'),
    path('modelos/<int:pk>/deletar/', views.ModeloDocumentoDeleteView.as_view(), name='modelo_delete'),
    
    # Justificativas Padrão
    path('justificativas-padrao/', views.JustificativaPadraoListView.as_view(), name='justificativa_padrao_list'),
    path('justificativas-padrao/novo/', views.JustificativaPadraoCreateView.as_view(), name='justificativa_padrao_create'),
    path('justificativas-padrao/<int:pk>/', views.JustificativaPadraoDetailView.as_view(), name='justificativa_padrao_detail'),
    path('justificativas-padrao/<int:pk>/editar/', views.JustificativaPadraoUpdateView.as_view(), name='justificativa_padrao_update'),
    path('justificativas-padrao/<int:pk>/deletar/', views.JustificativaPadraoDeleteView.as_view(), name='justificativa_padrao_delete'),
    
    # Solicitações Padrão
    path('solicitacoes-padrao/', views.SolicitacaoPadraoListView.as_view(), name='solicitacao_padrao_list'),
    path('solicitacoes-padrao/novo/', views.SolicitacaoPadraoCreateView.as_view(), name='solicitacao_padrao_create'),
    path('solicitacoes-padrao/<int:pk>/', views.SolicitacaoPadraoDetailView.as_view(), name='solicitacao_padrao_detail'),
    path('solicitacoes-padrao/<int:pk>/editar/', views.SolicitacaoPadraoUpdateView.as_view(), name='solicitacao_padrao_update'),
    path('solicitacoes-padrao/<int:pk>/deletar/', views.SolicitacaoPadraoDeleteView.as_view(), name='solicitacao_padrao_delete'),
]

