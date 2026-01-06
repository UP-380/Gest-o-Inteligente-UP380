from rest_framework import serializers
from crm.models import Pessoa
from atendimento.models import Atendimento
from documentos.models import Oficio, Memorando
from agenda.models import Evento


class PessoaSerializer(serializers.ModelSerializer):
    """Serializer para o model Pessoa"""
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    tags_list = serializers.ListField(source='get_tags_list', read_only=True)
    
    class Meta:
        model = Pessoa
        fields = [
            'id', 'nome', 'tipo', 'tipo_display', 'cpf', 'email', 
            'telefone', 'bairro', 'zona_eleitoral', 'consentiu_contato',
            'consentido_em', 'origem', 'tags', 'tags_list', 'observacoes',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['id', 'criado_em', 'atualizado_em']


class AtendimentoSerializer(serializers.ModelSerializer):
    """Serializer para o model Atendimento"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    prioridade_display = serializers.CharField(source='get_prioridade_display', read_only=True)
    satisfacao_display = serializers.CharField(source='get_satisfacao_display', read_only=True)
    pessoa_nome = serializers.CharField(source='pessoa.nome', read_only=True)
    responsavel_nome = serializers.CharField(source='responsavel.get_full_name', read_only=True)
    atrasado = serializers.BooleanField(read_only=True)
    dias_para_prazo = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Atendimento
        fields = [
            'id', 'protocolo', 'pessoa', 'pessoa_nome', 'assunto', 'descricao',
            'status', 'status_display', 'prioridade', 'prioridade_display',
            'origem', 'responsavel', 'responsavel_nome', 'prazo', 'satisfacao',
            'satisfacao_display', 'observacoes', 'atrasado', 'dias_para_prazo',
            'criado_em', 'atualizado_em', 'resolvido_em'
        ]
        read_only_fields = [
            'id', 'protocolo', 'criado_em', 'atualizado_em', 'resolvido_em'
        ]


class OficioSerializer(serializers.ModelSerializer):
    """Serializer para o model Oficio"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    destinatario_nome = serializers.CharField(source='destinatario.nome', read_only=True)
    criado_por_nome = serializers.CharField(source='criado_por.get_full_name', read_only=True)
    pode_editar = serializers.BooleanField(read_only=True)
    pode_assinado = serializers.BooleanField(read_only=True)
    pode_enviar = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Oficio
        fields = [
            'id', 'numero', 'data', 'assunto', 'corpo', 'destinatario',
            'destinatario_nome', 'status', 'status_display', 'arquivo',
            'observacoes', 'pode_editar', 'pode_assinado', 'pode_enviar',
            'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em',
            'criado_por', 'criado_por_nome'
        ]
        read_only_fields = [
            'id', 'numero', 'criado_em', 'atualizado_em', 
            'assinado_em', 'enviado_em'
        ]


class MemorandoSerializer(serializers.ModelSerializer):
    """Serializer para o model Memorando"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    destinatario_nome = serializers.CharField(source='destinatario.nome', read_only=True)
    criado_por_nome = serializers.CharField(source='criado_por.get_full_name', read_only=True)
    pode_editar = serializers.BooleanField(read_only=True)
    pode_assinado = serializers.BooleanField(read_only=True)
    pode_enviar = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Memorando
        fields = [
            'id', 'numero', 'data', 'assunto', 'corpo', 'destinatario',
            'destinatario_nome', 'status', 'status_display', 'arquivo',
            'observacoes', 'pode_editar', 'pode_assinado', 'pode_enviar',
            'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em',
            'criado_por', 'criado_por_nome'
        ]
        read_only_fields = [
            'id', 'numero', 'criado_em', 'atualizado_em', 
            'assinado_em', 'enviado_em'
        ]


class EventoSerializer(serializers.ModelSerializer):
    """Serializer para o model Evento"""
    status = serializers.CharField(read_only=True)
    duracao = serializers.FloatField(read_only=True)
    ja_aconteceu = serializers.BooleanField(read_only=True)
    esta_acontecendo = serializers.BooleanField(read_only=True)
    vai_acontecer = serializers.BooleanField(read_only=True)
    dias_para_evento = serializers.IntegerField(read_only=True)
    participantes_nomes = serializers.StringRelatedField(
        source='participantes', many=True, read_only=True
    )
    criado_por_nome = serializers.CharField(source='criado_por.get_full_name', read_only=True)
    
    class Meta:
        model = Evento
        fields = [
            'id', 'titulo', 'descricao', 'inicio', 'fim', 'local',
            'participantes', 'participantes_nomes', 'observacoes',
            'status', 'duracao', 'ja_aconteceu', 'esta_acontecendo',
            'vai_acontecer', 'dias_para_evento', 'criado_em',
            'atualizado_em', 'criado_por', 'criado_por_nome'
        ]
        read_only_fields = [
            'id', 'criado_em', 'atualizado_em'
        ]









