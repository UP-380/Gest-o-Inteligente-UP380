from django.db import models
from django.conf import settings
from django.utils import timezone


class Evento(models.Model):
    """Eventos e compromissos da agenda parlamentar"""
    
    class Tipo(models.TextChoices):
        # Sessões e Reuniões Legislativas
        SESSAO_PLENARIA = 'SESSAO_PLENARIA', 'Sessão Plenária'
        SESSAO_EXTRAORDINARIA = 'SESSAO_EXTRAORDINARIA', 'Sessão Extraordinária'
        COMISSAO = 'COMISSAO', 'Reunião de Comissão'
        
        # Audiências e Atendimentos
        AUDIENCIA_PUBLICA = 'AUDIENCIA_PUBLICA', 'Audiência Pública'
        AUDIENCIA_PRIVADA = 'AUDIENCIA_PRIVADA', 'Audiência Privada'
        ATENDIMENTO = 'ATENDIMENTO', 'Atendimento'
        
        # Reuniões Externas
        REUNIAO_EXECUTIVO = 'REUNIAO_EXECUTIVO', 'Reunião com Executivo'
        REUNIAO_COMUNIDADE = 'REUNIAO_COMUNIDADE', 'Reunião com Comunidade'
        REUNIAO_ENTIDADE = 'REUNIAO_ENTIDADE', 'Reunião com Entidade'
        REUNIAO_TRABALHO = 'REUNIAO_TRABALHO', 'Reunião de Trabalho'
        
        # Eventos e Solenidades
        EVENTO_PUBLICO = 'EVENTO_PUBLICO', 'Evento Público'
        INAUGURACAO = 'INAUGURACAO', 'Inauguração'
        SOLENIDADE = 'SOLENIDADE', 'Solenidade'
        HOMENAGEM = 'HOMENAGEM', 'Homenagem'
        
        # Visitas e Fiscalizações
        VISITA_TECNICA = 'VISITA_TECNICA', 'Visita Técnica'
        FISCALIZACAO = 'FISCALIZACAO', 'Fiscalização'
        VISTORIA = 'VISTORIA', 'Vistoria'
        
        # Comunicação e Mídia
        ENTREVISTA = 'ENTREVISTA', 'Entrevista'
        COLETIVA = 'COLETIVA', 'Coletiva de Imprensa'
        GRAVACAO = 'GRAVACAO', 'Gravação'
        
        # Administrativo
        VIAGEM = 'VIAGEM', 'Viagem'
        CAPACITACAO = 'CAPACITACAO', 'Capacitação/Curso'
        OUTRO = 'OUTRO', 'Outro'
    
    class Status(models.TextChoices):
        AGENDADO = 'AGENDADO', 'Agendado'
        CONFIRMADO = 'CONFIRMADO', 'Confirmado'
        EM_ANDAMENTO = 'EM_ANDAMENTO', 'Em Andamento'
        REALIZADO = 'REALIZADO', 'Realizado'
        CANCELADO = 'CANCELADO', 'Cancelado'
        ADIADO = 'ADIADO', 'Adiado'
    
    # Informações Básicas
    gabinete = models.ForeignKey('accounts.Gabinete', on_delete=models.CASCADE, related_name='eventos')
    titulo = models.CharField(max_length=200, verbose_name='Título')
    descricao = models.TextField(blank=True, verbose_name='Descrição')
    tipo = models.CharField(max_length=30, choices=Tipo.choices, default=Tipo.REUNIAO_TRABALHO, verbose_name='Tipo')
    categoria = models.ForeignKey(
        'accounts.Assunto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos',
        verbose_name='Categoria'
    )
    
    # Status e Controle
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AGENDADO, verbose_name='Status')
    prioridade = models.IntegerField(
        choices=[(1, 'Baixa'), (2, 'Normal'), (3, 'Alta'), (4, 'Urgente')],
        default=2,
        verbose_name='Prioridade'
    )
    
    # Data e Hora
    inicio = models.DateTimeField(verbose_name='Data/Hora Início')
    fim = models.DateTimeField(verbose_name='Data/Hora Fim')
    dia_inteiro = models.BooleanField(default=False, verbose_name='Dia Inteiro')
    
    # Local
    local = models.CharField(max_length=200, blank=True, verbose_name='Local')
    endereco_completo = models.TextField(blank=True, verbose_name='Endereço Completo')
    link = models.URLField(blank=True, verbose_name='Link (reunião online)')
    
    # Participantes e Organização
    organizador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_organizados',
        verbose_name='Organizador'
    )
    participantes_pessoas = models.ManyToManyField(
        'crm.Pessoa',
        blank=True,
        related_name='eventos',
        verbose_name='Participantes (Pessoas)'
    )
    participantes_equipe = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='eventos_participando',
        verbose_name='Participantes (Equipe)'
    )
    numero_participantes_esperado = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Número Esperado de Participantes'
    )
    
    # Vinculações/Rastreabilidade
    atendimento_origem = models.ForeignKey(
        'atendimento.Atendimento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_gerados',
        verbose_name='Atendimento de Origem'
    )
    
    # Lembretes e Notificações
    lembrete_minutos = models.PositiveIntegerField(
        default=60,
        verbose_name='Lembrete (minutos antes)',
        help_text='Enviar lembrete X minutos antes'
    )
    enviar_convite = models.BooleanField(default=False, verbose_name='Enviar Convite por E-mail')
    
    # Configurações
    is_publico = models.BooleanField(default=False, verbose_name='Evento Público')
    is_recorrente = models.BooleanField(default=False, verbose_name='Recorrente')
    recorrencia_tipo = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ('DIARIA', 'Diária'),
            ('SEMANAL', 'Semanal'),
            ('QUINZENAL', 'Quinzenal'),
            ('MENSAL', 'Mensal'),
        ],
        verbose_name='Tipo de Recorrência'
    )
    
    # Resultados e Acompanhamento
    ata = models.TextField(blank=True, verbose_name='Ata/Resumo')
    decisoes = models.TextField(blank=True, verbose_name='Decisões Tomadas')
    proximos_passos = models.TextField(blank=True, verbose_name='Próximos Passos')
    arquivos_anexos = models.JSONField(default=list, blank=True, verbose_name='Arquivos Anexos')
    
    # Observações
    observacoes = models.TextField(blank=True, verbose_name='Observações Internas')
    requisitos_especiais = models.TextField(blank=True, verbose_name='Requisitos Especiais')
    
    # Metadados
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_criados',
        verbose_name='Criado por'
    )

    class Meta:
        verbose_name = 'Evento'
        verbose_name_plural = 'Eventos'
        ordering = ['inicio']

    def __str__(self):
        return self.titulo

    def save(self, *args, **kwargs):
        # Validar se a data de fim é posterior à data de início
        if self.fim <= self.inicio:
            raise ValueError('A data de fim deve ser posterior à data de início.')
        super().save(*args, **kwargs)

    @property
    def duracao(self):
        """Retorna a duração do evento em horas"""
        if self.fim and self.inicio:
            delta = self.fim - self.inicio
            return delta.total_seconds() / 3600
        return 0

    @property
    def ja_aconteceu(self):
        """Verifica se o evento já aconteceu"""
        return timezone.now() > self.fim

    @property
    def esta_acontecendo(self):
        """Verifica se o evento está acontecendo agora"""
        agora = timezone.now()
        return self.inicio <= agora <= self.fim

    @property
    def vai_acontecer(self):
        """Verifica se o evento vai acontecer no futuro"""
        return timezone.now() < self.inicio

    @property
    def dias_para_evento(self):
        """Retorna quantos dias faltam para o evento"""
        if self.vai_acontecer:
            delta = self.inicio.date() - timezone.now().date()
            return delta.days
        return None
