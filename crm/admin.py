from django.contrib import admin
from .models import Pessoa


@admin.register(Pessoa)
class PessoaAdmin(admin.ModelAdmin):
    list_display = [
        'nome', 'tipo', 'email', 'telefone', 'bairro', 
        'consentiu_contato', 'criado_em'
    ]
    list_filter = [
        'tipo', 'consentiu_contato', 'gabinete', 'criado_em'
    ]
    search_fields = [
        'nome', 'email', 'telefone', 'cpf', 'bairro', 'tags'
    ]
    readonly_fields = ['criado_em', 'atualizado_em']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('gabinete', 'nome', 'tipo', 'cpf')
        }),
        ('Contato', {
            'fields': ('email', 'telefone', 'bairro', 'zona_eleitoral')
        }),
        ('LGPD', {
            'fields': ('consentiu_contato', 'consentido_em')
        }),
        ('Informações Adicionais', {
            'fields': ('origem', 'tags', 'observacoes')
        }),
        ('Metadados', {
            'fields': ('criado_por', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Se é uma nova pessoa
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)


