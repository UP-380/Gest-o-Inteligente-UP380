"""
Signals para automação do Portal do Cidadão
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from portal.models import SolicitacaoPublica, AgendamentoVisita
from crm.models import Pessoa
from atendimento.models import Atendimento
from agenda.models import Evento
from django.utils import timezone
from .email import (
    enviar_email_solicitacao,
    enviar_email_agendamento,
    enviar_email_resposta_solicitacao,
    enviar_email_confirmacao_visita
)


@receiver(post_save, sender=SolicitacaoPublica)
def criar_atendimento_automatico(sender, instance, created, **kwargs):
    """
    Cria atendimento e pessoa automaticamente quando chega solicitação do portal
    """
    if created and not instance.atendimento_gerado:
        try:
            # 1. Buscar ou criar pessoa no CRM
            pessoa = None
            
            if instance.cpf:
                # Tenta buscar por CPF
                pessoa = Pessoa.objects.filter(
                    gabinete=instance.gabinete,
                    cpf=instance.cpf
                ).first()
            
            if not pessoa and instance.email:
                # Tenta buscar por e-mail
                pessoa = Pessoa.objects.filter(
                    gabinete=instance.gabinete,
                    email=instance.email
                ).first()
            
            # Se não encontrou, cria nova pessoa
            if not pessoa:
                pessoa = Pessoa.objects.create(
                    gabinete=instance.gabinete,
                    nome=instance.nome_solicitante,
                    cpf=instance.cpf if instance.cpf else '',
                    email=instance.email,
                    telefone=instance.telefone,
                    bairro=instance.bairro,
                    origem='Portal do Cidadão',
                    consentiu_contato=instance.consentimento_lgpd,
                    consentido_em=timezone.now() if instance.consentimento_lgpd else None,
                    tipo='ELEITOR',
                )
                
                # Vincula a pessoa criada
                instance.pessoa_criada = pessoa
            
            # 2. Criar atendimento
            atendimento = Atendimento.objects.create(
                gabinete=instance.gabinete,
                pessoa=pessoa,
                assunto=instance.assunto,
                descricao=f"[SOLICITAÇÃO DO PORTAL PÚBLICO]\n\n{instance.descricao}\n\n---\nProtocolo Público: {instance.protocolo_publico}",
                origem='PORTAL',
                origem_detalhes=f'Protocolo Público: {instance.protocolo_publico}',
                status='ABERTO',
                prioridade=2,  # Normal
                municipio=instance.municipio,
                bairro=instance.bairro,
                tipo_solicitante='CIDADAO',
            )
            
            # 3. Vincular atendimento à solicitação
            instance.atendimento_gerado = atendimento
            instance.status = 'ATENDIMENTO_CRIADO'
            instance.save()
            
            print(f"✅ Atendimento {atendimento.protocolo} criado automaticamente da solicitação {instance.protocolo_publico}")
            
            # ✅ Enviar email de confirmação para o cidadão
            enviar_email_solicitacao(instance)
            
        except Exception as e:
            print(f"❌ Erro ao criar atendimento automático: {e}")


@receiver(post_save, sender=AgendamentoVisita)
def criar_evento_automatico(sender, instance, created, **kwargs):
    """
    Cria evento na agenda quando agendamento de visita é confirmado
    """
    if not created and instance.status == 'CONFIRMADO' and not instance.evento_criado and instance.data_confirmada:
        try:
            # Buscar ou criar pessoa
            pessoa = None
            if instance.cpf:
                pessoa = Pessoa.objects.filter(
                    gabinete=instance.gabinete,
                    cpf=instance.cpf
                ).first()
            
            if not pessoa:
                pessoa = Pessoa.objects.create(
                    gabinete=instance.gabinete,
                    nome=instance.nome,
                    cpf=instance.cpf if instance.cpf else '',
                    email=instance.email,
                    telefone=instance.telefone,
                    origem='Portal do Cidadão - Agendamento de Visita',
                    consentiu_contato=instance.consentimento_lgpd,
                    tipo='ELEITOR',
                )
            
            # Criar evento
            # Define fim como 1 hora depois do início
            data_fim = instance.data_confirmada + timezone.timedelta(hours=1)
            
            evento = Evento.objects.create(
                gabinete=instance.gabinete,
                titulo=f"Visita: {instance.nome}",
                descricao=f"{instance.motivo}\n\n{instance.descricao}\n\n---\nProtocolo: {instance.protocolo}",
                tipo='ATENDIMENTO',
                inicio=instance.data_confirmada,
                fim=data_fim,
                local='Gabinete',
                status='CONFIRMADO',
                prioridade=2,
                organizador=instance.confirmado_por,
                criado_por=instance.confirmado_por,
            )
            
            # Adicionar pessoa como participante
            evento.participantes_pessoas.add(pessoa)
            
            # Vincular evento ao agendamento
            instance.evento_criado = evento
            instance.save()
            
            print(f"✅ Evento criado automaticamente do agendamento {instance.protocolo}")
            
            # ✅ Enviar email de confirmação de visita para o cidadão
            enviar_email_confirmacao_visita(instance)
            
        except Exception as e:
            print(f"❌ Erro ao criar evento automático: {e}")


@receiver(post_save, sender=AgendamentoVisita)
def enviar_email_agendamento_criado(sender, instance, created, **kwargs):
    """
    Envia email quando agendamento é criado (recebido)
    """
    if created:
        try:
            # Enviar email de confirmação de recebimento
            enviar_email_agendamento(instance)
        except Exception as e:
            print(f"❌ Erro ao enviar email de agendamento: {e}")


