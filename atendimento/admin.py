from django.contrib import admin
from .models import Atendimento, Sequencia


@admin.register(Sequencia)
class SequenciaAdmin(admin.ModelAdmin):
    list_display = ['gabinete', 'ano', 'tipo', 'numero', 'atualizado_em']
    list_filter = ['gabinete', 'ano', 'tipo']
    readonly_fields = ['atualizado_em']


@admin.register(Atendimento)
class AtendimentoAdmin(admin.ModelAdmin):
    list_display = [
        'protocolo', 'pessoa', 'assunto', 'status', 'prioridade', 
        'responsavel', 'prazo', 'criado_em'
    ]
    list_filter = [
        'status', 'prioridade', 'gabinete', 'responsavel', 'criado_em'
    ]
    search_fields = [
        'protocolo', 'assunto', 'descricao', 'pessoa__nome'
    ]
    readonly_fields = ['protocolo', 'criado_em', 'atualizado_em', 'resolvido_em']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'protocolo', 'pessoa', 'assunto', 'descricao')
        }),
        ('Status e Prioridade', {
            'fields': ('status', 'prioridade', 'origem', 'responsavel', 'prazo')
        }),
        ('Avaliação', {
            'fields': ('satisfacao', 'observacoes')
        }),
        ('Metadados', {
            'fields': ('criado_por', 'criado_em', 'atualizado_em', 'resolvido_em'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Se é um novo atendimento
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)









