from django.urls import path
from . import views

app_name = 'agenda'
urlpatterns = [
    path('', views.AgendaCalendarioView.as_view(), name='calendario'),
    path('eventos/', views.EventoList.as_view(), name='lista'),
    path('eventos/novo/', views.EventoCreate.as_view(), name='novo'),
    path('eventos/<int:pk>/editar/', views.EventoUpdate.as_view(), name='editar'),
    path('api/eventos/', views.eventos_json, name='api_eventos'),
]
