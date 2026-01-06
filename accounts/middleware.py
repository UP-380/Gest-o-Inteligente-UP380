"""
Middleware para auditoria automática
"""
from django.utils.deprecation import MiddlewareMixin


class AuditoriaMiddleware(MiddlewareMixin):
    """
    Middleware que captura informações de auditoria em cada request
    e disponibiliza para uso posterior nos views
    """
    
    def process_request(self, request):
        """
        Captura IP e User Agent no início do request
        """
        # Captura IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        
        # Armazena no request para uso posterior
        request.audit_ip = ip
        request.audit_user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        return None
    
    def process_response(self, request, response):
        """
        Cria log se houver dados de auditoria pendentes no request
        """
        # Se o view marcou algo para ser logado, cria o log
        if hasattr(request, '_audit_log'):
            from accounts.models import LogAuditoria
            try:
                LogAuditoria.objects.create(**request._audit_log)
            except Exception as e:
                print(f"❌ Erro ao criar log de auditoria: {e}")
        
        return response


