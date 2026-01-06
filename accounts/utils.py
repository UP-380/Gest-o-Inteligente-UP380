"""
Utilitários para auditoria e notificações
"""
from django.core.mail import send_mail
from django.conf import settings
from accounts.models import LogAuditoria, Notificacao


def criar_log_auditoria(request, acao, modulo, objeto, descricao, dados_anteriores=None, dados_novos=None, critico=False):
    """
    Helper para criar logs de auditoria
    
    Args:
        request: HttpRequest object
        acao: str - Ação realizada (CREATE, UPDATE, DELETE, etc)
        modulo: str - Módulo do sistema (atendimento, documento, etc)
        objeto: Model instance - Objeto afetado
        descricao: str - Descrição detalhada da ação
        dados_anteriores: dict - Estado anterior do objeto
        dados_novos: dict - Novo estado do objeto
        critico: bool - Se é uma ação crítica
    
    Returns:
        LogAuditoria instance
    """
    if not request.user.is_authenticated:
        return None
    
    # Captura IP
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    
    # Cria log
    log = LogAuditoria.objects.create(
        usuario=request.user,
        ip_address=ip,
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        acao=acao,
        modulo=modulo,
        objeto_tipo=type(objeto).__name__,
        objeto_id=objeto.pk,
        objeto_repr=str(objeto),
        descricao=descricao,
        dados_anteriores=dados_anteriores,
        dados_novos=dados_novos,
        critico=critico,
        gabinete=request.user.gabinete,
    )
    
    return log


def enviar_notificacao(usuario, tipo, titulo, mensagem, link='', enviar_email=False):
    """
    Cria notificação interna e opcionalmente envia e-mail
    
    Args:
        usuario: User instance - Destinatário
        tipo: str - Tipo da notificação (INFO, ALERTA, URGENTE, SUCESSO, ERRO)
        titulo: str - Título da notificação
        mensagem: str - Mensagem detalhada
        link: str - URL interna para ação
        enviar_email: bool - Se deve enviar e-mail também
    
    Returns:
        Notificacao instance
    """
    # Cria notificação interna
    notif = Notificacao.objects.create(
        usuario=usuario,
        tipo=tipo,
        titulo=titulo,
        mensagem=mensagem,
        link=link,
    )
    
    # Envia e-mail se solicitado
    if enviar_email and usuario.email:
        try:
            send_mail(
                subject=f'[+Compliance] {titulo}',
                message=mensagem,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[usuario.email],
                fail_silently=True,
            )
            notif.enviado_email = True
            notif.save()
        except Exception as e:
            print(f"❌ Erro ao enviar e-mail: {e}")
    
    return notif


def enviar_notificacao_grupo(usuarios, tipo, titulo, mensagem, link='', enviar_email=False):
    """
    Envia notificação para múltiplos usuários
    
    Args:
        usuarios: QuerySet ou lista de User instances
        tipo: str - Tipo da notificação
        titulo: str - Título
        mensagem: str - Mensagem
        link: str - URL interna
        enviar_email: bool - Se deve enviar e-mail
    
    Returns:
        list de Notificacao instances criadas
    """
    notificacoes = []
    
    for usuario in usuarios:
        notif = enviar_notificacao(
            usuario=usuario,
            tipo=tipo,
            titulo=titulo,
            mensagem=mensagem,
            link=link,
            enviar_email=enviar_email
        )
        notificacoes.append(notif)
    
    return notificacoes


def notificar_tarefa_atrasada(tarefa):
    """
    Notifica responsável sobre tarefa atrasada
    """
    if tarefa.responsavel and tarefa.atrasada:
        return enviar_notificacao(
            usuario=tarefa.responsavel,
            tipo='ALERTA',
            titulo=f'Tarefa atrasada: {tarefa.titulo}',
            mensagem=f'A tarefa "{tarefa.titulo}" está atrasada. Prazo era {tarefa.prazo.strftime("%d/%m/%Y")}.',
            link=f'/workflow/tarefa/{tarefa.id}/',
            enviar_email=True
        )
    return None


def notificar_atendimento_pendente(atendimento):
    """
    Notifica responsável sobre atendimento pendente
    """
    if atendimento.responsavel:
        return enviar_notificacao(
            usuario=atendimento.responsavel,
            tipo='INFO',
            titulo=f'Novo atendimento: {atendimento.protocolo}',
            mensagem=f'Você foi atribuído ao atendimento {atendimento.protocolo} - {atendimento.assunto}',
            link=f'/atendimento/atendimento/{atendimento.id}/',
            enviar_email=False
        )
    return None


def notificar_documento_para_assinatura(documento):
    """
    Notifica sobre documento aguardando assinatura
    """
    if hasattr(documento, 'assinado_por') and documento.assinado_por:
        return enviar_notificacao(
            usuario=documento.assinado_por,
            tipo='ALERTA',
            titulo=f'Documento aguardando assinatura',
            mensagem=f'O documento {documento.numero} - {documento.assunto} está aguardando sua assinatura.',
            link=f'/documentos/{type(documento).__name__.lower()}/{documento.id}/',
            enviar_email=True
        )
    return None


