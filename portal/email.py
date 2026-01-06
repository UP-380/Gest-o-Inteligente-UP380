"""
Funções para envio de emails do Portal do Cidadão
"""
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def enviar_email_solicitacao(solicitacao):
    """
    Envia email de confirmação para o cidadão quando ele envia uma solicitação
    """
    try:
        # Assunto do email
        assunto = f'Confirmação de Solicitação - Protocolo {solicitacao.protocolo_publico}'
        
        # Contexto para o template
        contexto = {
            'nome': solicitacao.nome_solicitante,
            'protocolo': solicitacao.protocolo_publico,
            'tipo': solicitacao.tipo_solicitacao,
            'data': solicitacao.criado_em.strftime('%d/%m/%Y às %H:%M'),
            'gabinete': solicitacao.gabinete,
            'sla_horas': solicitacao.gabinete.sla_resposta_solicitacoes,
            'url_consulta': f'/portal/{solicitacao.gabinete.slug}/consultar/?protocolo={solicitacao.protocolo_publico}',
        }
        
        # Mensagem em texto puro
        mensagem_texto = f"""
Olá, {solicitacao.nome_solicitante}!

Sua solicitação foi recebida com sucesso!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROTOCOLO: {solicitacao.protocolo_publico}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tipo de Solicitação: {solicitacao.tipo_solicitacao}
Data de Envio: {solicitacao.criado_em.strftime('%d/%m/%Y às %H:%M')}

IMPORTANTE: Guarde este número de protocolo para consultar o andamento da sua solicitação.

Nossa equipe analisará sua solicitação e responderá em até {solicitacao.gabinete.sla_resposta_solicitacoes} horas úteis.

Você pode consultar o andamento a qualquer momento em:
{contexto['url_consulta']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atenciosamente,
{solicitacao.gabinete.parlamentar_nome}
{solicitacao.gabinete.get_cargo_display()}

{solicitacao.gabinete.email}
{solicitacao.gabinete.telefone}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este é um email automático. Seus dados estão protegidos pela LGPD.
"""
        
        # Enviar email
        send_mail(
            subject=assunto,
            message=mensagem_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[solicitacao.email],
            fail_silently=False,
        )
        
        print(f'✅ Email de solicitação enviado para: {solicitacao.email}')
        return True
        
    except Exception as e:
        print(f'❌ Erro ao enviar email de solicitação: {e}')
        return False


def enviar_email_agendamento(agendamento):
    """
    Envia email de confirmação para o cidadão quando ele agenda uma visita
    """
    try:
        # Assunto do email
        assunto = f'Confirmação de Agendamento - Protocolo {agendamento.protocolo}'
        
        # Mensagem em texto puro
        mensagem_texto = f"""
Olá, {agendamento.nome}!

Sua solicitação de agendamento de visita foi recebida com sucesso!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROTOCOLO: {agendamento.protocolo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Motivo: {agendamento.motivo}
Data Desejada: {agendamento.data_desejada.strftime('%d/%m/%Y')}
Horário de Preferência: {agendamento.get_horario_preferencia_display()}

IMPORTANTE: Guarde este número de protocolo.

Aguarde a confirmação da data e horário. Entraremos em contato em até {agendamento.gabinete.sla_resposta_visitas} horas úteis.

Você pode consultar o status do seu agendamento em:
/portal/{agendamento.gabinete.slug}/consultar/?protocolo={agendamento.protocolo}

HORÁRIOS DE ATENDIMENTO:
{agendamento.gabinete.horario_funcionamento}

IMPORTANTE: Ao comparecer, traga um documento de identificação com foto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atenciosamente,
{agendamento.gabinete.parlamentar_nome}
{agendamento.gabinete.get_cargo_display()}

{agendamento.gabinete.email}
{agendamento.gabinete.telefone}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este é um email automático. Seus dados estão protegidos pela LGPD.
"""
        
        # Enviar email
        send_mail(
            subject=assunto,
            message=mensagem_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[agendamento.email],
            fail_silently=False,
        )
        
        print(f'✅ Email de agendamento enviado para: {agendamento.email}')
        return True
        
    except Exception as e:
        print(f'❌ Erro ao enviar email de agendamento: {e}')
        return False


def enviar_email_resposta_solicitacao(solicitacao):
    """
    Envia email para o cidadão quando o gabinete responde sua solicitação
    """
    try:
        # Assunto do email
        assunto = f'Resposta da sua Solicitação - Protocolo {solicitacao.protocolo_publico}'
        
        # Mensagem em texto puro
        mensagem_texto = f"""
Olá, {solicitacao.nome_solicitante}!

Sua solicitação foi respondida pelo gabinete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROTOCOLO: {solicitacao.protocolo_publico}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: {solicitacao.get_status_display()}
Data da Resposta: {solicitacao.data_resposta.strftime('%d/%m/%Y às %H:%M') if solicitacao.data_resposta else 'N/A'}

RESPOSTA DO GABINETE:

{solicitacao.resposta_texto if solicitacao.resposta_texto else 'Sua solicitação foi processada.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para mais informações, entre em contato conosco:
{solicitacao.gabinete.email}
{solicitacao.gabinete.telefone}

Você pode consultar os detalhes completos em:
/portal/{solicitacao.gabinete.slug}/consultar/?protocolo={solicitacao.protocolo_publico}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atenciosamente,
{solicitacao.gabinete.parlamentar_nome}
{solicitacao.gabinete.get_cargo_display()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este é um email automático. Seus dados estão protegidos pela LGPD.
"""
        
        # Enviar email
        send_mail(
            subject=assunto,
            message=mensagem_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[solicitacao.email],
            fail_silently=False,
        )
        
        print(f'✅ Email de resposta enviado para: {solicitacao.email}')
        return True
        
    except Exception as e:
        print(f'❌ Erro ao enviar email de resposta: {e}')
        return False


def enviar_email_confirmacao_visita(agendamento):
    """
    Envia email para o cidadão quando o gabinete confirma o agendamento de visita
    """
    try:
        # Assunto do email
        assunto = f'Visita Confirmada - Protocolo {agendamento.protocolo}'
        
        # Mensagem em texto puro
        mensagem_texto = f"""
Olá, {agendamento.nome}!

Sua visita ao gabinete foi CONFIRMADA!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROTOCOLO: {agendamento.protocolo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STATUS: CONFIRMADO

Data e Horário: {agendamento.data_confirmada.strftime('%d/%m/%Y às %H:%M') if agendamento.data_confirmada else 'A confirmar'}
Motivo: {agendamento.motivo}

LOCAL DO ATENDIMENTO:
{agendamento.gabinete.endereco}
{agendamento.gabinete.municipio}/{agendamento.gabinete.estado}
{f'CEP: {agendamento.gabinete.cep}' if agendamento.gabinete.cep else ''}

IMPORTANTE:
• Compareça com 10 minutos de antecedência
• Traga documento de identificação com foto
• Em caso de imprevistos, entre em contato:
  {agendamento.gabinete.telefone}
  {agendamento.gabinete.email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atenciosamente,
{agendamento.gabinete.parlamentar_nome}
{agendamento.gabinete.get_cargo_display()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Este é um email automático. Seus dados estão protegidos pela LGPD.
"""
        
        # Enviar email
        send_mail(
            subject=assunto,
            message=mensagem_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[agendamento.email],
            fail_silently=False,
        )
        
        print(f'✅ Email de confirmação de visita enviado para: {agendamento.email}')
        return True
        
    except Exception as e:
        print(f'❌ Erro ao enviar email de confirmação de visita: {e}')
        return False


