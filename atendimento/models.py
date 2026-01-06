from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from accounts.models import Gabinete, User
from crm.models import Pessoa


def proximo_numero(gabinete, tipo):
    """
    Gera o próximo número sequencial para protocolos
    Formato: AAAA-00001
    """
    ano_atual = timezone.now().year
    
    # Busca ou cria a sequência para o gabinete, ano e tipo
    sequencia, created = Sequencia.objects.get_or_create(
        gabinete=gabinete,
        ano=ano_atual,
        tipo=tipo,
        defaults={'numero': 0}
    )
    
    # Incrementa o número
    sequencia.numero += 1
    sequencia.save()
    
    # Retorna no formato AAAA-00001
    return f"{ano_atual}-{sequencia.numero:05d}"


class Sequencia(models.Model):
    """Controla a numeração sequencial por gabinete, ano e tipo"""
    TIPO_CHOICES = [
        ('PROTOCOLO', 'Protocolo'),
        ('OFICIO', 'Ofício'),
        ('MEMORANDO', 'Memorando'),
        ('REQUERIMENTO', 'Requerimento'),
        ('INDICACAO', 'Indicação'),
    ]
    
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='sequencias',
        verbose_name='Gabinete'
    )
    ano = models.IntegerField(verbose_name='Ano')
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        verbose_name='Tipo'
    )
    numero = models.IntegerField(default=0, verbose_name='Último Número')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Sequência'
        verbose_name_plural = 'Sequências'
        unique_together = ['gabinete', 'ano', 'tipo']
        ordering = ['gabinete', 'ano', 'tipo']

    def __str__(self):
        return f"{self.gabinete.nome} - {self.ano} - {self.get_tipo_display()}"


class Atendimento(models.Model):
    """Modelo para atendimentos/protocolos do gabinete - Sistema completo de rastreabilidade"""
    
    STATUS_CHOICES = [
        ('ABERTO', 'Aberto'),
        ('ANDAMENTO', 'Em Andamento'),
        ('RESOLVIDO', 'Resolvido'),
        ('ARQUIVADO', 'Arquivado'),
    ]
    
    PRIORIDADE_CHOICES = [
        (1, 'Baixa'),
        (2, 'Normal'),
        (3, 'Alta'),
        (4, 'Urgente'),
        (5, 'Crítica'),
    ]
    
    ORIGEM_CHOICES = [
        ('PRESENCIAL', 'Atendimento Presencial'),
        ('TELEFONE', 'Telefone'),
        ('EMAIL', 'E-mail'),
        ('WHATSAPP', 'WhatsApp'),
        ('PORTAL', 'Portal do Cidadão'),
        ('REDES_SOCIAIS', 'Redes Sociais'),
        ('OFICIO', 'Ofício Recebido'),
        ('INDICACAO', 'Indicação'),
        ('AUDIENCIA', 'Audiência Pública'),
        ('REUNIAO', 'Reunião'),
        ('OUTRO', 'Outro'),
    ]
    
    TIPO_SOLICITANTE_CHOICES = [
        ('CIDADAO', 'Cidadão'),
        ('ENTIDADE', 'Entidade/Associação'),
        ('EMPRESA', 'Empresa'),
        ('ORGAO_PUBLICO', 'Órgão Público'),
        ('VEREADOR', 'Vereador'),
        ('DEPUTADO', 'Deputado'),
        ('PREFEITO', 'Prefeito'),
        ('SECRETARIA', 'Secretaria'),
        ('ONG', 'ONG'),
        ('SINDICATO', 'Sindicato'),
        ('OUTRO', 'Outro'),
    ]
    
    SATISFACAO_CHOICES = [
        (1, 'Muito Insatisfeito'),
        (2, 'Insatisfeito'),
        (3, 'Neutro'),
        (4, 'Satisfeito'),
        (5, 'Muito Satisfeito'),
    ]

    # Informações Básicas
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='atendimentos',
        verbose_name='Gabinete'
    )
    protocolo = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Protocolo'
    )
    
    # Solicitante
    pessoa = models.ForeignKey(
        Pessoa,
        on_delete=models.CASCADE,
        related_name='atendimentos',
        verbose_name='Solicitante'
    )
    tipo_solicitante = models.CharField(
        max_length=20,
        choices=TIPO_SOLICITANTE_CHOICES,
        default='CIDADAO',
        verbose_name='Tipo de Solicitante'
    )
    
    # Classificação e Categoria
    assunto = models.CharField(max_length=200, verbose_name='Assunto/Título')
    categoria = models.ForeignKey(
        'accounts.Assunto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atendimentos',
        verbose_name='Categoria'
    )
    descricao = models.TextField(verbose_name='Descrição Detalhada')
    
    # Controle e Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ABERTO',
        verbose_name='Status'
    )
    prioridade = models.IntegerField(
        choices=PRIORIDADE_CHOICES,
        default=2,
        verbose_name='Prioridade'
    )
    
    # Origem e Canal
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        default='PRESENCIAL',
        verbose_name='Canal de Origem'
    )
    origem_detalhes = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Detalhes da Origem',
        help_text='Ex: nome da rede social, número do ofício, etc.'
    )
    
    # Responsabilidade
    responsavel = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atendimentos_responsavel',
        verbose_name='Responsável'
    )
    prazo = models.DateField(
        null=True,
        blank=True,
        verbose_name='Prazo para Resolução'
    )
    
    # Vinculações/Rastreabilidade
    evento_origem = models.ForeignKey(
        'agenda.Evento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atendimentos_gerados',
        verbose_name='Evento de Origem',
        help_text='Se este atendimento foi gerado a partir de uma reunião/evento'
    )
    
    # Localização
    municipio = models.CharField(max_length=100, blank=True, verbose_name='Município')
    bairro = models.CharField(max_length=100, blank=True, verbose_name='Bairro')
    endereco_referencia = models.TextField(blank=True, verbose_name='Endereço/Referência')
    
    # Avaliação
    satisfacao = models.IntegerField(
        choices=SATISFACAO_CHOICES,
        null=True,
        blank=True,
        verbose_name='Avaliação de Satisfação'
    )
    feedback = models.TextField(blank=True, verbose_name='Feedback do Cidadão')
    
    # Observações e Histórico
    observacoes = models.TextField(blank=True, verbose_name='Observações Internas')
    solucao = models.TextField(blank=True, verbose_name='Solução/Encaminhamento')
    
    # Metadados
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atendimentos_criados',
        verbose_name='Criado por'
    )
    resolvido_em = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Resolvido em'
    )
    resolvido_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='atendimentos_resolvidos',
        verbose_name='Resolvido por'
    )

    class Meta:
        verbose_name = 'Atendimento'
        verbose_name_plural = 'Atendimentos'
        ordering = ['-criado_em']

    def __str__(self):
        return f"{self.protocolo} - {self.assunto}"

    def save(self, *args, **kwargs):
        # Gerar protocolo se for um novo atendimento (não tem pk)
        if not self.pk and not self.protocolo:
            self.protocolo = proximo_numero(self.gabinete, 'PROTOCOLO')
        
        # Se status mudou para RESOLVIDO, definir data e usuário de resolução
        if self.status == 'RESOLVIDO' and not self.resolvido_em:
            self.resolvido_em = timezone.now()
        elif self.status != 'RESOLVIDO':
            self.resolvido_em = None
            self.resolvido_por = None
            
        super().save(*args, **kwargs)

    def get_prioridade_display(self):
        """Retorna a prioridade formatada"""
        return dict(self.PRIORIDADE_CHOICES).get(self.prioridade, self.prioridade)

    def get_satisfacao_display(self):
        """Retorna a satisfação formatada"""
        if self.satisfacao:
            return dict(self.SATISFACAO_CHOICES).get(self.satisfacao, self.satisfacao)
        return 'Não avaliado'
    
    def get_cor_prioridade(self):
        """Retorna a cor baseada na prioridade"""
        cores = {
            1: '#28a745',  # Verde - Baixa
            2: '#17a2b8',  # Azul - Normal
            3: '#ffc107',  # Amarelo - Alta
            4: '#fd7e14',  # Laranja - Urgente
            5: '#dc3545',  # Vermelho - Crítica
        }
        return cores.get(self.prioridade, '#6c757d')

    @property
    def atrasado(self):
        """Verifica se o atendimento está atrasado"""
        if self.prazo and self.status not in ['RESOLVIDO', 'ARQUIVADO']:
            return timezone.now().date() > self.prazo
        return False

    @property
    def dias_para_prazo(self):
        """Retorna quantos dias faltam para o prazo"""
        if self.prazo and self.status not in ['RESOLVIDO', 'ARQUIVADO']:
            delta = self.prazo - timezone.now().date()
            return delta.days
        return None
    
    @property
    def tempo_resposta(self):
        """Calcula o tempo de resposta em dias"""
        if self.resolvido_em:
            delta = self.resolvido_em - self.criado_em
            return delta.days
        return None
    
    @property
    def documentos_gerados(self):
        """Retorna documentos gerados a partir deste atendimento"""
        from documentos.models import Oficio, Memorando, Requerimento, Indicacao
        docs = []
        docs.extend(Oficio.objects.filter(atendimento=self))
        docs.extend(Memorando.objects.filter(atendimento=self))
        docs.extend(Requerimento.objects.filter(atendimento=self))
        docs.extend(Indicacao.objects.filter(atendimento=self))
        return docs



