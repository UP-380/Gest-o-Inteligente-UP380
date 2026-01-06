from django.contrib import admin
from .models import Publicacao, SolicitacaoPublica, AgendamentoVisita


@admin.register(Publicacao)
class PublicacaoAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'tipo', 'gabinete', 'status', 'publico', 'destaque', 'data_publicacao', 'visualizacoes']
    list_filter = ['tipo', 'status', 'publico', 'destaque', 'gabinete']
    search_fields = ['titulo', 'conteudo']
    date_hierarchy = 'data_publicacao'
    readonly_fields = ['visualizacoes', 'criado_em', 'atualizado_em']


@admin.register(SolicitacaoPublica)
class SolicitacaoPublicaAdmin(admin.ModelAdmin):
    list_display = ['protocolo_publico', 'nome_solicitante', 'tipo_solicitacao', 'status', 'gabinete', 'criado_em']
    list_filter = ['status', 'gabinete', 'tipo_solicitacao']
    search_fields = ['protocolo_publico', 'nome_solicitante', 'cpf', 'email', 'descricao']
    readonly_fields = ['protocolo_publico', 'criado_em', 'atualizado_em', 'atendimento_gerado']


@admin.register(AgendamentoVisita)
class AgendamentoVisitaAdmin(admin.ModelAdmin):
    list_display = ['protocolo', 'nome', 'motivo', 'data_desejada', 'status', 'gabinete', 'criado_em']
    list_filter = ['status', 'gabinete', 'data_desejada']
    search_fields = ['protocolo', 'nome', 'cpf', 'email', 'motivo']
    readonly_fields = ['protocolo', 'criado_em', 'atualizado_em', 'evento_criado']


