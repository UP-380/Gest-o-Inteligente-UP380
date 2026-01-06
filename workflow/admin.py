from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    TipoWorkflow, EtapaWorkflow, ProcessoWorkflow, 
    ExecucaoEtapa, RegrasAutomacao, HistoricoWorkflow
)


@admin.register(TipoWorkflow)
class TipoWorkflowAdmin(admin.ModelAdmin):
    list_display = ['nome', 'tipo', 'prazo_padrao_dias', 'ativo', 'auto_atribuir', 'criado_em']
    list_filter = ['tipo', 'ativo', 'auto_atribuir', 'criado_em']
    search_fields = ['nome', 'descricao']
    ordering = ['nome']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'tipo', 'descricao', 'ativo', 'prazo_padrao_dias')
        }),
        ('Configurações de Automação', {
            'fields': ('auto_atribuir', 'notificar_prazo', 'dias_alerta_prazo'),
            'classes': ('collapse',)
        }),
    )


class EtapaWorkflowInline(admin.TabularInline):
    model = EtapaWorkflow
    extra = 1
    fields = ['ordem', 'nome', 'prazo_dias', 'obrigatoria', 'auto_iniciar', 'requer_aprovacao']
    ordering = ['ordem']


@admin.register(EtapaWorkflow)
class EtapaWorkflowAdmin(admin.ModelAdmin):
    list_display = ['nome', 'tipo_workflow', 'ordem', 'prazo_dias', 'obrigatoria', 'auto_iniciar']
    list_filter = ['tipo_workflow', 'obrigatoria', 'auto_iniciar', 'requer_aprovacao']
    search_fields = ['nome', 'descricao', 'tipo_workflow__nome']
    ordering = ['tipo_workflow', 'ordem']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('tipo_workflow', 'nome', 'descricao', 'ordem', 'obrigatoria', 'prazo_dias')
        }),
        ('Responsabilidade', {
            'fields': ('papel_responsavel', 'usuario_responsavel')
        }),
        ('Automação', {
            'fields': ('auto_iniciar', 'requer_aprovacao'),
            'classes': ('collapse',)
        }),
    )


class ExecucaoEtapaInline(admin.TabularInline):
    model = ExecucaoEtapa
    extra = 0
    readonly_fields = ['etapa', 'status', 'prazo', 'data_inicio', 'data_conclusao']
    fields = ['etapa', 'status', 'responsavel', 'prazo', 'data_inicio', 'data_conclusao']
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ProcessoWorkflow)
class ProcessoWorkflowAdmin(admin.ModelAdmin):
    list_display = [
        'titulo', 'tipo_workflow', 'status', 'prioridade', 
        'percentual_conclusao_display', 'prazo_final', 'responsavel_atual', 
        'em_atraso_display'
    ]
    list_filter = [
        'status', 'prioridade', 'tipo_workflow', 'gabinete', 
        'criado_em', 'prazo_final'
    ]
    search_fields = ['titulo', 'descricao', 'responsavel_atual__username']
    ordering = ['-criado_em']
    readonly_fields = [
        'percentual_conclusao', 'dias_restantes', 'em_atraso', 
        'tempo_total_horas', 'etapas_concluidas', 'etapas_total'
    ]
    
    inlines = [ExecucaoEtapaInline]
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'tipo_workflow', 'titulo', 'descricao', 'status', 'prioridade')
        }),
        ('Relacionamentos', {
            'fields': ('atendimento', 'oficio', 'memorando', 'evento'),
            'classes': ('collapse',)
        }),
        ('Responsabilidade', {
            'fields': ('responsavel_atual', 'criado_por')
        }),
        ('Prazos', {
            'fields': ('prazo_final', 'data_inicio', 'data_conclusao')
        }),
        ('Métricas', {
            'fields': (
                'percentual_conclusao', 'dias_restantes', 'em_atraso',
                'tempo_total_horas', 'etapas_concluidas', 'etapas_total'
            ),
            'classes': ('collapse',)
        }),
    )
    
    def percentual_conclusao_display(self, obj):
        percentual = obj.percentual_conclusao
        if percentual == 100:
            color = 'green'
        elif percentual >= 70:
            color = 'orange'
        elif percentual >= 40:
            color = 'blue'
        else:
            color = 'red'
        
        return format_html(
            '<span style="color: {}; font-weight: bold;">{:.1f}%</span>',
            color, percentual
        )
    percentual_conclusao_display.short_description = 'Conclusão'
    percentual_conclusao_display.admin_order_field = 'etapas_concluidas'
    
    def em_atraso_display(self, obj):
        if obj.em_atraso:
            return format_html('<span style="color: red; font-weight: bold;">SIM</span>')
        return format_html('<span style="color: green;">NÃO</span>')
    em_atraso_display.short_description = 'Em Atraso'
    em_atraso_display.boolean = True
    
    actions = ['marcar_como_concluido', 'marcar_como_cancelado', 'recalcular_metricas']
    
    def marcar_como_concluido(self, request, queryset):
        count = 0
        for processo in queryset:
            if processo.status not in ['CONCLUIDO', 'CANCELADO']:
                processo.status = 'CONCLUIDO'
                processo.data_conclusao = timezone.now()
                processo.save()
                count += 1
        
        self.message_user(request, f'{count} processos marcados como concluídos.')
    marcar_como_concluido.short_description = 'Marcar como concluído'
    
    def marcar_como_cancelado(self, request, queryset):
        count = queryset.exclude(status__in=['CONCLUIDO', 'CANCELADO']).update(status='CANCELADO')
        self.message_user(request, f'{count} processos cancelados.')
    marcar_como_cancelado.short_description = 'Cancelar processos'
    
    def recalcular_metricas(self, request, queryset):
        count = 0
        for processo in queryset:
            processo.calcular_metricas()
            count += 1
        
        self.message_user(request, f'Métricas recalculadas para {count} processos.')
    recalcular_metricas.short_description = 'Recalcular métricas'


@admin.register(ExecucaoEtapa)
class ExecucaoEtapaAdmin(admin.ModelAdmin):
    list_display = [
        'processo', 'etapa', 'status', 'responsavel', 
        'prazo', 'em_atraso_display', 'tempo_execucao_horas'
    ]
    list_filter = ['status', 'etapa__tipo_workflow', 'prazo', 'criado_em']
    search_fields = [
        'processo__titulo', 'etapa__nome', 'responsavel__username',
        'observacoes', 'resultado'
    ]
    ordering = ['-criado_em']
    readonly_fields = ['em_atraso', 'tempo_execucao_horas']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('processo', 'etapa', 'status', 'responsavel')
        }),
        ('Prazos', {
            'fields': ('prazo', 'data_inicio', 'data_conclusao', 'em_atraso', 'tempo_execucao_horas')
        }),
        ('Detalhes', {
            'fields': ('observacoes', 'resultado', 'arquivos'),
            'classes': ('collapse',)
        }),
        ('Aprovação', {
            'fields': ('aprovado_por', 'data_aprovacao'),
            'classes': ('collapse',)
        }),
    )
    
    def em_atraso_display(self, obj):
        if obj.em_atraso:
            return format_html('<span style="color: red; font-weight: bold;">SIM</span>')
        return format_html('<span style="color: green;">NÃO</span>')
    em_atraso_display.short_description = 'Em Atraso'
    em_atraso_display.boolean = True
    
    actions = ['iniciar_etapas', 'concluir_etapas']
    
    def iniciar_etapas(self, request, queryset):
        count = 0
        for execucao in queryset.filter(status='PENDENTE'):
            execucao.iniciar(request.user)
            count += 1
        
        self.message_user(request, f'{count} etapas iniciadas.')
    iniciar_etapas.short_description = 'Iniciar etapas selecionadas'
    
    def concluir_etapas(self, request, queryset):
        count = 0
        for execucao in queryset.filter(status='EM_ANDAMENTO'):
            execucao.concluir(usuario=request.user)
            count += 1
        
        self.message_user(request, f'{count} etapas concluídas.')
    concluir_etapas.short_description = 'Concluir etapas selecionadas'


@admin.register(RegrasAutomacao)
class RegrasAutomacaoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'gabinete', 'condicao_tipo', 'acao_tipo', 'ativa', 'criado_em']
    list_filter = ['ativa', 'condicao_tipo', 'acao_tipo', 'gabinete', 'criado_em']
    search_fields = ['nome', 'descricao', 'condicao_valor', 'acao_valor']
    ordering = ['nome']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'nome', 'descricao', 'ativa')
        }),
        ('Condições', {
            'fields': ('condicao_tipo', 'condicao_operador', 'condicao_valor')
        }),
        ('Ações', {
            'fields': ('acao_tipo', 'acao_valor', 'tipo_workflow_alvo', 'usuario_alvo')
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        # Filtrar por gabinete do usuário se não for superuser
        return qs.filter(gabinete__usuarios=request.user)


class HistoricoWorkflowInline(admin.TabularInline):
    model = HistoricoWorkflow
    extra = 0
    readonly_fields = ['usuario', 'acao', 'descricao', 'criado_em']
    fields = ['usuario', 'acao', 'descricao', 'criado_em']
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(HistoricoWorkflow)
class HistoricoWorkflowAdmin(admin.ModelAdmin):
    list_display = ['processo', 'usuario', 'acao', 'criado_em']
    list_filter = ['acao', 'usuario', 'criado_em']
    search_fields = ['processo__titulo', 'usuario__username', 'acao', 'descricao']
    ordering = ['-criado_em']
    readonly_fields = ['processo', 'usuario', 'acao', 'descricao', 'dados_anteriores', 'dados_novos', 'criado_em']
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


# Customização do admin site
admin.site.site_header = "+Compliance - Gestão de Workflow Parlamentar"
admin.site.site_title = "+Compliance Admin"
admin.site.index_title = "Painel Administrativo do Sistema de Workflow"