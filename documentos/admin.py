from django.contrib import admin
from .models import Destinatario, TipoOrgao, Oficio, Memorando, Requerimento, Indicacao


@admin.register(TipoOrgao)
class TipoOrgaoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'ordem', 'ativo', 'criado_em']
    list_filter = ['ativo']
    search_fields = ['nome', 'descricao']
    readonly_fields = ['criado_em', 'atualizado_em']
    ordering = ['ordem', 'nome']


@admin.register(Destinatario)
class DestinatarioAdmin(admin.ModelAdmin):
    list_display = ['nome', 'cargo', 'orgao', 'tipo_orgao', 'nivel_administrativo', 'municipio', 'ativo', 'criado_em']
    list_filter = ['ativo', 'tipo_orgao', 'nivel_administrativo', 'criado_em']
    search_fields = ['nome', 'cargo', 'orgao', 'email', 'municipio']
    readonly_fields = ['criado_em', 'atualizado_em']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'cargo', 'orgao')
        }),
        ('Classificação', {
            'fields': ('tipo_orgao', 'nivel_administrativo')
        }),
        ('Contato', {
            'fields': ('email', 'telefone')
        }),
        ('Localização', {
            'fields': ('municipio', 'uf', 'endereco')
        }),
        ('Observações', {
            'fields': ('observacoes', 'ativo')
        }),
        ('Metadados', {
            'fields': ('criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Oficio)
class OficioAdmin(admin.ModelAdmin):
    list_display = [
        'numero', 'assunto', 'destinatario', 'status', 'data', 'criado_em'
    ]
    list_filter = ['status', 'gabinete', 'data', 'criado_em']
    search_fields = ['numero', 'assunto', 'destinatario__nome']
    readonly_fields = [
        'numero', 'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em'
    ]
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'numero', 'data', 'assunto', 'destinatario')
        }),
        ('Conteúdo', {
            'fields': ('corpo', 'arquivo', 'observacoes')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Metadados', {
            'fields': ('criado_por', 'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Se é um novo ofício
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)


@admin.register(Memorando)
class MemorandoAdmin(admin.ModelAdmin):
    list_display = [
        'numero', 'assunto', 'destinatario', 'status', 'data', 'criado_em'
    ]
    list_filter = ['status', 'gabinete', 'data', 'criado_em']
    search_fields = ['numero', 'assunto', 'destinatario__nome']
    readonly_fields = [
        'numero', 'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em'
    ]
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'numero', 'data', 'assunto', 'destinatario')
        }),
        ('Conteúdo', {
            'fields': ('corpo', 'arquivo', 'observacoes')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Metadados', {
            'fields': ('criado_por', 'criado_em', 'atualizado_em', 'assinado_em', 'enviado_em'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Se é um novo memorando
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)






