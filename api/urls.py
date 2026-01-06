from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'pessoas', views.PessoaViewSet, basename='pessoa')
router.register(r'atendimentos', views.AtendimentoViewSet, basename='atendimento')
router.register(r'oficios', views.OficioViewSet, basename='oficio')
router.register(r'memorandos', views.MemorandoViewSet, basename='memorando')
router.register(r'eventos', views.EventoViewSet, basename='evento')

urlpatterns = [
    path('', include(router.urls)),
]
