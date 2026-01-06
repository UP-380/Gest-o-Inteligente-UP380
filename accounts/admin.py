from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Gabinete


@admin.register(Gabinete)
class GabineteAdmin(admin.ModelAdmin):
    list_display = ['nome', 'parlamentar_nome', 'cargo', 'municipio', 'ativo', 'criado_em']
    list_filter = ['cargo', 'esfera', 'ativo', 'criado_em']
    search_fields = ['nome', 'parlamentar_nome', 'email', 'municipio']
    readonly_fields = ['criado_em', 'atualizado_em']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'get_full_name', 'papel', 'gabinete', 'ativo', 'is_staff']
    list_filter = ['papel', 'gabinete', 'ativo', 'is_staff', 'is_superuser']
    search_fields = ['email', 'first_name', 'last_name', 'username']
    ordering = ['email']
    
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Informações Pessoais', {'fields': ('first_name', 'last_name', 'telefone')}),
        ('Permissões', {'fields': ('papel', 'gabinete', 'ativo', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Datas Importantes', {'fields': ('last_login', 'date_joined', 'criado_em', 'atualizado_em')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'first_name', 'last_name', 'papel', 'gabinete', 'password1', 'password2'),
        }),
    )
    
    readonly_fields = ['criado_em', 'atualizado_em', 'date_joined', 'last_login']

