from django.db import models
from django.utils import timezone
from django.conf import settings
from accounts.models import Gabinete
from atendimento.models import Atendimento, proximo_numero


class Publicacao(models.Model):
    """Notícias, relatórios e publicações públicas do gabinete"""
    
    TIPO_CHOICES = [
        ('NOTICIA', 'Notícia'),
        ('RELATORIO', 'Relatório'),
        ('COMUNICADO', 'Comunicado'),
        ('PRESTACAO_CONTAS', 'Prestação de Contas'),
        ('EVENTO', 'Evento/Atividade'),
    ]
    
    STATUS_CHOICES = [
        ('RASCUNHO', 'Rascunho'),
        ('AGUARDANDO_APROVACAO', 'Aguardando Aprovação'),
        ('PUBLICADO', 'Publicado'),
        ('ARQUIVADO', 'Arquivado'),
    ]
    
    # Informações Básicas
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='publicacoes',
        verbose_name='Gabinete'
    )
    titulo = models.CharField(max_length=200, verbose_name='Título')
    subtitulo = models.CharField(max_length=300, blank=True, verbose_name='Subtítulo')
    conteudo = models.TextField(verbose_name='Conteúdo')
    resumo = models.TextField(max_length=500, blank=True, verbose_name='Resumo',
                              help_text='Resumo que aparece na listagem')
    
    # Classificação
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='NOTICIA', verbose_name='Tipo')
    categoria = models.ForeignKey(
        'accounts.Assunto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='publicacoes',
        verbose_name='Categoria'
    )
    tags = models.CharField(max_length=200, blank=True, verbose_name='Tags',
                           help_text='Separadas por vírgula')
    
    # Mídia
    imagem_destaque = models.ImageField(
        upload_to='portal/publicacoes/%Y/%m/',
        blank=True,
        null=True,
        verbose_name='Imagem de Destaque'
    )
    arquivo_anexo = models.FileField(
        upload_to='portal/anexos/%Y/%m/',
        blank=True,
        null=True,
        verbose_name='Arquivo Anexo'
    )
    link_externo = models.URLField(blank=True, verbose_name='Link Externo')
    
    # Status e Publicação
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='RASCUNHO',
        verbose_name='Status'
    )
    publico = models.BooleanField(default=False, verbose_name='Visível ao Público')
    destaque = models.BooleanField(default=False, verbose_name='Publicação em Destaque')
    
    # Datas
    data_publicacao = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Data de Publicação'
    )
    
    # Controle
    visualizacoes = models.IntegerField(default=0, verbose_name='Visualizações')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='publicacoes_criadas',
        verbose_name='Criado por'
    )
    aprovado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='publicacoes_aprovadas',
        verbose_name='Aprovado por'
    )
    
    class Meta:
        verbose_name = 'Publicação'
        verbose_name_plural = 'Publicações'
        ordering = ['-data_publicacao', '-criado_em']
        indexes = [
            models.Index(fields=['gabinete', 'publico', 'status']),
            models.Index(fields=['data_publicacao']),
        ]
    
    def __str__(self):
        return self.titulo
    
    def save(self, *args, **kwargs):
        # Se mudou para PUBLICADO e não tem data de publicação, define agora
        if self.status == 'PUBLICADO' and not self.data_publicacao:
            self.data_publicacao = timezone.now()
            self.publico = True
        
        # Se status não é PUBLICADO, marca como não público
        if self.status != 'PUBLICADO':
            self.publico = False
        
        super().save(*args, **kwargs)
    
    @property
    def tags_list(self):
        """Retorna as tags como lista"""
        if self.tags:
            return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
        return []


class SolicitacaoPublica(models.Model):
    """Solicitações de atendimento vindas do portal público"""
    
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente'),
        ('EM_ANALISE', 'Em Análise'),
        ('RESPONDIDA', 'Respondida'),
        ('ATENDIMENTO_CRIADO', 'Atendimento Criado'),
        ('ARQUIVADA', 'Arquivada'),
    ]
    
    # Informações do Solicitante
    nome_solicitante = models.CharField(max_length=200, verbose_name='Nome Completo')
    cpf = models.CharField(max_length=14, blank=True, verbose_name='CPF',
                          help_text='Opcional, mas ajuda a identificar')
    email = models.EmailField(verbose_name='E-mail para Contato')
    telefone = models.CharField(max_length=20, verbose_name='Telefone')
    
    # Localização
    municipio = models.CharField(max_length=100, blank=True, verbose_name='Município')
    bairro = models.CharField(max_length=100, blank=True, verbose_name='Bairro')
    
    # Solicitação
    tipo_solicitacao = models.CharField(max_length=100, verbose_name='Tipo de Solicitação')
    assunto = models.CharField(max_length=200, verbose_name='Assunto')
    descricao = models.TextField(verbose_name='Descrição Detalhada')
    
    # Protocolo e Status
    protocolo_publico = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Protocolo Público',
        help_text='Protocolo para consulta pública'
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='PENDENTE',
        verbose_name='Status'
    )
    
    # Resposta
    resposta = models.TextField(blank=True, verbose_name='Resposta/Parecer')
    respondido_em = models.DateTimeField(null=True, blank=True, verbose_name='Respondido em')
    respondido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitacoes_respondidas',
        verbose_name='Respondido por'
    )
    
    # Vinculação Automática
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='solicitacoes_publicas',
        verbose_name='Gabinete'
    )
    atendimento_gerado = models.ForeignKey(
        'atendimento.Atendimento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitacao_origem',
        verbose_name='Atendimento Gerado'
    )
    pessoa_criada = models.ForeignKey(
        'crm.Pessoa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitacoes_publicas',
        verbose_name='Pessoa Criada no CRM'
    )
    
    # LGPD
    consentimento_lgpd = models.BooleanField(
        default=False,
        verbose_name='Consentimento LGPD',
        help_text='Cidadão autorizou tratamento de dados'
    )
    consentimento_texto = models.TextField(
        blank=True,
        verbose_name='Texto do Consentimento'
    )
    
    # Anexos
    anexo = models.FileField(
        upload_to='portal/solicitacoes/%Y/%m/',
        blank=True,
        null=True,
        verbose_name='Anexo'
    )
    
    # Metadados
    ip_origem = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP de Origem')
    user_agent = models.TextField(blank=True, verbose_name='User Agent')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    
    class Meta:
        verbose_name = 'Solicitação Pública'
        verbose_name_plural = 'Solicitações Públicas'
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['gabinete', 'status']),
            models.Index(fields=['protocolo_publico']),
            models.Index(fields=['cpf']),
            models.Index(fields=['email']),
        ]
    
    def __str__(self):
        return f"{self.protocolo_publico} - {self.nome_solicitante}"
    
    def save(self, *args, **kwargs):
        # Gerar protocolo se for nova solicitação
        if not self.pk and not self.protocolo_publico:
            # Formato: PUB-AAAA-NNNNN
            ano_atual = timezone.now().year
            ultimo = SolicitacaoPublica.objects.filter(
                gabinete=self.gabinete,
                protocolo_publico__startswith=f'PUB-{ano_atual}'
            ).order_by('-criado_em').first()
            
            if ultimo:
                # Extrai o número do último protocolo
                try:
                    numero = int(ultimo.protocolo_publico.split('-')[-1])
                    novo_numero = numero + 1
                except:
                    novo_numero = 1
            else:
                novo_numero = 1
            
            self.protocolo_publico = f'PUB-{ano_atual}-{novo_numero:05d}'
        
        # Se status mudou para RESPONDIDA, define data
        if self.status == 'RESPONDIDA' and not self.respondido_em:
            self.respondido_em = timezone.now()
        
        super().save(*args, **kwargs)
    
    @property
    def pode_criar_atendimento(self):
        """Verifica se pode criar atendimento"""
        return not self.atendimento_gerado and self.status != 'ARQUIVADA'


class AgendamentoVisita(models.Model):
    """Agendamentos de visitas ao gabinete solicitados pelo portal"""
    
    STATUS_CHOICES = [
        ('PENDENTE', 'Pendente Confirmação'),
        ('CONFIRMADO', 'Confirmado'),
        ('REALIZADO', 'Realizado'),
        ('CANCELADO', 'Cancelado'),
    ]
    
    # Solicitante
    nome = models.CharField(max_length=200, verbose_name='Nome Completo')
    cpf = models.CharField(max_length=14, blank=True, verbose_name='CPF')
    email = models.EmailField(verbose_name='E-mail')
    telefone = models.CharField(max_length=20, verbose_name='Telefone')
    
    # Visita
    motivo = models.CharField(max_length=200, verbose_name='Motivo da Visita')
    descricao = models.TextField(verbose_name='Descrição')
    data_desejada = models.DateField(verbose_name='Data Desejada')
    horario_preferencia = models.CharField(max_length=50, verbose_name='Horário de Preferência',
                                           help_text='Ex: Manhã, Tarde, 14h')
    
    # Controle
    gabinete = models.ForeignKey(
        Gabinete,
        on_delete=models.CASCADE,
        related_name='agendamentos_visitas',
        verbose_name='Gabinete'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDENTE', verbose_name='Status')
    protocolo = models.CharField(max_length=20, unique=True, verbose_name='Protocolo')
    
    # Vinculação
    evento_criado = models.ForeignKey(
        'agenda.Evento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agendamento_origem',
        verbose_name='Evento Criado'
    )
    
    # Resposta
    observacoes_internas = models.TextField(blank=True, verbose_name='Observações Internas')
    resposta_cidadao = models.TextField(blank=True, verbose_name='Resposta ao Cidadão')
    data_confirmada = models.DateTimeField(null=True, blank=True, verbose_name='Data/Hora Confirmada')
    
    # LGPD
    consentimento_lgpd = models.BooleanField(default=False, verbose_name='Consentimento LGPD')
    
    # Metadados
    ip_origem = models.GenericIPAddressField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')
    confirmado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Confirmado por'
    )
    
    class Meta:
        verbose_name = 'Agendamento de Visita'
        verbose_name_plural = 'Agendamentos de Visitas'
        ordering = ['-criado_em']
    
    def __str__(self):
        return f"{self.protocolo} - {self.nome}"
    
    def save(self, *args, **kwargs):
        # Gerar protocolo se for novo
        if not self.pk and not self.protocolo:
            ano_atual = timezone.now().year
            ultimo = AgendamentoVisita.objects.filter(
                gabinete=self.gabinete,
                protocolo__startswith=f'VIS-{ano_atual}'
            ).order_by('-criado_em').first()
            
            if ultimo:
                try:
                    numero = int(ultimo.protocolo.split('-')[-1])
                    novo_numero = numero + 1
                except:
                    novo_numero = 1
            else:
                novo_numero = 1
            
            self.protocolo = f'VIS-{ano_atual}-{novo_numero:05d}'
        
        super().save(*args, **kwargs)


