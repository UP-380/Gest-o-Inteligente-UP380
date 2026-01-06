from django.urls import path
from . import views

app_name = 'atendimento'

urlpatterns = [
    path('', views.AtendimentoListView.as_view(), name='atendimento_list'),
    path('novo/', views.AtendimentoCreateView.as_view(), name='atendimento_create'),
    path('<int:pk>/', views.AtendimentoDetailView.as_view(), name='atendimento_detail'),
    path('<int:pk>/editar/', views.AtendimentoUpdateView.as_view(), name='atendimento_update'),
    path('<int:pk>/status/', views.AtendimentoStatusUpdateView.as_view(), name='atendimento_status'),
]









