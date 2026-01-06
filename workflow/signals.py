"""
Signals para automação de tarefas
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from atendimento.models import Atendimento
from documentos.models import Oficio, Memorando, Requerimento, Indicacao
from agenda.models import Evento
from workflow.models import Tarefa
from django.utils import timezone


@receiver(post_save, sender=Atendimento)
def criar_tarefa_atendimento(sender, instance, created, **kwargs):
    """
    Cria tarefa automaticamente quando atendimento é criado
    """
    if created:
        # Verifica se já não tem tarefa para este atendimento
        tarefa_existente = Tarefa.objects.filter(atendimento=instance).exists()
        
        if not tarefa_existente:
            try:
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Atender: {instance.assunto}",
                    descricao=f"Protocolo: {instance.protocolo}\nSolicitante: {instance.pessoa.nome}\n\n{instance.descricao[:200]}...",
                    tipo='ATENDIMENTO',
                    responsavel=instance.responsavel if instance.responsavel else instance.criado_por,
                    prioridade=instance.prioridade,
                    atendimento=instance,
                    prazo=instance.prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                )
                print(f"✅ Tarefa criada automaticamente para atendimento {instance.protocolo}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de atendimento: {e}")


@receiver(post_save, sender=Oficio)
def criar_tarefa_oficio(sender, instance, created, **kwargs):
    """
    Cria tarefa automaticamente quando ofício é criado
    """
    if created:
        # Verifica se já não tem tarefa para este ofício
        tarefa_existente = Tarefa.objects.filter(tipo='DOCUMENTO').filter(
            observacoes__icontains=instance.numero
        ).exists()
        
        if not tarefa_existente:
            try:
                # Define prazo baseado na data do ofício (7 dias para elaborar)
                prazo = timezone.now() + timezone.timedelta(days=7)
                
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Elaborar e enviar ofício: {instance.assunto}",
                    descricao=f"Ofício nº {instance.numero}\nDestinatário: {instance.destinatario}\n\nAssunto: {instance.assunto}",
                    tipo='DOCUMENTO',
                    responsavel=instance.responsavel if instance.responsavel else instance.criado_por,
                    prioridade=instance.prioridade,
                    prazo=prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                    observacoes=f"Ofício: {instance.numero}",
                )
                print(f"✅ Tarefa criada automaticamente para ofício {instance.numero}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de ofício: {e}")


@receiver(post_save, sender=Memorando)
def criar_tarefa_memorando(sender, instance, created, **kwargs):
    """
    Cria tarefa automaticamente quando memorando é criado
    """
    if created:
        tarefa_existente = Tarefa.objects.filter(tipo='DOCUMENTO').filter(
            observacoes__icontains=instance.numero
        ).exists()
        
        if not tarefa_existente:
            try:
                prazo = timezone.now() + timezone.timedelta(days=5)
                
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Elaborar memorando: {instance.assunto}",
                    descricao=f"Memorando nº {instance.numero}\nDestinatário: {instance.destinatario}\n\nAssunto: {instance.assunto}",
                    tipo='DOCUMENTO',
                    responsavel=instance.responsavel if instance.responsavel else instance.criado_por,
                    prioridade=instance.prioridade,
                    prazo=prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                    observacoes=f"Memorando: {instance.numero}",
                )
                print(f"✅ Tarefa criada automaticamente para memorando {instance.numero}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de memorando: {e}")


@receiver(post_save, sender=Requerimento)
def criar_tarefa_requerimento(sender, instance, created, **kwargs):
    """
    Cria tarefa automaticamente quando requerimento é criado
    """
    if created:
        tarefa_existente = Tarefa.objects.filter(tipo='DOCUMENTO').filter(
            observacoes__icontains=instance.numero
        ).exists()
        
        if not tarefa_existente:
            try:
                # Define prazo baseado no prazo_resposta_dias do requerimento
                if instance.prazo_resposta_dias:
                    prazo = timezone.now() + timezone.timedelta(days=instance.prazo_resposta_dias)
                else:
                    prazo = timezone.now() + timezone.timedelta(days=15)
                
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Acompanhar requerimento: {instance.assunto}",
                    descricao=f"Requerimento nº {instance.numero}\nTipo: {instance.get_tipo_requerimento_display()}\nDestinatário: {instance.destinatario}\n\nAssunto: {instance.assunto}",
                    tipo='DOCUMENTO',
                    responsavel=instance.responsavel if instance.responsavel else instance.criado_por,
                    prioridade=instance.prioridade,
                    prazo=prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                    observacoes=f"Requerimento: {instance.numero}",
                )
                print(f"✅ Tarefa criada automaticamente para requerimento {instance.numero}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de requerimento: {e}")


@receiver(post_save, sender=Indicacao)
def criar_tarefa_indicacao(sender, instance, created, **kwargs):
    """
    Cria tarefa automaticamente quando indicação é criada
    """
    if created:
        tarefa_existente = Tarefa.objects.filter(tipo='DOCUMENTO').filter(
            observacoes__icontains=instance.numero
        ).exists()
        
        if not tarefa_existente:
            try:
                prazo = timezone.now() + timezone.timedelta(days=30)
                
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Acompanhar indicação: {instance.assunto}",
                    descricao=f"Indicação nº {instance.numero}\nTipo: {instance.get_tipo_indicacao_display()}\nDestinatário: {instance.destinatario}\n\nAssunto: {instance.assunto}\nLocal: {instance.municipio} - {instance.bairro}",
                    tipo='DOCUMENTO',
                    responsavel=instance.responsavel if instance.responsavel else instance.criado_por,
                    prioridade=instance.prioridade,
                    prazo=prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                    observacoes=f"Indicação: {instance.numero}",
                )
                print(f"✅ Tarefa criada automaticamente para indicação {instance.numero}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de indicação: {e}")


@receiver(post_save, sender=Evento)
def criar_tarefa_evento(sender, instance, created, **kwargs):
    """
    Cria tarefa de preparação para evento
    """
    if created and instance.vai_acontecer:
        # Verifica se já não tem tarefa para este evento
        tarefa_existente = Tarefa.objects.filter(evento=instance).exists()
        
        if not tarefa_existente:
            try:
                # Define prazo como 1 dia antes do evento
                prazo = instance.inicio - timezone.timedelta(days=1)
                
                # Se o prazo já passou, usa o próprio início do evento
                if prazo < timezone.now():
                    prazo = instance.inicio
                
                Tarefa.objects.create(
                    gabinete=instance.gabinete,
                    titulo=f"Preparar evento: {instance.titulo}",
                    descricao=f"Tipo: {instance.get_tipo_display()}\nData: {instance.inicio.strftime('%d/%m/%Y às %H:%M')}\nLocal: {instance.local}\n\n{instance.descricao}",
                    tipo='EVENTO',
                    responsavel=instance.organizador if instance.organizador else instance.criado_por,
                    prioridade=instance.prioridade,
                    evento=instance,
                    prazo=prazo,
                    categoria=instance.categoria,
                    status='PENDENTE',
                )
                print(f"✅ Tarefa criada automaticamente para evento: {instance.titulo}")
            except Exception as e:
                print(f"❌ Erro ao criar tarefa de evento: {e}")


@receiver(post_save, sender=Evento)
def evento_gera_atendimento(sender, instance, created, **kwargs):
    """
    Se evento for de determinados tipos, gera atendimentos para os participantes
    """
    TIPOS_QUE_GERAM_ATENDIMENTO = [
        'AUDIENCIA_PRIVADA',
        'ATENDIMENTO',
        'REUNIAO_COMUNIDADE',
        'REUNIAO_ENTIDADE',
    ]
    
    if created and instance.tipo in TIPOS_QUE_GERAM_ATENDIMENTO:
        try:
            # Para cada participante pessoa, criar atendimento
            for pessoa in instance.participantes_pessoas.all():
                # Verifica se já não tem atendimento deste evento para esta pessoa
                atendimento_existente = Atendimento.objects.filter(
                    evento_origem=instance,
                    pessoa=pessoa
                ).exists()
                
                if not atendimento_existente:
                    Atendimento.objects.create(
                        gabinete=instance.gabinete,
                        pessoa=pessoa,
                        assunto=instance.titulo,
                        descricao=f"Atendimento gerado automaticamente do evento: {instance.titulo}\n\nTipo: {instance.get_tipo_display()}\nData: {instance.inicio.strftime('%d/%m/%Y às %H:%M')}\nLocal: {instance.local}\n\n{instance.descricao}",
                        origem='REUNIAO',
                        evento_origem=instance,
                        categoria=instance.categoria,
                        responsavel=instance.organizador,
                        criado_por=instance.criado_por,
                        status='ABERTO',
                        prioridade=2,
                    )
                    print(f"✅ Atendimento criado automaticamente para {pessoa.nome} do evento {instance.titulo}")
        except Exception as e:
            print(f"❌ Erro ao criar atendimento de evento: {e}")


# Atualização de status automática
@receiver(post_save, sender=Oficio)
def atualizar_tarefa_quando_oficio_enviado(sender, instance, **kwargs):
    """
    Quando ofício é enviado, marca tarefa relacionada como concluída
    """
    if instance.status == 'ENVIADO':
        try:
            # Busca tarefas relacionadas a este ofício
            tarefas = Tarefa.objects.filter(
                tipo='DOCUMENTO',
                observacoes__icontains=instance.numero,
                status__in=['PENDENTE', 'EM_ANDAMENTO']
            )
            
            for tarefa in tarefas:
                tarefa.status = 'CONCLUIDA'
                tarefa.resultado = f"Ofício {instance.numero} enviado em {instance.enviado_em.strftime('%d/%m/%Y às %H:%M')}"
                tarefa.data_conclusao = timezone.now()
                tarefa.save()
                print(f"✅ Tarefa {tarefa.id} concluída automaticamente (ofício enviado)")
        except Exception as e:
            print(f"❌ Erro ao atualizar tarefa de ofício: {e}")


@receiver(post_save, sender=Atendimento)
def atualizar_tarefa_quando_atendimento_resolvido(sender, instance, **kwargs):
    """
    Quando atendimento é resolvido, marca tarefa relacionada como concluída
    """
    if instance.status == 'RESOLVIDO':
        try:
            tarefas = Tarefa.objects.filter(
                atendimento=instance,
                status__in=['PENDENTE', 'EM_ANDAMENTO']
            )
            
            for tarefa in tarefas:
                tarefa.status = 'CONCLUIDA'
                tarefa.resultado = f"Atendimento {instance.protocolo} resolvido em {instance.resolvido_em.strftime('%d/%m/%Y') if instance.resolvido_em else 'data não disponível'}"
                tarefa.data_conclusao = timezone.now()
                tarefa.concluido_por = instance.resolvido_por
                tarefa.save()
                print(f"✅ Tarefa {tarefa.id} concluída automaticamente (atendimento resolvido)")
        except Exception as e:
            print(f"❌ Erro ao atualizar tarefa de atendimento: {e}")


@receiver(post_save, sender=Evento)
def atualizar_tarefa_quando_evento_realizado(sender, instance, **kwargs):
    """
    Quando evento é realizado, marca tarefa relacionada como concluída
    """
    if instance.status == 'REALIZADO':
        try:
            tarefas = Tarefa.objects.filter(
                evento=instance,
                status__in=['PENDENTE', 'EM_ANDAMENTO']
            )
            
            for tarefa in tarefas:
                tarefa.status = 'CONCLUIDA'
                tarefa.resultado = f"Evento '{instance.titulo}' realizado"
                tarefa.data_conclusao = timezone.now()
                tarefa.save()
                print(f"✅ Tarefa {tarefa.id} concluída automaticamente (evento realizado)")
        except Exception as e:
            print(f"❌ Erro ao atualizar tarefa de evento: {e}")


