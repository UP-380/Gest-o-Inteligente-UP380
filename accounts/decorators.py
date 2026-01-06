"""
Decoradores para controle de permissões
"""
from functools import wraps
from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect


def require_role(*roles):
    """
    Decorator que exige papel específico do usuário
    
    Uso:
        @require_role('CHEFE', 'ADMIN', 'PARLAMENTAR')
        def minha_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        @login_required
        def _wrapped_view(request, *args, **kwargs):
            if request.user.papel not in roles:
                raise PermissionDenied("Você não tem permissão para acessar esta página.")
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def require_permission(module, action):
    """
    Decorator que verifica permissão específica baseado na matriz
    
    Uso:
        @require_permission('atendimento', 'delete')
        def deletar_atendimento(request, pk):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        @login_required
        def _wrapped_view(request, *args, **kwargs):
            from accounts.permissions import user_has_permission
            
            if not user_has_permission(request.user, module, action):
                raise PermissionDenied(f"Você não tem permissão para {action} em {module}.")
            
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def admin_or_chefe_required(view_func):
    """
    Decorator simplificado para views que só Admin ou Chefe podem acessar
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        if request.user.papel not in ['ADMIN', 'CHEFE', 'PARLAMENTAR']:
            raise PermissionDenied("Apenas administradores, chefes ou parlamentares podem acessar.")
        return view_func(request, *args, **kwargs)
    return _wrapped_view


