from django.urls import path
from . import views

app_name = 'crm'

urlpatterns = [
    path('', views.PessoaListView.as_view(), name='pessoa_list'),
    path('nova/', views.PessoaCreateView.as_view(), name='pessoa_create'),
    path('<int:pk>/', views.PessoaDetailView.as_view(), name='pessoa_detail'),
    path('<int:pk>/editar/', views.PessoaUpdateView.as_view(), name='pessoa_update'),
]


