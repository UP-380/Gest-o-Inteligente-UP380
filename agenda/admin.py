from django.contrib import admin
from .models import Evento


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = [
        'titulo', 'tipo', 'status', 'inicio', 'fim', 'local', 'criado_em'
    ]
    list_filter = [
        'gabinete', 'tipo', 'status', 'prioridade', 'is_publico', 'inicio', 'criado_em'
    ]
    search_fields = [
        'titulo', 'descricao', 'local'
    ]
    readonly_fields = ['criado_em', 'atualizado_em']
    filter_horizontal = ['participantes_pessoas', 'participantes_equipe']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'titulo', 'descricao', 'tipo', 'categoria', 'status', 'prioridade')
        }),
        ('Data e Hora', {
            'fields': ('inicio', 'fim', 'dia_inteiro')
        }),
        ('Local', {
            'fields': ('local', 'endereco_completo', 'link')
        }),
        ('Participantes', {
            'fields': ('organizador', 'participantes_pessoas', 'participantes_equipe', 'numero_participantes_esperado')
        }),
        ('Configurações', {
            'fields': ('lembrete_minutos', 'enviar_convite', 'is_publico', 'is_recorrente', 'recorrencia_tipo')
        }),
        ('Rastreabilidade', {
            'fields': ('atendimento_origem',)
        }),
        ('Resultados', {
            'fields': ('ata', 'decisoes', 'proximos_passos'),
            'classes': ('collapse',)
        }),
        ('Observações', {
            'fields': ('observacoes', 'requisitos_especiais'),
            'classes': ('collapse',)
        }),
        ('Metadados', {
            'fields': ('criado_por', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Se é um novo evento
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)
