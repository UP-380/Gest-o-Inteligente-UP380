"""
Matriz de permissões por papel/função
"""

# Matriz de permissões: {PAPEL: {modulo: [ações]}}
PERMISSIONS_MATRIX = {
    'PARLAMENTAR': {
        'atendimento': ['view', 'add', 'change', 'delete', 'export'],
        'documento': ['view', 'add', 'change', 'delete', 'sign', 'approve', 'export'],
        'pessoa': ['view', 'add', 'change', 'delete', 'export'],
        'agenda': ['view', 'add', 'change', 'delete'],
        'tarefa': ['view', 'add', 'change', 'delete'],
        'workflow': ['view', 'add', 'change', 'delete'],
        'portal': ['view', 'add', 'change', 'delete', 'approve'],
        'auditoria': ['view', 'export'],
        'relatorio': ['view', 'export'],
        'configuracao': ['view', 'change'],
    },
    
    'CHEFE': {
        'atendimento': ['view', 'add', 'change', 'export'],
        'documento': ['view', 'add', 'change', 'approve', 'export'],
        'pessoa': ['view', 'add', 'change', 'export'],
        'agenda': ['view', 'add', 'change'],
        'tarefa': ['view', 'add', 'change'],
        'workflow': ['view', 'add', 'change'],
        'portal': ['view', 'add', 'change', 'approve'],
        'auditoria': ['view', 'export'],
        'relatorio': ['view', 'export'],
        'configuracao': ['view', 'change'],
    },
    
    'ATENDIMENTO': {
        'atendimento': ['view', 'add', 'change'],
        'pessoa': ['view', 'add', 'change'],
        'agenda': ['view', 'add'],
        'tarefa': ['view', 'add', 'change'],
        'workflow': ['view'],
        'portal': ['view'],
        'documento': ['view'],
        'relatorio': ['view'],
    },
    
    'JURIDICO': {
        'atendimento': ['view', 'change'],
        'documento': ['view', 'add', 'change', 'approve', 'export'],
        'pessoa': ['view', 'change'],
        'agenda': ['view'],
        'tarefa': ['view', 'change'],
        'workflow': ['view', 'change'],
        'portal': ['view', 'change'],
        'relatorio': ['view', 'export'],
    },
    
    'COMUNICACAO': {
        'atendimento': ['view'],
        'documento': ['view'],
        'pessoa': ['view', 'export'],
        'agenda': ['view'],
        'tarefa': ['view'],
        'portal': ['view', 'add', 'change', 'approve'],
        'relatorio': ['view', 'export'],
    },
    
    'FINANCEIRO': {
        'atendimento': ['view'],
        'documento': ['view', 'export'],
        'pessoa': ['view', 'export'],
        'agenda': ['view'],
        'tarefa': ['view'],
        'relatorio': ['view', 'export'],
        'auditoria': ['view', 'export'],
    },
    
    'ADMIN': {
        'atendimento': ['view', 'add', 'change', 'delete', 'export'],
        'documento': ['view', 'add', 'change', 'delete', 'sign', 'approve', 'export'],
        'pessoa': ['view', 'add', 'change', 'delete', 'export'],
        'agenda': ['view', 'add', 'change', 'delete', 'export'],
        'tarefa': ['view', 'add', 'change', 'delete', 'export'],
        'workflow': ['view', 'add', 'change', 'delete', 'export'],
        'portal': ['view', 'add', 'change', 'delete', 'approve', 'export'],
        'auditoria': ['view', 'export'],
        'relatorio': ['view', 'export'],
        'configuracao': ['view', 'add', 'change', 'delete'],
        'usuario': ['view', 'add', 'change', 'delete'],
    },
}


def user_has_permission(user, module, action):
    """
    Verifica se usuário tem permissão para ação em módulo específico
    
    Args:
        user: User instance
        module: str - Nome do módulo (ex: 'atendimento', 'documento')
        action: str - Ação desejada (ex: 'view', 'add', 'change', 'delete')
    
    Returns:
        bool - True se tem permissão, False caso contrário
    """
    if not user.is_authenticated:
        return False
    
    # Pega permissões do papel do usuário
    permissions = PERMISSIONS_MATRIX.get(user.papel, {})
    
    # Pega ações permitidas para o módulo
    module_permissions = permissions.get(module, [])
    
    # Verifica se a ação está na lista
    return action in module_permissions


def get_user_modules(user):
    """
    Retorna lista de módulos que o usuário tem acesso
    
    Args:
        user: User instance
    
    Returns:
        list - Lista de nomes de módulos
    """
    if not user.is_authenticated:
        return []
    
    permissions = PERMISSIONS_MATRIX.get(user.papel, {})
    return list(permissions.keys())


def get_user_actions(user, module):
    """
    Retorna lista de ações que o usuário pode fazer em um módulo
    
    Args:
        user: User instance
        module: str - Nome do módulo
    
    Returns:
        list - Lista de ações permitidas
    """
    if not user.is_authenticated:
        return []
    
    permissions = PERMISSIONS_MATRIX.get(user.papel, {})
    return permissions.get(module, [])


def user_can_view(user, module):
    """Helper: verifica se usuário pode visualizar módulo"""
    return user_has_permission(user, module, 'view')


def user_can_add(user, module):
    """Helper: verifica se usuário pode adicionar no módulo"""
    return user_has_permission(user, module, 'add')


def user_can_change(user, module):
    """Helper: verifica se usuário pode alterar no módulo"""
    return user_has_permission(user, module, 'change')


def user_can_delete(user, module):
    """Helper: verifica se usuário pode excluir no módulo"""
    return user_has_permission(user, module, 'delete')


def user_can_export(user, module):
    """Helper: verifica se usuário pode exportar do módulo"""
    return user_has_permission(user, module, 'export')


def user_can_approve(user, module):
    """Helper: verifica se usuário pode aprovar no módulo"""
    return user_has_permission(user, module, 'approve')


def user_can_sign(user, module):
    """Helper: verifica se usuário pode assinar documentos"""
    return user_has_permission(user, module, 'sign')


