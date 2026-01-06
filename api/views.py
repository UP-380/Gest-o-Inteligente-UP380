from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from crm.models import Pessoa
from atendimento.models import Atendimento
from documentos.models import Oficio, Memorando
from agenda.models import Evento
from .serializers import (
    PessoaSerializer, AtendimentoSerializer, 
    OficioSerializer, MemorandoSerializer, EventoSerializer
)


class PessoaViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listagem e busca de pessoas"""
    serializer_class = PessoaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nome', 'email', 'telefone', 'cpf', 'bairro', 'tags']
    filterset_fields = ['tipo', 'consentiu_contato', 'bairro']
    ordering_fields = ['nome', 'criado_em']
    ordering = ['nome']

    def get_queryset(self):
        """Filtrar pessoas apenas do gabinete do usuário"""
        if hasattr(self.request.user, 'gabinete'):
            return Pessoa.objects.filter(gabinete=self.request.user.gabinete)
        return Pessoa.objects.none()

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Busca avançada de pessoas"""
        query = request.query_params.get('q', '')
        if query:
            pessoas = self.get_queryset().filter(
                Q(nome__icontains=query) |
                Q(email__icontains=query) |
                Q(telefone__icontains=query) |
                Q(cpf__icontains=query) |
                Q(bairro__icontains=query) |
                Q(tags__icontains=query)
            )
        else:
            pessoas = self.get_queryset()
        
        serializer = self.get_serializer(pessoas, many=True)
        return Response(serializer.data)


class AtendimentoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listagem e busca de atendimentos"""
    serializer_class = AtendimentoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['protocolo', 'assunto', 'descricao', 'pessoa__nome']
    filterset_fields = ['status', 'prioridade', 'responsavel', 'pessoa']
    ordering_fields = ['criado_em', 'prazo', 'prioridade']
    ordering = ['-criado_em']

    def get_queryset(self):
        """Filtrar atendimentos apenas do gabinete do usuário"""
        if hasattr(self.request.user, 'gabinete'):
            return Atendimento.objects.filter(gabinete=self.request.user.gabinete)
        return Atendimento.objects.none()

    @action(detail=False, methods=['get'])
    def abertos(self, request):
        """Lista atendimentos abertos"""
        atendimentos = self.get_queryset().filter(
            status__in=['ABERTO', 'ANDAMENTO']
        )
        serializer = self.get_serializer(atendimentos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def atrasados(self, request):
        """Lista atendimentos atrasados"""
        from django.utils import timezone
        atendimentos = self.get_queryset().filter(
            prazo__lt=timezone.now().date(),
            status__in=['ABERTO', 'ANDAMENTO']
        )
        serializer = self.get_serializer(atendimentos, many=True)
        return Response(serializer.data)


class OficioViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listagem e busca de ofícios"""
    serializer_class = OficioSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'assunto', 'corpo', 'destinatario__nome']
    filterset_fields = ['status', 'destinatario', 'data']
    ordering_fields = ['criado_em', 'data', 'numero']
    ordering = ['-criado_em']

    def get_queryset(self):
        """Filtrar ofícios apenas do gabinete do usuário"""
        if hasattr(self.request.user, 'gabinete'):
            return Oficio.objects.filter(gabinete=self.request.user.gabinete)
        return Oficio.objects.none()

    @action(detail=False, methods=['get'])
    def rascunhos(self, request):
        """Lista ofícios em rascunho"""
        oficios = self.get_queryset().filter(status='RASCUNHO')
        serializer = self.get_serializer(oficios, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def enviados(self, request):
        """Lista ofícios enviados"""
        oficios = self.get_queryset().filter(status='ENVIADO')
        serializer = self.get_serializer(oficios, many=True)
        return Response(serializer.data)


class MemorandoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listagem e busca de memorandos"""
    serializer_class = MemorandoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'assunto', 'corpo', 'destinatario__nome']
    filterset_fields = ['status', 'destinatario', 'data']
    ordering_fields = ['criado_em', 'data', 'numero']
    ordering = ['-criado_em']

    def get_queryset(self):
        """Filtrar memorandos apenas do gabinete do usuário"""
        if hasattr(self.request.user, 'gabinete'):
            return Memorando.objects.filter(gabinete=self.request.user.gabinete)
        return Memorando.objects.none()


class EventoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para listagem e busca de eventos"""
    serializer_class = EventoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'descricao', 'local']
    filterset_fields = ['local']
    ordering_fields = ['inicio', 'titulo']
    ordering = ['inicio']

    def get_queryset(self):
        """Filtrar eventos apenas do gabinete do usuário"""
        if hasattr(self.request.user, 'gabinete'):
            return Evento.objects.filter(gabinete=self.request.user.gabinete)
        return Evento.objects.none()

    @action(detail=False, methods=['get'])
    def proximos(self, request):
        """Lista próximos eventos (7 dias)"""
        from django.utils import timezone
        from datetime import timedelta
        
        agora = timezone.now()
        proximos_7_dias = agora + timedelta(days=7)
        
        eventos = self.get_queryset().filter(
            inicio__gte=agora,
            inicio__lte=proximos_7_dias
        )
        serializer = self.get_serializer(eventos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def hoje(self, request):
        """Lista eventos de hoje"""
        from django.utils import timezone
        
        hoje = timezone.now().date()
        eventos = self.get_queryset().filter(
            inicio__date=hoje
        )
        serializer = self.get_serializer(eventos, many=True)
        return Response(serializer.data)









